# RASCUNHO — seção "Edição Censo 1991 e comparabilidade" para `docs/METODOLOGIA.md`

> **Este arquivo não é a metodologia publicada.** É o texto que deve entrar em
> `docs/METODOLOGIA.md` em F7.7, depois de o pipeline rodar. A prosa metodológica (o quê, por quê,
> como) está completa; os números que só existirão depois da execução estão marcados com
> `[A PREENCHER EM F7.3/F7.7: ...]`. O agente de F7.7 deve colar esta seção logo depois de
> "Edição Censo 2000 e comparabilidade com 2022 e 2010", preencher as marcações e apagar este
> bloco de aviso.

---

## Edição Censo 1991 e comparabilidade com 2022, 2010 e 2000

A edição 1991 é a quarta do atlas e a primeira que exigiu reconstruir o insumo antes de processá-lo.
Os microdados da amostra do Censo Demográfico 1991 são públicos, mas chegam em **27 arquivos DBF**
(dBase III, um por Unidade da Federação), não nos TXT de largura fixa das edições posteriores. O
pipeline converte cada DBF para texto de largura fixa em `data/interim/1991/raw_txt/`
(`scripts/prep_1991.py`): 492 bytes de dados por registro, descartando os registros marcados como
excluídos no próprio DBF. A referência de data fixa é **01/09/1986 → 01/09/1991** — um quinquênio
exato, como nas outras três edições.

Duas características do arquivo de 1991 não têm paralelo nas edições mais novas e condicionam tudo
o que vem depois.

A primeira é que **há um único arquivo por UF, com as variáveis de domicílio replicadas em cada
linha de pessoa**. Não existe o par pessoas/domicílios que 2000, 2010 e 2022 têm, e portanto não
existe o `JOIN` por chave de domicílio — mas também **não existe chave de domicílio**. O DBF não
traz um identificador de domicílio: a única pista é `PESSOAN`, o número de ordem da pessoa dentro
do domicílio. A chave é reconstruída como um contador que avança a cada `PESSOAN = 1`, e a
reconstrução é verificável contra a documentação: o `LEIA_ME.DOC` do DVD declara, UF a UF, quantos
domicílios e quantas pessoas cada arquivo contém, e a contagem reconstruída bate exatamente
(em Roraima, 5.486 domicílios e 23.102 pessoas). Nacionalmente ela produz **4.024.553 domicílios**
para 17.045.712 pessoas — 4,24 pessoas por domicílio —, número que fecha por uma segunda via
independente: 4.024.553 = 3.971.593 chefes (`PARENDOM = 1`) + 52.960 moradores "individual"
(`PARENDOM = 20`, de domicílios coletivos). Essa chave é a unidade primária de amostragem do
estimador de variância e o denominador da renda per capita; sem ela, nenhum dos dois existe.

A segunda é que **a edição 1991 não tem deslocamento pendular**. O questionário da amostra não
pergunta em que município a pessoa trabalha ou estuda — o quesito que sustenta todo o módulo
pendular em 2000, 2010 e 2022 simplesmente não foi feito. A edição publica, portanto, os módulos de
migração (indicadores municipais, matriz de fluxos, recortes territoriais) e não publica nenhuma
tabela pendular nem o cruzamento migração × pendularidade do módulo metropolitano. Isso está
declarado em `pipeline/edicoes.py` (`pendular = False`, `pula_scripts = ["07"]`) e no front-end,
que esconde os recursos ausentes em vez de exibir tabela vazia. Há uma armadilha a registrar:
`LOCTRAB` ("local de trabalho") **não é** o município de trabalho — é o *tipo* de local (no
domicílio, via pública, propriedade agropecuária, empresa ou firma, casa do cliente, outro) — e não
deve ser usado como proxy de pendularidade em nenhuma circunstância.

### 1. O Censo 1991 tem o município de origem — correção de uma premissa do projeto

Até esta edição, `docs/EDICOES.md` registrava, por antecipação, que o Censo 1991 perguntaria
"apenas a UF ou o país de residência 5 anos antes, sem o município", e que isso "inviabiliza a
matriz origem→destino municipal como ela existe hoje e pode restringir a edição aos níveis
UF/RGInt". **A premissa estava errada e fica corrigida aqui.** O Censo 1991 coleta o par completo:
`MIMO86UF` (a UF, o país ou "neste município" da residência em 01/09/1986) e `MIMO86MU` (o
município, dentro daquela UF). A matriz origem→destino **municipal** de 1991 é publicável, e a
edição tem os mesmos níveis de agregação das outras três.

