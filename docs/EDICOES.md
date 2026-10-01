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
| Território que a fonte não distingue por município | **Primeiro, confirmar que a lacuna é dos microdados, e não da distribuição usada**: listar as outras distribuições dos mesmos microdados e conferir o **arquivo** de cada uma, não só o dicionário (aviso 8, quarta resposta). Em 1980 a lacuna era da Base dos Dados, e o censobr/IPEA a fechou: desde `1.1.0-1980` os 52 municípios do norte de Goiás são municípios comuns, recodificados para o código de 2022 (`pipeline/norte_goias_1980.py`) e publicados sob a UF de hoje (`'17'`, pelo precedente de Fernando de Noronha). **Se a lacuna for real**, o desenho é uma **unidade agregada**: o conjunto vira UMA unidade publicada, com código sintético não numérico, presente em `municipios_ref`, `municipios`, nos dois lados de `fluxos`, no módulo pendular e na malha (feições componentes dissolvidas), com a UF de hoje e `cd_rgi`/`cd_rgint`/`cd_rm` NULL, e um aviso "não é um município" com texto vindo de `meta.unidades_agregadas` — foi o desenho de 1980 de `1.0.2` a `1.0.7` (`'NORTEGO'`), e o mecanismo do front continua disponível, inativo. | (a) Excluir o território da edição; (b) publicar uma unidade por município componente sem ter a residência; (c) publicar só a **origem** agregada, numa tabela à parte, deixando os residentes de fora; (d) somar o território à UF da época | (a) foi a versão `1.0.0-1980` e custava 739.049 pessoas, a imigração que chegava ao território e um buraco branco no mapa. (b) é impossível do lado da residência quando a fonte não diz qual é o município. (c) foi a versão `1.0.1-1980`: publicava o fluxo, mas a origem não tinha polígono nem painel e ficava invisível atrás de municípios reais. (d) inflaria a emigração interestadual de Goiás em 27,4% com um degrau puramente territorial e faria Goiás aparecer em 1980 com limites que nenhuma outra edição usa. A unidade agregada resolvia bem uma lacuna real — e em 1980 a lacuna não era real: era um `merge` do código de 1980 contra o diretório atual de municípios no código de construção da Base dos Dados. Ver `docs/METODOLOGIA.md`, item 4 de 1980, e `pipeline/sql/1980/MAPEAMENTO_norte_goias.md`. |
| Recortes territoriais (RGI, RGInt) | A divisão de 2017 do IBGE aplicada **retroativamente** por código de município, a partir de `pipeline/labels.py` (`RECORTES`, dicionário de 2022). | Usar a divisão vigente em cada censo (mesorregião/microrregião de 2010 etc.) | Sem um recorte comum, os níveis de agregação da interface (RGI, RGInt, UF) não seriam navegáveis entre edições. O anacronismo é explícito e documentado, e o custo é conhecido e crescente com a idade do censo: 510 RGIs e 133 RGInts povoadas em 2022, 2010, 2000 e 1991, nenhum município sem correspondência; **em 1980, 500 RGIs e as 133 RGInts** — 10 RGIs ficam vazias, todas de fronteira agrícola, com todos os municípios criados depois de 1980. (Até `1.0.7-1980` eram 21 RGIs e 3 RGInts vazias: somavam-se as 11 RGIs e as 3 RGInts do atual Tocantins, então publicado como uma unidade agregada, sem recorte.) Ver `docs/METODOLOGIA.md`, item 9 da seção de 1980. |
| Recorte metropolitano | Idem: as **81 RMs/RIDEs do dicionário de 2022** aplicadas retroativamente por código de município (`pipeline/build_ref.py::_build_outra_edicao`). | O recorte metropolitano do próprio censo — em 2010, a variável `V1004`, com 42 unidades (36 RMs, 3 RIDEs, 3 aglomerações urbanas do RS) | Alternativa avaliada e descartada: 38 das 42 unidades de 2010 têm par nominal em 2022, mas mesmo essas têm **composição municipal diferente**, então usá-las daria RMs que mudam de recorte quando o usuário troca de censo. Custo assumido: municípios criados depois do censo antigo simplesmente não existem nele (4 casos entre 2010 e 2022 — ver `docs/METODOLOGIA.md`, item 6). |
| `cd_rm` | Sempre o `COD_CATMETROPOL` de 2022, em todas as edições. | Código nativo de cada censo | Consequência direta do recorte retroativo: é o identificador que permite ao front trocar de edição mantendo a seleção do usuário. |
| Núcleo metropolitano | Município **membro** homônimo (o nome do município aparece como sequência inteira de palavras no nome da região); sem homônimo, o mais populoso. Um único `pipeline/rm_nucleo.csv`, gerado por `pipeline/build_rm_nucleo.py`, compartilhado por todas as edições. | Regra "sempre o mais populoso" (a original), ou um núcleo por edição | O homônimo é a definição que corresponde ao conceito de cidade-núcleo em casos como a Grande Vitória, onde o mais populoso (Serra) não é o centro funcional. A regra foi aplicada retroativamente também a 2022 para que uma RM não troque de núcleo ao trocar de censo — mudou o núcleo de 3 das 81 regiões. `--check` no script falha se o CSV sair de sincronia. |
| Vocabulários que mudam com o questionário | Declarados por edição: `pipeline/disclosure_rules.STATUS_POR_EDICAO` no pipeline e `recursos`/`vocabulario`/`rotuloRetorno`/`statusCategorias` em `web/src/lib/edicoes.ts`. Os componentes consultam a configuração da edição. | `if (censo === "2010")` espalhado pelos componentes e pelo SQL de publicação | Uma condicional por edição multiplica-se por edição × componente; com cinco censos, seria inviável. Declarar o vocabulário num lugar só faz a edição nova ser um registro novo na tabela, não uma varredura pelo código. Cobre: categorias de `status` migratório, frequência de retorno pendular, faixas de tempo de deslocamento e presença/ausência da dimensão "modo de transporte". |
| `NULL` vs `0`/`false` | "Esta edição não mede isso" é sempre `NULL`, gravado explicitamente (ex.: `CAST(NULL AS DOUBLE)` em `pipeline/sql/2010/08_metro.sql`), nunca `0`, `false` ou string vazia. | Deixar o agregador convergir para `NULL` sozinho, ou preencher com zero | Zero é um valor medido; ausência não é. Gravar explicitamente documenta a ausência no próprio SQL em vez de depender de efeito colateral, e o front decide se esconde o indicador (via `recursos`) em vez de exibir "0%". |
| Regras de revelação | R1–R9 idênticas em todas as edições, num único caminho de código (`pipeline/disclosure_rules.py` aplicado por `publish.py` e verificado por `disclosure_check.py --edicao <e>`). Só o vocabulário de `status` varia — e, **desde 1980, os limiares de R1/R2 quando a edição não tem chave de domicílio** (linha seguinte). | Limiares calibrados por edição (ex.: mais frouxos para microdados públicos como os de 2010) | Um único conjunto de regras é auditável e transferível; calibrar por edição criaria a obrigação de justificar cada limiar separadamente e abriria a porta para publicar em 2010 algo que não se publicaria em 2022. O relatório sai com sufixo de edição (`docs/relatorio_revelacao_<edicao>_<versao>.md`) para não colidir. |
| Edição sem chave de domicílio | Flag `chave_domicilio: bool` na dataclass `Edicao`. Quando `False` (hoje só 1980), `disclosure_rules.limiares()` devolve limiares em que o piso `ndom ≥ 3` de R1 **sai do predicado** e os pisos de pessoas sobem um degrau na escada do próprio projeto: R1 de `n ≥ 5` para `n ≥ 20`, R2 de `n ≥ 20` para `n ≥ 50`. `publish.py` e `disclosure_check.py` constroem todos os predicados a partir desse objeto, e o gate **verifica a flag contra os microdados** (`controle` nulo em 100% das linhas) antes de aceitá-la. | (a) Deixar `ndom ≥ 3` cair calado — `COUNT(DISTINCT controle)` é 0 e a condição fica vacuamente falsa, descartando **toda** linha de todas as tabelas; (b) simplesmente remover o piso e publicar com `n ≥ 5` | (a) é uma falha silenciosa: o pipeline "roda" e publica vazio. (b) faria de 1980 a edição mais permissiva do atlas — medindo em 1991, **80,3% dos pares com `n = 5` têm menos de 3 domicílios**, ou seja, o piso removido é justamente o que mais trabalha nos censos antigos. O substituto foi calibrado (não arbitrado) contra as quatro edições que têm a chave, por dois critérios: a fração de células que o piso de domicílios rejeitaria cai a 0,03% em 1991 e 0,00% em 2000 com `n ≥ 20`; e `n ≥ 50` fica acima da maior célula já observada que o piso rejeitaria em qualquer tabela de qualquer edição (`n = 36`). Detalhes e números em `docs/METODOLOGIA.md`, item 8.2 da seção de 1980. |
| Estimador de variância | O mesmo estimador de conglomerados em último estágio (domicílio como UPA, área de ponderação como estrato) reaproveitado sem alteração entre 2022, 2010 e 2000. | Reestimar o desenho amostral de cada censo | Os três censos têm o mesmo desenho relevante (amostra sistemática por domicílio, calibração GLS por área de ponderação) e o resultado foi validado edição a edição: a distribuição de CV dos fluxos de 2010 e a de 2000 são praticamente idênticas à de 2022. **Isto não se generalizou automaticamente para 1991 nem para 1980**, e as duas verificações deram resultados diferentes: 1991 publica `se`/`cv` com estrato substituto e precisão conservadora (aprovado com ressalva), e **1980 não publica precisão nenhuma** — sem chave de domicílio não há nem UPA nem estrato (`precisao = 'sem_estimativa'` em todas as tabelas). Cada edição nova refaz a verificação; ver avisos 4 e 5 abaixo. |
| Procedência dos microdados | A cópia distribuída pelo **IBGE**, em todas as edições — **exceto 1980**, alimentada por **fonte secundária**. Desde `1.1.0-1980`, o Parquet do **censobr/IPEA v1.0.0** (`1980_population_v1.0.0.parquet`), convertido por `scripts/prep_1980_censobr.py` para `data/raw1980/pessoa_<uf>.parquet` no mesmo esquema de 39 colunas da fonte anterior e aceito só depois de **gates de identidade** contra ela nas 27 UFs (idêntico célula a célula nas colunas que a edição usa, com três registros de exceção dentro da tolerância; `docs/qa/censobr_1980.md`). Até `1.0.7-1980`, `basedosdados.br_ibge_censo_demografico.microdados_pessoa_1980` (BigQuery), extraída por `scripts/extract_1980_bd.py` e validada contra a cópia DBF do IBGE: contagens por UF idênticas uma a uma (29.378.455 registros no DBF contra 29.378.753 na BD — a diferença de 298 é exatamente Fernando de Noronha, ausente das 26 partições do DBF), zero códigos de município na BD sem par no DBF. Σ peso atual = 119.011.052 contra 119.002.706 recenseados (+0,007%, a mesma aderência das outras edições). | Usar a cópia pública do IBGE também em 1980 | Não é preferência, é necessidade: **as cópias públicas do IBGE em circulação (DBF e `.sav`) não trazem a V518**, a UF/município de residência anterior — sem ela, 1980 só permitiria contar imigrantes por destino, sem matriz origem→destino. A Base dos Dados e o censobr publicam a variável. O preço da Base dos Dados foi real e apareceu todo **depois** da extração (codificação própria no Ceará, 52 municípios de Goiás e Fernando de Noronha sem código, renda vazia em 26 das 27 partições), e era todo da construção da tabela, não dos microdados; o censobr não tem nenhum dos três. Como as duas fontes secundárias derivam dos mesmos arquivos intermediários (Data Zoom), a identidade entre elas não substitui a âncora na fonte primária: por isso a regra continua sendo validação cruzada contra a cópia do IBGE no que as duas têm em comum, documentada antes de classificar. Ver `pipeline/sql/1980/MAPEAMENTO_fonte_censobr.md`, `docs/qa/sonda_1980_bd.md`, `pipeline/sql/1980/MAPEAMENTO_02_classify.md` §0 e §3 e `docs/METODOLOGIA.md`, item 1 da seção de 1980. |
| Formato de origem legado | Quando os microdados não vêm em texto de largura fixa, a conversão é uma **etapa separada e anterior ao pipeline** (`scripts/prep_<edicao>.py`), que grava TXT de largura fixa em `data/interim/<edicao>/raw_txt/`; o SQL da edição continua lendo só texto. Modelo: `scripts/prep_1991.py` (27 DBF dBase III → TXT de 492 bytes). Em 1980 a etapa anterior é `scripts/prep_1980_censobr.py` (um Parquet nacional → um Parquet por UF no esquema que `pipeline/sql/1980/01_extract.sql` lê), que além de converter roda os gates de identidade contra a fonte anterior e só grava se todos passarem — o mesmo princípio, com a verificação contra a fonte no lugar da verificação contra o layout. | Ler o formato legado direto do DuckDB, ou converter para Parquet | Isolar a conversão deixa o `01_extract.sql` da edição igual ao das outras e torna a etapa frágil (offsets, registros deletados, encoding) testável sozinha, UF a UF, contra a documentação pública do censo. Converter para Parquet pularia a checagem de largura fixa contra o layout do IBGE, que é justamente o que pega erro de posição. |
| Módulo inteiro ausente na edição | Flag booleana própria na dataclass `Edicao` (`pendular: bool`), **distinta** de `rotulos_pendular`: `pendular=False` remove o módulo pendular inteiro (tabelas, colunas do contrato e o submódulo pendular de RM), enquanto `rotulos_pendular` só apaga dimensões *dentro* de um módulo que existe. Primeiro uso: 1991. | Deduzir a ausência do módulo de `pula_scripts`, ou de `rotulos_pendular` todo nulo | `pula_scripts` é instrução de orquestração (qual SQL não roda) e não expressa o fato metodológico; e derivar "não tem módulo" de "todos os rótulos são nulos" confunde duas coisas diferentes — uma edição pode ter pendular sem ter as dimensões de tempo/modo/frequência, que é exatamente o caso de 2000. A flag declara o fato uma vez, e o pipeline e o front consultam a mesma declaração. |
| Núcleo metropolitano ausente na edição | Fallback aplicado **na edição**, não no CSV: quando o `cd_nucleo` de `pipeline/rm_nucleo.csv` não existe na malha do censo, o núcleo passa a ser o **município mais populoso entre os presentes naquela edição** — a mesma regra que `build_rm_nucleo.py` usa quando não há homônimo. Primeiro caso: RM do Sul do Estado (RR) em 1991, núcleo Rorainópolis → São João da Baliza. Segundo: **RM de Palmas em 1980** (desde `1.1.0-1980`), núcleo Palmas → Porto Nacional, porque Palmas foi fundada depois de 1980. Das 81 regiões, 80 têm municípios na malha de 1980 e 79 delas têm o núcleo do CSV presente; a ausente é a do Sul do Estado (RR). Até `1.0.7-1980` o fallback não era necessário em 1980 só porque as RMs de Palmas e Gurupi não apareciam na edição. | Mudar o CSV compartilhado, ou deixar a RM sem núcleo | O CSV é compartilhado por todas as edições de propósito (uma RM não troca de núcleo quando o usuário troca de censo); alterá-lo por causa de uma edição antiga mudaria o núcleo também em 2022. Sem núcleo, todos os pares intra-RM cairiam em `periferia_periferia`, que é um dado errado e silencioso. O fallback fica restrito às RMs afetadas e é declarado em `docs/METODOLOGIA.md`. |
| Comparabilidade entre edições (série) | Uma **fonte única** de regras, `pipeline/comparabilidade_regras.py`, devolve para cada combinação (medida × edição × nível) um estado — `comparavel`, `comparavel_com_ressalva`, `nao_comparavel` — e uma **chave de nota** que o front resolve em tooltip; ela gera `data/processed/series/comparabilidade.json`. No mesmo módulo ficam: o **limiar de cobertura** das agregações (**0,90** da população de 2022 da unidade), a **regra dura de escala** (CMI/SMI/ANMR/taxas/distâncias/conectividade/Gini/Duncan/log-linear **não** se comparam entre níveis; IEM/MEI e composições, sim), os **fatores de calibração do proxy de 1980** (volume ÷1,073; saldo ÷0,941 e ÷0,912 na UF), a **harmonização de vocabulário** (`status`, `idade_sexo`, `edu`, `renda`) e a **tipologia de Baeninger** sobre o IEM (0,15 e 1/3). | Espalhar `if (censo === ...)` pelos componentes da série; ou decidir a comparabilidade dentro de `build_series.py` | Uma seção que compara cinco censos tem uma decisão metodológica por célula; deixá-las no código do gráfico garante que elas divirjam entre gráficos e que ninguém consiga auditá-las. Com a matriz declarada num módulo só, uma edição nova é uma linha em `CAPACIDADES` mais as exceções que ela exigir, e o teste `validar()` recusa nota órfã ou combinação sem regra. Ver `docs/METODOLOGIA.md`, seção "Comparação entre censos (F12)". |

