# Norte de Goiás (atual Tocantins) na edição Censo 1980 — o registro das quatro decisões

Complemento de `MAPEAMENTO_02_classify.md` §3 e de `MAPEAMENTO_fonte_censobr.md`. Este documento
**não é uma decisão pendente**: desde a versão `1.1.0-1980` dos dados os 52 municípios do norte de
Goiás são publicados **como municípios comuns**, com o código de 2022, a partir da fonte censobr
(§2.4). Ele é mantido porque a decisão passou por quatro formas diferentes, e cada uma das três
primeiras foi abandonada por uma razão que vale para a próxima edição que topar com um problema
parecido (ver também `docs/EDICOES.md`, aviso 8). A lição da quarta é a mais cara: as três primeiras
partiram de uma conclusão verdadeira sobre **uma distribuição** dos microdados (a Base dos Dados) e
a trataram como verdadeira sobre **os microdados**.

---

## 1. O problema, delimitado com precisão

O território que virou Tocantins em 1988 é, na Base dos Dados (BD), uma lacuna **de um campo só**:

| | pergunta | na BD | consequência |
|---|---|---|---|
| **residência** | em qual dos 52 municípios a pessoa morava em 1980? | `id_municipio` NULL nos 178.338 registros | **irrecuperável na BD**; recuperado em `1.1.0-1980` pela fonte censobr (§2.4) |
| **origem** | de qual dos 52 a pessoa veio? | `v518` preenchido, com um dos 52 códigos | recuperável |
| **tudo o mais** | peso, sexo, idade, escolaridade, naturalidade, ocupação, `v517`, `v527` | presente nos 178.338 | recuperável |

Esta é a linha que organizou tudo o que veio depois: **o que falta não é "o norte de Goiás", é
*qual* dos 52 municípios**. Uma pergunta sem resposta sobre a composição interna de um território
impede publicar as partes, não o todo. (Ela continua certa. O que estava errado era a premissa de
que a pergunta não tinha resposta em fonte nenhuma.)

### 1.1 As vias de recuperação: o que foi testado até `1.0.7-1980`, e o que faltou testar

Duas hipóteses foram testadas até o fim em 16/09/2026. A primeira está encerrada; a segunda foi mal
avaliada; e havia uma terceira, que só foi considerada na auditoria de 30/09/2026.

1. **Outra camada da Base dos Dados — encerrada, para a BD.** `scripts/sonda_1980_staging_valores.py`
   comparou as **quatro** tabelas candidatas — produção, dev e as duas variantes de staging, esta
   última anterior ao `safe_cast` que já tinha explicado a codificação de seis dígitos do Ceará
   (§2.3 de `MAPEAMENTO_02_classify.md`) — e todas devolvem **exatamente 178.338 nulos e 171
   municípios distintos** em `sigla_uf='GO'`. A conclusão "`id_municipio` é nulo na origem, não por
   conversão" está certa, e a causa foi achada depois: o do-file Stata que constrói a tabela
   (`basedosdados/mais`, `bases/br_ibge_censo_demografico/code/build.do`) faz um `merge m:1
   id_municipio_6` do código de 1980 contra o **diretório atual** de municípios, onde `52xxxx` do
   norte de Goiás e `20xxxx` de Fernando de Noronha não existem; o código original é descartado
   antes do dbt (`MAPEAMENTO_fonte_censobr.md` §1.1). Nenhuma camada da BD tem o dado. **Isso não
   dizia nada sobre as outras distribuições dos mesmos microdados** — e a redação original ("Não
   reabrir esta porta") foi lida como se dissesse.
2. **A cópia DBF do IBGE — avaliada pela metade.** Ela tem `UF`/`MUNIC` completos e os 223
   municípios de Goiás, e **não tem `V518`**, conferido no dicionário oficial que a acompanha
   (`Layout/Documentação.xls`, aba "Pessoa"): a lista de variáveis de migração é `MIUFNASC` (512),
   `MINASCMU` (513), `MIMUMOZN` (514), `MIANTEZN` (515) e `MITEMPUF` (516, tempo de residência **na
   UF**), e salta de 516 para 519 no dicionário. `MIANTEZN`, apesar do rótulo "515-Município
   Anterior Morava", é a **zona** desse município (`1` urbana, `3` rural, `8` nasceu, `9` sem
   declaração). O pendular `TMUNTRAB` (527) está lá, com o código municipal. **A redação original
   dizia que faltavam `V518` e `V517`, e isso é falso para `V517`**: o campo `MITEMPMU` existe no
   arquivo (a conferência foi feita só no dicionário, nunca no cabeçalho do DBF) e bate valor a
   valor com `v517`. Só `V518` falta. A cópia pública serve, portanto, para população, demografia
   e tempo de residência, e **não dá fluxo O/D** sozinha — por isso a edição veio da BD até
   `1.0.7-1980`.
   Casar as duas fontes **por posição** continua rejeitado, com razão: a extração da BD veio do
   BigQuery sem `ORDER BY` e sem chave de linha, e um join posicional seria reconstrução de registro
   sem verificação possível. Mas a alternativa que nunca foi avaliada — **vincular por atributos**
   — é verificável e funciona: 25 variáveis idênticas entre as duas fontes em Goiás, 0 erros no
   gabarito dos 171 municípios que têm código nas duas, par (origem, município) exato para 95,9%
   da massa migrante dos 52 (`MAPEAMENTO_fonte_censobr.md` §5). Ficou como plano B.
