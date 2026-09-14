-- F2 (edição Censo 2010): classificação de status migratório, escolaridade, renda e idade/sexo.
-- Override de pipeline/sql/02_classify.sql. Produz data/interim/2010/pessoas_classificado.parquet
-- com EXATAMENTE as mesmas 49 colunas (mesmo nome, mesma ordem, mesmo tipo) da edição 2022,
-- para que 03_indicators.sql, 04_flows.sql e 07_pendular.sql sejam reaproveitados sem alteração.
--
-- Referência de data fixa: 31/07/2005 -> 31/07/2010 (quinquênio). Salário mínimo de julho/2010:
-- R$ 510,00 -- mas nesta edição a renda já chega em NÚMERO DE SALÁRIOS MÍNIMOS (V6532 e V6514),
-- então os cortes são aplicados diretamente em SM, sem multiplicar por 510 (ver plano, decisão 8).
--
-- Fonte das posições/códigos: pipeline/layout_2010.py (Layout_microdados_Amostra.ods, abas PESS/DOMI)
-- e a documentação pública do IBGE em data/raw2010/Documentação/:
--   - "Descrição das variáveis - Microdados da amostra do Censo Demográfico 2010.pdf"
--   - "Instrumentos de Coleta/Censo demográfico 2010 Amostra.pdf" (fluxo de saltos do questionário)
--   - "Anexos Auxiliares/Migração e deslocamento _{Municípios,Unidades da Federação}.ods"
--   - "Anexos Auxiliares/{Ocupação COD 2010, Atividade CNAE_DOM 2.0 2010}.ods"
--
-- O que MUDA em relação a 2022 (cada ponto está comentado no bloco correspondente):
--   1. `status` tem vocabulário REDUZIDO: 2010 não coleta o município de nascimento, só
--      "nasceu neste município?" (V0618). `primeira_saida` e `etapas_multiplas` são
--      indistinguíveis e viram uma única categoria `nao_natural`.
--   2. Origem "não sabe município" é `UF||'99999'` (uma por UF), não `8888888`/`9999999`.
--   3. `modo_grupo` é sempre NULL: o Censo 2010 não pergunta meio de transporte.
--   4. `tempo_desloc_cat` tem 5 faixas próprias (V0662), não as 8 de 2022 (P1180).
--   5. `tempo_desloc_min` é sempre NULL: 2010 não coleta o tempo em minutos.
--   6. `retorna_3dias` vem de V0661 = "retorna do trabalho para casa DIARIAMENTE" (binário),
--      definição diferente do "3 ou mais dias por semana" de 2022.
--   7. `pos_grupo`, `setor_grupo`, `ocup_grupo` e `curso_grupo` usam classificações de 2010
--      (V6930 7 classes, CNAE-DOM 2.0, COD 2010, V0629 12 classes) recodificadas para o MESMO
--      vocabulário de saída de 2022.
--   8. `renda_pc` e `renda_trab` chegam em SALÁRIOS MÍNIMOS (2022: em reais correntes).
PRAGMA threads = 10;
PRAGMA memory_limit = '16GB';

