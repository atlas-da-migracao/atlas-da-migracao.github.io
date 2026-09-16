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

**Nota de versão (F9.10, malha geográfica revalidada).** Um lote de feições em cada edição — municípios com fronteiras complexas e, sobretudo, unidades dissolvidas (UF/RGI/RGInt) — tinha anéis com autointerseção residual no TopoJSON publicado: `-simplify` seguido de `-clean` **na mesma invocação** do mapshaper não tinha efeito (a simplificação só se materializa na escrita, então o `-clean` via a geometria pré-simplificação) e a quantização final podia reintroduzir autointerseção mesmo em anéis já corrigidos. O sintoma no app era um triângulo/faixa espúrio cortando o mapa ou um preenchimento ausente, porque o earcut do deck.gl não triangula um anel autointersectante de forma previsível. Correção: `geo/build.sh` agora roda cada produto (municípios/UF/RGI/RGInt) em duas invocações do mapshaper — simplificação materializada num GeoJSON intermediário, depois `-clean` — e revalida o TopoJSON quantizado com `pipeline/validate_geo.py` (ST_IsValid via GEOS + a mesma triangulação earcut do front-end), aplicando reparo dirigido (`ST_MakeValid`, só nas feições reprovadas, com tolerância de 0,5% de variação de área) quando sobra alguma. As 20 malhas publicadas (4 produtos × 5 edições) passam a validar sem exceção; a unidade agregada `NORTEGO` (edição 1980) deixou de precisar do recorte em grade que a corrigia isoladamente (`pipeline/gridsplit_geom.py`, removido) — ver `docs/qa/malha_1980.md`, adendo F9.10.

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
  critério: nas quatro edições que publicam CV (2022, 2010, 2000 e 1991 — 1980 não publica
  precisão, ver a seção daquela edição) a mediana do CV de `fluxos_bruto.parquet` é exatamente
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

## Edição Censo 1980 e comparabilidade com as edições de data fixa

A edição 1980 é a quinta do atlas e a primeira em que **a migração publicada não é medida, é
estimada por um proxy**. Ela também é a primeira alimentada por uma **fonte secundária**, e a
primeira em que uma dimensão inteira do atlas — a renda — simplesmente não existe. Esta seção
explica as três coisas, na ordem em que elas condicionam a leitura dos números. As decisões coluna
a coluna estão em `pipeline/sql/1980/MAPEAMENTO_02_classify.md` e no cabeçalho de
`pipeline/sql/1980/02_classify.sql`.

### 1. A fonte: por que a Base dos Dados, e não a cópia pública do IBGE

Os microdados da amostra do Censo 1980 são públicos, mas **as cópias em circulação não trazem a
variável de origem da migração**. Tanto o conjunto em DBF quanto o arquivo `.sav` distribuídos
publicamente têm 61 e 62 campos respectivamente, e em nenhum deles aparece a **V518** — "Unidade da
Federação do município que morava anteriormente", posição 72, largura 7, do layout original do TXT
de 204 bytes. O quesito foi feito, está no questionário e está no dicionário oficial do IBGE; o
campo foi omitido das cópias. Sem ele, 1980 só permitiria contar imigrantes por destino, sem
matriz origem→destino — o que deixaria a edição fora do atlas.

A **Base dos Dados** (`basedosdados.br_ibge_censo_demografico.microdados_pessoa_1980`, BigQuery)
publica a tabela com a V518 presente. A extração (`scripts/extract_1980_bd.py`, uma consulta por
`sigla_uf`, com dry run e teto de bytes por consulta) trouxe **29.378.753 registros** com
**Σ peso = 119.011.062**, contra os 119.002.706 habitantes recenseados — +0,007%, a mesma ordem de
aderência das outras edições. As contagens por UF batem uma a uma com as da cópia DBF do IBGE (a
única diferença é Fernando de Noronha, ausente das 26 partições do DBF), o que valida a fonte
secundária contra a primária no que as duas têm em comum.

O preço de usar uma fonte secundária aparece em três lugares, e todos foram encontrados só depois
da extração: o Ceará chega com uma codificação própria (item 3), 52 municípios de Goiás chegam sem
código (item 4), e a renda chega vazia em 26 das 27 partições (item 7).

### 2. O proxy de data fixa 1975–1980, e o que ele custa

**O Censo 1980 não pergunta onde a pessoa morava há cinco anos.** Ele pergunta há quantos anos ela
mora no município atual (`v517`) e qual foi o município de residência **imediatamente anterior**
(`v518`) — a chamada *última etapa*, coletada de quem mora no município há menos de dez anos,
inclusive dos naturais dele. O atlas combina os dois: é **migrante** quem mora no município há
menos de cinco anos e declara um município anterior; a **origem** é esse município. A janela
publicada é **01/09/1975 → 01/09/1980**, escolhida para alinhar 1980 aos quinquênios das outras
quatro edições — não é uma data de referência do questionário. O universo é o mesmo das demais:
pessoas de 5 anos ou mais.

Última etapa não é data fixa: quem migra em duas etapas dentro do período aparece com a origem
errada, e quem sai e volta aparece como migrante sem ter mudado de lugar entre as duas datas. A
literatura sobre 1980 (Rigotti, NEPO/Unicamp; Soares, Cadernos do Leste/UFMG) usa o par de quesitos
exatamente assim, e faz exatamente essa ressalva. A diferença é que aqui ela foi **medida**.

**A calibração.** O Censo 1991 tem os três quesitos ao mesmo tempo: tempo de residência
(`MIANMOMU`), última etapa (`MIANTEUF`/`MIANTEMU`) e data fixa verdadeira (`MIMO86UF`/`MIMO86MU`).
Construiu-se em 1991 o **mesmo proxy** que 1980 usa, no mesmo universo (5+, 15.071.836 registros,
Σ peso 130.283.012), e comparou-se com a verdade:

