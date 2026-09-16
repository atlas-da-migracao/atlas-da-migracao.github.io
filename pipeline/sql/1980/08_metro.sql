-- F5b (edição Censo 1980): Recortes metropolitanos, migração intrametropolitana e o cruzamento
-- entre migração intra-RM e deslocamento pendular.
-- Override de pipeline/sql/08_metro.sql -- modelo é pipeline/sql/2000/08_metro.sql (RM +
-- cruzamento pendular, já que 1980 TEM deslocamento pendular, diferente de 1991) combinado com
-- o fallback de núcleo de pipeline/sql/1991/08_metro.sql, com TRÊS diferenças:
--   1. SEM estimador de variância -- não há chave de domicílio em 1980 (ver
--      03_indicators.sql/CABECALHO_02_classify.txt ponto 11); se/cv gravados como
--      CAST(NULL AS DOUBLE) direto, sem apond nem var_intra.
--   2. `tempo_mediano`, `pct_diario`, `pct_coletivo`: sempre CAST(NULL AS DOUBLE) explícito --
--      1980 não tem quesito de tempo de deslocamento, frequência de retorno nem meio de
--      transporte (ver 02_classify.sql pontos 9-10).
--   3. FALLBACK DE NÚCLEO (igual a 1991): pipeline/rm_nucleo.csv é compartilhado entre todas as
--      edições e não é alterado aqui. Nem toda RM de 2022 tem o município-núcleo existindo em
--      1980 -- em especial, municípios que hoje são núcleo de RM mas foram criados depois de
--      1980, ou que caem no território do atual Tocantins (excluído desta edição, ver
--      01_extract.sql/02_classify.sql ponto 4). Regra de fallback: IDÊNTICA à de
--      pipeline/build_rm_nucleo.py quando não há homônimo -- o município MAIS POPULOSO (pop de
--      municipios_bruto, desempate por cd_mun) entre os membros da RM que existem na malha
--      desta edição. `nm_nucleo` publicado em rm_resumo_bruto vem da mesma fonte que resolve
--      qual município é o núcleo efetivo (a view `nucleos`, com fallback), buscando o nome em
--      `ref` (data/interim/1980/municipios_ref.parquet) -- não do rótulo estático do CSV.
PRAGMA threads = 10;
PRAGMA memory_limit = '16GB';

CREATE OR REPLACE TEMP VIEW pes AS
    SELECT * FROM read_parquet('data/interim/1980/pessoas_classificado.parquet');
CREATE OR REPLACE TEMP VIEW ref AS
    SELECT * FROM read_parquet('data/interim/1980/municipios_ref.parquet');
CREATE OR REPLACE TEMP VIEW nucleos_csv AS
    SELECT CAST(cd_rm AS VARCHAR) AS cd_rm, CAST(cd_nucleo AS VARCHAR) AS cd_nucleo
    FROM read_csv('pipeline/rm_nucleo.csv', header = true, all_varchar = true);

-- FALLBACK DE NÚCLEO (ver cabeçalho, ponto 3): quando o cd_nucleo do CSV não existe na malha de
-- 1980 (não está em `ref`), usa o município mais populoso entre os membros da RM que existem
-- nesta edição, desempate por cd_mun.
CREATE OR REPLACE TEMP VIEW nucleos AS
WITH candidatos AS (
    SELECT r.cd_rm, r.cd_mun,
           ROW_NUMBER() OVER (PARTITION BY r.cd_rm ORDER BY m.pop DESC NULLS LAST, r.cd_mun DESC) AS rn
    FROM ref r
    LEFT JOIN read_parquet('data/interim/1980/municipios_bruto.parquet') m USING (cd_mun)
), fallback AS (
    SELECT cd_rm, cd_mun AS cd_nucleo_fallback FROM candidatos WHERE rn = 1
)
SELECT nc.cd_rm,
       CASE
           WHEN EXISTS (SELECT 1 FROM ref r WHERE r.cd_rm = nc.cd_rm AND r.cd_mun = nc.cd_nucleo)
               THEN nc.cd_nucleo
           ELSE f.cd_nucleo_fallback
       END AS cd_nucleo
FROM nucleos_csv nc
LEFT JOIN fallback f USING (cd_rm);

