"""Gera os centroides usados pelos arcos do mapa (dado geográfico público do IBGE,
sem microdados) em cada nível de agregação:

  centroides.parquet       -- por município, via ST_Read + ST_PointOnSurface (ponto garantido
                               dentro do polígono real -- ver nota abaixo).
  centroides_rgi.parquet   -- por região imediata (RGI).
  centroides_rgint.parquet -- por região intermediária (RGInt).
  centroides_uf.parquet    -- por UF.

Nível município: `ST_PointOnSurface` (GEOS, via a extensão spatial do DuckDB) em vez de
`ST_Centroid` -- o centroide geométrico de um polígono côncavo ou composto (ilhas, recortes
de baía) pode cair fora da própria área (ex.: municípios litorâneos em ferradura); o "ponto
na superfície" é sempre interior ao polígono, ainda determinístico e com custo equivalente.
F2 (mapa-representacao): ver plano, "Centroides dentro do polígono".

Os níveis agregados (RGI/RGInt/UF) continuam com a MÉDIA dos centroides municipais
ponderada pela população (pop5, de municipios.parquet), em vez de um `ST_PointOnSurface`
do polígono dissolvido: é uma aproximação (desloca o ponto para onde está a população, não
para o meio da área), mas evita depender de leitura de TopoJSON pela extensão espacial do
DuckDB (que não lê esse formato) e de um passo extra de exportação/limpeza de GeoJSON
temporário -- e para arcos de fluxo, ancorar no centro de massa populacional é, se algo,
mais representativo que o centro geométrico (ou "ponto na superfície") da área dissolvida.
Documentado aqui e no relatório de QA da F6.

Por edição (ver pipeline/edicoes.py): a malha bruta é lida de
<geo_raw>/BR_Municipios_<edicao>.shp e os centroides são escritos em <processed>/geo/.
"""
import argparse
import pathlib
import sys

import duckdb

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "pipeline"))
from edicoes import edicao as get_edicao  # noqa: E402

# placeholders, corpos d'água e (só na malha 2000) o artefato de gap-fill "0" que
# geo/fetch_2000.sh -clean introduz numa feição sem geocódigo (ver comentário em geo/build.sh)
EXCLUIDOS = ("8888888", "9999999", "4300001", "4300002", "0")


def build_municipios(con: duckdb.DuckDBPyConnection, raw: pathlib.Path, geo: pathlib.Path) -> None:
    dest = geo / "centroides.parquet"
    excl = ", ".join(f"'{c}'" for c in EXCLUIDOS)
    con.execute(f"""
        COPY (
            SELECT CD_MUN AS cd_mun,
                   ST_X(ST_PointOnSurface(geom)) AS lon,
                   ST_Y(ST_PointOnSurface(geom)) AS lat
            FROM ST_Read('{raw}')
            WHERE CD_MUN NOT IN ({excl})
        ) TO '{dest}' (FORMAT PARQUET)
    """)
    n = con.execute(f"SELECT COUNT(*) FROM read_parquet('{dest}')").fetchone()[0]
    bounds = con.execute(f"SELECT MIN(lon), MAX(lon), MIN(lat), MAX(lat) FROM read_parquet('{dest}')").fetchone()
    print(f"centroides.parquet: {n} municípios")
    print(f"  bounding box: lon [{bounds[0]:.2f}, {bounds[1]:.2f}]  lat [{bounds[2]:.2f}, {bounds[3]:.2f}]")


def build_agregado(con: duckdb.DuckDBPyConnection, campo_cd: str, nome_arquivo: str,
                    geo: pathlib.Path, municipios: pathlib.Path) -> None:
    """Centroide de um nível agregado = média dos centroides municipais, ponderada por pop5."""
    dest = geo / nome_arquivo
    con.execute(f"""
        COPY (
            SELECT m.{campo_cd} AS cd,
                   SUM(c.lon * m.pop5) / NULLIF(SUM(m.pop5), 0) AS lon,
                   SUM(c.lat * m.pop5) / NULLIF(SUM(m.pop5), 0) AS lat
            FROM read_parquet('{municipios}') m
            JOIN read_parquet('{geo}/centroides.parquet') c USING (cd_mun)
            WHERE m.{campo_cd} IS NOT NULL
            GROUP BY m.{campo_cd}
        ) TO '{dest}' (FORMAT PARQUET)
    """)
    n = con.execute(f"SELECT COUNT(*) FROM read_parquet('{dest}')").fetchone()[0]
    print(f"{nome_arquivo}: {n} unidades")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--edicao", default="2022", help="Edição do censo (ver pipeline/edicoes.py).")
    args = ap.parse_args()
    ed = get_edicao(args.edicao)

    raw = ROOT / ed.geo_raw / f"BR_Municipios_{ed.nome}.shp"
    geo = ROOT / ed.processed / "geo"
    municipios = ROOT / ed.processed / "municipios.parquet"
    geo.mkdir(parents=True, exist_ok=True)

    con = duckdb.connect()
    con.execute("INSTALL spatial; LOAD spatial;")
    build_municipios(con, raw, geo)
    build_agregado(con, "cd_rgi", "centroides_rgi.parquet", geo, municipios)
    build_agregado(con, "cd_rgint", "centroides_rgint.parquet", geo, municipios)
    build_agregado(con, "uf", "centroides_uf.parquet", geo, municipios)


if __name__ == "__main__":
    main()
