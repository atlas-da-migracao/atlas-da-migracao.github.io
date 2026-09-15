# Convenções multi-edição e guia para incluir um novo censo

## Por que este documento existe

O atlas já publica quatro edições — Censo 2022 (primeira), Censo 2010 (segunda), Censo 2000
(terceira) e Censo 1991 (quarta) — e há intenção de incluir o Censo **1980**. Quase toda decisão de engenharia tomada até aqui tem uma
consequência de comparabilidade que não é óbvia seis meses depois: onde ficam os arquivos, qual
recorte territorial vale, o que fazer quando um questionário não pergunta algo que o outro
pergunta. Este documento registra cada uma dessas decisões **com a alternativa que foi descartada e
o motivo**, para que uma nova edição as herde em vez de redecidi-las (ou, pior, decidi-las de
outro jeito e produzir duas edições que não conversam).

Escopo: convenções de arquitetura e comparabilidade. As definições substantivas (quem é migrante,
como se classifica o deslocamento pendular, as regras de revelação R1–R9) estão em
`docs/METODOLOGIA.md`, que continua sendo a referência metodológica — este documento aponta para
ela, não a duplica.

## Decisões já tomadas

| Decisão | Escolha | Alternativa rejeitada | Motivo |
| --- | --- | --- | --- |
| Layout de pastas por edição | 2022 permanece "flat" na raiz de `data/interim`/`data/processed`; toda edição nova ganha subpasta própria (`data/interim/<edicao>`, `data/processed/<edicao>`, `data/geo/raw/<edicao>`). Ver `pipeline/edicoes.py`. | Mover 2022 para `data/processed/2022/` e tratar todas as edições igual | Mudar o layout de 2022 quebraria os paths já publicados no site, o deploy e o `.gate_ok` existente. A assimetria é feia, mas está isolada num único lugar (`edicoes.py` no Python, `basePath()` no TypeScript). |
| Gate de revelação por edição | Cada pasta de edição tem o **seu próprio** `.gate_ok`, carimbando só os arquivos daquela pasta. `pipeline/verify_gate.py` detecta subpastas com `.gate_ok` próprio ("subgates") e as exclui de todas as varreduras do gate externo. | Um único `.gate_ok` cobrindo `data/processed` inteiro, recursivamente | Um carimbo único faria qualquer republicação de uma edição invalidar o carimbo de todas as outras, e obrigaria a rodar `disclosure_check.py` (que exige microdados) sobre edições que não mudaram. Com subgates, o CI roda `verify_gate.py --dir <pasta>` uma vez por edição, independentemente. |
| Fonte única de configuração | `pipeline/edicoes.py` (paths, salário mínimo, período de referência, overrides de SQL) espelhado por `web/src/lib/edicoes.ts` (path base dos dados, recursos disponíveis, vocabulário, rótulos). | Uma única fonte compartilhada (JSON gerado, ou config lida pelo front) | Os dois lados precisam de coisas diferentes: o pipeline precisa de paths de microdado e constantes de cálculo, que **nunca** podem vazar para o bundle do site; o front precisa de rótulos e de quais recursos existem. Duas fontes paralelas e pequenas, com o comentário de cabeçalho de cada uma apontando para a outra, saiu mais seguro que uma fonte única acoplada. O preço é manter as duas sincronizadas ao adicionar uma edição. |
| Override de SQL por edição | `pipeline/sql/<edicao>/NN_nome.sql` substitui `pipeline/sql/NN_nome.sql` **se existir** (mesmo nome de arquivo, mesma ordem de execução). Um override escreve os paths literais da própria edição; os scripts genéricos, esses sim, passam por substituição automática de prefixo (`_adaptar_sql` em `pipeline/run.py`). | Um único SQL genérico com `CASE WHEN edicao = ...` ou templating de variáveis | Os censos divergem em vocabulário de variável, não só em caminho: tentar cobrir 2010 e 2022 no mesmo arquivo produziria um SQL ilegível e frágil. Com override por nome, a diferença fica visível como diff entre dois arquivos, e o cabeçalho de cada override documenta exatamente em que pontos ele diverge do genérico. Overrides **não** passam por `_adaptar_sql` (duplicaria o prefixo da edição). |
| Contrato de esquema de `pessoas_classificado.parquet` | Toda edição produz a tabela classificada com o **mesmo conjunto de colunas**; o que a edição não mede fica `NULL` (ex.: `modo_grupo`, `tempo_desloc_min` em 2010). | Cada edição com seu próprio esquema, e scripts a jusante adaptados | O esquema estável é o que permite reaproveitar os scripts posteriores sem mexer neles. Hoje `03_indicators.sql` roda idêntico nas duas edições (só com a troca de paths); `04`, `07` e `08` têm override **apenas** pelas divergências de vocabulário e de publicação documentadas em `docs/METODOLOGIA.md`, não por diferença de estrutura. Quanto mais o contrato for respeitado, menos overrides uma edição nova precisa. |
| Recortes territoriais (RGI, RGInt) | A divisão de 2017 do IBGE aplicada **retroativamente** por código de município, a partir de `pipeline/labels.py` (`RECORTES`, dicionário de 2022). | Usar a divisão vigente em cada censo (mesorregião/microrregião de 2010 etc.) | Sem um recorte comum, os níveis de agregação da interface (RGI, RGInt, UF) não seriam navegáveis entre edições. O anacronismo é explícito e documentado, e o custo é conhecido: 510 RGIs e 133 RGInts nas três edições (2022, 2010 e 2000), nenhum município sem correspondência. |
| Recorte metropolitano | Idem: as **81 RMs/RIDEs do dicionário de 2022** aplicadas retroativamente por código de município (`pipeline/build_ref.py::_build_outra_edicao`). | O recorte metropolitano do próprio censo — em 2010, a variável `V1004`, com 42 unidades (36 RMs, 3 RIDEs, 3 aglomerações urbanas do RS) | Alternativa avaliada e descartada: 38 das 42 unidades de 2010 têm par nominal em 2022, mas mesmo essas têm **composição municipal diferente**, então usá-las daria RMs que mudam de recorte quando o usuário troca de censo. Custo assumido: municípios criados depois do censo antigo simplesmente não existem nele (4 casos entre 2010 e 2022 — ver `docs/METODOLOGIA.md`, item 6). |
| `cd_rm` | Sempre o `COD_CATMETROPOL` de 2022, em todas as edições. | Código nativo de cada censo | Consequência direta do recorte retroativo: é o identificador que permite ao front trocar de edição mantendo a seleção do usuário. |
| Núcleo metropolitano | Município **membro** homônimo (o nome do município aparece como sequência inteira de palavras no nome da região); sem homônimo, o mais populoso. Um único `pipeline/rm_nucleo.csv`, gerado por `pipeline/build_rm_nucleo.py`, compartilhado por todas as edições. | Regra "sempre o mais populoso" (a original), ou um núcleo por edição | O homônimo é a definição que corresponde ao conceito de cidade-núcleo em casos como a Grande Vitória, onde o mais populoso (Serra) não é o centro funcional. A regra foi aplicada retroativamente também a 2022 para que uma RM não troque de núcleo ao trocar de censo — mudou o núcleo de 3 das 81 regiões. `--check` no script falha se o CSV sair de sincronia. |
| Vocabulários que mudam com o questionário | Declarados por edição: `pipeline/disclosure_rules.STATUS_POR_EDICAO` no pipeline e `recursos`/`vocabulario`/`rotuloRetorno`/`statusCategorias` em `web/src/lib/edicoes.ts`. Os componentes consultam a configuração da edição. | `if (censo === "2010")` espalhado pelos componentes e pelo SQL de publicação | Uma condicional por edição multiplica-se por edição × componente; com cinco censos, seria inviável. Declarar o vocabulário num lugar só faz a edição nova ser um registro novo na tabela, não uma varredura pelo código. Cobre: categorias de `status` migratório, frequência de retorno pendular, faixas de tempo de deslocamento e presença/ausência da dimensão "modo de transporte". |
| `NULL` vs `0`/`false` | "Esta edição não mede isso" é sempre `NULL`, gravado explicitamente (ex.: `CAST(NULL AS DOUBLE)` em `pipeline/sql/2010/08_metro.sql`), nunca `0`, `false` ou string vazia. | Deixar o agregador convergir para `NULL` sozinho, ou preencher com zero | Zero é um valor medido; ausência não é. Gravar explicitamente documenta a ausência no próprio SQL em vez de depender de efeito colateral, e o front decide se esconde o indicador (via `recursos`) em vez de exibir "0%". |
| Regras de revelação | R1–R9 idênticas em todas as edições, num único caminho de código (`pipeline/disclosure_rules.py` aplicado por `publish.py` e verificado por `disclosure_check.py --edicao <e>`). Só o vocabulário de `status` varia. | Limiares calibrados por edição (ex.: mais frouxos para microdados públicos como os de 2010) | Um único conjunto de regras é auditável e transferível; calibrar por edição criaria a obrigação de justificar cada limiar separadamente e abriria a porta para publicar em 2010 algo que não se publicaria em 2022. O relatório sai com sufixo de edição (`docs/relatorio_revelacao_<edicao>_<versao>.md`) para não colidir. |
| Estimador de variância | O mesmo estimador de conglomerados em último estágio (domicílio como UPA, área de ponderação como estrato) reaproveitado sem alteração entre 2022, 2010 e 2000. | Reestimar o desenho amostral de cada censo | Os três censos têm o mesmo desenho relevante (amostra sistemática por domicílio, calibração GLS por área de ponderação) e o resultado foi validado edição a edição: a distribuição de CV dos fluxos de 2010 e a de 2000 são praticamente idênticas à de 2022. **Isto não se generaliza automaticamente para 1991 e 1980** — cada edição nova refaz a verificação; ver avisos abaixo. |
| Formato de origem legado | Quando os microdados não vêm em texto de largura fixa, a conversão é uma **etapa separada e anterior ao pipeline** (`scripts/prep_<edicao>.py`), que grava TXT de largura fixa em `data/interim/<edicao>/raw_txt/`; o SQL da edição continua lendo só texto. Modelo: `scripts/prep_1991.py` (27 DBF dBase III → TXT de 492 bytes). | Ler o formato legado direto do DuckDB, ou converter para Parquet | Isolar a conversão deixa o `01_extract.sql` da edição igual ao das outras e torna a etapa frágil (offsets, registros deletados, encoding) testável sozinha, UF a UF, contra a documentação pública do censo. Converter para Parquet pularia a checagem de largura fixa contra o layout do IBGE, que é justamente o que pega erro de posição. |
| Módulo inteiro ausente na edição | Flag booleana própria na dataclass `Edicao` (`pendular: bool`), **distinta** de `rotulos_pendular`: `pendular=False` remove o módulo pendular inteiro (tabelas, colunas do contrato e o submódulo pendular de RM), enquanto `rotulos_pendular` só apaga dimensões *dentro* de um módulo que existe. Primeiro uso: 1991. | Deduzir a ausência do módulo de `pula_scripts`, ou de `rotulos_pendular` todo nulo | `pula_scripts` é instrução de orquestração (qual SQL não roda) e não expressa o fato metodológico; e derivar "não tem módulo" de "todos os rótulos são nulos" confunde duas coisas diferentes — uma edição pode ter pendular sem ter as dimensões de tempo/modo/frequência, que é exatamente o caso de 2000. A flag declara o fato uma vez, e o pipeline e o front consultam a mesma declaração. |
| Núcleo metropolitano ausente na edição | Fallback aplicado **na edição**, não no CSV: quando o `cd_nucleo` de `pipeline/rm_nucleo.csv` não existe na malha do censo, o núcleo passa a ser o **município mais populoso entre os presentes naquela edição** — a mesma regra que `build_rm_nucleo.py` usa quando não há homônimo. Primeiro caso: RM do Sul do Estado (RR) em 1991, núcleo Rorainópolis → São João da Baliza. | Mudar o CSV compartilhado, ou deixar a RM sem núcleo | O CSV é compartilhado por todas as edições de propósito (uma RM não troca de núcleo quando o usuário troca de censo); alterá-lo por causa de uma edição antiga mudaria o núcleo também em 2022. Sem núcleo, todos os pares intra-RM cairiam em `periferia_periferia`, que é um dado errado e silencioso. O fallback fica restrito às RMs afetadas e é declarado em `docs/METODOLOGIA.md`. |