## Avisos de comparabilidade: o que cada edição antiga encontrou (2000, 1991, 1980)

Cada item abaixo é um ponto onde a convenção da tabela acima **não** vale automaticamente, e que
precisa de decisão nova e registrada — não de cópia. Os itens 3, 4 e 5 foram revistos depois de
implementar a edição 2000; **todos os seis foram revistos depois de implementar a edição 1991** — e
em dois casos (avisos 2 e 6) o que estava escrito por antecipação estava **errado** —; e **todos os
seis foram fechados depois de implementar a edição 1980** (F9.7), que era a edição para a qual eles
tinham sido escritos. Onde ainda falavam de 1980 no futuro, agora falam do que se verificou de fato,
com o ponteiro para onde a decisão está registrada. A edição 1980 ainda **abriu um sétimo aviso**,
sobre depender de uma fonte que não é a do IBGE. O aviso 1 foi **reaberto e fechado em definitivo na
F12**, a seção "Ao longo dos censos": ele era o único aviso cuja pergunta (AMC ou código?) não
pertencia a uma edição, e sim à comparação entre elas.

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
   cresce como previsto — **1.582 códigos de `labels.RECORTES` sem par na malha do censo** (contra
   1.082 em 1991), e no sentido inverso os 3.991 municípios de 1980 têm todos par em 2022 —, mas a
   novidade de 1980 não é o número: é que, pela primeira vez, **RGIs também ficam vazias** (500 das
   510 RGIs povoadas, e as 133 RGInts; 80 das 81 RMs presentes, 70 com menos municípios que em 2022
   e 4 com um único município). Ver `docs/METODOLOGIA.md`, item 9 da seção de 1980. Até
   `1.0.7-1980` as ausências eram maiores (1.634 códigos sem par; 489 RGIs, 130 RGInts e 78 RMs),
   por uma particularidade que não era anacronismo de recorte: **a edição não tinha o território do
   atual Tocantins como municípios** — os 52 municípios do norte de Goiás chegavam sem código na
   Base dos Dados, eram publicados como uma unidade agregada sem recorte, e com eles sumiam 11 RGIs,
   as 3 RGInts e 2 RMs. Era lacuna da fonte, não dos microdados; desde `1.1.0-1980` (fonte
   censobr/IPEA) os 52 são municípios comuns. Ver os avisos 7 e 8 abaixo.

   ***Desfecho definitivo (F12, seção "Ao longo dos censos").*** A AMC voltou à mesa uma **terceira**
   vez — agora não por causa de uma edição, mas da comparação entre as cinco — e foi descartada de
   novo. **O que muda é que desta vez a decisão não é "sem AMC e pronto": é "sem AMC, com genealogia
   como metadado e limiar de cobertura como contrapartida".** Considere a questão encerrada; uma
   edição futura deve herdar este desfecho, não reabri-lo.

   - **Por que foi descartada outra vez.** O motivo principal é o mesmo das duas anteriores: uma AMC
     mudaria a unidade de análise das **cinco** edições ao mesmo tempo, inclusive a de 2022, que é a
     que o público procura — o atlas deixaria de falar de municípios para falar de blocos sem nome
     oficial, e a perda de resolução é maior justamente na fronteira agrícola, que é o objeto
     migratório mais interessante do período (Ehrl 2017; a crítica de Silva & Bacha 2011 sobre o
     Norte). E havia, em F12, uma razão a mais, de custo: como a AMC teria de existir **antes** de
     qualquer agregação, ela entraria em `municipios_ref` e viraria nível novo em `03/04/07` — ou
     seja, **reprocessar o pipeline inteiro nas cinco edições e recarimbar os cinco gates**, cada um
     exigindo microdados de acesso controlado. A comparação entre censos, como foi construída, lê
     **apenas** `data/processed[/<edição>]/`, que já passou pelo gate: nenhum arquivo de edição é
     reescrito e nenhum gate é tocado.
   - **O que foi construído no lugar.** Duas peças, e nenhuma delas é uma unidade de análise.
     (i) A **genealogia**: `pipeline/build_genealogia.py` → `pipeline/genealogia_municipios.csv`
     (`cd_mun_2022, edicao, existia, cd_mun_mae, nm_mun_mae, metodo`), obtida por sobreposição das
     malhas públicas do IBGE. Ela registra **de qual território um município de hoje saiu**, sem
     fundir nada: não entra em `municipios_ref`, não entra no SQL do pipeline, e é lida só por
     `build_series.py` e pelo front. Quando o território vem de mais de um pai, marca
     `metodo = 'multiplos_pais'` (296 casos em 1980, 277 em 1991, 22 em 2000, 1 em 2010) e a
     interface diz "parte do território de X e outros". Os 139 municípios do atual Tocantins seguem,
     em 1980, o caminho genérico desde `1.1.0-1980`: 52 existiam, e os 87 criados depois recebem a
     mãe por sobreposição de área (até `1.0.7-1980` o pai de todos era a unidade agregada
     `NORTEGO`). Em números, a genealogia dá, medida contra a **malha** de cada edição, 1.579
     municípios de 2022 ausentes em 1980, 1.079 em 1991, 63 em 2000 e 5 em 2010.
     (ii) O **limiar de cobertura** das agregações, **0,90 da população de 2022 da unidade**
     (`comparabilidade_regras.LIMIAR_COBERTURA`): abaixo dele a célula de RGI/RGInt/UF/RM diz
     "cobertura insuficiente" em vez de número, e cobertura zero diz "sem cobertura". O valor foi
     calibrado, não arbitrado — na faixa 0,85–0,90 a distorção mediana da taxa bruta de imigração é
     de 14,1%, da ordem do próprio sinal que a série existe para mostrar (15% a 23% entre censos
     consecutivos), enquanto na faixa 0,90–0,95 cai a 7,2%.
   - **O custo assumido, explicitamente.** No nível municipal fica o **viés de fronteira**: a série
     de um município criado depois **trunca** (a célula nomeia o mãe e oferece a série dele, sem
     nunca somar nem emendar as duas), e a série do **município-mãe** vem enviesada — parte da queda
     de população e de fluxo entre dois censos é perda de área, e a mudança entre a sede e o
     distrito que viraria município autônomo, que no censo antigo era intramunicipal (isto é, não
     era migração), passa a contar como migração depois da emancipação, produzindo um salto de
     rotatividade puramente cartográfico. Nos níveis agregados o viés quase desaparece, por um
     motivo estrutural: um desmembramento **dentro** da mesma região não altera a imigração nem a
     emigração dela. O que sobra ali é cobertura, e é o limiar que a mede — na série construída ele
     corta 18 RGIs, 2 RGInts, 1 RM e nenhuma UF em 1991 e, em 1980, 46 RGIs (36 mais as 10
     vazias), 6 RGInts, 2 RMs (1 mais a vazia) e nenhuma UF na `1.1.0-1980` — eram 53, 9, 3 e 0 até
     `1.0.7-1980`, quando as 11 RGIs, as 3 RGInts e as 2 RMs do Tocantins saíam vazias —, contra
     nenhum corte em 2010. (A versão anterior deste parágrafo dava
     81/13/4/1 em 1980 e 39/3/2 em 1991: eram os números da calibração, antes da genealogia.)
     A contrapartida é obrigatória e é de interface: nenhuma queda de volume causada por fronteira
     pode ser exibida como tendência migratória sem o aviso correspondente.
   - **Onde está registrado.** `docs/genealogia.md` (contagens por edição, múltiplos pais, cobertura
     de RGI/RGInt/RM, casos-âncora e o Tocantins em 1980) e `docs/METODOLOGIA.md`, seção
     **"Comparação entre censos (F12)"**, itens 1 a 3 — base territorial, custo do viés de fronteira
     com a bibliografia de AMC, e a calibração do limiar de cobertura. **Uma edição nova não redecide
     nada disto**: roda `pipeline/build_genealogia.py` de novo (ela precisa de linha para cada
     município de 2022) e depois `pipeline/build_series.py`, conforme o passo 10 do checklist.
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
   1980, `v518` já traz `UF‖MUNIC` completo, mas numa das 27 partições da Base dos Dados — o Ceará
   — com **seis** dígitos em vez de sete, o que sem tratamento descartaria 100% das origens do
   estado; a anomalia era da Base dos Dados e não existe na fonte atual), e
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
   deste aviso está fechada, não há um segundo quesito de estudo em 1980. Desde `1.1.0-1980` a fonte
   aplica o universo do quesito (10 anos ou mais), e o fluxo de estudo de 1980 cobre só essa faixa,
   enquanto nas outras edições cobre estudantes de qualquer idade — mais uma diferença de universo a
   declarar ao comparar (`docs/METODOLOGIA.md`, item 6 de 1980). O detalhe é que cai mais
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
   **Segunda parte: a edição não publica renda nenhuma.** Na Base dos Dados, fonte até
   `1.0.7-1980`, os rendimentos chegavam preenchidos na partição do Ceará e em 0,0% das outras 26
   UFs, de modo que todas as colunas de renda de 1980 são nulas e o filtro de renda some da
   interface — o salário mínimo foi reconciliado mesmo assim, para documentar a unidade monetária e
   permitir uma publicação futura. O censobr, fonte desde `1.1.0-1980`, traz a renda nas 27 UFs; a
   publicação ficou como trabalho futuro, com validações próprias. Três lições para a próxima
   edição: reconcilie o SM **antes** de saber se vai publicar renda (é barato e fecha uma incógnita
   histórica); **meça a cobertura da variável partição a partição** antes de projetar o módulo — a
   renda de 1980 não faltou, chegou 26/27 vazia —; e, quando uma variável chega vazia numa fonte
   secundária, pergunte se ela está vazia **nos microdados** (aviso 8). Ver `docs/METODOLOGIA.md`, item 7 da seção de
   1980, e `pipeline/sql/1980/MAPEAMENTO_02_classify.md` §7. Atenção a uma armadilha que só
   apareceu em 2000 e pode reaparecer: a **renda domiciliar per capita** pode não vir pronta, e
   construí-la dividindo o rendimento domiciliar pelo total de moradores dá errado quando o
   numerador do IBGE já exclui pensionistas e empregados domésticos residentes e o denominador não
   — ver `docs/METODOLOGIA.md`, item 2 da seção de 2000.