A identificação do migrante de data fixa é direta, com uma particularidade: o quesito só foi feito
a quem **não** respondeu "sempre morou neste município" e só a partir de 5 anos de idade, de modo
que o **branco é o padrão de salto do questionário, não uma não-resposta**. Isso foi confirmado num
cruzamento nacional exaustivo entre a variável de data fixa, a de naturalidade (`MINASCMU`) e a
idade: não existe um único registro com a data fixa em branco, 5 anos ou mais e naturalidade
diferente de "sempre morou", nem um único registro com "sempre morou" e a data fixa preenchida. A
regra de classificação é, então: branco ou "neste município" → não migrante; código de UF →
migrante interno; "país estrangeiro ou mal definido" → migrante internacional; "Brasil não
especificado" e "ignorado" → migrante interno com origem não informada.

O resultado é que **10,68% dos residentes de 5 anos ou mais mudaram de município entre 1986 e
1991** (13.916.688 pessoas de 130.283.012), ou 9,48% da população total; 0,05% vieram do exterior.
Advertência de leitura: esse número foi obtido dos próprios microdados e **não foi confrontado com
uma tabulação publicada pelo IBGE**, o que continua sendo desejável antes de citá-lo como série
histórica ao lado dos números de 2000, 2010 e 2022.

Do lado da origem, **nenhum código municipal ficou órfão**: os 1.551.374 registros de migrantes
internos com UF de origem válida e município informado casam todos com a malha de 1991, zero sem
par. Outros 49.404 trazem o município como "sem especificação" e, somados aos que não informaram
nem a UF, formam os **3,3% de migrantes internos com origem não informada** — que, como nas outras
edições, contam na imigração total do município de destino mas ficam fora da matriz
origem→destino e do cômputo de emigração. Ao contrário de 2010 (que usa `UF‖99999`) e de 2000 (que
usa códigos com o padrão `SUBSTR(cod,3,4) = '0000'`), a edição 1991 representa essa ausência com
**`NULL`**, não com um código-sentinela: as sentinelas de 1991 não vivem no espaço de códigos de
município, e fabricar um código de sete dígitos inexistente na malha seria criar um valor capaz de
vazar para a matriz num `JOIN` mal guardado.

Há ainda uma armadilha herdada das edições anteriores: `MIANMOMU` ("anos que mora no município"),
`MIANMOUF` e `MIULTMUD` ("última mudança") **não identificam o migrante de data fixa** — contam
tempo desde o último retorno ou a última mudança, não a posição em 1986, exatamente como `V0416`
em 2000 e `V0624` em 2010.

### 2. Status migratório reduzido, como em 2010 e 2000

O Censo 1991 não coleta o município de nascimento: pergunta se a pessoa nasceu no município de
residência e, em caso negativo, apenas a UF ou o país. Sem o município natal é impossível separar
`primeira_saida` (a residência de 1986 era o município de nascimento) de `etapas_multiplas`, e as
duas colapsam em `nao_natural`. O vocabulário publicado é, portanto, **idêntico ao de 2010 e
2000** — `retorno_natal`, `nao_natural`, `nascido_exterior`, mais os dois internacionais e a origem
não informada —, registrado em `pipeline/disclosure_rules.STATUS_POR_EDICAO` e no seletor do
front-end.

Como nas outras duas edições reduzidas, `retorno_natal` é **medido pelo próprio quesito e não por
inferência**: entre migrantes de data fixa, "nasceu neste município" só pode vir da resposta
"nasci aqui, mas já morei em outro lugar". A distribuição obtida é `nao_natural` 86,8%,
`retorno_natal` 9,3%, `origem_nao_informada` 3,0%, internacionais 0,5% e `nascido_exterior` 0,3%
dos migrantes de data fixa.

Duas notas de leitura. A primeira: a UF de nascimento vem num **código sequencial de 1 a 27**, não
no código IBGE, e o dicionário do próprio IBGE traz "SE" duas vezes (nas posições 15 e 16, quando a
16 é a Bahia) — o erro está corrigido na tabela de conversão do pipeline. A segunda: há uma
**subcontagem conhecida de `nascido_exterior`**, a mesma de 2000 — brasileiros natos nascidos no
exterior são instruídos a registrar "Brasil" na pergunta de naturalidade e acabam em `nao_natural`.
Em 2022 esses casos são capturados; em 1991, 2000 e 2010, não.