3. **Uma terceira distribuição — a que resolve.** O censobr/IPEA v1.0.0 (16/09/2026, o mesmo dia da
   decisão `1.0.2-1980`) deriva dos mesmos arquivos de origem que a BD e traz, no mesmo registro,
   o município de residência na malha de 1980 (`code_muni`, os 52 como `52xxxxx`) **e** `V518`. É
   a fonte da edição inteira desde `1.1.0-1980` (§2.4).

---

## 2. As quatro decisões

### 2.1 `1.0.0-1980` — excluir os 178.338

Os registros ficaram fora da edição. Havia um ganho real: Goiás passa a somar **3.121.125**
habitantes, que é a população de 1980 do território que **ainda hoje** é Goiás — a UF 52 publicada
nos seus limites atuais, mais comparável com as outras edições, não menos.

**Objeção**: 739.049 pessoas somem, a imigração que chegava ao território some, e o Tocantins vira
um buraco branco na malha. Cobertura da edição: 99,39%.

### 2.2 `1.0.1-1980` — publicar só a emigração, numa tabela à parte

Os 15.350 registros (Σ peso 64.639, 468 destinos) de quem **saiu** de lá foram publicados em
`fluxos_origem_agregada.parquet`, sob a origem coletiva `'NORTEGO'`, com o mesmo esquema de
`fluxos.parquet` mais `nm_origem` e o `nivel` do destino. 66 pares municipais passaram em R1,
cobrindo 87,5% da massa.

**Por que coletiva e não 52 origens**: com 52 origens separadas, 145 pares passariam em R1 e
cobririam só **64,0%** da massa (e só 47% chegaria ao piso de caracterização), ao preço de 52
unidades sem população. A agregação publica **um quarto a mais** do que se sabe.

**Por que em tabela própria**: a origem não tinha polígono nem centroide. Somada a
`fluxos.parquet`, municípios inteiros ganhariam um **maior fluxo de entrada invisível** — o caso
extremo é Conceição do Araguaia/PA, com 13.795 pessoas vindas do norte de Goiás contra 1.205 do
maior fluxo então visível.

**Objeção**: essa última razão não é uma propriedade do território, é uma propriedade da **falta de
geometria** — e a geometria era obtenível. Além disso, os residentes continuavam fora.

### 2.3 `1.0.2-1980` a `1.0.7-1980` — a unidade agregada (superada)

> **Superada em `1.1.0-1980`** por §2.4. Mantida como registro: foi a forma publicada de 16/09 a
> 30/09/2026, e os totais de `'NORTEGO'` estão nos arquivos e relatórios de revelação dessas versões.

`'NORTEGO'` passou a ser **uma unidade publicada**. Os 178.338 residentes entram sob ela; os 15.350
emigrantes viram origem normal em `fluxos.parquet`; a tabela separada deixou de existir.

