-- ============================================================================================
-- Cabeçalho para pipeline/sql/1980/02_classify.sql -- colar VERBATIM no topo do arquivo.
-- Escrito pelo agente `metodologo` (F9.2); a especificação coluna a coluna que ele acompanha
-- está em pipeline/sql/1980/MAPEAMENTO_02_classify.md, e a justificativa em prosa em
-- docs/METODOLOGIA.md, seção "Edição Censo 1980 e comparabilidade".
-- ============================================================================================

-- F2 (edição Censo 1980): classificação de status migratório, escolaridade, pendular e
-- idade/sexo. Override de pipeline/sql/02_classify.sql. Produz
-- data/interim/1980/pessoas_classificado.parquet com EXATAMENTE as mesmas 49 colunas (mesmo
-- nome, mesma ordem, mesmo tipo) das edições 2022, 2010, 2000 e 1991, para que
-- 03_indicators.sql e 04_flows.sql sejam reaproveitados sem override.
--
-- Fonte: BASE DOS DADOS (BigQuery), tabela
-- basedosdados.br_ibge_censo_demografico.microdados_pessoa_1980, extraída por
-- scripts/extract_1980_bd.py para data/raw1980/pessoa_<uf>.parquet (27 partições,
-- 29.378.753 linhas, Sigma v604 = 119.011.062). NÃO é a cópia pública do IBGE: as cópias
-- locais (DBF e SAV) OMITEM a variável V518 (município de residência anterior), sem a qual
-- não existe matriz origem->destino. Dicionário de variáveis: "Documentação - 12.doc" do
-- IBGE; tabelas auxiliares em "Variaveis Auxiliares/" (V512, V530/V542, V532/V544, V606,
-- V680-V681-V682). Todas as afirmações quantitativas abaixo vêm de consultas AGREGADAS
-- (contagens, somas de peso, cruzamentos com n >= 5, correlações) sobre data/raw1980/ e,
-- para a calibração, sobre data/interim/1991/raw_txt/.
--
-- O que MUDA em relação a 2022 (cada ponto está comentado no bloco correspondente):
--
--   1. *** ESTA EDIÇÃO NÃO TEM DATA FIXA. A MIGRAÇÃO PUBLICADA É UM PROXY. *** O Censo 1980
--      não pergunta "onde você morava há 5 anos". Pergunta (a) há quantos anos a pessoa mora
--      no município -- v517: 0 = menos de 1 ano, 1..5 = anos exatos, 6 = 6 a 9, 7 = 10 ou
--      mais, 8 = nasceu aqui, 9 = sem declaração -- e (b) qual o município de residência
--      IMEDIATAMENTE ANTERIOR (última etapa) -- v518, código de 7 dígitos, preenchido só para
--      quem mora no município há menos de 10 anos. Migrante = v517 IN ('0','1','2','3','4')
--      COM origem em v518. A sentinela de "não mudou" é v518 = '0000000' (e NULL no Ceará,
--      ponto 2): NÃO existe um código "mesmo município". Universo: 5 anos ou mais (v606 >= 5,
--      v606 <> 999). A janela quinquenal é uma DECISÃO (alinhar com as outras edições), não o
--      universo do questionário, que é decenal: o decenal (v517 IN 0..6) fica só na
--      calibração. v517 = '5' (cinco anos exatos) fica FORA -- a calibração mostra que o
--      análogo de 1991 (MIANMOMU = 5) tem ZERO migrantes de data fixa verdadeiros em 279.530
--      registros. Resultado: 14,5% dos residentes de 5+ são migrantes internos (Sigma peso
--      14.775.348 de 101.860.918), contra 10,68% em 1991 -- os dois números NÃO são
--      diretamente comparáveis (ver ponto 3). A UI mostra o selo "proxy"
--      (edicoes.py: proxy_data_fixa = True).
--
--   2. *** O CEARÁ É UMA PARTIÇÃO COM CODIFICAÇÃO PRÓPRIA -- SEM ESTA REGRA, 100% DAS ORIGENS
--      DO CEARÁ SE PERDEM. *** Em CE (e SÓ em CE) v518 e v527 trazem o código de município com
--      6 DÍGITOS (UF||MUNIC, sem dígito verificador). Como extract_1980_bd.py grava
--      LPAD(CAST(v518 AS INT64), 7, '0'), esses valores chegam com um zero à esquerda
--      ('0230440' = município 230440 do Ceará). REGRA:
--          org6 = CASE WHEN v518 IS NULL OR v518 = '0000000' THEN NULL
--                      WHEN SUBSTR(v518,1,1) = '0' THEN SUBSTR(v518,2,6)
--                      ELSE SUBSTR(v518,1,6) END
--      (idem para v527 -> trab6). Não há ambiguidade: NENHUM código de UF brasileiro começa
--      com '0'. Evidência: 190.963 registros com zero à esquerda, TODOS em CE e sendo 100%
--      dos v518 preenchidos do Ceará; 179.772 deles casam com MUN6_1980 depois do strip
--      (1.227 municípios distintos), e os 11.191 restantes são as MESMAS sentinelas das outras
--      UFs em 6 dígitos ('0230000' = Ceará sem município, '0800000' exterior, '0540000',
--      '0990000'). A UF de origem majoritária recuperada é 23, o próprio Ceará. ISTO ENCERRA O
--      ACHADO "prefixos 01-09" de docs/qa/sonda_1980_bd.md: não é codificação desconhecida nem
--      erro de parsing, e tratá-los como "origem não informada" jogaria fora 179.772 origens
--      municipais válidas. Outras anomalias do Ceará: v518 de não migrante é NULL (não
--      '0000000'); v528/v529 usam '0' como NSA de menores de 10 anos (ponto 6); v524 tem 15,2%
--      de NULL; a renda existe SÓ no Ceará (ponto 7).
--      NOTA DE IMPLEMENTAÇÃO (F9.3): 01_extract.sql resolve org6/trab6 contra
--      data/interim/1980/municipios_ref.parquet (não contra MUN6_1980 diretamente) -- como os
--      52 códigos do norte de Goiás (ponto 4) não estão em municipios_ref, o JOIN falha para
--      eles sem tratamento especial, e a contagem de origens do Ceará resolvidas no pipeline
--      final é 179.622 (não 179.772) -- os 150 registros a menos são exatamente as origens do
--      Ceará cujo destino é um dos 52 códigos do norte de Goiás, que corretamente caem em
--      "origem não informada" em vez de resolver para um município fantasma. Ver MAPEAMENTO
--      §2.3 (validação da regra, antes da exclusão de Goiás) vs. §3.3 (efeito da exclusão).
--
--   3. O PROXY FOI CALIBRADO CONTRA A DATA FIXA VERDADEIRA DE 1991, e os números são o selo
--      de precisão desta edição. Construindo o MESMO proxy em 1991 (MIANMOMU < 5 +
--      MIANTEUF/MIANTEMU) e comparando com MIMO86UF/MIMO86MU, no universo 5+ (15.071.836
--      registros): CAPTAÇÃO = 100,0% -- dos 1.602.229 migrantes de data fixa verdadeiros,
--      ZERO escapam ao proxy (é estrutural: quem mudou no quinquênio mora no destino há menos
--      de 5 anos). FALSOS POSITIVOS = 6,9% -- 118.815 registros que o proxy chama de migrante
--      estavam neste mesmo município em 1986 (saíram e voltaram); o volume total de migrantes
--      internos sai +7,3% inflado. ORIGEM: 89,2% no mesmo município, 95,5% na mesma UF (os
--      10,8% restantes são migração em etapas -- quem veio da Bahia para o interior de SP e
--      depois para a capital aparece como migrante intra-SP). CORRELAÇÕES proxy x verdade:
--      imigração por município 0,9997; emigração 0,9998; TLM municipal 0,9791 (0,9964 entre
--      municípios de 50 mil+); TLM por UF 0,9965; volume dos pares O/D 0,9969. VIESES A
--      DECLARAR: (a) atenuação -- a regressão do TLM proxy sobre o verdadeiro tem coeficiente
--      0,912 (UF) e 0,941 (município), o proxy ENCOLHE os saldos; (b) distância -- a
--      participação interestadual cai de 35,07% (verdade) para 32,96% (proxy), porque etapas
--      múltiplas transferem fluxo longo para fluxo curto; (c) sinal do saldo trocado em 241 de
--      4.491 municípios (5,4%), quase todos pequenos; (d) origem não informada sobe de 3,2%
--      para 5,8%. O PROXY DECENAL FOI REJEITADO: com MIANMOMU < 10 os falsos positivos saltam
--      de 118.815 para 1.301.806. RESSALVA: a calibração é de 1991, não de 1980 -- mede o erro
--      do CONCEITO, não o desta edição; se o retorno e as etapas múltiplas foram mais intensos
--      em 1975-1980, os desvios acima são um PISO.
--
--   4. *** A EDIÇÃO 1980 NÃO COBRE O TERRITÓRIO DO ATUAL TOCANTINS. *** 178.338 registros de
--      sigla_uf = 'GO' chegam com id_municipio NULL: são os 52 municípios do norte de Goiás
--      que em 1988 formaram o Tocantins. A Base dos Dados NÃO publica o código de 6 dígitos
--      original (id_municipio é a única coluna geográfica da tabela), então não há join
--      possível -- reextrair não resolve (a sondagem das quatro camadas da BD -- produção, dev
--      e as duas variantes de staging -- devolveu exatamente os mesmos 178.338 nulos em todas,
--      o que fecha a hipótese de `safe_cast`), e casar linha a linha com a cópia DBF do IBGE
--      está descartado (a extração veio do BigQuery sem ORDER BY nem chave de linha).
--
--      HISTÓRICO DA DECISÃO, em três etapas -- vale registrar porque a 1ª e a 2ª estão citadas
--      em documentação anterior:
--        F9.2 (1.0.0-1980): EXCLUIR os 178.338. O território sai da edição; a UF 52 fica
--          publicada nos seus limites atuais (3.121.125 habitantes), o que é bom, mas o
--          Tocantins vira um buraco branco na malha e 739.049 pessoas somem.
--        F9.8 (1.0.1-1980): os 15.350 que SAÍRAM de lá (v518 traz um dos 52 códigos, e o
--          destino é um município publicado) deixam de ser tratados como origem desconhecida e
--          ganham uma tabela própria, fluxos_origem_agregada.parquet, sob a origem sintética
--          'NORTEGO'. Meia solução: a origem existia, mas sem população, malha nem painel.
--        F9.9 (1.0.2-1980, ATUAL): 'NORTEGO' vira uma UNIDADE PUBLICADA. Os 178.338 residentes
--          entram na edição sob ela (cd_mun = 'NORTEGO'), a unidade ganha população (739.049),
--          imigração, emigração, saldo, deslocamento pendular, UF ('17', Tocantins), painel e
--          um polígono na malha (as 52 feições dissolvidas em uma, geo/fetch_1980.sh). A
--          tabela separada de F9.8 deixou de existir: a origem agregada virou uma origem
--          normal em fluxos.parquet, com um destino clicável do outro lado. A edição passou a
--          cobrir 100% dos recenseados de 1980 (Sigma peso 119.011.062).
--      O que a unidade NÃO resolve, e fica declarado: ela não distingue os 52 municípios, e
--      mudar entre dois deles não aparece como migração (11.586 registros, 47.598 ponderados
--      -- tratados como não migração em 01_extract.sql, ver a nota de df_local lá). É a perda
--      de granularidade de qualquer agregação, e é o preço de não ter um autoloop nem uma
--      "origem não informada" que a fonte, na verdade, informa.
--
--   5. FERNANDO DE NORONHA É ATRIBUÍDO POR sigla_uf, NÃO POR id_municipio. As 298 linhas com
--      sigla_uf = 'FN' têm id_municipio NULL -- a BD não lhes dá geocódigo nenhum (isso
--      CONTRADIZ o que o plano presumia). A malha de 1980 traz o município como '2000107'
--      (prefixo 20, Território Federal até 1988). Regra, NOS DOIS LADOS:
--          cd_mun = CASE WHEN sigla_uf='FN' THEN '2605459' ELSE id_municipio END
--          uf     = CASE WHEN sigla_uf='FN' THEN '26' ELSE SUBSTR(cd_mun,1,2) END
--          df_mun = CASE WHEN org6 IN ('200010','200000') THEN '2605459' ELSE ... END
--          df_uf  = CASE WHEN SUBSTR(org6,1,2)='20' THEN '26' ELSE ... END
--      (v518 = '2000107' em 141 registros e '2000008' -- UF 20 sem especificação, e FN só tem
--      um município -- em 30; v527 segue a mesma regra; v512 = 14, 670 registros, também é
--      Fernando de Noronha e vai para nasc_uf = '26'.) Consequência declarada: é o ÚNICO
--      município da edição cuja UF publicada não é a de 1980. E municipios_ref precisa
--      reapontar '2000107' para '2605459', senão malha e extrato discordam. (Feito em F9.3:
--      pipeline/labels_1980.MUNICIPIOS_1980['2605459'] substitui a entrada antiga.)
--
--   6. *** `ocupado` EXIGE O FILTRO DE 10 ANOS -- SEM ELE A TAXA DE OCUPAÇÃO SAI EM 41,7% (E EM
--      60% NO CEARÁ). *** v529 ("ocupação atual"): 0 trabalha, 1 procurou trabalho ou trabalha,
--      2 procurando/não trabalha, 3 aposentado, 4 vive de renda, 5 detento, 6 estudante,
--      7 doente, 8 afazeres domésticos, 9 sem ocupação. v529='0' equivale a v530 (ocupação)
--      preenchida em 100% dos casos nas 27 partições -- mas NÃO é "ocupado": no Ceará os
--      menores de 10 anos vêm com v529='0' e v528='0' (NSA), e nas demais UFs uma fração
--      constante de ~17% das crianças de 0 a 9 anos (inclusive de 0 ANOS) também aparece com
--      v529='0'. REGRA: ocupado = (v529 = '0') AND idade >= 10 -- o universo econômico do Censo
--      1980 e o mesmo piso verificado em 1991. Resultado: 35,47% da população, contra a PEA
--      ocupada de 1980 (~35,5%), entre 26,8% (AP) e 40,8% (SP). NÃO usar v528 para definir
--      ocupação (mede trabalho nos últimos 12 meses, e tem NSA próprio no Ceará).
--
--   7. *** A RENDA EXISTE SÓ NO CEARÁ -- A EDIÇÃO NÃO PUBLICA NENHUMA COLUNA DE RENDA. ***
--      v607-v613, v680, v681 e v682 estão preenchidas em CE e em 0,0% das outras 26 UFs. Não é
--      efeito da extração (a mesma SELECT roda nas 27 partições): a tabela da BD não traz renda
--      fora do Ceará. Então renda_trab, renda_pc e renda_trab_classe = CAST(NULL AS DOUBLE/
--      VARCHAR) e renda_classe = 'nao_aplicavel' em 100% das linhas; o módulo pendular perde a
--      dimensão renda_trab. Isso é uma perda MAIOR do que o plano F9 previa (que só descartava
--      a renda per capita, por falta de chave de domicílio) e tem de aparecer na UI: o filtro
--      de renda não existe em 1980. MESMO ASSIM o salário mínimo de referência foi reconciliado
--      e CONFIRMADO: Cr$ 4.149,60 (mínimo legal da região I, maio/1980) reproduz 13/13 faixas
--      de v682 contra v607+v608+v609 -- a faixa 6 termina em 8.299 e a 7 começa em 8.300
--      (=> 2 SM < 8.300 => SM < 4.150,00) e a faixa 8 termina em 20.748 (=> 5 SM >= 20.748 =>
--      SM >= 4.149,60); os mínimos regionais menores (3.939,60 / 3.734,64 / 3.458,00), o de
--      novembro/1979 (3.300,00) e o de novembro/1980 (5.788,80) reproduzem 2/13 cada.
--      Confirmação independente por v681 x soma de v607-v613: os mesmos 13 limites. Diferente
--      de 1991, onde o SM implícito NÃO era o legal, aqui os dois coincidem.
--
--   8. `nivel_instr_4` É RECONSTRUÍDO DE v523 x v524, E O DICIONÁRIO DO IBGE ESTÁ DESLOCADO
--      PARA v524. 1980 não tem "anos de estudo" (EDANOEST de 2000/1991). Tem "última série
--      concluída" (v523, 0-8, 9 s/decl) x "grau da última série concluída" (v524). A lista de
--      categorias impressa no "Documentação - 12.doc" para v524 é a de v521 ("grau que
--      frequenta") e NÃO descreve v524 -- sob ela, "superior" teria 0,067% da população (o
--      IBGE publicou 1,5%) e "supletivo de 1º grau" teria a maior mediana de renda do país.
--      LEITURA CORRETA DE v524, estabelecida por quatro testes independentes (número de séries
--      em v523, idade média, mediana da classe de renda, e a proporção externa de diplomados):
--          0 = nenhuma/NSA (inclui quem ESTÁ estudando)   5 = 2º grau
--          1 = alfabetização de adultos                   6 = médio 2º ciclo (colegial)
--          2 = elementar/primário                         7 = superior
--          3 = médio 1º ciclo (ginasial)                  8 = pós-graduação
--          4 = 1º grau (Lei 5.692/71)
--      Recodificação (universo de edu_grupo: 25+):
--          '1' sem instr./fund. incompleto: v524 IN (0,1,2); v524=3 e v523 IN (1,2,3);
--                                           v524=4 e v523 IN (1..7)
--          '2' fund. completo/médio incompleto: v524=3 e v523 IN (4,5); v524=4 e v523=8;
--                                               v524 IN (5,6) e v523 IN (1,2)
--          '3' médio completo/sup. incompleto: v524 IN (5,6) e v523 >= 3; v524=7 e v523 IN (1,2,3)
--          '4' superior completo: v524=7 e v523 >= 4; v524=8
--          '5' não determinado: v524 ou v523 nulos ou = '9'
--      Lógica: 8 anos de escolarização se alcançam pelo ginasial completo (sistema antigo) OU
--      pela 8ª série do 1º grau (sistema novo); 11 anos, pela 3ª série do 2º grau ou do
--      colegial. Distribuição resultante entre os 25+ (1980 -> 1991, mesmo corte):
--      84,95% -> 74,30% | 5,73% -> 9,27% | 6,03% -> 11,39% | 3,21% -> 5,01% -- progressão
--      monótona e da magnitude certa para 11 anos. APROXIMAÇÕES: (a) quem ESTÁ estudando
--      declara 0/0 e tem o nível subestimado; (b) o fim do superior é uma faixa (cursos de 3 a
--      6 anos), o corte em v523 >= 4 erra nos dois sentidos; (c) v525 ("tipo do último curso
--      concluído"), que cravaria o diploma, NÃO foi extraído da BD.
--
--   9. PENDULAR: UM QUESITO SÓ, COM A REGRA DE 2000. v527 ("Município que trabalha ou estuda",
--      7 dígitos) é estruturalmente idêntico ao V4276 de 2000 -- preenchido em 3,26% dos
--      registros e NUNCA igual ao município de residência (0 casos). Universos: trabalho =
--      ocupados (ponto 6); estudo = quem frequenta escola (v521 em 1..8 OU v522 em 1..8) e NÃO
--      é ocupado. TRABALHO PRECEDE, porque o campo é único -- e por isso O FLUXO DE ESTUDO É UM
--      PISO: quem trabalha E estuda em municípios diferentes só aparece no fluxo de trabalho
--      (mesma ressalva de 2000). trab_local = '1' (em casa/na propriedade) e '5' (mais de um
--      município) NUNCA ocorrem, como em 2000; "neste município" mapeia para '2' para preservar
--      trabalha_no_mun = trab_local IN ('1','2') em 07_pendular.sql. Volumes: 785.731 ocupados
--      e 126.595 estudantes não ocupados com v527; 46.883 descartados por não terem universo
--      (41.267 menores de 10 com v529='0' -- o artefato do ponto 6 -- e 5.438 que declaram
--      v529='6' sem frequência corrente); 6.875 com destino sentinela (exterior/UF sem
--      município), fora da matriz.
--
--  10. O MÓDULO PENDULAR TEM QUATRO DIMENSÕES, NÃO SEIS. Publicadas: setor_grupo (de v532,
--      "finalidade ou ramo do negócio", 166 categorias, crosswalk por seção -- ver MAPEAMENTO
--      §6.4), ocup_grupo (de v530, "ocupação ou cargo", 366 categorias, crosswalk por subgrupo
--      -- §6.5), edu e idade_sexo. NULL: renda_trab_classe (ponto 7) e pos_grupo. POS_GRUPO É
--      NULL POR DECISÃO: v533 ("posição no estabelecimento") existe, mas o vocabulário
--      publicado do atlas (empregado_com_carteira / empregado_sem_carteira /
--      militar_estatutario) é construído sobre a carteira assinada e o vínculo estatutário, que
--      o Censo 1980 NÃO pergunta -- o código 6 de v533 é simplesmente "empregado". A variável
--      mais próxima (v534, contribuição previdenciária) não foi extraída e não é carteira
--      assinada. Ordem obrigatória nos CASE do crosswalk: testar v530 = '805' ANTES da faixa
--      801-834, e 771-776 ANTES de 711-776; em v532, comunicações (481-482) vai para
--      transporte_logistica (em 1980 a seção é correio e telégrafo, não telecomunicações
--      empresariais). RESSALVA: a classe `elementares` de ocup_grupo existe em 1980 (serviço
--      doméstico, porteiros/serventes) mas é MAIS ESTREITA que o GG 9 da ISCO-08 de 2010/2022 --
--      não comparar essa classe entre edições. NOTA DE IMPLEMENTAÇÃO (F9.3): v530/v532 chegam
--      da Base dos Dados SEM zero à esquerda (ex.: '5' em vez de '005', LENGTH varia 1-3) --
--      LPAD(..., 3, '0') é obrigatório antes de qualquer comparação com os códigos de 3
--      dígitos deste crosswalk; sem o LPAD, a comparação de string quebra silenciosamente
--      (ex.: '5' > '042' lexicamente). Verificado: com o LPAD, 0 registros ocupados (idade>=10,
--      v529='0') ficam sem setor_grupo ou ocup_grupo -- o crosswalk é exaustivo para a
--      população publicada.
--
--  11. se/cv SÃO NULL EM TODA A EDIÇÃO (precisao = 'sem_estimativa'). numero_ordem é a ordem da
--      pessoa no domicílio (1 a 29), não um identificador, e a extração veio do BigQuery sem
--      ordem física garantida: domicílios NÃO são reconstruíveis. Sem a UPA, o estimador de
--      conglomerados últimos trataria cada pessoa como independente e SUBESTIMARIA a variância
--      -- erro anticonservador. controle = CAST(NULL AS VARCHAR); cd_apond = cd_mun || 'U'/'R'
--      (v598: 0 urbano, 1 rural) existe só como coluna do contrato e NÃO é estrato;
--      domicilios_apond.parquet não é gerado. Divergência declarada frente a 1991, que também
--      não tem área de ponderação mas tem domicílio reconstruível.
--
--  12. 1980 NÃO USA SENTINELA DE ORIGEM DESCONHECIDA -- usa NULL, como 1991. As sentinelas
--      (UF||'0000', '54...', '99...') não vivem no espaço de códigos de município. Mas ATENÇÃO:
--      df_uf É PREENCHIDA no caso UF||'0000' (a UF de origem é conhecida, o município não), o
--      que mantém `interestadual` correto para 253.578 registros que ficariam de fora se df_uf
--      seguisse df_mun. Derivadas:
--          origem_conhecida = df_local='2' AND df_mun IS NOT NULL
--          origem_valida    = origem_conhecida AND df_mun <> cd_mun
--          interestadual    = df_local='2' AND df_uf IS NOT NULL AND df_uf <> uf
--      Origem não informada: desde F9.9 ela tem DUAS parcelas, não três -- a sentinela
--      UF||'0000' (UF de origem declarada, município não) e as sentinelas 54/99 (Brasil sem
--      especificação, ignorado). A terceira parcela de antes, os 15.350 do norte de Goiás,
--      saiu daqui: a origem deles é conhecida E agora tem unidade ('NORTEGO'), então eles são
--      origem_valida como qualquer outro migrante. Ver MAPEAMENTO §2.4 e §3. Zero autoloops
--      (origem = destino) no extrato. NOTA DE IMPLEMENTAÇÃO (F9.3, CORRIGIDA em F9.3(a) --
--      achado do auditor): como em 1991, o universo é 5 anos ou mais (idade >= 5). Mas
--      diferente de 1991 (onde o quesito é NSA por desenho para <5, e a exceção de campo
--      preenchido é residual, 5 registros nacionais), em 1980 o quesito de tempo de residência
--      É respondido para MENORES de 5 anos também (verificado: 446.086 registros com idade<5 e
--      v517 preenchido em 0..4). Por isso o filtro de universo NÃO PODE viver só em
--      origem_conhecida/origem_valida/interestadual (que mantêm o "AND idade >= 5" abaixo por
--      defesa, mas hoje é redundante): ele tem que estar na própria classificação de df_local
--      em 01_extract.sql (idade < 5 OU idade IS NULL -> df_local = '1'), porque
--      is_migrante/is_mig_interno/is_mig_internacional -- ao contrário do que uma nota anterior
--      deste comentário afirmava -- são usados SEM filtro de idade adicional em
--      03_indicators.sql (t_imig_ni: is_mig_interno AND NOT origem_valida; t_imig_int:
--      is_mig_internacional), e por isso propagavam menores de 5 e idade ignorada para
--      imig_ni/imig_int em municipios_bruto, e distorciam o bucket "residente" (NOT
--      is_migrante). Com df_local já restrito ao universo em 01_extract.sql, is_migrante e
--      companhia ficam corretos automaticamente, sem precisar de filtro extra aqui.
--
--  13. ARMADILHAS DE CODIFICAÇÃO QUE QUEBRAM SILENCIOSAMENTE:
--      (a) v501 (sexo): 1 = homem, 3 = MULHER. Não é 2.
--      (b) v511 (nacionalidade): 2 nato, 4 naturalizado, 6 estrangeiro -- RECODIFICAR para
--          1/2/3 do contrato. Sempre preenchida (zero brancos), diferente de 1991.
--      (c) v513 ("nasceu neste município"): 1 = sim, 8 = NÃO. Não é 2, e não há ignorado.
--      (d) v598: 0 = urbano, 1 = rural (não 1/2).
--      (e) v606 = 999 é IDADE IGNORADA (28.697 registros), não 999 anos.
--      (f) v604 (peso) é inteiro e NÃO tem divisor. Sigma = 119.011.062 contra 119.002.706
--          recenseados (+0,007%).
--      (g) *** pipeline/labels_1980.UF_SEQ_1980 ESTAVA ERRADO nas entradas '07' a '14' ***
--          (CORRIGIDO em F9.3): mapeava '07' para '17' (Tocantins, que não existe em 1980) e
--          deslocava tudo até '14'->'27'. O correto, confirmado nos dados, é '07'->'21' (MA),
--          '08'->'22' (PI), '09'->'23' (CE), '10'->'24' (RN), '11'->'25' (PB), '12'->'26' (PE),
--          '13'->'27' (AL), '14' = Fernando de Noronha -> '26'; de '15' em diante as duas
--          tabelas coincidem. Prova: v512 = 14 tem 670 registros (Fernando de Noronha, ~1.300
--          habitantes) -- se fosse Alagoas seriam ~2 milhões.
--      (h) *** pipeline/labels_1980.CATEGORIAS_1980 É LIXO GERADO *** -- atribui
--          {1:'sim', 2:'nao', 9:'ignorado'} a quase todas as variáveis, contradizendo (a)-(d).
--          NÃO USAR (não é usado neste script). As categorias corretas estão em
--          MAPEAMENTO_02_classify.md e no "Documentação - 12.doc".
--      (i) *** v530/v532 (ocupação/ramo de atividade) NÃO vêm zero-padded *** -- LENGTH varia
--          1 a 3 (ex.: '5' em vez de '005'). LPAD(..., 3, '0') obrigatório antes de comparar
--          com os códigos de 3 dígitos dos crosswalks (ponto 10). Achado de F9.3, não
--          documentado no MAPEAMENTO original.
--
--  14. `retorno_natal` É MEDIDO, NÃO INFERIDO (como em 1991). v513 é independente do tempo de
--      residência: 294.125 registros declaram ter nascido no município E morar nele há menos de
--      5 anos -- nasceram aqui, saíram e voltaram. `status` usa o vocabulário REDUZIDO de
--      2010/2000/1991 (STATUS_POR_EDICAO["1980"], já registrado): sem o MUNICÍPIO de nascimento
--      (v512 dá só UF ou país), primeira_saida e etapas_multiplas colapsam em nao_natural.
--      Ordens de grandeza: retorno_natal ~ 7,1% dos migrantes internos (9,3% em 1991),
--      origem_nao_informada ~ 7,4% (3,0% em 1991).
--
--  15. MATERIAL DISPONÍVEL E DELIBERADAMENTE NÃO PUBLICADO (mesma regra da zona urbano/rural de
--      2000 e da última etapa de 1991): v515 (zona urbana/rural do município anterior),
--      v516 (tempo de residência na UF -- permitiria detectar duas etapas dentro do quinquênio),
--      v514, v509 (cor), v503, v526, v533 (posição no estabelecimento, ponto 10) e os blocos de
--      fecundidade e previdência. Cor/raça segue não publicada pela decisão de 1991: o contrato
--      de 49 colunas não tem essa dimensão em nenhuma edição, e ela só deve entrar por todas de
--      uma vez.
PRAGMA threads = 10;
PRAGMA memory_limit = '16GB';

COPY (
    WITH base AS (
        SELECT
            p.uf, p.cd_mun, p.cd_apond, p.controle, p.peso, p.sexo, p.idade,
            p.df_local, p.df_uf, p.df_mun,
            p.trab6, p.desloc_mun, p.desloc_uf,
            p.nasc_local, p.nasc_uf, p.nacionalidade,
            p.nivel_instr_4,
            p.ocupado_10, p.freq_escolar,
            p.v521, p.v522,
            LPAD(p.v530, 3, '0') AS ocup_cod,
            LPAD(p.v532, 3, '0') AS ativ_cod
        FROM read_parquet('data/interim/1980/pessoas.parquet') p
    ),
    classif AS (
        SELECT
            uf, cd_mun, cd_apond, controle, peso, idade, df_mun, df_uf, nivel_instr_4,

            -- ================= colunas inexistentes em 1980 (§7, §11) =================
            CAST(NULL AS DOUBLE)   AS renda_pc,        -- sem chave de domicílio (§11) e sem
                                                        -- renda fora do Ceará (§7)
            CAST(NULL AS VARCHAR)  AS imp_df_local,    -- a BD não publica marcas de imputação
            CAST(NULL AS VARCHAR)  AS imp_df_mun,      -- idem
            CAST(NULL AS VARCHAR)  AS imp_trab_mun,    -- idem

            -- ================= pendular: trabalho precede estudo (§6.2/§9) =================
            -- trab_local: só para ocupados. '2' = neste município (v527 nulo/'0000000' --
            -- o quesito só é preenchido quando o deslocamento é para fora, MAPEAMENTO §6);
            -- '4' = exterior (trab6 prefixo '80'); '3' = resolve para município OU UF||'0000'
            -- (trab_mun fica NULL nesse caso, e pendular_trab sai FALSE -- mesmo padrão de
            -- origem_nao_informada nas outras colunas). '1' e '5' nunca ocorrem em 1980, como
            -- em 2000.
            CASE
                WHEN ocupado_10 IS DISTINCT FROM '1'  THEN NULL
                WHEN trab6 IS NULL                     THEN '2'
                WHEN SUBSTR(trab6, 1, 2) = '80'         THEN '4'
                ELSE '3'
            END                                                                 AS trab_local,
            CASE
                WHEN ocupado_10 = '1' AND trab6 IS NOT NULL AND SUBSTR(trab6, 1, 2) <> '80'
                    THEN desloc_uf
            END                                                                 AS trab_uf,
            CASE WHEN ocupado_10 = '1' THEN desloc_mun END                      AS trab_mun,

            CAST(NULL AS VARCHAR)  AS retorna_3dias,    -- sem quesito de frequência de retorno
            CAST(NULL AS VARCHAR)  AS transporte,       -- sem quesito de meio de transporte
            CAST(NULL AS VARCHAR)  AS tempo_desloc_cat, -- sem quesito de tempo de deslocamento
            CAST(NULL AS INTEGER)  AS tempo_desloc_min, -- idem
            CAST(NULL AS DOUBLE)   AS renda_trab,       -- renda só existe no Ceará (§7)

            freq_escolar,
            -- curso: código bruto (v521 se frequenta grau regular, senão v522 se frequenta
            -- curso especial/supletivo) -- passthrough de QA, não usado por nenhum script a
            -- jusante (só curso_grupo é usado, ver abaixo).
            CASE
                WHEN v521 BETWEEN '1' AND '8' THEN v521
                WHEN v522 BETWEEN '1' AND '8' THEN v522
            END                                                                 AS curso,

            -- estudo_local: só para NÃO ocupados (§6.2 -- trabalho precede; o campo é único).
            -- Mesma leitura de trab_local, com os códigos de P0600/2022 para estudo ('1'/'2'/'3').
            CASE
                WHEN ocupado_10 = '1'                   THEN NULL
                WHEN trab6 IS NULL                       THEN '1'
                WHEN SUBSTR(trab6, 1, 2) = '80'           THEN '3'
                ELSE '2'
            END                                                                 AS estudo_local,
            CASE
                WHEN ocupado_10 IS DISTINCT FROM '1' AND trab6 IS NOT NULL
                     AND SUBSTR(trab6, 1, 2) <> '80'
                    THEN desloc_uf
            END                                                                 AS estudo_uf,
            CASE WHEN ocupado_10 IS DISTINCT FROM '1' THEN desloc_mun END       AS estudo_mun,

            -- ================= universos do bloco de deslocamento =================
            COALESCE(ocupado_10 = '1', FALSE)                                  AS ocupado,
            COALESCE(freq_escolar = '1', FALSE)                                AS estudante,

            -- ================= posição, setor, ocupação, transporte, renda_trab, curso =========
            -- pos_grupo: NULL em toda a edição -- v533 não distingue carteira assinada/vínculo
            -- estatutário (§10).
            CAST(NULL AS VARCHAR)  AS pos_grupo,

            -- setor_grupo: crosswalk de v532 (ativ_cod, já com LPAD 3 -- §6.4/§10).
            CASE
                WHEN ativ_cod BETWEEN '011' AND '042' THEN 'agropecuaria'
                WHEN ativ_cod BETWEEN '050' AND '059' THEN 'industria'
                WHEN ativ_cod BETWEEN '100' AND '300' THEN 'industria'
                WHEN ativ_cod = '340'                 THEN 'construcao'
                WHEN ativ_cod BETWEEN '351' AND '354' THEN 'industria'
                WHEN ativ_cod BETWEEN '410' AND '424' THEN 'comercio'
                WHEN ativ_cod BETWEEN '451' AND '464' THEN 'servicos_empresariais'
                WHEN ativ_cod BETWEEN '471' AND '477' THEN 'transporte_logistica'
                WHEN ativ_cod BETWEEN '481' AND '482' THEN 'transporte_logistica'
                WHEN ativ_cod BETWEEN '511' AND '512' THEN 'outros_servicos'
                WHEN ativ_cod BETWEEN '521' AND '545' THEN 'outros_servicos'
                WHEN ativ_cod BETWEEN '551' AND '552' THEN 'outros_servicos'
                WHEN ativ_cod BETWEEN '571' AND '589' THEN 'servicos_empresariais'
                WHEN ativ_cod BETWEEN '610' AND '624' THEN 'admin_educacao_saude'
                WHEN ativ_cod BETWEEN '631' AND '632' THEN 'admin_educacao_saude'
                WHEN ativ_cod BETWEEN '711' AND '727' THEN 'admin_educacao_saude'
                WHEN ativ_cod = '801'                 THEN 'outros_servicos'
                WHEN ativ_cod BETWEEN '901' AND '902' THEN 'outros_servicos'
            END                                                                 AS setor_grupo,

            -- ocup_grupo: crosswalk de v530 (ocup_cod, já com LPAD 3 -- §6.5/§10). ORDEM
            -- OBRIGATÓRIA: '805' antes da faixa 801-834 (senão '805' cairia em '05' em vez de
            -- '09'); 771-776 e 711-762 já vêm como faixas disjuntas, sem risco de ordem.
            CASE
                WHEN ocup_cod BETWEEN '001' AND '040' THEN '01'
                WHEN ocup_cod BETWEEN '050' AND '065' THEN '04'
                WHEN ocup_cod BETWEEN '101' AND '104' THEN '02'
                WHEN ocup_cod BETWEEN '111' AND '113' THEN '03'
                WHEN ocup_cod BETWEEN '121' AND '125' THEN '02'
                WHEN ocup_cod BETWEEN '131' AND '133' THEN '03'
                WHEN ocup_cod BETWEEN '141' AND '154' THEN '02'
                WHEN ocup_cod BETWEEN '161' AND '168' THEN '03'
                WHEN ocup_cod BETWEEN '171' AND '183' THEN '02'
                WHEN ocup_cod BETWEEN '191' AND '193' THEN '03'
                WHEN ocup_cod BETWEEN '201' AND '219' THEN '02'
                WHEN ocup_cod BETWEEN '221' AND '222' THEN '03'
                WHEN ocup_cod BETWEEN '231' AND '233' THEN '02'
                WHEN ocup_cod BETWEEN '241' AND '244' THEN '03'
                WHEN ocup_cod BETWEEN '251' AND '293' THEN '02'
                WHEN ocup_cod BETWEEN '301' AND '336' THEN '06'
                WHEN ocup_cod BETWEEN '341' AND '391' THEN '08'
                WHEN ocup_cod BETWEEN '401' AND '406' THEN '03'
                WHEN ocup_cod BETWEEN '411' AND '589' THEN '07'
                WHEN ocup_cod BETWEEN '601' AND '646' THEN '05'
                WHEN ocup_cod BETWEEN '711' AND '762' THEN '08'
                WHEN ocup_cod BETWEEN '771' AND '776' THEN '04'
                WHEN ocup_cod = '805'                                     THEN '09'
                WHEN ocup_cod = '801' OR ocup_cod BETWEEN '811' AND '834' THEN '05'
                WHEN ocup_cod BETWEEN '841' AND '845' THEN '09'
                WHEN ocup_cod BETWEEN '851' AND '859' THEN '10'
                WHEN ocup_cod BETWEEN '911' AND '927' THEN '11'
            END                                                                 AS ocup_grupo,

            CAST(NULL AS VARCHAR)  AS modo_grupo,        -- sem quesito de meio de transporte
            CAST(NULL AS VARCHAR)  AS renda_trab_classe, -- renda só existe no Ceará (§7)

            -- curso_grupo: de v521 (grau regular) / v522 (curso especial) -- ordem conforme
            -- MAPEAMENTO §9 (infantil_fundamental, medio, pre_vestibular, graduacao,
            -- pos_graduacao). 1980 reusa o vocabulário de 2000 -- nenhuma categoria nova.
            CASE
                WHEN v521 IN ('1', '3', '6') OR v522 IN ('1', '2', '3', '5') THEN 'infantil_fundamental'
                WHEN v521 IN ('2', '4', '5', '7') OR v522 IN ('4', '6')      THEN 'medio'
                WHEN v522 = '7'                                              THEN 'pre_vestibular'
                WHEN v521 = '8'                                              THEN 'graduacao'
                WHEN v522 = '8'                                              THEN 'pos_graduacao'
            END                                                                 AS curso_grupo,

            -- ================= migração: booleans e status (§2.5, §5.2, §12) =================
            COALESCE(df_local IN ('2', '3'), FALSE)                            AS is_migrante,
            COALESCE(df_local = '2', FALSE)                                    AS is_mig_interno,
            COALESCE(df_local = '3', FALSE)                                    AS is_mig_internacional,

            -- Universo 5 anos ou mais é OBRIGATÓRIO aqui (não residual como em 1991) -- ponto
            -- 12 do cabeçalho: v517 é respondido também para menores de 5.
            COALESCE(df_local = '2' AND df_mun IS NOT NULL AND idade >= 5, FALSE)
                                                                                AS origem_conhecida,
            COALESCE(df_local = '2' AND df_mun IS NOT NULL AND df_mun <> cd_mun AND idade >= 5,
                     FALSE)                                                    AS origem_valida,
            COALESCE(df_local = '2' AND df_uf IS NOT NULL AND df_uf <> uf AND idade >= 5, FALSE)
                                                                                AS interestadual,

            -- status: vocabulário reduzido de 2010/2000/1991 (§14) -- sem município de
            -- nascimento, primeira_saida/etapas_multiplas colapsam em nao_natural.
            CASE
                WHEN df_local = '3' AND COALESCE(nacionalidade, '1') IN ('1', '2')
                                                                     THEN 'internacional_brasileiro'
                WHEN df_local = '3'                                  THEN 'internacional_estrangeiro'
                WHEN df_local = '2' AND nasc_local = '1'             THEN 'retorno_natal'
                WHEN df_local = '2' AND nasc_local = '3'             THEN 'nascido_exterior'
                -- F9.9: a condição `origem_agregada IS NULL`, que F9.8 tinha acrescentado
                -- aqui, foi REMOVIDA junto com a coluna. Ela existia porque a origem no norte
                -- de Goiás ficava com df_mun NULL sem ser desconhecida; agora essa origem
                -- resolve para a unidade 'NORTEGO' (df_mun NOT NULL) e a linha abaixo volta a
                -- dizer exatamente o que diz: origem que o QUESTIONÁRIO não informa.
                WHEN df_local = '2' AND df_mun IS NULL               THEN 'origem_nao_informada'
                WHEN df_local = '2' AND nasc_local = '2'             THEN 'nao_natural'
                WHEN df_local = '2'                                  THEN 'outro'
                ELSE NULL
            END                                                                 AS status,

            COALESCE(df_local = '2' AND nasc_local = '2' AND nasc_uf = uf
                 AND df_uf IS NOT NULL AND df_uf <> uf, FALSE)                  AS retorno_uf_natal,

            -- ================= escolaridade: nivel_instr_4 já vem pronto de 01_extract.sql;
            -- edu_grupo usa o MESMO CASE das outras quatro edições (25+) =================
            CASE WHEN idade >= 25 THEN
                CASE nivel_instr_4
                    WHEN '1' THEN 'sem_instr_fund_incompleto'
                    WHEN '2' THEN 'fund_completo_medio_incompleto'
                    WHEN '3' THEN 'medio_completo_superior_incompleto'
                    WHEN '4' THEN 'superior_completo'
                    ELSE 'nao_determinado'
                END
            END                                                                 AS edu_grupo,

            -- renda_classe: 'nao_aplicavel' em 100% das linhas -- renda só existe no Ceará (§7).
            CAST('nao_aplicavel' AS VARCHAR)                                    AS renda_classe,

            CASE
                WHEN idade IS NULL OR idade < 5 THEN NULL
                WHEN idade < 15 THEN '05_14'
                WHEN idade < 25 THEN '15_24'
                WHEN idade < 40 THEN '25_39'
                WHEN idade < 60 THEN '40_59'
                ELSE '60_mais'
            END                                                                 AS idade_grupo,

            -- sexo_label: v501 1 = M, 3 = F (§13a) -- convertido em INTEGER por 01_extract.sql.
            CASE p.sexo WHEN 1 THEN 'M' WHEN 3 THEN 'F' ELSE 'ignorado' END      AS sexo_label,

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
                     (CASE p.sexo WHEN 1 THEN 'M' WHEN 3 THEN 'F' ELSE 'I' END)
            END                                                                 AS idade_sexo_grupo
        FROM base p
    )
    SELECT
        uf, cd_mun, cd_apond, controle, peso, idade, df_mun, df_uf, nivel_instr_4, renda_pc,
        imp_df_local, imp_df_mun, imp_trab_mun,
        trab_local, trab_uf, trab_mun, retorna_3dias, transporte,
        tempo_desloc_cat, tempo_desloc_min, renda_trab,
        freq_escolar, curso, estudo_local, estudo_uf, estudo_mun,
        ocupado, estudante,
        COALESCE(trab_local = '3' AND trab_mun IS NOT NULL AND trab_mun <> cd_mun, FALSE)
                                                                                AS pendular_trab,
        COALESCE(estudo_local = '2' AND estudo_mun IS NOT NULL AND estudo_mun <> cd_mun, FALSE)
                                                                                AS pendular_estudo,
        pos_grupo, setor_grupo, ocup_grupo, modo_grupo, renda_trab_classe, curso_grupo,
        is_migrante, is_mig_interno, is_mig_internacional,
        origem_conhecida, origem_valida, interestadual,
        status, retorno_uf_natal,
        edu_grupo, renda_classe, idade_grupo, sexo_label, idade_sexo_grupo
    FROM classif
) TO 'data/interim/1980/pessoas_classificado.parquet' (FORMAT PARQUET);
