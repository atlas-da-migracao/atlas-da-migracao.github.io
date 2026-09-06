"""Orquestra o pipeline DuckDB: executa pipeline/sql/NN_*.sql em ordem.

Regra de sigilo: este script só roda agregações/COPY sobre data/raw e data/interim;
nunca imprime linhas individuais. Uso:
    python pipeline/run.py [prefixo]     # ex.: python pipeline/run.py 01   -> só 01_extract.sql
"""
import sys
import time
import pathlib
import duckdb

ROOT = pathlib.Path(__file__).resolve().parent.parent
SQL_DIR = ROOT / "pipeline" / "sql"


def run_all(prefix: str | None = None) -> None:
    scripts = sorted(SQL_DIR.glob("*.sql"))
    if prefix:
        scripts = [s for s in scripts if s.name.startswith(prefix)]
    if not scripts:
        print(f"Nenhum script encontrado em {SQL_DIR} (prefixo={prefix!r}).")
        raise SystemExit(1)

    con = duckdb.connect()
    for script in scripts:
        print(f"== {script.name} ==")
        sql = script.read_text(encoding="utf-8")
        t0 = time.time()
        con.execute(sql)
        dt = time.time() - t0
        print(f"   ok em {dt:.1f}s")
    con.close()


if __name__ == "__main__":
    import os
    os.chdir(ROOT)
    run_all(sys.argv[1] if len(sys.argv) > 1 else None)
