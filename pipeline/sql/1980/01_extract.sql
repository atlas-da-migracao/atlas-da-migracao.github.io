-- F2 (edição Censo 1980): Extração das 27 partições (data/raw1980/pessoa_<uf>.parquet, já em
-- Parquet -- não há largura fixa a parsear, ao contrário de 1991/2000/2010) para Parquet
-- intermediário. Override de pipeline/sql/01_extract.sql.
--
-- FONTE (desde 1.1.0-1980): o Parquet do censobr/IPEA v1.0.0, convertido por
-- scripts/prep_1980_censobr.py para o mesmo esquema de 39 colunas que a Base dos Dados (BD)
-- fornecia até 1.0.7-1980, célula a célula idêntico a ela nas colunas que a edição usa (gates
-- de identidade em docs/qa/censobr_1980.md; ver pipeline/sql/1980/MAPEAMENTO_fonte_censobr.md).
-- A diferença que importa: a BD perdia o código de município de 178.636 registros -- os 52
-- municípios do norte de Goiás (hoje Tocantins) e Fernando de Noronha, num `merge` contra o
-- diretório ATUAL de municípios --, e o censobr traz `code_muni` para todos, na malha de 1980
-- (52xxxxx e 2000107). Entre 1.0.2 e 1.0.7-1980 esses 52 foram publicados como UMA unidade
-- agregada, 'NORTEGO'; ver MAPEAMENTO_norte_goias.md para a história.
--
-- Ver pipeline/sql/1980/MAPEAMENTO_02_classify.md (§0-§9) e
-- pipeline/sql/1980/CABECALHO_02_classify.txt para a justificativa completa de cada decisão.
-- Resumo das armadilhas que importam a este script:
--   - Os 52 municípios do norte de Goiás chegam com id_municipio = código de 1980 (52xxxxx) e
--     Fernando de Noronha com 2000107; os dois são RECODIFICADOS para o código de 2022 pela
--     tabela `recodificacao` (pipeline/norte_goias_1980.CODIGO_PUBLICADO, 53 entradas), com a
--     UF publicada derivada do código publicado ('17' e '26'). É o mesmo tratamento para os
--     dois casos em que a UF de 1980 e a de 2022 divergem. Cobertura: 29.378.753 registros,
--     Sigma peso 119.011.052 (100,0% dos recenseados; o censobr corrige um peso de MS que a BD
--     trazia errado, ver docs/qa/censobr_1980.md).
--   - Um id_municipio NULL é ERRO de preparação (a fonte tem código para todos): o CASE de
--     cd_mun aborta com error() em vez de inventar um valor.
--   - v512 (UF/país de nascimento) é BIGINT, não VARCHAR -- precisa de
--     LPAD(CAST(v512 AS VARCHAR), 2, '0') antes de casar com uf_seq_1980().
--   - v530/v532 (ocupação/ramo de atividade) NÃO vêm zero-padded (LENGTH varia 1-3) --
--     precisam de LPAD(..., 3, '0') antes de qualquer comparação BETWEEN com os códigos de
--     3 dígitos do dicionário (verificado: sem o LPAD, '5' não cai entre '011' e '042').
--   - v518/v527 (origem / trabalho-estudo) vêm SEMPRE com 7 caracteres: 6 dígitos (UF||MUNIC)
--     mais o dígito verificador do IBGE, acrescentado por prep_1980_censobr.py, em TODAS as
--     UFs (a anomalia do Ceará da BD -- 6 dígitos com zero à esquerda -- não existe mais; a
--     regra "org6"/"trab6" continua tolerando um zero à esquerda por segurança).
--   - A sentinela de "não mudou" é '0000000' (7 dígitos) -- não existe um código "mesmo
--     município"; NULL/'0000000' são tratados de forma idêntica (org6 = NULL). Desde o censobr
--     ela cobre também quem mora no município há 10 anos ou mais (v517 = 7/9) e quem nasceu
--     nele (v517 = 8), nas 27 UFs.
--   - UNIVERSOS (diferença da BD para o censobr, declarada): escolaridade (v520-v524) vem
--     zerada abaixo de 5 anos e trabalho (v528-v533) e v527 vêm NULL abaixo de 10 anos, como
--     na cópia pública do IBGE. ocupado_10 já filtrava por idade; freq_escolar de < 5 anos e o
--     deslocamento pendular de estudo de < 10 anos deixam de existir nesta edição.
--   - v604 (peso) é BIGINT e NÃO tem divisor (diferente de 1e2/1e8/1e13 de outras edições).
--   - v606 (idade) = 999 é "idade ignorada" (28.697 registros), não 999 anos -- vira NULL.
--   - CORRIGIDO EM F9.3(a) (achado do auditor): df_local força '1' (não migrante) quando
--     idade < 5 OU idade IS NULL (idade ignorada). Diferente de 1991/2000/2010/2022, onde o
--     quesito de tempo de residência/data fixa tem NSA por desenho para quem tem menos de 5
--     anos (o campo em branco já cai em '1' sozinho), em 1980 v517 é respondido por TODO MUNDO
--     -- sem essa restrição explícita, 439.533 registros <5 e 4.178 de idade ignorada
--     contaminavam df_local='2'/'3' e, por tabela, is_mig_interno/is_mig_internacional e
--     imig_ni/imig_int em 03_indicators.sql (que não têm filtro de idade adicional, ao
--     contrário de origem_conhecida/origem_valida). Ver MAPEAMENTO §2.2 e 02_classify.sql §12.
--   - v501 (sexo): 1 = homem, 3 = MULHER (não 2).
--   - v511 (nacionalidade): 2 nato, 4 naturalizado, 6 estrangeiro -- RECODIFICADO aqui para
--     1/2/3 do contrato (sempre preenchida, zero brancos, diferente de 1991).
--   - v513 ("nasceu neste município"): 1 = sim, 8 = NÃO (não 2, sem "ignorado").
--   - v598 (situação do domicílio): 0 = urbano, 1 = rural (não 1/2).
--   - pipeline/labels_1980.UF_SEQ_1980 já corrigido nas entradas '07'-'14' (ver F9.3, item
--     bloqueante do plano) -- '14' (Fernando de Noronha) aponta para '26' (PE), coerente com
--     o tratamento de FN acima.
--
-- df_mun/df_uf (origem da migração) e o par trab_mun/trab_uf (destino do deslocamento
-- pendular, antes de ser roteado para trab_*/estudo_* em 02_classify.sql) são resolvidos
-- AQUI, via JOIN com `muni_lookup` -- mesmo padrão de pipeline/sql/1991/01_extract.sql.
-- `muni_lookup` é data/interim/1980/mun6_lookup.parquet (build_ref.py, a partir de
-- pipeline/norte_goias_1980.mun6_lookup): as 3.991 entradas de MUN6_1980 chaveadas pelo prefixo
-- de 6 dígitos DE 1980 (é assim que as origens chegam na fonte), com os 52 do norte de Goiás e
-- Fernando de Noronha já apontando para o código publicado e a UF publicada. Com isso, uma
-- origem ou um destino pendular em qualquer dos 52 resolve para o município de 2022 em todos
-- os lugares, sem CASE especial -- e a UF de origem (`m1.uf`) sai '17', coerente com
-- fluxos_uf.parquet, que lê a UF de municipios_ref.
--
-- Migrar entre dois dos 52 municípios voltou a ser o que é: migração intermunicipal (11.586
-- registros, Sigma peso 47.598, intraestadual sob a UF '17'). A condição `m1.cd_mun = c.cd_mun`
-- do CASE de df_local fica como rede de segurança: nenhum registro de 1980 tem origem igual ao
-- município de residência (0 de 29,4 milhões), então se ela disparar é erro de recodificação.
PRAGMA threads = 10;
PRAGMA memory_limit = '16GB';