## Avisos específicos para 1980 (e o que as edições 2000 e 1991 já resolveram)

Cada item abaixo é um ponto onde a convenção da tabela acima provavelmente **não** vale, e que
precisa de decisão nova e registrada — não de cópia. Os itens 3, 4 e 5 foram revistos depois de
implementar a edição 2000, e **todos os seis foram revistos de novo depois de implementar a edição
1991**: onde falavam de 1991 por antecipação, agora falam do que se verificou de fato — e em dois
casos (avisos 2 e 6) o que estava escrito por antecipação estava **errado**. O aviso passa a valer
só para 1980.

1. **Códigos de município mudam muito mais.** Entre 2010 e 2022 o problema se resumiu a cinco
   municípios instalados em 2013, resolvidos como "ausentes do censo antigo". De 1980 para 2022 há
   **centenas** de desmembramentos, e o município de origem nem sempre pertence ao mesmo recorte do
   município desmembrado. Aplicar RGI/RGInt e o recorte metropolitano retroativamente por código
   passa a exigir uma tabela de **áreas mínimas comparáveis** (AMC), construída antes de qualquer
   agregação territorial, e não apenas um filtro de códigos ausentes. Decidir também se a AMC vira
   um nível de agregação visível na interface ou só uma etapa interna. O Censo 2000 **ainda não
   precisou de AMC**: os 5.507 municípios de 2000 têm todos par em `labels.RECORTES`, e o recorte
   metropolitano perde só seis municípios (contra quatro em 2010), todos com o município de origem
   do desmembramento na mesma RM. O salto de escala é, portanto, de 2000 para 1991, não de 2010
   para 2000. *(Verificado na edição 1991 — o salto se confirmou.)* Em 1991 são **1.082 códigos de
   `labels.RECORTES` sem par na malha do censo** (1.079 deles municípios publicados de 2022),
   contra 6 em 2000 e 4 em 2010, no sentido 2022→1991; no sentido inverso, os 4.491 municípios de
   1991 têm todos par em 2022. **A decisão do usuário foi manter a convenção "por código, sem
   AMC"**, documentando o anacronismo em vez de construir a tabela de áreas mínimas comparáveis:
   uma AMC mudaria a unidade de análise de todas as edições ao mesmo tempo, e o custo medido está
   concentrado num único nível. RGI e RGInt **não** são afetadas (as 510 e as 133 continuam todas
   povoadas em 1991, nenhum município sem recorte); o recorte metropolitano é — 66 das 81 regiões
   com menos municípios que em 2022, três delas com um único município. Ver `docs/METODOLOGIA.md`,
   itens 10 e 11 da seção de 1991. Para 1980 a decisão precisa ser retomada: o anacronismo cresce
   mais uma vez, e a alternativa AMC volta à mesa.
