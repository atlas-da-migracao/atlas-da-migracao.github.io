-- F2b: Recortes metropolitanos, migração intrametropolitana e o cruzamento entre
-- migração intra-RM e deslocamento pendular (a pergunta da desconcentração metropolitana:
-- quem se mudou do núcleo para a periferia continua trabalhando no núcleo?).
PRAGMA threads = 10;
PRAGMA memory_limit = '16GB';

CREATE OR REPLACE TEMP VIEW pes AS
    SELECT * FROM read_parquet('data/interim/pessoas_classificado.parquet');
CREATE OR REPLACE TEMP VIEW apond AS
    SELECT * FROM read_parquet('data/interim/domicilios_apond.parquet');
CREATE OR REPLACE TEMP VIEW ref AS
    SELECT * FROM read_parquet('data/interim/municipios_ref.parquet');
CREATE OR REPLACE TEMP VIEW nucleos AS
    SELECT CAST(cd_rm AS VARCHAR) AS cd_rm, CAST(cd_nucleo AS VARCHAR) AS cd_nucleo
    FROM read_csv('pipeline/rm_nucleo.csv', header = true, all_varchar = true);

-- ---------- composição das RMs/RIDEs ----------
CREATE OR REPLACE TEMP TABLE rm AS
SELECT r.cd_rm, r.nm_rm,
       CASE WHEN r.nm_rm ILIKE '%Integrada de Desenvolvimento%' THEN 'RIDE' ELSE 'RM' END AS tipo,
       r.cd_mun, r.nm_mun, r.uf_sigla,
       (r.cd_mun = n.cd_nucleo) AS nucleo,
       m.pop
FROM ref r
JOIN nucleos n USING (cd_rm)
LEFT JOIN read_parquet('data/interim/municipios_bruto.parquet') m USING (cd_mun)
WHERE r.cd_rm IS NOT NULL;

COPY (SELECT * FROM rm) TO 'data/interim/rm_bruto.parquet' (FORMAT PARQUET);

-- ---------- migrantes intrametropolitanos ----------
-- origem e destino na MESMA região metropolitana
CREATE OR REPLACE TEMP VIEW mig_rm AS
SELECT p.*, ro.cd_rm, ro.nucleo AS origem_nucleo, rd.nucleo AS destino_nucleo, nu.cd_nucleo
FROM pes p
JOIN rm ro ON ro.cd_mun = p.df_mun
JOIN rm rd ON rd.cd_mun = p.cd_mun AND rd.cd_rm = ro.cd_rm
JOIN nucleos nu ON nu.cd_rm = ro.cd_rm
WHERE p.origem_valida;

-- fluxos intra-RM com a tipologia núcleo/periferia
CREATE OR REPLACE TEMP TABLE var_intra AS
WITH hh AS (
    SELECT controle, cd_rm, df_mun AS origem, cd_mun AS destino, cd_apond, SUM(peso) AS z
    FROM mig_rm GROUP BY 1, 2, 3, 4, 5
), ap AS (
    SELECT cd_rm, origem, destino, cd_apond, SUM(z) s1, SUM(z * z) s2 FROM hh GROUP BY 1, 2, 3, 4
)
SELECT ap.cd_rm, ap.origem, ap.destino,
       SUM(CASE WHEN a.n_h > 1 THEN a.n_h / (a.n_h - 1.0) * (ap.s2 - ap.s1 * ap.s1 / a.n_h) ELSE 0 END) AS v
FROM ap JOIN apond a USING (cd_apond) GROUP BY 1, 2, 3;

COPY (
    WITH base AS (
        SELECT cd_rm, df_mun AS origem, cd_mun AS destino,
               CASE WHEN origem_nucleo AND NOT destino_nucleo THEN 'nucleo_periferia'
                    WHEN NOT origem_nucleo AND destino_nucleo THEN 'periferia_nucleo'
                    ELSE 'periferia_periferia' END AS tipologia,
               SUM(peso) AS total, COUNT(*) AS n, COUNT(DISTINCT controle) AS ndom
        FROM mig_rm GROUP BY 1, 2, 3, 4
    )
    SELECT b.*, SQRT(GREATEST(COALESCE(v.v, 0), 0)) AS se,
           CASE WHEN b.total > 0 THEN 100.0 * SQRT(GREATEST(COALESCE(v.v, 0), 0)) / b.total END AS cv
    FROM base b LEFT JOIN var_intra v ON v.cd_rm = b.cd_rm AND v.origem = b.origem AND v.destino = b.destino
) TO 'data/interim/rm_fluxos_intra_bruto.parquet' (FORMAT PARQUET);

