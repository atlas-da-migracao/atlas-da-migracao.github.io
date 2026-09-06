"""Gera data/processed/geo/centroides.parquet a partir do shapefile municipal do IBGE.

Usa a extensão espacial do DuckDB (ST_Read + ST_Centroid) sobre um dado geográfico
público -- não há microdados envolvidos.
"""
import pathlib

import duckdb

ROOT = pathlib.Path(__file__).resolve().parent.parent
RAW = ROOT / "data/geo/raw/BR_Municipios_2022.shp"
DEST = ROOT / "data/processed/geo/centroides.parquet"

EXCLUIDOS = ("8888888", "9999999", "4300001", "4300002")  # placeholders e corpos d'água


def main() -> None:
    con = duckdb.connect()
    con.execute("INSTALL spatial; LOAD spatial;")
    excl = ", ".join(f"'{c}'" for c in EXCLUIDOS)
    con.execute(f"""
        COPY (
            SELECT CD_MUN AS cd_mun,
                   ST_X(ST_Centroid(geom)) AS lon,
                   ST_Y(ST_Centroid(geom)) AS lat
            FROM ST_Read('{RAW}')
            WHERE CD_MUN NOT IN ({excl})
        ) TO '{DEST}' (FORMAT PARQUET)
    """)
    n = con.execute(f"SELECT COUNT(*) FROM read_parquet('{DEST}')").fetchone()[0]
    bounds = con.execute(f"SELECT MIN(lon), MAX(lon), MIN(lat), MAX(lat) FROM read_parquet('{DEST}')").fetchone()
    print(f"centroides.parquet: {n} municípios")
    print(f"  bounding box: lon [{bounds[0]:.2f}, {bounds[1]:.2f}]  lat [{bounds[2]:.2f}, {bounds[3]:.2f}]")


if __name__ == "__main__":
    main()