Por fim, 1991 tem **duas informações que nenhuma outra edição tem e que não são publicadas**. A
primeira é a **residência imediatamente anterior** (UF e município): um conceito de "última etapa"
que 2000, 2010 e 2022 não coletam ou não publicam. Publicá-la criaria um eixo sem par em qualquer
outra edição e, pior, deixaria ambíguo qual é "a" origem de um migrante de 1991 — o atlas passaria
a ter dois conceitos de origem convivendo num único seletor. A segunda é a **zona urbana ou rural
da moradia em 1986**, análogo exato do `V0424` de 2000 e não aproveitada pelo mesmo motivo. As duas
ficam registradas como material disponível para análise futura, não como colunas do contrato.

### 3. Escolaridade por anos de estudo

Como em 2000, o Censo 1991 não tem uma variável de "nível de instrução" pronta, e o nível é
derivado de `EDANOEST` ("anos de estudo"), a variável que o próprio IBGE calcula a partir do curso
e da série. Os cortes são os clássicos do IBGE, idênticos aos aplicados em 2000: até 7 anos =
sem instrução ou fundamental incompleto; 8 a 10 = fundamental completo e médio incompleto; 11 a 14
= médio completo e superior incompleto; 15 a 17 = superior completo; "não determinado" fica à
parte. O código de **"alfabetização de adultos"** entra em "sem instrução ou fundamental
incompleto" — é a mesma decisão de 2000, e a leitura correta do conteúdo: quem está em alfabetização
de adultos não concluiu o fundamental, e mandá-lo para "não determinado" misturaria uma categoria
conhecida com uma desconhecida. O universo é o mesmo das outras edições, 25 anos ou mais, e a
aproximação conhecida também é a mesma: graduações de três anos totalizam 14 anos de estudo e caem
em "médio completo e superior incompleto", o que subestima ligeiramente o superior completo frente
a 2010 e 2022, onde o nível vem do curso concluído.

### 4. Salário mínimo de referência: Cr$ 36.161,60, recuperado dos próprios dados

Esta é a primeira edição do atlas em que **a renda não vem pronta em número de salários mínimos**.
Em 2010 e 2000 o IBGE divulga o rendimento já convertido; em 1991, tanto o rendimento da ocupação
principal quanto o rendimento domiciliar estão em **Cruzeiros correntes**, e o atlas precisa de um
salário mínimo de referência para manter os cortes de renda (1/4, 1/2, 1 e 2 salários mínimos para
a renda per capita) comparáveis entre edições.

Escolher esse valor por memória histórica seria arriscado: 1991 foi um ano de hiperinflação, com o
mínimo reajustado várias vezes, e o plano do projeto trabalhava com dois candidatos — Cr$ 17.000,00
(vigente até agosto de 1991) e Cr$ 42.000,00. **Nenhum dos dois está correto.** O valor foi
recuperado por reconciliação com as faixas que o próprio IBGE calculou e divulgou ao lado dos
valores brutos: o Censo 1991 traz a renda da ocupação principal classificada em treze faixas de
salário mínimo e a renda domiciliar em onze. Dividindo os limites observados de cada faixa pelos
candidatos, **Cr$ 36.161,60 reproduz as treze faixas de rendimento individual e as onze de
rendimento domiciliar**, enquanto Cr$ 17.000,00 e Cr$ 42.000,00 reproduzem apenas uma de treze
cada. A reconciliação pelo lado do domicílio chega a cravar o centavo: a faixa "mais de 0,5 a 1
salário mínimo" termina em Cr$ 36.161 e a seguinte começa em Cr$ 36.164, o que confina o limite de
um salário mínimo àquele intervalo.

O valor gravado em `pipeline/edicoes.py` é, portanto, **Cr$ 36.161,60**, o mínimo vigente na data
de referência do censo (01/09/1991). Ressalva de procedência: ele foi **derivado dos microdados**,
por concordância com duas variáveis de faixa independentes construídas pelo IBGE, e não conferido
contra a legislação de 1991 — a evidência interna é forte (vinte e quatro limites de faixa
reproduzidos ao cruzeiro), mas a confirmação externa continua desejável. Nenhum deflator é
aplicado: os cortes de renda do atlas são relativos ao salário mínimo de cada censo, e é isso que
os torna comparáveis apesar do Cruzeiro, do Real e da inflação do período.

