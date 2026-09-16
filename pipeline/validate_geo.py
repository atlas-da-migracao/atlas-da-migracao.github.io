"""F9.10: valida a malha geográfica publicada (TopoJSON de data/processed/**/geo) -- dado
público do IBGE, sem microdados, sem restrição de sigilo.

Decodifica cada TopoJSON para GeoJSON (via `geo/decode_topojson.mjs`, mesma lib
topojson-client que o front-end usa em runtime) e roda duas checagens independentes por
feição:

  1. `ST_IsValid` (GEOS, via extensão spatial do DuckDB) -- geometria válida no sentido OGC
     (sem autointerseção de anel, etc.).
  2. Triangulação com o MESMO earcut que o deck.gl usa (`geo/validate_earcut.mjs`,
     web/node_modules/earcut) -- reprova se o centroide de algum triângulo cai fora do
     polígono, ou se a soma das áreas dos triângulos difere da área do polígono em mais de
     0,1%. Um anel OGC-válido ainda pode triangular mal (ver docstring de
     pipeline/gridsplit_geom.py) -- é essa checagem que captura o defeito visto no app.

Uso:
    python pipeline/validate_geo.py [--edicao 2022|--todas]

Sai com código != 0 e lista as feições problemáticas se alguma checagem falhar em qualquer
arquivo (municipios/uf/rgi/rgint) de alguma edição verificada.
"""
from __future__ import annotations

import argparse
import json
import pathlib
import subprocess
import sys
import tempfile

import duckdb

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "pipeline"))
from edicoes import EDICOES, edicao as get_edicao  # noqa: E402

DECODE_JS = ROOT / "geo/decode_topojson.mjs"
EARCUT_JS = ROOT / "geo/validate_earcut.mjs"

PRODUTOS = ["municipios", "uf", "rgi", "rgint"]


def _decodifica(topojson_path: pathlib.Path, geojson_path: pathlib.Path) -> None:
    subprocess.run(
        ["node", str(DECODE_JS), str(topojson_path), str(geojson_path)],
        check=True, cwd=ROOT,
    )


def _checa_isvalid(con: duckdb.DuckDBPyConnection, geojson_path: pathlib.Path, campo_id: str) -> list[dict]:
    con.execute("INSTALL spatial; LOAD spatial;")
    linhas = con.execute(f"""
        SELECT {campo_id} AS id
        FROM ST_Read('{geojson_path.as_posix()}')
        WHERE NOT ST_IsValid(geom)
    """).fetchall()
    return [{"id": r[0], "motivo": "autointerseção (ST_IsValid=false)"} for r in linhas]


def _checa_earcut(geojson_path: pathlib.Path) -> list[dict]:
    resultado = subprocess.run(
        ["node", str(EARCUT_JS), str(geojson_path)],
        check=True, cwd=ROOT, capture_output=True, text=True,
    )
    return json.loads(resultado.stdout)


CAMPO_ID_POR_PRODUTO = {
    "municipios": "CD_MUN", "uf": "cd_uf", "rgi": "cd_rgi", "rgint": "cd_rgint",
}


def valida_arquivo(con: duckdb.DuckDBPyConnection, topojson_path: pathlib.Path, produto: str) -> list[str]:
    problemas: list[str] = []
    with tempfile.TemporaryDirectory() as tmp:
        geojson_path = pathlib.Path(tmp) / "decoded.geojson"
        _decodifica(topojson_path, geojson_path)

        campo_id = CAMPO_ID_POR_PRODUTO[produto]
        invalidos = _checa_isvalid(con, geojson_path, campo_id)
        for inv in invalidos:
            problemas.append(f"{topojson_path}: {inv['id']} ST_IsValid=false ({inv['motivo']})")

        ruins_earcut = _checa_earcut(geojson_path)
        for r in ruins_earcut:
            problemas.append(
                f"{topojson_path}: {r['id']} ({r['nome']}) triangulação ruim -- "
                f"desvio_area={r['desvio_area']}, fora_do_poligono={r['fora_do_poligono']}"
            )
    return problemas


def valida_edicao(con: duckdb.DuckDBPyConnection, nome_edicao: str) -> list[str]:
    ed = get_edicao(nome_edicao)
    geo_dir = ROOT / ed.processed / "geo"
    problemas: list[str] = []
    for produto in PRODUTOS:
        caminho = geo_dir / f"{produto}.topojson"
        if not caminho.exists():
            print(f"  [aviso] {caminho} não existe, pulando")
            continue
        problemas.extend(valida_arquivo(con, caminho, produto))
    return problemas


def main() -> None:
    ap = argparse.ArgumentParser()
    grupo = ap.add_mutually_exclusive_group()
    grupo.add_argument("--edicao", default=None, help="edição única (ex.: 2022, 2010, 1980)")
    grupo.add_argument("--todas", action="store_true", help="valida todas as edições em pipeline/edicoes.py")
    args = ap.parse_args()

    if args.todas:
        edicoes = sorted(EDICOES)
    elif args.edicao:
        edicoes = [args.edicao]
    else:
        edicoes = ["2022"]

    con = duckdb.connect()
    todos_problemas: list[str] = []
    for nome in edicoes:
        print(f"== edição {nome} ==")
        problemas = valida_edicao(con, nome)
        if problemas:
            for p in problemas:
                print(f"  [FALHA] {p}")
        else:
            print("  ok")
        todos_problemas.extend(problemas)

    if todos_problemas:
        print(f"\n{len(todos_problemas)} problema(s) encontrado(s).")
        sys.exit(1)
    print("\nok -- toda a malha verificada passou em ST_IsValid e na triangulação earcut.")


if __name__ == "__main__":
    main()
