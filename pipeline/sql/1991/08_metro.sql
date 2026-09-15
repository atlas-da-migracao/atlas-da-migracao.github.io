-- F5b (edição Censo 1991): Recortes metropolitanos e migração intrametropolitana.
-- Override de pipeline/sql/08_metro.sql.
--
-- DIVERGÊNCIA FRENTE A 2022/2010/2000: 1991 NÃO TEM DESLOCAMENTO PENDULAR (o questionário da
-- amostra não pergunta em que município a pessoa trabalha ou estuda -- ver
-- pipeline/sql/1991/MAPEAMENTO_02_classify.md §8 e pipeline/sql/1991/02_classify.sql, ponto 10
-- do cabeçalho). Consequência para este script: "RM só com migração".
--   - A view `mig_rm_ocup` (tripla origem->residência->trabalho) e as tabelas
--     `rm_mig_pendular_bruto.parquet`, `rm_mig_pendular_resumo_bruto.parquet` e
--     `rm_mig_estudo_bruto.parquet` de 2022/2010/2000 NÃO existem nesta edição -- não há
--     `trab_mun`/`estudo_mun` para construir a tripla, e publicar esses arquivos vazios ou com
--     colunas fabricadas seria pior do que não publicá-los.
--   - Dentro de `rm_resumo_bruto`, o CTE `pend` (que calculava `ocupados`, `pendulares`,
--     `pct_pendular`, `tempo_mediano`, `pct_coletivo`, `pct_diario`) é substituído por colunas
--     `CAST(NULL AS DOUBLE)` explícitas, com os MESMOS nomes e tipos das outras edições
--     (`ocupados`/`pendulares` são DOUBLE em 2022/2010/2000, vêm de ROUND(SUM(peso)) -- ver
--     achado do auditor F7.3), para manter o contrato de saída idêntico em estrutura (só os
--     valores mudam para NULL).
--   - `rm_bruto` (composição das RMs) e `rm_fluxos_intra_bruto` (migração intra-RM, tipologia
--     núcleo/periferia, entradas/saídas externas) continuam funcionando normalmente: são
--     construídos só a partir de `df_mun`/`cd_mun`/`origem_valida`, que existem em 1991 como em
--     qualquer outra edição.
--
-- Núcleo metropolitano: pipeline/rm_nucleo.csv -- mesmo arquivo, compartilhado com as edições
-- 2022/2010/2000. O recorte de RM é o de 2022 aplicado retroativamente por código de município
-- (pipeline/build_ref.py::_build_outra_edicao); municípios criados depois de 1991 não existem
-- nesta edição, então as RMs que os contêm ficam com um município a menos (81 RMs não-vazias,
-- 66 reduzidas frente a 2022 -- ver build_ref.py na execução desta edição).
PRAGMA threads = 10;
PRAGMA memory_limit = '16GB';

CREATE OR REPLACE TEMP VIEW pes AS
    SELECT * FROM read_parquet('data/interim/1991/pessoas_classificado.parquet');
CREATE OR REPLACE TEMP VIEW apond AS
    SELECT * FROM read_parquet('data/interim/1991/domicilios_apond.parquet');
CREATE OR REPLACE TEMP VIEW ref AS
    SELECT * FROM read_parquet('data/interim/1991/municipios_ref.parquet');
CREATE OR REPLACE TEMP VIEW nucleos_csv AS
    SELECT CAST(cd_rm AS VARCHAR) AS cd_rm, CAST(cd_nucleo AS VARCHAR) AS cd_nucleo
    FROM read_csv('pipeline/rm_nucleo.csv', header = true, all_varchar = true);

