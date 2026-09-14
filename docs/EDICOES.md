# Convenções multi-edição e guia para incluir um novo censo

## Por que este documento existe

O atlas já publica duas edições — Censo 2022 (primeira) e Censo 2010 (segunda) — e há intenção de
incluir os Censos **2000, 1991 e 1980**. Quase toda decisão de engenharia tomada até aqui tem uma
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
| Recortes territoriais (RGI, RGInt) | A divisão de 2017 do IBGE aplicada **retroativamente** por código de município, a partir de `pipeline/labels.py` (`RECORTES`, dicionário de 2022). | Usar a divisão vigente em cada censo (mesorregião/microrregião de 2010 etc.) | Sem um recorte comum, os níveis de agregação da interface (RGI, RGInt, UF) não seriam navegáveis entre edições. O anacronismo é explícito e documentado, e o custo é conhecido: 510 RGIs e 133 RGInts em ambas as edições, nenhum município sem correspondência. |
| Recorte metropolitano | Idem: as **81 RMs/RIDEs do dicionário de 2022** aplicadas retroativamente por código de município (`pipeline/build_ref.py::_build_outra_edicao`). | O recorte metropolitano do próprio censo — em 2010, a variável `V1004`, com 42 unidades (36 RMs, 3 RIDEs, 3 aglomerações urbanas do RS) | Alternativa avaliada e descartada: 38 das 42 unidades de 2010 têm par nominal em 2022, mas mesmo essas têm **composição municipal diferente**, então usá-las daria RMs que mudam de recorte quando o usuário troca de censo. Custo assumido: municípios criados depois do censo antigo simplesmente não existem nele (4 casos entre 2010 e 2022 — ver `docs/METODOLOGIA.md`, item 6). |
| `cd_rm` | Sempre o `COD_CATMETROPOL` de 2022, em todas as edições. | Código nativo de cada censo | Consequência direta do recorte retroativo: é o identificador que permite ao front trocar de edição mantendo a seleção do usuário. |
| Núcleo metropolitano | Município **membro** homônimo (o nome do município aparece como sequência inteira de palavras no nome da região); sem homônimo, o mais populoso. Um único `pipeline/rm_nucleo.csv`, gerado por `pipeline/build_rm_nucleo.py`, compartilhado por todas as edições. | Regra "sempre o mais populoso" (a original), ou um núcleo por edição | O homônimo é a definição que corresponde ao conceito de cidade-núcleo em casos como a Grande Vitória, onde o mais populoso (Serra) não é o centro funcional. A regra foi aplicada retroativamente também a 2022 para que uma RM não troque de núcleo ao trocar de censo — mudou o núcleo de 3 das 81 regiões. `--check` no script falha se o CSV sair de sincronia. |
| Vocabulários que mudam com o questionário | Declarados por edição: `pipeline/disclosure_rules.STATUS_POR_EDICAO` no pipeline e `recursos`/`vocabulario`/`rotuloRetorno`/`statusCategorias` em `web/src/lib/edicoes.ts`. Os componentes consultam a configuração da edição. | `if (censo === "2010")` espalhado pelos componentes e pelo SQL de publicação | Uma condicional por edição multiplica-se por edição × componente; com cinco censos, seria inviável. Declarar o vocabulário num lugar só faz a edição nova ser um registro novo na tabela, não uma varredura pelo código. Cobre: categorias de `status` migratório, frequência de retorno pendular, faixas de tempo de deslocamento e presença/ausência da dimensão "modo de transporte". |
| `NULL` vs `0`/`false` | "Esta edição não mede isso" é sempre `NULL`, gravado explicitamente (ex.: `CAST(NULL AS DOUBLE)` em `pipeline/sql/2010/08_metro.sql`), nunca `0`, `false` ou string vazia. | Deixar o agregador convergir para `NULL` sozinho, ou preencher com zero | Zero é um valor medido; ausência não é. Gravar explicitamente documenta a ausência no próprio SQL em vez de depender de efeito colateral, e o front decide se esconde o indicador (via `recursos`) em vez de exibir "0%". |
| Regras de revelação | R1–R9 idênticas em todas as edições, num único caminho de código (`pipeline/disclosure_rules.py` aplicado por `publish.py` e verificado por `disclosure_check.py --edicao <e>`). Só o vocabulário de `status` varia. | Limiares calibrados por edição (ex.: mais frouxos para microdados públicos como os de 2010) | Um único conjunto de regras é auditável e transferível; calibrar por edição criaria a obrigação de justificar cada limiar separadamente e abriria a porta para publicar em 2010 algo que não se publicaria em 2022. O relatório sai com sufixo de edição (`docs/relatorio_revelacao_<edicao>_<versao>.md`) para não colidir. |
| Estimador de variância | O mesmo estimador de conglomerados em último estágio (domicílio como UPA, área de ponderação como estrato) reaproveitado sem alteração entre 2022 e 2010. | Reestimar o desenho amostral de cada censo | Os dois censos têm o mesmo desenho relevante (amostra por domicílio, calibração por área de ponderação) e o resultado foi validado: a distribuição de CV dos fluxos de 2010 é praticamente idêntica à de 2022. **Isto não se generaliza automaticamente para censos anteriores** — ver avisos abaixo. |

