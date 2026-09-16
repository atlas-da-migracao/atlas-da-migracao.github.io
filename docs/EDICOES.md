# Convenções multi-edição e guia para incluir um novo censo

## Por que este documento existe

O atlas publica cinco edições — Censo 2022 (primeira), Censo 2010 (segunda), Censo 2000
(terceira), Censo 1991 (quarta) e Censo 1980 (quinta). Quase toda decisão de engenharia tomada até aqui tem uma
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
| Território que a fonte não distingue por município | Uma **unidade agregada**: o conjunto inteiro vira UMA unidade publicada, com código sintético não numérico (hoje `'NORTEGO'`, definido em `pipeline/unidades_agregadas_1980.py`), presente em `municipios_ref`, `municipios`, nos dois lados de `fluxos`, no módulo pendular e na malha (as feições dos municípios componentes **dissolvidas em uma**, `geo/fetch_1980.sh`). Recebe a UF de hoje (`'17'`, pelo precedente de Fernando de Noronha) e `cd_rgi`/`cd_rgint`/`cd_rm` **NULL** — cobre 11 RGIs de 2022 e não é de nenhuma. Mudança de município **dentro** da unidade não é migração (mesma leitura que o censo dá a uma mudança intramunicipal). O front declara "não é um município" num aviso próprio, com texto vindo de `meta.unidades_agregadas`. | (a) Excluir o território da edição; (b) publicar uma unidade por município componente; (c) publicar só a **origem** agregada, numa tabela à parte, deixando os residentes de fora; (d) somar a unidade à UF da época em `fluxos_uf` | (a) foi a versão `1.0.0-1980` e custava 739.049 pessoas, a imigração que chegava ao território e um buraco branco no mapa. (b) é impossível do lado da residência (a fonte não diz qual) e, do lado da origem, publicaria 64,0% da massa em vez de 87,5% — o limiar de revelação morde muito mais com 52 origens — criando 52 unidades sem população. (c) foi a versão `1.0.1-1980`: publicava o fluxo, mas a origem não tinha polígono nem painel; ficava invisível atrás de municípios reais, e por isso a tabela tinha de viver separada de `fluxos.parquet`. Dar **forma** à unidade dissolve essa objeção e torna a tabela separada redundante. (d) inflaria a emigração interestadual de Goiás em 27,4% com um degrau puramente territorial e faria Goiás aparecer em 1980 com limites que nenhuma outra edição usa. Ver `docs/METODOLOGIA.md`, item 4 de 1980, e `pipeline/sql/1980/MAPEAMENTO_norte_goias.md`. |
| Recortes territoriais (RGI, RGInt) | A divisão de 2017 do IBGE aplicada **retroativamente** por código de município, a partir de `pipeline/labels.py` (`RECORTES`, dicionário de 2022). | Usar a divisão vigente em cada censo (mesorregião/microrregião de 2010 etc.) | Sem um recorte comum, os níveis de agregação da interface (RGI, RGInt, UF) não seriam navegáveis entre edições. O anacronismo é explícito e documentado, e o custo é conhecido e crescente com a idade do censo: 510 RGIs e 133 RGInts povoadas em 2022, 2010, 2000 e 1991, nenhum município sem correspondência; **em 1980, 489 RGIs e 130 RGInts** — 21 RGIs e 3 RGInts ficam vazias (11 das RGIs e as 3 RGInts são o território do atual Tocantins, que a edição publica como uma unidade agregada e não distribui por RGI/RGInt; as outras 10 RGIs são de fronteira agrícola, com todos os municípios criados depois de 1980). Ver `docs/METODOLOGIA.md`, item 9 da seção de 1980. |
| Recorte metropolitano | Idem: as **81 RMs/RIDEs do dicionário de 2022** aplicadas retroativamente por código de município (`pipeline/build_ref.py::_build_outra_edicao`). | O recorte metropolitano do próprio censo — em 2010, a variável `V1004`, com 42 unidades (36 RMs, 3 RIDEs, 3 aglomerações urbanas do RS) | Alternativa avaliada e descartada: 38 das 42 unidades de 2010 têm par nominal em 2022, mas mesmo essas têm **composição municipal diferente**, então usá-las daria RMs que mudam de recorte quando o usuário troca de censo. Custo assumido: municípios criados depois do censo antigo simplesmente não existem nele (4 casos entre 2010 e 2022 — ver `docs/METODOLOGIA.md`, item 6). |
| `cd_rm` | Sempre o `COD_CATMETROPOL` de 2022, em todas as edições. | Código nativo de cada censo | Consequência direta do recorte retroativo: é o identificador que permite ao front trocar de edição mantendo a seleção do usuário. |
| Núcleo metropolitano | Município **membro** homônimo (o nome do município aparece como sequência inteira de palavras no nome da região); sem homônimo, o mais populoso. Um único `pipeline/rm_nucleo.csv`, gerado por `pipeline/build_rm_nucleo.py`, compartilhado por todas as edições. | Regra "sempre o mais populoso" (a original), ou um núcleo por edição | O homônimo é a definição que corresponde ao conceito de cidade-núcleo em casos como a Grande Vitória, onde o mais populoso (Serra) não é o centro funcional. A regra foi aplicada retroativamente também a 2022 para que uma RM não troque de núcleo ao trocar de censo — mudou o núcleo de 3 das 81 regiões. `--check` no script falha se o CSV sair de sincronia. |
| Vocabulários que mudam com o questionário | Declarados por edição: `pipeline/disclosure_rules.STATUS_POR_EDICAO` no pipeline e `recursos`/`vocabulario`/`rotuloRetorno`/`statusCategorias` em `web/src/lib/edicoes.ts`. Os componentes consultam a configuração da edição. | `if (censo === "2010")` espalhado pelos componentes e pelo SQL de publicação | Uma condicional por edição multiplica-se por edição × componente; com cinco censos, seria inviável. Declarar o vocabulário num lugar só faz a edição nova ser um registro novo na tabela, não uma varredura pelo código. Cobre: categorias de `status` migratório, frequência de retorno pendular, faixas de tempo de deslocamento e presença/ausência da dimensão "modo de transporte". |
| `NULL` vs `0`/`false` | "Esta edição não mede isso" é sempre `NULL`, gravado explicitamente (ex.: `CAST(NULL AS DOUBLE)` em `pipeline/sql/2010/08_metro.sql`), nunca `0`, `false` ou string vazia. | Deixar o agregador convergir para `NULL` sozinho, ou preencher com zero | Zero é um valor medido; ausência não é. Gravar explicitamente documenta a ausência no próprio SQL em vez de depender de efeito colateral, e o front decide se esconde o indicador (via `recursos`) em vez de exibir "0%". |
| Regras de revelação | R1–R9 idênticas em todas as edições, num único caminho de código (`pipeline/disclosure_rules.py` aplicado por `publish.py` e verificado por `disclosure_check.py --edicao <e>`). Só o vocabulário de `status` varia — e, **desde 1980, os limiares de R1/R2 quando a edição não tem chave de domicílio** (linha seguinte). | Limiares calibrados por edição (ex.: mais frouxos para microdados públicos como os de 2010) | Um único conjunto de regras é auditável e transferível; calibrar por edição criaria a obrigação de justificar cada limiar separadamente e abriria a porta para publicar em 2010 algo que não se publicaria em 2022. O relatório sai com sufixo de edição (`docs/relatorio_revelacao_<edicao>_<versao>.md`) para não colidir. |
| Edição sem chave de domicílio | Flag `chave_domicilio: bool` na dataclass `Edicao`. Quando `False` (hoje só 1980), `disclosure_rules.limiares()` devolve limiares em que o piso `ndom ≥ 3` de R1 **sai do predicado** e os pisos de pessoas sobem um degrau na escada do próprio projeto: R1 de `n ≥ 5` para `n ≥ 20`, R2 de `n ≥ 20` para `n ≥ 50`. `publish.py` e `disclosure_check.py` constroem todos os predicados a partir desse objeto, e o gate **verifica a flag contra os microdados** (`controle` nulo em 100% das linhas) antes de aceitá-la. | (a) Deixar `ndom ≥ 3` cair calado — `COUNT(DISTINCT controle)` é 0 e a condição fica vacuamente falsa, descartando **toda** linha de todas as tabelas; (b) simplesmente remover o piso e publicar com `n ≥ 5` | (a) é uma falha silenciosa: o pipeline "roda" e publica vazio. (b) faria de 1980 a edição mais permissiva do atlas — medindo em 1991, **80,3% dos pares com `n = 5` têm menos de 3 domicílios**, ou seja, o piso removido é justamente o que mais trabalha nos censos antigos. O substituto foi calibrado (não arbitrado) contra as quatro edições que têm a chave, por dois critérios: a fração de células que o piso de domicílios rejeitaria cai a 0,03% em 1991 e 0,00% em 2000 com `n ≥ 20`; e `n ≥ 50` fica acima da maior célula já observada que o piso rejeitaria em qualquer tabela de qualquer edição (`n = 36`). Detalhes e números em `docs/METODOLOGIA.md`, item 8.2 da seção de 1980. |
| Estimador de variância | O mesmo estimador de conglomerados em último estágio (domicílio como UPA, área de ponderação como estrato) reaproveitado sem alteração entre 2022, 2010 e 2000. | Reestimar o desenho amostral de cada censo | Os três censos têm o mesmo desenho relevante (amostra sistemática por domicílio, calibração GLS por área de ponderação) e o resultado foi validado edição a edição: a distribuição de CV dos fluxos de 2010 e a de 2000 são praticamente idênticas à de 2022. **Isto não se generalizou automaticamente para 1991 nem para 1980**, e as duas verificações deram resultados diferentes: 1991 publica `se`/`cv` com estrato substituto e precisão conservadora (aprovado com ressalva), e **1980 não publica precisão nenhuma** — sem chave de domicílio não há nem UPA nem estrato (`precisao = 'sem_estimativa'` em todas as tabelas). Cada edição nova refaz a verificação; ver avisos 4 e 5 abaixo. |
| Procedência dos microdados | A cópia distribuída pelo **IBGE**, em todas as edições — **exceto 1980**, alimentada por **fonte secundária**: `basedosdados.br_ibge_censo_demografico.microdados_pessoa_1980` (BigQuery), extraída por `scripts/extract_1980_bd.py` para `data/raw1980/pessoa_<uf>.parquet`. O uso da fonte secundária só foi aceito **com validação cruzada contra a cópia DBF do IBGE**: contagens por UF idênticas uma a uma (29.378.455 registros no DBF contra 29.378.753 na BD — a diferença de 298 é exatamente Fernando de Noronha, ausente das 26 partições do DBF), **zero** códigos de município na BD sem par no DBF, e Σ peso = 119.011.062 contra 119.002.706 recenseados (+0,007%, a mesma aderência das outras edições). | Usar a cópia pública do IBGE também em 1980 | Não é preferência, é necessidade: **as cópias públicas do IBGE em circulação (DBF e `.sav`) não trazem a V518**, a UF/município de residência anterior — sem ela, 1980 só permitiria contar imigrantes por destino, sem matriz origem→destino, e a edição ficaria fora do atlas. A Base dos Dados publica a tabela com a V518. O preço da fonte secundária é real e apareceu todo **depois** da extração (codificação própria no Ceará, 52 municípios de Goiás sem código, renda vazia em 26 das 27 partições) — por isso a regra: fonte secundária só com validação cruzada contra a primária no que as duas têm em comum, documentada antes de classificar. Ver `docs/qa/sonda_1980_bd.md` (a validação), `pipeline/sql/1980/MAPEAMENTO_02_classify.md` §0 e §3 e `docs/METODOLOGIA.md`, item 1 da seção de 1980. |
| Formato de origem legado | Quando os microdados não vêm em texto de largura fixa, a conversão é uma **etapa separada e anterior ao pipeline** (`scripts/prep_<edicao>.py`), que grava TXT de largura fixa em `data/interim/<edicao>/raw_txt/`; o SQL da edição continua lendo só texto. Modelo: `scripts/prep_1991.py` (27 DBF dBase III → TXT de 492 bytes). | Ler o formato legado direto do DuckDB, ou converter para Parquet | Isolar a conversão deixa o `01_extract.sql` da edição igual ao das outras e torna a etapa frágil (offsets, registros deletados, encoding) testável sozinha, UF a UF, contra a documentação pública do censo. Converter para Parquet pularia a checagem de largura fixa contra o layout do IBGE, que é justamente o que pega erro de posição. |
| Módulo inteiro ausente na edição | Flag booleana própria na dataclass `Edicao` (`pendular: bool`), **distinta** de `rotulos_pendular`: `pendular=False` remove o módulo pendular inteiro (tabelas, colunas do contrato e o submódulo pendular de RM), enquanto `rotulos_pendular` só apaga dimensões *dentro* de um módulo que existe. Primeiro uso: 1991. | Deduzir a ausência do módulo de `pula_scripts`, ou de `rotulos_pendular` todo nulo | `pula_scripts` é instrução de orquestração (qual SQL não roda) e não expressa o fato metodológico; e derivar "não tem módulo" de "todos os rótulos são nulos" confunde duas coisas diferentes — uma edição pode ter pendular sem ter as dimensões de tempo/modo/frequência, que é exatamente o caso de 2000. A flag declara o fato uma vez, e o pipeline e o front consultam a mesma declaração. |
| Núcleo metropolitano ausente na edição | Fallback aplicado **na edição**, não no CSV: quando o `cd_nucleo` de `pipeline/rm_nucleo.csv` não existe na malha do censo, o núcleo passa a ser o **município mais populoso entre os presentes naquela edição** — a mesma regra que `build_rm_nucleo.py` usa quando não há homônimo. Primeiro caso: RM do Sul do Estado (RR) em 1991, núcleo Rorainópolis → São João da Baliza. Em 1980 o fallback **não** foi necessário: das 81 regiões, 78 têm municípios na malha do censo e todas as 78 têm o núcleo do CSV presente (as 3 ausentes — Palmas, Gurupi e Sul do Estado — não aparecem de forma alguma na edição). | Mudar o CSV compartilhado, ou deixar a RM sem núcleo | O CSV é compartilhado por todas as edições de propósito (uma RM não troca de núcleo quando o usuário troca de censo); alterá-lo por causa de uma edição antiga mudaria o núcleo também em 2022. Sem núcleo, todos os pares intra-RM cairiam em `periferia_periferia`, que é um dado errado e silencioso. O fallback fica restrito às RMs afetadas e é declarado em `docs/METODOLOGIA.md`. |

