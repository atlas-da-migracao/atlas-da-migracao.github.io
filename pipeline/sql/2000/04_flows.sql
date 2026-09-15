-- F2 (edição Censo 2000): Matriz de fluxos migratórios origem->destino (data fixa 1995->2000)
-- com caracterização por status, escolaridade (25+), renda domiciliar per capita e idade/sexo,
-- e erro-padrão por fluxo (mesmo estimador de conglomerados de 03_indicators.sql).
-- Universo: migração interna com origem conhecida e origem <> destino (origem_valida).
--
-- Override de pipeline/sql/04_flows.sql -- idêntico a pipeline/sql/2010/04_flows.sql (mesma
-- caracterização por status: 3 colunas -- st_retorno_natal, st_nao_natural,
-- st_nascido_exterior --, não 4, porque `primeira_saida`/`etapas_multiplas` são
-- indistinguíveis nesta edição -- o Censo 2000 também não coleta o município de nascimento
-- (4.21 pergunta só UF ou país, V4210) -- ver pipeline/sql/2000/02_classify.sql e
-- docs/METODOLOGIA.md). Só os paths mudam, para data/interim/2000/.
PRAGMA threads = 10;
PRAGMA memory_limit = '16GB';

CREATE OR REPLACE TEMP VIEW mig AS
    SELECT * FROM read_parquet('data/interim/2000/pessoas_classificado.parquet') WHERE origem_valida;
CREATE OR REPLACE TEMP VIEW apond AS
    SELECT * FROM read_parquet('data/interim/2000/domicilios_apond.parquet');
CREATE OR REPLACE TEMP VIEW ref AS
    SELECT * FROM read_parquet('data/interim/2000/municipios_ref.parquet');

-- ---------- variância por par origem->destino ----------
CREATE OR REPLACE TEMP TABLE var_fluxo AS
WITH hh AS (
    SELECT controle, df_mun AS origem, cd_mun AS destino, cd_apond, SUM(peso) AS z
    FROM mig GROUP BY 1, 2, 3, 4
), ap AS (
    SELECT origem, destino, cd_apond, SUM(z) AS s1, SUM(z * z) AS s2 FROM hh GROUP BY 1, 2, 3
)
SELECT ap.origem, ap.destino,
       SUM(CASE WHEN a.n_h > 1 THEN a.n_h / (a.n_h - 1.0) * (ap.s2 - ap.s1 * ap.s1 / a.n_h) ELSE 0 END) AS var_total
FROM ap JOIN apond a USING (cd_apond) GROUP BY 1, 2;

-- ---------- fluxos municipais ----------
COPY (
    WITH base AS (
        SELECT
            df_mun AS origem, cd_mun AS destino,
            SUM(peso) AS total, COUNT(*) AS n, COUNT(DISTINCT controle) AS ndom,
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
            COALESCE(SUM(peso) FILTER (WHERE interestadual), 0)                  AS interestadual
        FROM mig GROUP BY 1, 2
    )
    SELECT b.*,
           SQRT(GREATEST(COALESCE(v.var_total, 0), 0))                              AS se,
           CASE WHEN b.total > 0 THEN 100.0 * SQRT(GREATEST(COALESCE(v.var_total, 0), 0)) / b.total END AS cv
    FROM base b LEFT JOIN var_fluxo v ON v.origem = b.origem AND v.destino = b.destino
) TO 'data/interim/2000/fluxos_bruto.parquet' (FORMAT PARQUET);

-- ---------- agregações territoriais (variância recalculada em cada nível) ----------
CREATE OR REPLACE TEMP VIEW mig_geo AS
    SELECT m.*, ro.cd_rgi AS o_rgi, rd.cd_rgi AS d_rgi,
                ro.cd_rgint AS o_rgint, rd.cd_rgint AS d_rgint,
                ro.uf AS o_uf, rd.uf AS d_uf
    FROM mig m
    JOIN ref ro ON ro.cd_mun = m.df_mun
    JOIN ref rd ON rd.cd_mun = m.cd_mun;