| grandeza da unidade | valor |
|---|---:|
| população 1980 | **739.049** |
| população de 5 anos ou mais | 608.641 |
| imigração de origem conhecida | **59.212** (14.575 registros) |
| — pares origem→`NORTEGO` publicados (R1) | **144** |
| imigração de origem não informada | 9.913 |
| emigração | **64.639** (15.350 registros) |
| — pares `NORTEGO`→destino publicados (R1) | **66** |
| **saldo migratório** | **−5.427** |
| TBI / TBE / TLM / IEM | 97,3‰ / 106,2‰ / −8,9‰ / −0,04 |
| deslocamento pendular declarado (`v527`) | 7.300 (1.691 registros) |
| migração **interna** ao território (não era migração, ver §4) | 47.598 (11.586 registros) |

O artefato que 2.1 temia — taxa de emigração infinita sobre população zero — **não acontece** quando
a unidade tem população: o saldo é levemente negativo e não domina escala de cor nenhuma. As
principais origens de quem chegou são a história esperada da fronteira dos anos 1970: Goiânia
(3.285), Imperatriz/MA (2.435), Carolina/MA (1.805), Porangatu/GO (1.125), Conceição do Araguaia/PA
(1.080).

**Objeção** (registrada na auditoria de 30/09/2026): a unidade resolvia uma lacuna que só existia
na fonte escolhida. As razões para não publicar 52 unidades — "a fonte não distingue os 52" e "52
origens publicam menos" — eram, a primeira, verdadeira só na BD, e a segunda, o efeito comum de R1
sobre qualquer município pequeno, que o atlas nunca usou como motivo para agregar em lugar nenhum.

### 2.4 `1.1.0-1980` — os 52 municípios pela fonte censobr (atual)

**A fonte.** A edição inteira passou a vir do Parquet do censobr/IPEA v1.0.0, convertido por
`scripts/prep_1980_censobr.py` para o mesmo esquema de 39 colunas da BD e validado contra ela nas 27
UFs (gates de identidade em `docs/qa/censobr_1980.md`; fonte, colunas, diferenças declaradas e o
plano B em `MAPEAMENTO_fonte_censobr.md`). Os 178.338 registros do norte de Goiás chegam com
`id_municipio` = código de 1980 (`52xxxxx`) e os 298 de Fernando de Noronha com `2000107`.

**A recodificação.** `pipeline/norte_goias_1980.py` (substitui `unidades_agregadas_1980.py`,
removido) é a fonte única:

| peça | o que é |
|---|---|
| `RECODIFICACAO_1980` | os 52 pares `52xxxxx → 17xxxxx`, fixados literalmente: mesmo serial de 4 dígitos, UF `17` e novo dígito verificador (ex.: `5202106` Araguaína → `1702109`). Conferido 52 de 52 contra `labels.MUNICIPIOS` (nome batendo, com 12 renomeações do tipo Miracema do Norte → Miracema do Tocantins); todos existem em 1991, 2000, 2010 e 2022. |
| `FERNANDO_DE_NORONHA` | `2000107 → 2605459`, o mesmo tratamento pelo mesmo motivo |
| `CODIGO_PUBLICADO` | as 53 entradas acima |
| `NOMES_1980` | o nome publicado é o **de 1980** (Paraíso do Norte de Goiás, Colinas de Goiás…), como a edição já faz com os outros municípios renomeados |
| `linhas_referencia()` | as 52 linhas de `municipios_ref`, com UF `'17'` e RGI/RGInt/RM de 2022 pelo código (`labels.RECORTES`) |
| `mun6_lookup()` → `data/interim/1980/mun6_lookup.parquet` | 3.991 prefixos de 6 dígitos **de 1980** → código publicado e UF; é por ele que `01_extract.sql` resolve origem (`v518`) e destino pendular (`v527`). A chave tem de ser o prefixo de 1980: `v518` chega como `52xxxx`, e chavear por `17xxxx` faria 15.350 emigrantes e 11.586 migrantes internos caírem em silêncio em "origem não informada" |
| `uf_fora_da_epoca()` → `meta.ufs_fora_da_epoca` | o aviso do painel da UF 17: o Tocantins não existia em 1980; trocas com o restante de Goiás aparecem como interestaduais |

