-- F2 (edição Censo 1980): Extração das 27 partições (data/raw1980/pessoa_<uf>.parquet, já em
-- Parquet -- não há largura fixa a parsear, ao contrário de 1991/2000/2010) para Parquet
-- intermediário. Override de pipeline/sql/01_extract.sql.
--
-- Ver pipeline/sql/1980/MAPEAMENTO_02_classify.md (§0-§9) e
-- pipeline/sql/1980/CABECALHO_02_classify.txt para a justificativa completa de cada decisão.
-- Resumo das armadilhas que importam a este script:
--   - 178.338 registros de sigla_uf='GO' chegam com id_municipio NULL (norte de Goiás, hoje
--     Tocantins): a Base dos Dados não publica o código de 6 dígitos original e não há como
--     recuperá-lo -- a sondagem das quatro camadas da BD (produção, dev e as duas variantes de
--     staging) achou exatamente os mesmos 178.338 nulos em todas, então o campo é nulo na
--     ORIGEM, não é efeito de safe_cast (ver MAPEAMENTO §3 e MAPEAMENTO_norte_goias.md).
--     Até 1.0.1-1980 eles eram EXCLUÍDOS. Desde 1.0.2-1980 recebem cd_mun = 'NORTEGO', a
--     UNIDADE AGREGADA que a edição publica no lugar dos 52 municípios (uma unidade com
--     população, imigração, emigração, saldo, pendular e malha próprias -- ver
--     pipeline/unidades_agregadas_1980.py). Cobertura final: 29.378.753 registros,
--     Sigma peso 119.011.062 (100,0% dos recenseados).
--   - Fernando de Noronha (sigla_uf='FN', 298 registros) chega com id_municipio NULL --
--     atribuído a '2605459' por sigla_uf, nos dois lados (residência e origem/trabalho/
--     estudo). É o único município cuja UF publicada (26, PE) não é a UF de 1980 (território
--     federal). Ver MAPEAMENTO §4.
--   - v512 (UF/país de nascimento) é BIGINT, não VARCHAR -- precisa de
--     LPAD(CAST(v512 AS VARCHAR), 2, '0') antes de casar com uf_seq_1980().
--   - v530/v532 (ocupação/ramo de atividade) NÃO vêm zero-padded (LENGTH varia 1-3) --
--     precisam de LPAD(..., 3, '0') antes de qualquer comparação BETWEEN com os códigos de
--     3 dígitos do dicionário (verificado: sem o LPAD, '5' não cai entre '011' e '042').
--   - v518/v527 (origem / trabalho-estudo) vêm SEMPRE com 7 caracteres (extract_1980_bd.py já
--     aplica LPAD), mas no Ceará (e SÓ no Ceará) o valor original tem 6 dígitos
--     (UF||MUNIC, sem dígito verificador) -- o LPAD acrescenta um zero à esquerda
--     ('0230440'). Regra "org6"/"trab6": strip do zero à esquerda quando presente. Ver
--     MAPEAMENTO §2.3 (190.963 casos em v518, 13.090 em v527, TODOS em CE).
--   - v518 de não migrante em CE é NULL (não '0000000' como nas outras 26 UFs).
--   - A sentinela de "não mudou" é '0000000' (7 dígitos) -- não existe um código "mesmo
--     município"; NULL/'0000000' são tratados de forma idêntica (org6 = NULL).
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
--
-- A UNIDADE AGREGADA 'NORTEGO' (F9.9). `muni_lookup` é a união de duas tabelas:
--   1. data/interim/1980/municipios_ref.parquet (build_ref.py, a partir de
--      pipeline/labels_1980.MUNICIPIOS_1980, com Fernando de Noronha reapontado para
--      '2605459'), pelo prefixo de 6 dígitos do próprio código; e
--   2. data/interim/1980/unidades_agregadas.parquet (build_ref.py, a partir de
--      pipeline/unidades_agregadas_1980.py): os 52 prefixos de 6 dígitos do norte de Goiás ->
--      'NORTEGO'. O código sintético não tem prefixo de 6 dígitos próprio ('NORTEG' não é
--      chave de nada), então essa metade do dicionário tem de vir de fora de municipios_ref.
-- Com isso, os 52 códigos de 1980 resolvem para a unidade em TODOS os lugares que consultam o
-- dicionário municipal -- origem da migração (v518) e destino do deslocamento pendular (v527)
-- --, sem nenhum CASE especial. Do lado da residência, os 178.338 registros de sigla_uf='GO'
-- sem id_municipio recebem cd_mun = 'NORTEGO' pelo mesmo CASE que trata Fernando de Noronha.
--
-- Consequência boa: mudar de município DENTRO do norte de Goiás vira `m1.cd_mun = c.cd_mun`,
-- e o CASE de df_local trata isso como NÃO MIGRAÇÃO -- do mesmo jeito que o questionário de
-- 1980 trata uma mudança dentro de um mesmo município (v518 = '0000000'). É a única leitura
-- honesta: a origem não é "não informada" (a fonte informa), nem pode virar um autoloop
-- origem=destino. O preço é uma perda de granularidade declarada, a mesma de qualquer
-- agregação -- ver MAPEAMENTO_norte_goias.md e docs/METODOLOGIA.md, item 4 da seção de 1980.
-- (No resto da edição essa condição é vacuamente falsa: nenhum registro de 1980 tem origem
-- igual ao município de residência -- conferido, 0 de 29,4 milhões.)
--
-- A UF da unidade é '17' (Tocantins) por DECISÃO declarada, não por SUBSTR do código: ela vem
-- de `municipios_ref.uf` do lado da residência e da coluna `uf` de unidades_agregadas.parquet
-- do lado da origem/pendular. Ver a justificativa (e a comparação com publicar sob '52') em
-- pipeline/unidades_agregadas_1980.py.
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
-- Duas metades (ver cabeçalho): os 3.939 municípios, pelo prefixo do próprio código; e os 52
-- prefixos do norte de Goiás, que apontam todos para a unidade agregada 'NORTEGO' -- cujo
-- código sintético não tem prefixo de 6 dígitos próprio e por isso precisa desta segunda
-- tabela. `uf` acompanha porque a UF de 'NORTEGO' ('17') é uma decisão declarada e não pode
-- ser derivada de SUBSTR(codigo, 1, 2).
CREATE OR REPLACE TEMP VIEW muni_lookup AS
    SELECT cd_mun, uf, SUBSTR(cd_mun, 1, 6) AS prefixo6
    FROM read_parquet('data/interim/1980/municipios_ref.parquet')
    WHERE cd_mun NOT IN (SELECT DISTINCT cd_unidade
                         FROM read_parquet('data/interim/1980/unidades_agregadas.parquet'))
    UNION ALL
    SELECT cd_unidade AS cd_mun, uf, prefixo6
    FROM read_parquet('data/interim/1980/unidades_agregadas.parquet');