### 5. Renda domiciliar per capita: a armadilha de 2000, agora verificada

Como em 2000, o Censo 1991 não publica uma variável de rendimento domiciliar per capita, e a
construção ingênua está errada — mas em 1991 foi possível **demonstrar** isso, e não apenas herdar
a suspeita. Comparando o rendimento domiciliar divulgado com a soma dos rendimentos individuais dos
moradores, a identidade fecha em **100% dos domicílios particulares** quando se excluem da soma os
pensionistas, os empregados domésticos residentes e os parentes dos empregados domésticos; quando
se incluem, fecha em 98,6% — e, entre os domicílios que de fato têm alguma dessas pessoas, em
apenas 7 de 75. O numerador do IBGE exclui esses moradores; o denominador tem de excluí-los
também, sob pena de subestimar a renda per capita exatamente nos domicílios que têm empregado
doméstico residente, que são os de renda mais alta. O denominador usado é, portanto, a contagem de
moradores fora daquelas três categorias, obtida por agregação da própria chave de domicílio
reconstruída. Domicílio coletivo fica nulo (`nao_aplicavel`), como nas demais edições.

### 6. Estrato de variância: município × situação, como aproximação declarada

**O Censo 1991 não tem área de ponderação.** Ela é o estrato do estimador de conglomerados em
último estágio que o atlas usa desde 2022 e existe nas outras três edições — em 2000 são 9.336
áreas, cada uma contida num único município. Em 1991 não há nada equivalente, e a edição precisa de
um estrato para publicar erro-padrão e coeficiente de variação.

A decisão adotada é usar **município × situação urbana ou rural do setor censitário** como estrato:
os setores urbanizados, não urbanizados e urbanizados isolados formam o estrato urbano do
município; os aglomerados rurais e a área rural formam o rural. A variável de situação está sempre
preenchida e sempre dentro do intervalo válido, sem um único caso nulo ou fora de escala, e ela
valida de quebra o peso amostral: a proporção ponderada de população urbana resultante é **75,60%**,
contra os 75,59% publicados pelo IBGE para 1991. O resultado são **8.939 estratos** — mesma ordem
de grandeza das 9.336 áreas de ponderação de 2000 —, com mediana de 877 registros por estrato e
apenas um estrato com menos de cinco registros.

Isso é uma **aproximação, e está declarado como tal**: não é a área de ponderação do desenho
amostral do IBGE, os pesos de 1991 não foram calibrados nessa partição, e o estrato aqui é mais
heterogêneo do que uma área de ponderação real — o que tende a inflar a variância estimada, ou
seja, a errar para o lado conservador. A validação é feita sobre o resultado, comparando a
distribuição do coeficiente de variação dos fluxos publicados de 1991 com a de 2000; o critério é
que a mediana e a média fiquem a menos de dez pontos percentuais de distância. **Se a comparação
reprovar, a decisão registrada é publicar a edição 1991 com `se` e `cv` nulos**, mantendo a
contagem amostral e todo o arredondamento das regras de revelação — uma edição sem precisão
declarada é preferível a uma edição com precisão declarada e errada.

`[A PREENCHER EM F7.3/F7.7: resultado da comparação — distribuição do CV dos fluxos de 1991
(n, mín, máx, média, mediana) contra a de 2000 e a de 2022, e a decisão decorrente: publicar se/cv
ou publicá-los como NULL.]`

### 7. Recortes territoriais: 4.491 municípios e o maior anacronismo do atlas

O Brasil de 1991 tinha **4.491 municípios**; o de 2022 tem 5.572. Como nas edições anteriores, o
atlas aplica retroativamente, por código de município, os recortes de 2022 — Regiões Geográficas
Imediatas, Intermediárias e o recorte metropolitano —, para que os níveis de agregação da interface
sejam navegáveis entre censos. A relação entre as duas malhas é limpa num sentido e pesada no
outro: **todos os 4.491 municípios de 1991 existem em 2022 com o mesmo código** (nenhum foi
extinto ou teve o código alterado), mas **1.082 municípios de 2022 não existem em 1991** — todos
criados depois, quase todos por desmembramento.