## Avisos de comparabilidade: o que cada edição antiga encontrou (2000, 1991, 1980)

Cada item abaixo é um ponto onde a convenção da tabela acima **não** vale automaticamente, e que
precisa de decisão nova e registrada — não de cópia. Os itens 3, 4 e 5 foram revistos depois de
implementar a edição 2000; **todos os seis foram revistos depois de implementar a edição 1991** — e
em dois casos (avisos 2 e 6) o que estava escrito por antecipação estava **errado** —; e **todos os
seis foram fechados depois de implementar a edição 1980** (F9.7), que era a edição para a qual eles
tinham sido escritos. Onde ainda falavam de 1980 no futuro, agora falam do que se verificou de fato,
com o ponteiro para onde a decisão está registrada. A edição 1980 ainda **abriu um sétimo aviso**,
sobre depender de uma fonte que não é a do IBGE.

Os avisos **continuam valendo** como método: uma edição ainda mais antiga (1970) deve lê-los como o
histórico do que quebra e de quanto custa cada quebra, não como a resposta pronta — em 1980, três
dos seis (1, 2 e 6) se resolveram de um jeito que nenhuma edição anterior tinha antecipado.

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
   contra 66 em 2000 e 8 em 2010 pela mesma medida, no sentido 2022→edição antiga; no sentido
   inverso, os 4.491 municípios de 1991 têm todos par em 2022. (Os "seis" e os "quatro" do
   parágrafo anterior são outra medida — municípios que o recorte **metropolitano** perde — e não
   devem ser comparados com estes; a tabela com as cinco edições lado a lado, na mesma medida, está
   em `docs/METODOLOGIA.md`, item 9 da seção de 1980.) **A decisão do usuário foi manter a
   convenção "por código, sem AMC"**, documentando o anacronismo em vez de construir a tabela de
   áreas mínimas comparáveis:
   uma AMC mudaria a unidade de análise de todas as edições ao mesmo tempo, e o custo medido está
   concentrado num único nível. RGI e RGInt **não** são afetadas (as 510 e as 133 continuam todas
   povoadas em 1991, nenhum município sem recorte); o recorte metropolitano é — 66 das 81 regiões
   com menos municípios que em 2022, três delas com um único município. Ver `docs/METODOLOGIA.md`,
   itens 10 e 11 da seção de 1991. *(Fechado na edição 1980.)* **A convenção "por código, sem AMC"
   foi mantida em 1980 também**, e a alternativa AMC voltou à mesa e foi de novo descartada pelo
   mesmo motivo (mudaria a unidade de análise das cinco edições ao mesmo tempo). O anacronismo
   cresce como previsto — **1.634 códigos de `labels.RECORTES` sem par na malha do censo** (contra
   1.082 em 1991), e no sentido inverso os 3.939 municípios de 1980 têm todos par em 2022 —, mas a
   novidade de 1980 não é o número: é que, pela primeira vez, **RGI e RGInt também ficam vazias**
   (489 das 510 RGIs e 130 das 133 RGInts povoadas; 78 das 81 RMs presentes, 71 com menos
   municípios que em 2022 e 4 com um único município). Ver `docs/METODOLOGIA.md`, item 9 da seção
   de 1980. Particularidade que só 1980 tem e que responde por parte dessas ausências: **a edição
   não tem o território do atual Tocantins como unidade** — os 52 municípios do norte de Goiás
   chegam sem código de município na fonte, e com eles somem 11 RGIs, as 3 RGInts e 2 das 3 RMs
   ausentes. Não é anacronismo de recorte, é lacuna de cobertura, e está registrada no aviso 7 e em
   `pipeline/sql/1980/MAPEAMENTO_02_classify.md` §3. **A lacuna é só do lado da residência**: quem
   saiu de lá tem origem e destino conhecidos, e esses fluxos são publicados numa tabela própria,
   sob uma origem agregada — ver a lição 8 abaixo.