2. **A variável de data fixa muda de definição.** *(Corrigido depois de implementar a edição 1991
   — a redação anterior, "o Censo 1991 pergunta apenas a UF ou o país de residência 5 anos antes,
   sem o município, o que inviabiliza a matriz origem→destino municipal", estava **factualmente
   errada** e tinha sido escrita por antecipação.)* O par (residência há 5 anos, residência atual)
   não é o mesmo quesito em todos os censos, mas **2000 e 1991 têm os dois o município de origem**.
   O Censo 2000 tem o município de residência em 31/07/1995, com um universo **mais largo** que o de
   2010/2022 (sem o filtro de "menos de 6 anos no município"). O Censo 1991 tem o par
   `MIMO86UF` + `MIMO86MU` — "onde morava em 01/09/1986", UF/país e município dentro daquela UF —,
   de modo que a matriz origem→destino **municipal** de 1991 é publicável e a edição **não** fica
   restrita a UF/RGInt. O salto que ainda não aconteceu é para **1980**, que precisa ser conferido
   no seu próprio questionário, sem presumir nem o melhor nem o pior caso. Duas armadilhas já
   conhecidas em duas edições e a reconferir em 1980: (a) o código de origem pode ser referido à UF
   **de origem**, não à de residência (em 1991, `MIMO86MU` é o município dentro de `MIMO86UF`), e
   (b) variáveis de "tempo de residência no município" e de "última mudança" **não** identificam o
   migrante de data fixa (`V0416` em 2000, `V0624` em 2010, `MIANMOMU`/`MIULTMUD` em 1991).
   A distinção entre município de nascimento e residência anterior, que 2022 tem e 2010 já não tem,
   também precisa ser reconferida censo a censo antes de mapear as categorias de `status`:
   conferida em 2000 (o quesito 4.21 pergunta só a UF ou o país) e em 1991 (`MINASCMU` diz apenas
   se a pessoa nasceu no município, e `MIUFPAIS` dá só a UF ou o país), e por isso as duas usam o
   **vocabulário reduzido** de 2010 — ver `docs/METODOLOGIA.md`, item 3 das seções de 2000 e de
   1991.
