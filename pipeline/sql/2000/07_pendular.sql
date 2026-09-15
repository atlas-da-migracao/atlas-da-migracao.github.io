-- F2b (edição Censo 2000): Deslocamento pendular para trabalho e para estudo.
-- Override de pipeline/sql/07_pendular.sql -- idêntico na estrutura, exceto nos pontos onde
-- o questionário de 2000 é mais pobre que o de 2010 (ver MAPEAMENTO_02_classify.md §11 e
-- docs/METODOLOGIA.md, "Edição Censo 2000 e comparabilidade"):
--   1. `pendular_trab_dim_bruto` tem SEIS dimensões -- posicao, setor, ocupacao, renda_trab,
--      edu, idade_sexo --, SEM modo (já ausente em 2010), SEM frequencia e SEM tempo (as
--      duas últimas existem em 2010 e não em 2000): o Censo 2000 tem um único quesito de
--      deslocamento (4.27, "em que município trabalha ou estuda") e não pergunta meio de
--      transporte, frequência de retorno nem tempo gasto. Publicar uma dimensão cujas
--      categorias seriam todas 'ignorado'/'nao_se_aplica' sugeriria dado que não existe.
--   2. `pendular_estudo_dim_bruto` mantém as duas dimensões de sempre (`nivel`, `idade_sexo`)
--      -- `nivel` inclui a categoria `pre_vestibular`, exclusiva de 2000 (curso_grupo, ver
--      02_classify.sql).
--   3. `tempo_mediano`, `pct_diario` e `pct_coletivo`: sempre `CAST(NULL AS DOUBLE)`
--      explícito -- 2000 não tem NENHUM quesito de frequência/tempo/transporte (diferente de
--      2010, que tinha `pct_diario` via `retorna_3dias`/V0661). Gravado explícito, não por
--      efeito colateral do agregador sobre colunas que já vêm NULL de 02_classify.sql.
--
-- Universos: trabalho = pessoas ocupadas de 10 anos ou mais (cascata V0439..V0443 = 1);
--            estudo   = pessoas que frequentam escola (V0429 IN ('1','2')), NÃO ocupadas
--            (universo mais estreito que trabalho -- ver 01_extract.sql §3: quem trabalha E
--            estuda em municípios diferentes só é capturado no fluxo de trabalho).
-- Fluxo o->d: trabalha/estuda em outro município do Brasil, com destino conhecido e <> residência.
-- Não existem em 2000 os equivalentes de trab_local='1' (em casa/propriedade) nem ='5' (mais
-- de um município) -- ver 01_extract.sql e MAPEAMENTO §3.
-- Variância: mesmo estimador de conglomerados últimos de 03_indicators.sql.
PRAGMA threads = 10;
PRAGMA memory_limit = '16GB';

CREATE OR REPLACE TEMP VIEW pes AS
    SELECT * FROM read_parquet('data/interim/2000/pessoas_classificado.parquet');
CREATE OR REPLACE TEMP VIEW apond AS
    SELECT * FROM read_parquet('data/interim/2000/domicilios_apond.parquet');
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
               CAST(NULL AS DOUBLE) AS tempo_mediano,  -- inexistente em 2000 (sem tempo de deslocamento)
               CAST(NULL AS DOUBLE) AS pct_diario,     -- inexistente em 2000 (sem frequência de retorno)
               CAST(NULL AS DOUBLE) AS pct_coletivo    -- inexistente em 2000 (sem meio de transporte)
        FROM pt GROUP BY 1, 2
    )
    SELECT b.*, SQRT(GREATEST(COALESCE(v.v, 0), 0)) AS se,
           CASE WHEN b.total > 0 THEN 100.0 * SQRT(GREATEST(COALESCE(v.v, 0), 0)) / b.total END AS cv
    FROM base b LEFT JOIN var_pt v ON v.origem = b.origem AND v.destino = b.destino
) TO 'data/interim/2000/pendular_trab_bruto.parquet' (FORMAT PARQUET);

-- caracterização em formato longo (6 dimensões -- sem "frequencia"/"modo"/"tempo", nenhuma
-- delas existe em 2000, ver cabeçalho acima)
COPY (
    SELECT cd_mun AS origem, trab_mun AS destino, 'posicao' AS dimensao, COALESCE(pos_grupo, 'ignorado') AS categoria,
           SUM(peso) AS valor, COUNT(*) AS n, COUNT(DISTINCT controle) AS ndom
    FROM pt GROUP BY 1, 2, 4
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
) TO 'data/interim/2000/pendular_trab_dim_bruto.parquet' (FORMAT PARQUET);

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
) TO 'data/interim/2000/pendular_estudo_bruto.parquet' (FORMAT PARQUET);

COPY (
    SELECT cd_mun AS origem, estudo_mun AS destino, 'nivel' AS dimensao,
           COALESCE(curso_grupo, 'ignorado') AS categoria,
           SUM(peso) AS valor, COUNT(*) AS n, COUNT(DISTINCT controle) AS ndom
    FROM pe GROUP BY 1, 2, 4
    UNION ALL
    SELECT cd_mun, estudo_mun, 'idade_sexo', idade_sexo_grupo,
           SUM(peso), COUNT(*), COUNT(DISTINCT controle) FROM pe
    WHERE idade_sexo_grupo IS NOT NULL GROUP BY 1, 2, 4
) TO 'data/interim/2000/pendular_estudo_dim_bruto.parquet' (FORMAT PARQUET);

-- ================= indicadores pendulares por município =================
COPY (
    WITH res AS (   -- residentes: ocupados, estudantes e quem sai
        SELECT cd_mun,
               SUM(peso) FILTER (WHERE ocupado)                       AS ocupados,
               SUM(peso) FILTER (WHERE ocupado AND pendular_trab)     AS saida_trab,
               COUNT(*)  FILTER (WHERE ocupado AND pendular_trab)     AS n_saida_trab,
               SUM(peso) FILTER (WHERE ocupado AND trab_local IN ('1','2'))  AS trabalha_no_mun,
               SUM(peso) FILTER (WHERE ocupado AND trab_local = '5')  AS varios_municipios, -- categoria inexistente em 2000, sempre 0
               SUM(peso) FILTER (WHERE ocupado AND trab_local = '4')  AS trabalha_exterior,
               SUM(peso) FILTER (WHERE estudante)                     AS estudantes,
               SUM(peso) FILTER (WHERE estudante AND pendular_estudo) AS saida_estudo,
               CAST(NULL AS DOUBLE) AS tempo_mediano,       -- inexistente em 2000
               CAST(NULL AS DOUBLE) AS pct_retorno_diario,  -- inexistente em 2000
               CAST(NULL AS DOUBLE) AS pct_coletivo         -- inexistente em 2000
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
           r.pct_coletivo                     AS pct_coletivo
    FROM res r
    LEFT JOIN ent e USING (cd_mun)
    LEFT JOIN ent_e ee USING (cd_mun)
) TO 'data/interim/2000/municipios_pendular_bruto.parquet' (FORMAT PARQUET);
