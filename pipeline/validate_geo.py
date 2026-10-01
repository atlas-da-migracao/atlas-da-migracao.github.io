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
     0,1%. Um anel OGC-válido ainda pode triangular mal (vértices quase coincidentes numa
     costura de -dissolve, anel com auto-toque) -- é essa checagem que captura o defeito
     visto no app ("faixa/triângulo cortando o mapa").
  3. Deformação da simplificação (só municípios, versão Albers): o ponto-na-superfície de
     cada município, calculado por build_centroids.py sobre a malha BRUTA, tem de cair
     dentro do polígono PUBLICADO. Com `-simplify 1%` em todas as edições (até 30/09/2026),
     as malhas históricas, de fonte muito menos densa, ficavam com 6-10 vértices por
     município e 4,4% (1980), 4,3% (1991) e 1,7% (2000) dos pontos caíam fora -- área
     redistribuída entre vizinhos pelo -clean. Com a tolerância em metros (geo/build.sh,
     SIMP_MUN) o resíduo fica em ~0,05%; o limiar de reprovação é LIMIAR_FORA (0,5%).
     Pulada, com aviso, se centroides.parquet ainda não existir (ele é gerado depois do
     publish, ver build_centroids.py).
  4. Extensão dos níveis agregados (UF/RGI/RGInt, versão Albers): a caixa envolvente de cada
     produto dissolvido tem de coincidir com a da malha municipal da mesma edição, com
     tolerância LIMIAR_BBOX_M. Pega uma parte insular descartada na dissolução/simplificação:
     com `-simplify 5%`/`1.5%`, Fernando de Noronha sumia das malhas de UF/RGI/RGInt de 2000,
     1991 e 1980 (a UF 26 virava um Polygon único) -- ~350 km de diferença no x máximo.

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
# F10: cada produto também publica uma versão em metros (projeção Albers, ver
# docs/METODOLOGIA.md) -- ST_IsValid e a triangulação earcut não dependem de CRS, então o
# mesmo par de checagens vale para ela; o campo de id é o mesmo do produto em graus.
ARQUIVOS_POR_PRODUTO = {p: [f"{p}.topojson", f"{p}_albers.topojson"] for p in PRODUTOS}


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


# Fração máxima de municípios cujo ponto-na-superfície (malha bruta) cai fora do polígono
# publicado -- ver item 3 da docstring. Medido depois da mudança para tolerância em metros:
# 2/3.991 em 1980 (malha com os 52 municípios do norte de Goiás, 1.1.0-1980).
LIMIAR_FORA = 0.005

# Item 4: diferença máxima, em metros, entre a caixa envolvente de um produto dissolvido
# (UF/RGI/RGInt, Albers) e a da malha municipal da mesma edição. As tolerâncias de
# simplificação (700 m / 1000 m) e a quantização (~50 m) explicam diferenças de até ~1 km;
# uma ilha perdida dá centenas de quilômetros.
LIMIAR_BBOX_M = 5_000
PRODUTOS_DISSOLVIDOS = ["uf", "rgi", "rgint"]


def _bbox(con: duckdb.DuckDBPyConnection, geojson_path: pathlib.Path) -> tuple[float, float, float, float]:
    con.execute("INSTALL spatial; LOAD spatial;")
    return con.execute(f"""
        SELECT MIN(ST_XMin(geom)), MIN(ST_YMin(geom)), MAX(ST_XMax(geom)), MAX(ST_YMax(geom))
        FROM ST_Read('{geojson_path.as_posix()}')
    """).fetchone()


def _checa_centroides_dentro(con: duckdb.DuckDBPyConnection, geojson_path: pathlib.Path,
                             centroides: pathlib.Path) -> tuple[int, int, list[str]]:
    """(n, fora, ids) -- municípios cujo ponto x_albers/y_albers não está contido no polígono."""
    con.execute("INSTALL spatial; LOAD spatial;")
    linhas = con.execute(f"""
        WITH g AS (SELECT CD_MUN AS cd, geom FROM ST_Read('{geojson_path.as_posix()}')),
             c AS (SELECT cd_mun AS cd, ST_Point(x_albers, y_albers) AS p
                   FROM read_parquet('{centroides.as_posix()}'))
        SELECT cd, ST_Contains(g.geom, c.p) AS dentro FROM g JOIN c USING (cd)
    """).fetchall()
    fora = [cd for cd, dentro in linhas if not dentro]
    return len(linhas), len(fora), fora


def valida_edicao(con: duckdb.DuckDBPyConnection, nome_edicao: str) -> list[str]:
    ed = get_edicao(nome_edicao)
    geo_dir = ROOT / ed.processed / "geo"
    problemas: list[str] = []
    for produto, nomes_arquivo in ARQUIVOS_POR_PRODUTO.items():
        for nome_arquivo in nomes_arquivo:
            caminho = geo_dir / nome_arquivo
            if not caminho.exists():
                print(f"  [aviso] {caminho} não existe, pulando")
                continue
            problemas.extend(valida_arquivo(con, caminho, produto))

    # item 3: deformação da simplificação (ponto-na-superfície da malha bruta dentro do
    # polígono publicado). Só municípios, só Albers (é a malha que o app desenha).
    malha = geo_dir / "municipios_albers.topojson"
    centroides = geo_dir / "centroides.parquet"
    if not malha.exists():
        return problemas
    with tempfile.TemporaryDirectory() as tmp:
        geojson_path = pathlib.Path(tmp) / "municipios_albers.geojson"
        _decodifica(malha, geojson_path)
        if centroides.exists():
            n, fora, ids = _checa_centroides_dentro(con, geojson_path, centroides)
            print(f"  ponto-na-superfície fora do polígono publicado: {fora} de {n}")
            if n and fora / n > LIMIAR_FORA:
                problemas.append(
                    f"{malha}: {fora} de {n} municípios ({100 * fora / n:.1f}%) com o ponto-na-superfície "
                    f"fora do polígono publicado (limiar {100 * LIMIAR_FORA:.1f}%) -- simplificação "
                    f"deformou a malha; ex.: {', '.join(ids[:8])}"
                )
        else:
            print(f"  [aviso] {centroides} não existe, checagem de deformação pulada (rode build_centroids.py)")

        # item 4: a extensão de cada nível dissolvido tem de ser a da malha municipal (ilhas
        # incluídas -- ver docstring, caso Fernando de Noronha).
        bbox_mun = _bbox(con, geojson_path)
        for produto in PRODUTOS_DISSOLVIDOS:
            arq = geo_dir / f"{produto}_albers.topojson"
            if not arq.exists():
                continue
            gj = pathlib.Path(tmp) / f"{produto}_albers.geojson"
            _decodifica(arq, gj)
            bbox = _bbox(con, gj)
            desvio = max(abs(a - b) for a, b in zip(bbox, bbox_mun))
            print(f"  extensão de {produto} x municípios: desvio máximo {desvio / 1000:.1f} km")
            if desvio > LIMIAR_BBOX_M:
                problemas.append(
                    f"{arq}: caixa envolvente difere da malha municipal em {desvio / 1000:.0f} km "
                    f"(limiar {LIMIAR_BBOX_M / 1000:.0f} km) -- alguma parte (ilha?) foi perdida na "
                    f"dissolução/simplificação; bbox {tuple(round(v) for v in bbox)} x municípios "
                    f"{tuple(round(v) for v in bbox_mun)}"
                )
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
    print("\nok -- toda a malha verificada passou em ST_IsValid, na triangulação earcut, na checagem de deformação e na de extensão.")


if __name__ == "__main__":
    main()