2. **A variável de data fixa muda de definição.** *(Corrigido depois de implementar a edição 1991
   — a redação anterior, "o Censo 1991 pergunta apenas a UF ou o país de residência 5 anos antes,
   sem o município, o que inviabiliza a matriz origem→destino municipal", estava **factualmente
   errada** e tinha sido escrita por antecipação.)* O par (residência há 5 anos, residência atual)
   não é o mesmo quesito em todos os censos, mas **2000 e 1991 têm os dois o município de origem**.
   O Censo 2000 tem o município de residência em 31/07/1995, com um universo **mais largo** que o de
   2010/2022 (sem o filtro de "menos de 6 anos no município"). O Censo 1991 tem o par
   `MIMO86UF` + `MIMO86MU` — "onde morava em 01/09/1986", UF/país e município dentro daquela UF —,
   de modo que a matriz origem→destino **municipal** de 1991 é publicável e a edição **não** fica
   restrita a UF/RGInt. *(Fechado na edição 1980, e é o aviso que mais mudou de natureza.)* **O
   Censo 1980 não tem quesito de data fixa nenhum** — não é uma definição diferente, é a ausência
   do quesito. O que ele tem é o par `v517` ("há quantos anos mora neste município") × `v518`
   ("município de residência anterior", a *última etapa*, perguntada a quem mora no município há
   menos de dez anos). A edição publica um **proxy** declarado, com a janela 01/09/1975 →
   01/09/1980 escolhida para alinhar 1980 aos quinquênios das outras quatro edições, calibrado
   contra a data fixa verdadeira de 1991 (captação de 100%, origem municipal certa em 89% dos
   casos, volume inflado em ~7%) e carimbado na interface pelo selo `proxy_data_fixa`. Note a
   inversão: a armadilha (b) abaixo — "tempo de residência **não** identifica o migrante de data
   fixa" — continua verdadeira, e é justamente por isso que em 1980 o tempo de residência entra
   **combinado** com a última etapa e o resultado se chama proxy, não migração de data fixa. Ver
   `docs/METODOLOGIA.md`, item 2 da seção de 1980, e `pipeline/sql/1980/MAPEAMENTO_02_classify.md`
   §2. Duas armadilhas já conhecidas em três edições: (a) o código de origem pode ser referido à UF
   **de origem**, não à de residência (em 1991, `MIMO86MU` é o município dentro de `MIMO86UF`; em
   1980, `v518` já traz `UF‖MUNIC` completo, mas numa das 27 partições — o Ceará — com **seis**
   dígitos em vez de sete, o que sem tratamento descartaria 100% das origens do estado), e
   (b) variáveis de "tempo de residência no município" e de "última mudança" **não** identificam o
   migrante de data fixa (`V0416` em 2000, `V0624` em 2010, `MIANMOMU`/`MIULTMUD` em 1991).
   A distinção entre município de nascimento e residência anterior, que 2022 tem e 2010 já não tem,
   também precisa ser reconferida censo a censo antes de mapear as categorias de `status`:
   conferida em 2000 (o quesito 4.21 pergunta só a UF ou o país), em 1991 (`MINASCMU` diz apenas
   se a pessoa nasceu no município, e `MIUFPAIS` dá só a UF ou o país) e em 1980 (`v513` diz apenas
   se nasceu neste município, e `v512` dá só a UF ou o país), e por isso as três usam o
   **vocabulário reduzido** de 2010 — ver `docs/METODOLOGIA.md`, item 3 das seções de 2000 e de
   1991, e `pipeline/sql/1980/MAPEAMENTO_02_classify.md` §5 para 1980.
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
   empresa, casa do cliente…) — não serve nem como proxy. *(Fechado na edição 1980: o módulo
   existe.)* **1980 tem o quesito** (`v527`, "município em que trabalha ou estuda"), com a mesma
   estrutura de 2000 — um único campo, preenchido em 3,26% dos registros e nunca apontando para o
   município de residência —, então a edição publica destino de trabalho, destino de estudo e o
   módulo metropolitano inteiro. **Vale a regra de 2000, sem alteração: o trabalho precede, e por
   isso o fluxo de estudo de 1980 é um piso, não uma estimativa do total** — a cláusula condicional
   deste aviso está fechada, não há um segundo quesito de estudo em 1980. O detalhe é que cai mais
   uma vez: o módulo publica **quatro** dimensões (setor, grupo ocupacional, escolaridade e
   idade/sexo) contra seis em 2000, porque 1980 não tem renda (aviso 6) e **não pergunta carteira
   assinada**, o que impede reproduzir o vocabulário de posição na ocupação do atlas. Ver
   `docs/METODOLOGIA.md`, item 6 da seção de 1980, e
   `pipeline/sql/1980/MAPEAMENTO_02_classify.md` §6.