COPY (
    WITH base AS (
        SELECT
            p.uf, p.cd_mun, p.cd_apond, p.controle, p.peso, p.sexo, p.idade,
            p.df_local, p.df_uf, p.df_mun,
            p.nasc_local, p.nasc_uf, p.nasc_mun, p.nacionalidade,
            p.nivel_instr_4, p.nivel_instr_7, p.anos_estudo,
            p.imp_df_local, p.imp_df_mun, p.imp_trab_mun,
            -- deslocamento pendular (F2b)
            p.ocupado_10, p.pos_ocup, p.atividade, p.grande_grupo, p.renda_trab,
            p.trab_local, p.trab_uf, p.trab_mun, p.retorna_3dias, p.transporte,
            p.tempo_desloc_cat, p.tempo_desloc_min,
            p.freq_escolar, p.curso, p.estudo_local, p.estudo_uf, p.estudo_mun,
            d.renda_pc, d.tipo_domicilio
        FROM read_parquet('data/interim/2010/pessoas.parquet') p
        LEFT JOIN read_parquet('data/interim/2010/domicilios.parquet') d
               ON d.controle = p.controle
    )
    SELECT
        uf, cd_mun, cd_apond, controle, peso, idade, df_mun, df_uf, nivel_instr_4, renda_pc,
        imp_df_local, imp_df_mun, imp_trab_mun,
        trab_local, trab_uf, trab_mun, retorna_3dias, transporte,
        tempo_desloc_cat, tempo_desloc_min, renda_trab,
        freq_escolar, curso, estudo_local, estudo_uf, estudo_mun,
        -- ATENÇÃO (`tempo_desloc_cat`): repassado cru de V0662, com os 5 códigos de 2010
        --   1 até 5 min | 2 de 6 min até meia hora | 3 mais de meia hora até 1 h
        --   4 mais de 1 h até 2 h | 5 mais de 2 h
        -- que NÃO são as 8 faixas de P1180/2022 ('0'..'7'). O CASE que dá nome às faixas vive
        -- em pipeline/sql/07_pendular.sql, e aplicá-lo cru a 2010 rotularia "6 min a meia hora"
        -- como "de_6_a_15min" etc. Antes de publicar 2010 é preciso um override
        -- pipeline/sql/2010/07_pendular.sql com o vocabulário próprio desta edição
        -- (ate_5min / de_6_a_30min / de_31min_a_1h / de_1_a_2h / mais_de_2h) -- ver plano,
        -- decisão arquitetural 6, e a seção de comparabilidade em docs/METODOLOGIA.md.
        -- Universo mais estreito que em 2022: o quesito 6.62 só foi aplicado a quem trabalha
        -- fora do próprio domicílio E retorna para casa diariamente (V0661 = 1).
        -- ATENÇÃO (`retorna_3dias`): é V0661 = "retorna do trabalho para casa DIARIAMENTE"
        -- (1 sim / 2 não), não o "3 ou mais dias por semana" de P1160/2022. Os códigos
        -- coincidem, a definição não -- o rótulo da dimensão `frequencia` tem de mudar em 2010.
        -- `transporte` e `tempo_desloc_min` são sempre NULL (não existem em 2010).

        -- ================= universos do bloco de deslocamento =================
        -- Ocupados: V6920 ("situação de ocupação na semana de referência": 1 Ocupadas,
        -- 2 Não ocupadas, branco só para menores de 10 anos). Universo idêntico ao de
        -- P0960 em 2022 (pessoas de 10 anos ou mais). V6910 ("condição de ocupação",
        -- 1 Ocupadas / 2 Desocupadas) marca o MESMO conjunto de ocupados, mas seu universo
        -- é apenas a população economicamente ativa; V6920 é o análogo direto de P0960.
        COALESCE(ocupado_10 = '1', FALSE)                                AS ocupado,
        -- Estudantes: V0628 distingue escola pública (1) de particular (2), enquanto
        -- P0650 de 2022 é um "sim"/"não". O universo do quesito 6.36 (deslocamento para
        -- estudo) é exatamente V0628 IN ('1','2'), logo o universo é o mesmo de 2022.
        COALESCE(freq_escolar IN ('1', '2'), FALSE)                      AS estudante,
        -- Pendularidade: V0660 usa os MESMOS 5 códigos de P1120 (1 próprio domicílio,
        -- 2 só neste município, 3 outro município, 4 país estrangeiro, 5 mais de um
        -- município/país), então a regra de 2022 vale sem adaptação. Só muda a sentinela
        -- de destino desconhecido: em 2010 é `UF||'99999'` ("UF, NÃO SABE MUNICÍPIO",
        -- inclusive 9899999 = "não sabe UF nem país") além de 8888888 (ignorado na crítica).
        COALESCE(trab_local = '3' AND trab_mun IS NOT NULL AND trab_mun <> '8888888'
                 AND SUBSTR(trab_mun, 3, 5) <> '99999'
                 AND trab_mun <> cd_mun, FALSE)                          AS pendular_trab,
        -- V0636 = 2 ("em outro município") é o mesmo código de P0800 = 2 em 2022.
        COALESCE(estudo_local = '2' AND estudo_mun IS NOT NULL AND estudo_mun <> '8888888'
                 AND SUBSTR(estudo_mun, 3, 5) <> '99999'
                 AND estudo_mun <> cd_mun, FALSE)                        AS pendular_estudo,

        -- ================= posição na ocupação em 5 grupos (V6930) =================
        -- V6930 tem 7 classes contra as 10 de P1020 (2022). Correspondência:
        --   1 empregados com carteira        -> empregado_com_carteira  (P1020 01/03/05)
        --   3 empregados sem carteira        -> empregado_sem_carteira  (P1020 02/04/06)
        --   2 militares e estatutários       -> militar_estatutario     (P1020 07)
        --   5 empregadores                   -> empregador              (P1020 08)
        --   4 conta própria + 6 não remunerados -> conta_propria_familiar (P1020 09/10)
        --   7 trabalhadores na produção para o próprio consumo: sem correspondente em
        --     P1020; agrupado em conta_propria_familiar por ser trabalho por conta própria
        --     não assalariado (categoria residual e muito rara entre pendulares).
        -- Perda de detalhe: 2010 não separa trabalhador doméstico nem setor público/privado
        -- dentro de "com/sem carteira" -- irrelevante aqui, porque 2022 já os agregava.
        CASE
            WHEN pos_ocup = '1'                 THEN 'empregado_com_carteira'
            WHEN pos_ocup = '3'                 THEN 'empregado_sem_carteira'
            WHEN pos_ocup = '2'                 THEN 'militar_estatutario'
            WHEN pos_ocup = '5'                 THEN 'empregador'
            WHEN pos_ocup IN ('4', '6', '7')    THEN 'conta_propria_familiar'
        END                                                              AS pos_grupo,

        -- ================= setor de atividade em 8 grupos (V6471) =================
        -- Em 2022 P1030 já vem agregado nos 22 grupos de atividade, que são exatamente as
        -- 22 seções A..V da CNAE-Domiciliar. Em 2010 V6471 é a CLASSE de 5 dígitos da
        -- CNAE-DOM 2.0; a seção é obtida pela divisão (2 primeiros dígitos). Os intervalos
        -- de divisão abaixo vêm de "Atividade CNAE_DOM 2.0 2010.ods" e reproduzem, seção a
        -- seção, o mesmo agrupamento em 8 classes usado em 2022:
        --   A (01-03) agropecuária | B (05-09) C (10-33) D (35) E (36-39) indústria
        --   F (41-43) construção   | G (45,48) comércio  | H (49-53) transporte
        --   I (55-56) alojamento/alimentação -> outros_servicos (como em 2022)
        --   J (58-63) K (64-66) L (68) M (69-75) N (77-82) -> servicos_empresariais
        --   O (84) P (85) Q (86-88) -> admin_educacao_saude
        --   R (90-93) S (94-96) T (97) U (99) V (00) -> outros_servicos
        CASE
            WHEN atividade IS NULL OR TRIM(atividade) = ''      THEN NULL
            WHEN SUBSTR(atividade, 1, 2) BETWEEN '01' AND '03'  THEN 'agropecuaria'
            WHEN SUBSTR(atividade, 1, 2) BETWEEN '05' AND '39'  THEN 'industria'
            WHEN SUBSTR(atividade, 1, 2) BETWEEN '41' AND '43'  THEN 'construcao'
            WHEN SUBSTR(atividade, 1, 2) IN ('45', '48')        THEN 'comercio'
            WHEN SUBSTR(atividade, 1, 2) BETWEEN '49' AND '53'  THEN 'transporte_logistica'
            WHEN SUBSTR(atividade, 1, 2) BETWEEN '55' AND '56'  THEN 'outros_servicos'
            WHEN SUBSTR(atividade, 1, 2) BETWEEN '58' AND '82'  THEN 'servicos_empresariais'
            WHEN SUBSTR(atividade, 1, 2) BETWEEN '84' AND '88'  THEN 'admin_educacao_saude'
            WHEN SUBSTR(atividade, 1, 2) BETWEEN '90' AND '99'  THEN 'outros_servicos'
            WHEN SUBSTR(atividade, 1, 2) = '00'                 THEN 'outros_servicos'
        END                                                              AS setor_grupo,

        -- ================= grande grupo ocupacional (V6461) =================
        -- P1040 (2022) publica o grande grupo já codificado em '01'..'11'. Em 2010 V6461 é
        -- o código de 4 dígitos da COD 2010 (base ISCO-08), cujo grande grupo é o primeiro
        -- dígito: 1 diretores, 2 profissionais, 3 técnicos, 4 apoio administrativo,
        -- 5 serviços/vendedores, 6 agropecuária, 7 construção e artes mecânicas,
        -- 8 operadores de instalações, 9 elementares, 0 forças armadas/polícia/bombeiros.
        -- O mapeamento para '01'..'11' é 1:1 com o de 2022: grande grupo 0 vira '10'
        -- (forças armadas) e o código especial 0000 ("OCUPAÇÕES MALDEFINIDAS") vira '11'
        -- (mal definidas) -- este último precisa ser testado ANTES do prefixo '0'.
        -- Assim `ocup_grupo` fica diretamente comparável entre as duas edições.
        CASE
            WHEN grande_grupo IS NULL OR TRIM(grande_grupo) = '' THEN NULL
            WHEN grande_grupo = '0000'                           THEN '11'
            WHEN SUBSTR(grande_grupo, 1, 1) = '0'                THEN '10'
            ELSE '0' || SUBSTR(grande_grupo, 1, 1)
        END                                                              AS ocup_grupo,

        -- ================= meio de transporte: INEXISTENTE em 2010 =================
        -- O questionário da amostra de 2010 não tem quesito de meio de transporte / meio de
        -- locomoção (conferido item a item na lista completa de variáveis e no questionário:
        -- o bloco de deslocamento vai de 6.60 a 6.62 e pergunta só município, retorno diário
        -- e tempo gasto). A coluna existe para manter o esquema, sempre NULL.
        CAST(NULL AS VARCHAR)                                            AS modo_grupo,

        -- ================= rendimento do trabalho em classes de SM =================
        -- 2010 usa V6514 ("rendimento no trabalho principal em número de salários mínimos"),
        -- que já vem em SM de julho/2010 (R$ 510). Os cortes são os MESMOS de 2022 em termos
        -- relativos (1, 2, 3 e 5 SM), aplicados diretamente sobre o valor em SM.
        CASE
            WHEN renda_trab IS NULL      THEN 'sem_declaracao'
            WHEN renda_trab <= 1.0       THEN 'ate_1_sm'
            WHEN renda_trab <= 2.0       THEN 'de_1_a_2_sm'
            WHEN renda_trab <= 3.0       THEN 'de_2_a_3_sm'
            WHEN renda_trab <= 5.0       THEN 'de_3_a_5_sm'
            ELSE 'mais_de_5_sm'
        END                                                              AS renda_trab_classe,

        -- ================= nível do curso frequentado em 4 grupos (V0629) =================
        -- V0629 tem 12 códigos contra os 11 de P0660 (2022), porque 2010 separa EJA/supletivo
        -- do fundamental (06) e do médio (08) em itens próprios. Correspondência:
        --   01 creche, 02 pré-escolar, 03 classe de alfabetização, 04 alfabetização de jovens
        --   e adultos, 05 regular do fundamental, 06 EJA/supletivo do fundamental -> infantil_fundamental
        --   07 regular do médio, 08 EJA/supletivo do médio                        -> medio
        --   09 superior de graduação                                              -> graduacao
        --   10 especialização (>= 360h), 11 mestrado, 12 doutorado                -> pos_graduacao
        CASE
            WHEN curso IN ('01', '02', '03', '04', '05', '06') THEN 'infantil_fundamental'
            WHEN curso IN ('07', '08')                         THEN 'medio'
            WHEN curso = '09'                                  THEN 'graduacao'
            WHEN curso IN ('10', '11', '12')                   THEN 'pos_graduacao'
        END                                                              AS curso_grupo,


        -- ================= migração de data fixa (31/07/2005) =================
        -- `df_local` chega de 01_extract já RECODIFICADO para o vocabulário de P0600/2022:
        -- V0626 = 1 e V6264 (município relatado) = cd_mun -> '1' (mesmo município, não
        -- migrante); V0626 = 1 e V6264 conhecido e diferente -> '2' (outro município do
        -- Brasil); V0626 = 2 ("País estrangeiro") -> '3'. O caso '1' existe porque V0624
        -- ("tempo de moradia no município") conta anos DESDE O ÚLTIMO RETORNO, não o tempo
        -- total -- quem sempre morou aqui, saiu e voltou há <6 anos responde ao quesito e pode
        -- legitimamente reportar 2005 no próprio município (achado e corrigido na auditoria do
        -- checkpoint F2 -- ver docs/METODOLOGIA.md). O quesito 6.26 só foi aplicado a quem
        -- morava no município há menos de 6 anos e tinha 5 anos ou mais -- todos os demais
        -- ficam em branco, exatamente como os "6+ anos" de 2022. O COALESCE segue obrigatório
        -- pelo mesmo motivo de 2022 (branco = não migrante).
        COALESCE(df_local IN ('2', '3'), FALSE)                          AS is_migrante,
        COALESCE(df_local = '2', FALSE)                                  AS is_mig_interno,
        COALESCE(df_local = '3', FALSE)                                  AS is_mig_internacional,
        -- Origem desconhecida em 2010: 8888888 (ignorado aplicado na fase de crítica) e o
        -- padrão `UF||'99999'` da tabela "Migração e deslocamento _Municípios" -- um código
        -- por UF (1199999 RO, 1299999 AC, ..., 5399999 DF), capturados por
        -- SUBSTR(df_mun, 3, 5) = '99999'. Nenhum dos 5.565 municípios reais de 2010 tem código
        -- terminado em 99999 (verificado contra pipeline/labels_2010.MUNICIPIOS_2010), então o
        -- teste é seguro. O caso "9899999 = não sabe UF nem país" não passa por essa cláusula:
        -- ele vem com df_mun (V6264) em BRANCO (só df_uf/V6262 = '98'), então já é excluído
        -- pelo `df_mun IS NOT NULL` -- não precisa do teste de SUBSTR.
        COALESCE(df_local = '2' AND df_mun IS NOT NULL AND df_mun <> '8888888'
             AND SUBSTR(df_mun, 3, 5) <> '99999', FALSE)                 AS origem_conhecida,
        -- origem_valida exclui também origem = destino; só ela alimenta fluxos e emigração,
        -- garantindo a identidade Σ imigrantes = Σ emigrantes (mesma regra de 2022).
        COALESCE(df_local = '2' AND df_mun IS NOT NULL AND df_mun <> '8888888'
             AND SUBSTR(df_mun, 3, 5) <> '99999'
             AND df_mun <> cd_mun, FALSE)                                AS origem_valida,
        -- `df_uf` chega de 01_extract com 2 dígitos (SUBSTR(V6262, 1, 2)), porque em 2010 os
        -- códigos de UF da migração têm 7 dígitos (`UF||'00000'`, ex. 3500000 = SP). As
        -- sentinelas viram '88' (ignorado), '99' (não sabe UF, de 9900000) e '98'
        -- (não sabe UF nem país, de 9899999) -- esta última não existe em 2022.
        COALESCE(df_local = '2' AND df_uf IS NOT NULL AND df_uf <> uf
             AND df_uf NOT IN ('88', '98', '99'), FALSE)                 AS interestadual,

        -- ================= status migratório (vocabulário reduzido de 2010) =================
        -- Diferença central em relação a 2022: o Censo 2010 NÃO coleta o município de
        -- nascimento (o quesito 6.18 só pergunta "nasceu neste município?"; 6.22 registra a
        -- UF ou o país, nunca o município). Sem `nasc_mun` é impossível comparar o município
        -- de nascimento com o de residência em 2005, e portanto impossível separar
        -- `primeira_saida` (saiu direto do município natal) de `etapas_multiplas`. As duas
        -- colapsam em `nao_natural` = migrante interno que não nasceu no município de
        -- destino nem no exterior. As demais categorias mantêm a definição de 2022.
        --
        -- `nasc_local` chega de 01_extract recodificado para o vocabulário de P0480:
        --   V0618 IN (1,2)                -> '1' nasceu no município de residência atual
        --   V0618 = 3 e V0622 = 2         -> '3' nasceu em país estrangeiro
        --   V0618 = 3 e V0622 <> 2/branco -> '2' nasceu em outro município do Brasil
        -- (V0622 fica em branco justamente para quem nasceu em outro município da MESMA UF,
        -- que é o caso '2'.) Entre migrantes, `nasc_local` = '1' só pode vir de V0618 = 2
        -- ("nasceu neste município mas já morou em outro"): quem responde 1 ("sempre morou")
        -- salta o quesito de data fixa. Ou seja, `retorno_natal` em 2010 é medido pelo
        -- próprio quesito de retorno, e não por inferência -- é ao menos tão preciso quanto
        -- em 2022.
        --
        -- `nacionalidade` (V0620) só é perguntada a quem não nasceu na UF de residência
        -- (salto 6.19 = 3 -> 6.20), então o branco significa "brasileiro nato nascido nesta
        -- UF": o COALESCE para '1' evita classificar um brasileiro que voltou do exterior
        -- como estrangeiro.
        CASE
            WHEN df_local = '3' AND COALESCE(nacionalidade, '1') IN ('1', '2')
                                                                 THEN 'internacional_brasileiro'
            WHEN df_local = '3'                                  THEN 'internacional_estrangeiro'
            WHEN df_local = '2' AND nasc_local = '1'             THEN 'retorno_natal'
            WHEN df_local = '2' AND nasc_local = '3'             THEN 'nascido_exterior'
            WHEN df_local = '2' AND (df_mun IS NULL OR df_mun = '8888888'
                                     OR SUBSTR(df_mun, 3, 5) = '99999')
                                                                 THEN 'origem_nao_informada'
            WHEN df_local = '2' AND nasc_local = '2'             THEN 'nao_natural'
            WHEN df_local = '2'                                  THEN 'outro'
            ELSE NULL
        END                                                             AS status,

        -- Retorno à UF de nascimento. `nasc_uf` chega de 01_extract com 2 dígitos e já
        -- resolvido pelo fluxo do questionário: quem nasceu neste município (V0618 IN (1,2))
        -- ou nesta UF (V0619 IN (1,2)) recebe a própria UF de residência, porque V6222 fica
        -- em branco nesses casos (só é preenchido quando V0619 = 3).
        COALESCE(df_local = '2' AND nasc_local = '2' AND nasc_uf = uf AND df_uf <> uf
             AND df_uf NOT IN ('88', '98', '99'), FALSE)                 AS retorno_uf_natal,

        -- ================= escolaridade =================
        -- V6400 ("nível de instrução") é idêntico valor a valor a P0770 de 2022: 1 sem
        -- instrução e fundamental incompleto, 2 fundamental completo e médio incompleto,
        -- 3 médio completo e superior incompleto, 4 superior completo, 5 não determinado.
        -- Mesma restrição de universo (25 anos ou mais). Idade vem de V6036.
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
        -- V6532 já é o rendimento domiciliar per capita EM NÚMERO DE SALÁRIOS MÍNIMOS de
        -- julho/2010, então os cortes de 2022 (1/4, 1/2, 1 e 2 SM) são aplicados direto,
        -- sem deflator e sem multiplicar por R$ 510. NULL = domicílio coletivo (o quesito
        -- é do domicílio particular), igual ao 'nao_aplicavel' de 2022.
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

        -- V0601: 1 masculino, 2 feminino (sem categoria "ignorado" em 2010).
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
) TO 'data/interim/2010/pessoas_classificado.parquet' (FORMAT PARQUET);