-- ---------- CRUZAMENTO: migrantes intra-RM que fazem deslocamento pendular ----------
-- Tripla "morava em (2017) -> mora em (2022) -> trabalha em (2022)".
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
           SUM(peso) AS total, COUNT(*) AS n, COUNT(DISTINCT controle) AS ndom,
           100.0 * COALESCE(SUM(peso) FILTER (WHERE retorna_3dias = '1'), 0) / SUM(peso) AS pct_diario,
           100.0 * COALESCE(SUM(peso) FILTER (WHERE modo_grupo IN ('onibus_van_brt','trem_metro')), 0)
                 / SUM(peso) AS pct_coletivo
    FROM mig_rm_ocup GROUP BY 1, 2, 3, 4, 5
) TO 'data/interim/rm_mig_pendular_bruto.parquet' (FORMAT PARQUET);

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
               MEDIAN(tempo_desloc_min) FILTER (WHERE pendular_trab)     AS tempo_mediano
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
) TO 'data/interim/rm_mig_pendular_resumo_bruto.parquet' (FORMAT PARQUET);

-- tripla equivalente para estudo
COPY (
    SELECT cd_rm, df_mun AS origem_mig, cd_mun AS destino_mig,
           CASE WHEN pendular_estudo THEN estudo_mun ELSE NULL END AS destino_estudo,
           CASE WHEN pendular_estudo AND estudo_mun = df_mun    THEN 'origem'
                WHEN pendular_estudo AND estudo_mun = cd_nucleo THEN 'nucleo'
                WHEN pendular_estudo                            THEN 'outro'
                ELSE 'proprio' END AS classe_estudo,
           SUM(peso) AS total, COUNT(*) AS n, COUNT(DISTINCT controle) AS ndom
    FROM mig_rm WHERE estudante GROUP BY 1, 2, 3, 4, 5
) TO 'data/interim/rm_mig_estudo_bruto.parquet' (FORMAT PARQUET);

-- ---------- resumo por região metropolitana ----------
COPY (
    WITH pop_rm AS (
        SELECT r.cd_rm, SUM(m.pop) AS pop, COUNT(*) AS n_municipios
        FROM rm r JOIN read_parquet('data/interim/municipios_bruto.parquet') m USING (cd_mun)
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
               MEDIAN(p.tempo_desloc_min) FILTER (WHERE p.ocupado AND p.pendular_trab) AS tempo_mediano,
               100.0 * SUM(p.peso) FILTER (WHERE p.ocupado AND p.pendular_trab
                                           AND p.modo_grupo IN ('onibus_van_brt','trem_metro'))
                     / NULLIF(SUM(p.peso) FILTER (WHERE p.ocupado AND p.pendular_trab), 0) AS pct_coletivo,
               100.0 * SUM(p.peso) FILTER (WHERE p.ocupado AND p.pendular_trab AND p.retorna_3dias = '1')
                     / NULLIF(SUM(p.peso) FILTER (WHERE p.ocupado AND p.pendular_trab), 0) AS pct_diario
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
    JOIN (SELECT CAST(cd_rm AS VARCHAR) cd_rm, nm_nucleo FROM read_csv('pipeline/rm_nucleo.csv', header=true, all_varchar=true)) rn USING (cd_rm)
    LEFT JOIN pop_rm p USING (cd_rm)
    LEFT JOIN intra i USING (cd_rm)
    LEFT JOIN externo e USING (cd_rm)
    LEFT JOIN saidas s USING (cd_rm)
    LEFT JOIN pend pd USING (cd_rm)
) TO 'data/interim/rm_resumo_bruto.parquet' (FORMAT PARQUET);
