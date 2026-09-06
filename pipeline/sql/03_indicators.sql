-- F2: Indicadores municipais de migração (data fixa 2017->2022) com erro-padrão.
--
-- Estimador de variância: conglomerados últimos, domicílio como UPA e Área de Ponderação
-- como estrato (o IBGE não divulga estratos/UPAs nos microdados da amostra).
--   Var(Y) = Σ_h n_h/(n_h-1) · Σ_{i∈h} (z_hi - z̄_h)²  , com z_hi = Σ_{k∈i} w_k·y_k
-- Como só domicílios com migrantes têm z≠0, a soma sobre TODOS os n_h domicílios do
-- estrato se reduz à forma fechada    n_h/(n_h-1) · (S2_h - S1_h²/n_h),
-- em que S1_h = Σ z_hi e S2_h = Σ z_hi² sobre os domicílios com z≠0 e n_h vem da
-- contagem total de domicílios amostrados na APOND (data/interim/domicilios_apond.parquet).
--
-- imig/emig/fluxos usam apenas `origem_valida` (migração interna com origem conhecida e
-- origem ≠ destino), o que garante a identidade Σ imigrantes = Σ emigrantes.
PRAGMA threads = 10;
PRAGMA memory_limit = '16GB';

CREATE OR REPLACE TEMP VIEW pes AS
    SELECT * FROM read_parquet('data/interim/pessoas_classificado.parquet');
CREATE OR REPLACE TEMP VIEW apond AS
    SELECT * FROM read_parquet('data/interim/domicilios_apond.parquet');
CREATE OR REPLACE TEMP VIEW ref AS
    SELECT * FROM read_parquet('data/interim/municipios_ref.parquet')
    WHERE cd_mun NOT IN ('8888888', '9999999');

-- ---------- variância da imigração (destino = município de residência) ----------
CREATE OR REPLACE TEMP TABLE var_imig AS
WITH hh AS (
    SELECT controle, cd_mun, cd_apond, SUM(peso) AS z
    FROM pes WHERE origem_valida GROUP BY 1, 2, 3
), ap AS (
    SELECT cd_mun, cd_apond, SUM(z) AS s1, SUM(z * z) AS s2
    FROM hh GROUP BY 1, 2
)
SELECT ap.cd_mun,
       SUM(CASE WHEN a.n_h > 1 THEN a.n_h / (a.n_h - 1.0) * (ap.s2 - ap.s1 * ap.s1 / a.n_h) ELSE 0 END) AS var_imig
FROM ap JOIN apond a USING (cd_apond)
GROUP BY ap.cd_mun;

-- ---------- variância da emigração (alvo = município de origem, domicílio no destino) ----------
CREATE OR REPLACE TEMP TABLE var_emig AS
WITH hh AS (
    SELECT controle, df_mun AS cd_mun, cd_apond, SUM(peso) AS z
    FROM pes WHERE origem_valida GROUP BY 1, 2, 3
), ap AS (
    SELECT cd_mun, cd_apond, SUM(z) AS s1, SUM(z * z) AS s2
    FROM hh GROUP BY 1, 2
)
SELECT ap.cd_mun,
       SUM(CASE WHEN a.n_h > 1 THEN a.n_h / (a.n_h - 1.0) * (ap.s2 - ap.s1 * ap.s1 / a.n_h) ELSE 0 END) AS var_emig
FROM ap JOIN apond a USING (cd_apond)
GROUP BY ap.cd_mun;

-- ---------- estimativas pontuais ----------
CREATE OR REPLACE TEMP TABLE pop AS
    SELECT cd_mun, SUM(peso) AS pop, SUM(peso) FILTER (WHERE idade >= 5) AS pop5
    FROM pes GROUP BY cd_mun;

CREATE OR REPLACE TEMP TABLE t_imig AS
    SELECT cd_mun, SUM(peso) AS imig, COUNT(*) AS n_imig, COUNT(DISTINCT controle) AS ndom_imig
    FROM pes WHERE origem_valida GROUP BY cd_mun;