7. **A fonte pode não ser a do IBGE — e uma fonte secundária pode perder território calada.**
   *(Aviso novo, aberto pela edição 1980; não existia quando as outras quatro foram feitas.)* As
   edições de 2022 a 1991 leem a cópia distribuída pelo IBGE. A de 1980 não pôde: as cópias
   públicas em circulação (DBF e `.sav`) **não trazem a V518**, o município de residência anterior,
   sem o qual não há matriz origem→destino. A edição foi alimentada pela **Base dos Dados**
   (BigQuery) até `1.0.7-1980` e é alimentada pelo **censobr/IPEA** desde `1.1.0-1980` — ver a
   linha "Procedência dos microdados" na tabela de decisões. Quatro regras que saíram disso, e que
   valem para qualquer edição futura que dependa de terceiros: (a) **valide a fonte secundária
   contra a primária** no que as duas têm em comum, antes de classificar qualquer coisa (contagens
   por UF, Σ peso, conjuntos de código de município) — e, se trocar de fonte secundária, valide a
   nova contra a anterior **célula a célula** antes de rodar o pipeline, como fez
   `scripts/prep_1980_censobr.py`; (b) **espere o preço aparecer depois da extração**, não antes —
   em 1980 foram três surpresas, todas invisíveis no dicionário e visíveis só nos dados (o Ceará
   com codificação de seis dígitos, 52 municípios de Goiás e Fernando de Noronha sem geocódigo, a
   renda preenchida em uma única partição); (c) quando a fonte perder uma área, **declare a lacuna
   em vez de aproximá-la — e depois pergunte se ela é mesmo uma lacuna, e de quem ela é**: as três
   surpresas de 1980 eram todas da construção da tabela da Base dos Dados, não dos microdados, e
   nenhuma existe no censobr; e (d) **se o código de construção da fonte secundária for público,
   leia-o**: foi o do-file da Base dos Dados (um `merge` do código de 1980 contra o diretório atual
   de municípios) que explicou os 178.636 registros sem município, depois que a sondagem das quatro
   camadas de dados tinha apenas confirmado que o campo estava vazio. A história, em quatro etapas,
   está no aviso 8. Ver `docs/METODOLOGIA.md`, itens 1 e 4 da seção de 1980,
   `pipeline/sql/1980/MAPEAMENTO_fonte_censobr.md`, `pipeline/sql/1980/MAPEAMENTO_02_classify.md`
   §0 e §3, e `docs/qa/sonda_1980_bd.md`.