É um salto de escala em relação às outras edições: entre 2010 e 2022 o problema se resumia a cinco
municípios instalados em 2013; entre 2000 e 2022, a nenhum. Aqui são 1.082, e por isso o aviso
registrado em `docs/EDICOES.md` sobre áreas mínimas comparáveis passa a ser operante, e não mais
uma preocupação futura.

Onde o anacronismo **não** morde: as **510 Regiões Geográficas Imediatas e as 133 Intermediárias
continuam todas povoadas** em 1991, nenhuma fica vazia, e nenhum município de 1991 ficou sem
recorte. Nesses dois níveis a agregação de 1991 é diretamente comparável à das outras edições,
porque cada município criado depois saiu de dentro de um município que já pertencia à mesma região.

Onde ele morde: o **recorte metropolitano**. As 81 regiões metropolitanas e RIDEs de 2022 continuam
todas presentes em 1991 — nenhuma fica vazia —, mas **1.132 municípios de 1991 têm região
metropolitana, contra 1.388 em 2022**, e **66 das 81 regiões aparecem em 1991 com menos municípios
do que em 2022**. Em 2010 eram quatro regiões afetadas; em 2000, seis. A leitura correta é que uma
região metropolitana de 1991 tem a **composição municipal** de 1991, não a de 2022: o território
que hoje é um município autônomo da região estava, em 1991, dentro do município de origem do
desmembramento. Quando esse município de origem também pertence à região, o território coberto é o
mesmo e só a contagem de municípios muda; quando não pertence, o território da região em 1991 é
efetivamente menor. **Essa distinção precisa ser quantificada antes de publicar o módulo
metropolitano da edição 1991**, e é o ponto em que uma tabela de áreas mínimas comparáveis passa a
ser necessária.

`[A PREENCHER EM F7.3/F7.7: dos 256 municípios metropolitanos de 2022 ausentes em 1991, quantos têm
o município de origem do desmembramento dentro da mesma região (território preservado) e quantos
não têm (território efetivamente menor em 1991); listar as regiões mais afetadas em proporção.]`

`[A PREENCHER EM F7.7: decisão final sobre áreas mínimas comparáveis — se a edição 1991 publica o
módulo metropolitano com a composição de 1991 e uma nota de leitura, ou se a comparação entre
edições passa a ser feita sobre AMC.]`

### Validações realizadas (F7, edição Censo 1991)

`[A PREENCHER EM F7.3/F7.7: completar com os resultados sobre os dados publicados, no formato das
seções equivalentes de 2010 e 2000.]`

- Σ peso da amostra de pessoas = **146.815.790**, contra os 146.825.475 do Censo 1991 (−0,007%).
- **17.045.712** registros de pessoas, 27 UFs, **4.491** municípios distintos — igual à malha de
  1991 —, todos com correspondência em `labels.RECORTES`.
- Chave de domicílio reconstruída: **4.024.553** domicílios, 4,24 pessoas por domicílio,
  conferida por duas vias independentes (contagem de chefes mais moradores "individual", e a
  tabela de domicílios e pessoas por UF do `LEIA_ME.DOC`).
- Proporção ponderada de população urbana = **75,60%**, contra os 75,59% publicados pelo IBGE.
- Migração de data fixa: **10,68%** dos residentes de 5 anos ou mais; **zero** códigos de
  município de origem sem correspondência na malha de 1991; 23 registros com origem igual ao
  destino, removidos pela regra de origem válida que já vale nas outras edições.
- Salário mínimo de referência: 13 de 13 faixas de rendimento individual e 11 de 11 de rendimento
  domiciliar reproduzidas com Cr$ 36.161,60.
- Renda domiciliar: identidade entre o rendimento divulgado e a soma dos rendimentos individuais
  fecha em 100% dos domicílios particulares testados com o denominador que exclui pensionistas e
  empregados domésticos.
- `[A PREENCHER EM F7.3: Σ imigrantes = Σ emigrantes; Σ saldos = 0; pares publicáveis em
  fluxos_bruto.]`
- `[A PREENCHER EM F7.3: distribuição do CV dos fluxos contra a de 2000 e a de 2022.]`
- `[A PREENCHER EM F7.7: gate de revelação — número de arquivos publicados, versão e caminho do
  relatório.]`