`01_extract.sql` aplica a recodificação do lado da residência (vista `recodificacao`, derivada do
mesmo lookup) e aborta com `error()` se encontrar `id_municipio` nulo — a fonte tem código para
todos os registros, e um nulo seria erro de preparação, nunca um valor a inventar. A condição
`m1.cd_mun = c.cd_mun` de `df_local`, que de `1.0.2` a `1.0.7` absorvia a migração interna à
unidade, fica como rede de segurança: nenhum registro tem origem igual ao município de residência
(0 de 29,4 milhões). A malha deixa de ter a feição dissolvida: `geo/fetch_1980.sh` só recodifica
`CD_MUN` das 3.991 feições originais do IBGE, sem `-dissolve`.

**Por que `17xxxxx` e não `52xxxxx`.** A edição publica todo município pelo código atual — é o que
a BD já fazia para os outros 3.939, e é o que liga cada município às outras quatro edições, aos
recortes de 2022 e à genealogia. **A UF continua `'17'`** pelo precedente de Fernando de Noronha
(publicar sob `'52'` inflaria a emigração interestadual de Goiás em 27,4% com um degrau puramente
territorial; `MAPEAMENTO_02_classify.md` §3.5).

**Os números.** O território agora é a soma de 52 municípios:

| grandeza (bruto, antes do arredondamento de R4) | `NORTEGO` (`1.0.2`–`1.0.7`) | UF 17 = 52 municípios (`1.1.0`) |
|---|---:|---:|
| população 1980 | 739.049 | **739.049** (publicado: 739.055) |
| população de 5 anos ou mais | 608.641 | 608.641 |
| imigração de origem conhecida | 59.212 | **106.810** = 59.212 de fora + 47.598 entre os 52 |
| emigração | 64.639 | **112.237** = 64.639 para fora + 47.598 entre os 52 |
| saldo | −5.427 | **−5.427** (a migração entre os 52 se cancela) |
| imigração de origem não informada | 9.913 | 9.913 |
| migração entre os 52 municípios | não era migração | **47.598** (11.586 registros, 782 pares, intraestadual sob a UF 17) |
| pares publicados vindos de fora do território | 144 | 98 |
| pares publicados para fora do território | 66 | **145** (Σ publicado 41.360, 64,0% da emigração para fora) |
| pares publicados entre os 52 | — | **160** (Σ publicado 33.755) |
| `fluxos_uf` (17→52 / 52→17, bruto) | 21.564 / 26.512 | **21.564 / 26.512** (inalterado) |
| guarda `origem = residência` | 11.586 registros | **0** |

O `fluxos_uf` inalterado é o teste de regressão da recodificação: o território era UF 17 antes e
continua sendo, e só a partição interna mudou. Os 145 pares de saída que agora passam em R1 são
exatamente os previstos em §2.2 para 52 origens separadas — o custo de publicar municípios pequenos
é o de sempre, e o atlas o aceita em todo o país.

**Diferenciação contra os totais de `'NORTEGO'` já publicados.** Os totais da unidade publicados de
`1.0.2` a `1.0.7-1980` (por exemplo `NORTEGO → X`) e os novos pares `17xxxxx → X` se sobrepõem: a
diferença entre o total antigo e a soma dos novos pares publicados é a soma das células novas
suprimidas por R1, e, quando só uma célula é suprimida, estima-a com erro de arredondamento. **Não
se criou regra nova de sigilo para isso**, e a razão está registrada aqui: os microdados de 1980
são **públicos** (a amostra distribuída pelo IBGE e pelo IPEA, `acesso = 'publico'` em
`pipeline/edicoes.py`), qualquer célula suprimida pode ser calculada diretamente da fonte pública, e
o que a `1.1.0-1980` muda é apenas o código de município de registros que já eram públicos. R1
(`n ≥ 20`) e R2 (`n ≥ 50`) continuam valendo célula a célula para os 52 como para qualquer
município, e o gate confere que nenhum código `'NORTEGO'`, `52xxxxx` ou `2000107` sobreviveu em
arquivo algum (`pipeline/disclosure_check.py`, R6). Uma checagem de **coerência** (não de sigilo) —
Σ novos `17xxxxx → X` ≤ antigo `NORTEGO → X` + 5 × 52 — foi prevista no plano e não foi
implementada. Numa edição de acesso controlado este argumento **não** valeria, e a transição
exigiria análise de diferenciação própria.