3. **O módulo pendular existe em 2000; o que muda é o detalhe do deslocamento.** *(Revisto depois
   de implementar a edição 2000 — a redação anterior, "pendular só existe a partir de 2010",
   estava errada.)* O quesito "em que município trabalha ou estuda" é o que sustenta todo o módulo
   pendular e o cruzamento migração × pendularidade do módulo metropolitano, e o Censo 2000 **tem**
   esse quesito (o 4.27, `V4276`): destino de trabalho, destino de estudo e o módulo metropolitano
   inteiro são publicados na edição 2000. Exclusivos de 2010 e 2022 são **tempo gasto** e
   **frequência de retorno**; **meio de transporte** é exclusivo de 2022 (2010 também não tem)
   — daí `pct_diario`/`tempo_mediano` nulos em 2000 (`pct_coletivo` já é nulo desde 2010) e três
   dimensões a menos (`modo`, `frequencia`, `tempo`) em `pendular_trab_dim.parquet` frente a 2022
   (ver `docs/METODOLOGIA.md`, itens 1 e 5 da seção de 2000). A armadilha de 2000 é outra e não é de
   cobertura, é de universo: **um único quesito cobre trabalho e estudo**, com precedência do
   trabalho, o que faz do fluxo de estudo um piso e não uma estimativa do total — leia o aviso de
   leitura daquela seção antes de comparar níveis entre edições. **1991 não tem nada de
   pendular — confirmado no questionário da amostra**, que não pergunta em que município a pessoa
   trabalha ou estuda; a edição publica só os módulos de migração, com a flag `pendular = False` em
   `pipeline/edicoes.py` (que remove o módulo inteiro, inclusive o submódulo pendular de RM),
   `pula_scripts = ["07"]` e os recursos pendulares desligados em `web/src/lib/edicoes.ts`, de modo
   que o front esconde o que não existe em vez de mostrar tabela vazia. Armadilha registrada: em
   1991, `LOCTRAB` **não** é município de trabalho, é o *tipo* de local (domicílio, via pública,
   empresa, casa do cliente…) — não serve nem como proxy. Para 1980, a confirmar no questionário.
