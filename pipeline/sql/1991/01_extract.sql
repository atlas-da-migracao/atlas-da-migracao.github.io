-- F2 (edição Censo 1991): Extração das 27 UFs (arquivo único, sem Domicílios separados) para
-- Parquet intermediário. Override de pipeline/sql/01_extract.sql.
--
-- Ver pipeline/sql/1991/MAPEAMENTO_02_classify.md (armadilhas de layout, §0-§9) e
-- pipeline/sql/1991/CABECALHO_02_classify.txt para a justificativa completa de cada decisão.
-- Resumo das armadilhas que importam a este script:
--   - `controle` JÁ VEM CORRIGIDO nos 27 TXT de data/interim/1991/raw_txt/ -- 9 dígitos, nas
--     posições 493-501 de cada linha de 501 bytes (492 de dados dBase III + 9 de controle
--     reconstruído por scripts/prep_1991.py, já corrigido e já rodado). NÃO recalcular via
--     contador de PESSOAN aqui -- só ler a posição.
--   - PESO (223,12) já traz o ponto decimal -- TRY_CAST direto, SEM dividir por 1e7.
--   - Campos numéricos do dBase III vêm alinhados à direita com espaços -- todo código passa
--     por TRIM/LPAD antes de comparar ou juntar.
--   - cd_mun do arquivo tem 6 dígitos (UFNUM || MUNICNUM); o código de 7 dígitos do contrato
--     vem de um JOIN com municipios_ref.parquet pelos 6 primeiros dígitos da chave de 7.
--   - df_mun usa MIMO86UF || MIMO86MU (nunca UFNUM || MIMO86MU) -- MIMO86MU é o município
--     DENTRO da UF de origem, não da UF de residência atual.
--   - Sentinelas de NSA/ignorado têm larguras diferentes por variável: RPRINCIV (454,7) usa
--     9999998/9999999 (7 dígitos); RDOMICIV (236,9) usa 999999998/999999999 (9 dígitos).
--   - 1991 não usa sentinela de UF/município desconhecidos no espaço de códigos -- df_uf e
--     df_mun ficam NULL quando a origem não é informada ('54', '99', MIMO86MU='0000').
--   - Um arquivo só: ESPECIE/SITSET/RDOMICIV/PESO vêm replicados em cada linha de pessoa. Não
--     há domicilios.parquet; domicilios_apond.parquet (denominador do estimador de variância)
--     é agregado diretamente de pessoas.parquet por cd_apond, COUNT(DISTINCT controle).
PRAGMA threads = 10;
PRAGMA memory_limit = '16GB';

-- MIUFPAIS (sequencial 1-27) -> código IBGE de UF. pipeline/labels_1991.UF_SEQ_1991. Não cobre
-- '29' (Brasil sem especificação) nem >= '30' (país estrangeiro) de propósito -- tratados à
-- parte no CASE que usa esta macro (nasc_uf fica NULL nesses dois casos).
CREATE OR REPLACE MACRO uf_seq_1991(seq) AS (
    CASE seq
        WHEN '01' THEN '11' WHEN '02' THEN '12' WHEN '03' THEN '13' WHEN '04' THEN '14'
        WHEN '05' THEN '15' WHEN '06' THEN '16' WHEN '07' THEN '17' WHEN '08' THEN '21'
        WHEN '09' THEN '22' WHEN '10' THEN '23' WHEN '11' THEN '24' WHEN '12' THEN '25'
        WHEN '13' THEN '26' WHEN '14' THEN '27' WHEN '15' THEN '28' WHEN '16' THEN '29'
        WHEN '17' THEN '31' WHEN '18' THEN '32' WHEN '19' THEN '33' WHEN '20' THEN '35'
        WHEN '21' THEN '41' WHEN '22' THEN '42' WHEN '23' THEN '43' WHEN '24' THEN '50'
        WHEN '25' THEN '51' WHEN '26' THEN '52' WHEN '27' THEN '53'
    END
);

