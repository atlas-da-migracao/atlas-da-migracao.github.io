-- F2b: Deslocamento pendular para trabalho e para estudo (Censo 2022, semana de referência).
--
-- Universos: trabalho = pessoas ocupadas de 10 anos ou mais (P0960 = 1);
--            estudo   = pessoas que frequentam escola ou creche (P0650 = 1).
-- Fluxo o->d: trabalha/estuda em outro município do Brasil, com destino conhecido e <> residência.
-- P1120 = 4 (outro país) e = 5 (mais de um município) não têm destino: entram apenas como
-- categorias nos indicadores municipais, nunca na matriz de fluxos.
-- Variância: mesmo estimador de conglomerados últimos de 03_indicators.sql.
PRAGMA threads = 10;
PRAGMA memory_limit = '16GB';

CREATE OR REPLACE TEMP VIEW pes AS
    SELECT * FROM read_parquet('data/interim/pessoas_classificado.parquet');
CREATE OR REPLACE TEMP VIEW apond AS
    SELECT * FROM read_parquet('data/interim/domicilios_apond.parquet');
CREATE OR REPLACE TEMP VIEW pt AS SELECT * FROM pes WHERE ocupado AND pendular_trab;
CREATE OR REPLACE TEMP VIEW pe AS SELECT * FROM pes WHERE estudante AND pendular_estudo;

-- ================= fluxos pendulares de trabalho =================
CREATE OR REPLACE TEMP TABLE var_pt AS
WITH hh AS (
    SELECT controle, cd_mun AS origem, trab_mun AS destino, cd_apond, SUM(peso) AS z
    FROM pt GROUP BY 1, 2, 3, 4
), ap AS (
    SELECT origem, destino, cd_apond, SUM(z) s1, SUM(z * z) s2 FROM hh GROUP BY 1, 2, 3
)
SELECT ap.origem, ap.destino,
       SUM(CASE WHEN a.n_h > 1 THEN a.n_h / (a.n_h - 1.0) * (ap.s2 - ap.s1 * ap.s1 / a.n_h) ELSE 0 END) AS v
FROM ap JOIN apond a USING (cd_apond) GROUP BY 1, 2;

COPY (
    WITH base AS (
        SELECT cd_mun AS origem, trab_mun AS destino,
               SUM(peso) AS total, COUNT(*) AS n, COUNT(DISTINCT controle) AS ndom,
               MEDIAN(tempo_desloc_min) AS tempo_mediano,
               100.0 * COALESCE(SUM(peso) FILTER (WHERE retorna_3dias = '1'), 0) / SUM(peso) AS pct_diario,
               100.0 * COALESCE(SUM(peso) FILTER (WHERE modo_grupo IN ('onibus_van_brt', 'trem_metro')), 0)
                     / SUM(peso) AS pct_coletivo
        FROM pt GROUP BY 1, 2
    )
    SELECT b.*, SQRT(GREATEST(COALESCE(v.v, 0), 0)) AS se,
           CASE WHEN b.total > 0 THEN 100.0 * SQRT(GREATEST(COALESCE(v.v, 0), 0)) / b.total END AS cv
    FROM base b LEFT JOIN var_pt v ON v.origem = b.origem AND v.destino = b.destino
) TO 'data/interim/pendular_trab_bruto.parquet' (FORMAT PARQUET);