---

## 3. Como estava implementada a unidade agregada (`1.0.2` a `1.0.7-1980`) — superado

> **Superado em `1.1.0-1980`**: nenhuma das peças abaixo existe mais. A implementação atual está em
> §2.4 (`pipeline/norte_goias_1980.py`, `mun6_lookup.parquet`, a vista `recodificacao` de
> `01_extract.sql` e `geo/fetch_1980.sh` sem dissolve). O front mantém o mecanismo genérico de
> unidades agregadas (`meta.unidades_agregadas`) **inativo**: a chave não é mais emitida.

| peça | onde | o que fazia |
|---|---|---|
| registro da unidade (código, nome, UF, 52 membros) | `pipeline/unidades_agregadas_1980.py` (removido) | fonte única; nada era hardcoded fora dali |
| linha em `municipios_ref` + `unidades_agregadas.parquet` | `pipeline/build_ref.py` | a unidade como qualquer outra; a composição `prefixo6 → NORTEGO` à parte |
| `cd_mun = 'NORTEGO'` para os residentes | `01_extract.sql` (CASE de `cd_mun`) | mesmo CASE que tratava Fernando de Noronha |
| origem e destino pendular resolviam para a unidade | `01_extract.sql` (`muni_lookup`) | união de `municipios_ref` com os 52 prefixos; **nenhum** `CASE` especial a jusante |
| UF `'17'` | `01_extract.sql` (`unidade_ref`, `m1.uf`, `m2.uf`) | nos três lugares: residência, origem da migração, destino pendular |
| migração interna → não migração | `01_extract.sql` (`df_local`, `m1.cd_mun = c.cd_mun`) | ver §4 |
| polígono | `geo/fetch_1980.sh` | as 52 feições numa camada própria, `-dissolve`, `-merge-layers` |
| RGI/RGInt sem unidade fantasma | `geo/build.sh` (`-filter "cd_rgi != null"`) e `web/src/db/queries.ts` (`IS NOT NULL`) | as duas pontas filtravam a mesma coisa (os filtros ficam, inócuos) |
| aviso "não é um município" | `meta.unidades_agregadas` → `web/src/components/AvisoUnidade.tsx` | texto no `meta.json`, nunca no componente |
| verificação | `pipeline/disclosure_check.py` (R6) e `pipeline/tests/test_edicao_1980.py` | unidade existe, tem população, não tem autoloop, e nenhum dos 52 componentes vazou como unidade |

Depois de `01_extract.sql`, a unidade era uma linha de `municipios_ref` como as outras:
`03_indicators.sql` lhe dava população e saldo porque varre `ref`; `04_flows.sql` a juntava nos
dois lados; os agregados de RGI/RGInt a excluíam sozinhos (`o_rgi <> d_rgi` é NULL, nunca
verdadeiro); `08_metro.sql` já filtrava `cd_rm IS NOT NULL`.

### 3.1 A geometria da unidade, conferida

O `-dissolve` do mapshaper era aplicado **só às 52 feições**, numa camada separada; as outras 3.939
não passavam por nenhuma operação de geometria e eram reunidas no fim por `-merge-layers`. Isso
importava porque nesta malha as operações de limpeza são sabidamente destrutivas (o `-clean` comeu
6 municípios, `docs/qa/malha_1980.md`). Conferido na época:

- **3.940 feições, 0 inválidas** (`ST_IsValid`); a feição da unidade era um polígono único, sem
  partes soltas nem buracos, com 2.442 vértices.
- A área do polígono dissolvido era **idêntica à união exata das 52 feições brutas** (22,886914 vs
  22,886915 grau²; centroide igual até a 8ª casa) — o dissolve **não movia a fronteira externa**.
- Na malha bruta, a soma das áreas das 52 é **exatamente igual** à da união delas
  (278.641.666.704 m² nos dois casos): não há sobreposição nem vão interno entre elas. A área,
  278.642 km², bate com os 277.720 km² do Tocantins de hoje a menos de 0,4% (diferença da
  cartografia de 1980 e de ajustes posteriores de limite). Este resultado continua valendo para as
  52 feições publicadas em `1.1.0-1980`.