4. **Peso amostral e desenho da amostra mudam de metodologia.** A calibração, a fração amostral e
   a definição de estrato variam entre censos. O reaproveitamento do estimador de variância entre
   2022 e 2010 foi **verificado**, não presumido; a mesma verificação foi refeita e **passou para o
   Censo 2000** (mesmo desenho — amostra sistemática de domicílios, calibração GLS por área de
   ponderação —, e distribuição do CV dos fluxos praticamente idêntica à das outras duas edições).
   **Em 1991 a verificação foi feita e o estimador foi aprovado, mas com ressalva** (ver aviso 5):
   como não há área de ponderação, o estrato é um substituto, e a comparação bruta de mediana/média
   do CV **não serve de critério** — a mediana do CV dos fluxos antes da supressão é 100% nas
   quatro edições que publicam CV, porque a massa de pares tem uma observação só. O teste que
   discrimina é estratificar por `n`: com `n ≥ 5`, `n ≥ 30` e `n ≥ 100`, 1991 fica 5% a 20% mais
   impreciso que
   2000, dentro da tendência que as edições já mostravam entre si. *(Fechado na edição 1980, sem
   teste possível.)* **Em 1980 a verificação nem chegou ao teste estratificado**: a fonte não traz
   chave de domicílio, e sem ela não há unidade primária de amostragem — o estimador de
   conglomerados últimos trataria cada pessoa como observação independente e **subestimaria** a
   variância, que é o erro anticonservador. A edição publica `se` e `cv` **nulos** e
   `precisao = 'sem_estimativa'` em todas as tabelas. A possibilidade que este aviso deixava em
   aberto — "a edição pode publicar estimativas sem precisão declarada" — é, portanto, o que
   aconteceu de fato. Para a edição seguinte a regra continua a mesma: primeiro confira se existe
   chave de domicílio, depois estrato; e, havendo os dois, use o teste estratificado por `n`, nunca
   a mediana bruta. Ver `docs/METODOLOGIA.md`, item 8.1 da seção de 1980.
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
   entre edições. Ver `docs/METODOLOGIA.md`, item 9 e as validações da seção de 1991. *(Fechado na
   edição 1980.)* **O Censo 1980 também não tem área de ponderação — e a decisão foi publicar sem
   erro amostral**, sem sequer tentar o estrato substituto de 1991, por um motivo mais radical que
   a falta da área: a fonte não traz **chave de domicílio**, então não há nem UPA nem estrato, e o
   que falta não é o estrato do estimador, é a unidade de conglomerado. Das duas saídas que este
   aviso listava, valeu a segunda: `se`/`cv` nulos e `precisao = 'sem_estimativa'` em todas as
   tabelas (`docs/METODOLOGIA.md`, item 8.1 da seção de 1980). Lição para uma edição futura ainda
   mais antiga: a chave de domicílio não sustenta só a variância, sustenta também **o piso de R1**
   (`≥ 3 domicílios`), e as
   duas coisas caem juntas. Se ela faltar, decida os dois pontos de uma vez — `chave_domicilio =
   False` em `pipeline/edicoes.py` já encadeia o segundo, mas o *valor* dos limiares substitutos
   precisa ser recalibrado contra as edições que têm a chave, não copiado de 1980: os limiares de
   1980 valem para os fluxos e os tamanhos de domicílio de 1980.