-- Sequencial V512 (1-27) -> código IBGE de UF. pipeline/labels_1980.UF_SEQ_1980, CORRIGIDO
-- (ver cabeçalho acima). NÃO cobre '29' (Brasil sem especificação) nem >= '30' (exterior) de
-- propósito -- o CASE que usa esta macro trata os dois à parte (nasc_uf fica NULL).
CREATE OR REPLACE MACRO uf_seq_1980(seq) AS (
    CASE seq
        WHEN '01' THEN '11' WHEN '02' THEN '12' WHEN '03' THEN '13' WHEN '04' THEN '14'
        WHEN '05' THEN '15' WHEN '06' THEN '16' WHEN '07' THEN '21' WHEN '08' THEN '22'
        WHEN '09' THEN '23' WHEN '10' THEN '24' WHEN '11' THEN '25' WHEN '12' THEN '26'
        WHEN '13' THEN '27' WHEN '14' THEN '26' WHEN '15' THEN '28' WHEN '16' THEN '29'
        WHEN '17' THEN '31' WHEN '18' THEN '32' WHEN '19' THEN '33' WHEN '20' THEN '35'
        WHEN '21' THEN '41' WHEN '22' THEN '42' WHEN '23' THEN '43' WHEN '24' THEN '50'
        WHEN '25' THEN '51' WHEN '26' THEN '52' WHEN '27' THEN '53'
    END
);

