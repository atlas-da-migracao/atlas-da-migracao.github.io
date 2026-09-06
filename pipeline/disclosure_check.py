"""GATE de revelação: verifica, de forma independente, se data/processed cumpre R1-R6.

Não confia em publish.py: recalcula as contagens amostrais de cada célula publicada a
partir de data/interim/pessoas_classificado.parquet e confronta com o que foi publicado.
Falha (exit 1) em qualquer violação. Em caso de sucesso, grava
docs/relatorio_revelacao_<versao>.md e o carimbo data/processed/.gate_ok.

Uso: python pipeline/disclosure_check.py [--versao v1]
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import pathlib
import sys

import duckdb

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "pipeline"))
import disclosure_rules as R  # noqa: E402
from publish import COL_DIM, FILTRO_DIM, nome_col  # noqa: E402

INTERIM = ROOT / "data/interim"
PROCESSED = ROOT / "data/processed"

GATE_OK = PROCESSED / ".gate_ok"
GATE_VERSAO_FORMATO = 1  # versão do esquema do carimbo .gate_ok, não da versão dos dados

violacoes: list[str] = []
notas: list[str] = []


def sha256_arquivo(caminho: pathlib.Path) -> str:
    h = hashlib.sha256()
    with caminho.open("rb") as fh:
        for bloco in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(bloco)
    return h.hexdigest()


def hashes_publicaveis() -> dict[str, str]:
    """SHA-256 de todo arquivo publicável em data/processed (recursivo, geo/ incluído).

    Caminhos relativos em POSIX (`/`), ordenados, excluindo o próprio carimbo `.gate_ok`
    -- é o que `verify_gate.py` recomputa e confere de forma independente do resto do gate.
    """
    hashes = {}
    for f in sorted(PROCESSED.rglob("*")):
        if not f.is_file() or f == GATE_OK:
            continue
        rel = f.relative_to(PROCESSED).as_posix()
        hashes[rel] = sha256_arquivo(f)
    return dict(sorted(hashes.items()))


def falha(regra: str, msg: str) -> None:
    violacoes.append(f"{regra}: {msg}")
    print(f"  [VIOLAÇÃO {regra}] {msg}")


def ok(regra: str, msg: str) -> None:
    notas.append(f"{regra}: {msg}")
    print(f"  [ok {regra}] {msg}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--versao", default=dt.date.today().isoformat())
    args = ap.parse_args()
    os.chdir(ROOT)

    con = duckdb.connect()
    con.execute("PRAGMA threads=10; PRAGMA memory_limit='16GB';")
    con.execute(f"CREATE OR REPLACE TEMP VIEW mig AS SELECT * FROM read_parquet('{INTERIM}/pessoas_classificado.parquet') WHERE origem_valida")

    print("=== Gate de revelação (R1-R6) ===")

    # ---- R6: nenhuma coluna proibida em nenhum arquivo publicado ----
    arquivos = sorted(PROCESSED.glob("*.parquet"))
    if not arquivos:
        falha("R8", "não há arquivos em data/processed")
        return 1
    for f in arquivos:
        cols = {c.lower() for c in con.execute(f"SELECT * FROM read_parquet('{f}') LIMIT 0").df().columns}
        proibidas = cols & R.COLUNAS_PROIBIDAS
        if proibidas:
            falha("R6", f"{f.name} expõe coluna(s) {sorted(proibidas)}")
    if not violacoes:
        ok("R6", f"{len(arquivos)} arquivos sem colunas de domicílio ou área de ponderação")

    # ---- R1: todo par publicado tem n>=5 pessoas e >=3 domicílios ----
    con.execute("""
        CREATE OR REPLACE TEMP TABLE cel AS
        SELECT df_mun AS origem, cd_mun AS destino,
               COUNT(*) AS n, COUNT(DISTINCT controle) AS ndom
        FROM mig GROUP BY 1, 2
    """)
    r = con.execute(f"""
        SELECT COUNT(*) FROM read_parquet('{PROCESSED}/fluxos.parquet') p
        LEFT JOIN cel c ON c.origem = p.origem AND c.destino = p.destino
        WHERE c.n IS NULL OR c.n < {R.MIN_PESSOAS} OR c.ndom < {R.MIN_DOMICILIOS}
    """).fetchone()[0]
    if r:
        falha("R1", f"{r} fluxos publicados abaixo do limiar de {R.MIN_PESSOAS} pessoas / {R.MIN_DOMICILIOS} domicílios")
    else:
        n_pub = con.execute(f"SELECT COUNT(*) FROM read_parquet('{PROCESSED}/fluxos.parquet')").fetchone()[0]
        ok("R1", f"{n_pub:,} fluxos publicados, todos com n>={R.MIN_PESSOAS} e domicílios>={R.MIN_DOMICILIOS}")

    # ---- R1 célula a célula: cada categoria publicada dentro de um fluxo ----
    total_cel, cel_violadas = 0, 0
    for dim, cats in R.DIMENSOES.items():
        col, extra = COL_DIM[dim], (f" AND {FILTRO_DIM[dim]}" if dim in FILTRO_DIM else "")
        sel = ", ".join(
            f"COUNT(*) FILTER (WHERE {col} = '{cat}'{extra}) AS n_{nome_col(dim, cat)}" for cat in cats)
        con.execute(f"""
            CREATE OR REPLACE TEMP TABLE cel_dim AS
            SELECT df_mun AS origem, cd_mun AS destino, {sel} FROM mig GROUP BY 1, 2
        """)
        for cat in cats:
            c = nome_col(dim, cat)
            v = con.execute(f"""
                SELECT COUNT(*) FROM read_parquet('{PROCESSED}/fluxos.parquet') p
                JOIN cel_dim d ON d.origem = p.origem AND d.destino = p.destino
                WHERE p.{c} IS NOT NULL AND d.n_{c} < {R.MIN_PESSOAS}
            """).fetchone()[0]
            total_cel += 1
            if v:
                cel_violadas += 1
                falha("R1", f"categoria {c}: {v} células publicadas com menos de {R.MIN_PESSOAS} observações")
    if not cel_violadas:
        ok("R1", f"{total_cel} categorias de fluxo verificadas célula a célula, nenhuma abaixo do limiar")

    # ---- R2: detalhe só em fluxos com n >= 20 ----
    alguma = " OR ".join(f"{nome_col(d, c)} IS NOT NULL" for d, cs in R.DIMENSOES.items() for c in cs)
    v = con.execute(f"""
        SELECT COUNT(*) FROM read_parquet('{PROCESSED}/fluxos.parquet') p
        JOIN cel c ON c.origem = p.origem AND c.destino = p.destino
        WHERE c.n < {R.MIN_PESSOAS_DETALHE} AND ({alguma})
    """).fetchone()[0]
    if v:
        falha("R2", f"{v} fluxos com n<{R.MIN_PESSOAS_DETALHE} publicam detalhe por características")
    else:
        ok("R2", f"nenhum fluxo com menos de {R.MIN_PESSOAS_DETALHE} observações publica detalhe")

    # ---- R1 nos perfis municipais ----
    v = con.execute(f"""
        SELECT COUNT(*) FROM read_parquet('{PROCESSED}/municipios_dim.parquet')
        WHERE categoria <> 'outros' AND n_faixa = '<5'
    """).fetchone()[0]
    if v:
        falha("R1", f"{v} células de perfil municipal publicadas com n<5 fora da categoria 'outros'")
    else:
        ok("R1", "perfis municipais: nenhuma categoria nominal publicada com menos de 5 observações")

    # ---- R1/R2 nos fluxos pendulares (F2b) ----
    for tipo, univ, orig, dest in (("trab", "ocupado AND pendular_trab", "cd_mun", "trab_mun"),
                                   ("estudo", "estudante AND pendular_estudo", "cd_mun", "estudo_mun")):
        arq = PROCESSED / f"pendular_{tipo}.parquet"
        if not arq.exists():
            continue
        con.execute(f"""
            CREATE OR REPLACE TEMP TABLE cel_p AS
            SELECT {orig} AS origem, {dest} AS destino, COUNT(*) n, COUNT(DISTINCT controle) ndom
            FROM read_parquet('{INTERIM}/pessoas_classificado.parquet')
            WHERE {univ} GROUP BY 1, 2
        """)
        v = con.execute(f"""
            SELECT COUNT(*) FROM read_parquet('{arq}') p
            LEFT JOIN cel_p c ON c.origem = p.origem AND c.destino = p.destino
            WHERE c.n IS NULL OR c.n < {R.MIN_PESSOAS} OR c.ndom < {R.MIN_DOMICILIOS}
        """).fetchone()[0]
        if v:
            falha("R1", f"pendular_{tipo}: {v} fluxos abaixo do limiar")
        else:
            n = con.execute(f"SELECT COUNT(*) FROM read_parquet('{arq}')").fetchone()[0]
            ok("R1", f"pendular_{tipo}: {n:,} fluxos publicados, todos acima do limiar")
        dim = PROCESSED / f"pendular_{tipo}_dim.parquet"
        if dim.exists():
            v = con.execute(f"""
                SELECT COUNT(*) FROM read_parquet('{dim}') d
                LEFT JOIN cel_p c ON c.origem = d.origem AND c.destino = d.destino
                WHERE c.n IS NULL OR c.n < {R.MIN_PESSOAS_DETALHE}
            """).fetchone()[0]
            if v:
                falha("R2", f"pendular_{tipo}_dim: {v} linhas de detalhe em fluxos com n<{R.MIN_PESSOAS_DETALHE}")
            else:
                ok("R2", f"pendular_{tipo}_dim: detalhe restrito a fluxos com n>={R.MIN_PESSOAS_DETALHE}")
            v = con.execute(
                f"SELECT COUNT(*) FROM read_parquet('{dim}') WHERE categoria <> 'outros' AND n_faixa = '<5'"
            ).fetchone()[0]
            if v:
                falha("R1", f"pendular_{tipo}_dim: {v} categorias nominais com n<5")

    # ---- R1 nas tabelas metropolitanas ----
    for arq, univ, o, d in (
        ("rm_fluxos_intra.parquet", "origem_valida", "df_mun", "cd_mun"),
        ("rm_mig_estudo.parquet", "origem_valida AND estudante", "df_mun", "cd_mun"),
    ):
        f = PROCESSED / arq
        if not f.exists():
            continue
        con.execute(f"""
            CREATE OR REPLACE TEMP TABLE cel_rm AS
            SELECT {o} AS origem, {d} AS destino, COUNT(*) n, COUNT(DISTINCT controle) ndom
            FROM read_parquet('{INTERIM}/pessoas_classificado.parquet') WHERE {univ} GROUP BY 1, 2
        """)
        col_o = "origem" if arq == "rm_fluxos_intra.parquet" else "origem_mig"
        col_d = "destino" if arq == "rm_fluxos_intra.parquet" else "destino_mig"
        v = con.execute(f"""
            SELECT COUNT(*) FROM read_parquet('{f}') p
            LEFT JOIN cel_rm c ON c.origem = p.{col_o} AND c.destino = p.{col_d}
            WHERE c.n IS NULL OR c.n < {R.MIN_PESSOAS}
        """).fetchone()[0]
        if v:
            falha("R1", f"{arq}: {v} linhas abaixo do limiar")
        else:
            ok("R1", f"{arq}: todas as linhas acima do limiar de {R.MIN_PESSOAS} observações")

    # ---- R4: valores ponderados em múltiplos de 5 ----
    checagens = [("fluxos.parquet", "total"), ("municipios.parquet", "imig"),
                 ("municipios.parquet", "emig"), ("municipios.parquet", "pop"),
                 ("municipios_dim.parquet", "valor"), ("fluxos_uf.parquet", "total"),
                 ("fluxos_rgi.parquet", "total"), ("fluxos_rgint.parquet", "total"),
                 ("pendular_trab.parquet", "total"), ("pendular_estudo.parquet", "total"),
                 ("pendular_trab_dim.parquet", "valor"), ("rm_fluxos_intra.parquet", "total"),
                 ("rm_mig_pendular.parquet", "total"), ("rm_resumo.parquet", "mig_intra"),
                 ("municipios_pendular.parquet", "saida_trab")]
    ruins = []
    for arq, col in checagens:
        v = con.execute(
            f"SELECT COUNT(*) FROM read_parquet('{PROCESSED}/{arq}') "
            f"WHERE {col} IS NOT NULL AND ABS({col} - ROUND({col}/{R.ARREDONDAMENTO}.0)*{R.ARREDONDAMENTO}) > 1e-6"
        ).fetchone()[0]
        if v:
            ruins.append(f"{arq}.{col}={v}")
    if ruins:
        falha("R4", "valores fora de múltiplos de 5: " + ", ".join(ruins))
    else:
        ok("R4", f"{len(checagens)} colunas de estimativa verificadas, todas em múltiplos de {R.ARREDONDAMENTO}")

    # ---- R5: n só em faixas, nunca exato ----
    faixas_validas = {rot for _, _, rot in R.FAIXAS_N} | {"<5"}
    for arq in ("fluxos.parquet", "fluxos_uf.parquet", "municipios_dim.parquet",
                "pendular_trab.parquet", "pendular_trab_dim.parquet", "pendular_estudo.parquet",
                "rm_fluxos_intra.parquet", "rm_mig_pendular.parquet"):
        cols = {c.lower() for c in con.execute(f"SELECT * FROM read_parquet('{PROCESSED}/{arq}') LIMIT 0").df().columns}
        numericas = [c for c in cols if c == "n" or c.startswith("n_") and not c.endswith("_faixa")]
        if numericas:
            falha("R5", f"{arq} publica contagem exata em {numericas}")
        col_faixa = [c for c in cols if c.endswith("_faixa")]
        for c in col_faixa:
            fora = con.execute(
                f"SELECT COUNT(*) FROM read_parquet('{PROCESSED}/{arq}') WHERE {c} NOT IN "
                + "(" + ",".join(f"'{x}'" for x in faixas_validas) + ")").fetchone()[0]
            if fora:
                falha("R5", f"{arq}.{c} tem {fora} valores fora das faixas previstas")
    if not any(x.startswith("R5") for x in violacoes):
        ok("R5", "nenhuma contagem amostral exata publicada; apenas faixas")

    # ---- relatório ----
    if violacoes:
        print(f"\nGATE REPROVADO: {len(violacoes)} violação(ões).")
        GATE_OK.unlink(missing_ok=True)
        return 1

    linhas = ["# Relatório de controle de revelação",
              "",
              f"- Versão dos dados: **{args.versao}**",
              f"- Gerado em: {dt.datetime.now():%Y-%m-%d %H:%M} (fuso local)",
              "- Fonte: IBGE, Censo Demográfico 2022, microdados da amostra (acesso controlado).",
              "",
              "## Regras aplicadas",
              "",
              f"| Regra | Parâmetro |", "|---|---|",
              f"| R1 limiar por célula | ≥ {R.MIN_PESSOAS} pessoas e ≥ {R.MIN_DOMICILIOS} domicílios |",
              f"| R2 detalhe por características | só em fluxos com ≥ {R.MIN_PESSOAS_DETALHE} observações |",
              "| R3 supressão complementar | categorias suprimidas somadas em `outros` da mesma dimensão |",
              f"| R4 arredondamento | múltiplos de {R.ARREDONDAMENTO} |",
              "| R5 contagem amostral | publicada apenas em faixas |",
              "| R6 geografia e cruzamentos | município é a menor unidade; sem área de ponderação nem identificador de domicílio |",
              "",
              "## Verificações independentes", ""]
    linhas += [f"- {n}" for n in notas]
    linhas += ["", "## Arquivos publicados", "", "| Arquivo | Linhas | Tamanho | SHA-256 (12) |", "|---|---:|---:|---|"]
    for f in arquivos:
        n = con.execute(f"SELECT COUNT(*) FROM read_parquet('{f}')").fetchone()[0]
        h = hashlib.sha256(f.read_bytes()).hexdigest()[:12]
        linhas.append(f"| `{f.name}` | {n:,} | {f.stat().st_size/1e6:.1f} MB | `{h}` |")
    linhas += ["", "## Supressão aplicada", ""]
    tot_pares = con.execute("SELECT COUNT(*) FROM cel").fetchone()[0]
    pub = con.execute(f"SELECT COUNT(*) FROM read_parquet('{PROCESSED}/fluxos.parquet')").fetchone()[0]
    vol_pub = con.execute(f"SELECT SUM(total) FROM read_parquet('{PROCESSED}/fluxos.parquet')").fetchone()[0]
    vol_tot = con.execute("SELECT SUM(peso) FROM mig").fetchone()[0]
    linhas += [
        f"- Pares origem→destino existentes na amostra: {tot_pares:,}",
        f"- Pares publicados (após R1): {pub:,} ({100*pub/tot_pares:.1f}%), cobrindo "
        f"{100*vol_pub/vol_tot:.1f}% do volume migratório estimado",
        f"- Os {tot_pares-pub:,} pares suprimidos permanecem contabilizados nos totais municipais "
        "de `municipios.parquet`, de modo que nenhum volume é perdido — apenas a identificação do par.",
    ]
    dest = ROOT / f"docs/relatorio_revelacao_{args.versao}.md"
    dest.write_text("\n".join(linhas) + "\n", encoding="utf-8")

    carimbo = {
        "formato_versao": GATE_VERSAO_FORMATO,
        "versao_dados": args.versao,
        "timestamp": dt.datetime.now().isoformat(),
        "arquivos": hashes_publicaveis(),
    }
    GATE_OK.write_text(json.dumps(carimbo, indent=2, sort_keys=True, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"\nGATE APROVADO. Relatório: {dest.relative_to(ROOT)}")
    print(f"Carimbo: {GATE_OK.relative_to(ROOT)} ({len(carimbo['arquivos'])} arquivos)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