- Custo: `municipios.topojson` passou de 914 KB para 1,18 MB (orçamento: 2 MB).

---

## 4. O que a unidade não resolvia, e o que permanece em `1.1.0-1980`

A unidade tinha três perdas, todas de agregação. Duas deixaram de existir; uma permanece, porque é
do questionário e não da fonte. E a publicação por município traz duas ressalvas próprias.

1. **Mudar de município dentro do território não era migração — resolvido.** 11.586 registros, Σ
   peso 47.598, entravam como **não migrantes** sob a unidade (a alternativa seria um autoloop
   origem = destino ou uma "origem não informada" que a fonte informava). Desde `1.1.0-1980` são
   migração intermunicipal comum, intraestadual sob a UF 17, em 782 pares.
2. **A naturalidade do território só existe por UF — permanece.** Quem nasceu no norte de Goiás e
   mora fora traz `v512` = "Goiás", porque era isso que o Censo de 1980 registrava; não há
   município de nascimento no questionário. `retorno_uf_natal` (e a categoria `retorno_natal` do
   status) fica **subestimado** para o Tocantins e **superestimado** para o sul de Goiás. `v513`
   ("nasceu neste município") vale por município e está correto para os 52.
3. **Não havia detalhe interno — resolvido.** Os 3.285 imigrantes vindos de Goiânia chegavam "ao
   norte de Goiás"; agora chegam a Araguaína, a Porto Nacional, a Gurupi.
4. **Pares pequenos são suprimidos por R1 (`n ≥ 20`)** — como em qualquer município pequeno do
   país: 145 pares de saída para fora do território passam no limiar, contra 66 da origem
   agregada, e cobrem 64,0% da massa em vez de 87,5%. É o custo comum da resolução municipal.
5. **Mesmo código não é mesmo território.** 34 dos 52 municípios cederam área a municípios criados
   depois de 1980 (o Tocantins de 2022 tem 139). A série "Ao longo dos censos" trata isso como para
   qualquer outro município: os 87 criados depois recebem o município-mãe por sobreposição de área
   com a malha de 1980, e o aviso `municipio_mae` acompanha a série dos 52 que cederam território
   (`docs/genealogia.md`).

---

## 5. O que mudou nos números publicados

| | `1.0.1-1980` | `1.0.2`–`1.0.7-1980` | **`1.1.0-1980`** |
|---|---:|---:|---:|
| fonte | BD | BD | **censobr/IPEA v1.0.0** |
| unidades no nível municipal | 3.939 | 3.940 (3.939 + `NORTEGO`) | **3.991** (3.939 + 52) |
| UFs | 26 | 27 | 27 |
| RGIs / RGInts / RMs com município | 489 / 130 / 78 | 489 / 130 / 78 | **500 / 133 / 80** |
| registros | 29.200.415 | 29.378.753 | 29.378.753 |
| Σ peso (cobertura) | 118.272.013 (99,39%) | 119.011.062 (100%) | **119.011.052** (100%; o censobr corrige o peso de um registro de MS) |
| Σ imig = Σ emig | 13.679.916 | 13.803.767 (identidade exata, Δ = 0) | **13.851.365** (Δ = 0; +47.598 da migração entre os 52) |
| imigração de origem não informada | 1.095.432 (7,4%) | 1.040.706 (7,0%) | 1.040.706 (7,0%) |
| `fluxos.parquet` | 29.437 pares | 29.647 | **29.840** |
| `fluxos_origem_agregada.parquet` | 168 linhas | não existe | não existe |
| `pendular_estudo.parquet` | — | 764 pares, 272.565 pessoas (`1.0.7`) | **575 pares, 160.855** (universo de 10 anos ou mais, `MAPEAMENTO_fonte_censobr.md` §4) |
| `pendular_trab.parquet` | — | 2.599 pares, 2.660.250 (`1.0.7`) | 2.596 pares, 2.659.195 |
| `rm.parquet` / `rm_resumo.parquet` | — | 1.019 / 78 linhas (`1.0.7`) | 1.032 / 80 linhas |
| população de Goiás (UF 52) | 3.121.125 | 3.121.125 (inalterada — a unidade é UF 17) | 3.121.125 (inalterada) |