-- ---------- linhas brutas: 27 caminhos EXPLÍCITOS (padrão do projeto -- nunca glob) ----------
CREATE OR REPLACE TEMP VIEW pessoas_raw AS
    SELECT * FROM read_parquet('data/raw1980/pessoa_ac.parquet')
    UNION ALL SELECT * FROM read_parquet('data/raw1980/pessoa_al.parquet')
    UNION ALL SELECT * FROM read_parquet('data/raw1980/pessoa_am.parquet')
    UNION ALL SELECT * FROM read_parquet('data/raw1980/pessoa_ap.parquet')
    UNION ALL SELECT * FROM read_parquet('data/raw1980/pessoa_ba.parquet')
    UNION ALL SELECT * FROM read_parquet('data/raw1980/pessoa_ce.parquet')
    UNION ALL SELECT * FROM read_parquet('data/raw1980/pessoa_df.parquet')
    UNION ALL SELECT * FROM read_parquet('data/raw1980/pessoa_es.parquet')
    UNION ALL SELECT * FROM read_parquet('data/raw1980/pessoa_fn.parquet')
    UNION ALL SELECT * FROM read_parquet('data/raw1980/pessoa_go.parquet')
    UNION ALL SELECT * FROM read_parquet('data/raw1980/pessoa_ma.parquet')
    UNION ALL SELECT * FROM read_parquet('data/raw1980/pessoa_mg.parquet')
    UNION ALL SELECT * FROM read_parquet('data/raw1980/pessoa_ms.parquet')
    UNION ALL SELECT * FROM read_parquet('data/raw1980/pessoa_mt.parquet')
    UNION ALL SELECT * FROM read_parquet('data/raw1980/pessoa_pa.parquet')
    UNION ALL SELECT * FROM read_parquet('data/raw1980/pessoa_pb.parquet')
    UNION ALL SELECT * FROM read_parquet('data/raw1980/pessoa_pe.parquet')
    UNION ALL SELECT * FROM read_parquet('data/raw1980/pessoa_pi.parquet')
    UNION ALL SELECT * FROM read_parquet('data/raw1980/pessoa_pr.parquet')
    UNION ALL SELECT * FROM read_parquet('data/raw1980/pessoa_rj.parquet')
    UNION ALL SELECT * FROM read_parquet('data/raw1980/pessoa_rn.parquet')
    UNION ALL SELECT * FROM read_parquet('data/raw1980/pessoa_ro.parquet')
    UNION ALL SELECT * FROM read_parquet('data/raw1980/pessoa_rr.parquet')
    UNION ALL SELECT * FROM read_parquet('data/raw1980/pessoa_rs.parquet')
    UNION ALL SELECT * FROM read_parquet('data/raw1980/pessoa_sc.parquet')
    UNION ALL SELECT * FROM read_parquet('data/raw1980/pessoa_se.parquet')
    UNION ALL SELECT * FROM read_parquet('data/raw1980/pessoa_sp.parquet');

