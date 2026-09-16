-- F2 (edição Censo 1980): Matriz de fluxos migratórios origem->destino (proxy de data fixa
-- 1975->1980) com caracterização por status, escolaridade (25+), renda domiciliar per capita e
-- idade/sexo. Universo: migração interna com origem conhecida e origem <> destino
-- (origem_valida).
--
-- Override de pipeline/sql/04_flows.sql. DUAS diferenças frente ao script-base:
--   1. SEM estimador de variância -- não há chave de domicílio em 1980 (ver
--      03_indicators.sql/CABECALHO_02_classify.txt ponto 11); se/cv gravados como
--      CAST(NULL AS DOUBLE) direto, sem apond nem var_fluxo.
--   2. Vocabulário de `status` REDUZIDO: 3 colunas -- st_retorno_natal, st_nao_natural,
--      st_nascido_exterior --, não 4 (sem st_primeira_saida/st_etapas_multiplas), igual a
--      pipeline/sql/1991/04_flows.sql e pipeline/sql/2000/04_flows.sql -- 1980 não coleta o
--      MUNICÍPIO de nascimento (v512 dá só UF ou país), então primeira_saida e
--      etapas_multiplas são indistinguíveis e colapsam em nao_natural (ver 02_classify.sql
--      ponto 14).
PRAGMA threads = 10;
PRAGMA memory_limit = '16GB';

CREATE OR REPLACE TEMP VIEW mig AS
    SELECT * FROM read_parquet('data/interim/1980/pessoas_classificado.parquet') WHERE origem_valida;
CREATE OR REPLACE TEMP VIEW ref AS
    SELECT * FROM read_parquet('data/interim/1980/municipios_ref.parquet');

-- ---------- fluxos municipais (sem variância -- ver cabeçalho) ----------
COPY (
    SELECT
        df_mun AS origem, cd_mun AS destino,
        SUM(peso) AS total, COUNT(*) AS n, CAST(NULL AS BIGINT) AS ndom,
        COALESCE(SUM(peso) FILTER (WHERE status = 'retorno_natal'), 0)     AS st_retorno_natal,
        COALESCE(SUM(peso) FILTER (WHERE status = 'nao_natural'), 0)       AS st_nao_natural,
        COALESCE(SUM(peso) FILTER (WHERE status = 'nascido_exterior'), 0)  AS st_nascido_exterior,
        COALESCE(SUM(peso) FILTER (WHERE idade >= 25 AND edu_grupo = 'sem_instr_fund_incompleto'), 0)          AS edu_sem_instr,
        COALESCE(SUM(peso) FILTER (WHERE idade >= 25 AND edu_grupo = 'fund_completo_medio_incompleto'), 0)     AS edu_fund,
        COALESCE(SUM(peso) FILTER (WHERE idade >= 25 AND edu_grupo = 'medio_completo_superior_incompleto'), 0) AS edu_medio,
        COALESCE(SUM(peso) FILTER (WHERE idade >= 25 AND edu_grupo = 'superior_completo'), 0)                  AS edu_superior,
        COALESCE(SUM(peso) FILTER (WHERE idade >= 25 AND edu_grupo = 'nao_determinado'), 0)                    AS edu_nao_det,
        COALESCE(SUM(peso) FILTER (WHERE renda_classe = 'ate_1_4_sm'), 0)       AS ren_ate_1_4,
        COALESCE(SUM(peso) FILTER (WHERE renda_classe = 'de_1_4_a_1_2_sm'), 0)  AS ren_1_4_1_2,
        COALESCE(SUM(peso) FILTER (WHERE renda_classe = 'de_1_2_a_1_sm'), 0)    AS ren_1_2_1,
        COALESCE(SUM(peso) FILTER (WHERE renda_classe = 'de_1_a_2_sm'), 0)      AS ren_1_2,
        COALESCE(SUM(peso) FILTER (WHERE renda_classe = 'mais_de_2_sm'), 0)     AS ren_mais_2,
        COALESCE(SUM(peso) FILTER (WHERE renda_classe = 'nao_aplicavel'), 0)    AS ren_na,
        COALESCE(SUM(peso) FILTER (WHERE idade_sexo_grupo = '05_14_M'), 0)   AS is_05_14_m,
        COALESCE(SUM(peso) FILTER (WHERE idade_sexo_grupo = '05_14_F'), 0)   AS is_05_14_f,
        COALESCE(SUM(peso) FILTER (WHERE idade_sexo_grupo = '15_24_M'), 0)   AS is_15_24_m,
        COALESCE(SUM(peso) FILTER (WHERE idade_sexo_grupo = '15_24_F'), 0)   AS is_15_24_f,
        COALESCE(SUM(peso) FILTER (WHERE idade_sexo_grupo = '25_39_M'), 0)   AS is_25_39_m,
        COALESCE(SUM(peso) FILTER (WHERE idade_sexo_grupo = '25_39_F'), 0)   AS is_25_39_f,
        COALESCE(SUM(peso) FILTER (WHERE idade_sexo_grupo = '40_59_M'), 0)   AS is_40_59_m,
        COALESCE(SUM(peso) FILTER (WHERE idade_sexo_grupo = '40_59_F'), 0)   AS is_40_59_f,
        COALESCE(SUM(peso) FILTER (WHERE idade_sexo_grupo = '60_mais_M'), 0) AS is_60_mais_m,
        COALESCE(SUM(peso) FILTER (WHERE idade_sexo_grupo = '60_mais_F'), 0) AS is_60_mais_f,
        COALESCE(SUM(peso) FILTER (WHERE idade_sexo_grupo LIKE '%_I'), 0)    AS is_sexo_ign,
        COALESCE(SUM(peso) FILTER (WHERE interestadual), 0)                  AS interestadual,
        CAST(NULL AS DOUBLE) AS se,
        CAST(NULL AS DOUBLE) AS cv
    FROM mig GROUP BY 1, 2
) TO 'data/interim/1980/fluxos_bruto.parquet' (FORMAT PARQUET);

