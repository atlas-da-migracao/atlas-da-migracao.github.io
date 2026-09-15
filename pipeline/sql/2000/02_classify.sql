-- ============================================================================================
-- Cabeçalho para pipeline/sql/2000/02_classify.sql -- colar VERBATIM no topo do arquivo.
-- Escrito pelo agente `metodologo`; a especificação coluna a coluna que ele acompanha está em
-- pipeline/sql/2000/MAPEAMENTO_02_classify.md, e a justificativa em prosa em
-- docs/METODOLOGIA.md, seção "Edição Censo 2000 e comparabilidade com 2022 e 2010".
-- ============================================================================================

-- F2 (edição Censo 2000): classificação de status migratório, escolaridade, renda e idade/sexo.
-- Override de pipeline/sql/02_classify.sql. Produz data/interim/2000/pessoas_classificado.parquet
-- com EXATAMENTE as mesmas 49 colunas (mesmo nome, mesma ordem, mesmo tipo) das edições 2022 e
-- 2010, para que 03_indicators.sql, 04_flows.sql, 07_pendular.sql e 08_metro.sql sejam
-- reaproveitados com o mínimo de override.
--
-- Referência de data fixa: 31/07/1995 -> 31/07/2000 (quinquênio). Salário mínimo de julho/2000:
-- R$ 151,00 -- mas, como em 2010, a renda já chega em NÚMERO DE SALÁRIOS MÍNIMOS (V4514 no
-- arquivo de pessoas, V7617 no de domicílios), então os cortes são aplicados diretamente em SM,
-- sem multiplicar por 151 e sem deflator.
--
-- Fonte das posições/códigos: pipeline/layout_2000.py e pipeline/labels_2000.py (gerados por
-- pipeline/gen_edicao_2000.py) e a documentação PÚBLICA do IBGE em
-- data/raw2000/1_Documentacao_20170908/:
--   - SAS/LE PESSOAS.sas e SAS/LE DOMIC.sas (posições, rótulos e regras de branco)
--   - Documentacao/Documentaá∆o.doc (notas metodológicas: amostragem, pesos, definições)
--   - Instrumentos de coleta/{Questionario da Amostra.pdf, Manual do Recenseador.pdf}
--   - Arquivos Auxiliares/{CnaeDom-Estrutura.xls, Ocupacao-Estrutura.doc,
--     Estrutura Migracao V4210, V4260.xls, Municipios e Pais Estrangeiro - V4276.xls}
--
-- O que MUDA em relação a 2022 (cada ponto está comentado no bloco correspondente):
--   1. DESLOCAMENTO PENDULAR VEM DE UMA PERGUNTA SÓ. O quesito 4.27 ("em que município e UF, ou
--      país estrangeiro, trabalha ou estuda?", V4276) cobre trabalho E estudo, e o Manual do
--      Recenseador (p. 67) manda: "Caso trabalhe e estude em municípios distintos de onde mora,
--      registre o município em que trabalha." Por isso os dois módulos continuam existindo, mas
--      com universos DISJUNTOS: `pendular_trab` = ocupados de 10 anos ou mais; `pendular_estudo`
--      = estudantes NÃO ocupados. Para um ocupado, estudo_local/estudo_mun chegam de
--      01_extract já NULL -- a informação não existe, e um NULL diz isso melhor que um filtro.
--      Consequência declarada: `saida_estudo` em 2000 é um PISO (quem trabalha no próprio
--      município e estuda em outro assinala "neste município" e some do fluxo de estudo).
--   2. `status` tem o vocabulário REDUZIDO de 2010: o Censo 2000 não coleta o município de
--      nascimento (4.21 pergunta só UF ou país, V4210), então `primeira_saida` e
--      `etapas_multiplas` são indistinguíveis e viram `nao_natural`. V0417/V0418 ("nasceu neste
--      município"/"nasceu nesta UF") dão os mesmos 3 valores de nasc_local que 2010 tinha em
--      V0618 -- mais quesitos, não mais categorias.
--   3. Origem "não sabe município" é um dos 27 códigos de UF_SEM_ESPECIFICACAO_2000
--      (1100001 RO, ..., 3500006 SP, ..., 5400007 BRASIL SEM ESPECIFICAÇÃO), que PARECEM códigos
--      de município reais. Teste seguro: SUBSTR(cod, 3, 4) = '0000' -- verificado contra os 5.507
--      municípios de labels_2000.MUNICIPIOS_2000, nenhuma colisão. É o análogo do UF||'99999' de
--      2010 e do 8888888/9999999 de 2022. Na UF, a sentinela é '54' (de 5400007).
--   4. `modo_grupo`, `transporte`, `tempo_desloc_cat`, `tempo_desloc_min` e `retorna_3dias` são
--      SEMPRE NULL: o bloco de deslocamento de 2000 é o quesito 4.27 e mais nada -- não há meio
--      de transporte, não há tempo (nem em minutos nem em faixas) e não há frequência de retorno.
--      Diferença frente a 2010, que tinha faixas de tempo (V0662) e retorno diário (V0661): em
--      2000 `pct_diario` também é NULL (ver 07_pendular.sql e 08_metro.sql desta edição).
--   5. `nivel_instr_4` é DERIVADO de V4300 ("anos de estudo"), porque o Censo 2000 não tem
--      variável de nível de instrução pronta (2022: P0770; 2010: V6400). Cortes-padrão do IBGE:
--      00-07 e 30 -> '1'; 08-10 -> '2'; 11-14 -> '3'; 15-17 -> '4'; 20 -> '5'. Não se usa
--      V0432/V0433/V0434/V4355 porque essas são BRANCAS PARA OS ESTUDANTES, o que zeraria a
--      escolaridade justamente de quem ainda estuda aos 25+ (EJA, graduação, pós).
--      Aproximação conhecida: graduação de 3 anos = 14 anos de estudo e cai em
--      `medio_completo_superior_incompleto`.
--   6. `pos_grupo` precisa de DUAS variáveis. V0447 tem 9 categorias e não separa estatutários e
--      militares: eles foram codificados como "empregado sem carteira" (V0447 = 4) e só se
--      distinguem por V0448 = 1 ("era empregado pelo RJU ou como militar"). Testar
--      `militar_estatutario` ANTES de `empregado_sem_carteira`; ignorar V0448 infla a
--      informalidade em vários pontos percentuais.
--   7. `setor_grupo` vem da CNAE-DOMICILIAR 1.0 (V4462, classe de 5 dígitos, seções A-Q), não da
--      CNAE-DOM 2.0 de 2010. Agrega-se por divisão (2 primeiros dígitos), com UMA exceção: a
--      divisão 64 junta correio e telecomunicações, que em 2010/2022 estão em seções diferentes
--      -- 64010 (correio) -> transporte_logistica; 64020 (telecomunicações) ->
--      servicos_empresariais. Testar essas duas classes ANTES das faixas de 2 dígitos.
--   8. `ocup_grupo` vem da CBO-DOMICILIAR 2000 (V4452, 4 dígitos), cujo grande grupo é o primeiro
--      dígito -- mas os grandes grupos NÃO são os da ISCO-08 usada em 2010/2022. O GG 9 de 2000
--      é "trabalhadores de reparação e manutenção", não "ocupações elementares": mapeia-se para
--      '07' (que o front-end agrega em `industria_operadores`), e não para '09', que rotularia
--      trabalhadores qualificados como elementares. Consequência: a categoria '09' fica
--      ESTRUTURALMENTE VAZIA em 2000. '0000' ("ocupações mal especificadas") -> '11', testado
--      ANTES do prefixo '0' -> '10' (forças armadas/polícia/bombeiros).
--   9. `curso_grupo` ganha a categoria `pre_vestibular` (V0430 = 11), que não existe em 2010 nem
--      em 2022 -- nessas edições o pré-vestibular nem sequer conta como frequência à escola.
--      Dobrá-lo em `medio` colocaria em "médio" quem já concluiu o médio. Além disso,
--      `pos_graduacao` em 2000 é mais estreita: mestrado e doutorado vêm num único código (13) e
--      a especialização não conta como frequência à escola.
--  10. `renda_pc` é CONSTRUÍDA, não lida. O Censo 2000 não tem variável de rendimento domiciliar
--      per capita (2010: V6532; 2022: D0360). V7617 (renda domiciliar em SM) já exclui do
--      numerador pensionistas, empregados domésticos e seus parentes, mas V7100 ("total de
--      moradores") os INCLUI -- dividir um pelo outro subestima a renda per capita justamente
--      nos domicílios com empregado doméstico residente. O denominador correto é a contagem de
--      moradores com V0402 NOT IN ('09','10','11'), obtida por GROUP BY controle no arquivo de
--      pessoas. NULL para domicílio coletivo (V0201 = 3) -> 'nao_aplicavel'.
--  11. `ocupado` é DERIVADO da cascata V0439..V0443 (trabalho na semana de 23 a 29/07/2000):
--      ocupado = qualquer uma delas = '1'. O Censo 2000 não tem variável derivada de condição de
--      ocupação (2022: P0960; 2010: V6920). Universo idêntico -- as cinco são brancas para
--      menores de 10 anos. Checagem cruzada: ocupado <=> V0447 não branco <=> V4514 não branco.
--  12. `imp_df_local`/`imp_df_mun`/`imp_trab_mun` são PREENCHIDAS (M0424, M4250, M4276), ao
--      contrário de 2010, que as deixava NULL por não ter as marcas. O vocabulário de marcas de
--      2000 ('0' sem imputação, '1' NIM/IMPS, '2'-'C' estágios PRÉ-DIA/DIA/SPLUS) NÃO é
--      comparável valor a valor com o de 2022; são colunas de QA interno, nunca publicadas.
--  13. `df_local` = '1' (não migrante) vem de DUAS origens: V0415 = 1 ("mora neste município
--      desde que nasceu", que salta direto de 4.15 para 4.27, deixando todo o bloco de migração
--      em branco) e V0424 IN (1, 2) ("em 31/07/1995 residia neste município, zona urbana/rural").
--      O segundo caso existe pelo mesmo motivo de 2010: V0416 conta os anos de moradia DESDE O
--      ÚLTIMO RETORNO, não o tempo total. Diferente de 2022 e de 2010, o quesito de data fixa de
--      2000 NÃO tem filtro de "menos de 6 anos no município" -- é feito a todo mundo que
--      respondeu "não" em 4.15 --, o que torna a identificação do migrante de data fixa direta.
--      O COALESCE segue obrigatório: branco = não migrante.
--  14. `renda_pc` e `renda_trab` chegam em SALÁRIOS MÍNIMOS (2022: em reais correntes), como em
--      2010. V4514 é branca exatamente para menores de 10 anos e para quem não tinha trabalho na
--      semana de referência; trabalhador sem rendimento vem com ZERO, não com branco.
--  15. NÃO EXISTEM em V4276 os equivalentes de P1120 = 1 ("em casa ou na propriedade") nem de
--      P1120 = 5 ("mais de um município"): a quadrícula "1 - NESTE MUNICÍPIO" do quesito 4.27 não
--      separa trabalho no domicílio de trabalho fora dele, e não há categoria para quem trabalha
--      em mais de um município. `trab_local` = '1' e '5' nunca ocorrem, e `varios_municipios` sai
--      zerado em municipios_pendular.parquet.
PRAGMA threads = 10;
PRAGMA memory_limit = '16GB';

COPY (
    WITH base AS (
        SELECT
            p.uf, p.cd_mun, p.cd_apond, p.controle, p.peso, p.sexo, p.idade,
            p.df_local, p.df_uf, p.df_mun,
            p.nasc_local, p.nasc_uf, p.nacionalidade,
            p.nivel_instr_4,
            p.imp_df_local, p.imp_df_mun, p.imp_trab_mun,
            -- deslocamento pendular (F2b)
            p.ocupado_10, p.pos_ocup, p.pos_ocup2, p.atividade, p.grande_grupo, p.renda_trab,
            p.trab_local, p.trab_uf, p.trab_mun,
            p.freq_escolar, p.curso, p.estudo_local, p.estudo_uf, p.estudo_mun,
            d.renda_pc
        FROM read_parquet('data/interim/2000/pessoas.parquet') p
        LEFT JOIN read_parquet('data/interim/2000/domicilios.parquet') d
               ON d.controle = p.controle
    )
    SELECT
        uf, cd_mun, cd_apond, controle, peso, idade, df_mun, df_uf, nivel_instr_4, renda_pc,
        imp_df_local, imp_df_mun, imp_trab_mun,
        trab_local, trab_uf, trab_mun,
        CAST(NULL AS VARCHAR) AS retorna_3dias,    -- inexistente em 2000 (sem quesito de frequência de retorno)
        CAST(NULL AS VARCHAR) AS transporte,       -- inexistente em 2000 (sem quesito de meio de transporte)
        CAST(NULL AS VARCHAR) AS tempo_desloc_cat, -- inexistente em 2000 (sem quesito de tempo, nem em faixas nem em minutos)
        CAST(NULL AS INTEGER) AS tempo_desloc_min, -- inexistente em 2000
        renda_trab,
        freq_escolar, curso, estudo_local, estudo_uf, estudo_mun,

        -- ================= universos do bloco de deslocamento =================
        -- Ocupados: cascata V0439..V0443 (ver 01_extract.sql) -- universo idêntico ao de
        -- P0960/2022 e V6920/2010 (pessoas de 10 anos ou mais).
        COALESCE(ocupado_10 = '1', FALSE)                                AS ocupado,
        -- Estudantes: V0429 distingue rede particular (1) de pública (2) de "já frequentou"
        -- (3) de "nunca frequentou" (4) -- universo do quesito 4.29 é V0429 IN ('1','2'),
        -- igual ao de 2010 (V0628) e 2022 (P0650).
        COALESCE(freq_escolar IN ('1', '2'), FALSE)                      AS estudante,
        -- Pendularidade: trab_local/estudo_local já chegam recodificados de 01_extract para o
        -- vocabulário de P1120/P0800. O teste SUBSTR(...,3,4) <> '0000' substitui o
        -- <> UF||'99999' de 2010 -- é o teste estrutural das 27 sentinelas de UF sem
        -- especificação de 2000 (MAPEAMENTO §6). Universo: ocupados (trabalho) / estudantes
        -- NÃO ocupados (estudo) -- garantido estruturalmente em 01_extract.sql (§3), não por
        -- um filtro aqui.
        COALESCE(trab_local = '3' AND trab_mun IS NOT NULL
                 AND SUBSTR(trab_mun, 3, 4) <> '0000'
                 AND trab_mun <> cd_mun, FALSE)                          AS pendular_trab,
        COALESCE(estudo_local = '2' AND estudo_mun IS NOT NULL
                 AND SUBSTR(estudo_mun, 3, 4) <> '0000'
                 AND estudo_mun <> cd_mun, FALSE)                        AS pendular_estudo,

        -- ================= posição na ocupação em 5 grupos (V0447 + V0448) =================
        -- V0447 tem 9 categorias e NÃO separa estatutários/militares de "empregado sem
        -- carteira": os dois vêm codificados como V0447=4, e só se distinguem por V0448=1
        -- ("era empregado pelo RJU ou como militar"). Ordem OBRIGATÓRIA: testar
        -- militar_estatutario ANTES de empregado_sem_carteira -- ver MAPEAMENTO §2 linha 31 e
        -- CABECALHO ponto 6. Sem essa ordem, todo estatutário e militar cairia em "sem
        -- carteira", inflando a informalidade em vários pontos percentuais.
        CASE
            WHEN pos_ocup IN ('1', '3')                                       THEN 'empregado_com_carteira'
            WHEN pos_ocup = '4' AND pos_ocup2 = '1'                           THEN 'militar_estatutario'
            WHEN pos_ocup = '2' OR (pos_ocup = '4' AND pos_ocup2 IS DISTINCT FROM '1')
                                                                                THEN 'empregado_sem_carteira'
            WHEN pos_ocup = '5'                                               THEN 'empregador'
            WHEN pos_ocup IN ('6', '7', '8', '9')                             THEN 'conta_propria_familiar'
        END                                                              AS pos_grupo,

        -- ================= setor de atividade em 8 grupos (V4462, CNAE-Dom 1.0) =================
        -- Agrega por divisão (2 primeiros dígitos), com UMA exceção: a divisão 64 (seção I,
        -- correio E telecomunicações juntos na CNAE-Dom 1.0) precisa ser resolvida na classe
        -- de 5 dígitos -- 64010 (correio) -> transporte_logistica, 64020 (telecomunicações)
        -- -> servicos_empresariais -- testada ANTES de qualquer faixa de 2 dígitos que cubra
        -- 64 (ver MAPEAMENTO §7). As faixas BETWEEN abaixo são seguras porque as divisões nos
        -- "buracos" (03,04,06-09,38,39,42-44,46-49,51,52,54,56-59,68,69,76-79,81-84,86-89,
        -- 94,96-98) não ocorrem na CNAE-Dom 1.0.
        CASE
            WHEN atividade IS NULL                                THEN NULL
            WHEN atividade = '64010'                              THEN 'transporte_logistica'
            WHEN atividade = '64020'                              THEN 'servicos_empresariais'
            WHEN SUBSTR(atividade, 1, 2) IN ('01', '02', '05')    THEN 'agropecuaria'
            WHEN SUBSTR(atividade, 1, 2) BETWEEN '10' AND '41'    THEN 'industria'
            WHEN SUBSTR(atividade, 1, 2) = '45'                   THEN 'construcao'
            WHEN SUBSTR(atividade, 1, 2) IN ('50', '53')          THEN 'comercio'
            WHEN SUBSTR(atividade, 1, 2) = '55'                   THEN 'outros_servicos'
            WHEN SUBSTR(atividade, 1, 2) BETWEEN '60' AND '63'    THEN 'transporte_logistica'
            WHEN SUBSTR(atividade, 1, 2) BETWEEN '65' AND '74'    THEN 'servicos_empresariais'
            WHEN SUBSTR(atividade, 1, 2) BETWEEN '75' AND '85'    THEN 'admin_educacao_saude'
            WHEN SUBSTR(atividade, 1, 2) BETWEEN '90' AND '99'    THEN 'outros_servicos'
            WHEN SUBSTR(atividade, 1, 2) = '00'                   THEN 'outros_servicos'
        END                                                              AS setor_grupo,

        -- ================= grande grupo ocupacional (V4452, CBO-Domiciliar 2000) =================
        -- O grande grupo é o 1º dígito, mas os grandes grupos NÃO são os da ISCO-08 usada em
        -- 2010/2022: o GG 9 de 2000 é "trabalhadores de reparação e manutenção" (mecânicos,
        -- eletricistas), não "ocupações elementares". Mapeado para '07' (industria_operadores
        -- no front-end), não para '09' -- rotularia trabalhadores qualificados como
        -- elementares (ver MAPEAMENTO §8). Consequência: a categoria '09' fica
        -- ESTRUTURALMENTE VAZIA em 2000. '0000' ("mal especificadas") -> '11', testado ANTES
        -- do prefixo '0' -> '10' (forças armadas/polícia/bombeiros).
        CASE
            WHEN grande_grupo IS NULL                 THEN NULL
            WHEN grande_grupo = '0000'                 THEN '11'
            WHEN SUBSTR(grande_grupo, 1, 1) = '0'      THEN '10'
            WHEN SUBSTR(grande_grupo, 1, 1) = '9'      THEN '07'
            ELSE '0' || SUBSTR(grande_grupo, 1, 1)
        END                                                              AS ocup_grupo,

        -- ================= meio de transporte: INEXISTENTE em 2000 =================
        CAST(NULL AS VARCHAR)                                            AS modo_grupo,

        -- ================= rendimento do trabalho em classes de SM =================
        -- V4514 já em SM de julho/2000 (R$ 151). Mesmos cortes relativos de 2010/2022.
        CASE
            WHEN renda_trab IS NULL      THEN 'sem_declaracao'
            WHEN renda_trab <= 1.0       THEN 'ate_1_sm'
            WHEN renda_trab <= 2.0       THEN 'de_1_a_2_sm'
            WHEN renda_trab <= 3.0       THEN 'de_2_a_3_sm'
            WHEN renda_trab <= 5.0       THEN 'de_3_a_5_sm'
            ELSE 'mais_de_5_sm'
        END                                                              AS renda_trab_classe,

        -- ================= nível do curso frequentado em 5 grupos (V0430) =================
        -- V0430 tem 13 códigos, 1 a mais que os 12 de V0629/2010: o código 11 é
        -- PRÉ-VESTIBULAR, categoria nova (exclusiva de 2000 -- ver MAPEAMENTO §9). Dobrá-lo em
        -- "medio" colocaria em "médio" quem já concluiu o médio (o Manual manda registrar
        -- ensino médio, não pré-vestibular, para quem cursa os dois); jogá-lo em "ignorado"
        -- esconderia um fluxo pendular real e clássico (cursinho na cidade maior).
        -- pos_graduacao em 2000 é mais estreita que em 2022/2010: mestrado+doutorado vêm
        -- fundidos num único código (13) e especialização não conta como frequência à escola.
        CASE
            WHEN curso IN ('01', '02', '03', '04', '05', '06', '07') THEN 'infantil_fundamental'
            WHEN curso IN ('08', '09', '10')                        THEN 'medio'
            WHEN curso = '11'                                       THEN 'pre_vestibular'
            WHEN curso = '12'                                       THEN 'graduacao'
            WHEN curso = '13'                                       THEN 'pos_graduacao'
        END                                                              AS curso_grupo,

        -- ================= migração de data fixa (31/07/1995) =================
        -- df_local chega de 01_extract já recodificado para o vocabulário de P0600/2022. O
        -- COALESCE segue obrigatório pelo mesmo motivo de 2010/2022 (branco = não migrante).
        COALESCE(df_local IN ('2', '3'), FALSE)                          AS is_migrante,
        COALESCE(df_local = '2', FALSE)                                  AS is_mig_interno,
        COALESCE(df_local = '3', FALSE)                                  AS is_mig_internacional,
        -- Origem desconhecida em 2000: os 27 códigos de UF_SEM_ESPECIFICACAO_2000 (padrão
        -- SUBSTR(df_mun,3,4)='0000' -- ver MAPEAMENTO §6, nenhuma colisão com os 5.507
        -- municípios reais). Diferente de 2010 (8888888 + UF||'99999'), 2000 não tem um
        -- código "ignorado" separado -- só a família de sentinelas de UF sem especificação.
        COALESCE(df_local = '2' AND df_mun IS NOT NULL
             AND SUBSTR(df_mun, 3, 4) <> '0000', FALSE)                  AS origem_conhecida,
        -- origem_valida exclui também origem = destino; só ela alimenta fluxos e emigração,
        -- garantindo Σ imigrantes = Σ emigrantes (mesma regra de 2010/2022).
        COALESCE(df_local = '2' AND df_mun IS NOT NULL
             AND SUBSTR(df_mun, 3, 4) <> '0000'
             AND df_mun <> cd_mun, FALSE)                                AS origem_valida,
        -- df_uf chega de 01_extract com 2 dígitos; a sentinela é '54' (de 5400007 / V4260=29),
        -- equivalente ao '98'/'99' de 2010 e ao '88'/'99' de 2022.
        COALESCE(df_local = '2' AND df_uf IS NOT NULL AND df_uf <> uf
             AND df_uf <> '54', FALSE)                                  AS interestadual,

        -- ================= status migratório (vocabulário reduzido de 2010) =================
        -- Mesma razão de 2010: o Censo 2000 não coleta o município de nascimento (4.21
        -- pergunta só UF ou país, V4210) -- primeira_saida/etapas_multiplas são
        -- indistinguíveis e colapsam em nao_natural. nasc_local chega de 01_extract com o
        -- vocabulário de P0480 (1 neste município / 2 outro município do Brasil / 3
        -- exterior): entre migrantes, nasc_local='1' só pode vir de V0417='1' ("nasceu neste
        -- município mas já morou em outro"), medido pelo próprio quesito, não por inferência.
        -- COALESCE(nacionalidade,'1') obrigatório: V0419 é branca para os não migrantes e os
        -- naturais da UF -- branco = brasileiro nato.
        CASE
            WHEN df_local = '3' AND COALESCE(nacionalidade, '1') IN ('1', '2')
                                                                 THEN 'internacional_brasileiro'
            WHEN df_local = '3'                                  THEN 'internacional_estrangeiro'
            WHEN df_local = '2' AND nasc_local = '1'             THEN 'retorno_natal'
            WHEN df_local = '2' AND nasc_local = '3'             THEN 'nascido_exterior'
            WHEN df_local = '2' AND (df_mun IS NULL OR SUBSTR(df_mun, 3, 4) = '0000')
                                                                 THEN 'origem_nao_informada'
            WHEN df_local = '2' AND nasc_local = '2'             THEN 'nao_natural'
            WHEN df_local = '2'                                  THEN 'outro'
            ELSE NULL
        END                                                             AS status,

        -- Retorno à UF de nascimento -- mesma forma de 2010, trocando as sentinelas ('54' no
        -- lugar de '98'/'99').
        COALESCE(df_local = '2' AND nasc_local = '2' AND nasc_uf = uf AND df_uf <> uf
             AND df_uf <> '54', FALSE)                                  AS retorno_uf_natal,

        -- ================= escolaridade =================
        -- edu_grupo: MESMO CASE de 2022/2010, sem alteração -- só muda a ORIGEM de
        -- nivel_instr_4 (derivado de V4300 em 01_extract.sql, ver MAPEAMENTO §5). Mesma
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
        -- renda_pc já em SM (construída em 01_extract.sql -- ver MAPEAMENTO §4). Mesmos
        -- cortes de 2010/2022. NULL = domicílio coletivo.
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

        -- V0401: 1 masculino, 2 feminino (sem categoria "ignorado" em 2000).
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
) TO 'data/interim/2000/pessoas_classificado.parquet' (FORMAT PARQUET);