-- ---------- dicionário de unidades (chave: prefixo de 6 dígitos do código de 1980) ----------
-- Ver cabeçalho: mun6_lookup.parquet (build_ref.py) já traz os 52 do norte de Goiás e Fernando
-- de Noronha recodificados para o código publicado, com a UF publicada.
CREATE OR REPLACE TEMP VIEW muni_lookup AS
    SELECT prefixo6, cd_mun, uf
    FROM read_parquet('data/interim/1980/mun6_lookup.parquet');

-- ---------- código de 1980 -> código publicado, do lado da RESIDÊNCIA ----------
-- As 53 entradas em que o código muda (52 do norte de Goiás -> 17xxxxx; 2000107 -> 2605459),
-- derivadas do mesmo dicionário: só as linhas cujo código publicado não é o próprio prefixo.
CREATE OR REPLACE TEMP VIEW recodificacao AS
    SELECT prefixo6 || dv AS cd_1980, cd_mun AS cd_publicado
    FROM (
        SELECT prefixo6, cd_mun,
               -- dígito verificador do IBGE (mesmo algoritmo de norte_goias_1980.py)
               CAST((10 - ((
                   CAST(SUBSTR(prefixo6,1,1) AS INTEGER)
                 + (CASE WHEN CAST(SUBSTR(prefixo6,2,1) AS INTEGER)*2 >= 10 THEN CAST(SUBSTR(prefixo6,2,1) AS INTEGER)*2 - 9 ELSE CAST(SUBSTR(prefixo6,2,1) AS INTEGER)*2 END)
                 + CAST(SUBSTR(prefixo6,3,1) AS INTEGER)
                 + (CASE WHEN CAST(SUBSTR(prefixo6,4,1) AS INTEGER)*2 >= 10 THEN CAST(SUBSTR(prefixo6,4,1) AS INTEGER)*2 - 9 ELSE CAST(SUBSTR(prefixo6,4,1) AS INTEGER)*2 END)
                 + CAST(SUBSTR(prefixo6,5,1) AS INTEGER)
                 + (CASE WHEN CAST(SUBSTR(prefixo6,6,1) AS INTEGER)*2 >= 10 THEN CAST(SUBSTR(prefixo6,6,1) AS INTEGER)*2 - 9 ELSE CAST(SUBSTR(prefixo6,6,1) AS INTEGER)*2 END)
               ) % 10)) % 10 AS VARCHAR) AS dv
        FROM muni_lookup
        WHERE SUBSTR(cd_mun, 1, 6) <> prefixo6
    );