## Avisos específicos para 2000, 1991 e 1980

Cada item abaixo é um ponto onde a convenção da tabela acima provavelmente **não** vale, e que
precisa de decisão nova e registrada — não de cópia.

1. **Códigos de município mudam muito mais.** Entre 2010 e 2022 o problema se resumiu a cinco
   municípios instalados em 2013, resolvidos como "ausentes do censo antigo". De 1980 para 2022 há
   **centenas** de desmembramentos, e o município de origem nem sempre pertence ao mesmo recorte do
   município desmembrado. Aplicar RGI/RGInt e o recorte metropolitano retroativamente por código
   passa a exigir uma tabela de **áreas mínimas comparáveis** (AMC), construída antes de qualquer
   agregação territorial, e não apenas um filtro de códigos ausentes. Decidir também se a AMC vira
   um nível de agregação visível na interface ou só uma etapa interna.
2. **A variável de data fixa muda de definição.** O par (residência há 5 anos, residência atual)
   não é o mesmo quesito em todos os censos. O Censo 1991 pergunta apenas a **UF ou o país** de
   residência 5 anos antes, sem o município — o que inviabiliza a matriz origem→destino municipal
   como ela existe hoje e pode restringir a edição aos níveis UF/RGInt. E a distinção entre
   município de nascimento e residência anterior, que 2022 tem e 2010 já não tem, precisa ser
   reconferida censo a censo antes de mapear as categorias de `status` (a confirmar no
   questionário de cada edição).
3. **Deslocamento pendular só existe a partir de 2010.** O quesito "onde trabalha/estuda" é o que
   sustenta todo o módulo pendular e o cruzamento migração × pendularidade do módulo
   metropolitano. O Censo 2000 tem local de trabalho, mas sem tempo nem frequência de
   deslocamento; 1991 e 1980 provavelmente não têm nada de pendular (a confirmar nos
   questionários). Para essas edições, `pula_scripts` em `pipeline/edicoes.py` e
   `recursos.rm`/recursos pendulares em `web/src/lib/edicoes.ts` existem exatamente para isso — a
   edição publica menos módulos, e o front esconde o que não existe em vez de mostrar tabela vazia.
4. **Peso amostral e desenho da amostra mudam de metodologia.** A calibração, a fração amostral e
   a definição de estrato variam entre censos. O reaproveitamento do estimador de variância entre
   2022 e 2010 foi **verificado**, não presumido; para os censos anteriores é preciso refazer essa
   verificação antes de publicar erro-padrão e coeficiente de variação, e considerar a
   possibilidade de a edição publicar estimativas sem precisão declarada.
5. **1980 não tem área de ponderação.** O conceito foi introduzido depois, e é o estrato do
   estimador atual. Sem ele, ou se define outro estrato (setor censitário agregado, município,
   microrregião — com a perda de precisão correspondente), ou a edição de 1980 publica sem erro
   amostral. Decisão metodológica, não de implementação.
