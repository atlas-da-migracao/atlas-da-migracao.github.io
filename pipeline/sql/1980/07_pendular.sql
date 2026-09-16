-- F2b (edição Censo 1980): Deslocamento pendular para trabalho e para estudo.
-- Override de pipeline/sql/07_pendular.sql -- modelo direto é
-- pipeline/sql/2000/07_pendular.sql (quesito único -- v527 --, trabalho precede estudo, fluxo
-- de estudo é piso), com DUAS diferenças:
--   1. SEM estimador de variância -- não há chave de domicílio em 1980 (ver
--      03_indicators.sql/CABECALHO_02_classify.txt ponto 11); se/cv gravados como
--      CAST(NULL AS DOUBLE) direto, sem apond.
--   2. `pendular_trab_dim_bruto` tem QUATRO dimensões -- setor, ocupacao, edu, idade_sexo --,
--      não seis: SEM posicao (pos_grupo é NULL em toda a edição -- v533 não distingue carteira
--      assinada, ver 02_classify.sql ponto 10) e SEM renda_trab (renda_trab_classe é NULL em
--      toda a edição -- a renda só existe no Ceará, ver 02_classify.sql ponto 7).
--      `pendular_estudo_dim_bruto` mantém as duas dimensões de sempre (nivel, idade_sexo).
--
-- Universos: trabalho = pessoas ocupadas de 10 anos ou mais (v529='0' AND idade>=10);
--            estudo   = pessoas que frequentam escola (v521 OU v522 em 1..8), NÃO ocupadas
--            (universo mais estreito que trabalho -- quem trabalha E estuda em municípios
--            diferentes só é capturado no fluxo de trabalho, mesma ressalva de 2000).
-- Fluxo o->d: trabalha/estuda em outro município do Brasil, com destino conhecido e <> residência.
-- Não existem em 1980 os equivalentes de trab_local='1' (em casa/propriedade) nem ='5' (mais
-- de um município), como em 2000 -- ver 01_extract.sql/02_classify.sql.
PRAGMA threads = 10;
PRAGMA memory_limit = '16GB';

CREATE OR REPLACE TEMP VIEW pes AS
    SELECT * FROM read_parquet('data/interim/1980/pessoas_classificado.parquet');
CREATE OR REPLACE TEMP VIEW pt AS SELECT * FROM pes WHERE ocupado AND pendular_trab;
CREATE OR REPLACE TEMP VIEW pe AS SELECT * FROM pes WHERE estudante AND pendular_estudo;

-- ================= fluxos pendulares de trabalho (sem variância -- ver cabeçalho) =================
COPY (
    SELECT cd_mun AS origem, trab_mun AS destino,
           SUM(peso) AS total, COUNT(*) AS n, CAST(NULL AS BIGINT) AS ndom,
           CAST(NULL AS DOUBLE) AS tempo_mediano,  -- sem quesito de tempo de deslocamento
           CAST(NULL AS DOUBLE) AS pct_diario,     -- sem quesito de frequência de retorno
           CAST(NULL AS DOUBLE) AS pct_coletivo,   -- sem quesito de meio de transporte
           CAST(NULL AS DOUBLE) AS se,
           CAST(NULL AS DOUBLE) AS cv
    FROM pt GROUP BY 1, 2
) TO 'data/interim/1980/pendular_trab_bruto.parquet' (FORMAT PARQUET);

-- caracterização em formato longo (QUATRO dimensões -- ver cabeçalho, ponto 2)
COPY (
    SELECT cd_mun AS origem, trab_mun AS destino, 'setor' AS dimensao, COALESCE(setor_grupo, 'ignorado') AS categoria,
           SUM(peso) AS valor, COUNT(*) AS n, CAST(NULL AS BIGINT) AS ndom
    FROM pt GROUP BY 1, 2, 4
    UNION ALL
    SELECT cd_mun, trab_mun, 'ocupacao', COALESCE(ocup_grupo, 'ignorado'),
           SUM(peso), COUNT(*), CAST(NULL AS BIGINT) FROM pt GROUP BY 1, 2, 4
    UNION ALL
    SELECT cd_mun, trab_mun, 'edu', edu_grupo,
           SUM(peso), COUNT(*), CAST(NULL AS BIGINT) FROM pt WHERE idade >= 25 GROUP BY 1, 2, 4
    UNION ALL
    SELECT cd_mun, trab_mun, 'idade_sexo', idade_sexo_grupo,
           SUM(peso), COUNT(*), CAST(NULL AS BIGINT) FROM pt
    WHERE idade_sexo_grupo IS NOT NULL GROUP BY 1, 2, 4
) TO 'data/interim/1980/pendular_trab_dim_bruto.parquet' (FORMAT PARQUET);

-- ================= fluxos pendulares de estudo (sem variância -- ver cabeçalho) =================
COPY (
    SELECT cd_mun AS origem, estudo_mun AS destino,
           SUM(peso) AS total, COUNT(*) AS n, CAST(NULL AS BIGINT) AS ndom,
           CAST(NULL AS DOUBLE) AS se,
           CAST(NULL AS DOUBLE) AS cv
    FROM pe GROUP BY 1, 2
) TO 'data/interim/1980/pendular_estudo_bruto.parquet' (FORMAT PARQUET);

COPY (
    SELECT cd_mun AS origem, estudo_mun AS destino, 'nivel' AS dimensao,
           COALESCE(curso_grupo, 'ignorado') AS categoria,
           SUM(peso) AS valor, COUNT(*) AS n, CAST(NULL AS BIGINT) AS ndom
    FROM pe GROUP BY 1, 2, 4
    UNION ALL
    SELECT cd_mun, estudo_mun, 'idade_sexo', idade_sexo_grupo,
           SUM(peso), COUNT(*), CAST(NULL AS BIGINT) FROM pe
    WHERE idade_sexo_grupo IS NOT NULL GROUP BY 1, 2, 4
) TO 'data/interim/1980/pendular_estudo_dim_bruto.parquet' (FORMAT PARQUET);

-- ================= indicadores pendulares por município =================
COPY (
    WITH res AS (   -- residentes: ocupados, estudantes e quem sai
        SELECT cd_mun,
               SUM(peso) FILTER (WHERE ocupado)                       AS ocupados,
               SUM(peso) FILTER (WHERE ocupado AND pendular_trab)     AS saida_trab,
               COUNT(*)  FILTER (WHERE ocupado AND pendular_trab)     AS n_saida_trab,
               SUM(peso) FILTER (WHERE ocupado AND trab_local IN ('1','2'))  AS trabalha_no_mun,
               SUM(peso) FILTER (WHERE ocupado AND trab_local = '5')  AS varios_municipios, -- categoria inexistente em 1980, sempre 0
               SUM(peso) FILTER (WHERE ocupado AND trab_local = '4')  AS trabalha_exterior,
               SUM(peso) FILTER (WHERE estudante)                     AS estudantes,
               SUM(peso) FILTER (WHERE estudante AND pendular_estudo) AS saida_estudo,
               CAST(NULL AS DOUBLE) AS tempo_mediano,       -- inexistente em 1980
               CAST(NULL AS DOUBLE) AS pct_retorno_diario,  -- inexistente em 1980
               CAST(NULL AS DOUBLE) AS pct_coletivo         -- inexistente em 1980
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
) TO 'data/interim/1980/municipios_pendular_bruto.parquet' (FORMAT PARQUET);
