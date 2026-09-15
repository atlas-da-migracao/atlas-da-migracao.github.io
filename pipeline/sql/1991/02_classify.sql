-- ============================================================================================
-- Cabeçalho para pipeline/sql/1991/02_classify.sql -- colar VERBATIM no topo do arquivo.
-- Escrito pelo agente `metodologo`; a especificação coluna a coluna que ele acompanha está em
-- pipeline/sql/1991/MAPEAMENTO_02_classify.md, e a justificativa em prosa em
-- docs/METODOLOGIA.md, seção "Edição Censo 1991 e comparabilidade" (rascunho em
-- pipeline/sql/1991/RASCUNHO_METODOLOGIA.md até F7.7).
-- ============================================================================================

-- F2 (edição Censo 1991): classificação de status migratório, escolaridade, renda e idade/sexo.
-- Override de pipeline/sql/02_classify.sql. Produz data/interim/1991/pessoas_classificado.parquet
-- com EXATAMENTE as mesmas 49 colunas (mesmo nome, mesma ordem, mesmo tipo) das edições 2022,
-- 2010 e 2000, para que 03_indicators.sql e 04_flows.sql sejam reaproveitados sem override.
--
-- Referência de data fixa: 01/09/1986 -> 01/09/1991 (quinquênio exato). Salário mínimo de
-- referência: Cr$ 36.161,60 (ver ponto 4). ESTA É A PRIMEIRA EDIÇÃO EM QUE A RENDA NÃO VEM
-- PRONTA EM SALÁRIOS MÍNIMOS: RPRINCIV e RDOMICIV estão em Cruzeiros correntes e são divididos
-- pelo SM de referência aqui. Os cortes relativos (1/4, 1/2, 1, 2 SM) continuam idênticos aos
-- das outras três edições; nenhum deflator é usado.
--
-- Fonte das posições/códigos: pipeline/layout_1991.py e pipeline/labels_1991.py (gerados por
-- pipeline/gen_edicao_1991.py a partir do header dBase III e da DTB), mais a documentação
-- PÚBLICA do IBGE em data/raw1991/:
--   - Documentação/Dicionário 1991.xls (categorias, NSA e ignorado de cada variável)
--   - LEIA_ME.DOC (contagem oficial de domicílios e pessoas por UF -- usado para validar a
--     reconstrução da chave de domicílio)
--   - Instrumentos de Coleta/{Questionário da Amostra.pdf, Manual do Recenseador.pdf}
--   - Arquivos Auxiliares/{FRACAMO.TXT, CÓDIGO ATIVIDADE.TXT, OCUPAÇÃO PRINCIPAL.TXT}
--   - Divisisão Territorial do Brasil/DTB Municipios 1991.xls
-- Todas as afirmações quantitativas abaixo vêm de consultas AGREGADAS (contagens, somas de peso,
-- percentis, cruzamentos com n >= 5) sobre data/interim/1991/raw_txt/*.txt.
--
-- O que MUDA em relação a 2022 (cada ponto está comentado no bloco correspondente):
--   1. O CENSO 1991 TEM O MUNICÍPIO DE ORIGEM DA MIGRAÇÃO DE DATA FIXA -- e a documentação
--      anterior do projeto dizia o contrário. docs/EDICOES.md (aviso 2) e o plano registravam,
--      por antecipação, que 1991 perguntaria "apenas a UF ou o país" de residência 5 anos antes,
--      "o que inviabiliza a matriz origem->destino municipal". ESTÁ ERRADO. O par correto é
--      MIMO86UF (397,2) + MIMO86MU (393,4), e a matriz municipal é publicável. A edição 1991 NÃO
--      fica restrita aos níveis UF/RGInt.
--   2. `df_local` VEM DE UMA VARIÁVEL SÓ, com o branco como skip pattern. MIMO86UF branco ou '0'
--      (NSA) ou '70' ("neste município") -> não migrante; '11'..'53' -> migrante interno;
--      '80' ("país estrangeiro ou mal definido") -> internacional; '54' ("Brasil não
--      especificado") e '99' ("ignorado") -> migrante interno com origem não informada. O branco
--      é o skip do questionário, não uma não-resposta: o quesito só foi feito a quem NÃO
--      respondeu "sempre morou neste município" (MINASCMU=1) e só a partir de 5 anos de idade.
--      Confirmado em cruzamento NACIONAL exaustivo MIMO86UF x MINASCMU x (idade<5): zero
--      registros com MIMO86UF branco, MINASCMU<>1 e idade>=5; zero registros com MINASCMU=1 e
--      MIMO86UF preenchido. O COALESCE para "não migrante" segue obrigatório, como em 2022/2010/
--      2000. Resultado: 10,68% dos residentes de 5 anos ou mais são migrantes internos de data
--      fixa (Sigma peso 13.916.688 de 130.283.012), 9,48% da população total. Dentro da faixa
--      esperada; NÃO cross-checado contra tabulação publicada do IBGE (ver MAPEAMENTO §2.3).
--   3. O CÓDIGO DE ORIGEM É `MIMO86UF || MIMO86MU`, NUNCA `UFNUM || MIMO86MU`. MIMO86MU é o
--      município DENTRO da UF de MIMO86UF, não da UF de residência. E os campos numéricos do
--      dBase vêm alinhados à direita com espaços ("   5", não "0005"), então o código só se forma
--      com LPAD(TRIM(MIMO86MU),4,'0'). Sem o LPAD, 52% das origens "não casam" com o dicionário;
--      com ele, casam 100% -- 1.551.374 registros com par, ZERO sem par, 49.404 com MIMO86MU
--      '0000' (UF sem especificação) e nenhum com '9999' (NSA). O join é pelos 6 PRIMEIROS
--      dígitos das chaves de MUNICIPIOS_1991 (que têm 7, com dígito verificador): a bijeção foi
--      verificada, 4.491 prefixos distintos para 4.491 municípios.
--   4. SALÁRIO MÍNIMO DE REFERÊNCIA = Cr$ 36.161,60, E NÃO OS Cr$ 17.000 NEM OS Cr$ 42.000 QUE O
--      PLANO SUPUNHA. O valor foi recuperado por reconciliação com as faixas que o próprio IBGE
--      calculou: RPRINCIF (452,2) é a renda da ocupação principal em 13 faixas de SM, e RDONOMIF
--      (245,2) é a renda domiciliar em 11 faixas. Dividindo os limites observados de RPRINCIV
--      (454,7) pelos candidatos, Cr$ 36.161,60 reproduz 13/13 faixas; Cr$ 17.000 reproduz 1/13;
--      Cr$ 42.000 reproduz 1/13. Confirmação independente pelo lado do domicílio: 11/11 faixas de
--      RDONOMIF x RDOMICIV, e o par (faixa 3 termina em 36.161 / faixa 4 começa em 36.164) crava
--      o limite de 1 SM entre esses dois valores. Ressalva: derivado dos dados, não cross-checado
--      contra a legislação de 1991 (ver MAPEAMENTO §7). Consequências: renda_trab =
--      RPRINCIV/36161.60 (NULL para 9999998 NSA e 9999999 ignorado -- ATENÇÃO, 7 dígitos, não 9);
--      renda_pc = RDOMICIV/36161.60/<moradores elegíveis> (NULL para 999999998/999999999 -- estes
--      sim com 9 dígitos). RPRINCIF=14 ("sem rendimento") vem com RPRINCIV=0 e produz
--      renda_trab=0, não NULL: sem rendimento é um valor medido.
--   5. `renda_pc` É CONSTRUÍDA, e o denominador exclui pensionistas e empregados domésticos --
--      mesma armadilha de 2000, aqui VERIFICADA e não presumida. Comparando RDOMICIV com a soma
--      de RTOTALPV dos moradores do domicílio: excluindo PARENDOM IN (14,15,16) a identidade
--      fecha em 4.892/4.892 domicílios particulares de RR (100%); incluindo-os, fecha em 4.824
--      (98,6%), e entre os 75 domicílios que de fato têm pensionista ou empregado residente,
--      apenas 7/75. RDOMICIV exclui essas pessoas do numerador; o denominador tem de excluí-las
--      também, senão a renda per capita é subestimada exatamente nos domicílios de renda mais
--      alta. Domicílio coletivo (ESPECIE='3', 74.902 registros) -> NULL -> 'nao_aplicavel'.
--   6. ESTRATO DE VARIÂNCIA APROXIMADO: NÃO HÁ ÁREA DE PONDERAÇÃO EM 1991. cd_apond =
--      cd_mun || CASE WHEN SITSET IN ('1','2','3') THEN 'U' ELSE 'R' END (SITSET: 1-3 urbano,
--      4-8 rural). SITSET está SEMPRE preenchida e sempre em 1-8 -- zero nulos, zero '0', zero
--      '9' --, então o ELSE 'R' é seguro. Resultado: 8.939 estratos (2000 tem 9.336 áreas de
--      ponderação), mediana de 877 registros por estrato, 1 estrato com menos de 5 registros.
--      ISTO É UMA APROXIMAÇÃO, não o desenho amostral do IBGE: o estrato é mais heterogêneo que
--      uma área de ponderação real, o que tende a INFLAR a variância estimada (erro conservador).
--      A validação só pode ser feita depois de o pipeline rodar -- comparar a distribuição do CV
--      dos fluxos de 1991 com a de 2000, critério de +/-10 p.p. na mediana e na média. SE
--      REPROVAR, a decisão já registrada é publicar `se` e `cv` como NULL em toda a edição 1991.
--   7. `nivel_instr_4` É DERIVADO de EDANOEST (303,2), como em 2000 -- 1991 não tem variável de
--      nível de instrução pronta. Cortes-padrão do IBGE: 0-7 e 30 -> '1'; 8-10 -> '2';
--      11-14 -> '3'; 15-17 -> '4'; 20 -> '5'. O código 30 ("alfabetização de adultos", 51.666
--      registros entre os 25+) vai para '1' (sem instrução/fundamental incompleto), NÃO para
--      NULL: é uma categoria conhecida, e mandá-la para NULL a misturaria com a desconhecida e
--      criaria divergência artificial frente a 2000, que já a trata assim. EDANOEST=31 (NSA) não
--      ocorre: a variável está preenchida para toda a população. Universo de edu_grupo: 25+,
--      com o CASE idêntico ao das outras edições.
--   8. `status` tem o vocabulário REDUZIDO de 2010/2000. MINASCMU (402,1) dá o local de
--      nascimento em 3 valores (1 sempre morou / 2 morou em outro / 3 não nasceu aqui), e 1 e 2
--      significam ambos "nascido neste município"; MIUFPAIS (403,2) e MINACION (401,1) são
--      BRANCAS para MINASCMU IN (1,2) -- daí o COALESCE(nacionalidade,'1') obrigatório. Sem o
--      município de nascimento, primeira_saida e etapas_multiplas são indistinguíveis e colapsam
--      em nao_natural. `retorno_natal` é medido pelo próprio quesito: entre migrantes,
--      nasc_local='1' só pode vir de MINASCMU=2. CUIDADO com MIUFPAIS: é um SEQUENCIAL 1-27, não
--      o código IBGE -- usar UF_SEQ_1991, cuja entrada '16' aponta para '29' (BA); o dicionário
--      do IBGE traz "SE" em 15 e em 16, erro de digitação já corrigido no módulo gerado.
--      MIUFPAIS=29 é "Brasil sem especificação" (não é país) -> nasc_local='2', nasc_uf=NULL;
--      MIUFPAIS=100 ("NSA") não ocorre, o NSA é o branco.
--   9. 1991 NÃO USA SENTINELA DE ORIGEM DESCONHECIDA -- usa NULL. Em 2010 a sentinela é
--      UF||'99999'; em 2000, os 27 códigos com SUBSTR(cod,3,4)='0000'. Em 1991 as sentinelas
--      ('54', '99', MIMO86MU='0000') NÃO vivem no espaço de códigos de município, e fabricar um
--      código de 7 dígitos criaria um valor inexistente em MUNICIPIOS_1991 que poderia vazar num
--      JOIN mal guardado. Então df_uf e df_mun ficam NULL, e as derivadas testam IS NOT NULL:
--      origem_conhecida = df_local='2' AND df_mun IS NOT NULL;
--      origem_valida    = origem_conhecida AND df_mun <> cd_mun;
--      interestadual    = df_local='2' AND df_uf IS NOT NULL AND df_uf <> uf.
--      Seguro a jusante: 03_indicators.sql e 04_flows.sql só usam df_mun sob origem_valida.
--  10. NÃO HÁ DESLOCAMENTO PENDULAR NESTA EDIÇÃO. O questionário da amostra de 1991 não pergunta
--      em que município a pessoa trabalha ou estuda. ARMADILHA: LOCTRAB (379,1) NÃO é município
--      de trabalho -- é o TIPO de local (1/2 no domicílio, 3/4 via pública, 5 propriedade
--      agropecuária, 6 empresa ou firma, 7 casa do cliente/patrão, 8 outro, 9 NSA). Não usar
--      para nada de pendular, nem como proxy. Ficam NULL: trab_local, trab_uf, trab_mun,
--      estudo_local, estudo_uf, estudo_mun, curso, retorna_3dias, transporte, tempo_desloc_cat,
--      tempo_desloc_min, pos_grupo, setor_grupo, ocup_grupo, modo_grupo, renda_trab_classe,
--      curso_grupo, e pendular_trab/pendular_estudo como CAST(NULL AS BOOLEAN) -- NULL, nunca
--      FALSE: "não medido" não é "medido e negativo". Frente a 2000, que só deixa nulas
--      retorna_3dias/transporte/tempo_desloc_cat/tempo_desloc_min/modo_grupo, são 16 colunas a
--      mais (as 14 acima + imp_df_local + imp_df_mun).
--  11. SEGUNDA ARMADILHA DE MIGRAÇÃO: MIANMOMU (380,2, "anos que mora no município"), MIANMOUF
--      (382,2) e MIULTMUD (405,2, "última mudança") NÃO servem para identificar migrante de data
--      fixa -- é a mesma armadilha do V0416 de 2000 e do V0624 de 2010 (contam tempo desde o
--      último retorno/última mudança, não a posição em 01/09/1986). A identificação correta é SÓ
--      por MIMO86UF/MIMO86MU.
--  12. ÚLTIMA ETAPA MIGRATÓRIA: EXISTE E NÃO É PUBLICADA. MIANTEUF (390,2) e MIANTEMU (386,4)
--      dão a UF e o município da residência imediatamente anterior -- conceito que 2000, 2010 e
--      2022 não têm no contrato publicado. DECISÃO: não vira coluna do contrato. Publicá-la
--      criaria um eixo sem par em nenhuma outra edição e ambiguidade sobre qual é "a" origem de
--      um migrante de 1991. Fica registrada como material disponível para análise futura --
--      mesma regra da zona urbano/rural da moradia anterior em 2000 (V0424) e do seu análogo
--      exato aqui, MIMO86ZN (399,1).
--  13. RAÇA/COR NÃO É PUBLICADA, embora RACACOR (422,1) exista e esteja bem preenchida. O
--      contrato de 49 colunas não tem coluna de raça/cor em NENHUMA das três edições já
--      publicadas (esquemas conferidos). Introduzi-la só em 1991 quebraria o contrato, daria um
--      recorte disponível numa edição e ausente nas outras, e exigiria calibrar as regras R1-R9
--      para uma dimensão nova. Se o atlas quiser essa dimensão, ela entra por todas as edições
--      de uma vez.
--  14. `ocupado` É DERIVADO de POSOCUP (420,2): ocupado = POSOCUP entre 1 e 11 (0/branco = NSA).
--      Universo verificado: MIN(idade) entre ocupados = 10, e POSOCUP IN (1..11) <=> RPRINCIF IN
--      (1..15) com ZERO discordância em 6,97 milhões de registros -- mesmo universo de P0960/2022,
--      V6920/2010 e da cascata V0439..V0443 de 2000. `estudante` vem de EDGRAU (308,1) entre 1 e
--      5 ou EDCURSNS (305,1) entre 1 e 6; 1991 não separa rede pública de particular como 2010 e
--      2000 fazem, mas o contrato só precisa de "frequenta / não frequenta".
--  15. ARMADILHAS DE LEITURA DO ARQUIVO (todas no MAPEAMENTO §0, repetidas aqui porque quebram
--      silenciosamente):
--      (a) PESO (223,12) JÁ TRAZ O PONTO DECIMAL -- peso = TRY_CAST(... AS DOUBLE), SEM dividir
--          por 1e7 (em 2000 o divisor é 1e8 e em 2010 é 1e13; NÃO copiar). Validação:
--          Sigma peso = 146.815.790 contra os 146.825.475 do Censo 1991 (-0,007%).
--      (b) cd_mun do arquivo tem 6 DÍGITOS (UFNUM(41,2) || MUNICNUM(170,4)), sem o verificador --
--          o código de 7 dígitos do contrato vem do join com MUNICIPIOS_1991.
--      (c) ARQUIVO ÚNICO: as variáveis de domicílio (ESPECIE, SITSET, RDOMICIV, PESO) vêm
--          replicadas em cada linha de pessoa. Não há LEFT JOIN por controle como em 2000/2010/
--          2022; o GROUP BY controle só é necessário para o denominador da renda per capita.
--      (d) LRECL: 492 bytes de dados + 9 de controle = 501 caracteres por linha lida (o \n não
--          entra). Ler com read_csv(delim=chr(1), header=false, quote='',
--          columns={'linha':'VARCHAR'}).
--      (e) *** BLOQUEANTE: O CAMPO `controle` GRAVADO NOS TXT ESTÁ ERRADO. ***
--          scripts/prep_1991.py incrementa o contador de domicílio quando PESSOAN=1, mas o
--          fallback de posição (380,1) -- que é o primeiro dígito de MIANMOMU -- foi o que valeu.
--          PESSOAN está em (418,2). O controle atual dá 1.726.116 domicílios; o correto é
--          4.024.553, que é exatamente COUNT(PARENDOM=1) + COUNT(PARENDOM=20) = 3.971.593 +
--          52.960, e bate com o LEIA_ME.DOC UF a UF (RR: 5.486 domicílios / 23.102 pessoas).
--          Média resultante: 4,24 pessoas por domicílio (com o controle atual, 9,88). `controle`
--          é a UPA do estimador de variância -- com a chave errada, se/cv de TODA a edição saem
--          inválidos, e o denominador da renda per capita também. CORRIGIR prep_1991.py e
--          REGERAR os 27 TXT antes de rodar 01_extract.sql.
PRAGMA threads = 10;
PRAGMA memory_limit = '16GB';

-- ---------- denominador da renda per capita (§4): moradores elegíveis por domicílio ----------
-- PARENDOM 14 (pensionista), 15 (empregado doméstico) e 16 (parente do empregado doméstico) são
-- excluídos -- RDOMICIV já os exclui do numerador (ver ponto 5 acima), e usar o total de
-- moradores como denominador subestimaria a renda per capita justamente nos domicílios de renda
-- mais alta (os que têm empregado doméstico residente).
CREATE OR REPLACE TEMP VIEW moradores_elegiveis AS
    SELECT controle, COUNT(*) AS n_elegiveis
    FROM read_parquet('data/interim/1991/pessoas.parquet')
    WHERE parendom NOT IN (14, 15, 16)
    GROUP BY controle;

COPY (
    WITH base AS (
        SELECT
            p.uf, p.cd_mun, p.cd_apond, p.controle, p.peso, p.sexo, p.idade,
            p.df_local, p.df_uf, p.df_mun,
            p.nasc_local, p.nasc_uf, p.nacionalidade,
            p.nivel_instr_4,
            p.renda_trab,
            p.freq_escolar,
            p.ocupado_10,
            -- renda_pc: renda_dom (RDOMICIV/36161.60, já sem pensionista/empregado doméstico no
            -- numerador -- calculado em 01_extract.sql) dividida pelos moradores elegíveis do
            -- mesmo domicílio (mesma exclusão no denominador). NULL para domicílio coletivo
            -- (tipo_domicilio='3') ou quando renda_dom é NULL (NSA/ignorado).
            CASE
                WHEN p.tipo_domicilio IN ('1', '2') THEN p.renda_dom / NULLIF(me.n_elegiveis, 0)
            END                                                              AS renda_pc
        FROM read_parquet('data/interim/1991/pessoas.parquet') p
        LEFT JOIN moradores_elegiveis me USING (controle)
    )
    SELECT
        uf, cd_mun, cd_apond, controle, peso, idade, df_mun, df_uf, nivel_instr_4, renda_pc,

        -- ================= colunas 11-20: inexistentes em 1991 (§8) =================
        CAST(NULL AS VARCHAR)  AS imp_df_local,     -- 1991 não divulga marcas de imputação
        CAST(NULL AS VARCHAR)  AS imp_df_mun,       -- idem
        CAST(NULL AS VARCHAR)  AS imp_trab_mun,     -- idem, e não há quesito de município de trabalho
        CAST(NULL AS VARCHAR)  AS trab_local,       -- sem quesito de município de trabalho
        CAST(NULL AS VARCHAR)  AS trab_uf,          -- idem
        CAST(NULL AS VARCHAR)  AS trab_mun,         -- idem
        CAST(NULL AS VARCHAR)  AS retorna_3dias,    -- sem quesito de frequência de retorno
        CAST(NULL AS VARCHAR)  AS transporte,       -- sem quesito de meio de transporte
        CAST(NULL AS VARCHAR)  AS tempo_desloc_cat, -- sem quesito de tempo de deslocamento
        CAST(NULL AS INTEGER)  AS tempo_desloc_min, -- idem

        renda_trab,
        freq_escolar,

        -- ================= colunas 23-26: inexistentes em 1991 (§8) =================
        CAST(NULL AS VARCHAR)  AS curso,        -- dimensão exclusiva do módulo pendular de estudo
        CAST(NULL AS VARCHAR)  AS estudo_local, -- sem quesito de município de estudo
        CAST(NULL AS VARCHAR)  AS estudo_uf,    -- idem
        CAST(NULL AS VARCHAR)  AS estudo_mun,   -- idem

        -- ================= condição de ocupação e frequência escolar =================
        COALESCE(ocupado_10 = '1', FALSE)                                AS ocupado,
        COALESCE(freq_escolar = '1', FALSE)                              AS estudante,

        -- ================= colunas 29-36: sem deslocamento pendular em 1991 (§8) =================
        CAST(NULL AS BOOLEAN)  AS pendular_trab,    -- NULL, nunca FALSE: "não medido" != "medido e negativo"
        CAST(NULL AS BOOLEAN)  AS pendular_estudo,  -- idem
        CAST(NULL AS VARCHAR)  AS pos_grupo,        -- dimensão exclusiva do módulo pendular
        CAST(NULL AS VARCHAR)  AS setor_grupo,      -- idem
        CAST(NULL AS VARCHAR)  AS ocup_grupo,       -- idem
        CAST(NULL AS VARCHAR)  AS modo_grupo,       -- idem, e sem quesito de transporte
        CAST(NULL AS VARCHAR)  AS renda_trab_classe,-- idem
        CAST(NULL AS VARCHAR)  AS curso_grupo,      -- idem

        -- ================= migração de data fixa (01/09/1986) =================
        COALESCE(df_local IN ('2', '3'), FALSE)                          AS is_migrante,
        COALESCE(df_local = '2', FALSE)                                  AS is_mig_interno,
        COALESCE(df_local = '3', FALSE)                                  AS is_mig_internacional,
        -- 1991 usa NULL (não sentinela) para origem desconhecida -- testar IS NOT NULL, não
        -- comparar com um código fabricado (ver ponto 9 acima e MAPEAMENTO §2.5).
        -- ACHADO DO AUDITOR (F7.3): o cruzamento exaustivo do ponto 2 (zero registros com
        -- MIMO86UF preenchido e idade<5) tem 5 exceções residuais (Sigma peso 45,4) -- registros
        -- raros em que o quesito de migração foi preenchido apesar do skip pattern esperado.
        -- Nas outras edições (2022/2010/2000) essa garantia é implícita no desenho do
        -- questionário (o quesito de data fixa nunca é feito a menores de 5 anos); em 1991 ela
        -- precisa ser tornada EXPLÍCITA para que o universo de migrantes de data fixa
        -- (origem_valida, que alimenta fluxos_bruto e emigração) não inclua idade NULL ou <5.
        COALESCE(df_local = '2' AND df_mun IS NOT NULL AND idade >= 5, FALSE)  AS origem_conhecida,
        COALESCE(df_local = '2' AND df_mun IS NOT NULL AND df_mun <> cd_mun AND idade >= 5, FALSE)
                                                                          AS origem_valida,
        COALESCE(df_local = '2' AND df_uf IS NOT NULL AND df_uf <> uf, FALSE)
                                                                          AS interestadual,

        -- ================= status migratório (vocabulário reduzido de 2010/2000) =================
        -- 1991 não coleta o município de nascimento -- primeira_saida/etapas_multiplas são
        -- indistinguíveis e colapsam em nao_natural (ver ponto 8 acima e MAPEAMENTO §3).
        CASE
            WHEN df_local = '3' AND COALESCE(nacionalidade, '1') IN ('1', '2')
                                                                 THEN 'internacional_brasileiro'
            WHEN df_local = '3'                                  THEN 'internacional_estrangeiro'
            WHEN df_local = '2' AND nasc_local = '1'             THEN 'retorno_natal'
            WHEN df_local = '2' AND nasc_local = '3'             THEN 'nascido_exterior'
            WHEN df_local = '2' AND df_mun IS NULL               THEN 'origem_nao_informada'
            WHEN df_local = '2' AND nasc_local = '2'             THEN 'nao_natural'
            WHEN df_local = '2'                                  THEN 'outro'
            ELSE NULL
        END                                                             AS status,

        -- Retorno à UF de nascimento -- mesma forma de 2010/2000, trocando a sentinela por
        -- IS NOT NULL (ver MAPEAMENTO §3).
        COALESCE(df_local = '2' AND nasc_local = '2' AND nasc_uf = uf
             AND df_uf IS NOT NULL AND df_uf <> uf, FALSE)               AS retorno_uf_natal,

        -- ================= escolaridade =================
        -- edu_grupo: MESMO CASE de 2022/2010/2000, sem alteração -- só muda a origem de
        -- nivel_instr_4 (derivado de EDANOEST em 01_extract.sql, ver MAPEAMENTO §6). Mesma
        -- restrição de universo (25 anos ou mais).
        CASE WHEN idade >= 25 THEN
            CASE nivel_instr_4
                WHEN '1' THEN 'sem_instr_fund_incompleto'
                WHEN '2' THEN 'fund_completo_medio_incompleto'
                WHEN '3' THEN 'medio_completo_superior_incompleto'
                WHEN '4' THEN 'superior_completo'
                ELSE 'nao_determinado'
            END
        END                                                             AS edu_grupo,

        -- ================= renda domiciliar per capita em classes de SM =================
        -- renda_pc já em SM (construída acima -- ver MAPEAMENTO §4). Mesmos cortes de
        -- 2010/2022/2000. NULL = domicílio coletivo (ou renda_dom NSA/ignorada).
        CASE
            WHEN renda_pc IS NULL          THEN 'nao_aplicavel'
            WHEN renda_pc <= 0.25          THEN 'ate_1_4_sm'
            WHEN renda_pc <= 0.50          THEN 'de_1_4_a_1_2_sm'
            WHEN renda_pc <= 1.00          THEN 'de_1_2_a_1_sm'
            WHEN renda_pc <= 2.00          THEN 'de_1_a_2_sm'
            ELSE 'mais_de_2_sm'
        END                                                             AS renda_classe,

        CASE
            WHEN idade IS NULL OR idade < 5 THEN NULL
            WHEN idade < 15 THEN '05_14'
            WHEN idade < 25 THEN '15_24'
            WHEN idade < 40 THEN '25_39'
            WHEN idade < 60 THEN '40_59'
            ELSE '60_mais'
        END                                                             AS idade_grupo,

        -- SEXO: 1 masculino, 2 feminino (sem branco e sem categoria "ignorado" -- verificado).
        CASE sexo WHEN 1 THEN 'M' WHEN 2 THEN 'F' ELSE 'ignorado' END    AS sexo_label,

        CASE
            WHEN idade IS NULL OR idade < 5 THEN NULL
            ELSE (CASE
                    WHEN idade < 15 THEN '05_14'
                    WHEN idade < 25 THEN '15_24'
                    WHEN idade < 40 THEN '25_39'
                    WHEN idade < 60 THEN '40_59'
                    ELSE '60_mais'
                  END)
                 || '_' ||
                 (CASE sexo WHEN 1 THEN 'M' WHEN 2 THEN 'F' ELSE 'I' END)
        END                                                             AS idade_sexo_grupo
    FROM base
) TO 'data/interim/1991/pessoas_classificado.parquet' (FORMAT PARQUET);
