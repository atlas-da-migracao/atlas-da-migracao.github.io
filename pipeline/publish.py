"""Aplica as regras de revelação (R1-R6) e escreve data/processed/ (arquivos publicáveis).

Reconstrói os fluxos a partir de data/interim/pessoas_classificado.parquet para ter a
contagem amostral de CADA célula (não só do fluxo), o que permite suprimir célula a célula.

Nada aqui imprime registros individuais: só contagens, somas e nomes de arquivo.
"""
from __future__ import annotations

import os
import pathlib
import sys

import duckdb

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "pipeline"))
import disclosure_rules as R  # noqa: E402

INTERIM = ROOT / "data/interim"
PROCESSED = ROOT / "data/processed"

# coluna de origem de cada categoria no arquivo classificado
COL_DIM = {"status": "status", "edu": "edu_grupo", "renda": "renda_classe",
           "idade_sexo": "idade_sexo_grupo"}
# filtro adicional por dimensão (escolaridade só para 25 anos ou mais)
FILTRO_DIM = {"edu": "idade >= 25"}


def nome_col(dim: str, cat: str) -> str:
    return f"{dim}__{cat}".lower()


def expr_categorias(prefixo_valor: str = "peso") -> tuple[str, str]:
    """Gera as expressões SQL de valor e de contagem para todas as categorias.

    Cada célula só é publicada se tiver >= MIN_PESSOAS observações (R1); caso contrário
    o valor vai para a coluna residual `<dim>__outros`, preservando o total da dimensão.
    """
    valores, contagens = [], []
    for dim, cats in R.DIMENSOES.items():
        col = COL_DIM[dim]
        extra = f" AND {FILTRO_DIM[dim]}" if dim in FILTRO_DIM else ""
        publicaveis = []
        for cat in cats:
            cond = f"{col} = '{cat}'{extra}"
            c = f"COUNT(*) FILTER (WHERE {cond})"
            v = f"COALESCE(SUM({prefixo_valor}) FILTER (WHERE {cond}), 0)"
            valores.append(f"CASE WHEN {c} >= {R.MIN_PESSOAS} THEN {v} END AS {nome_col(dim, cat)}")
            contagens.append(f"{c} AS n_{nome_col(dim, cat)}")
            publicaveis.append((cond, c, v))
        # residual: soma das categorias suprimidas + categorias fora da lista publicada
        partes = " + ".join(f"CASE WHEN {c} < {R.MIN_PESSOAS} THEN {v} ELSE 0 END" for _, c, v in publicaveis)
        cond_fora = f"{col} IS NOT NULL{extra} AND {col} NOT IN (" + ", ".join(f"'{c}'" for c in cats) + ")"
        fora_v = f"COALESCE(SUM({prefixo_valor}) FILTER (WHERE {cond_fora}), 0)"
        valores.append(f"({partes} + {fora_v}) AS {dim}__outros")
    return ",\n            ".join(valores), ",\n            ".join(contagens)