6. **Salário mínimo e renda.** A edição 2010 pôde reaproveitar os cortes relativos porque o IBGE já
   divulga a renda **em número de salários mínimos**; 2000 também (`V4514`, com o SM de julho de
   2000, R$ 151,00). **1991 é a primeira edição em que isso não existe**: o rendimento vem em
   Cruzeiros correntes e precisa ser dividido por um salário mínimo de referência. A decisão
   tomada — e o método que 1980 repetiu — foi **não** escolher o valor por memória histórica nem
   deflacionar, e sim **recuperá-lo por reconciliação com as faixas de salário mínimo que o próprio
   IBGE calculou** ao lado dos valores brutos: Cr$ 36.161,60 reproduz 13 de 13 faixas de rendimento
   individual e 11 de 11 de rendimento domiciliar, enquanto os dois candidatos do plano
   (Cr$ 17.000,00 e Cr$ 42.000,00) reproduzem uma de treze cada. Nenhum deflator é usado: os cortes
   do atlas são relativos ao SM de cada censo. Ressalva **importante, registrada em F7.7**: o valor
   é o de referência **implícito nas faixas do IBGE**, e **não** o salário mínimo legal da data do
   censo — a conferência externa (série `MTE12_SALMIN12` do Ipeadata) dá Cr$ 17.000,00 de março a
   agosto de 1991 e Cr$ 42.000,00 a partir de 1º/09/1991. *(Fechado na edição 1980, com um
   desfecho em duas partes.)* **Primeira parte: o método funcionou e o valor está confirmado.** A
   mesma reconciliação, feita com as treze faixas em salários mínimos que o IBGE calculou ao lado
   dos valores em cruzeiros, dá **Cr$ 4.149,60** em 1980 — 13 de 13 faixas reproduzidas, duas delas
   cravando o valor ao cruzeiro, contra 2 de 13 dos candidatos alternativos (mínimos regionais
   menores, o valor de novembro de 1979 e o de novembro de 1980). Não é mais hipótese: é o valor de
   referência da edição, registrado em `pipeline/edicoes.py` e em `meta.json`. E a ressalva de 1991
   **não** se repetiu — em 1980 o valor reconciliado coincide com o mínimo legal da região I de
   maio de 1980, o que é uma confirmação externa a mais; ou seja, "implícito nas faixas" e "legal
   do mês" podem coincidir ou não, e só a reconciliação diz qual dos dois casos é o seu.
   **Segunda parte: a edição não publica renda nenhuma.** Os rendimentos chegam preenchidos na
   partição do Ceará e em 0,0% das outras 26 UFs, de modo que todas as colunas de renda de 1980 são
   nulas e o filtro de renda some da interface — o salário mínimo foi reconciliado mesmo assim,
   para documentar a unidade monetária e permitir uma reextração futura. Duas lições para a próxima
   edição: reconcilie o SM **antes** de saber se vai publicar renda (é barato e fecha uma incógnita
   histórica), e **meça a cobertura da variável partição a partição** antes de projetar o módulo —
   a renda de 1980 não faltou, chegou 26/27 vazia. Ver `docs/METODOLOGIA.md`, item 7 da seção de
   1980, e `pipeline/sql/1980/MAPEAMENTO_02_classify.md` §7. Atenção a uma armadilha que só
   apareceu em 2000 e pode reaparecer: a **renda domiciliar per capita** pode não vir pronta, e
   construí-la dividindo o rendimento domiciliar pelo total de moradores dá errado quando o
   numerador do IBGE já exclui pensionistas e empregados domésticos residentes e o denominador não
   — ver `docs/METODOLOGIA.md`, item 2 da seção de 2000.
