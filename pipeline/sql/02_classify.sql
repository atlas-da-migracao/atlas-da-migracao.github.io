-- F2: Classificação de status migratório, escolaridade, renda e idade/sexo.
-- Produz data/interim/pessoas_classificado.parquet com TODA a população (não só migrantes),
-- porque o dashboard compara o perfil dos migrantes ao da população residente.
-- Salário mínimo de referência do Censo 2022: R$ 1.212,00 (Notas 05/2026).
PRAGMA threads = 10;
PRAGMA memory_limit = '16GB';

COPY (
    WITH base AS (
        SELECT
            p.uf, p.cd_mun, p.cd_apond, p.controle, p.peso, p.sexo, p.idade,
            p.df_local, p.df_uf, p.df_mun,
            p.nasc_local, p.nasc_uf, p.nasc_mun, p.nacionalidade,
            p.nivel_instr_4, p.nivel_instr_7, p.anos_estudo,
            p.imp_df_local, p.imp_df_mun,
            d.renda_pc, d.tipo_domicilio
        FROM read_parquet('data/interim/pessoas.parquet') p
        LEFT JOIN read_parquet('data/interim/domicilios.parquet') d
               ON d.controle = p.controle
    )
    SELECT
        uf, cd_mun, cd_apond, controle, peso, idade, df_mun, df_uf, nivel_instr_4, renda_pc,
        imp_df_local, imp_df_mun,

        -- COALESCE obrigatório: df_local é NULL para quem mora há 6+ anos no município
        -- (P0600 em branco). Sem isso, `NOT is_migrante` vira NULL e apaga ~19 milhões de
        -- registros de não migrantes dos grupos de comparação.
        COALESCE(df_local IN ('2', '3'), FALSE)                          AS is_migrante,
        COALESCE(df_local = '2', FALSE)                                  AS is_mig_interno,
        COALESCE(df_local = '3', FALSE)                                  AS is_mig_internacional,
        COALESCE(df_local = '2' AND df_mun NOT IN ('8888888', '9999999'), FALSE) AS origem_conhecida,
        -- origem_valida exclui 2 registros da fonte em que origem = destino (inconsistência
        -- residual do Censo, PR e RS, 25 pessoas ponderadas); só ela alimenta fluxos e emigração
        COALESCE(df_local = '2' AND df_mun NOT IN ('8888888', '9999999')
             AND df_mun <> cd_mun, FALSE)                                AS origem_valida,
        COALESCE(df_local = '2' AND df_uf IS NOT NULL AND df_uf <> uf
             AND df_uf NOT IN ('88', '99'), FALSE)                       AS interestadual,

        CASE
            WHEN df_local = '3' AND nacionalidade IN ('1', '2') THEN 'internacional_brasileiro'
            WHEN df_local = '3'                                  THEN 'internacional_estrangeiro'
            WHEN df_local = '2' AND nasc_local = '1'             THEN 'retorno_natal'
            WHEN df_local = '2' AND nasc_local = '3'             THEN 'nascido_exterior'
            WHEN df_local = '2' AND df_mun IN ('8888888', '9999999') THEN 'origem_nao_informada'
            WHEN df_local = '2' AND nasc_local = '2' AND df_mun = nasc_mun  THEN 'primeira_saida'
            WHEN df_local = '2' AND nasc_local = '2' AND df_mun <> nasc_mun THEN 'etapas_multiplas'
            WHEN df_local = '2'                                  THEN 'outro'
            ELSE NULL
        END                                                             AS status,

        -- retorno à UF de nascimento (flag adicional do plano)
        COALESCE(df_local = '2' AND nasc_local = '2' AND nasc_uf = uf AND df_uf <> uf
             AND df_uf NOT IN ('88', '99'), FALSE)                       AS retorno_uf_natal,

        -- escolaridade: nível de instrução compatível com 2010 (P0770), só para 25 anos ou mais
        CASE WHEN idade >= 25 THEN
            CASE nivel_instr_4
                WHEN '1' THEN 'sem_instr_fund_incompleto'
                WHEN '2' THEN 'fund_completo_medio_incompleto'
                WHEN '3' THEN 'medio_completo_superior_incompleto'
                WHEN '4' THEN 'superior_completo'
                ELSE 'nao_determinado'
            END
        END                                                             AS edu_grupo,

        -- renda domiciliar per capita em classes de salário mínimo (SM = R$ 1.212)
        CASE
            WHEN renda_pc IS NULL          THEN 'nao_aplicavel'
            WHEN renda_pc <= 303.00        THEN 'ate_1_4_sm'
            WHEN renda_pc <= 606.00        THEN 'de_1_4_a_1_2_sm'
            WHEN renda_pc <= 1212.00       THEN 'de_1_2_a_1_sm'
            WHEN renda_pc <= 2424.00       THEN 'de_1_a_2_sm'
            ELSE 'mais_de_2_sm'
        END                                                             AS renda_classe,

        CASE
            WHEN idade IS NULL OR idade < 5 THEN NULL
            WHEN idade < 15 THEN '05_14'
            WHEN idade < 25 THEN '15_24'
            WHEN idade < 40 THEN '25_39'
            WHEN idade < 60 THEN '40_59'
            ELSE '60_mais'
        END                                                             AS idade_grupo,

        CASE sexo WHEN 1 THEN 'M' WHEN 2 THEN 'F' ELSE 'ignorado' END    AS sexo_label,

        CASE
            WHEN idade IS NULL OR idade < 5 THEN NULL
            ELSE (CASE
                    WHEN idade < 15 THEN '05_14'
                    WHEN idade < 25 THEN '15_24'
                    WHEN idade < 40 THEN '25_39'
                    WHEN idade < 60 THEN '40_59'
                    ELSE '60_mais'
                  END)
                 || '_' ||
                 (CASE sexo WHEN 1 THEN 'M' WHEN 2 THEN 'F' ELSE 'I' END)
        END                                                             AS idade_sexo_grupo
    FROM base
) TO 'data/interim/pessoas_classificado.parquet' (FORMAT PARQUET);