CREATE OR REPLACE TEMP TABLE t_imig_ni AS
    SELECT cd_mun, SUM(peso) AS imig_ni, COUNT(*) AS n_imig_ni
    FROM pes WHERE is_mig_interno AND NOT origem_valida GROUP BY cd_mun;

CREATE OR REPLACE TEMP TABLE t_imig_int AS
    SELECT cd_mun, SUM(peso) AS imig_int, COUNT(*) AS n_imig_int
    FROM pes WHERE is_mig_internacional GROUP BY cd_mun;

CREATE OR REPLACE TEMP TABLE t_emig AS
    SELECT df_mun AS cd_mun, SUM(peso) AS emig, COUNT(*) AS n_emig, COUNT(DISTINCT controle) AS ndom_emig
    FROM pes WHERE origem_valida GROUP BY df_mun;

COPY (
    SELECT
        r.cd_mun, r.nm_mun, r.uf, r.uf_sigla, r.cd_rgi, r.nm_rgi, r.cd_rgint, r.nm_rgint,
        r.cd_rm, r.nm_rm, r.cd_concurb,
        COALESCE(p.pop, 0)            AS pop,
        COALESCE(p.pop5, 0)           AS pop5,
        COALESCE(i.imig, 0)           AS imig,
        COALESCE(ni.imig_ni, 0)       AS imig_ni,
        COALESCE(it.imig_int, 0)      AS imig_int,
        COALESCE(e.emig, 0)           AS emig,
        COALESCE(i.imig, 0) - COALESCE(e.emig, 0)                       AS saldo,
        COALESCE(i.n_imig, 0)         AS n_imig,
        COALESCE(e.n_emig, 0)         AS n_emig,
        COALESCE(i.ndom_imig, 0)      AS ndom_imig,
        COALESCE(e.ndom_emig, 0)      AS ndom_emig,
        COALESCE(ni.n_imig_ni, 0)     AS n_imig_ni,
        COALESCE(it.n_imig_int, 0)    AS n_imig_int,
        -- taxas por mil habitantes de 5 anos ou mais
        CASE WHEN p.pop5 > 0 THEN 1000.0 * COALESCE(i.imig, 0) / p.pop5 END          AS tbi,
        CASE WHEN p.pop5 > 0 THEN 1000.0 * COALESCE(e.emig, 0) / p.pop5 END          AS tbe,
        CASE WHEN p.pop5 > 0 THEN 1000.0 * (COALESCE(i.imig, 0) - COALESCE(e.emig, 0)) / p.pop5 END AS tlm,
        CASE WHEN COALESCE(i.imig, 0) + COALESCE(e.emig, 0) > 0
             THEN (COALESCE(i.imig, 0) - COALESCE(e.emig, 0)) / (COALESCE(i.imig, 0) + COALESCE(e.emig, 0)) END AS iem,
        -- erros-padrão e coeficientes de variação (%)
        SQRT(GREATEST(COALESCE(vi.var_imig, 0), 0))                     AS se_imig,
        SQRT(GREATEST(COALESCE(ve.var_emig, 0), 0))                     AS se_emig,
        SQRT(GREATEST(COALESCE(vi.var_imig, 0), 0) + GREATEST(COALESCE(ve.var_emig, 0), 0)) AS se_saldo,
        CASE WHEN COALESCE(i.imig, 0) > 0
             THEN 100.0 * SQRT(GREATEST(COALESCE(vi.var_imig, 0), 0)) / i.imig END   AS cv_imig,
        CASE WHEN COALESCE(e.emig, 0) > 0
             THEN 100.0 * SQRT(GREATEST(COALESCE(ve.var_emig, 0), 0)) / e.emig END   AS cv_emig
    FROM ref r
    LEFT JOIN pop p          USING (cd_mun)
    LEFT JOIN t_imig i       USING (cd_mun)
    LEFT JOIN t_imig_ni ni   USING (cd_mun)
    LEFT JOIN t_imig_int it  USING (cd_mun)
    LEFT JOIN t_emig e       USING (cd_mun)
    LEFT JOIN var_imig vi    USING (cd_mun)
    LEFT JOIN var_emig ve    USING (cd_mun)
) TO 'data/interim/municipios_bruto.parquet' (FORMAT PARQUET);