7. **A fonte pode não ser a do IBGE — e uma fonte secundária pode perder território calada.**
   *(Aviso novo, aberto pela edição 1980; não existia quando as outras quatro foram feitas.)* As
   edições de 2022 a 1991 leem a cópia distribuída pelo IBGE. A de 1980 não pôde: as cópias
   públicas em circulação (DBF e `.sav`) **não trazem a V518**, o município de residência anterior,
   sem o qual não há matriz origem→destino. A edição é alimentada pela **Base dos Dados**
   (BigQuery), que publica a tabela com a variável — ver a linha "Procedência dos microdados" na
   tabela de decisões. Três regras que saíram disso, e que valem para qualquer edição futura que
   dependa de terceiros: (a) **valide a fonte secundária contra a primária** no que as duas têm em
   comum, antes de classificar qualquer coisa (contagens por UF, Σ peso, conjuntos de código de
   município); (b) **espere o preço aparecer depois da extração**, não antes — em 1980 foram três
   surpresas, todas invisíveis no dicionário e visíveis só nos dados (o Ceará com codificação de
   seis dígitos, 52 municípios de Goiás sem geocódigo, a renda preenchida em uma única partição);
   e (c) quando o crosswalk de terceiros perder uma área, **declare a lacuna em vez de
   aproximá-la — e depois pergunte se ela é mesmo uma lacuna**. Foi o que se fez, em três etapas,
   com os 52 municípios do norte de Goiás (ver o aviso 8). Ver `docs/METODOLOGIA.md`, itens 1 e 4
   da seção de 1980, `pipeline/sql/1980/MAPEAMENTO_02_classify.md` §0 e §3, e
   `docs/qa/sonda_1980_bd.md`.