-- caracterização em formato longo (9 dimensões)
COPY (
    SELECT cd_mun AS origem, trab_mun AS destino, 'frequencia' AS dimensao,
           CASE retorna_3dias WHEN '1' THEN 'retorno_diario' WHEN '2' THEN 'semanal_longa'
                              ELSE 'ignorado' END AS categoria,
           SUM(peso) AS valor, COUNT(*) AS n, COUNT(DISTINCT controle) AS ndom
    FROM pt GROUP BY 1, 2, 4
    UNION ALL
    SELECT cd_mun, trab_mun, 'modo', COALESCE(modo_grupo, 'ignorado'),
           SUM(peso), COUNT(*), COUNT(DISTINCT controle) FROM pt GROUP BY 1, 2, 4
    UNION ALL
    SELECT cd_mun, trab_mun, 'tempo',
           CASE tempo_desloc_cat WHEN '0' THEN 'nao_se_desloca' WHEN '1' THEN 'ate_5min'
                WHEN '2' THEN 'de_6_a_15min' WHEN '3' THEN 'de_16_a_30min'
                WHEN '4' THEN 'de_31min_a_1h' WHEN '5' THEN 'de_1_a_2h'
                WHEN '6' THEN 'de_2_a_4h' WHEN '7' THEN 'mais_de_4h' ELSE 'ignorado' END,
           SUM(peso), COUNT(*), COUNT(DISTINCT controle) FROM pt GROUP BY 1, 2, 4
    UNION ALL
    SELECT cd_mun, trab_mun, 'posicao', COALESCE(pos_grupo, 'ignorado'),
           SUM(peso), COUNT(*), COUNT(DISTINCT controle) FROM pt GROUP BY 1, 2, 4
    UNION ALL
    SELECT cd_mun, trab_mun, 'setor', COALESCE(setor_grupo, 'ignorado'),
           SUM(peso), COUNT(*), COUNT(DISTINCT controle) FROM pt GROUP BY 1, 2, 4
    UNION ALL
    SELECT cd_mun, trab_mun, 'ocupacao', COALESCE(ocup_grupo, 'ignorado'),
           SUM(peso), COUNT(*), COUNT(DISTINCT controle) FROM pt GROUP BY 1, 2, 4
    UNION ALL
    SELECT cd_mun, trab_mun, 'renda_trab', renda_trab_classe,
           SUM(peso), COUNT(*), COUNT(DISTINCT controle) FROM pt GROUP BY 1, 2, 4
    UNION ALL
    SELECT cd_mun, trab_mun, 'edu', edu_grupo,
           SUM(peso), COUNT(*), COUNT(DISTINCT controle) FROM pt WHERE idade >= 25 GROUP BY 1, 2, 4
    UNION ALL
    SELECT cd_mun, trab_mun, 'idade_sexo', idade_sexo_grupo,
           SUM(peso), COUNT(*), COUNT(DISTINCT controle) FROM pt
    WHERE idade_sexo_grupo IS NOT NULL GROUP BY 1, 2, 4
) TO 'data/interim/pendular_trab_dim_bruto.parquet' (FORMAT PARQUET);

-- ================= fluxos pendulares de estudo =================
CREATE OR REPLACE TEMP TABLE var_pe AS
WITH hh AS (
    SELECT controle, cd_mun AS origem, estudo_mun AS destino, cd_apond, SUM(peso) AS z
    FROM pe GROUP BY 1, 2, 3, 4
), ap AS (
    SELECT origem, destino, cd_apond, SUM(z) s1, SUM(z * z) s2 FROM hh GROUP BY 1, 2, 3
)
SELECT ap.origem, ap.destino,
       SUM(CASE WHEN a.n_h > 1 THEN a.n_h / (a.n_h - 1.0) * (ap.s2 - ap.s1 * ap.s1 / a.n_h) ELSE 0 END) AS v
FROM ap JOIN apond a USING (cd_apond) GROUP BY 1, 2;

COPY (
    WITH base AS (
        SELECT cd_mun AS origem, estudo_mun AS destino,
               SUM(peso) AS total, COUNT(*) AS n, COUNT(DISTINCT controle) AS ndom
        FROM pe GROUP BY 1, 2
    )
    SELECT b.*, SQRT(GREATEST(COALESCE(v.v, 0), 0)) AS se,
           CASE WHEN b.total > 0 THEN 100.0 * SQRT(GREATEST(COALESCE(v.v, 0), 0)) / b.total END AS cv
    FROM base b LEFT JOIN var_pe v ON v.origem = b.origem AND v.destino = b.destino
) TO 'data/interim/pendular_estudo_bruto.parquet' (FORMAT PARQUET);

COPY (
    SELECT cd_mun AS origem, estudo_mun AS destino, 'nivel' AS dimensao,
           COALESCE(curso_grupo, 'ignorado') AS categoria,
           SUM(peso) AS valor, COUNT(*) AS n, COUNT(DISTINCT controle) AS ndom
    FROM pe GROUP BY 1, 2, 4
    UNION ALL
    SELECT cd_mun, estudo_mun, 'idade_sexo', idade_sexo_grupo,
           SUM(peso), COUNT(*), COUNT(DISTINCT controle) FROM pe
    WHERE idade_sexo_grupo IS NOT NULL GROUP BY 1, 2, 4
) TO 'data/interim/pendular_estudo_dim_bruto.parquet' (FORMAT PARQUET);