-- ---------- perfis por dimensão (formato longo, pré-revelação) ----------
-- direcao: imig (migrantes internos com origem conhecida que chegaram ao município),
--          emig (que saíram dele), residente (não migrantes).
COPY (
    WITH imig AS (
        SELECT cd_mun, 'imig' AS direcao, status AS categoria, 'status' AS dimensao,
               SUM(peso) AS valor, COUNT(*) AS n, COUNT(DISTINCT controle) AS ndom
        FROM pes WHERE origem_valida GROUP BY 1, 3
        UNION ALL
        SELECT cd_mun, 'imig', edu_grupo, 'edu', SUM(peso), COUNT(*), COUNT(DISTINCT controle)
        FROM pes WHERE origem_valida AND idade >= 25 GROUP BY 1, 3
        UNION ALL
        SELECT cd_mun, 'imig', renda_classe, 'renda', SUM(peso), COUNT(*), COUNT(DISTINCT controle)
        FROM pes WHERE origem_valida GROUP BY 1, 3
        UNION ALL
        SELECT cd_mun, 'imig', idade_sexo_grupo, 'idade_sexo', SUM(peso), COUNT(*), COUNT(DISTINCT controle)
        FROM pes WHERE origem_valida AND idade_sexo_grupo IS NOT NULL GROUP BY 1, 3
    ), emig AS (
        SELECT df_mun AS cd_mun, 'emig' AS direcao, status AS categoria, 'status' AS dimensao,
               SUM(peso) AS valor, COUNT(*) AS n, COUNT(DISTINCT controle) AS ndom
        FROM pes WHERE origem_valida GROUP BY 1, 3
        UNION ALL
        SELECT df_mun, 'emig', edu_grupo, 'edu', SUM(peso), COUNT(*), COUNT(DISTINCT controle)
        FROM pes WHERE origem_valida AND idade >= 25 GROUP BY 1, 3
        UNION ALL
        SELECT df_mun, 'emig', renda_classe, 'renda', SUM(peso), COUNT(*), COUNT(DISTINCT controle)
        FROM pes WHERE origem_valida GROUP BY 1, 3
        UNION ALL
        SELECT df_mun, 'emig', idade_sexo_grupo, 'idade_sexo', SUM(peso), COUNT(*), COUNT(DISTINCT controle)
        FROM pes WHERE origem_valida AND idade_sexo_grupo IS NOT NULL GROUP BY 1, 3
    ), residente AS (
        SELECT cd_mun, 'residente' AS direcao, edu_grupo AS categoria, 'edu' AS dimensao,
               SUM(peso) AS valor, COUNT(*) AS n, COUNT(DISTINCT controle) AS ndom
        FROM pes WHERE NOT is_migrante AND idade >= 25 GROUP BY 1, 3
        UNION ALL
        SELECT cd_mun, 'residente', renda_classe, 'renda', SUM(peso), COUNT(*), COUNT(DISTINCT controle)
        FROM pes WHERE NOT is_migrante GROUP BY 1, 3
        UNION ALL
        SELECT cd_mun, 'residente', idade_sexo_grupo, 'idade_sexo', SUM(peso), COUNT(*), COUNT(DISTINCT controle)
        FROM pes WHERE NOT is_migrante AND idade_sexo_grupo IS NOT NULL GROUP BY 1, 3
    )
    SELECT * FROM imig UNION ALL SELECT * FROM emig UNION ALL SELECT * FROM residente
) TO 'data/interim/municipios_dim_bruto.parquet' (FORMAT PARQUET);
