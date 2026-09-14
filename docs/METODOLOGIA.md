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

## Limitações conhecidas

- Estimativas de erro amostral usam um estimador conservador de conglomerados (domicílio como UPA, área de ponderação como estrato), pois o IBGE não disponibiliza estratos/UPAs formais nos microdados da amostra; cross-checado contra a Função de Variância Generalizada do IBGE.
- Resultados podem divergir de tabulações oficiais do IBGE (SIDRA) por conta de subamostragem, supressão e recalibração aplicadas aos microdados de acesso controlado.
- Migração de data fixa não captura movimentos múltiplos dentro do quinquênio, apenas o par (residência em 2017, residência em 2022).