| O que se mede | Resultado |
|---|---|
| **Captação** — migrantes de data fixa verdadeiros que o proxy também classifica como migrantes | **100,0%** (0 de 1.602.229 escapam) |
| **Falsos positivos** — "proxy-migrantes" que não mudaram de município entre as duas datas | **6,9%** (118.815 registros; ida-e-volta dentro do quinquênio) |
| **Volume total** de migrantes internos | **+7,3%** frente ao verdadeiro |
| **Origem municipal** idêntica à verdadeira, entre os que os dois classificam como migrantes | **89,2%** |
| **UF de origem** idêntica | **95,5%** |
| Correlação da **imigração** por município (4.491) | **0,9997** |
| Correlação da **emigração** por município | **0,9998** |
| Correlação da **taxa líquida de migração** por município | **0,9791** (**0,9964** entre os 399 municípios de 50 mil habitantes ou mais) |
| Correlação da taxa líquida por **UF** | **0,9965** |
| Correlação do **volume dos pares origem→destino** | **0,9969** (86,2% dos pares do proxy existem na matriz verdadeira) |

A captação de 100% é estrutural, não sorte: quem mudou de município dentro do quinquênio mora no
destino há menos de cinco anos, por definição. O erro do proxy está **todo** do outro lado, e tem
três formas com direção conhecida:

1. **Inflação de volume.** Os 6,9% de falsos positivos são migração de ida-e-volta; eles somam
   imigração e emigração sem alterar o saldo. Consequência: **volumes de 1980 são ~7% maiores do
   que seriam sob data fixa**; taxas brutas de imigração e emigração, idem.
2. **Atenuação dos saldos.** Porque os falsos positivos entram dos dois lados, a regressão da taxa
   líquida do proxy sobre a verdadeira tem coeficiente **0,912** por UF e **0,941** por município:
   o proxy **encolhe** os saldos em 6% a 9%. O sinal do saldo se inverte em **241 dos 4.491
   municípios (5,4%)**, quase todos pequenos.
3. **Encurtamento da distância.** A migração em etapas transfere fluxo longo para fluxo curto: a
   participação da migração **interestadual** cai de 35,07% (verdade) para 32,96% (proxy). Quem
   veio da Bahia para o interior de São Paulo em 1987 e se mudou para a capital em 1990 conta, no
   proxy, como migrante *intra*-paulista. **1980 subestima a migração de longa distância.**

O **proxy decenal** — usar todo o universo do quesito, `v517` de 0 a 9 anos — foi testado e
rejeitado: os falsos positivos saltariam de 118.815 para 1.301.806.

**Ressalva que não pode ser omitida:** a calibração foi feita em **1991**. Ela mede o erro do
*conceito*, não o erro *desta* edição. Se a migração de retorno e de etapas múltiplas foi mais
intensa em 1975–1980 — o período de auge das fronteiras agrícolas e das migrações sazonais — do que
em 1986–1991, os desvios acima são um **piso**. Não há como testar isso: 1980 não tem data fixa.
Por essa razão a edição carrega em toda a interface um selo **"proxy"**
(`Edicao.proxy_data_fixa = True`), e o número que o atlas publica para 1980 — **14,5% dos
residentes de 5 anos ou mais mudaram de município** — **não deve ser comparado ponto a ponto** com
os 10,68% de 1991 ou com as taxas das edições posteriores. Composição, direção e hierarquia dos
fluxos são comparáveis; nível, não.

### 3. O Ceará chega com outra codificação — e sem a regra, perderíamos 100% das origens do estado

A partição `CE` da Base dos Dados traz `v518` e `v527` com o código de município em **seis
dígitos** (UF‖MUNIC, sem dígito verificador), enquanto as outras 26 UFs usam sete. Como a extração
normaliza o campo para sete posições com zeros à esquerda, esses valores chegam com um zero
espúrio na frente (`0230440` em vez de `230440`). Foi essa a "cauda de prefixos 01–09" registrada
como dúvida em aberto no relatório da sondagem.

Não é codificação desconhecida nem erro de leitura: **nenhum código de UF brasileiro começa com
zero**, então um valor que começa com zero é sempre um código de seis dígitos deslocado. Removido o
zero, **179.772 dos 190.963 registros casam com o dicionário municipal de 1980** (1.227 municípios
distintos), e os 11.191 restantes são exatamente as mesmas sentinelas das outras UFs em seis
dígitos (UF sem especificação de município, exterior, ignorado). A UF de origem majoritária
recuperada é a própria 23 (Ceará), o que é o padrão migratório esperado. A alternativa que a
sondagem sugeria como "opção segura" — tratar esses registros como origem não informada — teria
descartado **todas** as origens municipais do Ceará.

O Ceará diverge em mais pontos, todos tratados e documentados: `v518` de não migrante vem nulo em
vez de zero; `v528`/`v529` usam o código `0` como "não se aplica" para menores de 10 anos (item 6);
`v524` tem 15,2% de valores nulos; e a renda existe **só** ali (item 7).

### 4. O território do atual Tocantins: uma unidade agregada, não um buraco no mapa

Esta é a decisão de cobertura mais consequente da edição, e ela mudou duas vezes antes de chegar à
forma atual. Vale contar as três, porque cada uma foi respondendo a uma objeção da anterior.

#### 4.1 O que a fonte não tem, e por que não adianta procurar

**178.338 registros de Goiás chegam sem código de município.** São os 52 municípios do norte do
estado que em 1988 passaram a formar o Tocantins — o crosswalk usado pela Base dos Dados não cobre
códigos pré-1988 de Goiás que migraram para a nova unidade. A tabela de origem **não publica o
código de seis dígitos original**: `id_municipio` é a única coluna geográfica, e nesses registros
ela é nula.

Isso foi verificado até o fim, porque de início parecia um artefato de conversão. A sondagem
comparou **as quatro camadas da Base dos Dados** — produção, dev e as duas variantes de staging,
esta última anterior ao `safe_cast` que já tinha explicado a codificação de seis dígitos do Ceará
(item 3) — e todas as quatro devolvem exatamente **178.338 nulos e 171 municípios distintos** em
`sigla_uf = 'GO'`. Não há diferença entre elas: o campo é nulo **na origem**, não por efeito de
conversão. Reextrair não resolve. Casar linha a linha com a cópia DBF do IBGE (que tem os códigos)
foi descartado por outro motivo: a extração veio do BigQuery sem ordenação garantida e sem chave de
registro, e um join posicional entre 29 milhões de linhas de duas fontes seria uma reconstrução
individual não verificável — o oposto das regras de sigilo do projeto. E a cópia DBF, de todo modo,
**não traz as variáveis de migração municipal** (V517 e V518 simplesmente não existem no layout
dela; ver `pipeline/sql/1980/MAPEAMENTO_norte_goias.md`, §5).

