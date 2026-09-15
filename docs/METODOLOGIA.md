# Metodologia — Atlas da Migração Interna no Brasil (Censo 2022, data fixa)

Versão 0 (F0). Consolida as definições do plano aprovado; será expandida a cada fase com resultados de QA.

## Fonte

IBGE, Censo Demográfico 2022, microdados da amostra (acesso controlado). Questionário da amostra, quesito 11 (Migração Interna e Internacional). Referência de data fixa: 31/07/2017 → 31/07/2022 (quinquênio).

## Universo

Pessoas de 5 anos ou mais residentes em 2022. `P0600` só é respondido por quem mora há menos de 6 anos no município de residência atual.

## Definição de migrante

- **Migrante interno** (`P0600 = 2`): morava em outro município do Brasil em 31/07/2017.
- **Migrante internacional** (`P0600 = 3`): morava em outro país em 31/07/2017.
- **Não migrante**: `P0600 = 1` (mesmo município) ou `P0600` em branco com idade ≥ 5 (mora no município há 6+ anos ininterruptos).
- **Origem não informada** (`P0620 ∈ {8888888, 9999999}`, ~1,8% dos migrantes internos): conta na imigração total do destino; fica fora da matriz origem→destino e do cômputo de emigração. Ver plano, decisão registrada com o usuário.

## Indicadores municipais e de fluxo, status migratório, escolaridade, renda, precisão, revelação, módulo metropolitano e pendular

Ver o plano completo (`PLANO_Atlas_Migracao_Censo2022.pdf`) para as fórmulas e definições completas — reproduzidas aqui à medida que cada fase é implementada e validada com os dados reais, para que este documento reflita o que foi de fato executado (e não apenas planejado).

## Validações já realizadas (F0)

- Soma de `P0111` no arquivo de Pessoas do Distrito Federal = 2.817.381, batendo com o valor oficial da amostra para o DF citado nas Notas metodológicas 04/2026 (Tabela 1).
- Todos os códigos observados de município de residência há 5 anos (`P0620`) pertencem à lista de municípios de 2022 (nenhuma harmonização territorial necessária entre 2017 e 2022).
- Malha municipal do IBGE (2022) obtida em `data/geo/raw` para a etapa F3.


## Validações já realizadas (F1)

- Extração das 27 UFs via DuckDB (`pipeline/sql/01_extract.sql`) em 56,4 s: 21.539.579 registros de pessoas e 7.689.963 de domicílios, batendo exatamente com os totais do Questionário da Amostra (Notas 04/2026, Tabela 1).
- Soma nacional de `P0111` = 203.080.756, exata em relação à Tabela 3 das Notas 04/2026.
- Join pessoas↔domicílios por `controle`: 100% de correspondência.
- 100% dos códigos de município (residência atual e residência há 5 anos, quando conhecida) pertencem à lista oficial de 2022.
- Detalhes completos em `docs/qa/F1_relatorio.md`.


## Decisões de implementação (F2)

- **Tabela classificada completa.** O plano previa `interim/migrantes.parquet`; a implementação gera `interim/pessoas_classificado.parquet` com **toda** a população, porque o dashboard compara o perfil dos migrantes ao dos residentes não migrantes.
- **`origem_valida`.** Fluxos, emigração e saldo usam apenas migrantes internos com origem conhecida e origem diferente do destino. Isso garante a identidade Σ imigrantes = Σ emigrantes e isola dois registros inconsistentes da fonte.
- **Perfis (`municipios_dim`).** A direção `imig` descreve os migrantes internos com origem conhecida — a mesma população mapeada nos fluxos —, e não o total de chegadas. Imigração internacional e origem não informada aparecem como colunas próprias em `municipios.parquet`.
- **Variância.** Forma fechada `Σ_h n_h/(n_h−1)·(S2_h − S1_h²/n_h)` por estrato (área de ponderação), com o domicílio como unidade primária. `Var(saldo) = Var(imigração) + Var(emigração)`, já que as duas parcelas vêm de conjuntos disjuntos de domicílios amostrados.
- **Agregações territoriais.** A variância dos fluxos por região imediata, intermediária e UF é recalculada em cada nível, e não somada a partir dos municípios.

## Validações já realizadas (F2)

- Identidade Σ imigrantes = Σ emigrantes = 12.883.156 e Σ saldos = 0.
- Categorias de status, renda e idade/sexo reconciliam exatamente com o total de cada fluxo.
- Coeficientes de variação na mesma ordem de grandeza da Função Generalizada de Variância do IBGE (razão entre 0,64 e 1,74 por faixa de tamanho).
- Verificações demográficas: retorno nordestino acima da média nacional, seletividade educacional positiva, desconcentração metropolitana entre os maiores fluxos.
- Gate de revelação aprovado sem violações; ver `docs/relatorio_revelacao_2026-09-05.md` e `docs/qa/F2_relatorio.md`.


## Decisões de implementação (F2b)

- **Universos.** Pendularidade para trabalho considera pessoas ocupadas de 10 anos ou mais (`P0960 = 1`); para estudo, quem frequenta escola ou creche (`P0650 = 1`).
- **Fluxo pendular.** Trabalha ou estuda em outro município do Brasil, com destino conhecido e diferente da residência. Quem trabalha em mais de um município ou no exterior entra apenas como categoria nos indicadores municipais, nunca na matriz de fluxos.
- **Agrupamentos.** Transporte em 6 grupos, posição na ocupação em 5, setor de atividade em 8, rendimento do trabalho em 5 classes de salário mínimo, nível do curso em 4. As correspondências estão em `pipeline/sql/02_classify.sql`.
- **Núcleo metropolitano.** Município **membro** da região cujo nome aparece como sequência inteira de palavras no nome da região (ex.: Vitória na "Região Metropolitana da Grande Vitória"); sem homônimo entre os membros, o mais populoso. Calculado por `pipeline/build_rm_nucleo.py` (com `--check` para verificar que o CSV está sincronizado) e registrado em `pipeline/rm_nucleo.csv`, um único arquivo compartilhado por **todas as edições** — a regra vale retroativamente, e não só para 2022. Em relação à regra anterior (só o mais populoso), muda o núcleo de 3 das 81 regiões: Grande Vitória (Serra → Vitória), Vale do Piancó (Itaporanga → Piancó) e Barra de Santa Rosa (Cuité → Barra de Santa Rosa). A restrição "membro da RM" é o que faz o fallback funcionar nos recortes que não contêm a cidade que os nomeia: Colar Metropolitano de Belo Horizonte → Sete Lagoas (BH não é membro do Colar), Entorno da RM do Vale do Rio Cuiabá → Poconé (Cuiabá não é membro) e Cariri → Juazeiro do Norte.
- **Cruzamento migração × pendularidade.** Para cada migrante intrametropolitano ocupado, registra-se o município de trabalho e sua classe: `origem` (voltou a trabalhar de onde saiu), `nucleo` (trabalha no núcleo sem ter vindo dele), `outro`, `proprio` (trabalha onde mora), `varios`, `exterior`. Para quem saiu do próprio núcleo, `origem` e núcleo são o mesmo município, então o percentual que segue trabalhando no núcleo aparece na classe `origem`.
- **Formato da caracterização pendular.** Longo em vez de largo, por causa do número de dimensões.

**Nota: os achados de capa são estimativas populacionais, não somas dos arquivos publicados.** Os percentuais destacados na capa do atlas, nas páginas estáticas e no README (46,5% de quem saiu do núcleo metropolitano para a periferia segue trabalhando no núcleo; 59,3% na RIDE do Distrito Federal) são calculados sobre o agregado **completo**, em `data/interim`, antes da supressão de sigilo. Refazendo exatamente a mesma conta sobre os parquets publicados em `data/processed` — que já passaram pela regra R1 (célula com n < 5 suprimida), o que atinge sobretudo a classe `outro` e os registros de origem não informada — chega-se a 49,1% e 60,1%. A diferença é esperada e metodologicamente correta: o indicador é populacional, estimado a partir da amostra inteira, e a supressão é uma proteção de publicação célula a célula, não uma recomputação do indicador. Consequência prática para quem quiser reproduzir: os arquivos publicados reproduzem a ordem de grandeza e o sentido do achado, não o dígito; o valor exato depende dos microdados de acesso controlado.

## Validações já realizadas (F2b)

- Σ saídas = Σ entradas para trabalho (9.057.282) e para estudo (3.811.136).
- Σ da tripla origem→residência→trabalho = migrantes intra-RM ocupados (1.571.255).
- Guarulhos→São Paulo é o maior par pendular do país; Santana→Macapá presente, conforme previsto no plano.
- Cada região metropolitana tem exatamente um núcleo; nenhum município pertence a mais de uma.
- Gate de revelação aprovado sobre as 18 tabelas publicadas. Detalhes em `docs/qa/F2b_relatorio.md`.

## Níveis de agregação (F6)

Nos níveis região imediata, região intermediária e UF, imigrantes e emigrantes de uma unidade são somados a partir dos fluxos entre unidades distintas (`fluxos_rgi`, `fluxos_rgint`, `fluxos_uf`). Consequência: migração entre municípios da mesma unidade não é contabilizada, e pares suprimidos no nível municipal ficam fora da soma. Taxa líquida usa a soma de `pop5` dos municípios da unidade. Não há erro-padrão publicado nesses níveis (exibido como "sem estimativa"). As malhas foram obtidas por dissolução da malha municipal do IBGE (`geo/build.sh`), e os centroides por nível são a média dos centroides municipais ponderada por `pop5`.

## Edição Censo 2010 e comparabilidade com 2022

A edição 2010 replica a mesma cadeia de processamento da edição 2022 sobre os microdados da
amostra do Censo Demográfico 2010 (públicos, TXT de largura fixa), com **data fixa 31/07/2005 →
31/07/2010**. O universo é o mesmo — pessoas de 5 anos ou mais —, e o quesito de data fixa
(`V0626`) tem exatamente o mesmo filtro de `P0600`: só foi aplicado a quem morava há menos de 6
anos no município. Sete diferenças de conteúdo e de recorte impedem a comparação mecânica entre as
duas edições e estão registradas no SQL da edição (`pipeline/sql/2010/02_classify.sql`,
`07_pendular.sql`, `08_metro.sql`).