-- ---------- campos brutos + colunas derivadas de município (uma vez, referenciadas por nome
-- a seguir -- DuckDB resolve aliases do próprio SELECT list em ordem) ----------
CREATE OR REPLACE TEMP VIEW pessoas_campos AS
    SELECT
        sigla_uf,
        id_municipio,
        v598, v501, v511, v512, v513, v517, v518, v520, v521, v522, v523, v524,
        v527, v528, v529, v530, v532, v604, v606,

        -- cd_mun: o código publicado -- id_municipio (código de 1980 = código de 2022 para
        -- 3.938 municípios) ou a recodificação dos 53 em que a UF mudou (52 do norte de Goiás e
        -- Fernando de Noronha, ver cabeçalho). id_municipio NULL é erro de preparação (a fonte
        -- tem código para todos os 29.378.753 registros): abortar, nunca inventar.
        CASE
            WHEN id_municipio IS NULL
                THEN error('1980: id_municipio NULL -- a fonte é o censobr, rode scripts/prep_1980_censobr.py')
            ELSE COALESCE(r.cd_publicado, id_municipio)
        END                                                                   AS cd_mun,

        -- org6: código de 6 dígitos (UF||MUNIC) da residência anterior, sem o dígito
        -- verificador. NULL = "não migrou" (mesma leitura de '0000000'). A regra do zero à
        -- esquerda era a anomalia do Ceará na Base dos Dados (§2.3); com o censobr ela não
        -- ocorre mais e fica só como tolerância.
        CASE
            WHEN v518 IS NULL OR v518 = '0000000'  THEN NULL
            WHEN SUBSTR(v518, 1, 1) = '0'            THEN SUBSTR(v518, 2, 6)
            ELSE SUBSTR(v518, 1, 6)
        END                                                                   AS org6,

        -- trab6: mesma regra, aplicada a v527 (município de trabalho/estudo). O ramo do zero à
        -- esquerda existia para a anomalia do Ceará na Base dos Dados (13.090 casos em CE,
        -- MAPEAMENTO §2.3); na fonte censobr (1.1.0-1980) v527 já vem com 7 dígitos em toda UF
        -- e o ramo não dispara -- fica como guarda, sem efeito.
        CASE
            WHEN v527 IS NULL OR v527 = '0000000'  THEN NULL
            WHEN SUBSTR(v527, 1, 1) = '0'            THEN SUBSTR(v527, 2, 6)
            ELSE SUBSTR(v527, 1, 6)
        END                                                                   AS trab6
    FROM pessoas_raw p
    LEFT JOIN recodificacao r ON r.cd_1980 = p.id_municipio;
    -- Não há nenhuma exclusão de registro aqui: a edição cobre 100% dos recenseados de 1980
    -- (até 1.0.1-1980 os 178.338 residentes do norte de Goiás ficavam de fora; de 1.0.2 a
    -- 1.0.7-1980 entravam sob a unidade agregada 'NORTEGO'; desde 1.1.0-1980 entram cada um no
    -- seu município, recodificado para 17xxxxx -- ver o CASE de cd_mun acima).