6. **Salário mínimo e renda.** A edição 2010 pôde reaproveitar os cortes relativos porque o IBGE já
   divulga a renda **em número de salários mínimos**. Onde isso não existir, será preciso decidir
   entre converter com o salário mínimo de referência do censo ou deflacionar — e nesse caso
   registrar qual índice, porque isso afeta diretamente a comparabilidade dos cortes de renda.

## Checklist para incluir uma edição nova

Ordem sugerida; cada passo aponta para o arquivo desta vez que serve de modelo. Não repita o
conteúdo deles — leia-os e faça o análogo.

1. **Registrar a edição.** Novo registro em `pipeline/edicoes.py` (paths, salário mínimo, período
   de referência, `sql_override_dir`, `pula_scripts`) e em `web/src/lib/edicoes.ts` (rótulos,
   `recursos`, `vocabulario`, `statusCategorias`). Use os registros de 2010 como modelo dos dois.
2. **Parsear a documentação pública do censo.** `pipeline/layout_2010.py` (posições de largura
   fixa a partir do layout .ods do IBGE) e `pipeline/labels_2010.py` (municípios e divisão
   territorial) são o modelo: módulos **gerados**, não editados à mão, sem nenhum microdado dentro.
3. **Decidir e documentar as divergências de questionário ANTES de escrever SQL.** É trabalho de
   metodologia, não de implementação: para cada variável do pipeline, a edição nova mede a mesma
   coisa, mede coisa parecida com definição diferente, ou não mede? A resposta vira uma entrada na
   seção de comparabilidade de `docs/METODOLOGIA.md` e um comentário no cabeçalho do SQL.
4. **Escrever só os overrides necessários** em `pipeline/sql/<edicao>/`, usando `pipeline/sql/2010/`
   como modelo — inclusive a convenção de cabeçalho, que lista ponto a ponto em que o override
   diverge do script genérico. Respeitar o contrato de esquema de `pessoas_classificado.parquet`:
   o que a edição não mede é coluna `NULL`, não coluna ausente.
5. **Referência territorial e geo.** `pipeline/build_ref.py::_build_outra_edicao` é o ponto onde os
   recortes de 2022 (RGI, RGInt, RM) são aplicados retroativamente — é aqui que entra a tabela de
   áreas mínimas comparáveis, se a edição precisar de uma. Malha: `geo/fetch_2010.sh` é o modelo de
   como obter e normalizar shapefiles antigos do geoftp; `geo/build.sh <edicao>` já é parametrizado.
6. **Núcleos metropolitanos.** Rode `pipeline/build_rm_nucleo.py --check`. Se a edição nova mudar
   a composição de alguma RM, o CSV é compartilhado — qualquer mudança afeta **todas** as edições,
   e isso é intencional; confira o diff antes de aceitar.
7. **Publicar e passar no gate.** `pipeline/publish.py --edicao <e>`, depois
   `pipeline/disclosure_check.py --edicao <e> --versao <v>` (exige microdados) e
   `pipeline/verify_gate.py --dir data/processed/<e>` (não exige). O workflow
   `.github/workflows/publicar.yml` já varre as edições adicionais, mas confira que a pasta nova
   entra na varredura.
8. **Testes.** `pipeline/tests/test_edicao_2010.py` é o modelo de suíte específica de uma edição
   (identidades, vocabulário, ausências declaradas, gate). `pipeline/tests/test_f3_geo.py` e
   `pipeline/tests/test_f2b_pendular.py` são o modelo de **parametrização por edição** via
   `@pytest.mark.parametrize` sobre `EDICOES_TESTADAS`: prefira estender esses a duplicar arquivos.
   `pipeline/tests/test_rm_nucleo.py` cobre as âncoras de núcleo por edição.
9. **Front-end.** `npm run sync-data` já copia todas as edições e recusa se o gate de qualquer uma
   delas não estiver válido. Verifique que nenhum componente novo precisou de condicional por censo
   — se precisou, a informação provavelmente deveria estar em `edicoes.ts`.
10. **Páginas estáticas de SEO.** Hoje `pipeline/build_paginas.py` gera páginas apenas para a
    edição 2022 (não recebe `--edicao`). Se a edição nova também deve ter páginas estáticas, isso é
    trabalho adicional a planejar — ver `docs/SEO.md`.