Então o que falta é isto, e só isto: **em qual dos 52 municípios cada residente estava**. Tudo o
mais desses 178.338 registros está lá — peso, sexo, idade, escolaridade, naturalidade, ocupação,
`v517`/`v518` (migração) e `v527` (pendular).

#### 4.2 As duas tentativas anteriores, e a objeção de cada uma

**Versão `1.0.0-1980`: excluir.** Os 178.338 registros ficaram fora da edição. O ganho era real e
vale registrar: excluídos, Goiás soma **3.121.125** habitantes em 1980 — que é, com precisão, a
população de 1980 do território que **ainda hoje** é Goiás. A UF 52 ficava publicada nos seus
limites atuais, mais comparável com as outras edições, não menos. O custo: 739.049 pessoas somem, a
imigração que chegava ao território some, e o Tocantins vira um **buraco branco** na malha de 1980.

**Versão `1.0.1-1980`: publicar só a emigração.** Do lado da *origem* a situação sempre foi outra.
Quem **saiu** do norte de Goiás entre 1975 e 1980 declarou o município de residência anterior em
`v518` — e ele está lá, com um dos 52 códigos — e hoje mora num município que a edição publica
normalmente. Origem e destino são ambos conhecidos: 15.350 registros, Σ peso 64.639, espalhados por
468 municípios de destino. Eles passaram a ser publicados numa tabela própria,
`fluxos_origem_agregada.parquet`, sob uma origem coletiva declarada. A objeção que sobrou: a origem
não tinha polígono, nome no mapa nem painel — era **invisível**. Integrá-la a `fluxos.parquet`
naquele desenho teria feito municípios inteiros ganharem um maior fluxo de entrada que o mapa não
saberia desenhar (o caso extremo é Conceição do Araguaia/PA, cujo fluxo vindo do norte de Goiás é
de 13.795 pessoas, onze vezes o maior fluxo de entrada que o atlas então mostrava para o município).

#### 4.3 A decisão atual (`1.0.2-1980`): uma unidade agregada

A objeção de 4.2 era contra uma origem **sem forma**, e a objeção de 4.1 — "não dá para saber em
qual dos 52" — era contra publicar **52 unidades**. Nenhuma das duas vale contra **uma unidade só,
com forma própria**, e é isso que a edição publica.

`'NORTEGO'`, "Norte de Goiás (atual Tocantins)", é uma **unidade agregada**: entra em
`municipios.parquet` com população, imigração, emigração e saldo; entra nos dois lados de
`fluxos.parquet`; tem UF, módulo pendular, painel clicável e **um polígono na malha** — as 52
feições originais do IBGE dissolvidas em uma só (`geo/fetch_1980.sh`; a fronteira externa é a união
exata das 52, conferida contra a malha bruta com diferença de área da ordem de 10⁻⁸ grau²). Ela
**não é um município**, e a interface diz isso antes dos números, num aviso próprio no painel
(`web/src/components/AvisoUnidade.tsx`, com o texto vindo de `meta.json`, nunca escrito no código).

| | `1.0.1-1980` | `1.0.2-1980` |
|---|---:|---:|
| unidades no nível municipal | 3.939 | **3.940** (3.939 municípios + 1 unidade agregada) |
| UFs | 26 | **27** |
| Σ peso (cobertura) | 118.272.013 (99,39%) | **119.011.062 (100%)** |
| Σ imigrantes = Σ emigrantes | 13.679.916 | **13.803.767** |
| imigração de origem não informada | 1.095.432 (7,4%) | **1.040.706 (7,0%)** |
| `fluxos.parquet` | 29.437 pares | **29.647** (+144 de entrada, +66 de saída) |
| `fluxos_origem_agregada.parquet` | 168 linhas | **deixou de existir** (absorvida por `fluxos.parquet`) |

Os números da unidade: população **739.049**, população de 5 anos ou mais 608.641, imigração de
origem conhecida **59.212**, emigração **64.639**, saldo **−5.427** (TBI 97,3‰, TBE 106,2‰, TLM
−8,9‰, IEM −0,04). O artefato que a exclusão de `1.0.0` temia — taxa de emigração infinita sobre
população zero — não acontece quando a unidade tem população: o saldo é levemente negativo e não
domina escala de cor nenhuma. As principais origens de quem chegou lá são a história esperada da
fronteira dos anos 1970: Goiânia (3.285), Imperatriz/MA (2.435), Carolina/MA (1.805), Porangatu/GO
(1.125), Conceição do Araguaia/PA (1.080).

**Por que uma unidade coletiva e não as 52.** Além de a fonte não permitir (4.1), a granularidade
municipal **não sobreviveria à revelação** nem do lado em que os 52 códigos existem: publicando as
52 origens separadamente, 145 pares passariam no piso de R1 e cobririam **64,0%** da massa
emigratória, contra 66 pares cobrindo **87,5%** com uma origem única. Com uma unidade publica-se um
quarto a mais do que se sabe, e com uma unidade só para explicar. A composição municipal fica
documentada em `pipeline/unidades_agregadas_1980.py` (os 52 códigos e nomes), de onde pode ser
recuperada se um dia houver como publicá-la.

**A UF é `'17'` (Tocantins), por decisão declarada.** A edição publica a UF de 1980 para todo
município, com uma exceção já declarada: Fernando de Noronha, Território Federal em 1980, sai sob
`'26'` (item 5), porque é isso que o torna comparável com as outras edições. O norte de Goiás é o
**único outro caso** do país em que a UF de 1980 e a de 2022 divergem, e a mesma regra resolve.
Publicar sob `'52'` faria o oposto: inflaria a emigração interestadual de Goiás em 27% com um
degrau puramente territorial e faria Goiás aparecer em 1980 com limites que nenhuma outra edição do
atlas usa. Com `'17'`, a edição 1980 passa a ter **27 UFs**, Goiás continua com os 3.121.125
habitantes dos seus limites de hoje, e as séries de UF das cinco edições ficam sobre o mesmo
território. (O código da unidade, `'NORTEGO'`, é de sete caracteres mas **não numérico** de
propósito: é impossível confundi-lo com um código do IBGE, e qualquer rotina que tentasse derivar a
UF do prefixo falha visivelmente em vez de imputar `'52'` ou `'17'` em silêncio.)

