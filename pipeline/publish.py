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

    # ================= F2b: pendular e metropolitano =================
    # Fluxos pendulares: R1 no par, R2 para o detalhe, R4 arredondamento, R5 faixas de n.
    for tipo in ("trab", "estudo"):
        con.execute(f"""
            COPY (
                SELECT origem, destino, {R.sql_arredonda('total')} AS total,
                       ROUND(se, 1) AS se, ROUND(cv, 2) AS cv,
                       {R.sql_faixa_n('n')} AS n_faixa,
                       CASE WHEN cv IS NULL THEN 'sem_estimativa'
                            WHEN cv <= {R.CV_BOA} THEN 'boa'
                            WHEN cv <= {R.CV_CAUTELA} THEN 'cautela' ELSE 'baixa' END AS precisao,
                       (n >= {R.MIN_PESSOAS_DETALHE}) AS tem_detalhe
                       {", ROUND(tempo_mediano, 1) AS tempo_mediano, ROUND(pct_diario, 1) AS pct_diario, ROUND(pct_coletivo, 1) AS pct_coletivo" if tipo == "trab" else ""}
                FROM read_parquet('{INTERIM}/pendular_{tipo}_bruto.parquet')
                WHERE n >= {R.MIN_PESSOAS} AND ndom >= {R.MIN_DOMICILIOS}
            ) TO '{PROCESSED}/pendular_{tipo}.parquet' (FORMAT PARQUET)
        """)
        # caracterização em formato longo: célula a célula (R1) e só para fluxos com detalhe (R2)
        con.execute(f"""
            COPY (
                WITH pares AS (
                    SELECT origem, destino, n FROM read_parquet('{INTERIM}/pendular_{tipo}_bruto.parquet')
                    WHERE n >= {R.MIN_PESSOAS_DETALHE} AND ndom >= {R.MIN_DOMICILIOS}
                ), marcado AS (
                    SELECT d.origem, d.destino, d.dimensao,
                           CASE WHEN d.n >= {R.MIN_PESSOAS} AND d.ndom >= {R.MIN_DOMICILIOS}
                                THEN COALESCE(d.categoria, 'outros') ELSE 'outros' END AS categoria,
                           d.valor, d.n
                    FROM read_parquet('{INTERIM}/pendular_{tipo}_dim_bruto.parquet') d
                    JOIN pares p ON p.origem = d.origem AND p.destino = d.destino
                )
                SELECT origem, destino, dimensao, categoria,
                       {R.sql_arredonda('SUM(valor)')} AS valor,
                       {R.sql_faixa_n('SUM(n)')} AS n_faixa
                FROM marcado GROUP BY 1, 2, 3, 4
            ) TO '{PROCESSED}/pendular_{tipo}_dim.parquet' (FORMAT PARQUET)
        """)

    # Indicadores pendulares municipais (totais de cabeçalho, sem supressão de par)
    con.execute(f"""
        COPY (
            SELECT cd_mun,
                   {R.sql_arredonda('ocupados')} AS ocupados,
                   {R.sql_arredonda('estudantes')} AS estudantes,
                   {R.sql_arredonda('saida_trab')} AS saida_trab,
                   {R.sql_arredonda('entrada_trab')} AS entrada_trab,
                   {R.sql_arredonda('saldo_pendular')} AS saldo_pendular,
                   {R.sql_arredonda('saida_estudo')} AS saida_estudo,
                   {R.sql_arredonda('entrada_estudo')} AS entrada_estudo,
                   {R.sql_arredonda('varios_municipios')} AS varios_municipios,
                   {R.sql_arredonda('trabalha_exterior')} AS trabalha_exterior,
                   ROUND(taxa_saida_pendular, 2) AS taxa_saida_pendular,
                   ROUND(indice_atracao, 3) AS indice_atracao,
                   tempo_mediano, pct_retorno_diario, pct_coletivo,
                   {R.sql_faixa_n('n_saida_trab')} AS n_saida_faixa,
                   {R.sql_faixa_n('n_entrada_trab')} AS n_entrada_faixa
            FROM read_parquet('{INTERIM}/municipios_pendular_bruto.parquet')
        ) TO '{PROCESSED}/municipios_pendular.parquet' (FORMAT PARQUET)
    """)

    # Composição das regiões metropolitanas (recorte público do IBGE + núcleo definido no projeto)
    con.execute(f"""
        COPY (SELECT cd_rm, nm_rm, tipo, cd_mun, nm_mun, uf_sigla, nucleo,
                     {R.sql_arredonda('pop')} AS pop
              FROM read_parquet('{INTERIM}/rm_bruto.parquet'))
        TO '{PROCESSED}/rm.parquet' (FORMAT PARQUET)
    """)
    con.execute(f"""
        COPY (
            SELECT cd_rm, nm_rm, tipo, nm_nucleo, n_municipios,
                   {R.sql_arredonda('pop')} AS pop,
                   {R.sql_arredonda('mig_intra')} AS mig_intra,
                   {R.sql_arredonda('nucleo_periferia')} AS nucleo_periferia,
                   {R.sql_arredonda('periferia_nucleo')} AS periferia_nucleo,
                   {R.sql_arredonda('periferia_periferia')} AS periferia_periferia,
                   {R.sql_arredonda('entradas_externas')} AS entradas_externas,
                   {R.sql_arredonda('saidas_externas')} AS saidas_externas,
                   {R.sql_arredonda('saldo_externo')} AS saldo_externo,
                   {R.sql_arredonda('ocupados')} AS ocupados,
                   {R.sql_arredonda('pendulares')} AS pendulares,
                   pct_pendular, tempo_mediano, pct_coletivo, pct_diario
            FROM read_parquet('{INTERIM}/rm_resumo_bruto.parquet')
        ) TO '{PROCESSED}/rm_resumo.parquet' (FORMAT PARQUET)
    """)

    # Fluxos migratórios intra-RM (R1 no par)
    con.execute(f"""
        COPY (
            SELECT cd_rm, origem, destino, tipologia,
                   {R.sql_arredonda('total')} AS total, ROUND(se, 1) AS se, ROUND(cv, 2) AS cv,
                   {R.sql_faixa_n('n')} AS n_faixa
            FROM read_parquet('{INTERIM}/rm_fluxos_intra_bruto.parquet')
            WHERE n >= {R.MIN_PESSOAS} AND ndom >= {R.MIN_DOMICILIOS}
        ) TO '{PROCESSED}/rm_fluxos_intra.parquet' (FORMAT PARQUET)
    """)

    # Cruzamento migração intra-RM x pendularidade (tripla origem -> residência -> trabalho)
    con.execute(f"""
        COPY (
            SELECT cd_rm, origem_mig, destino_mig, destino_trab, classe_trab,
                   {R.sql_arredonda('total')} AS total,
                   {R.sql_faixa_n('n')} AS n_faixa,
                   ROUND(pct_diario, 1) AS pct_diario, ROUND(pct_coletivo, 1) AS pct_coletivo
            FROM read_parquet('{INTERIM}/rm_mig_pendular_bruto.parquet')
            WHERE n >= {R.MIN_PESSOAS} AND ndom >= {R.MIN_DOMICILIOS}
        ) TO '{PROCESSED}/rm_mig_pendular.parquet' (FORMAT PARQUET)
    """)
    con.execute(f"""
        COPY (
            SELECT cd_rm, cd_mun,
                   {R.sql_arredonda('migrantes_intra')} AS migrantes_intra,
                   {R.sql_arredonda('mig_ocupados')} AS mig_ocupados,
                   {R.sql_arredonda('mig_pendulares')} AS mig_pendulares,
                   {R.sql_arredonda('pendular_para_origem')} AS pendular_para_origem,
                   {R.sql_arredonda('pendular_para_nucleo')} AS pendular_para_nucleo,
                   {R.sql_arredonda('pendular_para_outro')} AS pendular_para_outro,
                   {R.sql_arredonda('trabalha_onde_mora')} AS trabalha_onde_mora,
                   {R.sql_arredonda('mig_estudantes')} AS mig_estudantes,
                   {R.sql_arredonda('mig_estud_pendulares')} AS mig_estud_pendulares,
                   tempo_mediano, ROUND(pct_pendular, 1) AS pct_pendular,
                   {R.sql_faixa_n('n_migrantes_intra')} AS n_faixa
            FROM read_parquet('{INTERIM}/rm_mig_pendular_resumo_bruto.parquet')
            WHERE n_migrantes_intra >= {R.MIN_PESSOAS}
        ) TO '{PROCESSED}/rm_mig_pendular_resumo.parquet' (FORMAT PARQUET)
    """)
    con.execute(f"""
        COPY (
            SELECT cd_rm, origem_mig, destino_mig, destino_estudo, classe_estudo,
                   {R.sql_arredonda('total')} AS total, {R.sql_faixa_n('n')} AS n_faixa
            FROM read_parquet('{INTERIM}/rm_mig_estudo_bruto.parquet')
            WHERE n >= {R.MIN_PESSOAS} AND ndom >= {R.MIN_DOMICILIOS}
        ) TO '{PROCESSED}/rm_mig_estudo.parquet' (FORMAT PARQUET)
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