-- FALLBACK DE NÚCLEO PARA 1991 (achado do auditor F7.3): pipeline/rm_nucleo.csv é compartilhado
-- por todas as edições e NÃO é alterado aqui. O núcleo da RM 501 (Região Metropolitana do Sul do
-- Estado, RR) no CSV é Rorainópolis (1400472), município criado depois de 1991 -- não existe em
-- MUNICIPIOS_1991 nem em data/interim/1991/municipios_ref.parquet. Sem fallback, nenhum membro
-- desta RM bateria com cd_nucleo em 1991, e todos os pares intra-RM cairiam em
-- 'periferia_periferia' por ausência de núcleo, não porque de fato não haja um núcleo em 1991.
-- Regra de fallback: IDÊNTICA à de pipeline/build_rm_nucleo.py quando não há homônimo -- o
-- município MAIS POPULOSO (pop de municipios_bruto, desempate por cd_mun) entre os membros da RM
-- que existem na malha desta edição. Aplicada só às RMs cujo cd_nucleo do CSV está ausente em
-- 1991 (nesta edição, só a 501); as outras 80 RMs mantêm o núcleo do CSV.
-- CORREÇÃO (achado do metodólogo F7.7): `nm_nucleo` publicado em rm_resumo_bruto NÃO vem mais do
-- rótulo de pipeline/rm_nucleo.csv (que ainda diz "Rorainópolis" para a RM 501, porque o CSV é
-- compartilhado entre edições e não é alterado aqui). Em vez disso, o nome vem da mesma fonte que
-- já resolve QUAL município é o núcleo efetivo -- a view `nucleos` (com fallback) -- buscando o
-- nome em `ref` (data/interim/1991/municipios_ref.parquet), a tabela de referência desta própria
-- edição. Isso mantém "Rorainópolis" -> nome idêntico para as 80 RMs sem fallback (porque o cd_mun
-- do CSV existe em `ref` com o mesmo nome) e corrige a RM 501 para o nome do fallback
-- (São João da Baliza), não o nome do CSV.
CREATE OR REPLACE TEMP VIEW nucleos AS
WITH candidatos AS (
    SELECT r.cd_rm, r.cd_mun,
           ROW_NUMBER() OVER (PARTITION BY r.cd_rm ORDER BY m.pop DESC NULLS LAST, r.cd_mun DESC) AS rn
    FROM ref r
    LEFT JOIN read_parquet('data/interim/1991/municipios_bruto.parquet') m USING (cd_mun)
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
LEFT JOIN read_parquet('data/interim/1991/municipios_bruto.parquet') m USING (cd_mun)
WHERE r.cd_rm IS NOT NULL;

COPY (SELECT * FROM rm) TO 'data/interim/1991/rm_bruto.parquet' (FORMAT PARQUET);

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
) TO 'data/interim/1991/rm_fluxos_intra_bruto.parquet' (FORMAT PARQUET);

-- ---------- resumo por região metropolitana ----------
-- Sem o CTE `pend` (que dependia de pendular_trab/tempo_desloc_min/modo_grupo/retorna_3dias,
-- todos NULL em 1991 -- ver cabeçalho): `ocupados`, `pendulares`, `pct_pendular`,
-- `tempo_mediano`, `pct_coletivo` e `pct_diario` ficam CAST(NULL ...) explícitos, mantendo o
-- mesmo shape (mesmos nomes e tipos, incluindo DOUBLE em `ocupados`/`pendulares`) de
-- rm_resumo_bruto.parquet das outras três edições.
COPY (
    WITH pop_rm AS (
        SELECT r.cd_rm, SUM(m.pop) AS pop, COUNT(*) AS n_municipios
        FROM rm r JOIN read_parquet('data/interim/1991/municipios_bruto.parquet') m USING (cd_mun)
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
    )
    SELECT n.cd_rm, r.nm_rm, r.tipo, rn.nm_nucleo, p.n_municipios, ROUND(p.pop) AS pop,
           ROUND(COALESCE(i.mig_intra, 0))            AS mig_intra,
           ROUND(COALESCE(i.nucleo_periferia, 0))     AS nucleo_periferia,
           ROUND(COALESCE(i.periferia_nucleo, 0))     AS periferia_nucleo,
           ROUND(COALESCE(i.periferia_periferia, 0))  AS periferia_periferia,
           ROUND(COALESCE(e.entradas_externas, 0))    AS entradas_externas,
           ROUND(COALESCE(s.saidas_externas, 0))      AS saidas_externas,
           ROUND(COALESCE(e.entradas_externas, 0) - COALESCE(s.saidas_externas, 0)) AS saldo_externo,
           CAST(NULL AS DOUBLE) AS ocupados,       -- inexistente em 1991 (sem deslocamento pendular)
           CAST(NULL AS DOUBLE) AS pendulares,     -- idem -- DOUBLE, não INTEGER: mesmo tipo de
                                                    -- ocupados/pendulares em 2022/2010/2000 (ROUND(SUM(peso)))
           CAST(NULL AS DOUBLE)  AS pct_pendular,  -- idem
           CAST(NULL AS DOUBLE)  AS tempo_mediano, -- idem
           CAST(NULL AS DOUBLE)  AS pct_coletivo,  -- idem
           CAST(NULL AS DOUBLE)  AS pct_diario     -- idem
    FROM nucleos n
    JOIN (SELECT DISTINCT cd_rm, nm_rm, tipo FROM rm) r USING (cd_rm)
    LEFT JOIN (SELECT DISTINCT cd_mun, nm_mun AS nm_nucleo FROM ref) rn ON rn.cd_mun = n.cd_nucleo
    LEFT JOIN pop_rm p USING (cd_rm)
    LEFT JOIN intra i USING (cd_rm)
    LEFT JOIN externo e USING (cd_rm)
    LEFT JOIN saidas s USING (cd_rm)
) TO 'data/interim/1991/rm_resumo_bruto.parquet' (FORMAT PARQUET);