**RGI, RGInt e RM ficam `NULL`.** A unidade cobre 11 RGIs e 3 RGInts de 2022 e não é de nenhuma.
Uma unidade não pode estar em onze regiões, e quebrá-la em onze reintroduziria o problema que a
agregação resolve. Ela simplesmente não participa desses níveis — as 11 RGIs e 3 RGInts seguem sem
município, como já seguiam (item 9), só que agora com um polígono e um nome explicando por quê.

#### 4.4 O que a unidade NÃO resolve, e fica declarado

Três perdas, todas na mesma direção (a de uma agregação, não a de um dado inventado):

1. **Mudar de município dentro do território não aparece como migração.** São 11.586 registros
   (Σ peso 47.598) de pessoas que se mudaram entre dois dos 52 municípios. Elas entram na edição
   como **não migrantes**, exatamente como o próprio questionário de 1980 trata quem se muda dentro
   de um mesmo município (`v518 = '0000000'`). As alternativas eram piores: deixá-las como
   "imigração de origem não informada" seria a única parcela dessa categoria, em todo o atlas, cuja
   origem a fonte **informa**; e resolver a origem para a própria unidade criaria um autoloop
   origem = destino, que o atlas não publica em nível nenhum.
2. **A naturalidade do território é irrecuperável.** Quem nasceu no norte de Goiás e mora fora dele
   traz, em `v512`, "Goiás" — era isso que o Censo de 1980 registrava. Consequência: `retorno_natal`
   e "retorno à UF natal" ficam **subestimados** para a unidade (quem volta ao território vindo de
   fora não é reconhecido como natural dele). Não há como corrigir sem inventar.
3. **Não há detalhe interno.** A unidade tem o tamanho de um estado e é publicada como um ponto no
   mapa de fluxos: os 3.285 imigrantes vindos de Goiânia chegaram "ao norte de Goiás", não a
   Araguaína ou a Porto Nacional.

#### 4.5 A origem não informada de 1980, agora com duas parcelas

Com a mudança, a "origem não informada" de 1980 voltou a significar só o que o nome diz. A conta
nos arquivos publicados é de **1.040.706** (Σ peso), ou **7,0%** dos migrantes internos, com duas
parcelas, ambas do próprio questionário: a sentinela `UF‖'0000'` (a pessoa declarou a UF de origem,
mas não o município) e as sentinelas "Brasil sem especificação" e "ignorado". A terceira parcela de
antes — os 15.350 do norte de Goiás, cuja origem a fonte informava e o atlas é que não tinha onde
colocar — saiu daqui: eles são migrantes de origem válida como quaisquer outros. A decomposição
equivalente está em `pipeline/sql/1980/MAPEAMENTO_02_classify.md` §2.4, e o histórico completo das
três decisões, com as medições de cada uma, em `pipeline/sql/1980/MAPEAMENTO_norte_goias.md`.

### 5. Fernando de Noronha

As 298 linhas com `sigla_uf = 'FN'` também chegam sem `id_municipio` — ao contrário do que o plano
presumia, a Base dos Dados não lhes atribui geocódigo. A malha municipal de 1980 traz o município
com o código `2000107` (prefixo 20, Território Federal até 1988), inexistente no sistema atual. A
atribuição é feita explicitamente, **pela sigla da UF e nos dois lados do fluxo**: como destino,
todo registro de `FN` recebe o código **`2605459`** (Fernando de Noronha/PE nos recortes de 2022) e
a UF `26`; como origem, os códigos `2000107` (141 registros) e `2000008` — "UF 20 sem especificação
de município", e o território só tinha um — recebem o mesmo tratamento, assim como o código 14 da
tabela de UF de nascimento (670 registros). É o **único município da edição cuja UF publicada não é
a de 1980**, e a exceção está declarada aqui.

### 6. Ocupação, escolaridade e deslocamento pendular

**Ocupação.** 1980 não tem uma variável pronta de "ocupado". Tem `v529` ("ocupação atual"), cujo
código `0` significa "trabalha" e equivale, em 100% dos casos e nas 27 partições, a ter ocupação
preenchida. Mas usá-lo sozinho produziria uma taxa de ocupação nacional de 41,1% — e de 60,4% no
Ceará —, porque uma fração das crianças de 0 a 9 anos aparece com esse código (no Ceará, todas
elas; nas demais UFs, cerca de 17%, uniformemente de 0 a 9 anos, o que denuncia artefato e não
trabalho infantil). Com o piso de **10 anos** — o universo econômico do Censo 1980, e o mesmo
verificado em 1991 — a taxa cai para **35,52%** da população, contra os ~35,5% da população
ocupada de 1980 apurados pelo IBGE, variando entre 26,8% (Amapá) e 40,8% (São Paulo). É a regra
adotada. (Todas as taxas desta seção são do **universo publicado**, já sem os registros do norte de
Goiás do item 4; medidas antes da exclusão elas diferem na segunda casa decimal, e é essa a origem
das pequenas diferenças frente aos números de `pipeline/sql/1980/MAPEAMENTO_02_classify.md`, que
foram apurados no arquivo de entrada.)

**Escolaridade.** 1980 não tem "anos de estudo" (a variável derivada que 2000 e 1991 têm). Tem o
par "última série concluída" × "grau da última série concluída", e o `nivel_instr_4` é
reconstruído dos dois. Há uma complicação: **a lista de categorias do grau, no dicionário do IBGE,
está deslocada em um código** — a lista impressa descreve corretamente a variável de grau
*frequentado*, não a de grau *concluído*. Sob a leitura literal, "superior" teria 0,067% da
população (o IBGE publicou 1,5%) e "supletivo de 1º grau" teria a maior renda mediana do país. A
leitura correta foi estabelecida por quatro testes independentes — o número de séries que cada grau
admite, a idade média de quem o declara (os graus do sistema criado em 1971 são declarados por
gente dez anos mais jovem que os do sistema anterior), a renda mediana e a proporção externa de
diplomados — e produz, entre as pessoas de 25 anos ou mais:

| `nivel_instr_4` | 1980 | 1991 |
|---|---:|---:|
| Sem instrução ou fundamental incompleto | 84,91% | 74,30% |
| Fundamental completo / médio incompleto | 5,75% | 9,27% |
| Médio completo / superior incompleto | 6,04% | 11,39% |
| Superior completo | 3,23% | 5,01% |
| Não determinado | 0,07% | 0,03% |

A progressão monótona e da magnitude certa para onze anos de distância é o melhor teste de sanidade
disponível. A escolaridade de 1980 é, ainda assim, **uma aproximação declarada**, com dois vieses
conhecidos: quem estava estudando no momento do censo declara "nenhuma série concluída" e tem o
nível subestimado; e o fim do curso superior é uma faixa, não um ponto (cursos de três a seis anos
coexistem), de modo que o corte erra nos dois sentidos. A variável que cravaria o diploma — o tipo
do último curso concluído — não foi extraída da fonte.

**Pendular.** 1980 tem módulo pendular completo, com um único quesito ("município em que trabalha
ou estuda"), estruturalmente idêntico ao do Censo 2000 — preenchido em 3,28% dos registros e nunca
apontando para o próprio município de residência. Valem as mesmas regras de 2000: **o trabalho
precede**, e por isso **o fluxo de estudo é um piso** — quem trabalha e estuda em municípios
diferentes só aparece no fluxo de trabalho. O módulo publica **quatro dimensões** em vez das seis
de 2000: setor de atividade e grupo ocupacional (com crosswalk das classificações de 1980 — 166
ramos e 366 ocupações — para os grupos do atlas), escolaridade e idade/sexo. Ficam de fora a renda
(item 7) e a **posição na ocupação**: o vocabulário publicado do atlas separa empregados com e sem
carteira e estatutários/militares, e o Censo 1980 **não pergunta carteira assinada** — o código
correspondente é simplesmente "empregado". Publicar uma dimensão inventando essa distinção seria
pior que não publicá-la. Tempo de deslocamento, frequência de retorno e meio de transporte não
existem em 1980, como não existiam em 2000.

Uma ressalva de comparação: a classe "ocupações elementares" **existe** em 1980 (serviço doméstico,
porteiros, serventes), ao contrário de 2000, mas é **mais estreita** que o grande grupo equivalente
das classificações de 2010 e 2022, porque os trabalhadores braçais da indústria, da construção e da
agricultura estão distribuídos pelos grupos da sua atividade. Essa classe não é comparável entre
edições.

### 7. A edição 1980 não publica renda

As variáveis de rendimento — os valores em cruzeiros e as classes em salários mínimos calculadas
pelo IBGE — estão preenchidas na partição do **Ceará** e em **0,0% das outras 26 UFs**. Não é efeito
da extração: a mesma consulta roda nas 27 partições. A tabela de origem não traz renda fora do
Ceará.

Por isso **todas as colunas de renda da edição 1980 são nulas**: renda pessoal do trabalho, renda
domiciliar per capita, e as duas dimensões de classe de renda. Publicar a renda apenas do Ceará
produziria um mapa em que 26 unidades da federação aparecem como "sem informação" e um recorte
nacional construído sobre 4,5% da amostra — pior do que declarar a ausência. **O filtro de renda
não existe em 1980.** Isso é uma perda maior do que o plano da edição previa: ele já contava com a
ausência da renda *per capita* (que depende de uma chave de domicílio inexistente, item 8), mas não
com a da renda individual.

Mesmo sem publicá-la, o **salário mínimo de referência foi reconciliado**, pela mesma técnica usada
em 1991: cruzando, no Ceará, os valores em cruzeiros com as treze faixas em salários mínimos que o
próprio IBGE calculou. **Cr$ 4.149,60** reproduz **13 de 13 faixas**; os mínimos regionais menores
de 1980, o valor de novembro de 1979 e o de novembro de 1980 reproduzem 2 de 13 cada. Duas faixas
cravam o valor ao cruzeiro. Ao contrário de 1991 — onde o salário mínimo implícito nas faixas do
questionário **não** era o mínimo legal vigente —, aqui o valor reconciliado coincide com o mínimo
legal da região I de maio de 1980, o que é uma confirmação externa adicional. O valor fica
declarado nos metadados para documentar a unidade monetária da época e para uma eventual
reextração que traga a renda das demais unidades da federação.

### 8. Sem chave de domicílio: sem erro amostral, e com um piso de revelação diferente

A tabela da Base dos Dados **não publica chave de domicílio**: o campo de ordem vai de 1 a 29 e é o
número da pessoa dentro do domicílio, não um identificador; e a extração veio do BigQuery, que não
garante ordem física, de modo que os domicílios não são reconstruíveis como foram em 1991. Essa
única ausência tem duas consequências independentes, e vale separá-las: uma na precisão (8.1) e
outra no controle de revelação (8.2). A segunda não estava prevista no plano da edição e foi
decidida em F9.5.

#### 8.1 Erro amostral: `sem_estimativa` em todas as tabelas

Sem a unidade primária de amostragem, o estimador de conglomerados últimos usado nas outras edições
trataria cada pessoa como uma observação independente e **subestimaria** a variância — o erro
anticonservador, que é o pior tipo. Por isso a edição 1980 publica **`se` e `cv` nulos em todas as
tabelas**, com a precisão declarada como `sem_estimativa`. Esta é uma **divergência declarada frente
a 1991**, que também não tem área de ponderação mas tem domicílio reconstruível e por isso publica
uma precisão aproximada: em 1980 nem o substituto existe. Números de 1980 devem ser lidos como
estimativas pontuais sem intervalo, e comparações entre células pequenas não têm teste disponível.

#### 8.2 R1 e R2: o piso de domicílios vira um piso de pessoas mais alto

A regra R1 do atlas exige, de toda linha publicada, `n ≥ 5` pessoas **e** `≥ 3` domicílios distintos
na amostra. Os dois pisos protegem contra coisas diferentes. O de pessoas protege contra célula
pequena. O de domicílios protege contra célula **sustentada por poucas unidades correlacionadas**:
como a amostra do censo é uma amostra de domicílios e famílias migram juntas, cinco pessoas podem
ser uma família só, e a estimativa publicada seria função quase direta de um único registro
amostrado. Em 1980 esse segundo piso simplesmente não é calculável — `controle` é nulo em 100% das
linhas, `COUNT(DISTINCT controle)` dá zero para todo grupo, e a condição `ndom ≥ 3` seria
**vacuamente falsa**.

Deixar a condição cair calada não era opção (descartaria toda linha de todas as tabelas), e
ignorá-la também não: medindo nas quatro edições que **têm** a chave, o piso de domicílios faz
muito trabalho justamente no regime em que 1980 publicaria. Em 1991 — a edição-ponte mais próxima,
também pública, da mesma época e com os maiores domicílios —, **80,3% dos pares com `n = 5` têm
menos de 3 domicílios**, e 39,9% de todos os pares com `n ≥ 5`. Em 2000 são 76,1% e 33,8%. Publicar
1980 apenas com `n ≥ 5` faria dela, de longe, a edição mais permissiva do atlas.

A decisão foi **substituir o piso ausente por pisos de pessoas mais altos, subindo cada patamar um
degrau na própria escada de limiares do projeto**: `5 → 20` para publicar a linha (R1) e `20 → 50`
para publicar o detalhe por características (R2). Nenhum número é inventado — 20 já é o limiar de
detalhe de R2 e 50 já é o limite da faixa `50-99` de R5. Os dois foram calibrados contra as edições
que têm a chave, e não escolhidos por analogia:

- **`n ≥ 20` (R1).** É o ponto em que a fração de células que o piso de domicílios rejeitaria cai a
  **0,029% em 1991** (4 de 13.661 pares) e a **0,000% em 2000**. E a consequência substantiva
  bate: com esse piso, 1980 publica 29.437 pares cobrindo **70,7% do volume migratório estimado**,
  dentro da faixa de **67,6% a 71,6%** que a regra real produz em 2022, 2010, 2000 e 1991. A
  cobertura de informação é equivalente; o número de pares publicados (11,0% dos pares da amostra)
  é **menor** que o das outras edições (16,2% a 20,4%), isto é, o substituto erra para o lado de
  suprimir demais, que é o lado certo.
- **`n ≥ 50` (R2).** É maior que a **maior célula já observada, em qualquer tabela de qualquer
  edição, que o piso de domicílios rejeitaria**: `n = 36` nos perfis municipais de 2022 e `n = 23`
  nos fluxos de 1991. O detalhe por características — que é o conteúdo identificante, não o total
  arredondado — nunca sai, portanto, de uma célula que pudesse ser uma ou duas famílias. Com ele,
  1980 publica detalhe em 11.295 pares (54,3% do volume), contra 10.814 a 14.095 pares (42,8% a
  51,5% do volume) nas outras edições: mesmo número de pares, cobertura de volume ligeiramente
  maior, porque os fluxos de 1980 são mais concentrados.

O efeito conjunto é o que importa e é visível no arquivo publicado: os 18.142 pares com `n` entre 20
e 49 publicam **apenas o total arredondado**, e só os 11.295 com `n ≥ 50` publicam composição por
status, escolaridade e idade/sexo. O caso residual de risco — um par sustentado por uma família
grande — fica confinado à faixa que publica só um número redondo.

Três limites desta decisão, ditos explicitamente:

1. **Não é uma garantia, é uma calibração.** Como um domicílio de 1980 pode ter até 29 moradores,
   nenhum piso finito de pessoas *garante* três domicílios. O que a calibração garante é que o
   evento não foi observado nas quatro edições medidas, em nenhuma tabela, acima de `n = 36`.
2. **O escopo é exatamente onde a paridade se perdeu.** O substituto entra nos pisos em que as
   outras edições exigem domicílios, e em nenhum outro lugar. As células de categoria *dentro* de um
   fluxo continuam com `n ≥ 5` sem piso de domicílios — como em todas as edições, inclusive 2022 —,
   porque aí 1980 não está em desvantagem frente às demais. Mudar esse piso só em 1980 seria uma
   regra diferente, não um substituto.
3. **Soma-se à ausência de precisão (8.1).** Nas outras edições, uma célula sustentada por poucos
   domicílios que escapasse ao piso ainda sairia com CV alto e o selo "baixa precisão", que avisa o
   leitor. Em 1980 esse segundo aviso não existe. É mais uma razão para o piso ser mais
   conservador nesta edição, e não menos.

O gate não confia na declaração: `pipeline/disclosure_check.py` verifica, antes de aplicar o
substituto, que `controle` é de fato nulo em 100% dos registros da edição (e, nas demais edições,
que **não** é), de modo que declarar `chave_domicilio = False` não pode virar um atalho para
publicar abaixo do limiar. Os limiares efetivos vão para `meta.json` e para o relatório de
revelação da edição, com `min_domicilios` nulo em vez de `3`, para que a página de metodologia do
site não prometa um piso que não foi aplicado.

### 9. Os recortes de 2022 sobre a malha de 1980: 21 regiões imediatas sem nenhum município

A convenção do atlas — aplicar a divisão territorial de 2022 (RGI, RGInt, RM) retroativamente por
código de município, sem áreas mínimas comparáveis — foi mantida em 1980, pelo mesmo motivo das
edições anteriores: uma tabela de AMC mudaria a unidade de análise das cinco edições ao mesmo
tempo. O anacronismo, porém, deixa de ser só uma questão de nível municipal. **É em 1980 que ele
passa a esvaziar recortes inteiros**, e isso precisa estar declarado porque um recorte vazio é
indistinguível, no mapa, de um recorte sem fluxo:

| Nível | 2022 / 2010 / 2000 / 1991 | 1980 |
|---|---|---|
| Unidades com dado publicado no nível municipal | 5.570 / 5.565 / 5.507 / 4.491 | **3.940** (3.939 municípios + 1 unidade agregada) |
| Códigos de `labels.RECORTES` sem par na edição | 3 / 8 / 66 / 1.082 | **1.634** |
| Regiões imediatas (RGI) povoadas | 510 em todas | **489** (21 vazias) |
| Regiões intermediárias (RGInt) povoadas | 133 em todas | **130** (3 vazias) |
| Regiões metropolitanas com ao menos um município | 81 em todas | **78** (3 ausentes) |
| RMs com um único município | 0 / 0 / 0 / 3 | **4** |

A segunda linha está medida do mesmo jeito nas cinco colunas — códigos do dicionário de 2022 que
não aparecem na edição —, e por isso a coluna de 2022 não é zero: **três** códigos de
`labels.RECORTES` não têm dado em edição nenhuma (as duas lagoas do Rio Grande do Sul, que não são
municípios, e Boa Esperança do Norte/MT, criado mas não instalado). Descontados esses três, são 5
municípios de 2022 ausentes em 2010, 63 em 2000, 1.079 em 1991 e **1.631 em 1980**. Não confundir
com os "quatro" e "seis" citados em `docs/EDICOES.md` para 2010 e 2000: aqueles são municípios que
o recorte **metropolitano** perde, uma medida diferente e muito menor.

As 3 RGInts vazias (Palmas, Araguaína e Gurupi) e 11 das 21 RGIs vazias são o território do atual
Tocantins, que a edição cobre como **uma unidade agregada** e não distribui por RGI/RGInt (item 4)
— não são efeito do anacronismo, são a consequência declarada daquela decisão: a unidade cobre as
onze RGIs e não é de nenhuma, então nenhuma delas recebe dado. As 3 RMs ausentes têm a mesma
causa e a mesma leitura. As outras 10 RGIs vazias (Jaru, Pacaraima, Rorainópolis, Parauapebas,
Xinguara, Laranjal do Jari, Porto Grande, Açailândia, Sorriso e Peixoto de Azevedo–Guarantã do
Norte) são áreas de ocupação recente — frente agrícola, garimpo e projetos de colonização —, e
nelas **nenhum município membro existia como unidade em 1980**: a região existe no recorte de 2022
e não tem antecessor nenhum no censo. Das três RMs ausentes, duas são tocantinenses (Palmas e
Gurupi) e a terceira é a RM do Sul do Estado (RR), também sem nenhum município na malha de 1980.

Quatro RMs ficam com **um único município** em 1980 — Capital (RR), Central (RR), Porto Velho (RO)
e Santarém (PA) —, contra três em 1991. Nessas quatro, todo indicador intrametropolitano (fluxo
núcleo↔periferia, pendularidade intra-RM) é **zero por construção, não por medida**, e deve ser
lido como ausência de recorte e não como ausência de movimento. Nenhuma RM de 1980 precisou do
fallback de núcleo da tabela de decisões de `docs/EDICOES.md`: as 78 presentes têm o núcleo de
`pipeline/rm_nucleo.csv` na malha do censo.

No sentido inverso não há perda: os 3.939 municípios de 1980 têm **todos** par em `RECORTES`, e
nenhum *município* publicado fica sem RGI, RGInt ou UF — a única unidade sem RGI/RGInt é a unidade
agregada do item 4, por decisão e não por lacuna. A malha geográfica acompanha exatamente esses
números (3.940 polígonos no nível municipal, 489 RGIs, 130 RGInts, 27 UFs em
`data/processed/1980/geo/`), de modo que o mapa não desenha unidade sem dado nem dado sem unidade.

### 10. Resumo de comparabilidade

| Dimensão | 2022 / 2010 / 2000 / 1991 | 1980 | Comparável? |
|---|---|---|---|
| Conceito de migração | data fixa (quesito direto) | proxy: última etapa + tempo de residência | **com ressalva** — volumes ~+7%, saldos atenuados ~7%, interestadual −2 p.p.; taxas municipais r = 0,98 |
| Município de origem | sim | sim | sim |
| Origem não informada | 1,2% (2022) a 6,8% (2010) dos imigrantes internos | **7,0%** | sim, com o número ao lado |
| Status migratório | vocabulário reduzido (2010/2000/1991) | idêntico | sim |
| Retorno ao município natal | medido (1991) ou inferido (2000/2010) | **medido** | sim |
| Escolaridade | anos de estudo ou nível de instrução | reconstruída de série × grau | com ressalva |
| Renda pessoal e domiciliar | publicadas | **ausentes** | **não** |
| Fluxos pendulares | sim (exceto 1991) | sim, com o fluxo de estudo como piso (regra de 2000) | sim |
| Dimensões do módulo pendular | 6 (2000) / 7 (2010) | **4** (sem posição na ocupação, sem renda) | parcial |
| Tempo, frequência e modo do deslocamento | 2010 e 2022 | ausentes (como em 2000) | não |
| Erro amostral (`se`/`cv`) | publicado (aproximado em 1991) | **`sem_estimativa`** | **não** |
| Limiar de revelação R1 | `n ≥ 5` e `≥ 3` domicílios | **`n ≥ 20`** (sem chave de domicílio) | sim — calibrado para a mesma cobertura de volume (70,7%, faixa das outras: 67,6%–71,6%) |
| Limiar de detalhe R2 | `n ≥ 20` | **`n ≥ 50`** | sim — 11.295 pares com detalhe, faixa das outras: 10.814–14.095 |
| Cobertura territorial | Brasil inteiro | Brasil inteiro (100% da população recenseada), mas com o território do atual Tocantins publicado como **uma unidade agregada** de 52 municípios, sem detalhe interno e sem RGI/RGInt: 3.939 municípios + 1 unidade | com nota |

## Limitações conhecidas

- Estimativas de erro amostral usam um estimador conservador de conglomerados (domicílio como UPA, área de ponderação como estrato), pois o IBGE não disponibiliza estratos/UPAs formais nos microdados da amostra; cross-checado contra a Função de Variância Generalizada do IBGE.
- Resultados podem divergir de tabulações oficiais do IBGE (SIDRA) por conta de subamostragem, supressão e recalibração aplicadas aos microdados de acesso controlado.
- Migração de data fixa não captura movimentos múltiplos dentro do quinquênio, apenas o par (residência em 2017, residência em 2022).
- Na edição 2000, o deslocamento pendular **para estudo** é um piso, não uma estimativa do total: o Censo 2000 tem um único quesito de trabalho/estudo, com precedência do trabalho, e por isso o fluxo de estudo cobre apenas estudantes não ocupados — e nem todos eles, já que quem trabalha no próprio município e estuda em outro assinala "neste município". O piso capta 2,3% dos estudantes de 2000, contra 6,9% em 2010 e 7,1% em 2022. Comparável em composição e direção, nunca em nível. Ver o aviso de leitura e o item 1 da seção "Edição Censo 2000 e comparabilidade".
- Na edição 2000, a dimensão ocupacional não é comparável em nível com as de 2010 e 2022: a CBO-Domiciliar 2000 não tem o grande grupo de "ocupações elementares" da ISCO-08, e a massa correspondente reaparece distribuída entre serviços/vendedores, agropecuária e indústria/construção/operadores. Ver o item 9 da mesma seção.
- Na edição 1991, a precisão declarada é **aproximada e conservadora**: o Censo 1991 não tem área de ponderação, e o estrato do estimador de variância é um substituto (município × situação urbano/rural), mais heterogêneo que a área real. Estratificando os fluxos por tamanho de amostra, o coeficiente de variação mediano de 1991 fica 5% a 20% acima do de 2000 em pares de mesmo `n` — dentro da tendência já observada entre as edições, mas o suficiente para que `se` e `cv` de 1991 não sejam comparáveis ponto a ponto com os das edições que têm área de ponderação. Ver o item 9 e as validações da seção "Edição Censo 1991 e comparabilidade".
- Na edição 1991, o anacronismo territorial é bem mais acentuado que nas edições recentes: **1.082 códigos municipais de 2022 não existem na malha de 1991** (contra 6 em 2000 e 4 em 2010), e o atlas mantém a convenção de aplicar os recortes de 2022 por código, sem áreas mínimas comparáveis. Regiões imediatas e intermediárias continuam todas povoadas, mas **66 das 81 regiões metropolitanas aparecem em 1991 com menos municípios que em 2022** e **três delas ficam com um único município** (Porto Velho, Santarém e Central), o que zera por construção — não por medida — todos os indicadores intrametropolitanos dessas três. Ver os itens 10 e 11 da mesma seção.
- Na edição 1980, a migração publicada é um **proxy** (última etapa + tempo de residência), não migração de data fixa: calibrado contra o Censo 1991, ele capta 100% dos migrantes verdadeiros, mas infla o volume em ~7% (migração de ida-e-volta), atenua os saldos líquidos em 6% a 9%, subestima a migração interestadual em cerca de 2 pontos percentuais e acerta a origem municipal de 89% dos migrantes (a UF de origem, de 96%). Níveis não são comparáveis com as edições de data fixa; composição, direção e hierarquia dos fluxos são. Ver os itens 1 e 2 da seção "Edição Censo 1980 e comparabilidade".
- Na edição 1980, **não há precisão declarada**: a fonte não publica chave de domicílio e os domicílios não são reconstruíveis, então `se` e `cv` são nulos e `precisao` é `sem_estimativa` em todas as tabelas. Ver o item 8.1 da mesma seção.
- Na edição 1980, **os limiares de revelação R1 e R2 são diferentes dos das outras edições** — e é a única regra do atlas que varia por edição. Sem chave de domicílio, o piso de "≥ 3 domicílios amostrados" de R1 não é calculável, e foi substituído por pisos de pessoas mais altos: `n ≥ 20` para publicar a linha e `n ≥ 50` para publicar o detalhe por características (contra 5 e 20 nas demais). Os dois valores foram calibrados contra as quatro edições que têm a chave, de modo que a proteção e a cobertura de volume publicada fiquem equivalentes; o efeito colateral é que 1980 publica **menos pares** que as outras edições (11,0% dos pares da amostra, contra 16,2%–20,4%) para a mesma cobertura de volume. Ver o item 8.2 da mesma seção.
- Na edição 1980, **não há nenhuma variável de renda**: a fonte traz os rendimentos preenchidos apenas na partição do Ceará e vazios nas outras 26 unidades da federação. O filtro de renda e a dimensão de renda do módulo pendular não existem nessa edição. Ver o item 7 da mesma seção.
- Na edição 1980, o território do atual Tocantins é publicado como **uma unidade agregada** ("Norte de Goiás (atual Tocantins)", 52 municípios), e não município a município: a fonte não informa em qual dos 52 cada residente morava. A unidade tem população (739.049), imigração, emigração, saldo, deslocamento pendular, UF (Tocantins) e polígono próprios, e entra nos dois lados da matriz origem→destino — mas **não é um município**, não tem RGI/RGInt, e mudanças entre os 52 municípios não aparecem como migração. Ver o item 4 da mesma seção.
- Na edição 1980, **os recortes de 2022 deixam de estar todos povoados**: 489 das 510 regiões imediatas e 130 das 133 regiões intermediárias têm ao menos um município em 1980, e das 81 regiões metropolitanas 78 aparecem, 71 com menos municípios que em 2022 e **4 com um único município** (Capital/RR, Central/RR, Porto Velho/RO e Santarém/PA), o que zera por construção — não por medida — os indicadores intrametropolitanos dessas quatro. As 3 RGInts e 11 das 21 RGIs vazias são o território do atual Tocantins; as outras 10 RGIs vazias são regiões de fronteira agrícola cujos municípios foram todos criados depois de 1980. Um recorte vazio não é um recorte sem fluxo. Ver o item 9 da mesma seção.
- Na edição 1980, a **origem não informada é a maior do atlas** (7,0% dos imigrantes internos, contra 1,2% em 2022 e 6,8% em 2010), e ela é toda do próprio questionário: as sentinelas de UF conhecida sem município, "Brasil sem especificação" e "ignorado". (Até a versão `1.0.1-1980` havia uma terceira parcela, os 15.350 vindos do norte de Goiás, cuja origem a fonte informava mas o atlas não tinha onde colocar; com a unidade agregada do item 4 eles viraram migrantes de origem válida e a categoria caiu de 7,4% para 7,0%.) Como em todas as edições, esses registros contam na imigração total do destino e ficam fora da matriz origem→destino municipal. Ver os itens 4 e 10 da mesma seção.