-- ---------- composição das RMs/RIDEs ----------
CREATE OR REPLACE TEMP TABLE rm AS
SELECT r.cd_rm, r.nm_rm,
       CASE WHEN r.nm_rm ILIKE '%Integrada de Desenvolvimento%' THEN 'RIDE' ELSE 'RM' END AS tipo,
       r.cd_mun, r.nm_mun, r.uf_sigla,
       (r.cd_mun = n.cd_nucleo) AS nucleo,
       m.pop
FROM ref r
JOIN nucleos n USING (cd_rm)
LEFT JOIN read_parquet('data/interim/1980/municipios_bruto.parquet') m USING (cd_mun)
WHERE r.cd_rm IS NOT NULL;

COPY (SELECT * FROM rm) TO 'data/interim/1980/rm_bruto.parquet' (FORMAT PARQUET);

-- ---------- migrantes intrametropolitanos ----------
-- origem e destino na MESMA região metropolitana
CREATE OR REPLACE TEMP VIEW mig_rm AS
SELECT p.*, ro.cd_rm, ro.nucleo AS origem_nucleo, rd.nucleo AS destino_nucleo, nu.cd_nucleo
FROM pes p
JOIN rm ro ON ro.cd_mun = p.df_mun
JOIN rm rd ON rd.cd_mun = p.cd_mun AND rd.cd_rm = ro.cd_rm
JOIN nucleos nu ON nu.cd_rm = ro.cd_rm
WHERE p.origem_valida;

-- fluxos intra-RM com a tipologia núcleo/periferia (sem variância -- ver cabeçalho)
COPY (
    SELECT cd_rm, df_mun AS origem, cd_mun AS destino,
           CASE WHEN origem_nucleo AND NOT destino_nucleo THEN 'nucleo_periferia'
                WHEN NOT origem_nucleo AND destino_nucleo THEN 'periferia_nucleo'
                ELSE 'periferia_periferia' END AS tipologia,
           SUM(peso) AS total, COUNT(*) AS n, CAST(NULL AS BIGINT) AS ndom,
           CAST(NULL AS DOUBLE) AS se, CAST(NULL AS DOUBLE) AS cv
    FROM mig_rm GROUP BY 1, 2, 3, 4
) TO 'data/interim/1980/rm_fluxos_intra_bruto.parquet' (FORMAT PARQUET);

-- ---------- CRUZAMENTO: migrantes intra-RM que fazem deslocamento pendular ----------
-- Tripla "morava em (proxy, ~1975) -> mora em (1980) -> trabalha em (1980)".
-- Classes: origem (voltou a trabalhar no município de onde saiu), nucleo (trabalha no núcleo),
-- outro (outro município), proprio (trabalha onde mora), varios, exterior.
CREATE OR REPLACE TEMP VIEW mig_rm_ocup AS
SELECT *,
       CASE
           WHEN pendular_trab AND trab_mun = df_mun     THEN 'origem'
           WHEN pendular_trab AND trab_mun = cd_nucleo  THEN 'nucleo'
           WHEN pendular_trab                            THEN 'outro'
           WHEN trab_local IN ('1', '2')                 THEN 'proprio'
           WHEN trab_local = '5'                         THEN 'varios'
           WHEN trab_local = '4'                         THEN 'exterior'
           ELSE 'nao_informado'
       END AS classe_trab,
       CASE WHEN pendular_trab THEN trab_mun ELSE NULL END AS destino_trab
FROM mig_rm WHERE ocupado;

COPY (
    SELECT cd_rm, df_mun AS origem_mig, cd_mun AS destino_mig, destino_trab, classe_trab,
           SUM(peso) AS total, COUNT(*) AS n, CAST(NULL AS BIGINT) AS ndom,
           CAST(NULL AS DOUBLE) AS pct_diario,   -- sem quesito de frequência de retorno
           CAST(NULL AS DOUBLE) AS pct_coletivo  -- sem quesito de meio de transporte
    FROM mig_rm_ocup GROUP BY 1, 2, 3, 4, 5
) TO 'data/interim/1980/rm_mig_pendular_bruto.parquet' (FORMAT PARQUET);

