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
            p.imp_df_local, p.imp_df_mun, p.imp_trab_mun,
            -- deslocamento pendular (F2b)
            p.ocupado_10, p.pos_ocup, p.atividade, p.grande_grupo, p.renda_trab,
            p.trab_local, p.trab_uf, p.trab_mun, p.retorna_3dias, p.transporte,
            p.tempo_desloc_cat, p.tempo_desloc_min,
            p.freq_escolar, p.curso, p.estudo_local, p.estudo_uf, p.estudo_mun,
            d.renda_pc, d.tipo_domicilio
        FROM read_parquet('data/interim/pessoas.parquet') p
        LEFT JOIN read_parquet('data/interim/domicilios.parquet') d
               ON d.controle = p.controle
    )
    SELECT
        uf, cd_mun, cd_apond, controle, peso, idade, df_mun, df_uf, nivel_instr_4, renda_pc,
        imp_df_local, imp_df_mun, imp_trab_mun,
        trab_local, trab_uf, trab_mun, retorna_3dias, transporte,
        tempo_desloc_cat, tempo_desloc_min, renda_trab,
        freq_escolar, curso, estudo_local, estudo_uf, estudo_mun,

        -- universos do bloco de deslocamento
        COALESCE(ocupado_10 = '1', FALSE)                                AS ocupado,
        COALESCE(freq_escolar = '1', FALSE)                              AS estudante,
        -- pendularidade para trabalho: trabalha em outro município do Brasil, com destino conhecido
        COALESCE(trab_local = '3' AND trab_mun NOT IN ('8888888', '9999999')
                 AND trab_mun <> cd_mun, FALSE)                          AS pendular_trab,
        COALESCE(estudo_local = '2' AND estudo_mun NOT IN ('8888888', '9999999')
                 AND estudo_mun <> cd_mun, FALSE)                        AS pendular_estudo,

        -- posição na ocupação em 5 grupos (P1020)
        CASE
            WHEN pos_ocup IN ('01', '03', '05') THEN 'empregado_com_carteira'
            WHEN pos_ocup IN ('02', '04', '06') THEN 'empregado_sem_carteira'
            WHEN pos_ocup = '07'                THEN 'militar_estatutario'
            WHEN pos_ocup = '08'                THEN 'empregador'
            WHEN pos_ocup IN ('09', '10')       THEN 'conta_propria_familiar'
        END                                                              AS pos_grupo,

        -- setor de atividade em 8 grupos (P1030)
        CASE
            WHEN atividade = '01'                              THEN 'agropecuaria'
            WHEN atividade IN ('02', '03', '04', '05')         THEN 'industria'
            WHEN atividade = '06'                              THEN 'construcao'
            WHEN atividade = '07'                              THEN 'comercio'
            WHEN atividade = '08'                              THEN 'transporte_logistica'
            WHEN atividade IN ('10', '11', '12', '13', '14')   THEN 'servicos_empresariais'
            WHEN atividade IN ('15', '16', '17')               THEN 'admin_educacao_saude'
            WHEN atividade IN ('09', '18', '19', '20', '21', '22') THEN 'outros_servicos'
        END                                                              AS setor_grupo,

        grande_grupo                                                     AS ocup_grupo,

        -- meio de transporte em 6 grupos (P1170)
        CASE
            WHEN transporte IN ('01', '02')             THEN 'a_pe_bicicleta'
            WHEN transporte IN ('03', '04')             THEN 'motocicleta'
            WHEN transporte IN ('05', '06')             THEN 'automovel_taxi'
            WHEN transporte IN ('07', '08', '09')       THEN 'onibus_van_brt'
            WHEN transporte = '10'                      THEN 'trem_metro'
            WHEN transporte IN ('11', '12', '13', '14', '99') THEN 'outros'
        END                                                              AS modo_grupo,

        -- rendimento do trabalho em classes de salário mínimo (SM = R$ 1.212)
        CASE
            WHEN renda_trab IS NULL      THEN 'sem_declaracao'
            WHEN renda_trab <= 1212.00   THEN 'ate_1_sm'
            WHEN renda_trab <= 2424.00   THEN 'de_1_a_2_sm'
            WHEN renda_trab <= 3636.00   THEN 'de_2_a_3_sm'
            WHEN renda_trab <= 6060.00   THEN 'de_3_a_5_sm'
            ELSE 'mais_de_5_sm'
        END                                                              AS renda_trab_classe,

        -- nível do curso frequentado em 4 grupos (P0660)
        CASE
            WHEN curso IN ('01', '02', '03', '04', '05') THEN 'infantil_fundamental'
            WHEN curso IN ('06', '07')                   THEN 'medio'
            WHEN curso = '08'                            THEN 'graduacao'
            WHEN curso IN ('09', '10', '11')             THEN 'pos_graduacao'
        END                                                              AS curso_grupo,


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
