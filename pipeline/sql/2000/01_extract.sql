-- F2 (edição Censo 2000): Extração das 27 UFs (Pessoas + Domicílios) para Parquet
-- intermediário. Override de pipeline/sql/01_extract.sql.
--
-- Os arquivos são TXT de largura fixa com CRLF (não CSV): lidos com read_csv(delim=chr(1),
-- quote='') para virar uma única coluna VARCHAR por linha -- mesmo truque de 2010. Conferido
-- empiricamente (LENGTH(linha) agregado, nunca o conteúdo) que o DuckDB já descarta o \r\n na
-- leitura: domicílios vêm sempre com LENGTH=170 (LRECL_DOMICILIOS); pessoas vêm entre 369 e
-- 390 (LRECL_PESSOAS=390), porque os 7 campos auxiliares de migração no final do registro
-- (V4354, V4219, V4239, V4269, V4279, V4451, V4461, posições 370-390) são right-trimmed
-- quando brancos -- não é resíduo de CRLF, é truncamento à direita do próprio arquivo-fonte.
-- Nenhuma coluna usada por este pipeline passa da posição 345 (P001), então essa variação de
-- comprimento nunca afeta os campos extraídos.
--
-- ACHADO DE QA (documentado, não é decisão metodológica): 2 linhas malformadas em ~26 milhões
-- de registros (1 em Pes31.txt/MG e 1 em Dom31.txt/MG, ambas com LENGTH=1) -- artefato de
-- transcrição isolado do arquivo-fonte de 2000, sem conteúdo compatível com nenhum campo do
-- layout. Descartadas via WHERE LENGTH(linha) >= 369 (pessoas) / >= 167 (domicílios).
-- Uma terceira linha inicialmente suspeita (DOM26.txt/PE, LENGTH=167) NÃO é malformada: é um
-- domicílio coletivo legítimo com 42 moradores -- LE DOMIC.sas marca V1111-V1113 (posições
-- 168-170) como "branco para domicílio coletivo", e nenhum campo lido por este pipeline passa
-- da posição 156 (achado do checkpoint do auditor, 2026-09-14) -- por isso o piso de
-- domicílios é >= 167 (não = 170): aceita esse registro sem afetar nenhum campo extraído.
-- Efeito no total populacional das 2 linhas remanescentes: desprezível (2 em ~26 milhões).
--
-- Posições 1-based, extraídas com SUBSTR(linha, posição_inicial, tamanho), verificadas contra
-- pipeline/layout_2000.py. Mapeamento de variáveis, decisões de recode e ressalvas de
-- comparabilidade: ver pipeline/sql/2000/MAPEAMENTO_02_classify.md e
-- pipeline/sql/2000/02_classify.sql (cabeçalho).
--
-- ARMADILHA: AREAP fica em posição DIFERENTE nos dois arquivos -- (51,13) em pessoas,
-- (52,13) em domicílios. `controle` = AREAP || V0300 usa 51 em pessoas e 52 em domicílios;
-- V0300 é (39,8) nos dois. Copiar a posição de um arquivo para o outro quebra 100% do join.
--
-- ARMADILHA: a Bahia (BA/PES29.zip) chega zipada -- rode scripts/prep_2000.sh ANTES deste
-- script para descompactar pes29.txt em data/interim/2000/raw_ba/pes29.txt (gitignored). O
-- domicílios de BA (DOM29.txt) NÃO é zipado, é um .txt direto como as outras 26 UFs.
--
-- ARMADILHA: data/raw2000/RN/ contém DOM25.txt/PES25.txt, que são uma CÓPIA DUPLICADA dos
-- dados da PARAÍBA (código 25 pertence à PB, não ao RN -- código correto de RN é 24). Este
-- script usa só RN/DOM24.txt e RN/PES24.txt; RN/DOM25.txt e RN/PES25.txt NÃO entram em lugar
-- nenhum (nem aqui, nem em nenhum outro script). Por isso os 27 caminhos abaixo são listados
-- EXPLICITAMENTE (uma UNION ALL por arquivo), nunca com glob `*/*.txt` -- a pasta tem lixo
-- (FAMI*.TXT/.zip, .DS_Store, e esse duplicado de RN).
PRAGMA threads = 10;
PRAGMA memory_limit = '16GB';

