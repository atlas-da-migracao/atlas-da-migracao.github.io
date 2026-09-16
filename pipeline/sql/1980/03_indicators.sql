-- F2 (edição Censo 1980): Indicadores municipais de migração (proxy de data fixa
-- 1975->1980, ver 02_classify.sql/CABECALHO ponto 1).
--
-- Override de pipeline/sql/03_indicators.sql -- MESMA lógica de imigração/emigração por
-- município e por dimensão (status/edu/renda/idade_sexo), mas SEM estimador de variância: não
-- existe chave de domicílio em 1980 (numero_ordem é a ordem da pessoa, não um identificador --
-- ver MAPEAMENTO §8/§11 e CABECALHO_02_classify.txt ponto 11), então
-- data/interim/1980/domicilios_apond.parquet NÃO é gerado, e o estimador de conglomerados
-- últimos (que trataria cada pessoa como independente sem a UPA, SUBESTIMANDO a variância --
-- erro anticonservador) não é aplicado. se/cv gravados como CAST(NULL AS DOUBLE) direto, sem
-- tentar calcular. ndom (contagem de domicílios distintos) também não tem sentido sem chave de
-- domicílio -- CAST(NULL AS BIGINT) explícito.
--
-- ATENÇÃO (corrigido em F9.5): ndom NULL NÃO é "tolerado" a jusante da mesma forma que se/cv NULL.
-- se/cv NULL viram precisao='sem_estimativa' e seguem; ndom NULL entra em PREDICADO de revelação
-- (R1 exigia `ndom >= 3`), e `NULL >= 3` nunca é verdadeiro -- se nada fosse feito, TODA linha de
-- fluxos/pendular/RM seria descartada em silêncio. A solução não é ler a coluna nula: é a edição
-- declarar `chave_domicilio = False` em pipeline/edicoes.py, o que faz
-- disclosure_rules.limiares() devolver R1 sem piso de domicílios e com pisos de pessoas mais
-- altos (n >= 20 para a linha, n >= 50 para o detalhe), calibrados contra as edições que têm a
-- chave. publish.py e disclosure_check.py montam todos os predicados a partir desse objeto e
-- nunca comparam ndom nesta edição. Ver docs/METODOLOGIA.md, item 8.2 da seção do Censo 1980.
PRAGMA threads = 10;
PRAGMA memory_limit = '16GB';

CREATE OR REPLACE TEMP VIEW pes AS
    SELECT * FROM read_parquet('data/interim/1980/pessoas_classificado.parquet');
CREATE OR REPLACE TEMP VIEW ref AS
    SELECT * FROM read_parquet('data/interim/1980/municipios_ref.parquet');

-- ---------- estimativas pontuais (sem variância -- ver cabeçalho) ----------
CREATE OR REPLACE TEMP TABLE pop AS
    SELECT cd_mun, SUM(peso) AS pop, SUM(peso) FILTER (WHERE idade >= 5) AS pop5
    FROM pes GROUP BY cd_mun;

CREATE OR REPLACE TEMP TABLE t_imig AS
    SELECT cd_mun, SUM(peso) AS imig, COUNT(*) AS n_imig
    FROM pes WHERE origem_valida GROUP BY cd_mun;

CREATE OR REPLACE TEMP TABLE t_imig_ni AS
    SELECT cd_mun, SUM(peso) AS imig_ni, COUNT(*) AS n_imig_ni
    FROM pes WHERE is_mig_interno AND NOT origem_valida GROUP BY cd_mun;

CREATE OR REPLACE TEMP TABLE t_imig_int AS
    SELECT cd_mun, SUM(peso) AS imig_int, COUNT(*) AS n_imig_int
    FROM pes WHERE is_mig_internacional GROUP BY cd_mun;