-- ---------- pessoas.parquet ----------
COPY (
    SELECT
        uf, cd_mun, cd_apond, controle, peso, sexo, idade,
        df_local, df_uf, df_mun,
        trab6, desloc_mun, desloc_uf,
        nasc_local, nasc_uf, nacionalidade,
        nivel_instr_4, ocupado_10, freq_escolar,
        v521, v522, v530, v532
    FROM (
        SELECT
            c.*,
            -- uf: prefixo do código PUBLICADO -- '17' para os 52 do norte de Goiás e '26'
            -- para Fernando de Noronha, por decisão declarada (ver cabeçalho e
            -- pipeline/norte_goias_1980.py), '52' para o restante de Goiás.
            SUBSTR(c.cd_mun, 1, 2)                                            AS uf,
            c.cd_mun || CASE WHEN c.v598 = '0' THEN 'U' ELSE 'R' END          AS cd_apond,
            CAST(NULL AS VARCHAR)                                             AS controle,
            CAST(c.v604 AS DOUBLE)                                            AS peso,  -- §0.10: sem divisor
            TRY_CAST(c.v501 AS INTEGER)                                       AS sexo,   -- 1 M, 3 F
            CASE WHEN c.v606 = 999 THEN NULL ELSE TRY_CAST(c.v606 AS INTEGER) END AS idade,

            -- ================= migração: df_local / df_uf / df_mun (§2.2, §2.5) =================
            -- Universo: 5 anos ou mais (MAPEAMENTO §2.2). Diferente das outras 4 edições, v517 É
            -- respondido para MENORES de 5 anos (e para idade ignorada, v606=999) -- não há
            -- "branco"/NSA que já os jogue fora por construção do questionário. Por isso a
            -- restrição de universo tem que ser explícita AQUI, na própria classificação de
            -- df_local, e não só a jusante em origem_conhecida/origem_valida/interestadual
            -- (ACHADO DO AUDITOR, F9.3(a) -- 439.533 registros <5 e 4.178 de idade ignorada
            -- contaminavam df_local='2'/'3', e portanto is_mig_interno/is_mig_internacional e as
            -- tabelas imig_ni/imig_int de 03_indicators.sql, que os usam sem filtro de idade
            -- adicional). Tratamento: '1' não migrante, o mesmo valor que as outras edições
            -- produzem "de graça" para <5 via o campo em branco/NSA.
            -- Daí em diante, mesma lógica de antes: '1' não migrante (v517 fora de 0..4, a janela
            -- quinquenal adotada -- v517='5' fica de fora por decisão, ver MAPEAMENTO §2.2); '2'
            -- migrante interno (origem conhecida OU não informada); '3' internacional (org6
            -- prefixo '80').
            -- A terceira condição ("a origem resolve para o MESMO município em que a pessoa
            -- mora") é uma rede de segurança: nenhum registro de 1980 tem origem igual ao
            -- município de residência (0 de 29,4 milhões), e o questionário já trata uma
            -- mudança dentro do município como v518 = '0000000'. Entre 1.0.2 e 1.0.7-1980 ela
            -- absorvia a migração interna à unidade agregada 'NORTEGO' (11.586 registros);
            -- desde 1.1.0-1980 esses registros são migração intermunicipal comum.
            CASE
                WHEN idade IS NULL OR idade < 5                THEN '1'
                WHEN c.v517 NOT IN ('0', '1', '2', '3', '4')  THEN '1'
                WHEN m1.cd_mun = c.cd_mun                      THEN '1'
                WHEN c.org6 IS NULL                            THEN '2'
                WHEN SUBSTR(c.org6, 1, 2) = '80'                THEN '3'
                ELSE '2'
            END                                                                AS df_local,

            -- df_uf: preenchida mesmo quando o município de origem não é (caso UF||'0000' --
            -- mantém `interestadual` correto para os 253.578 registros desse tipo, MAPEAMENTO
            -- §2.5). '20' = Fernando de Noronha -> '26' (§4). NULL para org6 NULL e sentinelas
            -- '54'/'80'/'99'.
            -- `m1.uf` primeiro. Quando a origem é um dos 52 códigos do norte de Goiás, a UF de
            -- origem publicada é a do código PUBLICADO ('17'), não o prefixo do código de 1980
            -- ('52'). Sem isso, `interestadual` diria "intraestadual" para quem saiu do norte
            -- de Goiás para o resto de Goiás, enquanto fluxos_uf.parquet -- que lê a UF de
            -- municipios_ref -- publicaria o mesmo fluxo como TO->GO. Os dois têm de dizer a
            -- mesma coisa (ver cabeçalho).
            CASE
                WHEN df_local <> '2' OR c.org6 IS NULL          THEN NULL
                WHEN m1.uf IS NOT NULL                          THEN m1.uf
                WHEN SUBSTR(c.org6, 1, 2) = '20'                THEN '26'
                WHEN SUBSTR(c.org6, 1, 2) BETWEEN '11' AND '53' THEN SUBSTR(c.org6, 1, 2)
                ELSE NULL
            END                                                                AS df_uf,

            -- df_mun: Fernando de Noronha primeiro (org6 '200010'/'200000' -> '2605459', §4);
            -- depois as sentinelas conhecidas (exterior '80', Brasil s/especificação '54',
            -- ignorado '99', UF||'0000'); só então o JOIN com muni_lookup, que já devolve o
            -- código publicado (os 52 do norte de Goiás como 17xxxxx).
            CASE
                WHEN df_local <> '2'                             THEN NULL
                WHEN c.org6 IN ('200010', '200000')              THEN '2605459'
                WHEN c.org6 IS NULL                              THEN NULL
                WHEN SUBSTR(c.org6, 1, 2) IN ('54', '80', '99')  THEN NULL
                WHEN SUBSTR(c.org6, 3, 4) = '0000'               THEN NULL  -- UF conhecida, mun não
                ELSE m1.cd_mun
            END                                                                AS df_mun,

            -- ================= pendular: destino de trabalho/estudo (v527), antes do roteamento
            -- trab_*/estudo_* de 02_classify.sql (que decide com base em ocupado_10) =================
            CASE
                WHEN c.trab6 IN ('200010', '200000')             THEN '2605459'
                WHEN c.trab6 IS NULL                              THEN NULL
                WHEN SUBSTR(c.trab6, 1, 2) IN ('54', '80', '99')  THEN NULL
                WHEN SUBSTR(c.trab6, 3, 4) = '0000'               THEN NULL
                ELSE m2.cd_mun
            END                                                                AS desloc_mun,
            -- mesma regra de df_uf: a UF do destino pendular é a do código publicado quando o
            -- destino é um dos 52 códigos do norte de Goiás.
            CASE
                WHEN c.trab6 IS NULL                              THEN NULL
                WHEN m2.uf IS NOT NULL                            THEN m2.uf
                WHEN SUBSTR(c.trab6, 1, 2) = '20'                 THEN '26'
                WHEN SUBSTR(c.trab6, 1, 2) BETWEEN '11' AND '53'  THEN SUBSTR(c.trab6, 1, 2)
                ELSE NULL
            END                                                                AS desloc_uf,

            -- ================= naturalidade (§5.1/§5.2) =================
            -- nasc_local: vocabulário de P0480. v513='1' nasceu aqui; v513='8': v512 1..29 =
            -- outro município/UF do Brasil, v512 30..99 = exterior.
            CASE
                WHEN c.v513 = '1'                                              THEN '1'
                WHEN c.v513 = '8' AND c.v512 BETWEEN 1 AND 29                  THEN '2'
                WHEN c.v513 = '8' AND c.v512 >= 30                             THEN '3'
            END                                                                AS nasc_local,

            -- nasc_uf: própria UF quando nasceu no município atual; UF_SEQ_1980[v512] CORRIGIDO
            -- quando v513='8' e v512 em 1..27 (inclui '14'->Fernando de Noronha->'26', §0.6/§4);
            -- NULL quando v512=29 (Brasil s/especificação) ou >=30 (exterior) -- a macro já
            -- devolve NULL nesses casos por não ter essas chaves.
            -- Quem mora num dos 52 do norte de Goiás e nasceu no próprio município fica com
            -- nasc_uf = '17'. RESSALVA DECLARADA: quem nasceu no território e mora fora dele
            -- traz v512 = Goiás, porque era isso que o Censo de 1980 registrava -- a UF de
            -- nascimento do norte de Goiás é irrecuperável na fonte. O efeito é que
            -- `retorno_uf_natal` fica SUBESTIMADO no Tocantins e superestimado no restante de
            -- Goiás (o status 'retorno_natal' não é afetado: vem de v513, por município). Ver docs/METODOLOGIA.md, seção de 1980.
            -- (a expressão de `uf` é repetida em vez de referenciada pelo alias: `uf` é nome
            -- de coluna em m1/m2, e o alias do SELECT list fica ambíguo para o binder.)
            CASE
                WHEN c.v513 = '1'                       THEN SUBSTR(c.cd_mun, 1, 2)
                WHEN c.v513 = '8' AND c.v512 BETWEEN 1 AND 27
                    THEN uf_seq_1980(LPAD(CAST(c.v512 AS VARCHAR), 2, '0'))
            END                                                                AS nasc_uf,

            -- nacionalidade: RECODIFICADA de 2/4/6 (1980) para 1/2/3 (contrato). Sempre
            -- preenchida (§5.2).
            CASE c.v511 WHEN '2' THEN '1' WHEN '4' THEN '2' WHEN '6' THEN '3' END AS nacionalidade,

            -- ================= escolaridade (§5.3) =================
            -- nivel_instr_4: reconstruído de v523 (última série concluída) x v524 (grau da
            -- última série, releitura -- ver CABECALHO ponto 8). ELSE '5' cobre v524/v523 NULL
            -- ou '9', e também combinações fora da tabela de correspondência (ex.: v524='4' com
            -- v523='0', quem está cursando o 1º grau sem série concluída -- aproximação
            -- declarada no MAPEAMENTO §5.3).
            -- CORRIGIDO EM F9.3(a) (achado do auditor): v523 é STRING, e '9' ("sem declaração")
            -- é lexicograficamente >= '3' e >= '4' -- as duas condições com >= abaixo levavam
            -- v523='9' a cair em '3'/'4' em vez de '5' (não determinado), como manda a última
            -- linha da tabela de correspondência do MAPEAMENTO §5.3. Adicionado "AND c.v523 <>
            -- '9'" explícito nas duas condições que usam >=.
            CASE
                WHEN c.v524 IN ('0', '1', '2')
                  OR (c.v524 = '3' AND c.v523 IN ('1', '2', '3'))
                  OR (c.v524 = '4' AND c.v523 BETWEEN '1' AND '7')            THEN '1'
                WHEN (c.v524 = '3' AND c.v523 IN ('4', '5'))
                  OR (c.v524 = '4' AND c.v523 = '8')
                  OR (c.v524 IN ('5', '6') AND c.v523 IN ('1', '2'))          THEN '2'
                WHEN (c.v524 IN ('5', '6') AND c.v523 >= '3' AND c.v523 <> '9')
                  OR (c.v524 = '7' AND c.v523 IN ('1', '2', '3'))             THEN '3'
                WHEN (c.v524 = '7' AND c.v523 >= '4' AND c.v523 <> '9') OR c.v524 = '8' THEN '4'
                ELSE '5'
            END                                                                AS nivel_instr_4,

            -- ================= ocupação e frequência escolar (§6.1) =================
            -- ocupado_10: v529='0' (trabalha) E idade>=10 -- O FILTRO DE 10 ANOS É OBRIGATÓRIO
            -- (sem ele a taxa de ocupação nacional sai em 41,7%, e em 60% no Ceará -- artefato
            -- de crianças de 0-9 anos que vêm com v529='0', CABECALHO ponto 6).
            CASE
                WHEN idade IS NULL OR idade < 10  THEN NULL
                WHEN c.v529 = '0'                  THEN '1'
                ELSE '2'
            END                                                                AS ocupado_10,

            -- freq_escolar: v521 (grau regular) OU v522 (curso especial/supletivo) em 1..8.
            -- 1980 não distingue rede pública/particular -- só frequenta/não frequenta.
            CASE
                WHEN c.v521 BETWEEN '1' AND '8' OR c.v522 BETWEEN '1' AND '8' THEN '1'
                ELSE '4'
            END                                                                AS freq_escolar
        FROM pessoas_campos c
        LEFT JOIN muni_lookup m1 ON m1.prefixo6 = c.org6    -- origem da migração (v518)
        LEFT JOIN muni_lookup m2 ON m2.prefixo6 = c.trab6   -- destino pendular (v527)
    ) x
) TO 'data/interim/1980/pessoas.parquet' (FORMAT PARQUET);

-- Não há data/interim/1980/domicilios.parquet nem domicilios_apond.parquet: não existe chave
-- de domicílio em 1980 (numero_ordem é a ordem da pessoa, não um identificador -- MAPEAMENTO
-- §8/§0.8). 03_indicators.sql, 04_flows.sql, 07_pendular.sql e 08_metro.sql têm overrides
-- próprios que não dependem desses arquivos.