8. **"Não dá para publicar a unidade" e "não dá para publicar o fluxo" são coisas diferentes — e a
   segunda pergunta certa é "o que exatamente a fonte não diz?".** A edição 1980 respondeu isso
   três vezes, e as três respostas são o aviso:
   - **Separe os dois lados da lacuna.** Uma lacuna geográfica tem lado de residência e lado de
     origem, e a disponibilidade pode ser **assimétrica**. Em 1980, dos 52 municípios do norte de
     Goiás não se sabe *quem morava em qual* (`id_municipio` nulo), mas se sabe perfeitamente
     *quem saiu de qual* (`v518` preenchido, destino publicado). A exclusão original (`1.0.0`)
     tratou os dois lados como um só e jogou fora 15.350 pares origem→destino que não estavam
     perdidos.
   - **Delimite a pergunta que a fonte não responde, e não uma maior.** O que faltava não era
     "dados do norte de Goiás": era *em qual dos 52 municípios*. Tudo o mais dos 178.338 registros
     estava lá — peso, idade, escolaridade, migração, pendular. Uma pergunta que a fonte não
     responde sobre a composição interna de um território **não impede publicar o território**;
     impede publicar suas partes. Foi essa distinção que transformou uma exclusão de 739.049
     pessoas numa unidade agregada com todos os indicadores da edição.
   - **Agregar é melhor que detalhar quando o limiar morde.** Uma origem coletiva publicou 87,5%
     da massa emigratória contra 64,0% de 52 origens separadas.
   - **Uma unidade sem forma no mapa é meia solução.** A versão `1.0.1-1980` publicou o fluxo numa
     tabela à parte (`fluxos_origem_agregada.parquet`) justamente porque a origem não tinha
     polígono: integrá-la a `fluxos.parquet` daria a um município o maior fluxo de entrada
     invisível. A regra que fica: **se você for manter um dado fora da matriz principal por falta
     de geometria, verifique primeiro se a geometria é obtenível** — aqui era, por `-dissolve` das
     feições componentes na própria malha do censo, e o dissolve custou quinze linhas de shell.
   - **Não devolva o território à UF da época** só porque ela existe: em 1980 seria +27,4% na
     emigração interestadual de Goiás, puro degrau territorial. Use a UF de hoje, pelo mesmo
     precedente de Fernando de Noronha, e declare a exceção.
   - **Ao agregar, diga o que a agregação apaga.** Aqui: mudança entre os municípios componentes
     deixa de ser migração (11.586 registros), e a naturalidade do território é irrecuperável
     (o censo registrava "Goiás"). Ver `pipeline/sql/1980/MAPEAMENTO_norte_goias.md` e
     `docs/METODOLOGIA.md`, item 4 da seção de 1980.

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
   digitação nos códigos (em 1991, a tabela de UF de nascimento traz "SE" duas vezes) — e se o
   módulo de rótulos **gerado** para a edição não está apenas errado: em 1980, `CATEGORIAS_1980` e
   `UF_SEQ_1980` de `pipeline/labels_1980.py` saíram do gerador com categorias inventadas e um
   deslocamento de oito UFs, e foram corrigidos antes de qualquer SQL
   (`pipeline/sql/1980/MAPEAMENTO_02_classify.md` §0.6 e §0.7). Se a fonte não for a cópia do IBGE,
   a etapa anterior é uma **extração**, não uma conversão — `scripts/extract_1980_bd.py` é o modelo
   (uma consulta por UF, com dry run e teto de bytes, saída em Parquet por UF em
   `data/raw<edicao>/`) — e vale o aviso 7.
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
   três; em 1980, quatro — e três RMs, 21 RGIs e 3 RGInts não aparecem de forma alguma, ver
   `docs/METODOLOGIA.md`, item 9 da seção de 1980). Malha: `geo/fetch_2010.sh` é o modelo de
   como obter e normalizar shapefiles antigos do geoftp; `geo/build.sh <edicao>` já é parametrizado.
   **Toda malha publicada passa por `pipeline/validate_geo.py --edicao <edicao>`** antes do gate —
   ST_IsValid (GEOS) e a mesma triangulação earcut que o deck.gl usa em produção, nos 4 produtos
   (municípios/UF/RGI/RGInt); `geo/build.sh` já roda essa checagem no fim de cada invocação, com
   reparo dirigido automático (ver docstring da função `limpa_e_publica`) quando sobra alguma
   feição inválida ou mal triangulada depois do `-clean` padrão. Não pule essa checagem numa
   edição nova mesmo que a malha "pareça" boa no mapa — o defeito (anel com autointerseção) é
   invisível a olho nu na maioria dos zooms e só aparece em municípios/recortes específicos.
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
   do contrato); `pipeline/tests/test_edicao_1980.py` é o modelo de uma edição que publica sob
   **regras diferentes** (limiares R1/R2 elevados, `se`/`cv` nulos, cobertura territorial
   incompleta), e `pipeline/tests/test_disclosure_limiares.py` cobre a escolha dos limiares em si,
   separada da edição. `pipeline/tests/test_f3_geo.py` e
   `pipeline/tests/test_f2b_pendular.py` são o modelo de **parametrização por edição** via
   `@pytest.mark.parametrize` sobre `EDICOES_TESTADAS`: prefira estender esses a duplicar arquivos.
   `pipeline/tests/test_rm_nucleo.py` cobre as âncoras de núcleo por edição.
9. **Front-end.** `npm run sync-data` já copia todas as edições e recusa se o gate de qualquer uma
   delas não estiver válido. Verifique que nenhum componente novo precisou de condicional por censo
   — se precisou, a informação provavelmente deveria estar em `edicoes.ts`.
10. **Páginas estáticas de SEO.** Hoje `pipeline/build_paginas.py` gera páginas apenas para a
    edição 2022 (não recebe `--edicao`). Se a edição nova também deve ter páginas estáticas, isso é
    trabalho adicional a planejar — ver `docs/SEO.md`.