-- ---------- agregações territoriais (sem variância -- ver cabeçalho) ----------
CREATE OR REPLACE TEMP VIEW mig_geo AS
    SELECT m.*, ro.cd_rgi AS o_rgi, rd.cd_rgi AS d_rgi,
                ro.cd_rgint AS o_rgint, rd.cd_rgint AS d_rgint,
                ro.uf AS o_uf, rd.uf AS d_uf
    FROM mig m
    JOIN ref ro ON ro.cd_mun = m.df_mun
    JOIN ref rd ON rd.cd_mun = m.cd_mun;

COPY (
    SELECT o_rgi AS origem, d_rgi AS destino, SUM(peso) total,
           COUNT(*) n, CAST(NULL AS BIGINT) ndom,
           CAST(NULL AS DOUBLE) AS se, CAST(NULL AS DOUBLE) AS cv
    FROM mig_geo WHERE o_rgi <> d_rgi GROUP BY 1, 2
) TO 'data/interim/1980/fluxos_rgi_bruto.parquet' (FORMAT PARQUET);

COPY (
    SELECT o_rgint AS origem, d_rgint AS destino, SUM(peso) total,
           COUNT(*) n, CAST(NULL AS BIGINT) ndom,
           CAST(NULL AS DOUBLE) AS se, CAST(NULL AS DOUBLE) AS cv
    FROM mig_geo WHERE o_rgint <> d_rgint GROUP BY 1, 2
) TO 'data/interim/1980/fluxos_rgint_bruto.parquet' (FORMAT PARQUET);

COPY (
    SELECT o_uf AS origem, d_uf AS destino, SUM(peso) total,
           COUNT(*) n, CAST(NULL AS BIGINT) ndom,
           CAST(NULL AS DOUBLE) AS se, CAST(NULL AS DOUBLE) AS cv
    FROM mig_geo WHERE o_uf <> d_uf GROUP BY 1, 2
) TO 'data/interim/1980/fluxos_uf_bruto.parquet' (FORMAT PARQUET);