CREATE OR REPLACE TEMP TABLE t_emig AS
    SELECT df_mun AS cd_mun, SUM(peso) AS emig, COUNT(*) AS n_emig
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
        CAST(NULL AS BIGINT)          AS ndom_imig,  -- sem chave de domicílio (§8/§11)
        CAST(NULL AS BIGINT)          AS ndom_emig,  -- idem
        COALESCE(ni.n_imig_ni, 0)     AS n_imig_ni,
        COALESCE(it.n_imig_int, 0)    AS n_imig_int,
        -- taxas por mil habitantes de 5 anos ou mais
        CASE WHEN p.pop5 > 0 THEN 1000.0 * COALESCE(i.imig, 0) / p.pop5 END          AS tbi,
        CASE WHEN p.pop5 > 0 THEN 1000.0 * COALESCE(e.emig, 0) / p.pop5 END          AS tbe,
        CASE WHEN p.pop5 > 0 THEN 1000.0 * (COALESCE(i.imig, 0) - COALESCE(e.emig, 0)) / p.pop5 END AS tlm,
        CASE WHEN COALESCE(i.imig, 0) + COALESCE(e.emig, 0) > 0
             THEN (COALESCE(i.imig, 0) - COALESCE(e.emig, 0)) / (COALESCE(i.imig, 0) + COALESCE(e.emig, 0)) END AS iem,
        -- sem estimador de variância nesta edição (ver cabeçalho) -- se/cv NULL explícito
        CAST(NULL AS DOUBLE)          AS se_imig,
        CAST(NULL AS DOUBLE)          AS se_emig,
        CAST(NULL AS DOUBLE)          AS se_saldo,
        CAST(NULL AS DOUBLE)          AS cv_imig,
        CAST(NULL AS DOUBLE)          AS cv_emig
    FROM ref r
    LEFT JOIN pop p          USING (cd_mun)
    LEFT JOIN t_imig i       USING (cd_mun)
    LEFT JOIN t_imig_ni ni   USING (cd_mun)
    LEFT JOIN t_imig_int it  USING (cd_mun)
    LEFT JOIN t_emig e       USING (cd_mun)
) TO 'data/interim/1980/municipios_bruto.parquet' (FORMAT PARQUET);

-- ---------- perfis por dimensão (formato longo, pré-revelação) ----------
-- direcao: imig (migrantes internos com origem conhecida que chegaram ao município),
--          emig (que saíram dele), residente (não migrantes).
-- ndom: CAST(NULL AS BIGINT) em toda a tabela (sem chave de domicílio, ver cabeçalho).
COPY (
    WITH imig AS (
        SELECT cd_mun, 'imig' AS direcao, status AS categoria, 'status' AS dimensao,
               SUM(peso) AS valor, COUNT(*) AS n, CAST(NULL AS BIGINT) AS ndom
        FROM pes WHERE origem_valida GROUP BY 1, 3
        UNION ALL
        SELECT cd_mun, 'imig', edu_grupo, 'edu', SUM(peso), COUNT(*), CAST(NULL AS BIGINT)
        FROM pes WHERE origem_valida AND idade >= 25 GROUP BY 1, 3
        UNION ALL
        SELECT cd_mun, 'imig', renda_classe, 'renda', SUM(peso), COUNT(*), CAST(NULL AS BIGINT)
        FROM pes WHERE origem_valida GROUP BY 1, 3
        UNION ALL
        SELECT cd_mun, 'imig', idade_sexo_grupo, 'idade_sexo', SUM(peso), COUNT(*), CAST(NULL AS BIGINT)
        FROM pes WHERE origem_valida AND idade_sexo_grupo IS NOT NULL GROUP BY 1, 3
    ), emig AS (
        SELECT df_mun AS cd_mun, 'emig' AS direcao, status AS categoria, 'status' AS dimensao,
               SUM(peso) AS valor, COUNT(*) AS n, CAST(NULL AS BIGINT) AS ndom
        FROM pes WHERE origem_valida GROUP BY 1, 3
        UNION ALL
        SELECT df_mun, 'emig', edu_grupo, 'edu', SUM(peso), COUNT(*), CAST(NULL AS BIGINT)
        FROM pes WHERE origem_valida AND idade >= 25 GROUP BY 1, 3
        UNION ALL
        SELECT df_mun, 'emig', renda_classe, 'renda', SUM(peso), COUNT(*), CAST(NULL AS BIGINT)
        FROM pes WHERE origem_valida GROUP BY 1, 3
        UNION ALL
        SELECT df_mun, 'emig', idade_sexo_grupo, 'idade_sexo', SUM(peso), COUNT(*), CAST(NULL AS BIGINT)
        FROM pes WHERE origem_valida AND idade_sexo_grupo IS NOT NULL GROUP BY 1, 3
    ), residente AS (
        SELECT cd_mun, 'residente' AS direcao, edu_grupo AS categoria, 'edu' AS dimensao,
               SUM(peso) AS valor, COUNT(*) AS n, CAST(NULL AS BIGINT) AS ndom
        FROM pes WHERE NOT is_migrante AND idade >= 25 GROUP BY 1, 3
        UNION ALL
        SELECT cd_mun, 'residente', renda_classe, 'renda', SUM(peso), COUNT(*), CAST(NULL AS BIGINT)
        FROM pes WHERE NOT is_migrante GROUP BY 1, 3
        UNION ALL
        SELECT cd_mun, 'residente', idade_sexo_grupo, 'idade_sexo', SUM(peso), COUNT(*), CAST(NULL AS BIGINT)
        FROM pes WHERE NOT is_migrante AND idade_sexo_grupo IS NOT NULL GROUP BY 1, 3
    )
    SELECT * FROM imig UNION ALL SELECT * FROM emig UNION ALL SELECT * FROM residente
) TO 'data/interim/1980/municipios_dim_bruto.parquet' (FORMAT PARQUET);