1. **Status migratório reduzido.** O Censo 2010 não coleta o município de nascimento — o quesito
   6.18 pergunta apenas "nasceu neste município?" e o 6.22 registra a UF ou o país, nunca o
   município. Sem essa informação é impossível comparar o município natal com o de residência em
   2005 e, portanto, separar `primeira_saida` de `etapas_multiplas`: as duas colapsam numa única
   categoria, `nao_natural` (migrante interno que não nasceu no município de destino nem no
   exterior). `retorno_natal` e `nascido_exterior` mantêm a definição de 2022; o primeiro fica até
   mais direto, porque em 2010 vem do próprio quesito de retorno (`V0618 = 2`, "nasceu neste
   município mas já morou em outro") e não de inferência.
2. **"Retorna diariamente" ≠ "3+ dias por semana".** A dimensão de frequência do deslocamento
   pendular vem de `V0661`, que pergunta se a pessoa retorna do trabalho para casa **diariamente**
   (sim/não); em 2022, `P1160` pergunta se retorna **três ou mais dias por semana**. Os códigos
   coincidem, as definições não, e as séries não devem ser lidas como uma série temporal.
3. **Sem meio de transporte.** O questionário de 2010 não tem quesito de meio de transporte ou de
   locomoção — o bloco de deslocamento vai de 6.60 a 6.62 e pergunta apenas município, retorno
   diário e tempo gasto. A dimensão "modo" não existe nesta edição.
4. **Tempo de deslocamento em vocabulário próprio.** `V0662` tem cinco faixas (até 5 min; de 6 min
   até meia hora; mais de meia hora até 1h; mais de 1h até 2h; mais de 2h), contra as oito de
   `P1180` em 2022, e não são aninhadas: a segunda faixa de 2010 atravessa duas faixas de 2022.
   Publicam-se as faixas de 2010 como vocabulário próprio, sem tentativa de harmonização. O
   universo também é mais estreito: o quesito só foi aplicado a quem trabalha fora do próprio
   domicílio **e** retorna para casa diariamente.
5. **Salário mínimo e renda.** O salário mínimo de referência é o de julho de 2010, R$ 510,00. A
   renda domiciliar per capita e o rendimento do trabalho principal são lidos diretamente das
   variáveis que o IBGE já divulga **em número de salários mínimos** (`V6532` e `V6514`), de modo
   que os cortes relativos são os mesmos de 2022 (1/4, 1/2, 1 e 2 SM para a renda per capita; 1, 2,
   3 e 5 SM para o rendimento do trabalho) sem deflator nem conversão.
6. **Malha municipal e recortes.** A edição usa a malha de 2010, com **5.565 municípios** (os 5
   criados em 2013 ainda não existem). As regiões geográficas imediatas e intermediárias, que são
   da divisão de 2017, são aplicadas retroativamente por código de município — todos os 5.565
   existem em 2022 —, o que preserva os mesmos níveis de agregação na interface ao custo de um
   anacronismo territorial explícito (validado: 510 RGIs e 133 RGInts, idêntico a 2022, nenhum
   município sem correspondência). O **recorte metropolitano segue a mesma lógica**: são as 81
   RMs/RIDEs do dicionário de 2022 (`COD_CATMETROPOL`) aplicadas retroativamente por código de
   município, com o mesmo `cd_rm` nas duas edições, e **não** o recorte do próprio Censo 2010
   (`V1004`, 42 unidades — 36 regiões metropolitanas, 3 RIDEs e 3 aglomerações urbanas do Rio
   Grande do Sul). A alternativa foi avaliada e descartada: 38 das 42 unidades de 2010 têm par
   nominal em 2022, mas mesmo essas têm composição municipal diferente, de modo que usá-las
   tornaria as RMs não navegáveis entre edições sem ganho de precisão conceitual. Consequência do
   recorte retroativo: **1.384 municípios com RM em 2010**, contra 1.388 em 2022 — quatro dos cinco
   municípios instalados em 2013 pertencem a alguma RM em 2022 e não existiam em 2010 (Mojuí dos
   Campos, na RM de Santarém; Pescaria Brava, na RM de Tubarão; Balneário Rincão, na RM
   Carbonífera; Pinto Bandeira, na RM da Serra Gaúcha), então essas quatro RMs aparecem em 2010 com
   um município a menos, **sobre o mesmo território** — em 2010 essas áreas ainda faziam parte do
   município de origem do desmembramento (Santarém, Laguna, Içara e Bento Gonçalves,
   respectivamente), e todos os quatro são membros da mesma RM. O quinto município de 2013,
   Paraíso das Águas, não tem RM em nenhuma das edições. Por fim, a origem "não sabe município" em
   2010 não é `8888888`/`9999999` e sim o padrão `UF‖99999` (um código por UF), mais `9899999`
   ("não sabe UF nem país estrangeiro"); esses registros recebem o mesmo tratamento de 2022 —
   contam na imigração total do destino, mas ficam fora da matriz origem→destino e do cômputo de
   emigração.
7. **Módulo metropolitano.** O módulo é publicado nesta edição, com as mesmas 81 regiões do
   recorte retroativo descrito no item 6 e os mesmos arquivos de 2022 (`rm*.parquet` em
   `data/processed/2010/`, gerados por `pipeline/sql/2010/08_metro.sql`). Duas colunas de resumo,
   porém, são **sempre nulas** em `rm_resumo.parquet` e em `rm_mig_pendular*.parquet`:
   `pct_coletivo`, porque o Censo 2010 não pergunta meio de transporte (item 3), e
   `tempo_mediano`, porque o tempo de deslocamento de 2010 só existe em cinco faixas categóricas
   (item 4) e não em minutos — não há mediana a calcular. O SQL grava `CAST(NULL AS DOUBLE)`
   explicitamente, em vez de deixar o agregador chegar a NULL por efeito colateral, e o front-end
   declara a ausência em `web/src/lib/edicoes.ts` (`recursos.modo`, `recursos.tempoMinutos`). A
   convenção é sempre `NULL`, nunca `0` ou `false`: "esta edição não mede isso" não é o mesmo que
   "o valor medido é zero". A terceira coluna do resumo pendular, `pct_diario`, existe nas duas
   edições, mas com a divergência de definição do item 2 ("retorna diariamente" em 2010 contra
   "retorna 3 ou mais dias por semana" em 2022): os valores são comparáveis em ordem de grandeza,
   não como série. Por fim, os "três achados" da capa continuam sendo calculados e publicados
   **apenas para 2022** — decisão de escopo, não limitação dos dados. O análogo de 2010 foi
   calculado só como validação interna e não é exibido na interface: 48,5% nacional e 60,4% na
   RIDE do Distrito Federal, mesma ordem de grandeza dos 46,5%/59,3% de 2022, o que confirma que o
   padrão de desconcentração residencial sem desconcentração do emprego se replica na edição
   anterior.

**Nota adicional sobre migração de retorno.** `V0626` (residência em 2005) só tem os valores
"1 – UF/Município" e "2 – País estrangeiro": ao contrário de `P0600` em 2022, não existe um
código "1 = neste município" separado de "mudou-se". Isso é possível porque `V0624` ("tempo de
moradia no município") conta os anos **desde o último retorno**, não o tempo total de residência
— alguém que sempre morou no município, saiu por um período e voltou há menos de 6 anos é
elegível para o quesito de data fixa, e sua resposta a "onde residia em 2005" pode legitimamente
ser o **próprio** município (antes de sair). O extrator (`pipeline/sql/2010/01_extract.sql`)
reconstrói o equivalente de `P0600 = 1` comparando o município relatado (`V6264`) ao município
atual: quando coincidem, `df_local = '1'` (não migrante), do mesmo jeito que 2022 trata
`P0600 = 1`. Achado e corrigido na auditoria do checkpoint F2 — antes da correção, esses ≈447 mil
registros (peso ≈ 4,08 milhões, ~21% de quem respondeu "UF/Município") eram contados como
migrantes internos com origem desconhecida, inflando `imig_ni` a ~28% da imigração (contra ~1,15%
em 2022); a matriz de fluxos (`fluxos`, `imig`, `emig`, `saldo`) nunca foi afetada, porque já
exigia `df_mun <> cd_mun` (`origem_valida`).

### Validações já realizadas (F2, edição 2010)

- Σ peso da amostra de pessoas = 190.755.799, batendo com a população total do Censo 2010 do IBGE.
- 20.635.472 registros de pessoas, 27 UFs, 5.565 municípios distintos — igual à malha.
- Join pessoas↔domicílios por `controle` (composto de área de ponderação + controle, não só
  `V0300` — ver decisão registrada no cabeçalho de `pipeline/sql/2010/01_extract.sql`): 100% de
  correspondência, 6.192.332 domicílios com `controle` distinto (chave íntegra).
- Identidade Σ imigrantes = Σ emigrantes = 13.194.730; Σ saldos = 0.
- Zero pares origem=destino em `fluxos_bruto`; 298.493 pares publicáveis.
- Σ saída pendular para trabalho = Σ entrada pendular para trabalho, exatas.
- Distribuição do coeficiente de variação dos fluxos quase idêntica à de 2022 (2010: n=298.493,
  CV mín/máx/média = 3,69%/100%/86,1%; 2022: n=326.973, 3,40%/100%/86,5%).
- Os 14 municípios com áreas de ponderação redefinidas (pacote `_14munic`, pesos recalibrados)
  substituem — não somam a — os registros equivalentes no pacote por UF.

### Validações já realizadas (F5, módulo metropolitano da edição 2010)

- **Recorte.** 81 regiões e 1.384 municípios com RM em `data/processed/2010/rm.parquet` (2022:
  1.388 em `data/processed/rm.parquet`), exatamente a diferença dos quatro municípios de 2013
  descrita no item 6. As quatro RMs afetadas — Santarém (3→2), Carbonífera (26→25), Tubarão
  (19→18) e Serra Gaúcha (14→13) — mantêm o município de origem de cada desmembramento
  (Santarém, Içara, Laguna e Bento Gonçalves), de modo que o território coberto é o mesmo.
- **Núcleos.** Cada uma das 81 regiões tem exatamente um núcleo, nenhum município pertence a mais
  de uma região, e todos os núcleos de `pipeline/rm_nucleo.csv` existem na malha de 2010.
- **Identidade da tripla.** Σ (origem → residência → trabalho) = Σ migrantes intra-RM ocupados =
  **1.394.879** em 2010 (2022: 1.571.255) — a mesma identidade estrutural verificada na edição
  2022, agora parametrizada por edição em `pipeline/tests/test_f2b_pendular.py`.
- **Decomposição da migração intrametropolitana.** `mig_intra` = núcleo→periferia +
  periferia→núcleo + periferia→periferia nas 81 regiões; zero fluxos intrametropolitanos com
  origem igual ao destino; contagem de pendulares nunca maior que a de ocupados em nenhuma célula.
- **Ordem de grandeza.** 14,6% dos migrantes intra-RM ocupados de 2010 fazem deslocamento pendular
  (2022: 12,7%) — sem salto que sugira erro de classificação, apesar das diferenças de
  questionário.
- **Ausências declaradas.** Em 2010, `pct_coletivo` e `tempo_mediano` são nulos em 100% das linhas
  onde aparecem: `rm_resumo.parquet` (0 de 81 preenchidos, contra 81 de 81 em 2022),
  `rm_mig_pendular.parquet` (`pct_coletivo`, 0 de 5.286) e `rm_mig_pendular_resumo.parquet`
  (`tempo_mediano`, 0 de 1.375). `pct_diario` está preenchido nas duas edições (81 de 81 em
  `rm_resumo`, 5.286 de 5.286 em `rm_mig_pendular`), com a divergência de definição do item 2.
- **Isolamento entre edições.** `data/processed/rm.parquet` e `data/processed/2010/rm.parquet` são
  arquivos distintos, e cada pasta tem o seu próprio `.gate_ok`, que carimba apenas os arquivos da
  própria pasta — `pipeline/verify_gate.py` exclui explicitamente das suas varreduras qualquer
  subpasta que tenha `.gate_ok` próprio ("subgate"). Gate da edição 2010 aprovado sobre os 29
  arquivos publicados (versão `1.0.0-2010`); ver `docs/relatorio_revelacao_2010_1.0.0-2010.md`.

## Edição Censo 2000 e comparabilidade com 2022 e 2010

A edição 2000 replica a mesma cadeia de processamento sobre os microdados da amostra do Censo
Demográfico 2000 (públicos, TXT de largura fixa, LRECL 390 para pessoas e 170 para domicílios),
com **data fixa 31/07/1995 → 31/07/2000**. O universo é o mesmo — pessoas de 5 anos ou mais —,
mas o quesito de data fixa tem um universo **mais largo** que o das outras duas edições: `V0424`
("onde residia em 31 de julho de 1995?") foi aplicado a todo mundo que respondeu "não" ao quesito
4.15 ("mora neste município desde que nasceu?"), sem o filtro de "menos de 6 anos no município"
que restringe `P0600` em 2022 e `V0626` em 2010. Isso não muda a estimativa — quem mora no
município há mais de 5 anos responde "neste município" de qualquer forma —, mas torna a
identificação do migrante de data fixa direta, sem a reconstrução que foi preciso fazer em 2010.
Onze diferenças de conteúdo e de recorte impedem a comparação mecânica entre as três edições e
estão registradas no SQL da edição (`pipeline/sql/2000/02_classify.sql`, `07_pendular.sql`,
`08_metro.sql`) e, coluna a coluna, em `pipeline/sql/2000/MAPEAMENTO_02_classify.md`.

> **Aviso de leitura — o fluxo pendular de estudo de 2000 é um piso, não uma estimativa do total.**
> Ele mede *menos* do que "quem estuda fora do município onde mora", e por isso não deve ser lido
> como nível. Nos dados publicados, **2,3% dos estudantes de 2000 aparecem com deslocamento
> pendular para estudo** (1.217.075 de 53.406.375 em `municipios_pendular.parquet`), contra **6,9%
> em 2010** e **7,1% em 2022** — cerca de um terço. A diferença é instrumental, não histórica, e o
> deslocamento para **trabalho** prova isso: ali o quesito é conceitualmente o mesmo nas três
> edições e as taxas ficam na mesma faixa (8,9% dos ocupados em 2000, 11,4% em 2010, 10,2% em
> 2022). As duas causas estão no quesito único 4.27 (item 1): quem trabalha **e** estuda responde
> pelo município onde trabalha — 17,2% dos estudantes de 2000 também eram ocupados, medido sobre a
> tabela classificada da edição, contra 19,9% em 2010 — e, sobretudo,
> **quem trabalha no próprio município e estuda em outro assinala "1 – neste município" e some
> inteiramente do fluxo de estudo**, mesmo sem trabalhar e estudar no mesmo lugar. Composição e
> direção do fluxo de estudo são comparáveis entre edições; nível, não.

1. **Deslocamento pendular: uma pergunta, dois universos disjuntos.** O Censo 2000 tem um único
   quesito de deslocamento, o 4.27 — "em que município e Unidade da Federação, ou país
   estrangeiro, trabalha ou estuda?" (`V4276`) —, que cobre trabalho e estudo na mesma resposta.
   O Manual do Recenseador (p. 67) resolve o empate com uma instrução literal: *"Caso trabalhe e
   estude em municípios distintos de onde mora, registre o município em que trabalha."* O
   trabalho tem precedência, e daí decorre toda a operacionalização: para quem é **ocupado**
   (10 anos ou mais, trabalho na semana de 23 a 29 de julho de 2000) a resposta é lida como
   município de trabalho e o destino de estudo fica nulo; para quem **não é ocupado**, a resposta
   só pode ser o município de estudo. Os dois módulos do pipeline (`pendular_trab`,
   `pendular_estudo`) continuam existindo, cada um sobre o seu universo, e ninguém entra nos dois.
   Duas consequências são declaradas em vez de aproximadas: (a) o fluxo pendular de **estudo** de
   2000 é um **piso**, não uma estimativa do total, porque exclui todos os estudantes que também
   trabalham; (b) o piso é ainda mais baixo do que isso, porque a quadrícula "1 – neste município"
   vale "caso a pessoa trabalhe **ou** estude no município de residência" — quem trabalha onde
   mora e estuda em outro município assinala "neste município" e desaparece do fluxo. Os números
   de saída/entrada para estudo de 2000 são comparáveis às outras edições em **composição e
   direção**, nunca em nível; a magnitude do piso está quantificada no aviso de leitura acima.
   O fluxo pendular de **trabalho**, esse, é conceitualmente o mesmo
   das três edições. O quesito 4.27 também não tem os equivalentes de `P1120 = 1` ("em casa ou na
   propriedade") nem de `P1120 = 5` ("mais de um município"): trabalho no domicílio não se separa
   de trabalho no município, e `varios_municipios` sai zerado.
2. **Salário mínimo e renda.** O salário mínimo de referência é o de julho de 2000, R$ 151,00, e
   — como em 2010 — o rendimento do trabalho principal já é divulgado **em número de salários
   mínimos** (`V4514`), de modo que os cortes relativos (1, 2, 3 e 5 SM) são aplicados
   diretamente, sem deflator nem conversão. A **renda domiciliar per capita**, porém, não existe
   pronta no Censo 2000 (2010 tem `V6532`; 2022 tem `D0360`) e é construída aqui. A construção
   ingênua está errada: `V7617` (rendimento domiciliar em SM) já exclui do numerador, por
   definição do IBGE, "as pessoas consideradas na condição do domicílio como pensionistas,
   empregados domésticos e parentes dos empregados domésticos", enquanto `V7100` ("total de
   moradores") as inclui. Dividir um pelo outro subestimaria a renda per capita justamente nos
   domicílios com empregado doméstico residente ou pensionista. O denominador usado é, portanto,
   a contagem de moradores com `V0402` fora de {09 pensionista, 10 empregado doméstico, 11
   parente do empregado doméstico}, obtida do arquivo de pessoas — o que reproduz a convenção do
   IBGE e mantém os cortes (1/4, 1/2, 1 e 2 SM) comparáveis às outras edições. Domicílio coletivo
   fica nulo (`nao_aplicavel`), como nas demais.
3. **Status migratório reduzido, igual ao de 2010.** O Censo 2000 não coleta o município de
   nascimento: o quesito 4.21 pergunta apenas a Unidade da Federação ou o país (`V4210`, um
   código sequencial). Sem comparar o município natal com o de residência em 1995 é impossível
   separar `primeira_saida` de `etapas_multiplas`, e as duas colapsam em `nao_natural` — a mesma
   ausência de 2010, e não uma escolha de conveniência. O que 2000 tem **a mais** que 2010 no
   bloco de naturalidade não cria categoria nova: `V0417` ("nasceu neste município") e `V0418`
   ("nasceu nesta UF") são dois quesitos onde 2010 tinha um de três valores (`V0618`), mas o
   resultado é o mesmo local de nascimento em três níveis (este município / outro município do
   Brasil / exterior). Por consistência, o vocabulário publicado é idêntico ao de 2010
   (`retorno_natal`, `nao_natural`, `nascido_exterior`, mais os internacionais e a origem não
   informada), registrado em `STATUS_POR_EDICAO` e no seletor do front-end. Como em 2010,
   `retorno_natal` é medido pelo próprio quesito e não por inferência: entre migrantes
   (`V0415 = 2`), "nasceu neste município" só pode vir de `V0417 = 1`. Há uma subcontagem
   conhecida de `nascido_exterior`: o Manual manda registrar "Brasil" em 4.21 para os brasileiros
   natos nascidos em país estrangeiro, que assim caem em `nao_natural` — em 2022, `P0480 = 3` os
   captura. Por fim, 2000 tem uma informação que as outras duas edições não têm e que **não** é
   aproveitada: `V0424` distingue a zona **urbana** da **rural** da residência de 1995. Publicá-la
   criaria um eixo sem par nas demais edições; fica registrada como material disponível para
   análise futura, não como coluna do contrato.
4. **Escolaridade a partir de anos de estudo.** O Censo 2000 não tem variável de nível de
   instrução pronta (2022: `P0770`; 2010: `V6400`). `nivel_instr_4` é derivado de `V4300`
   ("anos de estudo", calculada pelo IBGE para toda a população), com os cortes clássicos do
   instituto: 0–7 anos e alfabetização de adultos → sem instrução e fundamental incompleto;
   8–10 → fundamental completo e médio incompleto; 11–14 → médio completo e superior incompleto;
   15–17 → superior completo; "não determinado" → `nao_determinado`. Descartou-se a alternativa
   aparentemente mais fina (`V0432` curso mais elevado frequentado + `V0434` conclusão +
   `V4355` curso concluído) porque essas variáveis são **brancas para os estudantes**: usá-las
   zeraria a escolaridade justamente de quem ainda estuda aos 25 anos ou mais (EJA, graduação,
   pós-graduação), que é a ponta mais seletiva da migração. A aproximação conhecida é que uma
   graduação de três anos totaliza 14 anos de estudo e cai em "médio completo e superior
   incompleto", de modo que `superior_completo` em 2000 fica ligeiramente subestimado frente a
   2010 e 2022, onde a variável de nível vem do curso concluído e não da contagem de anos.
5. **Sem tempo, sem frequência e sem modo de deslocamento.** O bloco de deslocamento de 2000 é o
   quesito 4.27 e nada mais. Não há meio de transporte (como em 2010), não há tempo gasto — nem
   em minutos, como em 2022, nem em faixas categóricas, como em 2010 — e **não há quesito algum
   de frequência de retorno**. Esta última é a divergência frente a 2010, que tinha `V0661`
   ("retorna do trabalho para casa diariamente"): em 2000, `pct_diario` é sempre nulo, ao lado de
   `pct_coletivo` e `tempo_mediano`. As dimensões `modo`, `tempo` e `frequencia` não são
   publicadas em `pendular_trab_dim.parquet` — publicar uma dimensão cujas categorias são todas
   "ignorado" sugeriria dado que não existe —, e restam seis (`posicao`, `setor`, `ocupacao`,
   `renda_trab`, `edu`, `idade_sexo`). A convenção é sempre `NULL` explícito
   (`CAST(NULL AS DOUBLE)`), nunca `0` nem `false`: "esta edição não mede isso" não é o mesmo que
   "o valor medido é zero".
6. **Malha municipal e recortes.** A edição usa a malha de 2000, com **5.507 municípios**. As
   regiões geográficas imediatas e intermediárias (divisão de 2017) e o recorte metropolitano
   (as 81 RMs/RIDEs do dicionário de 2022, `COD_CATMETROPOL`) são aplicados retroativamente por
   código de município, exatamente como em 2010 e pelas mesmas razões — navegabilidade entre
   edições ao custo de um anacronismo territorial explícito, em vez do recorte metropolitano do
   próprio Censo 2000 (`V1004`, 29 unidades, de composição municipal diferente). Verificado:
   **todos os 5.507 municípios de 2000 têm par em `labels.RECORTES`**, resultando em 510 regiões
   imediatas e 133 intermediárias — os mesmos números de 2010 e de 2022. O recorte metropolitano
   cobre **1.382 municípios em 2000**, contra 1.384 em 2010 e 1.388 em 2022, e as 81 regiões
   continuam todas com pelo menos um município. Os seis municípios com RM em 2022 que não
   existiam em 2000 são os quatro instalados em 2013, já descritos no item 6 da seção de 2010
   (Mojuí dos Campos, Pescaria Brava, Balneário Rincão e Pinto Bandeira), mais Mesquita/RJ
   (desmembrado de Nova Iguaçu, instalado em 2001) e Nazária/PI (desmembrado de Teresina,
   instalado em 2009). Em todos os seis casos o município de origem do desmembramento é membro da
   mesma região, de modo que as seis RMs afetadas — Rio de Janeiro (22→21), Grande Teresina
   (13→12), Carbonífera (26→25), Tubarão (19→18), Santarém (3→2) e Serra Gaúcha (14→13) —
   aparecem em 2000 com um município a menos **sobre o mesmo território**. O questionário ajuda:
   o Manual manda considerar como "sempre morou neste município" quem "reside na mesma área
   territorial onde sempre morou, mesmo que esta tenha mudado de nome ou se emancipado ou
   incorporado a um novo município", e manda registrar em 4.25 o **nome atual** do município de
   1995 — não há, portanto, harmonização territorial 1995→2000 a fazer nos códigos de origem.
7. **Origem "UF sem especificação".** O equivalente do `UF‖99999` de 2010 e do `8888888`/`9999999`
   de 2022 existe em 2000 com uma forma traiçoeira: são 27 códigos de sete dígitos com dígito
   verificador válido, que **parecem municípios reais** — `1100001` ("Rondônia – sem
   especificação"), `3500006` ("São Paulo – sem especificação"), …, mais `5400007` ("Brasil – sem
   especificação", o caso em que nem a UF é conhecida). O Distrito Federal não tem código próprio,
   por ter um único município. O teste estrutural usado é `SUBSTR(codigo, 3, 4) = '0000'`,
   verificado contra a lista dos 5.507 municípios de 2000 sem nenhuma colisão, e vale tanto para a
   origem (`V4250`) quanto para o destino pendular (`V4276`). O tratamento é o mesmo das outras
   edições: esses registros contam na imigração total do destino, mas ficam fora da matriz
   origem→destino e do cômputo de emigração. No nível da UF, a sentinela correspondente é `'54'`.
8. **Posição na ocupação: estatutários e militares só aparecem com duas variáveis.** `V0447`
   ("nesse trabalho era…") tem nove categorias e **não** tem uma para servidor estatutário ou
   militar: eles foram codificados como "empregado sem carteira de trabalho assinada" e só se
   separam por `V0448` ("era empregado pelo RJU ou como militar"), perguntada exclusivamente a
   quem recebeu aquele código. Sem `V0448`, todo o funcionalismo estatutário e as Forças Armadas
   entrariam em `empregado_sem_carteira`, inflando a informalidade medida em vários pontos
   percentuais — em 2010 e 2022 a distinção já vem pronta na própria variável de posição.
9. **Setor de atividade e grupo ocupacional usam classificações de 2000.** `setor_grupo` vem da
   CNAE-Domiciliar 1.0 (`V4462`, classe de cinco dígitos, seções A–Q), e não da CNAE-DOM 2.0 de
   2010: o princípio do crosswalk é o mesmo das duas edições anteriores — agregar por seção, e
   mapear as seções para os mesmos oito grupos publicados —, com uma única exceção que não se
   resolve no nível da divisão. A divisão 64 da CNAE-Dom 1.0 junta correio e telecomunicações, que
   nas classificações posteriores moram em seções diferentes (correio em transporte,
   telecomunicações em informação e comunicação); ela é aberta na classe de cinco dígitos, com
   `64010` em `transporte_logistica` e `64020` em `servicos_empresariais`. `ocup_grupo` vem da
   CBO-Domiciliar 2000 (`V4452`), cujo grande grupo é o primeiro dígito — mas os grandes grupos
   **não** são os da ISCO-08 usada em 2010 e 2022. O grande grupo 9 de 2000 é "trabalhadores de
   reparação e manutenção", não "ocupações elementares": mapeá-lo por simetria de dígito
   rotularia mecânicos, eletricistas e reparadores como ocupações elementares, então ele é
   agregado ao grupo de construção, artes mecânicas e ofícios. A consequência é maior do que uma
   classe. A categoria "ocupações elementares" fica **estruturalmente vazia** em 2000 (não é zero
   por acaso), e a massa que em 2010 e 2022 está nela reaparece em 2000 **espalhada por três
   classes**, porque a CBO-Dom 2000 aloca os trabalhadores domésticos no grande grupo 5 (serviços
   e vendedores), os trabalhadores agrícolas sem qualificação no 6 (agropecuária) e os serventes e
   ajudantes de obra e de produção no 7 (indústria, construção e operadores) — os mesmos três que
   a ISCO-08 junta em "elementares". Nos deslocamentos pendulares para trabalho publicados
   (`pendular_trab_dim.parquet`, dimensão `ocupacao`), as três sobem exatamente nesse padrão de
   2010 para 2000: serviços e vendedores de 15,2% para **31,5%**, indústria/construção/operadores
   de 21,7% para **29,6%** e agropecuária de 0,5% para **1,3%** — contra os 17,5% de "elementares"
   que somem. Nenhuma das três é comparável **em nível** com a classe de mesmo nome em 2010 ou
   2022; a tabela completa das oito classes nas três edições está em
   `pipeline/sql/2000/MAPEAMENTO_02_classify.md`, §8.
10. **Nível do curso frequentado inclui pré-vestibular.** `V0430` tem treze códigos contra onze
    de 2022 e doze de 2010, e a diferença conceitual está em duas pontas. Na de baixo, o
    pré-vestibular **conta como frequência à escola** no Censo 2000 e não conta em 2010 nem em
    2022 — o que torna o universo `estudante` de 2000 marginalmente mais largo —, e ele ganha
    categoria própria (`pre_vestibular`) em vez de ser dobrado em "médio", o que colocaria naquela
    faixa gente que já concluiu o médio (o Manual manda registrar ensino médio para quem cursa os
    dois ao mesmo tempo, de modo que o código 11 é o cursinho puro). Na de cima, `pos_graduacao`
    em 2000 é mais estreita: mestrado e doutorado vêm num único código e a especialização não é
    considerada frequência à escola.
11. **Marcas de imputação.** Diferente de 2010, o Censo 2000 traz marcas de imputação para as
    variáveis de migração e de deslocamento (`M0424`, `M4250`, `M4276`), e elas são carregadas nas
    colunas `imp_df_local`, `imp_df_mun` e `imp_trab_mun` do contrato. O vocabulário de marcas é
    próprio da edição (sem imputação, NIM/IMPS e os estágios PRÉ-DIA/DIA/SPLUS da crítica) e não é
    comparável valor a valor com o de 2022; são colunas de QA interno, nunca publicadas.

**Nota sobre o desenho amostral e o estimador de variância.** O desenho de 2000 é da mesma família
do de 2010 e do de 2022, e o estimador de variância do atlas é reaproveitável sem alteração
conceitual. A amostra é uma seleção sistemática e equiprovável de **domicílios** dentro de cada
setor censitário, com fração amostral constante por município — 10% nos municípios com população
estimada acima de 15.000 habitantes e 20% nos demais. A expansão usa pesos calibrados pelo método
dos **Mínimos Quadrados Generalizados** (proposta de Bankier), com limites impostos aos pesos
finais (mínimo 1; máximo 25 ou 50 conforme a fração amostral), aplicados **independentemente em
cada área de ponderação** — 9.336 delas no país, cada uma contida em um único município e com no
mínimo 400 domicílios particulares ocupados na amostra. O peso é atribuído ao domicílio e
replicado em cada morador. Isso é exatamente a estrutura que o estimador de conglomerados últimos
do atlas assume — domicílio como unidade primária, área de ponderação como estrato — e é o mesmo
arranjo de 2010 e 2022, de modo que `03_indicators.sql` e os blocos de variância de
`07_pendular.sql` e `08_metro.sql` valem para 2000 sem adaptação. Continua valendo a ressalva do
IBGE de que a expansão da amostra pode divergir do universo: "é possível a ocorrência de
divergência entre o valor do número de pessoas calculado através da expansão da amostra e o valor
verificado no universo, para alguns municípios", sobretudo onde a fração amostral de domicílios e
a de pessoas se desequilibram — o que se confirmou em escala nacional: a Σ `pop` publicada de 2000
é 169.872.795 contra 169.799.170 do universo, +0,04%. O reaproveitamento do estimador não ficou em
argumento de plausibilidade: a distribuição do coeficiente de variação dos fluxos de 2000 saiu
praticamente colada à de 2010 e à de 2022 (ver "Validações realizadas (F6, edição Censo 2000)"),
que é o mesmo teste que autorizou a reutilização entre 2022 e 2010.

**Nota sobre a definição de migrante.** A documentação do Censo 2000 registra explicitamente o que
fica de fora: *"Não foi considerada como migrante a pessoa que se ausentou temporariamente do
município por motivo de freqüência a escola, tratamento de saúde, assistência a parente ou
conhecido, serviço militar, estágio profissional, bolsa de estudo, tarefa de trabalho agrícola,
retornando logo após haver cessado o motivo do afastamento. Também não foram consideradas como
migrantes as pessoas residentes na mesma área em que nasceram, embora esta tenha mudado de nome
[…]"*. A segunda cláusula é a mesma harmonização territorial implícita já mencionada no item 6; a
primeira é a razão pela qual migração e pendularidade são módulos distintos e não se somam.

### Validações realizadas (F6, edição Censo 2000)

Todas rodadas sobre `data/processed/2000/**` — os dados já publicados e aprovados no gate —, de
modo que os números abaixo são os dos arquivos que o site consome, já com o arredondamento das
regras de revelação. A lista de checagens acordada antes da extração está em
`pipeline/sql/2000/MAPEAMENTO_02_classify.md`, §12.

- **Recortes territoriais.** 5.507 municípios, 27 UFs, **510 regiões imediatas** e **133 regiões
  intermediárias** em `municipios_ref.parquet` — exatamente os mesmos 510/133 de 2010 e de 2022,
  sem nenhum município sem par em `labels.RECORTES`.
- **Recorte metropolitano.** **81 regiões** e 1.382 municípios com RM em `rm.parquet` (2010: 1.384;
  2022: 1.388 — a diferença dos seis municípios descrita no item 6). Cada uma das 81 regiões tem
  **exatamente um núcleo**, e nenhum município pertence a mais de uma região.
- **Ausências declaradas (`NULL`, nunca zero).** `pct_coletivo`, `tempo_mediano` e `pct_diario` são
  nulos em 100% das linhas onde aparecem: `rm_resumo.parquet` (0 de 81 preenchidos nas três
  colunas — contra 81 de 81 nas três em 2022 e 81 de 81 em `pct_diario` em 2010),
  `rm_mig_pendular.parquet` (`pct_coletivo` e `pct_diario`, 0 de 4.784),
  `rm_mig_pendular_resumo.parquet` (`tempo_mediano`, 0 de 1.368) e `pendular_trab.parquet` (as
  três, 0 de 12.651). `varios_municipios` é 0 nos 5.507 municípios de
  `municipios_pendular.parquet`, como previsto no item 1; na mesma tabela `trabalha_exterior` soma
  42.345, o que mostra que o zero de `varios_municipios` é a categoria inexistente do quesito 4.27
  e não uma coluna que deixou de ser preenchida.
- **Dimensões pendulares.** `pendular_trab_dim.parquet` publica exatamente as **seis** dimensões
  previstas no item 5 — `posicao`, `setor`, `ocupacao`, `renda_trab`, `edu`, `idade_sexo` — sem
  `modo`, `tempo` nem `frequencia` (2010 publica oito, 2022 nove). Na dimensão `ocupacao`, a
  categoria `'09'` ("ocupações elementares") aparece em **zero** linhas, confirmando a ausência
  estrutural do item 9.
- **Fechamento da migração.** 52.655 pares publicados em `fluxos.parquet` (2010: 52.895; 2022:
  53.097), **zero** deles com origem igual ao destino. Σ imigrantes = **14.570.995** e Σ emigrantes
  = **14.570.835** em `municipios.parquet`, com Σ saldos = 25: a identidade fecha até o
  arredondamento do gate — a diferença é de 160 sobre 14,6 milhões (0,001%), porque as regras de
  revelação arredondam cada célula a múltiplos de 5 antes de gravar. O mesmo resíduo aparece nas
  edições já publicadas (2010 fecha em −105 e Σ saldos = −90; 2022 em +170 e Σ saldos = +45); a
  identidade exata é verificada antes da publicação, sobre as tabelas intermediárias.
- **Fechamento do pendular.** Σ saída pendular para trabalho = 5.808.625 e Σ entrada = 5.808.535
  (resíduo de 90, mesma origem); para estudo, 1.217.075 e 1.217.375.
- **População.** Σ `pop` = **169.872.795**, contra 169.799.170 do universo do Censo 2000: +0,04%,
  dentro da divergência de expansão que o próprio IBGE declara. Σ `pop5` — o universo do atlas,
  5 anos ou mais — = 153.486.695.
- **Precisão.** A distribuição do coeficiente de variação dos fluxos publicados é praticamente a
  mesma das outras duas edições: 2000, n = 52.655, CV mín/mediana/média/máx =
  2,26%/48,62%/47,86%/92,76%; 2010, n = 52.895, 3,69%/47,63%/47,27%/90,98%; 2022, n = 53.097,
  3,40%/46,18%/45,84%/94,25%. É a evidência empírica que faltava para estender ao Censo 2000 o
  reaproveitamento do estimador de variância (aviso 4 de `docs/EDICOES.md`) — verificado, não
  presumido.
- **Piso do fluxo de estudo.** 2,28% dos estudantes com saída pendular para estudo em 2000, contra
  6,94% em 2010 e 7,09% em 2022; para trabalho, 8,85% / 11,38% / 10,20%. Ver o aviso de leitura no
  início desta seção.
- **Gate de revelação.** `data/processed/2000/.gate_ok` carimba **29 arquivos** na versão
  **`1.0.0-2000`**, e `python pipeline/verify_gate.py --dir data/processed/2000` **aprova sem
  microdados**: os 29 SHA-256 conferem, nenhum CSV em `data/processed`, nenhuma coluna de domicílio
  ou de área de ponderação nos 22 parquets, nenhuma contagem amostral exata (só `*_faixa`, todas
  dentro do conjunto de faixas permitido) e todas as contagens ponderadas em múltiplos de 5.
  Relatório: `docs/relatorio_revelacao_2000_1.0.0-2000.md`.

## Edição Censo 1991 e comparabilidade com 2022, 2010 e 2000

A edição 1991 é a quarta do atlas e a primeira que exigiu **reconstruir o insumo antes de
processá-lo**. Os microdados da amostra do Censo Demográfico 1991 são públicos, mas chegam em 27
arquivos **DBF** (dBase III, um por Unidade da Federação), não nos TXT de largura fixa das edições
posteriores: o pipeline converte cada DBF para texto de largura fixa (492 bytes de dados por
registro, descartando os registros marcados como excluídos no próprio DBF) antes de qualquer SQL,
em `scripts/prep_1991.py`. A referência de data fixa é **01/09/1986 → 01/09/1991**, um quinquênio
exato como nas outras três edições, e o universo é o mesmo — pessoas de 5 anos ou mais. As
divergências de conteúdo estão registradas no cabeçalho de `pipeline/sql/1991/02_classify.sql` e,
coluna a coluna, em `pipeline/sql/1991/MAPEAMENTO_02_classify.md`.

Duas características do arquivo de 1991 não têm paralelo nas edições mais novas e condicionam tudo
o que vem depois. A primeira é que **há um único arquivo por UF, com as variáveis de domicílio
replicadas em cada linha de pessoa** — não existe o par pessoas/domicílios de 2000, 2010 e 2022, e
tampouco existe **chave de domicílio**: o DBF não traz identificador, apenas `PESSOAN`, o número de
ordem da pessoa dentro do domicílio. A chave é reconstruída como um contador que avança a cada
`PESSOAN = 1` e é verificável contra a documentação pública: o `LEIA_ME.DOC` do DVD declara, UF a
UF, quantos domicílios e quantas pessoas cada arquivo contém, e a contagem reconstruída bate (em
Roraima, 5.486 domicílios e 23.102 pessoas). Nacionalmente ela produz **4.024.553 domicílios** para
**17.045.712 pessoas** — 4,24 pessoas por domicílio —, número que fecha por uma segunda via
independente: 4.024.553 = 3.971.593 chefes (`PARENDOM = 1`) + 52.960 moradores "individual"
(`PARENDOM = 20`). Essa chave é a unidade primária de amostragem do estimador de variância e o
denominador da renda per capita; sem ela, nenhum dos dois existe.

A segunda é que **a edição 1991 não tem deslocamento pendular**. O questionário da amostra não
pergunta em que município a pessoa trabalha ou estuda — o quesito que sustenta todo o módulo
pendular em 2000, 2010 e 2022 simplesmente não foi feito. A edição publica os módulos de migração
(indicadores municipais, matriz de fluxos, recortes territoriais, migração intrametropolitana) e
**não publica nenhuma tabela pendular nem o cruzamento migração × pendularidade** do módulo
metropolitano. Isso está declarado em `pipeline/edicoes.py` pela flag `pendular = False` — que
remove o módulo inteiro, e é distinta de `rotulos_pendular`, que só apaga dimensões *dentro* de um
módulo pendular existente — e no front-end, que esconde os recursos ausentes em vez de exibir
tabela vazia. Uma armadilha a registrar: `LOCTRAB` ("local de trabalho") **não é** o município de
trabalho — é o *tipo* de local (no domicílio, via pública, propriedade agropecuária, empresa,
casa do cliente, outro) — e não deve ser usado como proxy de pendularidade em nenhuma
circunstância.

1. **O Censo 1991 tem o município de origem da migração de data fixa — correção de um registro
   anterior deste projeto.** Até esta edição, `docs/EDICOES.md` (aviso 2) e o plano do atlas
   registravam, por antecipação, que o Censo 1991 perguntaria "apenas a UF ou o país" de residência
   cinco anos antes, e que isso "inviabiliza a matriz origem→destino municipal como ela existe hoje
   e pode restringir a edição aos níveis UF/RGInt". **A premissa estava errada e fica corrigida
   aqui e em `docs/EDICOES.md`.** O Censo 1991 coleta o par completo — `MIMO86UF` (a UF, o país ou
   "neste município" de residência em 01/09/1986) e `MIMO86MU` (o município, dentro daquela UF),
   sob a pergunta "onde morava em 01/09/1986" —, de modo que a **matriz origem→destino municipal de
   1991 é publicável** e a edição tem os mesmos níveis de agregação das outras três. Duas
   particularidades de leitura: o código de origem é `MIMO86UF ‖ MIMO86MU` (o município é referido
   à UF de 1986, nunca à de residência), e o quesito só foi feito a quem **não** respondeu "sempre
   morou neste município" e só a partir de 5 anos de idade — o **branco é o salto do questionário,
   não uma não-resposta**, o que foi confirmado num cruzamento nacional exaustivo entre data fixa,
   naturalidade e idade (nenhum registro com data fixa em branco, 5 anos ou mais e naturalidade
   diferente de "sempre morou"; nenhum registro com "sempre morou" e data fixa preenchida). Há
   ainda a armadilha já conhecida das outras edições: `MIANMOMU` ("anos que mora no município"),
   `MIANMOUF` e `MIULTMUD` ("última mudança") **não** identificam o migrante de data fixa — contam
   tempo desde a última mudança ou o último retorno, exatamente como `V0416` em 2000 e `V0624` em
   2010.
2. **Origem não informada é `NULL`, não código-sentinela.** "Brasil sem especificação", "ignorado"
   e o município "sem especificação" dentro de uma UF conhecida não vivem, em 1991, no espaço de
   códigos de município — fabricar um código de sete dígitos inexistente na malha criaria um valor
   capaz de vazar para a matriz num `JOIN` mal guardado. Por isso, ao contrário de 2010 (`UF‖99999`)
   e de 2000 (códigos com `SUBSTR(cod,3,4) = '0000'`), a edição 1991 grava `df_uf`/`df_mun` como
   `NULL` e as derivadas testam `IS NOT NULL`. O tratamento a jusante é o mesmo das outras edições:
   esses registros contam na imigração total do destino (`imig_ni`), mas ficam fora da matriz
   origem→destino e do cômputo de emigração. Nos dados publicados são **460.890 pessoas, 3,3% dos
   13.916.955 migrantes internos de data fixa**.
3. **Status migratório reduzido, como em 2010 e 2000.** O Censo 1991 não coleta o município de
   nascimento: `MINASCMU` pergunta se a pessoa nasceu no município de residência e, em caso
   negativo, só a UF ou o país (`MIUFPAIS`). Sem o município natal é impossível separar
   `primeira_saida` de `etapas_multiplas`, e as duas colapsam em `nao_natural` — a mesma ausência
   de 2010 e 2000, e não uma escolha de conveniência. O vocabulário publicado é idêntico ao dessas
   duas edições (`retorno_natal`, `nao_natural`, `nascido_exterior`, mais os internacionais e a
   origem não informada), registrado em `pipeline/disclosure_rules.STATUS_POR_EDICAO` e no seletor
   do front-end. Como lá, `retorno_natal` é **medido pelo próprio quesito e não inferido**: entre
   migrantes de data fixa, "nasceu neste município" só pode vir da resposta "nasci aqui, mas já
   morei em outro lugar". A composição publicada dos imigrantes de 1991 é `nao_natural` **90,2%**,
   `retorno_natal` **9,4%**, `nascido_exterior` 0,3% e `outros` 0,1% (`municipios_dim.parquet`,
   direção `imig`, sobre os 13.456.065 imigrantes com origem informada). Duas notas: a UF de
   nascimento vem num **código sequencial de 1 a 27**, não no código do IBGE, e o dicionário do
   próprio IBGE traz "SE" duas vezes (posições 15 e 16, quando a 16 é a Bahia) — erro corrigido na
   tabela de conversão gerada em `pipeline/labels_1991.py`; e permanece a **subcontagem de
   `nascido_exterior`** já descrita em 2000, porque brasileiros natos nascidos no exterior são
   instruídos a registrar "Brasil" na pergunta de naturalidade.
4. **Duas informações exclusivas de 1991 que não são publicadas.** A primeira é a **residência
   imediatamente anterior** (`MIANTEUF`/`MIANTEMU`, UF e município), um conceito de "última etapa"
   que 2000, 2010 e 2022 não têm no contrato publicado; a segunda é a **zona urbana ou rural da
   moradia em 1986** (`MIMO86ZN`), análogo exato do `V0424` de 2000. Nenhuma das duas vira coluna
   do contrato: publicar a última etapa criaria um eixo sem par em qualquer outra edição e deixaria
   ambíguo qual é "a" origem de um migrante de 1991 — o atlas passaria a ter dois conceitos de
   origem convivendo num único seletor. As duas ficam registradas como material disponível para
   análise futura.
5. **Raça/cor existe no microdado e não é publicada.** `RACACOR` está no arquivo de 1991 e bem
   preenchida, mas o contrato de 49 colunas de `pessoas_classificado.parquet` **não tem dimensão de
   raça/cor em nenhuma das três edições já publicadas**. Introduzi-la só em 1991 quebraria o
   contrato de esquema, daria um recorte disponível numa edição e ausente nas outras e exigiria
   calibrar as regras R1–R9 para uma dimensão nova. A decisão é de escopo, não de disponibilidade:
   se o atlas quiser essa dimensão, ela entra por todas as edições de uma vez.
6. **Escolaridade derivada de anos de estudo.** Como em 2000, 1991 não tem variável de nível de
   instrução pronta, e `nivel_instr_4` é derivado de `EDANOEST` ("anos de estudo", calculada pelo
   IBGE para toda a população), com os cortes clássicos do instituto e idênticos aos de 2000: 0–7
   anos e **alfabetização de adultos** → sem instrução e fundamental incompleto; 8–10 →
   fundamental completo e médio incompleto; 11–14 → médio completo e superior incompleto; 15–17 →
   superior completo. A alfabetização de adultos vai para a primeira classe, e não para
   `nao_determinado`, pela mesma razão de 2000 — é categoria conhecida, e mandá-la para "não
   determinado" a misturaria com a desconhecida e criaria divergência artificial entre edições.
   Vale a mesma aproximação já declarada lá: uma graduação de três anos totaliza 14 anos de estudo
   e cai em "médio completo e superior incompleto", subestimando ligeiramente `superior_completo`
   frente a 2010 e 2022. Nos dados publicados, `nao_determinado` é uma categoria praticamente
   vazia em 1991 (255 pessoas entre os imigrantes, 0,004%) e por isso aparece **100% `NULL` em
   `fluxos.parquet`**: em todos os pares publicados ela cai abaixo do limiar R1 e é absorvida por
   `edu__outros` pela supressão complementar R3.
7. **Salário mínimo de referência: Cr$ 36.161,60, recuperado por reconciliação com as faixas do
   IBGE.** Esta é a primeira edição do atlas em que **a renda não vem pronta em número de salários
   mínimos**: em 2010 e 2000 o IBGE divulga o rendimento já convertido; em 1991, tanto o rendimento
   da ocupação principal (`RPRINCIV`) quanto o rendimento domiciliar (`RDOMICIV`) estão em
   **Cruzeiros correntes**, e o atlas precisa de um divisor para manter os cortes de renda (1/4,
   1/2, 1 e 2 SM na renda per capita) comparáveis entre edições. O valor foi obtido por
   reconciliação com as faixas que o próprio IBGE calculou e divulgou ao lado dos valores brutos —
   treze faixas de salário mínimo para o rendimento individual (`RPRINCIF`) e onze para o
   domiciliar (`RDONOMIF`): **Cr$ 36.161,60 reproduz as 13 faixas individuais e as 11 domiciliares**
   (24 limites ao cruzeiro), enquanto Cr$ 17.000,00 e Cr$ 42.000,00 reproduzem uma de treze cada.
   Pelo lado do domicílio a reconciliação crava o centavo: a faixa que termina em Cr$ 36.161 é
   seguida pela que começa em Cr$ 36.164. Nenhum deflator é aplicado — os cortes do atlas são
   relativos ao salário mínimo de cada censo, e é isso que os torna comparáveis apesar do Cruzeiro,
   do Real e da inflação do período.
   **Ressalva de procedência, revista em F7.7 e mais forte do que a registrada antes.** O valor é
   **derivado dos microdados**, por concordância com duas variáveis de faixa independentes
   construídas pelo IBGE, e **não é o salário mínimo legal vigente na data de referência do censo**
   — ao contrário do que o rascunho desta seção e o comentário de `pipeline/edicoes.py` afirmavam.
   A conferência externa feita em F7.7 (série `MTE12_SALMIN12` do Ipeadata, convertida de Real para
   Cruzeiro pelos divisores oficiais de 1993 e 1994) dá **Cr$ 17.000,00 de março a agosto de 1991 e
   Cr$ 42.000,00 a partir de 1º de setembro de 1991** — nenhum dos dois é 36.161,60. A leitura
   correta é, portanto, que Cr$ 36.161,60 é o **valor de referência implícito nas próprias faixas
   de rendimento do Censo 1991** (plausivelmente um valor médio ou corrigido, adotado pelo IBGE ao
   classificar os rendimentos), e não a norma salarial do mês. Para o atlas isso é o que interessa:
   é o divisor que faz os cortes relativos da edição coincidirem com as classes de rendimento que
   o IBGE publicou para 1991 — usar Cr$ 42.000,00 deslocaria todos os cortes em cerca de 16% e
   descolaria a edição das tabulações oficiais. Fica registrado que a origem documental exata do
   valor (qual norma ou qual média o IBGE aplicou) **não foi localizada**, e que a evidência que
   sustenta a escolha é interna: 24 de 24 limites de faixa reproduzidos.
8. **Renda domiciliar per capita: a armadilha de 2000, aqui verificada e não herdada.** Como em
   2000, 1991 não publica rendimento domiciliar per capita, e a construção ingênua está errada —
   mas em 1991 foi possível **demonstrá-lo**. Comparando `RDOMICIV` com a soma dos rendimentos
   individuais dos moradores, a identidade fecha em **100% dos domicílios particulares** quando se
   excluem da soma pensionistas, empregados domésticos residentes e parentes de empregados
   domésticos; incluindo-os, fecha em 98,6% e, entre os domicílios que de fato têm alguma dessas
   pessoas, em apenas 7 de 75. O numerador do IBGE exclui esses moradores, e o denominador tem de
   excluí-los também, sob pena de subestimar a renda per capita exatamente nos domicílios de renda
   mais alta. O denominador usado é a contagem de moradores fora daquelas três categorias, obtida
   por agregação da chave de domicílio reconstruída. Domicílio coletivo fica nulo
   (`nao_aplicavel`), como nas demais edições.
9. **Estrato de variância aproximado: município × situação urbano/rural.** **O Censo 1991 não tem
   área de ponderação** — ela é o estrato do estimador de conglomerados em último estágio que o
   atlas usa desde 2022 e existe nas outras três edições (em 2000, 9.336 áreas, cada uma contida
   num único município). Em 1991 o estrato adotado é **`cd_mun` × situação do setor censitário**:
   setores urbanizados, não urbanizados e urbanizados isolados formam o estrato urbano do
   município; aglomerados rurais e área rural, o rural. A variável de situação está sempre
   preenchida e sempre dentro do intervalo válido, e valida de quebra o peso amostral — a proporção
   ponderada de população urbana resultante é **75,60%**, contra os 75,59% publicados pelo IBGE para
   1991. O resultado são **8.939 estratos**, mesma ordem de grandeza das 9.336 áreas de 2000, com
   mediana de 877 registros por estrato e **um único** estrato com menos de cinco registros. **Isto
   é uma aproximação declarada**: não é a partição do desenho amostral do IBGE, os pesos de 1991 não
   foram calibrados nela, e o estrato é mais heterogêneo que uma área de ponderação real — o que
   tende a **inflar** a variância estimada, ou seja, a errar para o lado conservador. A validação
   empírica está na lista de validações abaixo ("Precisão"); o resultado foi **aprovar o
   reaproveitamento do estimador**, publicando `se` e `cv` normalmente, com a ressalva de que a
   precisão de 1991 é sistematicamente um pouco pior que a de 2000 em amostras comparáveis.
10. **Recortes territoriais e o maior anacronismo do atlas.** O Brasil de 1991 tinha **4.491
    municípios**; o de 2022 tem 5.572. Como nas edições anteriores, os recortes de 2022 — Regiões
    Geográficas Imediatas, Intermediárias e o recorte metropolitano — são aplicados retroativamente
    **por código de município**, para que os níveis de agregação da interface sejam navegáveis entre
    censos. A relação entre as malhas é limpa num sentido e pesada no outro: **todos os 4.491
    municípios de 1991 têm par em `labels.RECORTES`** (nenhum extinto, nenhum código alterado), mas
    **1.082 códigos de 2022 não existem em 1991** — 1.079 municípios publicados mais três códigos
    da malha que não são municípios —, quase todos criados por desmembramento depois de 1991.
    Contra 6 municípios sem par em 2000 e 4 em 2010, é um salto de duas ordens de grandeza, e
    confirma o que o aviso 1 de `docs/EDICOES.md` antecipava para 1991. **A decisão registrada é
    manter a convenção "por código, sem áreas mínimas comparáveis"**, documentando o anacronismo em
    vez de construir uma tabela de AMC: uma AMC mudaria a unidade de análise de todas as edições ao
    mesmo tempo, e o custo do anacronismo é mensurável e está limitado a um nível de agregação.
    Onde ele **não** morde: as **510 Regiões Geográficas Imediatas e as 133 Intermediárias
    continuam todas povoadas** em 1991 — nenhuma fica vazia, nenhum município de 1991 fica sem
    recorte —, porque cada município criado depois saiu de dentro de um município que já pertencia
    à mesma região. Nesses dois níveis a agregação de 1991 é diretamente comparável à das outras
    edições.
11. **Onde o anacronismo morde: o recorte metropolitano.** As 81 regiões metropolitanas e RIDEs de
    2022 continuam todas presentes em 1991, mas **1.132 municípios de 1991 têm RM, contra 1.382 em
    2000, 1.384 em 2010 e 1.388 em 2022**, e **66 das 81 regiões aparecem em 1991 com menos
    municípios do que em 2022** (2000: seis regiões; 2010: quatro), num total de **256 municípios
    metropolitanos de 2022 ausentes da malha de 1991**. A leitura correta é que uma região
    metropolitana de 1991 tem a **composição municipal de 1991**: o território que hoje é um
    município autônomo da região estava, em 1991, dentro do município de origem do desmembramento —
    quando esse município também pertence à região, o território coberto é o mesmo e só a contagem
    muda; quando não pertence, o território da região em 1991 é efetivamente menor. A partição
    exata entre esses dois casos **não foi calculada** (exigiria a tabela de desmembramentos que a
    decisão do item 10 dispensou); o que se sabe é que nenhuma região ficou vazia e que as perdas se
    concentram nas RMs de criação recente e de municípios grandes na Amazônia e no Centro-Norte —
    as mais afetadas em proporção são Santarém/PA (1 município em 1991 contra 3 em 2022), Sudoeste
    Maranhense (9 contra 22), Extremo Oeste/SC (23 contra 49), Sul do Estado/RR e Parnaíba/PI (2
    contra 4 cada) e Gurupi/TO (10 contra 18). **Aviso de comparabilidade**: três regiões ficam com
    **um único município** em 1991 — **Região Metropolitana de Porto Velho** (RO), **Região
    Metropolitana de Santarém** (PA) e **Região Metropolitana de Central** (RR, núcleo Caracaraí).
    Nelas, todo indicador intrametropolitano que depende de um par de municípios é estruturalmente
    degenerado em 1991: não há migração intrametropolitana possível, e `nucleo_periferia`,
    `periferia_nucleo` e `periferia_periferia` são zero por construção, não por medida. Não leia
    esses zeros como queda do fluxo intrametropolitano frente a 2000/2010/2022.
12. **Núcleo metropolitano por fallback numa região.** O núcleo de cada RM vem de
    `pipeline/rm_nucleo.csv`, arquivo único compartilhado por todas as edições (regra: município
    membro homônimo da região; sem homônimo, o mais populoso). Em 1991 isso encontra um caso que
    nenhuma edição anterior encontrou: o núcleo da **Região Metropolitana do Sul do Estado** (RR)
    é **Rorainópolis**, município instalado depois de 1991 e, portanto, **ausente da malha da
    edição**. Sem tratamento, nenhum município da região casaria com o núcleo e todos os pares
    intra-RM cairiam em `periferia_periferia`. A regra aplicada é **a mesma do gerador do CSV
    quando não há homônimo — o município mais populoso entre os que existem na malha da edição** —,
    e só se aplica às RMs cujo núcleo do CSV está ausente naquele censo. Resultado em 1991:
    **São João da Baliza** (10.145 habitantes) passa a núcleo, à frente de São Luiz (9.105), os
    dois únicos municípios da região presentes em 1991. A tipologia de fluxos intra-RM
    (`rm_fluxos_intra.parquet`) e os agregados núcleo/periferia de `rm_resumo.parquet` usam esse
    núcleo. A coluna `nm_nucleo` de `data/processed/1991/rm_resumo.parquet` é resolvida a partir do
    núcleo efetivo da edição (o fallback de `pipeline/sql/1991/08_metro.sql`), e não do rótulo do
    CSV compartilhado: exibe "São João da Baliza", em coerência com os cálculos de tipologia. O CSV
    continua dizendo "Rorainópolis" porque é compartilhado com as edições em que esse município
    existe.
13. **Ausências declaradas: 22 colunas do contrato ficam `NULL`.** O contrato de 49 colunas de
    `pessoas_classificado.parquet` é o mesmo das outras três edições; o que 1991 não mede fica
    explicitamente `NULL`, nunca `0` nem `false`. São **22 colunas** — as 19 do bloco pendular e de
    suas derivadas (`trab_local`, `trab_uf`, `trab_mun`, `estudo_local`, `estudo_uf`, `estudo_mun`,
    `curso`, `curso_grupo`, `retorna_3dias`, `transporte`, `tempo_desloc_cat`, `tempo_desloc_min`,
    `pendular_trab`, `pendular_estudo`, `modo_grupo`, e as de perfil do trabalho `pos_grupo`,
    `setor_grupo`, `ocup_grupo`, `renda_trab_classe`) mais as três marcas de imputação
    (`imp_df_local`, `imp_df_mun`, `imp_trab_mun`), que 1991 não traz. Contra **5 colunas nulas em
    2000, 6 em 2010 e nenhuma em 2022**. `pendular_trab` e `pendular_estudo` são
    `CAST(NULL AS BOOLEAN)` e não `FALSE`: "não medido" não é "medido e negativo".

**Nota sobre o desenho amostral e o estimador de variância.** A amostra do Censo 1991 é, como nas
edições posteriores, uma seleção de **domicílios** com fração amostral por município, e o peso é
atribuído ao domicílio e replicado em cada morador — a estrutura que o estimador de conglomerados
últimos do atlas assume (domicílio como UPA). O que muda, e muda de forma relevante, é o
**estrato**: 1991 não tem área de ponderação, e o atlas usa o substituto descrito no item 9
(município × situação urbano/rural). Por isso o reaproveitamento do estimador **não** foi presumido
a partir de 2000. A verificação empírica está abaixo, e a conclusão é dupla: (a) o estimador é
reaproveitável, porque a diferença de precisão frente a 2000 fica dentro da própria tendência que
as edições mais antigas já mostravam entre si; (b) a precisão de 1991 é **moderadamente pior** que
a de 2000 em amostras de mesmo tamanho, o que é o efeito esperado de um estrato mais heterogêneo
que a área de ponderação real. Leia `se` e `cv` de 1991 como estimativas **conservadoras**.

### Validações realizadas (F7, edição Censo 1991)

Todas rodadas sobre `data/processed/1991/**` — os dados já publicados e aprovados no gate —, salvo
onde indicado, de modo que os números abaixo são os dos arquivos que o site consome, já com o
arredondamento das regras de revelação.

- **Recortes territoriais.** **4.491 municípios**, 27 UFs, **510 regiões imediatas** e **133 regiões
  intermediárias** em `municipios_ref.parquet` — os mesmos 510/133 de 2000, 2010 e 2022, sem nenhum
  município de 1991 sem par em `labels.RECORTES` e **sem nenhuma região vazia**. No sentido
  inverso, 1.082 códigos de `labels.RECORTES` (1.079 municípios publicados de 2022) não têm par em
  1991 — o anacronismo do item 10.
- **Recorte metropolitano.** **81 regiões** e **1.132 municípios** com RM em `rm.parquet` (2000:
  1.382; 2010: 1.384; 2022: 1.388). Cada uma das 81 regiões tem **exatamente um núcleo** e nenhum
  município pertence a mais de uma região. 66 regiões têm menos municípios que em 2022 (256
  municípios a menos no total); **3 regiões ficam com um único município** (Porto Velho, Santarém e
  Central) e **1 região usa núcleo por fallback** (Sul do Estado/RR → São João da Baliza) — itens
  11 e 12.
- **Fechamento da migração.** **44.407 pares publicados** em `fluxos.parquet` (2000: 52.655; 2010:
  52.895; 2022: 53.097), **zero** deles com origem igual ao destino. Σ imigrantes = **13.456.065** e
  Σ emigrantes = **13.456.115** em `municipios.parquet`, com Σ saldos = 60: a identidade fecha até o
  arredondamento do gate — resíduo de 50 sobre 13,5 milhões (0,0004%), porque as regras de revelação
  arredondam cada célula a múltiplos de 5 antes de gravar, e o mesmo resíduo aparece nas outras
  edições (2000 fecha em +160, 2010 em −105, 2022 em +170). Fora da matriz, `imig_ni` soma 460.890
  (origem não informada) e `imig_int`, 66.255 (imigração internacional).
- **População e universo.** Σ `pop` = **146.815.850**, contra 146.825.475 do universo do Censo 1991:
  **−0,007%**, dentro da divergência de expansão que o próprio IBGE declara (a soma dos pesos na
  tabela classificada, antes do arredondamento, é 146.815.790). Σ `pop5` — o universo do atlas, 5
  anos ou mais — = **130.282.915**. Migração de data fixa: **10,68%** dos residentes de 5 anos ou
  mais (13.916.955 pessoas, imigrantes com origem informada mais origem não informada); 0,05% de
  imigração internacional.
- **Chave de domicílio e estrato.** 4.024.553 domicílios reconstruídos (4,24 pessoas por
  domicílio), conferidos por duas vias independentes; **8.939 estratos** de variância
  (município × situação), mediana de 877 registros e um único estrato com menos de 5 registros;
  proporção ponderada de população urbana **75,60%** contra os 75,59% publicados pelo IBGE
  (checagens sobre `data/interim/1991/pessoas_classificado.parquet`, agregadas).
- **Precisão — distribuição publicada.** Em `fluxos.parquet`: 1991, n = 44.407 pares, CV
  mín/mediana/média/máx = **2,73%/50,55%/49,67%/94,08%**; 2000, n = 52.655,
  2,26%/48,62%/47,86%/92,76%; 2010, n = 52.895, 3,69%/47,63%/47,27%/90,98%; 2022, n = 53.097,
  3,40%/46,18%/45,84%/94,25%.
- **Precisão — validação estratificada por tamanho de amostra.** A comparação apenas pela mediana e
  pela média brutas das tabelas intermediárias **não discrimina nada** e foi descartada como
  critério: em todas as quatro edições a mediana do CV de `fluxos_bruto.parquet` é exatamente
  100,0% e a média fica entre 85,6% e 86,5%, porque a massa de pares é dominada por células com uma
  única observação. O teste que discrimina é estratificar por `n` (sobre `fluxos_bruto.parquet`,
  antes da supressão):

  | estrato | 1991 (mediana / média) | 2000 | 2010 | 2022 |
  | --- | --- | --- | --- | --- |
  | `n ≥ 5` (73.860 pares em 1991) | **64,5% / 66,2%** | 59,5% / 61,9% | 55,4% / 58,6% | 50,8% / 53,3% |
  | `n ≥ 30` (7.635 pares) | **28,2% / 28,0%** | 25,5% / 24,9% | 24,3% / 23,9% | 22,3% / 21,8% |
  | `n ≥ 100` (1.107 pares) | **15,0% / 14,5%** | 13,5% / 13,0% | 12,7% / 12,3% | 12,1% / 11,7% |

  Lido assim, 1991 é consistentemente **5% a 20% mais impreciso que 2000** em amostras do mesmo
  tamanho (+5,0 p.p. na mediana em `n ≥ 5`, +2,7 p.p. em `n ≥ 30`, +1,5 p.p. em `n ≥ 100`), mas o
  degrau está **dentro da tendência já observada entre as edições**, que piora monotonicamente com a
  idade do censo mesmo onde o estrato é o do IBGE (de 2010 para 2000 a mediana em `n ≥ 5` já sobe
  4,1 p.p.). **Conclusão: o reaproveitamento do estimador está aprovado**, e a edição 1991 publica
  `se` e `cv` — com a ressalva, registrada no item 9 e na nota de desenho amostral, de que o estrato
  substituto infla moderadamente a variância e torna a precisão de 1991 conservadora, não
  comparável ponto a ponto com a das edições que têm área de ponderação.
- **Ausências declaradas (`NULL`, nunca zero).** As **22 colunas** do item 13 estão 100% nulas em
  `pessoas_classificado.parquet` (2000: 5; 2010: 6; 2022: 0). Nas tabelas publicadas, isso aparece
  como **seis colunas integralmente nulas em `rm_resumo.parquet`** — `ocupados`, `pendulares`,
  `pct_pendular`, `tempo_mediano`, `pct_coletivo` e `pct_diario`, 0 de 81 preenchidas em cada uma,
  contra 81 de 81 nas três primeiras em 2000 — e nenhuma tabela pendular publicada (2000, 2010 e
  2022 publicam `municipios_pendular`, `pendular_trab`, `pendular_trab_dim` e `pendular_estudo`;
  1991 não publica nenhuma delas). A sétima coluna nula de 1991,
  `edu__nao_determinado` em `fluxos.parquet`, não é ausência de medida e sim efeito da supressão —
  ver item 6.
- **Gate de revelação.** `data/processed/1991/.gate_ok` carimba **21 arquivos** na versão
  **`1.0.0-1991`** (12 na raiz da edição — 10 parquets, `meta.json` e `municipios_mapa.json` — mais
  9 em `geo/`), e `python pipeline/verify_gate.py --dir data/processed/1991` **aprova sem
  microdados**. O relatório registra: 44.407 fluxos publicados, todos com n ≥ 5 e ≥ 3 domicílios;
  nenhum fluxo com menos de 20 observações publicando detalhe; 10 colunas de estimativa em
  múltiplos de 5; nenhuma contagem amostral exata (só `n_faixa`); nenhuma coluna de domicílio ou de
  área de ponderação nos 10 parquets. A supressão é mais forte que nas outras edições, como
  esperado numa amostra menor: dos **217.689** pares origem→destino existentes na amostra, 44.407
  (**20,4%**) são publicados, cobrindo **71,6% do volume migratório estimado**; os 173.282 pares
  suprimidos continuam contabilizados nos totais municipais, de modo que nenhum volume se perde —
  apenas a identificação do par. Relatório: `docs/relatorio_revelacao_1991_1.0.0-1991.md`.

## Limitações conhecidas

- Estimativas de erro amostral usam um estimador conservador de conglomerados (domicílio como UPA, área de ponderação como estrato), pois o IBGE não disponibiliza estratos/UPAs formais nos microdados da amostra; cross-checado contra a Função de Variância Generalizada do IBGE.
- Resultados podem divergir de tabulações oficiais do IBGE (SIDRA) por conta de subamostragem, supressão e recalibração aplicadas aos microdados de acesso controlado.
- Migração de data fixa não captura movimentos múltiplos dentro do quinquênio, apenas o par (residência em 2017, residência em 2022).
- Na edição 2000, o deslocamento pendular **para estudo** é um piso, não uma estimativa do total: o Censo 2000 tem um único quesito de trabalho/estudo, com precedência do trabalho, e por isso o fluxo de estudo cobre apenas estudantes não ocupados — e nem todos eles, já que quem trabalha no próprio município e estuda em outro assinala "neste município". O piso capta 2,3% dos estudantes de 2000, contra 6,9% em 2010 e 7,1% em 2022. Comparável em composição e direção, nunca em nível. Ver o aviso de leitura e o item 1 da seção "Edição Censo 2000 e comparabilidade".
- Na edição 2000, a dimensão ocupacional não é comparável em nível com as de 2010 e 2022: a CBO-Domiciliar 2000 não tem o grande grupo de "ocupações elementares" da ISCO-08, e a massa correspondente reaparece distribuída entre serviços/vendedores, agropecuária e indústria/construção/operadores. Ver o item 9 da mesma seção.
- Na edição 1991, a precisão declarada é **aproximada e conservadora**: o Censo 1991 não tem área de ponderação, e o estrato do estimador de variância é um substituto (município × situação urbano/rural), mais heterogêneo que a área real. Estratificando os fluxos por tamanho de amostra, o coeficiente de variação mediano de 1991 fica 5% a 20% acima do de 2000 em pares de mesmo `n` — dentro da tendência já observada entre as edições, mas o suficiente para que `se` e `cv` de 1991 não sejam comparáveis ponto a ponto com os das edições que têm área de ponderação. Ver o item 9 e as validações da seção "Edição Censo 1991 e comparabilidade".
- Na edição 1991, o anacronismo territorial é bem mais acentuado que nas edições recentes: **1.082 códigos municipais de 2022 não existem na malha de 1991** (contra 6 em 2000 e 4 em 2010), e o atlas mantém a convenção de aplicar os recortes de 2022 por código, sem áreas mínimas comparáveis. Regiões imediatas e intermediárias continuam todas povoadas, mas **66 das 81 regiões metropolitanas aparecem em 1991 com menos municípios que em 2022** e **três delas ficam com um único município** (Porto Velho, Santarém e Central), o que zera por construção — não por medida — todos os indicadores intrametropolitanos dessas três. Ver os itens 10 e 11 da mesma seção.
