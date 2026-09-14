"""Orquestra o pipeline DuckDB: executa pipeline/sql/NN_*.sql em ordem.

Regra de sigilo: este script só roda agregações/COPY sobre data/raw e data/interim;
nunca imprime linhas individuais. Uso:
    python pipeline/run.py [prefixo]                  # ex.: python pipeline/run.py 01   -> só 01_extract.sql
    python pipeline/run.py [prefixo] --edicao 2010     # roda a edição 2010 (ver pipeline/edicoes.py)

Sem --edicao (ou com --edicao 2022), o comportamento é idêntico ao de sempre: mesmos
scripts de pipeline/sql/, mesmos paths literais dentro deles. Para outras edições, os
paths `data/raw/`, `data/interim/`, `data/processed/` dentro do texto do SQL são trocados
pelos da edição (pipeline/edicoes.py), scripts com override em `<sql_override_dir>/NN_*.sql`
substituem os de pipeline/sql/, e prefixos em `pula_scripts` são pulados.
"""
from __future__ import annotations

import argparse
import pathlib
import sys
import time

import duckdb

ROOT = pathlib.Path(__file__).resolve().parent.parent
SQL_DIR = ROOT / "pipeline" / "sql"

sys.path.insert(0, str(ROOT / "pipeline"))
from edicoes import edicao as get_edicao  # noqa: E402


def _adaptar_sql(sql: str, ed) -> str:
    """Troca os prefixos literais data/raw/, data/interim/, data/processed/ pelos paths
    da edição. Replace simples de string, nessa ordem; preserva a barra final (o literal
    original sempre a tem, então sempre reacrescentamos uma, mesmo que o path da edição em
    si não termine em barra)."""
    substituicoes = (
        ("data/raw/", ed.raw.rstrip("/") + "/"),
        ("data/interim/", ed.interim.rstrip("/") + "/"),
        ("data/processed/", ed.processed.rstrip("/") + "/"),
    )
    for antigo, novo in substituicoes:
        sql = sql.replace(antigo, novo)
    return sql


def _scripts_da_edicao(ed) -> list[pathlib.Path]:
    """Scripts a rodar para uma edição != 2022: pipeline/sql/*.sql, trocado por override em
    <sql_override_dir>/NN_nome.sql quando existir, pulando prefixos em ed.pula_scripts."""
    scripts = []
    for script in sorted(SQL_DIR.glob("*.sql")):
        prefixo = script.name.split("_", 1)[0]
        if prefixo in ed.pula_scripts:
            continue
        override = ROOT / ed.sql_override_dir / script.name if ed.sql_override_dir else None
        scripts.append(override if override and override.exists() else script)
    return scripts


def run_all(prefix: str | None = None, edicao_nome: str = "2022") -> None:
    ed = get_edicao(edicao_nome)

    if ed.nome == "2022":
        # Comportamento 100% inalterado: mesma listagem, mesmos paths.
        scripts = sorted(SQL_DIR.glob("*.sql"))
        if prefix:
            scripts = [s for s in scripts if s.name.startswith(prefix)]
    else:
        scripts = _scripts_da_edicao(ed)
        if prefix:
            scripts = [s for s in scripts if s.name.startswith(prefix)]
        # COPY ... TO falha se o diretório de saída não existir.
        (ROOT / ed.interim).mkdir(parents=True, exist_ok=True)
        (ROOT / ed.processed).mkdir(parents=True, exist_ok=True)

    if not scripts:
        print(f"Nenhum script encontrado em {SQL_DIR} (prefixo={prefix!r}, edicao={ed.nome!r}).")
        raise SystemExit(1)

    override_dir = ROOT / ed.sql_override_dir if ed.sql_override_dir else None

    con = duckdb.connect()
    for script in scripts:
        rotulo = script.name if ed.nome == "2022" else str(script.relative_to(ROOT))
        print(f"== {rotulo} ==")
        sql = script.read_text(encoding="utf-8")
        # Scripts de override (pipeline/sql/<edicao>/NN_*.sql) já são escritos com os paths
        # literais da própria edição (ex.: "data/interim/2010/..."); rodar _adaptar_sql neles
        # duplicaria o prefixo ("data/interim/2010/2010/..."). Só os scripts compartilhados de
        # pipeline/sql/ (paths genéricos "data/interim/...") precisam da substituição.
        eh_override = override_dir is not None and override_dir in script.parents
        if ed.nome != "2022" and not eh_override:
            sql = _adaptar_sql(sql, ed)
        t0 = time.time()
        con.execute(sql)
        dt = time.time() - t0
        print(f"   ok em {dt:.1f}s")
    con.close()


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("prefix", nargs="?", default=None,
                     help="Prefixo do script SQL a rodar (ex.: 01). Default: todos.")
    ap.add_argument("--edicao", default="2022",
                     help="Edição do censo a rodar (ver pipeline/edicoes.py). Default: 2022.")
    args = ap.parse_args(argv)
    run_all(args.prefix, args.edicao)


if __name__ == "__main__":
    import os
    os.chdir(ROOT)
    main()