4. **Peso amostral e desenho da amostra mudam de metodologia.** A calibração, a fração amostral e
   a definição de estrato variam entre censos. O reaproveitamento do estimador de variância entre
   2022 e 2010 foi **verificado**, não presumido; a mesma verificação foi refeita e **passou para o
   Censo 2000** (mesmo desenho — amostra sistemática de domicílios, calibração GLS por área de
   ponderação —, e distribuição do CV dos fluxos praticamente idêntica à das outras duas edições).
   **Em 1991 a verificação foi feita e o estimador foi aprovado, mas com ressalva** (ver aviso 5):
   como não há área de ponderação, o estrato é um substituto, e a comparação bruta de mediana/média
   do CV **não serve de critério** — a mediana do CV dos fluxos antes da supressão é 100% nas
   quatro edições, porque a massa de pares tem uma observação só. O teste que discrimina é
   estratificar por `n`: com `n ≥ 5`, `n ≥ 30` e `n ≥ 100`, 1991 fica 5% a 20% mais impreciso que
   2000, dentro da tendência que as edições já mostravam entre si. Para 1980 a verificação continua
   a fazer, antes de publicar erro-padrão e coeficiente de variação, e continua valendo a
   possibilidade de a edição publicar estimativas sem precisão declarada — use o teste estratificado
   por `n`, não a mediana bruta.