-- ---------- uma linha por unidade agregada (código -> UF publicada) ----------
-- Usada só do lado da RESIDÊNCIA, para dar UF a quem mora na unidade. Não dá para reusar
-- muni_lookup aqui: lá a unidade aparece 52 vezes (uma por prefixo componente), e um JOIN por
-- cd_mun multiplicaria os registros.
CREATE OR REPLACE TEMP VIEW unidade_ref AS
    SELECT DISTINCT cd_unidade AS cd_mun, uf
    FROM read_parquet('data/interim/1980/unidades_agregadas.parquet');

-- ---------- campos brutos + colunas derivadas de município (uma vez, referenciadas por nome
-- a seguir -- DuckDB resolve aliases do próprio SELECT list em ordem) ----------
CREATE OR REPLACE TEMP VIEW pessoas_campos AS
    SELECT
        sigla_uf,
        id_municipio,
        v598, v501, v511, v512, v513, v517, v518, v520, v521, v522, v523, v524,
        v527, v528, v529, v530, v532, v604, v606,

        -- cd_mun: id_municipio direto, com duas atribuições explícitas por sigla de UF, nos
        -- dois casos em que a Base dos Dados não geocodifica o residente:
        --   'FN' -> '2605459'  Fernando de Noronha/PE (MAPEAMENTO §4);
        --   'GO' com id_municipio NULL -> 'NORTEGO'  os 52 municípios do norte de Goiás, hoje
        --      Tocantins, publicados como UMA unidade agregada (ver cabeçalho). O predicado é
        --      exato: em 'GO' o id_municipio só é nulo nesses 178.338 registros, e em nenhuma
        --      outra UF ele é nulo (conferido em F9.2/F9.9).
        CASE
            WHEN sigla_uf = 'FN'                            THEN '2605459'
            WHEN sigla_uf = 'GO' AND id_municipio IS NULL   THEN 'NORTEGO'
            ELSE id_municipio
        END                                                                   AS cd_mun,

        -- org6: código de 6 dígitos (UF||MUNIC) da residência anterior, sem o dígito
        -- verificador. NULL = "não migrou" (mesma leitura de '0000000') OU, só no Ceará,
        -- "não migrante" mesmo (v518 vem NULL ali, não '0000000' -- ver MAPEAMENTO §0.2).
        -- Regra do Ceará (§2.3): só ali v518 chega com 6 dígitos e um zero à esquerda
        -- (SUBSTR(v518,1,1)='0'); nas outras 26 UFs v518 sempre tem 7 dígitos legítimos.
        CASE
            WHEN v518 IS NULL OR v518 = '0000000'  THEN NULL
            WHEN SUBSTR(v518, 1, 1) = '0'            THEN SUBSTR(v518, 2, 6)
            ELSE SUBSTR(v518, 1, 6)
        END                                                                   AS org6,

        -- trab6: mesma regra, aplicada a v527 (município de trabalho/estudo). Mesma anomalia
        -- do Ceará (13.090 casos, todos em CE -- MAPEAMENTO §2.3).
        CASE
            WHEN v527 IS NULL OR v527 = '0000000'  THEN NULL
            WHEN SUBSTR(v527, 1, 1) = '0'            THEN SUBSTR(v527, 2, 6)
            ELSE SUBSTR(v527, 1, 6)
        END                                                                   AS trab6
    FROM pessoas_raw;
    -- Não há mais nenhuma exclusão de registro aqui. Até 1.0.1-1980 havia uma
    -- (`WHERE NOT (sigla_uf = 'GO' AND id_municipio IS NULL)`), que tirava da edição os
    -- 178.338 residentes do norte de Goiás; desde 1.0.2-1980 eles entram sob a unidade
    -- agregada 'NORTEGO' (ver o CASE de cd_mun acima). A edição passou a cobrir 100% dos
    -- recenseados de 1980.

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
            -- uf: prefixo do código, EXCETO na unidade agregada, cujo código é sintético e
            -- não numérico -- SUBSTR('NORTEGO',1,2) daria 'NO'. A UF dela é '17' (Tocantins),
            -- por decisão declarada (ver cabeçalho e pipeline/unidades_agregadas_1980.py);
            -- `ur.uf` vem de unidade_ref, de modo que o valor tem uma fonte só -- o mesmo
            -- módulo Python que alimenta a linha da unidade em municipios_ref.
            COALESCE(ur.uf, SUBSTR(c.cd_mun, 1, 2))                           AS uf,
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
            -- F9.9: a terceira condição ("a origem resolve para a MESMA unidade em que a
            -- pessoa mora") é o tratamento da migração interna a uma unidade agregada -- em
            -- 1980, mudar entre dois dos 52 municípios do norte de Goiás (11.586 registros,
            -- Sigma peso 47.598). Não é migração desta edição, porque não há mudança de
            -- unidade: é exatamente o que o questionário de 1980 já faz com uma mudança dentro
            -- de um mesmo município (v518 = '0000000'). As alternativas eram piores: deixar em
            -- df_local='2' com df_mun NULL jogaria origem CONHECIDA em "origem não informada"
            -- (a única parcela dessa categoria, em todo o atlas, cuja origem a fonte informa),
            -- e resolver df_mun para a própria unidade criaria um autoloop origem=destino.
            -- Nos 3.939 municípios reais a condição é vacuamente falsa (0 registros).
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
            -- F9.9: `m1.uf` primeiro. Quando a origem é um dos 52 códigos do norte de Goiás,
            -- a UF de origem publicada é a da UNIDADE ('17'), não o prefixo do código de 1980
            -- ('52'). Sem isso, `interestadual` diria "intraestadual" para quem saiu do norte
            -- de Goiás para o resto de Goiás, enquanto fluxos_uf.parquet -- que lê a UF de
            -- municipios_ref -- publicaria o mesmo fluxo como TO->GO. Os dois têm de dizer a
            -- mesma coisa, e a coisa que eles dizem é a decisão declarada sobre a UF da
            -- unidade (ver cabeçalho).
            CASE
                WHEN df_local <> '2' OR c.org6 IS NULL          THEN NULL
                WHEN m1.uf IS NOT NULL                          THEN m1.uf
                WHEN SUBSTR(c.org6, 1, 2) = '20'                THEN '26'
                WHEN SUBSTR(c.org6, 1, 2) BETWEEN '11' AND '53' THEN SUBSTR(c.org6, 1, 2)
                ELSE NULL
            END                                                                AS df_uf,

            -- df_mun: Fernando de Noronha primeiro (org6 '200010'/'200000' -> '2605459', §4);
            -- depois as sentinelas conhecidas (exterior '80', Brasil s/especificação '54',
            -- ignorado '99', UF||'0000'); só então o JOIN com muni_lookup -- que desde F9.9
            -- resolve os 52 códigos do norte de Goiás para a unidade agregada 'NORTEGO', do
            -- mesmo jeito que resolve um município real. Quem mora na própria unidade já foi
            -- desviado para df_local='1' acima, então aqui df_mun nunca é igual a cd_mun.
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
            -- mesma regra de df_uf: a UF do destino pendular é a da UNIDADE quando o destino
            -- é um dos 52 códigos do norte de Goiás (F9.9).
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
            -- F9.9: `uf` (o alias acima), não SUBSTR(cd_mun,1,2) -- que daria 'NO' para a
            -- unidade agregada. Quem mora em 'NORTEGO' e nasceu no próprio município fica com
            -- nasc_uf = '17'. RESSALVA DECLARADA: quem nasceu no território e mora fora dele
            -- traz v512 = Goiás, porque era isso que o Censo de 1980 registrava -- a UF de
            -- nascimento do norte de Goiás é irrecuperável na fonte. O efeito é que
            -- `retorno_uf_natal` e o status 'retorno_natal' ficam SUBESTIMADOS para a unidade
            -- (quem volta ao território vindo de fora não é reconhecido como natural dele).
            -- Ver docs/METODOLOGIA.md, item 4 da seção de 1980.
            -- (a expressão de `uf` é repetida em vez de referenciada pelo alias: `uf` é nome
            -- de coluna em m1/m2/ur, e o alias do SELECT list fica ambíguo para o binder.)
            CASE
                WHEN c.v513 = '1'                       THEN COALESCE(ur.uf, SUBSTR(c.cd_mun, 1, 2))
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
        LEFT JOIN unidade_ref ur  ON ur.cd_mun  = c.cd_mun  -- UF da unidade agregada de residência
    ) x
) TO 'data/interim/1980/pessoas.parquet' (FORMAT PARQUET);

-- Não há data/interim/1980/domicilios.parquet nem domicilios_apond.parquet: não existe chave
-- de domicílio em 1980 (numero_ordem é a ordem da pessoa, não um identificador -- MAPEAMENTO
-- §8/§0.8). 03_indicators.sql, 04_flows.sql, 07_pendular.sql e 08_metro.sql têm overrides
-- próprios que não dependem desses arquivos.