-- resumo por RM e município de residência
COPY (
    WITH m AS (
        SELECT cd_rm, cd_mun,
               SUM(peso) FILTER (WHERE TRUE)                             AS migrantes_intra,
               COUNT(*)                                                  AS n_migrantes_intra
        FROM mig_rm GROUP BY 1, 2
    ), o AS (
        SELECT cd_rm, cd_mun,
               SUM(peso)                                                 AS mig_ocupados,
               SUM(peso) FILTER (WHERE pendular_trab)                    AS mig_pendulares,
               COUNT(*)  FILTER (WHERE pendular_trab)                    AS n_mig_pendulares,
               SUM(peso) FILTER (WHERE classe_trab = 'origem')           AS pendular_para_origem,
               SUM(peso) FILTER (WHERE classe_trab = 'nucleo')           AS pendular_para_nucleo,
               SUM(peso) FILTER (WHERE classe_trab = 'outro')            AS pendular_para_outro,
               SUM(peso) FILTER (WHERE classe_trab = 'proprio')          AS trabalha_onde_mora,
               CAST(NULL AS DOUBLE)                                      AS tempo_mediano  -- inexistente em 1980
        FROM mig_rm_ocup GROUP BY 1, 2
    ), e AS (
        SELECT cd_rm, cd_mun,
               SUM(peso) FILTER (WHERE estudante)                        AS mig_estudantes,
               SUM(peso) FILTER (WHERE estudante AND pendular_estudo)    AS mig_estud_pendulares
        FROM mig_rm GROUP BY 1, 2
    )
    SELECT m.cd_rm, m.cd_mun,
           COALESCE(m.migrantes_intra, 0)       AS migrantes_intra,
           COALESCE(m.n_migrantes_intra, 0)     AS n_migrantes_intra,
           COALESCE(o.mig_ocupados, 0)          AS mig_ocupados,
           COALESCE(o.mig_pendulares, 0)        AS mig_pendulares,
           COALESCE(o.n_mig_pendulares, 0)      AS n_mig_pendulares,
           COALESCE(o.pendular_para_origem, 0)  AS pendular_para_origem,
           COALESCE(o.pendular_para_nucleo, 0)  AS pendular_para_nucleo,
           COALESCE(o.pendular_para_outro, 0)   AS pendular_para_outro,
           COALESCE(o.trabalha_onde_mora, 0)    AS trabalha_onde_mora,
           ROUND(o.tempo_mediano, 1)            AS tempo_mediano,
           COALESCE(e.mig_estudantes, 0)        AS mig_estudantes,
           COALESCE(e.mig_estud_pendulares, 0)  AS mig_estud_pendulares,
           CASE WHEN o.mig_ocupados > 0 THEN 100.0 * COALESCE(o.mig_pendulares, 0) / o.mig_ocupados END
                                                AS pct_pendular
    FROM m LEFT JOIN o USING (cd_rm, cd_mun) LEFT JOIN e USING (cd_rm, cd_mun)
) TO 'data/interim/1980/rm_mig_pendular_resumo_bruto.parquet' (FORMAT PARQUET);

-- tripla equivalente para estudo
COPY (
    SELECT cd_rm, df_mun AS origem_mig, cd_mun AS destino_mig,
           CASE WHEN pendular_estudo THEN estudo_mun ELSE NULL END AS destino_estudo,
           CASE WHEN pendular_estudo AND estudo_mun = df_mun    THEN 'origem'
                WHEN pendular_estudo AND estudo_mun = cd_nucleo THEN 'nucleo'
                WHEN pendular_estudo                            THEN 'outro'
                ELSE 'proprio' END AS classe_estudo,
           SUM(peso) AS total, COUNT(*) AS n, CAST(NULL AS BIGINT) AS ndom
    FROM mig_rm WHERE estudante GROUP BY 1, 2, 3, 4, 5
) TO 'data/interim/1980/rm_mig_estudo_bruto.parquet' (FORMAT PARQUET);