5. **Área de ponderação: existe em 2000, some em algum ponto antes disso.** *(Precisado depois de
   implementar a edição 2000.)* A área de ponderação é o estrato do estimador de variância do
   atlas e a unidade em que os pesos são calibrados, então saber se ela existe decide se a edição
   publica erro-padrão e CV. Situação: **2022 e 2010 têm; o Censo 2000 também tem** — 9.336 áreas
   no país, cada uma contida em um único município e com no mínimo 400 domicílios particulares
   ocupados na amostra, com calibração por Mínimos Quadrados Generalizados (Bankier) idêntica em
   estrutura à das edições mais novas, o que permitiu reaproveitar o estimador sem adaptação e
   validá-lo (ver `docs/METODOLOGIA.md`, "Validações realizadas (F6, edição Censo 2000)":
   distribuição do CV dos fluxos praticamente idêntica à de 2010 e 2022). **O Censo 1991 não
   tem** — conferido na documentação da amostra. A solução adotada foi um **estrato substituto:
   `cd_mun` × situação urbano/rural do setor censitário** (urbanizado, não urbanizado e urbanizado
   isolado formam o estrato urbano; aglomerado rural e área rural, o rural), o que dá **8.939
   estratos** contra as 9.336 áreas de ponderação de 2000, com mediana de 877 registros por estrato
   e um único estrato com menos de 5 registros. Resultado da validação: **aprovado com ressalva** —
   a edição publica `se` e `cv`, e a precisão sai **conservadora**, porque o estrato substituto é
   mais heterogêneo que uma área de ponderação real e infla a variância. Estratificando os fluxos
   por tamanho de amostra, a mediana do CV de 1991 fica em 64,5% (`n ≥ 5`), 28,2% (`n ≥ 30`) e
   15,0% (`n ≥ 100`), contra 59,5%, 25,5% e 13,5% em 2000 — 5% a 20% pior, dentro da tendência
   entre edições. Ver `docs/METODOLOGIA.md`, item 9 e as validações da seção de 1991. **1980 não
   tem**, e para essa edição ou se adota um estrato substituto como o de 1991 (validando-o pelo
   mesmo teste estratificado), ou ela publica sem erro amostral. Decisão metodológica, não de
   implementação.