8. **"Não dá para publicar a unidade" e "não dá para publicar o fluxo" são coisas diferentes — e a
   segunda pergunta certa é "o que exatamente a fonte não diz?"; a primeira, "é a fonte ou são os
   microdados que não dizem?".** A edição 1980 respondeu isso quatro vezes, e as quatro respostas
   são o aviso. As lições das três primeiras (os seis primeiros itens abaixo) continuam valendo para
   uma lacuna real; a quarta (o último item) mostrou que a de 1980 não era:
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
   - **Agregar publica mais quando o limiar morde — mas isso não é motivo para agregar.** Uma
     origem coletiva publicou 87,5% da massa emigratória contra 64,0% de 52 origens separadas. É o
     efeito de R1 sobre qualquer município pequeno, que o atlas não usa como razão para agregar em
     lugar nenhum; serve como critério de desenho **depois** que a fonte impõe a agregação, nunca
     como argumento para ela.
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
     deixava de ser migração (11.586 registros). Separe isso do que é do questionário e não da
     agregação: a naturalidade do território só existe por UF (o censo registrava "Goiás"), com ou
     sem unidade agregada.
   - **Antes de declarar a lacuna, pergunte se outra distribuição da mesma fonte a fecha.** *(Quarta
     resposta, `1.1.0-1980`.)* As três primeiras respostas partiram de uma conclusão verdadeira sobre a
     Base dos Dados — nenhuma das quatro camadas dela tinha o município dos 52 — e a trataram como
     verdadeira sobre os microdados. Não era: a causa era um `merge` no código de construção da
     tabela, e duas outras distribuições tinham o dado — a cópia DBF do IBGE (o município, sem a
     origem) e o censobr/IPEA (os dois no mesmo registro, publicado no mesmo dia em que a unidade
     agregada foi decidida). A regra: quando uma fonte secundária não tem um campo que o questionário
     tem, **liste todas as distribuições dos mesmos microdados** (a do IBGE, as de terceiros, as
     harmonizadas por projetos acadêmicos) e confira em cada uma **o arquivo, não só o dicionário**
     — em 1980 a ausência de `V517` no DBF foi afirmada a partir do dicionário e era falsa. Se duas
     distribuições tiverem metades complementares, a **vinculação por atributos**, verificável
     contra um gabarito, é uma alternativa real ao join posicional (em 1980 ela acertou 100% do
     gabarito de 171 municípios e ficou como plano B). E desfazer uma agregação já publicada não pede
     regra de sigilo nova quando os microdados são públicos — pediria, se não fossem. Ver
     `pipeline/sql/1980/MAPEAMENTO_norte_goias.md` (§1.1 e §2.4),
     `pipeline/sql/1980/MAPEAMENTO_fonte_censobr.md` e `docs/METODOLOGIA.md`, item 4 da seção de
     1980.

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
   a etapa anterior é uma **extração** ou uma **preparação** da distribuição escolhida, também
   separada e anterior ao pipeline: `scripts/prep_1980_censobr.py` é o modelo atual (arquivo
   nacional → Parquet por UF em `data/raw<edicao>/`, no esquema que o SQL da edição lê, com SHA-256
   da entrada, gates de identidade contra a fonte anterior e gravação só se todos passarem), e
   `scripts/extract_1980_bd.py` o de uma extração de BigQuery (uma consulta por UF, com dry run e
   teto de bytes). Nos dois casos a preparação roda **antes** de `build_ref.py` e `run.py`
   (`docs/PIPELINE.md`, seção 10), e valem os avisos 7 e 8.
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
   três; em 1980, quatro — e uma RM e 10 RGIs não aparecem de forma alguma, ver
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
10. **Série "Ao longo dos censos".** Declare a edição em
    `pipeline/comparabilidade_regras.CAPACIDADES` (o que ela mede: pendular e suas dimensões,
    renda, erro amostral, vocabulário de `status`, limiar de revelação, data fixa ou proxy) e
    acrescente as exceções por medida que ela exigir, com a **nota** correspondente em `NOTAS`.
    Rode `python pipeline/comparabilidade_regras.py`: ele recusa nota órfã e combinação sem
    regra. Rode de novo `pipeline/build_genealogia.py` (a edição nova precisa de linha para cada
    município de 2022) e `pipeline/build_series.py`. Nenhuma decisão de comparabilidade deve ir
    para o front nem para o SQL — o módulo é a fonte única. Ver `docs/METODOLOGIA.md`, seção
    "Comparação entre censos (F12)".
11. **Páginas estáticas de SEO.** Hoje `pipeline/build_paginas.py` gera páginas apenas para a
    edição 2022 (não recebe `--edicao`). Se a edição nova também deve ter páginas estáticas, isso é
    trabalho adicional a planejar — ver `docs/SEO.md`.