def main() -> None:
    os.chdir(ROOT)
    PROCESSED.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect()
    con.execute("PRAGMA threads=10; PRAGMA memory_limit='16GB';")
    con.execute(f"CREATE OR REPLACE TEMP VIEW mig AS SELECT * FROM read_parquet('{INTERIM}/pessoas_classificado.parquet') WHERE origem_valida")
    con.execute(f"CREATE OR REPLACE TEMP VIEW fluxos_b AS SELECT * FROM read_parquet('{INTERIM}/fluxos_bruto.parquet')")

    vals, cnts = expr_categorias()

    # ---------------- fluxos municipais ----------------
    # R1: só pares com >= 5 pessoas e >= 3 domicílios; R2: detalhe só com n >= 20;
    # R4: arredondamento; R5: n em faixas.
    con.execute(f"""
        CREATE OR REPLACE TEMP TABLE fluxos_cel AS
        SELECT df_mun AS origem, cd_mun AS destino,
               SUM(peso) AS total_raw, COUNT(*) AS n, COUNT(DISTINCT controle) AS ndom,
               {vals},
               {cnts}
        FROM mig GROUP BY 1, 2
    """)
    detalhe_cols = []
    for dim, cats in R.DIMENSOES.items():
        for cat in cats:
            c = nome_col(dim, cat)
            detalhe_cols.append(
                f"CASE WHEN f.n >= {R.MIN_PESSOAS_DETALHE} THEN {R.sql_arredonda('f.' + c)} END AS {c}")
        detalhe_cols.append(
            f"CASE WHEN f.n >= {R.MIN_PESSOAS_DETALHE} "
            f"THEN {R.sql_arredonda('f.' + dim + '__outros')} END AS {dim}__outros")
    con.execute(f"""
        COPY (
            SELECT f.origem, f.destino,
                   {R.sql_arredonda('f.total_raw')} AS total,
                   ROUND(b.se, 1) AS se, ROUND(b.cv, 2) AS cv,
                   {R.sql_faixa_n('f.n')} AS n_faixa,
                   CASE WHEN b.cv IS NULL THEN 'sem_estimativa'
                        WHEN b.cv <= {R.CV_BOA} THEN 'boa'
                        WHEN b.cv <= {R.CV_CAUTELA} THEN 'cautela' ELSE 'baixa' END AS precisao,
                   (f.n >= {R.MIN_PESSOAS_DETALHE}) AS tem_detalhe,
                   {', '.join(detalhe_cols)}
            FROM fluxos_cel f
            LEFT JOIN fluxos_b b ON b.origem = f.origem AND b.destino = f.destino
            WHERE f.n >= {R.MIN_PESSOAS} AND f.ndom >= {R.MIN_DOMICILIOS}
        ) TO '{PROCESSED}/fluxos.parquet' (FORMAT PARQUET)
    """)

    # ---------------- municípios (totais de cabeçalho) ----------------
    con.execute(f"""
        COPY (
            SELECT cd_mun, nm_mun, uf, uf_sigla, cd_rgi, nm_rgi, cd_rgint, nm_rgint,
                   cd_rm, nm_rm, cd_concurb,
                   {R.sql_arredonda('pop')} AS pop, {R.sql_arredonda('pop5')} AS pop5,
                   {R.sql_arredonda('imig')} AS imig, {R.sql_arredonda('imig_ni')} AS imig_ni,
                   {R.sql_arredonda('imig_int')} AS imig_int, {R.sql_arredonda('emig')} AS emig,
                   {R.sql_arredonda('saldo')} AS saldo,
                   ROUND(tbi, 2) AS tbi, ROUND(tbe, 2) AS tbe, ROUND(tlm, 2) AS tlm,
                   ROUND(iem, 4) AS iem,
                   ROUND(se_imig, 1) AS se_imig, ROUND(se_emig, 1) AS se_emig,
                   ROUND(se_saldo, 1) AS se_saldo,
                   ROUND(cv_imig, 2) AS cv_imig, ROUND(cv_emig, 2) AS cv_emig,
                   {R.sql_faixa_n('n_imig')} AS n_imig_faixa, {R.sql_faixa_n('n_emig')} AS n_emig_faixa,
                   CASE WHEN cv_imig IS NULL THEN 'sem_estimativa'
                        WHEN cv_imig <= {R.CV_BOA} THEN 'boa'
                        WHEN cv_imig <= {R.CV_CAUTELA} THEN 'cautela' ELSE 'baixa' END AS precisao_imig
            FROM read_parquet('{INTERIM}/municipios_bruto.parquet')
        ) TO '{PROCESSED}/municipios.parquet' (FORMAT PARQUET)
    """)

    # ---------------- perfis municipais (formato longo) ----------------
    # R1 célula a célula; o que não passa vira categoria 'outros' da mesma dimensão.
    con.execute(f"""
        COPY (
            WITH d AS (SELECT * FROM read_parquet('{INTERIM}/municipios_dim_bruto.parquet')
                       WHERE categoria IS NOT NULL),
            marcado AS (
                SELECT cd_mun, direcao, dimensao,
                       CASE WHEN n >= {R.MIN_PESSOAS} AND ndom >= {R.MIN_DOMICILIOS}
                            THEN categoria ELSE 'outros' END AS categoria,
                       valor, n
                FROM d
            )
            SELECT cd_mun, direcao, dimensao, categoria,
                   {R.sql_arredonda('SUM(valor)')} AS valor,
                   {R.sql_faixa_n('SUM(n)')} AS n_faixa
            FROM marcado GROUP BY 1, 2, 3, 4
        ) TO '{PROCESSED}/municipios_dim.parquet' (FORMAT PARQUET)
    """)

    # ---------------- fluxos agregados (RGI / RGInt / UF) ----------------
    for nivel in ("rgi", "rgint", "uf"):
        con.execute(f"""
            COPY (
                SELECT origem, destino, {R.sql_arredonda('total')} AS total,
                       ROUND(se, 1) AS se, ROUND(cv, 2) AS cv,
                       {R.sql_faixa_n('n')} AS n_faixa,
                       CASE WHEN cv IS NULL THEN 'sem_estimativa'
                            WHEN cv <= {R.CV_BOA} THEN 'boa'
                            WHEN cv <= {R.CV_CAUTELA} THEN 'cautela' ELSE 'baixa' END AS precisao
                FROM read_parquet('{INTERIM}/fluxos_{nivel}_bruto.parquet')
                WHERE n >= {R.MIN_PESSOAS} AND ndom >= {R.MIN_DOMICILIOS}
            ) TO '{PROCESSED}/fluxos_{nivel}.parquet' (FORMAT PARQUET)
        """)

    # ---------------- referência territorial (dados públicos do IBGE) ----------------
    con.execute(f"""
        COPY (SELECT * FROM read_parquet('{INTERIM}/municipios_ref.parquet')
              WHERE cd_mun NOT IN ('8888888','9999999'))
        TO '{PROCESSED}/municipios_ref.parquet' (FORMAT PARQUET)
    """)

    print("Arquivos publicáveis gravados em data/processed:")
    for f in sorted(PROCESSED.glob("*.parquet")):
        n = con.execute(f"SELECT COUNT(*) FROM read_parquet('{f}')").fetchone()[0]
        print(f"  {f.name:<28} {n:>9,} linhas  {f.stat().st_size/1e6:>7.1f} MB")


if __name__ == "__main__":
    main()