6. **Salário mínimo e renda.** A edição 2010 pôde reaproveitar os cortes relativos porque o IBGE já
   divulga a renda **em número de salários mínimos**; 2000 também (`V4514`, com o SM de julho de
   2000, R$ 151,00). **1991 é a primeira edição em que isso não existe**: o rendimento vem em
   Cruzeiros correntes e precisa ser dividido por um salário mínimo de referência. A decisão
   tomada — e o método a repetir em 1980 — foi **não** escolher o valor por memória histórica nem
   deflacionar, e sim **recuperá-lo por reconciliação com as faixas de salário mínimo que o próprio
   IBGE calculou** ao lado dos valores brutos: Cr$ 36.161,60 reproduz 13 de 13 faixas de rendimento
   individual e 11 de 11 de rendimento domiciliar, enquanto os dois candidatos do plano
   (Cr$ 17.000,00 e Cr$ 42.000,00) reproduzem uma de treze cada. Nenhum deflator é usado: os cortes
   do atlas são relativos ao SM de cada censo. Ressalva **importante, registrada em F7.7**: o valor
   é o de referência **implícito nas faixas do IBGE**, e **não** o salário mínimo legal da data do
   censo — a conferência externa (série `MTE12_SALMIN12` do Ipeadata) dá Cr$ 17.000,00 de março a
   agosto de 1991 e Cr$ 42.000,00 a partir de 1º/09/1991. Em 1980, espere a mesma situação e
   **prefira a reconciliação com as faixas do próprio censo à norma salarial do mês**. Atenção a uma armadilha que só
   apareceu em 2000 e pode reaparecer: a **renda domiciliar per capita** pode não vir pronta, e
   construí-la dividindo o rendimento domiciliar pelo total de moradores dá errado quando o
   numerador do IBGE já exclui pensionistas e empregados domésticos residentes e o denominador não
   — ver `docs/METODOLOGIA.md`, item 2 da seção de 2000.

## Checklist para incluir uma edição nova

Ordem sugerida; cada passo aponta para o arquivo desta vez que serve de modelo. Não repita o
conteúdo deles — leia-os e faça o análogo.

1. **Registrar a edição.** Novo registro em `pipeline/edicoes.py` (paths, salário mínimo, período
   de referência, `sql_override_dir`, `pula_scripts`) e em `web/src/lib/edicoes.ts` (rótulos,
   `recursos`, `vocabulario`, `statusCategorias`). Use os registros de 2010 como modelo dos dois.
2. **Parsear a documentação pública do censo.** `pipeline/layout_2010.py` (posições de largura
   fixa a partir do layout .ods do IBGE) e `pipeline/labels_2010.py` (municípios e divisão
   territorial) são o modelo: módulos **gerados**, não editados à mão, sem nenhum microdado dentro.
   Se os microdados vierem em formato legado (DBF, EBCDIC, blocado), a conversão para largura fixa
   é uma etapa anterior e separada — `scripts/prep_1991.py` é o modelo —, e **teste-a numa UF
   pequena, com `--check` contra as contagens de domicílios e pessoas da documentação, antes de
   rodar as 27**: em 1991 um erro de offset na chave de domicílio (que é a UPA do estimador de
   variância) passou pela conversão inteira sem erro visível, e só apareceu ao comparar a média de
   pessoas por domicílio com o `LEIA_ME.DOC`. Confira também se o dicionário do IBGE tem erros de
   digitação nos códigos (em 1991, a tabela de UF de nascimento traz "SE" duas vezes).
3. **Decidir e documentar as divergências de questionário ANTES de escrever SQL.** É trabalho de
   metodologia, não de implementação: para cada variável do pipeline, a edição nova mede a mesma
   coisa, mede coisa parecida com definição diferente, ou não mede? A resposta vira uma entrada na
   seção de comparabilidade de `docs/METODOLOGIA.md` e um comentário no cabeçalho do SQL. **Leia o
   questionário da edição em vez de confiar no que este documento antecipa sobre ela**: o aviso 2
   afirmou por anos que 1991 não teria município de origem na data fixa, e estava errado. Se a
   edição medir algo que nenhuma outra mede (em 1991: última etapa migratória, zona urbano/rural da
   moradia anterior, raça/cor), a decisão-padrão é **não publicar** — o contrato de 49 colunas só
   ganha dimensão nova quando ela entra em todas as edições de uma vez.
