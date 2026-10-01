#!/usr/bin/env python3
"""Prepara a edição Censo 1980 a partir do Parquet do censobr/IPEA (fonte da edição desde
1.1.0-1980), gravando data/raw1980/pessoa_<uf>.parquet no MESMO esquema de 39 colunas que
scripts/extract_1980_bd.py produzia a partir da Base dos Dados -- assim pipeline/sql/1980/
01_extract.sql não precisa saber de onde os dados vieram.

Por que trocar de fonte (ver pipeline/sql/1980/MAPEAMENTO_fonte_censobr.md): a tabela da Base
dos Dados (BD) perde o código de município dos 52 municípios do norte de Goiás (hoje Tocantins)
e de Fernando de Noronha -- 178.636 registros -- num `merge` contra o diretório atual de
municípios. O Parquet do censobr (`1980_population_v1.0.0.parquet`, IPEA, 16/09/2026) vem dos
mesmos microdados (via Data Zoom -> amostra "legacy" de R. J. Barbosa) e traz `code_muni` para
todos os registros, na malha de 1980 (os 52 como 52xxxxx; FN como 2000107) -- a recodificação
para o código publicado (17xxxxx / 2605459) fica com pipeline/norte_goias_1980.py, no pipeline.

O que este script confere ANTES de gravar (gates de identidade contra a BD, se
data/raw1980/bd/pessoa_<uf>.parquet existir), por UF e só em agregados:
  G1 registros e Σ v604 iguais aos da BD (tolerância: TOLERANCIA_REGISTROS registros por UF --
     a BD tem 1 registro de MS com peso 14 onde o censobr e a cópia DBF do IBGE têm 4);
  G2 multiconjunto das colunas NUCLEO (as que o pipeline usa sem restrição de universo)
     idêntico ao da BD;
  G3 escolaridade (v520-v524) idêntica para 5 anos ou mais e trabalho (v528-v533) + v527
     idênticos para 10 anos ou mais -- fora desses universos o censobr, como a cópia pública
     do IBGE, traz zero/NULL, e a BD trazia os valores brutos (ver MAPEAMENTO_fonte_censobr.md);
  G4 origem (v518) idêntica, com a BD normalizada (NULL -> '0000000'; no Ceará os 6 dígitos
     com zero à esquerda ganham o dígito verificador);
  G5 código de município idêntico onde a BD o tem; nos 178.636 onde ela não tem, o censobr traz
     exatamente os 52 códigos do norte de Goiás (178.338 registros) e Fernando de Noronha (298).
Renda (v607-v613, v680-v682) e numero_ordem ficam FORA dos gates: a BD só tem renda no Ceará
(bug conhecido) e não tem como comparar; numero_ordem (V500) não existe no censobr e sai NULL --
a edição não a usa (não há chave de domicílio em 1980).

Uso:
    .venv/bin/python scripts/prep_1980_censobr.py [--entrada ...] [--saida data/raw1980]
        [--bd data/raw1980/bd] [--relatorio docs/qa/censobr_1980.md] [--sem-gates] [--uf GO ...]

Regra de sigilo: só grava Parquet em data/raw1980 (gitignored) e só imprime contagens
agregadas; nunca lê nem imprime uma linha de pessoa. O relatório em docs/qa é público e só
traz agregados.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import sys
import tempfile
from pathlib import Path

import duckdb

_REPO_ROOT = Path(__file__).resolve().parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

ENTRADA_PADRAO = _REPO_ROOT / "data/raw1980/censobr/1980_population_v1.0.0.parquet"
SAIDA_PADRAO = _REPO_ROOT / "data/raw1980"
BD_PADRAO = _REPO_ROOT / "data/raw1980/bd"
RELATORIO_PADRAO = _REPO_ROOT / "docs/qa/censobr_1980.md"
VERSAO_CENSOBR = "v1.0.0"
URL_CENSOBR = "https://github.com/ipea/censobr_prep_data/releases/tag/v1.0.0"

# Registros por UF em que a BD pode divergir do censobr sem reprovar (G1-G4). Casos conhecidos,
# um registro em cada UF: MS com v604=14 na BD contra 4 no censobr e na cópia DBF do IBGE (Σ PESOP
# de MS no DBF = 1.369.769 = censobr; a BD é a que erra); PI com v517 (tempo de residência)
# diferente; MT com v211 (= TPRESID) diferente -- nestes dois a coluna foi identificada por
# comparação de marginais, a causa não (olhar o registro violaria o sigilo). Qualquer deles está
# abaixo de todo limiar de publicação (n >= 20).
TOLERANCIA_REGISTROS = 1

# código IBGE da UF -> sigla (V2 do censobr; 20 = Fernando de Noronha, Território Federal)
UFS: dict[int, str] = {
    11: "RO", 12: "AC", 13: "AM", 14: "RR", 15: "PA", 16: "AP", 20: "FN", 21: "MA", 22: "PI",
    23: "CE", 24: "RN", 25: "PB", 26: "PE", 27: "AL", 28: "SE", 29: "BA", 31: "MG", 32: "ES",
    33: "RJ", 35: "SP", 41: "PR", 42: "SC", 43: "RS", 50: "MS", 51: "MT", 52: "GO", 53: "DF",
}

# As 39 colunas do contrato, na ordem e com o tipo DuckDB do Parquet da BD (extract_1980_bd.py).
COLUNAS: list[tuple[str, str]] = [
    ("id_municipio", "VARCHAR"), ("sigla_uf", "VARCHAR"), ("numero_ordem", "BIGINT"),
    ("v598", "VARCHAR"), ("v211", "BIGINT"), ("v501", "VARCHAR"), ("v503", "VARCHAR"),
    ("v509", "VARCHAR"), ("v511", "VARCHAR"), ("v512", "BIGINT"), ("v513", "VARCHAR"),
    ("v514", "VARCHAR"), ("v515", "VARCHAR"), ("v516", "VARCHAR"), ("v517", "VARCHAR"),
    ("v520", "VARCHAR"), ("v521", "VARCHAR"), ("v522", "VARCHAR"), ("v523", "VARCHAR"),
    ("v524", "VARCHAR"), ("v528", "VARCHAR"), ("v529", "VARCHAR"), ("v530", "VARCHAR"),
    ("v532", "VARCHAR"), ("v533", "VARCHAR"), ("v604", "BIGINT"), ("v606", "BIGINT"),
    ("v607", "BIGINT"), ("v608", "BIGINT"), ("v609", "BIGINT"), ("v610", "BIGINT"),
    ("v611", "BIGINT"), ("v612", "BIGINT"), ("v613", "BIGINT"), ("v680", "VARCHAR"),
    ("v681", "VARCHAR"), ("v682", "BIGINT"), ("v518", "VARCHAR"), ("v527", "VARCHAR"),
]
NUCLEO = ["v598", "v211", "v501", "v503", "v509", "v511", "v512", "v513", "v514", "v515", "v516",
          "v517", "v604", "v606"]
EDUCACAO = ["v520", "v521", "v522", "v523", "v524"]          # universo: 5 anos ou mais
TRABALHO = ["v528", "v529", "v530", "v532", "v533", "v527"]  # universo: 10 anos ou mais

# Dígito verificador do IBGE (módulo 10, pesos 1,2,1,2,1,2; produto >= 10 soma os dígitos) --
# o mesmo de pipeline/norte_goias_1980.digito_verificador_ibge, em SQL. Confere com 100% dos
# códigos de 7 dígitos de v518/v527 da BD.
MACRO_DV = """
CREATE OR REPLACE MACRO dv_ibge(c6) AS (
    CAST((10 - ((
        CAST(SUBSTR(c6,1,1) AS INTEGER)
      + (CASE WHEN CAST(SUBSTR(c6,2,1) AS INTEGER)*2 >= 10 THEN CAST(SUBSTR(c6,2,1) AS INTEGER)*2 - 9 ELSE CAST(SUBSTR(c6,2,1) AS INTEGER)*2 END)
      + CAST(SUBSTR(c6,3,1) AS INTEGER)
      + (CASE WHEN CAST(SUBSTR(c6,4,1) AS INTEGER)*2 >= 10 THEN CAST(SUBSTR(c6,4,1) AS INTEGER)*2 - 9 ELSE CAST(SUBSTR(c6,4,1) AS INTEGER)*2 END)
      + CAST(SUBSTR(c6,5,1) AS INTEGER)
      + (CASE WHEN CAST(SUBSTR(c6,6,1) AS INTEGER)*2 >= 10 THEN CAST(SUBSTR(c6,6,1) AS INTEGER)*2 - 9 ELSE CAST(SUBSTR(c6,6,1) AS INTEGER)*2 END)
    ) % 10)) % 10 AS VARCHAR)
);
CREATE OR REPLACE MACRO codigo7(v) AS (
    CASE WHEN v IS NULL OR v = 0 THEN '0000000'
         WHEN v > 999999 OR v < 0 THEN error('v518/v527 fora de 6 dígitos: ' || CAST(v AS VARCHAR))
         ELSE LPAD(CAST(v AS VARCHAR), 6, '0') || dv_ibge(LPAD(CAST(v AS VARCHAR), 6, '0')) END
);
"""


def sql_saida(entrada: Path, uf_cod: int) -> str:
    """SELECT das 39 colunas para uma UF, no esquema da BD."""
    return f"""
        SELECT
            CAST(code_muni AS VARCHAR)                       AS id_municipio,
            abbrev_state                                     AS sigla_uf,
            CAST(NULL AS BIGINT)                             AS numero_ordem,
            CAST(V598 AS VARCHAR)                            AS v598,
            CAST(V211 AS BIGINT)                             AS v211,
            CAST(V501 AS VARCHAR) AS v501, CAST(V503 AS VARCHAR) AS v503, CAST(V509 AS VARCHAR) AS v509,
            CAST(V511 AS VARCHAR) AS v511, CAST(V512 AS BIGINT) AS v512,  CAST(V513 AS VARCHAR) AS v513,
            CAST(V514 AS VARCHAR) AS v514, CAST(V515 AS VARCHAR) AS v515, CAST(V516 AS VARCHAR) AS v516,
            CAST(V517 AS VARCHAR) AS v517,
            CAST(V520 AS VARCHAR) AS v520, CAST(V521 AS VARCHAR) AS v521, CAST(V522 AS VARCHAR) AS v522,
            CAST(V523 AS VARCHAR) AS v523, CAST(V524 AS VARCHAR) AS v524,
            CAST(V528 AS VARCHAR) AS v528, CAST(V529 AS VARCHAR) AS v529, CAST(V530 AS VARCHAR) AS v530,
            CAST(V532 AS VARCHAR) AS v532, CAST(V533 AS VARCHAR) AS v533,
            CAST(V604 AS BIGINT) AS v604, CAST(V606 AS BIGINT) AS v606,
            CAST(V607 AS BIGINT) AS v607, CAST(V608 AS BIGINT) AS v608, CAST(V609 AS BIGINT) AS v609,
            CAST(V610 AS BIGINT) AS v610, CAST(V611 AS BIGINT) AS v611, CAST(V612 AS BIGINT) AS v612,
            CAST(V613 AS BIGINT) AS v613, CAST(V680 AS VARCHAR) AS v680, CAST(V681 AS VARCHAR) AS v681,
            CAST(V682 AS BIGINT) AS v682,
            codigo7(V518)                                    AS v518,
            codigo7(V527)                                    AS v527
        FROM read_parquet('{entrada.as_posix()}')
        WHERE V2 = {uf_cod}
    """


def sha256(caminho: Path) -> str:
    h = hashlib.sha256()
    with open(caminho, "rb") as f:
        for bloco in iter(lambda: f.read(1 << 20), b""):
            h.update(bloco)
    return h.hexdigest()


def _normalizada_bd(con: duckdb.DuckDBPyConnection, caminho: Path) -> None:
    """Vista `bd` com as normalizações declaradas (G4): v518/v527 NULL -> '0000000' e, no Ceará,
    6 dígitos com zero à esquerda -> 6 dígitos + dígito verificador (MAPEAMENTO_02_classify §2.3)."""
    con.execute(f"""
        CREATE OR REPLACE TEMP VIEW bd AS
        SELECT * REPLACE (
            CASE WHEN v518 IS NULL THEN '0000000'
                 WHEN SUBSTR(v518,1,1) = '0' AND v518 <> '0000000' THEN SUBSTR(v518,2,6) || dv_ibge(SUBSTR(v518,2,6))
                 ELSE v518 END AS v518,
            CASE WHEN v527 IS NULL THEN '0000000'
                 WHEN SUBSTR(v527,1,1) = '0' AND v527 <> '0000000' THEN SUBSTR(v527,2,6) || dv_ibge(SUBSTR(v527,2,6))
                 ELSE v527 END AS v527)
        FROM read_parquet('{caminho.as_posix()}')
    """)


def _divergencia(con: duckdb.DuckDBPyConnection, cols: list[str], filtro: str = "TRUE") -> int:
    """Registros que estão num lado e não no outro, como multiconjunto das colunas (EXCEPT ALL
    nos dois sentidos -- trata NULL como igual a NULL, o que um JOIN USING não faz)."""
    k = ", ".join(cols)
    return con.execute(f"""
        SELECT (SELECT COUNT(*) FROM ((SELECT {k} FROM bd WHERE {filtro}) EXCEPT ALL (SELECT {k} FROM cb WHERE {filtro})))
             + (SELECT COUNT(*) FROM ((SELECT {k} FROM cb WHERE {filtro}) EXCEPT ALL (SELECT {k} FROM bd WHERE {filtro})))
    """).fetchone()[0]


def gates_uf(con: duckdb.DuckDBPyConnection, sigla: str, saida: Path, bd_dir: Path) -> dict:
    """Roda G1-G5 para uma UF comparando o Parquet recém-gravado (`cb`) com o da BD (`bd`)."""
    bd_path = bd_dir / f"pessoa_{sigla.lower()}.parquet"
    r: dict = {"uf": sigla, "bd": bd_path.exists()}
    if not bd_path.exists():
        return r
    _normalizada_bd(con, bd_path)
    con.execute(f"CREATE OR REPLACE TEMP VIEW cb AS SELECT * FROM read_parquet('{saida.as_posix()}')")
    n_bd, w_bd = con.execute("SELECT COUNT(*), SUM(v604) FROM bd").fetchone()
    n_cb, w_cb = con.execute("SELECT COUNT(*), SUM(v604) FROM cb").fetchone()
    r.update(n_bd=n_bd, n_cb=n_cb, peso_bd=w_bd, peso_cb=w_cb)
    r["g1_registros_divergentes"] = _divergencia(con, ["v604"])   # registros com peso diferente
    r["g2_nucleo_divergentes"] = _divergencia(con, NUCLEO)
    r["g3_educacao_divergentes"] = _divergencia(con, NUCLEO + EDUCACAO, "v606 >= 5")
    r["g3_trabalho_divergentes"] = _divergencia(con, NUCLEO + TRABALHO, "v606 >= 10")
    r["g4_origem_divergentes"] = _divergencia(con, NUCLEO + ["v518"])
    # G5: código de município onde a BD o tem; onde não tem, o que o censobr traz
    r["g5_municipio_divergentes"] = con.execute("""
        WITH a AS (SELECT id_municipio FROM bd WHERE id_municipio IS NOT NULL),
             b AS (SELECT id_municipio FROM cb WHERE id_municipio IN (SELECT DISTINCT id_municipio FROM a))
        SELECT (SELECT COUNT(*) FROM (SELECT * FROM a EXCEPT ALL SELECT * FROM b))
             + (SELECT COUNT(*) FROM (SELECT * FROM b EXCEPT ALL SELECT * FROM a))
    """).fetchone()[0]
    r["bd_sem_municipio"] = con.execute("SELECT COUNT(*) FROM bd WHERE id_municipio IS NULL").fetchone()[0]
    r["cb_sem_municipio"] = con.execute("SELECT COUNT(*) FROM cb WHERE id_municipio IS NULL").fetchone()[0]
    r["cb_codigos_novos"] = con.execute("""
        SELECT COUNT(DISTINCT id_municipio) FROM cb
        WHERE id_municipio NOT IN (SELECT id_municipio FROM bd WHERE id_municipio IS NOT NULL)
    """).fetchone()[0]
    r["cb_registros_codigos_novos"] = con.execute("""
        SELECT COUNT(*) FROM cb
        WHERE id_municipio NOT IN (SELECT id_municipio FROM bd WHERE id_municipio IS NOT NULL)
    """).fetchone()[0]
    # G5b: os códigos "novos" (que a BD não tem) têm de ser EXATAMENTE os que o pipeline sabe
    # recodificar -- os 52 do norte de Goiás (GO) e Fernando de Noronha (FN); em qualquer outra
    # UF o conjunto tem de ser vazio. Contagem igual não basta: um conjunto desconhecido com o
    # mesmo tamanho passaria em silêncio.
    novos = {c for (c,) in con.execute("""
        SELECT DISTINCT id_municipio FROM cb
        WHERE id_municipio NOT IN (SELECT id_municipio FROM bd WHERE id_municipio IS NOT NULL)
    """).fetchall()}
    esperados = {c for c in _codigos_recodificaveis() if c[:2] == {"GO": "52", "FN": "20"}.get(sigla, "--")}
    r["g5b_codigos_inesperados"] = len(novos - esperados)
    r["g5b_codigos_faltando"] = len(esperados - novos)
    tol = TOLERANCIA_REGISTROS
    r["ok"] = (
        n_bd == n_cb
        and r["g1_registros_divergentes"] <= 2 * tol
        and r["g2_nucleo_divergentes"] <= 2 * tol
        and r["g3_educacao_divergentes"] <= 2 * tol
        and r["g3_trabalho_divergentes"] <= 2 * tol
        and r["g4_origem_divergentes"] <= 2 * tol
        and r["g5_municipio_divergentes"] == 0
        and r["cb_sem_municipio"] == 0
        and r["cb_registros_codigos_novos"] == r["bd_sem_municipio"]
        and r["g5b_codigos_inesperados"] == 0
        and r["g5b_codigos_faltando"] == 0
    )
    return r


def _codigos_recodificaveis() -> set[str]:
    """Os 53 códigos de 1980 que pipeline/norte_goias_1980.py recodifica (52 de GO + FN)."""
    import sys
    sys.path.insert(0, str(_REPO_ROOT / "pipeline"))
    import norte_goias_1980 as N  # noqa: E402
    return set(N.CODIGO_PUBLICADO)


def relatorio_md(entrada: Path, hash_entrada: str, resultados: list[dict], destino: Path) -> None:
    hoje = dt.date.today().isoformat()
    linhas = [
        "# censobr/IPEA v1.0.0 como fonte da edição Censo 1980 — gates de identidade",
        "",
        f"Gerado por `scripts/prep_1980_censobr.py` em {hoje}. Só agregados; nenhuma linha individual foi lida ou impressa.",
        "",
        f"- Entrada: `{entrada.name}` ({URL_CENSOBR}), SHA-256 `{hash_entrada}`.",
        "- Referência: os Parquet extraídos da Base dos Dados (`scripts/extract_1980_bd.py`, F9.1), guardados em `data/raw1980/bd/`.",
        f"- Tolerância declarada: {TOLERANCIA_REGISTROS} registro por UF em G1-G4 (2 linhas divergentes, uma de cada lado). Casos que a consomem: MS (peso 14 na BD, 4 no censobr e na cópia DBF do IBGE), PI (um registro com `v517` diferente) e MT (um registro com `v211` diferente) -- colunas identificadas por marginais, causa não investigada (sigilo). G5/G5b não têm tolerância.",
        "",
        "Colunas de cada gate: G1 `v604`; G2 núcleo (`" + "`, `".join(NUCLEO) + "`); G3 escolaridade (`"
        + "`, `".join(EDUCACAO) + "`, 5 anos ou mais) e trabalho (`" + "`, `".join(TRABALHO)
        + "`, 10 anos ou mais); G4 núcleo + `v518` (BD normalizada: NULL → '0000000'; Ceará 6 dígitos → 6 + dígito verificador); "
        "G5 código de município onde a BD o tem. 'Divergentes' = registros em grupos cuja contagem difere entre as duas fontes.",
        "",
        "| UF | n BD | n censobr | Σ peso BD | Σ peso censobr | G1 | G2 | G3 edu | G3 trab | G4 | G5 | BD sem município | códigos só no censobr (registros) | ok |",
        "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|",
    ]
    for r in resultados:
        if not r.get("bd"):
            linhas.append(f"| {r['uf']} | — | {r.get('n_cb', '—')} | — | {r.get('peso_cb', '—')} | | | | | | | | | sem BD |")
            continue
        linhas.append(
            f"| {r['uf']} | {r['n_bd']:,} | {r['n_cb']:,} | {r['peso_bd']:,} | {r['peso_cb']:,} | "
            f"{r['g1_registros_divergentes']} | {r['g2_nucleo_divergentes']} | {r['g3_educacao_divergentes']} | "
            f"{r['g3_trabalho_divergentes']} | {r['g4_origem_divergentes']} | {r['g5_municipio_divergentes']} | "
            f"{r['bd_sem_municipio']:,} | {r['cb_codigos_novos']} ({r['cb_registros_codigos_novos']:,}) | "
            f"{'sim' if r['ok'] else 'NÃO'} |".replace(",", ".")
        )
    tot_bd = sum(r.get("n_bd", 0) for r in resultados if r.get("bd"))
    tot_cb = sum(r.get("n_cb", 0) for r in resultados)
    w_bd = sum(r.get("peso_bd", 0) for r in resultados if r.get("bd"))
    w_cb = sum(r.get("peso_cb", 0) for r in resultados)
    linhas += [
        "",
        f"Totais: BD {tot_bd:,} registros / Σ peso {w_bd:,}; censobr {tot_cb:,} / {w_cb:,}.".replace(",", "."),
        "",
        "## O que difere, por construção",
        "",
        "- **Município de residência**: a BD não o tem em 178.636 registros (52 municípios do norte de Goiás + Fernando de Noronha); o censobr traz `code_muni` na malha de 1980 para todos (`52xxxxx` e `2000107`), recodificados no pipeline por `pipeline/norte_goias_1980.py`.",
        "- **Universos**: o censobr, como a cópia DBF pública do IBGE, zera a escolaridade (`v520`-`v524`) de menores de 5 anos e deixa NULL o trabalho (`v528`-`v533`) e o município de trabalho/estudo (`v527`) de menores de 10; a BD trazia os valores brutos. O pipeline já restringia ocupação a 10 anos ou mais; o efeito real é que o deslocamento pendular de estudo de 1980 passa a cobrir só quem tem 10 anos ou mais, e `freq_escolar` de menores de 5 anos passa a 'não frequenta'.",
        "- **`numero_ordem`** (V500) não existe no censobr e sai NULL; a edição não a usa.",
        "- **Renda** (`v607`-`v613`, `v680`-`v682`): a BD só a tem no Ceará; o censobr a traz em todas as UFs. A edição continua sem publicar renda (fora dos gates).",
        "- **Um registro de MS** com peso 14 na BD e 4 no censobr; a cópia DBF do IBGE dá 4 (Σ PESOP de MS = 1.369.769, igual ao censobr).",
        "",
    ]
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text("\n".join(linhas) + "\n", encoding="utf-8")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--entrada", type=Path, default=ENTRADA_PADRAO)
    ap.add_argument("--saida", type=Path, default=SAIDA_PADRAO)
    ap.add_argument("--bd", type=Path, default=BD_PADRAO, help="Parquet da Base dos Dados para os gates")
    ap.add_argument("--relatorio", type=Path, default=RELATORIO_PADRAO)
    ap.add_argument("--sem-gates", action="store_true", help="grava sem comparar com a BD")
    ap.add_argument("--uf", nargs="*", help="siglas a processar (default: todas)")
    args = ap.parse_args()

    if not args.entrada.exists():
        print(f"ERRO: {args.entrada} não existe (baixe de {URL_CENSOBR}).", file=sys.stderr)
        return 1
    hash_entrada = sha256(args.entrada)
    print(f"entrada: {args.entrada.name} sha256={hash_entrada[:12]}…")

    con = duckdb.connect()
    con.execute("PRAGMA threads=8; PRAGMA memory_limit='12GB';")
    con.execute(MACRO_DV)
    n_total = con.execute(f"SELECT COUNT(*) FROM read_parquet('{args.entrada.as_posix()}')").fetchone()[0]
    print(f"registros no censobr: {n_total:,}")

    siglas = [s.upper() for s in args.uf] if args.uf else list(UFS.values())
    completo = set(siglas) >= set(UFS.values())
    args.saida.mkdir(parents=True, exist_ok=True)
    tmp = Path(tempfile.mkdtemp(prefix="prep1980_", dir=str(args.saida)))
    manter_tmp = False
    resultados = []
    try:
        for cod, sigla in UFS.items():
            if sigla not in siglas:
                continue
            destino_tmp = tmp / f"pessoa_{sigla.lower()}.parquet"
            con.execute(f"COPY ({sql_saida(args.entrada, cod)}) TO '{destino_tmp.as_posix()}' (FORMAT PARQUET)")
            n, w = con.execute(f"SELECT COUNT(*), SUM(v604) FROM read_parquet('{destino_tmp.as_posix()}')").fetchone()
            if args.sem_gates:
                r = {"uf": sigla, "bd": False, "n_cb": n, "peso_cb": w, "ok": True}
            else:
                r = gates_uf(con, sigla, destino_tmp, args.bd)
                if not r.get("bd"):
                    r.update(n_cb=n, peso_cb=w, ok=True)
            resultados.append(r)
            marca = "ok" if r["ok"] else "DIVERGE"
            print(f"[{sigla}] n={n:,} Σv604={w:,} [{marca}]"
                  + ("" if not r.get("bd") else
                     f" G1={r['g1_registros_divergentes']} G2={r['g2_nucleo_divergentes']} "
                     f"G3edu={r['g3_educacao_divergentes']} G3trab={r['g3_trabalho_divergentes']} "
                     f"G4={r['g4_origem_divergentes']} G5={r['g5_municipio_divergentes']} "
                     f"sem_mun_bd={r['bd_sem_municipio']:,} novos={r['cb_codigos_novos']}"))

        todos_ok = all(r["ok"] for r in resultados)
        if not args.sem_gates and completo:
            relatorio_md(args.entrada, hash_entrada, resultados, args.relatorio)
            print(f"relatório: {args.relatorio}")
        elif not completo:
            print(f"execução parcial ({len(resultados)} UF): relatório e sidecar NÃO são reescritos.")
        if not todos_ok:
            manter_tmp = True
            print("REPROVADO: alguma UF diverge da BD além da tolerância -- nada foi gravado em "
                  f"{args.saida}; a saída parcial fica em {tmp} para inspeção agregada "
                  "(apague-a depois).", file=sys.stderr)
            return 1
        for f in sorted(tmp.glob("pessoa_*.parquet")):
            os.replace(f, args.saida / f.name)
        if completo:
            sidecar = {
                "fonte": "censobr/IPEA", "versao": VERSAO_CENSOBR, "url": URL_CENSOBR,
                "arquivo": args.entrada.name, "sha256": hash_entrada, "gerado_em": dt.datetime.now().isoformat(timespec="seconds"),
                "gates_contra_bd": not args.sem_gates and all(r.get("bd") for r in resultados),
                "tolerancia_registros_por_uf": TOLERANCIA_REGISTROS,
                "registros": sum(r["n_cb"] for r in resultados), "soma_v604": sum(r["peso_cb"] for r in resultados),
                "ufs": {r["uf"]: {"n": r["n_cb"], "soma_v604": r["peso_cb"],
                                  **({k: r[k] for k in ("g1_registros_divergentes", "g2_nucleo_divergentes",
                                                        "g3_educacao_divergentes", "g3_trabalho_divergentes",
                                                        "g4_origem_divergentes", "g5_municipio_divergentes",
                                                        "g5b_codigos_inesperados", "g5b_codigos_faltando")} if r.get("bd") else {})}
                        for r in resultados},
            }
            (args.saida / "prep_1980_censobr.json").write_text(json.dumps(sidecar, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"ok: {len(resultados)} UF(s) gravadas em {args.saida}")
        return 0
    finally:
        if not manter_tmp:
            for f in tmp.glob("*"):
                f.unlink(missing_ok=True)
            tmp.rmdir()


if __name__ == "__main__":
    sys.exit(main())