COPY (
    WITH hh AS (
        SELECT controle, o_rgi AS origem, d_rgi AS destino, cd_apond, SUM(peso) AS z
        FROM mig_geo WHERE o_rgi <> d_rgi GROUP BY 1, 2, 3, 4
    ), ap AS (
        SELECT origem, destino, cd_apond, SUM(z) s1, SUM(z * z) s2 FROM hh GROUP BY 1, 2, 3
    ), var AS (
        SELECT ap.origem, ap.destino,
               SUM(CASE WHEN a.n_h > 1 THEN a.n_h / (a.n_h - 1.0) * (ap.s2 - ap.s1 * ap.s1 / a.n_h) ELSE 0 END) AS v
        FROM ap JOIN apond a USING (cd_apond) GROUP BY 1, 2
    ), base AS (
        SELECT o_rgi AS origem, d_rgi AS destino, SUM(peso) total,
               COUNT(*) n, COUNT(DISTINCT controle) ndom
        FROM mig_geo WHERE o_rgi <> d_rgi GROUP BY 1, 2
    )
    SELECT b.*, SQRT(GREATEST(COALESCE(v.v, 0), 0)) AS se,
           CASE WHEN b.total > 0 THEN 100.0 * SQRT(GREATEST(COALESCE(v.v, 0), 0)) / b.total END AS cv
    FROM base b LEFT JOIN var v ON v.origem = b.origem AND v.destino = b.destino
) TO 'data/interim/2000/fluxos_rgi_bruto.parquet' (FORMAT PARQUET);

COPY (
    WITH hh AS (
        SELECT controle, o_rgint AS origem, d_rgint AS destino, cd_apond, SUM(peso) AS z
        FROM mig_geo WHERE o_rgint <> d_rgint GROUP BY 1, 2, 3, 4
    ), ap AS (
        SELECT origem, destino, cd_apond, SUM(z) s1, SUM(z * z) s2 FROM hh GROUP BY 1, 2, 3
    ), var AS (
        SELECT ap.origem, ap.destino,
               SUM(CASE WHEN a.n_h > 1 THEN a.n_h / (a.n_h - 1.0) * (ap.s2 - ap.s1 * ap.s1 / a.n_h) ELSE 0 END) AS v
        FROM ap JOIN apond a USING (cd_apond) GROUP BY 1, 2
    ), base AS (
        SELECT o_rgint AS origem, d_rgint AS destino, SUM(peso) total,
               COUNT(*) n, COUNT(DISTINCT controle) ndom
        FROM mig_geo WHERE o_rgint <> d_rgint GROUP BY 1, 2
    )
    SELECT b.*, SQRT(GREATEST(COALESCE(v.v, 0), 0)) AS se,
           CASE WHEN b.total > 0 THEN 100.0 * SQRT(GREATEST(COALESCE(v.v, 0), 0)) / b.total END AS cv
    FROM base b LEFT JOIN var v ON v.origem = b.origem AND v.destino = b.destino
) TO 'data/interim/2000/fluxos_rgint_bruto.parquet' (FORMAT PARQUET);

COPY (
    WITH hh AS (
        SELECT controle, o_uf AS origem, d_uf AS destino, cd_apond, SUM(peso) AS z
        FROM mig_geo WHERE o_uf <> d_uf GROUP BY 1, 2, 3, 4
    ), ap AS (
        SELECT origem, destino, cd_apond, SUM(z) s1, SUM(z * z) s2 FROM hh GROUP BY 1, 2, 3
    ), var AS (
        SELECT ap.origem, ap.destino,
               SUM(CASE WHEN a.n_h > 1 THEN a.n_h / (a.n_h - 1.0) * (ap.s2 - ap.s1 * ap.s1 / a.n_h) ELSE 0 END) AS v
        FROM ap JOIN apond a USING (cd_apond) GROUP BY 1, 2
    ), base AS (
        SELECT o_uf AS origem, d_uf AS destino, SUM(peso) total,
               COUNT(*) n, COUNT(DISTINCT controle) ndom
        FROM mig_geo WHERE o_uf <> d_uf GROUP BY 1, 2
    )
    SELECT b.*, SQRT(GREATEST(COALESCE(v.v, 0), 0)) AS se,
           CASE WHEN b.total > 0 THEN 100.0 * SQRT(GREATEST(COALESCE(v.v, 0), 0)) / b.total END AS cv
    FROM base b LEFT JOIN var v ON v.origem = b.origem AND v.destino = b.destino
) TO 'data/interim/2000/fluxos_uf_bruto.parquet' (FORMAT PARQUET);