-- Sequencial de UF (V4210 em pessoas/nasc_uf, V4260 em pessoas/df_uf) -> código IBGE de UF.
-- pipeline/labels_2000.UF_SEQ_2000, 27 entradas ('01'..'27' -> códigos IBGE reais). NÃO tem
-- chave '29' ('BRASIL SEM ESPECIFICAÇÃO') de propósito -- tratada à parte em cada CASE que a
-- usa (ver MAPEAMENTO §6).
CREATE OR REPLACE MACRO uf_seq_2000(seq) AS (
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

-- ---------- linhas brutas, compartilhadas entre pessoas.parquet e o denominador de renda_pc ----------
CREATE OR REPLACE TEMP VIEW pessoas_linhas AS
    SELECT linha FROM (
        SELECT linha FROM read_csv('data/raw2000/AC/Pes12.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
        UNION ALL
        SELECT linha FROM read_csv('data/raw2000/AL/PES27.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
        UNION ALL
        SELECT linha FROM read_csv('data/raw2000/AM/Pes13.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
        UNION ALL
        SELECT linha FROM read_csv('data/raw2000/AP/Pes16.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
        UNION ALL
        SELECT linha FROM read_csv('data/raw2000/CE/PES23.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
        UNION ALL
        SELECT linha FROM read_csv('data/raw2000/DF/PES53.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
        UNION ALL
        SELECT linha FROM read_csv('data/raw2000/ES/Pes32.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
        UNION ALL
        SELECT linha FROM read_csv('data/raw2000/GO/PES52.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
        UNION ALL
        SELECT linha FROM read_csv('data/raw2000/MA/PES21.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
        UNION ALL
        SELECT linha FROM read_csv('data/raw2000/MG/Pes31.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
        UNION ALL
        SELECT linha FROM read_csv('data/raw2000/MS/PES50.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
        UNION ALL
        SELECT linha FROM read_csv('data/raw2000/MT/PES51.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
        UNION ALL
        SELECT linha FROM read_csv('data/raw2000/PA/Pes15.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
        UNION ALL
        SELECT linha FROM read_csv('data/raw2000/PB/PES25.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
        UNION ALL
        SELECT linha FROM read_csv('data/raw2000/PE/PES26.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
        UNION ALL
        SELECT linha FROM read_csv('data/raw2000/PI/PES22.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
        UNION ALL
        SELECT linha FROM read_csv('data/raw2000/PR/PES41.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
        UNION ALL
        SELECT linha FROM read_csv('data/raw2000/RJ/Pes33.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
        UNION ALL
        -- RN: só PES24.txt (código correto de RN). PES25.txt em RN/ é duplicata da PB -- não usar.
        SELECT linha FROM read_csv('data/raw2000/RN/PES24.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
        UNION ALL
        SELECT linha FROM read_csv('data/raw2000/RO/Pes11.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
        UNION ALL
        SELECT linha FROM read_csv('data/raw2000/RR/Pes14.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
        UNION ALL
        SELECT linha FROM read_csv('data/raw2000/RS/PES43.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
        UNION ALL
        SELECT linha FROM read_csv('data/raw2000/SC/PES42.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
        UNION ALL
        SELECT linha FROM read_csv('data/raw2000/SE/PES28.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
        UNION ALL
        SELECT linha FROM read_csv('data/raw2000/SP/Pes35.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
        UNION ALL
        SELECT linha FROM read_csv('data/raw2000/TO/Pes17.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
        UNION ALL
        -- BA: só chega aqui depois de scripts/prep_2000.sh descompactar PES29.zip.
        SELECT linha FROM read_csv('data/interim/2000/raw_ba/pes29.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
    ) t
    WHERE LENGTH(linha) >= 369;

-- ---------- pessoas.parquet ----------
-- Estilo: colunas auxiliares (v0415, v0417, ..., classe_v4276) são calculadas uma vez e
-- REFERENCIADAS por nome nas colunas seguintes -- DuckDB resolve aliases do próprio SELECT
-- list em ordem (testado isoladamente antes de escrever este script), o que evita repetir
-- cada SUBSTR(linha, ...) em meia dúzia de CASE diferentes e reduz o risco de uma posição
-- digitada errado em uma das repetições. A projeção final (fora deste bloco) descarta as
-- colunas puramente auxiliares.
COPY (
    SELECT
        uf, cd_mun, cd_apond, controle, peso, sexo, idade,
        nasc_local, nasc_uf, nasc_mun, nasc_pais, nacionalidade,
        df_local, df_uf, df_mun, df_pais,
        freq_escolar, curso, nivel_instr_7, nivel_instr_4, anos_estudo,
        estudo_local, estudo_uf, estudo_mun, estudo_pais,
        ocupado_10, pos_ocup, pos_ocup2, atividade, grande_grupo,
        renda_trab, renda_todas_fontes,
        trab_local, trab_uf, trab_mun, trab_pais,
        retorna_3dias, transporte, tempo_desloc_cat, tempo_desloc_min,
        imp_df_local, imp_df_mun, imp_trab_mun
    FROM (
        SELECT
            SUBSTR(linha, 1, 2)                                              AS uf,
            SUBSTR(linha, 12, 7)                                             AS cd_mun,
            SUBSTR(linha, 51, 13)                                            AS cd_apond,
            -- controle = área de ponderação (AREAP, pessoas: posição 51) || V0300 (39,8)
            SUBSTR(linha, 51, 13) || SUBSTR(linha, 39, 8)                    AS controle,
            -- P001 tem 8 decimais implícitos em 2000 (não 13, como em 2010)
            CAST(SUBSTR(linha, 335, 11) AS DOUBLE) / 1e8                     AS peso,
            TRY_CAST(NULLIF(TRIM(SUBSTR(linha, 69, 1)), '') AS INTEGER)      AS sexo,
            -- V4572 no SAS = V4752 na documentação (mesmo campo, nome trocado na fonte -- ver
            -- MAPEAMENTO §0); posição (79,3) é a mesma nos dois nomes.
            TRY_CAST(NULLIF(TRIM(SUBSTR(linha, 79, 3)), '') AS INTEGER)      AS idade,

            -- ===== blocos auxiliares (só helpers -- descartados na projeção externa) =====
            NULLIF(TRIM(SUBSTR(linha, 103, 1)), '')                         AS v0415,
            NULLIF(TRIM(SUBSTR(linha, 108, 1)), '')                         AS v0417,
            NULLIF(TRIM(SUBSTR(linha, 110, 1)), '')                         AS v0418,
            NULLIF(TRIM(SUBSTR(linha, 119, 2)), '')                         AS v4210,
            NULLIF(TRIM(SUBSTR(linha, 128, 1)), '')                         AS v0424,
            NULLIF(TRIM(SUBSTR(linha, 138, 2)), '')                         AS v4260,
            NULLIF(TRIM(SUBSTR(linha, 141, 7)), '')                         AS v4276,
            NULLIF(TRIM(SUBSTR(linha, 168, 2)), '')                         AS v4300,
            NULLIF(TRIM(SUBSTR(linha, 176, 1)), '')                         AS v0439,
            NULLIF(TRIM(SUBSTR(linha, 178, 1)), '')                         AS v0440,
            NULLIF(TRIM(SUBSTR(linha, 180, 1)), '')                         AS v0441,
            NULLIF(TRIM(SUBSTR(linha, 182, 1)), '')                         AS v0442,
            NULLIF(TRIM(SUBSTR(linha, 184, 1)), '')                         AS v0443,

            -- nacionalidade (V0419) direto -- branco para não migrantes e naturais da UF;
            -- COALESCE(...,'1') fica no 02_classify, como em 2010.
            NULLIF(TRIM(SUBSTR(linha, 112, 1)), '')                         AS nacionalidade,

            -- nasc_local: vocabulário de P0480 (1 neste município / 2 outro município do
            -- Brasil / 3 exterior). V0417/V0418/V0419/V4210 são branco para os NÃO migrantes
            -- (V0415='1' pula de 4.15 para 4.27) -- por isso a 1ª cláusula cobre os dois casos
            -- de "nasceu aqui" (nunca migrou OU migrou mas nasceu no atual município). Ordem
            -- importa: exterior (2ª cláusula) antes de "outro município" (3ª).
            CASE
                WHEN v0415 = '1' OR v0417 = '1'              THEN '1'
                WHEN v4210 >= '30' OR nacionalidade IN ('2', '3') THEN '3'
                WHEN v0417 = '2'                              THEN '2'
            END                                                              AS nasc_local,

            -- df_mun: código de 7 díg. na malha de 2000, direto (não há harmonização a fazer:
            -- o manual pede o nome ATUAL do município em 4.25). Branco para não migrantes,
            -- para quem morava neste município, no exterior, e para os não nascidos ainda.
            NULLIF(TRIM(SUBSTR(linha, 130, 7)), '')                         AS df_mun,

            -- df_local: vocabulário de P0600. V0424 IN ('1','2') = "neste município, zona
            -- urbana/rural" -- existe pelo mesmo motivo de 2010 (V0416 conta anos desde o
            -- ÚLTIMO RETORNO, não o tempo total). V0424='6' ("não era nascido em 31/07/1995")
            -- e o branco caem no ELSE implícito -> NULL.
            CASE
                WHEN v0415 = '1' OR v0424 IN ('1', '2') THEN '1'
                WHEN v0424 IN ('3', '4')                THEN '2'
                WHEN v0424 = '5'                        THEN '3'
            END                                                              AS df_local,

            -- nasc_uf: própria UF quando nasceu no município/UF atuais OU quando tudo em
            -- branco (fallback documentado no MAPEAMENTO §1); '99' para V4210='29' (Brasil
            -- sem especificação -- UF_SEQ_2000 não tem essa chave de propósito, ver MACRO
            -- acima); NULL quando nasceu no exterior (V4210 >= '30').
            CASE
                WHEN v0415 = '1' OR v0417 = '1' OR v0418 = '1'   THEN uf
                WHEN v4210 = '29'                                THEN '99'
                WHEN v4210 >= '30'                               THEN NULL
                WHEN v0418 = '2' AND v4210 BETWEEN '01' AND '27' THEN uf_seq_2000(v4210)
                ELSE uf
            END                                                              AS nasc_uf,

            -- df_uf: SUBSTR(df_mun,1,2) já cobre a sentinela '5400007' -> '54' automaticamente
            -- (é um código de 7 díg. como outro qualquer). Só quando df_mun vem em branco (e
            -- só se soube a UF, não o município) é que caímos no V4260 -- que TAMBÉM precisa
            -- do '29' explícito (Brasil sem especificação) antes do uf_seq_2000 genérico, pelo
            -- mesmo motivo do nasc_uf acima (MAPEAMENTO §6). NULL quando df_local <> '2'
            -- (não migrante de data fixa, ou migrante internacional).
            CASE
                WHEN df_local IS DISTINCT FROM '2' THEN NULL
                WHEN df_mun IS NOT NULL            THEN SUBSTR(df_mun, 1, 2)
                WHEN v4260 = '29'                  THEN '54'
                ELSE uf_seq_2000(v4260)
            END                                                              AS df_uf,

            CAST(NULL AS VARCHAR)                                           AS nasc_mun,   -- Censo 2000 não coleta município de nascimento
            CAST(NULL AS VARCHAR)                                           AS nasc_pais,  -- não usado a jusante
            CAST(NULL AS VARCHAR)                                           AS df_pais,    -- não usado a jusante

            NULLIF(TRIM(SUBSTR(linha, 151, 1)), '')                         AS freq_escolar,
            NULLIF(TRIM(SUBSTR(linha, 153, 2)), '')                         AS curso,
            CAST(NULL AS VARCHAR)                                           AS nivel_instr_7, -- não usado a jusante

            -- nivel_instr_4: DERIVADO de V4300 (anos de estudo) -- Censo 2000 não tem
            -- variável de nível de instrução pronta (ver MAPEAMENTO §5). Cortes-padrão do
            -- IBGE: 8 anos = fundamental completo, 11 = médio completo, 15 = superior
            -- completo; '30' (alfabetização de adultos) conta como "sem instrução ou
            -- fundamental incompleto".
            CASE
                WHEN v4300 IN ('00', '01', '02', '03', '04', '05', '06', '07', '30') THEN '1'
                WHEN v4300 IN ('08', '09', '10')                                     THEN '2'
                WHEN v4300 IN ('11', '12', '13', '14')                               THEN '3'
                WHEN v4300 IN ('15', '16', '17')                                     THEN '4'
                WHEN v4300 = '20'                                                    THEN '5'
            END                                                              AS nivel_instr_4,
            -- anos_estudo: só para QA da derivação acima -- NULL para os códigos especiais
            -- '20' (não determinado) e '30' (alfabetização de adultos), que não são contagens.
            CASE
                WHEN v4300 IN ('20', '30') THEN NULL
                ELSE TRY_CAST(v4300 AS INTEGER)
            END                                                              AS anos_estudo,

            -- ocupado_10: cascata V0439..V0443 (cada quesito só é feito a quem respondeu
            -- "não" no anterior) -- análogo de P0960/2022 e V6920/2010. '1' se qualquer uma
            -- for '1'; '2' se as 5 vierem preenchidas e nenhuma for '1' (só possível se a
            -- pessoa respondeu "não" às 5); NULL (as 5 em branco) para menores de 10 anos.
            CASE
                WHEN v0439 = '1' OR v0440 = '1' OR v0441 = '1' OR v0442 = '1' OR v0443 = '1' THEN '1'
                WHEN v0439 IS NOT NULL AND v0440 IS NOT NULL AND v0441 IS NOT NULL
                     AND v0442 IS NOT NULL AND v0443 IS NOT NULL                             THEN '2'
            END                                                              AS ocupado_10,

            -- classe_v4276: categoriza o quesito 4.27 (um só para trabalho E estudo -- ver
            -- MAPEAMENTO §3). ATENÇÃO: '0100008' e '0200006' também casam com o teste
            -- genérico SUBSTR(...,3,4)='0000' usado para as 27 sentinelas de UF sem
            -- especificação -- por isso precisam ser testados ANTES desse teste genérico.
            -- País ('80xxxxx') testado antes do teste genérico por segurança, embora nenhuma
            -- UF real comece por 80.
            CASE
                WHEN v4276 = '0100008' OR v4276 = cd_mun         THEN 'neste_mun'
                WHEN v4276 = '0200006'                            THEN 'nada'
                WHEN SUBSTR(v4276, 1, 2) = '80'                   THEN 'pais'
                WHEN v4276 IS NOT NULL AND SUBSTR(v4276, 3, 4) <> '0000' THEN 'outro_mun'
                WHEN SUBSTR(v4276, 3, 4) = '0000'                 THEN 'sem_especificacao'
            END                                                              AS classe_v4276,

            -- ===== trabalho/estudo: universos disjuntos (ver MAPEAMENTO §3) =====
            -- Ocupados (ocupado_10='1'): V4276 é o município de TRABALHO -> estudo_* fica
            -- NULL estruturalmente (a informação simplesmente não existe no dado -- um NULL
            -- diz isso melhor que um filtro a jusante).
            CASE
                WHEN ocupado_10 = '1'                                    THEN NULL
                WHEN classe_v4276 = 'neste_mun'                          THEN '1'
                WHEN classe_v4276 IN ('outro_mun', 'sem_especificacao')  THEN '2'
                WHEN classe_v4276 = 'pais'                               THEN '3'
            END                                                              AS estudo_local,
            CASE
                WHEN ocupado_10 = '1'                                   THEN NULL
                WHEN classe_v4276 IN ('outro_mun', 'sem_especificacao') THEN SUBSTR(v4276, 1, 2)
            END                                                              AS estudo_uf,
            CASE
                WHEN ocupado_10 = '1'                                   THEN NULL
                WHEN classe_v4276 IN ('outro_mun', 'sem_especificacao') THEN v4276
            END                                                              AS estudo_mun,
            CAST(NULL AS VARCHAR)                                           AS estudo_pais, -- não usado a jusante

            NULLIF(TRIM(SUBSTR(linha, 199, 1)), '')                         AS pos_ocup,
            -- pos_ocup2 (V0448): só preenchida quando pos_ocup='4' -- distingue estatutário/
            -- militar de "empregado sem carteira" dentro do 02_classify (§2, pos_grupo). Não
            -- faz parte do contrato de 49 colunas de pessoas_classificado.parquet: é plumbing
            -- interna, só entre este script e pipeline/sql/2000/02_classify.sql.
            NULLIF(TRIM(SUBSTR(linha, 201, 1)), '')                         AS pos_ocup2,
            NULLIF(TRIM(SUBSTR(linha, 193, 5)), '')                         AS atividade,    -- V4462, CNAE-Dom 1.0
            NULLIF(TRIM(SUBSTR(linha, 188, 4)), '')                         AS grande_grupo, -- V4452, CBO-Dom 2000
            -- renda_trab já em salários mínimos de julho/2000 (V4514, 2 decimais implícitos)
            TRY_CAST(NULLIF(TRIM(SUBSTR(linha, 222, 6)), '') AS DOUBLE) / 1e2 AS renda_trab,
            CAST(NULL AS DOUBLE)                                           AS renda_todas_fontes, -- não usado a jusante

            -- trab_*: só para ocupados. '1' (em casa/na propriedade) e '5' (vários
            -- municípios) NUNCA ocorrem em 2000 -- a quadrícula "NESTE MUNICÍPIO" de 4.27 não
            -- distingue as duas, e não há categoria "vários municípios" (ver MAPEAMENTO §3).
            CASE
                WHEN ocupado_10 IS DISTINCT FROM '1'                     THEN NULL
                WHEN classe_v4276 = 'neste_mun'                          THEN '2'
                WHEN classe_v4276 IN ('outro_mun', 'sem_especificacao')  THEN '3'
                WHEN classe_v4276 = 'pais'                               THEN '4'
            END                                                              AS trab_local,
            CASE
                WHEN ocupado_10 IS DISTINCT FROM '1'                    THEN NULL
                WHEN classe_v4276 IN ('outro_mun', 'sem_especificacao') THEN SUBSTR(v4276, 1, 2)
            END                                                              AS trab_uf,
            CASE
                WHEN ocupado_10 IS DISTINCT FROM '1'                    THEN NULL
                WHEN classe_v4276 IN ('outro_mun', 'sem_especificacao') THEN v4276
            END                                                              AS trab_mun,
            CAST(NULL AS VARCHAR)                                           AS trab_pais,  -- não usado a jusante

            CAST(NULL AS VARCHAR)                                           AS retorna_3dias,    -- inexistente em 2000
            CAST(NULL AS VARCHAR)                                           AS transporte,       -- inexistente em 2000
            CAST(NULL AS VARCHAR)                                           AS tempo_desloc_cat, -- inexistente em 2000
            CAST(NULL AS INTEGER)                                          AS tempo_desloc_min, -- inexistente em 2000

            -- marcas de imputação (M0424/M4250/M4276): PREENCHIDAS em 2000 (diferente de
            -- 2010, que não tinha essas marcas) -- uso interno de QA, nunca publicadas.
            NULLIF(TRIM(SUBSTR(linha, 129, 1)), '')                         AS imp_df_local,
            NULLIF(TRIM(SUBSTR(linha, 137, 1)), '')                         AS imp_df_mun,
            NULLIF(TRIM(SUBSTR(linha, 148, 1)), '')                         AS imp_trab_mun
        FROM pessoas_linhas
    ) x
) TO 'data/interim/2000/pessoas.parquet' (FORMAT PARQUET);

-- ---------- domicilios.parquet ----------
-- Denominador de renda_pc: nº de moradores POR controle com V0402 (relação com a pessoa
-- responsável) NOT IN ('09','10','11') -- exclui pensionista/empregado doméstico/parente do
-- empregado doméstico, que V7617 já exclui do NUMERADOR (ver MAPEAMENTO §4). V0402 é
-- (71,2) em pessoas; a chave de junção usa a MESMA posição de AREAP de pessoas (51), porque
-- esta contagem roda sobre pessoas_linhas.
CREATE OR REPLACE TEMP VIEW moradores_elegiveis AS
    SELECT
        SUBSTR(linha, 51, 13) || SUBSTR(linha, 39, 8) AS controle,
        COUNT(*) AS n_elegiveis
    FROM pessoas_linhas
    WHERE SUBSTR(linha, 71, 2) NOT IN ('09', '10', '11')
    GROUP BY 1;

COPY (
    WITH linhas AS (
        SELECT linha FROM (
            SELECT linha FROM read_csv('data/raw2000/AC/Dom12.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
            UNION ALL
            SELECT linha FROM read_csv('data/raw2000/AL/DOM27.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
            UNION ALL
            SELECT linha FROM read_csv('data/raw2000/AM/Dom13.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
            UNION ALL
            SELECT linha FROM read_csv('data/raw2000/AP/Dom16.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
            UNION ALL
            -- BA: DOM29.txt não é zipado (diferente de PES29.zip) -- .txt direto.
            SELECT linha FROM read_csv('data/raw2000/BA/DOM29.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
            UNION ALL
            SELECT linha FROM read_csv('data/raw2000/CE/DOM23.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
            UNION ALL
            SELECT linha FROM read_csv('data/raw2000/DF/DOM53.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
            UNION ALL
            SELECT linha FROM read_csv('data/raw2000/ES/Dom32.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
            UNION ALL
            SELECT linha FROM read_csv('data/raw2000/GO/DOM52.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
            UNION ALL
            SELECT linha FROM read_csv('data/raw2000/MA/DOM21.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
            UNION ALL
            SELECT linha FROM read_csv('data/raw2000/MG/Dom31.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
            UNION ALL
            SELECT linha FROM read_csv('data/raw2000/MS/DOM50.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
            UNION ALL
            SELECT linha FROM read_csv('data/raw2000/MT/DOM51.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
            UNION ALL
            SELECT linha FROM read_csv('data/raw2000/PA/Dom15.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
            UNION ALL
            SELECT linha FROM read_csv('data/raw2000/PB/DOM25.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
            UNION ALL
            SELECT linha FROM read_csv('data/raw2000/PE/DOM26.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
            UNION ALL
            SELECT linha FROM read_csv('data/raw2000/PI/DOM22.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
            UNION ALL
            SELECT linha FROM read_csv('data/raw2000/PR/DOM41.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
            UNION ALL
            SELECT linha FROM read_csv('data/raw2000/RJ/Dom33.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
            UNION ALL
            -- RN: só DOM24.txt (código correto de RN). DOM25.txt em RN/ é duplicata da PB -- não usar.
            SELECT linha FROM read_csv('data/raw2000/RN/DOM24.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
            UNION ALL
            SELECT linha FROM read_csv('data/raw2000/RO/Dom11.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
            UNION ALL
            SELECT linha FROM read_csv('data/raw2000/RR/Dom14.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
            UNION ALL
            SELECT linha FROM read_csv('data/raw2000/RS/DOM43.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
            UNION ALL
            SELECT linha FROM read_csv('data/raw2000/SC/DOM42.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
            UNION ALL
            SELECT linha FROM read_csv('data/raw2000/SE/DOM28.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
            UNION ALL
            SELECT linha FROM read_csv('data/raw2000/SP/Dom35.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
            UNION ALL
            SELECT linha FROM read_csv('data/raw2000/TO/Dom17.txt', delim=chr(1), header=false, quote='', columns={'linha': 'VARCHAR'})
        ) t
        WHERE LENGTH(linha) >= 167
    ), base AS (
        SELECT
            linha,
            SUBSTR(linha, 1, 2)                            AS uf,
            SUBSTR(linha, 12, 7)                           AS cd_mun,
            SUBSTR(linha, 52, 13)                          AS cd_apond,
            -- controle = AREAP (domicílios: posição 52) || V0300 (39,8) -- ATENÇÃO à posição
            -- de AREAP, diferente da de pessoas (51).
            SUBSTR(linha, 52, 13) || SUBSTR(linha, 39, 8)  AS controle,
            NULLIF(TRIM(SUBSTR(linha, 72, 1)), '')         AS tipo_domicilio
        FROM linhas
    )
    SELECT
        b.uf, b.cd_mun, b.cd_apond, b.controle, b.tipo_domicilio,
        -- renda_pc: V7617 (renda domiciliar em SM, 2 decimais implícitos) / moradores
        -- elegíveis -- NUNCA V7100 cru (ver MAPEAMENTO §4). NULL para domicílio coletivo
        -- (tipo_domicilio='3'), vira 'nao_aplicavel' no 02_classify.
        CASE
            WHEN b.tipo_domicilio IN ('1', '2') THEN
                TRY_CAST(NULLIF(TRIM(SUBSTR(b.linha, 151, 6)), '') AS DOUBLE) / 1e2
                / NULLIF(me.n_elegiveis, 0)
        END AS renda_pc
    FROM base b
    LEFT JOIN moradores_elegiveis me USING (controle)
) TO 'data/interim/2000/domicilios.parquet' (FORMAT PARQUET);

-- ---------- domicilios_apond.parquet (denominador do estimador de variância) ----------
COPY (
    SELECT cd_apond, COUNT(*) AS n_h
    FROM read_parquet('data/interim/2000/domicilios.parquet')
    GROUP BY cd_apond
) TO 'data/interim/2000/domicilios_apond.parquet' (FORMAT PARQUET);