-- ---------- linhas brutas: 27 caminhos EXPLÍCITOS (a pasta não tem lixo, mas o padrão do
-- projeto -- 2000/2010 -- é sempre listar, nunca glob). ----------
CREATE OR REPLACE TEMP VIEW pessoas_linhas AS
    SELECT linha FROM read_csv('data/interim/1991/raw_txt/CD91AMOUP11.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
    UNION ALL
    SELECT linha FROM read_csv('data/interim/1991/raw_txt/CD91AMOUP12.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
    UNION ALL
    SELECT linha FROM read_csv('data/interim/1991/raw_txt/CD91AMOUP13.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
    UNION ALL
    SELECT linha FROM read_csv('data/interim/1991/raw_txt/CD91AMOUP14.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
    UNION ALL
    SELECT linha FROM read_csv('data/interim/1991/raw_txt/CD91AMOUP15.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
    UNION ALL
    SELECT linha FROM read_csv('data/interim/1991/raw_txt/CD91AMOUP16.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
    UNION ALL
    SELECT linha FROM read_csv('data/interim/1991/raw_txt/CD91AMOUP17.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
    UNION ALL
    SELECT linha FROM read_csv('data/interim/1991/raw_txt/CD91AMOUP21.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
    UNION ALL
    SELECT linha FROM read_csv('data/interim/1991/raw_txt/CD91AMOUP22.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
    UNION ALL
    SELECT linha FROM read_csv('data/interim/1991/raw_txt/CD91AMOUP23.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
    UNION ALL
    SELECT linha FROM read_csv('data/interim/1991/raw_txt/CD91AMOUP24.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
    UNION ALL
    SELECT linha FROM read_csv('data/interim/1991/raw_txt/CD91AMOUP25.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
    UNION ALL
    SELECT linha FROM read_csv('data/interim/1991/raw_txt/CD91AMOUP26.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
    UNION ALL
    SELECT linha FROM read_csv('data/interim/1991/raw_txt/CD91AMOUP27.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
    UNION ALL
    SELECT linha FROM read_csv('data/interim/1991/raw_txt/CD91AMOUP28.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
    UNION ALL
    SELECT linha FROM read_csv('data/interim/1991/raw_txt/CD91AMOUP29.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
    UNION ALL
    SELECT linha FROM read_csv('data/interim/1991/raw_txt/CD91AMOUP31.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
    UNION ALL
    SELECT linha FROM read_csv('data/interim/1991/raw_txt/CD91AMOUP32.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
    UNION ALL
    SELECT linha FROM read_csv('data/interim/1991/raw_txt/CD91AMOUP33.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
    UNION ALL
    SELECT linha FROM read_csv('data/interim/1991/raw_txt/CD91AMOUP35.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
    UNION ALL
    SELECT linha FROM read_csv('data/interim/1991/raw_txt/CD91AMOUP41.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
    UNION ALL
    SELECT linha FROM read_csv('data/interim/1991/raw_txt/CD91AMOUP42.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
    UNION ALL
    SELECT linha FROM read_csv('data/interim/1991/raw_txt/CD91AMOUP43.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
    UNION ALL
    SELECT linha FROM read_csv('data/interim/1991/raw_txt/CD91AMOUP50.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
    UNION ALL
    SELECT linha FROM read_csv('data/interim/1991/raw_txt/CD91AMOUP51.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
    UNION ALL
    SELECT linha FROM read_csv('data/interim/1991/raw_txt/CD91AMOUP52.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
    UNION ALL
    SELECT linha FROM read_csv('data/interim/1991/raw_txt/CD91AMOUP53.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'});

-- ---------- dicionário de municípios (chave de 7 dígitos, prefixo de 6 para o join) ----------
CREATE OR REPLACE TEMP VIEW muni_lookup AS
    SELECT cd_mun, SUBSTR(cd_mun, 1, 6) AS prefixo6
    FROM read_parquet('data/interim/1991/municipios_ref.parquet');

-- ---------- campos brutos (uma SUBSTR por variável, referenciados por nome a seguir) ----------
CREATE OR REPLACE TEMP VIEW pessoas_campos AS
    SELECT
        TRIM(SUBSTR(linha, 41, 2))                                        AS uf,
        LPAD(TRIM(SUBSTR(linha, 170, 4)), 4, '0')                         AS municnum,
        TRIM(SUBSTR(linha, 174, 1))                                       AS sitset,
        TRIM(SUBSTR(linha, 493, 9))                                       AS controle,
        TRY_CAST(NULLIF(TRIM(SUBSTR(linha, 223, 12)), '') AS DOUBLE)      AS peso,
        TRY_CAST(NULLIF(TRIM(SUBSTR(linha, 484, 1)), '') AS INTEGER)      AS sexo,
        TRY_CAST(NULLIF(TRIM(SUBSTR(linha, 373, 3)), '') AS INTEGER)      AS idade,
        TRIM(SUBSTR(linha, 397, 2))                                       AS mimo86uf,
        LPAD(TRIM(SUBSTR(linha, 393, 4)), 4, '0')                         AS mimo86mu,
        TRIM(SUBSTR(linha, 402, 1))                                       AS minascmu,
        LPAD(TRIM(SUBSTR(linha, 403, 2)), 2, '0')                         AS miufpais,
        NULLIF(NULLIF(TRIM(SUBSTR(linha, 401, 1)), ''), '0')              AS nacionalidade,
        LPAD(TRIM(SUBSTR(linha, 303, 2)), 2, '0')                         AS edanoest,
        TRIM(SUBSTR(linha, 454, 7))                                       AS rprinciv,
        TRIM(SUBSTR(linha, 236, 9))                                       AS rdomiciv,
        TRY_CAST(NULLIF(TRIM(SUBSTR(linha, 414, 2)), '') AS INTEGER)      AS parendom,
        TRIM(SUBSTR(linha, 214, 1))                                       AS especie,
        LPAD(TRIM(SUBSTR(linha, 420, 2)), 2, '0')                         AS posocup,
        TRIM(SUBSTR(linha, 308, 1))                                       AS edgrau,
        TRIM(SUBSTR(linha, 305, 1))                                       AS edcursns
    FROM pessoas_linhas;

-- ---------- pessoas.parquet ----------
COPY (
    SELECT
        uf, cd_mun, cd_apond, controle, peso, sexo, idade,
        df_local, df_uf, df_mun,
        nasc_local, nasc_uf, nacionalidade,
        nivel_instr_4, anos_estudo,
        renda_trab, renda_dom, parendom, tipo_domicilio,
        ocupado_10, freq_escolar
    FROM (
        SELECT
            c.uf,
            m1.cd_mun                                                     AS cd_mun,
            m1.cd_mun || CASE WHEN c.sitset IN ('1', '2', '3') THEN 'U' ELSE 'R' END
                                                                           AS cd_apond,
            c.controle, c.peso, c.sexo, c.idade,

            -- df_local: vocabulário de P0600/2022. Branco/'0'/'70' ("neste município") = não
            -- migrante; '80' (país estrangeiro/mal definido) = internacional; qualquer outro
            -- valor preenchido = migrante interno (inclui '54' Brasil s/ especificação e '99'
            -- ignorado, que ficam sem origem_conhecida a jusante). Ver MAPEAMENTO §2.2.
            CASE
                WHEN c.mimo86uf IN ('', '0', '70') THEN '1'
                WHEN c.mimo86uf = '80'             THEN '3'
                ELSE '2'
            END                                                            AS df_local,

            -- df_uf/df_mun: NULL (não sentinela) quando a origem não é informada -- ver
            -- MAPEAMENTO §2.5. O código de origem é MIMO86UF || MIMO86MU, nunca UFNUM ||
            -- MIMO86MU.
            CASE WHEN c.mimo86uf BETWEEN '11' AND '53' THEN c.mimo86uf END AS df_uf,
            CASE WHEN c.mimo86uf BETWEEN '11' AND '53' AND c.mimo86mu NOT IN ('0000', '9999')
                 THEN m2.cd_mun END                                        AS df_mun,

            -- nasc_local: vocabulário de P0480. MINASCMU 1/2 = nascido neste município (nunca
            -- migrou ou migrou mas nasceu aqui); 3 + MIUFPAIS 1-27/29 = outro município do
            -- Brasil; 3 + MIUFPAIS >= 30 = exterior. Ver MAPEAMENTO §3.
            CASE
                WHEN c.minascmu IN ('1', '2')                                     THEN '1'
                WHEN c.minascmu = '3' AND c.miufpais >= '30'                      THEN '3'
                WHEN c.minascmu = '3' AND (c.miufpais BETWEEN '01' AND '27' OR c.miufpais = '29')
                                                                                    THEN '2'
            END                                                            AS nasc_local,

            -- nasc_uf: própria UF quando nasceu no município atual (MINASCMU 1/2);
            -- UF_SEQ_1991[MIUFPAIS] quando MINASCMU=3 e MIUFPAIS in 1-27; NULL quando
            -- MIUFPAIS=29 (Brasil sem especificação) ou >= 30 (exterior). Ver MAPEAMENTO §3.
            CASE
                WHEN c.minascmu IN ('1', '2')                          THEN c.uf
                WHEN c.minascmu = '3' AND c.miufpais BETWEEN '01' AND '27' THEN uf_seq_1991(c.miufpais)
            END                                                            AS nasc_uf,

            c.nacionalidade,

            -- nivel_instr_4: DERIVADO de EDANOEST (anos de estudo) -- 1991 não tem variável de
            -- nível de instrução pronta. '30' (alfabetização de adultos) conta como "sem
            -- instrução ou fundamental incompleto". Ver MAPEAMENTO §6.
            CASE
                WHEN c.edanoest IN ('00', '01', '02', '03', '04', '05', '06', '07', '30') THEN '1'
                WHEN c.edanoest IN ('08', '09', '10')                                     THEN '2'
                WHEN c.edanoest IN ('11', '12', '13', '14')                               THEN '3'
                WHEN c.edanoest IN ('15', '16', '17')                                     THEN '4'
                WHEN c.edanoest = '20'                                                    THEN '5'
            END                                                            AS nivel_instr_4,
            -- anos_estudo: só QA da derivação acima -- NULL para '20' (não determinado), '30'
            -- (alfabetização de adultos) e '31' (NSA, não ocorre na prática).
            CASE
                WHEN c.edanoest IN ('20', '30', '31') THEN NULL
                ELSE TRY_CAST(c.edanoest AS INTEGER)
            END                                                            AS anos_estudo,

            -- renda_trab: RPRINCIV em Cruzeiros / Cr$ 36.161,60 (SM vigente em 01/09/1991,
            -- reconciliado -- ver MAPEAMENTO §7). NULL para 9999998 (NSA) e 9999999
            -- (ignorado, 7 dígitos -- não confundir com a sentinela de 9 dígitos de RDOMICIV).
            CASE
                WHEN c.rprinciv IN ('9999998', '9999999') THEN NULL
                ELSE TRY_CAST(NULLIF(c.rprinciv, '') AS DOUBLE) / 36161.60
            END                                                            AS renda_trab,

            -- renda_dom: RDOMICIV (renda domiciliar total, já excluindo pensionista/empregado
            -- doméstico/parente do empregado doméstico do numerador) / Cr$ 36.161,60. NULL para
            -- 999999998/999999999 (9 dígitos). Ainda não é per capita -- ver §4 (02_classify
            -- divide pelo nº de moradores elegíveis por controle).
            CASE
                WHEN c.rdomiciv IN ('999999998', '999999999') THEN NULL
                ELSE TRY_CAST(NULLIF(c.rdomiciv, '') AS DOUBLE) / 36161.60
            END                                                            AS renda_dom,
            c.parendom,
            c.especie                                                     AS tipo_domicilio,

            -- ocupado_10: POSOCUP 1-11 = ocupado; 0/branco com idade >= 10 = não ocupado; NULL
            -- para menores de 10 (universo verificado -- ver MAPEAMENTO §1).
            CASE
                WHEN c.idade IS NULL OR c.idade < 10       THEN NULL
                WHEN c.posocup BETWEEN '01' AND '11'       THEN '1'
                ELSE '2'
            END                                                            AS ocupado_10,

            -- freq_escolar: EDGRAU 1-5 (frequenta escola regular) OU EDCURSNS 1-6 (frequenta
            -- curso não seriado/supletivo) = frequenta; senão, não frequenta. 1991 não separa
            -- rede pública/particular -- o contrato só precisa de frequenta/não frequenta.
            CASE
                WHEN c.edgrau BETWEEN '1' AND '5' OR c.edcursns BETWEEN '1' AND '6' THEN '1'
                ELSE '4'
            END                                                            AS freq_escolar
        FROM pessoas_campos c
        JOIN muni_lookup m1 ON m1.prefixo6 = c.uf || c.municnum
        LEFT JOIN muni_lookup m2 ON m2.prefixo6 = c.mimo86uf || c.mimo86mu
                                 AND c.mimo86uf BETWEEN '11' AND '53'
                                 AND c.mimo86mu NOT IN ('0000', '9999')
    ) x
) TO 'data/interim/1991/pessoas.parquet' (FORMAT PARQUET);

-- ---------- domicilios_apond.parquet (denominador do estimador de variância) ----------
-- 1991 não tem arquivo de domicílios separado -- n_h é a contagem de domicílios DISTINTOS
-- (por `controle`) dentro de cada estrato aproximado cd_apond (ver MAPEAMENTO §5).
COPY (
    SELECT cd_apond, COUNT(DISTINCT controle) AS n_h
    FROM read_parquet('data/interim/1991/pessoas.parquet')
    GROUP BY cd_apond
) TO 'data/interim/1991/domicilios_apond.parquet' (FORMAT PARQUET);