-- ================= indicadores pendulares por município =================
COPY (
    WITH res AS (   -- residentes: ocupados, estudantes e quem sai
        SELECT cd_mun,
               SUM(peso) FILTER (WHERE ocupado)                       AS ocupados,
               SUM(peso) FILTER (WHERE ocupado AND pendular_trab)     AS saida_trab,
               COUNT(*)  FILTER (WHERE ocupado AND pendular_trab)     AS n_saida_trab,
               SUM(peso) FILTER (WHERE ocupado AND trab_local IN ('1','2'))  AS trabalha_no_mun,
               SUM(peso) FILTER (WHERE ocupado AND trab_local = '5')  AS varios_municipios,
               SUM(peso) FILTER (WHERE ocupado AND trab_local = '4')  AS trabalha_exterior,
               SUM(peso) FILTER (WHERE estudante)                     AS estudantes,
               SUM(peso) FILTER (WHERE estudante AND pendular_estudo) AS saida_estudo,
               MEDIAN(tempo_desloc_min) FILTER (WHERE ocupado AND pendular_trab) AS tempo_mediano,
               100.0 * SUM(peso) FILTER (WHERE ocupado AND pendular_trab AND retorna_3dias = '1')
                     / NULLIF(SUM(peso) FILTER (WHERE ocupado AND pendular_trab), 0) AS pct_retorno_diario,
               100.0 * SUM(peso) FILTER (WHERE ocupado AND pendular_trab
                                         AND modo_grupo IN ('onibus_van_brt','trem_metro'))
                     / NULLIF(SUM(peso) FILTER (WHERE ocupado AND pendular_trab), 0) AS pct_coletivo
        FROM pes GROUP BY cd_mun
    ), ent AS (     -- entradas: quem vem trabalhar/estudar aqui
        SELECT trab_mun AS cd_mun, SUM(peso) AS entrada_trab, COUNT(*) AS n_entrada_trab
        FROM pt GROUP BY 1
    ), ent_e AS (
        SELECT estudo_mun AS cd_mun, SUM(peso) AS entrada_estudo FROM pe GROUP BY 1
    )
    SELECT r.cd_mun,
           COALESCE(r.ocupados, 0)            AS ocupados,
           COALESCE(r.estudantes, 0)          AS estudantes,
           COALESCE(r.saida_trab, 0)          AS saida_trab,
           COALESCE(e.entrada_trab, 0)        AS entrada_trab,
           COALESCE(e.entrada_trab, 0) - COALESCE(r.saida_trab, 0)  AS saldo_pendular,
           COALESCE(r.saida_estudo, 0)        AS saida_estudo,
           COALESCE(ee.entrada_estudo, 0)     AS entrada_estudo,
           COALESCE(r.varios_municipios, 0)   AS varios_municipios,
           COALESCE(r.trabalha_exterior, 0)   AS trabalha_exterior,
           COALESCE(r.n_saida_trab, 0)        AS n_saida_trab,
           COALESCE(e.n_entrada_trab, 0)      AS n_entrada_trab,
           CASE WHEN r.ocupados > 0 THEN 100.0 * COALESCE(r.saida_trab, 0) / r.ocupados END AS taxa_saida_pendular,
           CASE WHEN r.ocupados > 0
                THEN (COALESCE(r.trabalha_no_mun, 0) + COALESCE(e.entrada_trab, 0)) / r.ocupados END AS indice_atracao,
           ROUND(r.tempo_mediano, 1)          AS tempo_mediano,
           ROUND(r.pct_retorno_diario, 1)     AS pct_retorno_diario,
           ROUND(r.pct_coletivo, 1)           AS pct_coletivo
    FROM res r
    LEFT JOIN ent e USING (cd_mun)
    LEFT JOIN ent_e ee USING (cd_mun)
) TO 'data/interim/municipios_pendular_bruto.parquet' (FORMAT PARQUET);