-- ---------- resumo por região metropolitana ----------
COPY (
    WITH pop_rm AS (
        SELECT r.cd_rm, SUM(m.pop) AS pop, COUNT(*) AS n_municipios
        FROM rm r JOIN read_parquet('data/interim/1980/municipios_bruto.parquet') m USING (cd_mun)
        GROUP BY 1
    ), intra AS (
        SELECT cd_rm, SUM(peso) AS mig_intra,
               SUM(peso) FILTER (WHERE origem_nucleo AND NOT destino_nucleo) AS nucleo_periferia,
               SUM(peso) FILTER (WHERE NOT origem_nucleo AND destino_nucleo) AS periferia_nucleo,
               SUM(peso) FILTER (WHERE NOT origem_nucleo AND NOT destino_nucleo) AS periferia_periferia
        FROM mig_rm GROUP BY 1
    ), externo AS (   -- trocas da RM com o resto do país
        SELECT r.cd_rm,
               SUM(p.peso) FILTER (WHERE p.origem_valida AND ro.cd_rm IS DISTINCT FROM r.cd_rm) AS entradas_externas
        FROM pes p JOIN rm r ON r.cd_mun = p.cd_mun
        LEFT JOIN rm ro ON ro.cd_mun = p.df_mun
        GROUP BY 1
    ), saidas AS (
        SELECT r.cd_rm,
               SUM(p.peso) FILTER (WHERE p.origem_valida AND rd.cd_rm IS DISTINCT FROM r.cd_rm) AS saidas_externas
        FROM pes p JOIN rm r ON r.cd_mun = p.df_mun
        LEFT JOIN rm rd ON rd.cd_mun = p.cd_mun
        GROUP BY 1
    ), pend AS (
        SELECT r.cd_rm,
               SUM(p.peso) FILTER (WHERE p.ocupado)                    AS ocupados,
               SUM(p.peso) FILTER (WHERE p.ocupado AND p.pendular_trab) AS pendulares,
               CAST(NULL AS DOUBLE)                                     AS tempo_mediano,  -- inexistente em 1980
               CAST(NULL AS DOUBLE)                                     AS pct_coletivo,   -- inexistente em 1980
               CAST(NULL AS DOUBLE)                                     AS pct_diario      -- inexistente em 1980
        FROM pes p JOIN rm r ON r.cd_mun = p.cd_mun GROUP BY 1
    )
    SELECT n.cd_rm, r.nm_rm, r.tipo, rn.nm_nucleo, p.n_municipios, ROUND(p.pop) AS pop,
           ROUND(COALESCE(i.mig_intra, 0))            AS mig_intra,
           ROUND(COALESCE(i.nucleo_periferia, 0))     AS nucleo_periferia,
           ROUND(COALESCE(i.periferia_nucleo, 0))     AS periferia_nucleo,
           ROUND(COALESCE(i.periferia_periferia, 0))  AS periferia_periferia,
           ROUND(COALESCE(e.entradas_externas, 0))    AS entradas_externas,
           ROUND(COALESCE(s.saidas_externas, 0))      AS saidas_externas,
           ROUND(COALESCE(e.entradas_externas, 0) - COALESCE(s.saidas_externas, 0)) AS saldo_externo,
           ROUND(COALESCE(pd.ocupados, 0))            AS ocupados,
           ROUND(COALESCE(pd.pendulares, 0))          AS pendulares,
           ROUND(100.0 * COALESCE(pd.pendulares, 0) / NULLIF(pd.ocupados, 0), 1) AS pct_pendular,
           ROUND(pd.tempo_mediano, 1)                 AS tempo_mediano,
           ROUND(pd.pct_coletivo, 1)                  AS pct_coletivo,
           ROUND(pd.pct_diario, 1)                    AS pct_diario
    FROM nucleos n
    JOIN (SELECT DISTINCT cd_rm, nm_rm, tipo FROM rm) r USING (cd_rm)
    LEFT JOIN (SELECT DISTINCT cd_mun, nm_mun AS nm_nucleo FROM ref) rn ON rn.cd_mun = n.cd_nucleo
    LEFT JOIN pop_rm p USING (cd_rm)
    LEFT JOIN intra i USING (cd_rm)
    LEFT JOIN externo e USING (cd_rm)
    LEFT JOIN saidas s USING (cd_rm)
    LEFT JOIN pend pd USING (cd_rm)
) TO 'data/interim/1980/rm_resumo_bruto.parquet' (FORMAT PARQUET);
