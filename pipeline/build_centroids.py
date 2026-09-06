"""Gera os centroides usados pelos arcos do mapa (dado geográfico público do IBGE,
sem microdados) em cada nível de agregação:

  centroides.parquet       -- por município, via ST_Read + ST_Centroid (polígono real).
  centroides_rgi.parquet   -- por região imediata (RGI).
  centroides_rgint.parquet -- por região intermediária (RGInt).
  centroides_uf.parquet    -- por UF.

Os níveis agregados usam a MÉDIA dos centroides municipais ponderada pela população
(pop5, de municipios.parquet), em vez do centroide geométrico do polígono dissolvido:
é uma aproximação (desloca o ponto para onde está a população, não para o meio da área),
mas evita depender de leitura de TopoJSON pela extensão espacial do DuckDB (que não lê
esse formato) e de um passo extra de exportação/limpeza de GeoJSON temporário -- e para
arcos de fluxo, ancorar no centro de massa populacional é, se algo, mais representativo
que o centro geométrico da área. Documentado aqui e no relatório de QA da F6.
"""
import pathlib

import duckdb

ROOT = pathlib.Path(__file__).resolve().parent.parent
RAW = ROOT / "data/geo/raw/BR_Municipios_2022.shp"
GEO = ROOT / "data/processed/geo"
MUNICIPIOS = ROOT / "data/processed/municipios.parquet"

EXCLUIDOS = ("8888888", "9999999", "4300001", "4300002")  # placeholders e corpos d'água


def build_municipios(con: duckdb.DuckDBPyConnection) -> None:
    dest = GEO / "centroides.parquet"
    excl = ", ".join(f"'{c}'" for c in EXCLUIDOS)
    con.execute(f"""
        COPY (
            SELECT CD_MUN AS cd_mun,
                   ST_X(ST_Centroid(geom)) AS lon,
                   ST_Y(ST_Centroid(geom)) AS lat
            FROM ST_Read('{RAW}')
            WHERE CD_MUN NOT IN ({excl})
        ) TO '{dest}' (FORMAT PARQUET)
    """)
    n = con.execute(f"SELECT COUNT(*) FROM read_parquet('{dest}')").fetchone()[0]
    bounds = con.execute(f"SELECT MIN(lon), MAX(lon), MIN(lat), MAX(lat) FROM read_parquet('{dest}')").fetchone()
    print(f"centroides.parquet: {n} municípios")
    print(f"  bounding box: lon [{bounds[0]:.2f}, {bounds[1]:.2f}]  lat [{bounds[2]:.2f}, {bounds[3]:.2f}]")


def build_agregado(con: duckdb.DuckDBPyConnection, campo_cd: str, nome_arquivo: str) -> None:
    """Centroide de um nível agregado = média dos centroides municipais, ponderada por pop5."""
    dest = GEO / nome_arquivo
    con.execute(f"""
        COPY (
            SELECT m.{campo_cd} AS cd,
                   SUM(c.lon * m.pop5) / NULLIF(SUM(m.pop5), 0) AS lon,
                   SUM(c.lat * m.pop5) / NULLIF(SUM(m.pop5), 0) AS lat
            FROM read_parquet('{MUNICIPIOS}') m
            JOIN read_parquet('{GEO}/centroides.parquet') c USING (cd_mun)
            WHERE m.{campo_cd} IS NOT NULL
            GROUP BY m.{campo_cd}
        ) TO '{dest}' (FORMAT PARQUET)
    """)
    n = con.execute(f"SELECT COUNT(*) FROM read_parquet('{dest}')").fetchone()[0]
    print(f"{nome_arquivo}: {n} unidades")


def main() -> None:
    con = duckdb.connect()
    con.execute("INSTALL spatial; LOAD spatial;")
    build_municipios(con)
    build_agregado(con, "cd_rgi", "centroides_rgi.parquet")
    build_agregado(con, "cd_rgint", "centroides_rgint.parquet")
    build_agregado(con, "uf", "centroides_uf.parquet")


if __name__ == "__main__":
    main()