4. **Escrever só os overrides necessários** em `pipeline/sql/<edicao>/`, usando `pipeline/sql/2010/`
   como modelo — inclusive a convenção de cabeçalho, que lista ponto a ponto em que o override
   diverge do script genérico. Respeitar o contrato de esquema de `pessoas_classificado.parquet`:
   o que a edição não mede é coluna `NULL`, não coluna ausente.
5. **Referência territorial e geo.** `pipeline/build_ref.py::_build_outra_edicao` é o ponto onde os
   recortes de 2022 (RGI, RGInt, RM) são aplicados retroativamente — é aqui que entra a tabela de
   áreas mínimas comparáveis, se a edição precisar de uma. Meça o anacronismo antes de seguir:
   quantos códigos de 2022 não existem na edição, se alguma RGI/RGInt fica vazia, quantas RMs
   perdem municípios e **se alguma RM fica com um único município** — nesse caso os indicadores
   intrametropolitanos ficam zerados por construção e precisam de aviso na metodologia (em 1991 são
   três). Malha: `geo/fetch_2010.sh` é o modelo de
   como obter e normalizar shapefiles antigos do geoftp; `geo/build.sh <edicao>` já é parametrizado.
6. **Núcleos metropolitanos.** Rode `pipeline/build_rm_nucleo.py --check`. Se a edição nova mudar
   a composição de alguma RM, o CSV é compartilhado — qualquer mudança afeta **todas** as edições,
   e isso é intencional; confira o diff antes de aceitar. Verifique também se **o núcleo do CSV
   existe na malha da edição**: se não existir, vale o fallback "mais populoso entre os presentes"
   da tabela de decisões, e o rótulo `nm_nucleo` das tabelas publicadas deve acompanhar o núcleo
   efetivo, não o do CSV.
7. **Publicar e passar no gate.** `pipeline/publish.py --edicao <e>`, depois
   `pipeline/disclosure_check.py --edicao <e> --versao <v>` (exige microdados) e
   `pipeline/verify_gate.py --dir data/processed/<e>` (não exige). O workflow
   `.github/workflows/publicar.yml` já varre as edições adicionais, mas confira que a pasta nova
   entra na varredura.
8. **Testes.** `pipeline/tests/test_edicao_2010.py` é o modelo de suíte específica de uma edição
   (identidades, vocabulário, ausências declaradas, gate); `pipeline/tests/test_edicao_1991.py` é o
   modelo de uma edição que publica **menos** módulos (ausência do pendular inteiro, colunas nulas
   do contrato). `pipeline/tests/test_f3_geo.py` e
   `pipeline/tests/test_f2b_pendular.py` são o modelo de **parametrização por edição** via
   `@pytest.mark.parametrize` sobre `EDICOES_TESTADAS`: prefira estender esses a duplicar arquivos.
   `pipeline/tests/test_rm_nucleo.py` cobre as âncoras de núcleo por edição.
9. **Front-end.** `npm run sync-data` já copia todas as edições e recusa se o gate de qualquer uma
   delas não estiver válido. Verifique que nenhum componente novo precisou de condicional por censo
   — se precisou, a informação provavelmente deveria estar em `edicoes.ts`.
10. **Páginas estáticas de SEO.** Hoje `pipeline/build_paginas.py` gera páginas apenas para a
    edição 2022 (não recebe `--edicao`). Se a edição nova também deve ter páginas estáticas, isso é
    trabalho adicional a planejar — ver `docs/SEO.md`.
