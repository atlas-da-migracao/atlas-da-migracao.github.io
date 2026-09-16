# Norte de Goiás (atual Tocantins) na edição Censo 1980 — o registro das três decisões

Complemento de `MAPEAMENTO_02_classify.md` §3. Este documento **não é mais uma decisão pendente**:
a solução está implementada desde a versão `1.0.2-1980` dos dados. Ele é mantido porque a decisão
passou por três formas diferentes, e cada uma foi rejeitada por uma razão que vale para a próxima
edição que topar com o mesmo problema (ver também `docs/EDICOES.md`, aviso 8).

---

## 1. O problema, delimitado com precisão

O território que virou Tocantins em 1988 é, na Base dos Dados, uma lacuna **de um campo só**:

| | pergunta | fonte | consequência |
|---|---|---|---|
| **residência** | em qual dos 52 municípios a pessoa morava em 1980? | `id_municipio` NULL nos 178.338 registros | **irrecuperável** |
| **origem** | de qual dos 52 a pessoa veio? | `v518` preenchido, com um dos 52 códigos | recuperável |
| **tudo o mais** | peso, sexo, idade, escolaridade, naturalidade, ocupação, `v517`, `v527` | presente nos 178.338 | recuperável |

Esta é a linha que organizou tudo o que veio depois: **o que falta não é "o norte de Goiás", é
*qual* dos 52 municípios**. Uma pergunta sem resposta sobre a composição interna de um território
impede publicar as partes, não o todo.

### 1.1 A via de recuperação está fechada, em definitivo

Duas hipóteses foram testadas até o fim e as duas estão encerradas:

1. **Outra camada da Base dos Dados.** `scripts/sonda_1980_staging_valores.py` comparou as
   **quatro** tabelas candidatas — produção, dev e as duas variantes de staging, esta última
   anterior ao `safe_cast` que já tinha explicado a codificação de seis dígitos do Ceará (§2.3) —
   e todas devolvem **exatamente 178.338 nulos e 171 municípios distintos** em `sigla_uf='GO'`.
   Nenhuma diferença entre elas: `id_municipio` é nulo **na origem**, não é efeito de conversão.
   Não reabrir esta porta.
2. **A cópia DBF do IBGE.** Ela tem `UF`/`MUNIC` completos e os 223 municípios de Goiás — mas
   **não tem `V518` nem `V517`**, conferido no dicionário oficial que a acompanha
   (`Layout/Documentação.xls`, aba "Pessoa"): a lista de variáveis de migração é `MIUFNASC` (512),
   `MINASCMU` (513), `MIMUMOZN` (514), `MIANTEZN` (515) e `MITEMPUF` (516, tempo de residência
   **na UF**), e **salta de 516 direto para 519**. `MIANTEZN`, apesar do rótulo "515-Município
   Anterior Morava", é a **zona** desse município (`1` urbana, `3` rural, `8` nasceu, `9` sem
   declaração). O pendular `TMUNTRAB` (527) **está** lá, com o código municipal de 7 dígitos — a
   ausência é específica da migração, não da geografia. Ou seja: a cópia pública serve para
   população e demografia; **não dá fluxo O/D nenhum**. É por isso que a edição inteira veio da
   Base dos Dados.
   E casar linha a linha as duas fontes continua rejeitado: a extração veio do BigQuery sem
   `ORDER BY` e sem chave de linha, e um join posicional entre 29,4 milhões de linhas seria
   reconstrução de registro individual sem verificação possível — o oposto das regras de sigilo.

---

## 2. As três decisões

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

### 2.3 `1.0.2-1980` — a unidade agregada (atual)

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
| migração **interna** ao território (não é migração, ver §4) | 47.598 (11.586 registros) |

O artefato que 2.1 temia — taxa de emigração infinita sobre população zero — **não acontece** quando
a unidade tem população: o saldo é levemente negativo e não domina escala de cor nenhuma. As
principais origens de quem chegou são a história esperada da fronteira dos anos 1970: Goiânia
(3.285), Imperatriz/MA (2.435), Carolina/MA (1.805), Porangatu/GO (1.125), Conceição do Araguaia/PA
(1.080).

---

## 3. Como está implementado

| peça | onde | o que faz |
|---|---|---|
| registro da unidade (código, nome, UF, 52 membros) | `pipeline/unidades_agregadas_1980.py` | fonte única; nada é hardcoded fora daqui |
| linha em `municipios_ref` + `unidades_agregadas.parquet` | `pipeline/build_ref.py` | a unidade como qualquer outra; a composição `prefixo6 → NORTEGO` à parte |
| `cd_mun = 'NORTEGO'` para os residentes | `01_extract.sql` (CASE de `cd_mun`) | mesmo CASE que trata Fernando de Noronha |
| origem e destino pendular resolvem para a unidade | `01_extract.sql` (`muni_lookup`) | união de `municipios_ref` com os 52 prefixos; **nenhum** `CASE` especial a jusante |
| UF `'17'` | `01_extract.sql` (`unidade_ref`, `m1.uf`, `m2.uf`) | nos três lugares: residência, origem da migração, destino pendular |
| migração interna → não migração | `01_extract.sql` (`df_local`, `m1.cd_mun = c.cd_mun`) | ver §4 |
| polígono | `geo/fetch_1980.sh` | as 52 feições numa camada própria, `-dissolve`, `-merge-layers` |
| RGI/RGInt sem unidade fantasma | `geo/build.sh` (`-filter "cd_rgi != null"`) e `web/src/db/queries.ts` (`IS NOT NULL`) | as duas pontas filtram a mesma coisa |
| aviso "não é um município" | `meta.unidades_agregadas` → `web/src/components/AvisoUnidade.tsx` | texto no `meta.json`, nunca no componente |
| verificação | `pipeline/disclosure_check.py` (R6) e `pipeline/tests/test_edicao_1980.py` | unidade existe, tem população, não tem autoloop, e nenhum dos 52 componentes vazou como unidade |

**Nada disso precisou de um caminho especial no pipeline.** Depois de `01_extract.sql`, a unidade é
uma linha de `municipios_ref` como as outras: `03_indicators.sql` lhe dá população e saldo porque
varre `ref`; `04_flows.sql` a junta nos dois lados; os agregados de RGI/RGInt a excluem sozinhos
(`o_rgi <> d_rgi` é NULL, nunca verdadeiro); `08_metro.sql` já filtrava `cd_rm IS NOT NULL`.

### 3.1 A geometria, conferida

O `-dissolve` do mapshaper é aplicado **só às 52 feições**, numa camada separada; as outras 3.939
não passam por nenhuma operação de geometria e são reunidas no fim por `-merge-layers`. Isso
importa porque nesta malha as operações de limpeza são sabidamente destrutivas (o `-clean` comeu 6
municípios, `docs/qa/malha_1980.md`). Conferido depois:

- **3.940 feições, 0 inválidas** (`ST_IsValid`); a feição da unidade é um polígono único, sem
  partes soltas nem buracos, com 2.442 vértices.
- A área do polígono dissolvido é **idêntica à união exata das 52 feições brutas** (22,886914 vs
  22,886915 grau²; centroide igual até a 8ª casa) — o dissolve **não move a fronteira externa**.
- Na malha bruta, a soma das áreas das 52 é **exatamente igual** à da união delas
  (278.641.666.704 m² nos dois casos): não há sobreposição nem vão interno entre elas, então o
  dissolve é topologicamente trivial. A área resultante, 278.642 km², bate com os 277.720 km² do
  Tocantins de hoje a menos de 0,4% (diferença da cartografia de 1980 e de ajustes posteriores de
  limite).
- Custo: `municipios.topojson` passou de 914 KB para 1,18 MB (orçamento: 2 MB). A feição retém
  1.613 dos seus 2.442 vértices depois do `-simplify 1%` porque a fronteira é longa e fica
  repartida em 790 arcos — o mínimo de 2 vértices por arco domina. É precisão, não desperdício.

---

## 4. O que a unidade NÃO resolve

Três perdas, todas de agregação — nenhuma delas é um dado inventado:

1. **Mudar de município dentro do território não é migração.** 11.586 registros, Σ peso 47.598.
   Eles entram como **não migrantes**, que é como o próprio questionário de 1980 trata quem se muda
   dentro de um mesmo município (`v518 = '0000000'`). As duas alternativas eram piores:
   classificá-los como "origem não informada" faria deles a única parcela dessa categoria, em todo
   o atlas, cuja origem a fonte **informa**; resolver a origem para a própria unidade criaria um
   autoloop origem = destino, que o atlas não publica em nível nenhum.
2. **A naturalidade do território é irrecuperável.** Quem nasceu lá e mora fora traz `v512` =
   "Goiás", porque era isso que o censo registrava. `retorno_natal` e `retorno_uf_natal` ficam
   **subestimados** para a unidade.
3. **Não há detalhe interno.** Os 3.285 imigrantes vindos de Goiânia chegaram "ao norte de Goiás",
   não a Araguaína ou a Porto Nacional. A composição municipal fica documentada em
   `unidades_agregadas_1980.MEMBROS`, de onde pode ser recuperada se um dia houver como publicá-la.

---

## 5. O que mudou nos números publicados

| | `1.0.1-1980` | `1.0.2-1980` |
|---|---:|---:|
| unidades no nível municipal | 3.939 | **3.940** |
| UFs | 26 | **27** |
| registros | 29.200.415 | **29.378.753** |
| Σ peso (cobertura) | 118.272.013 (99,39%) | **119.011.062 (100%)** |
| Σ imig = Σ emig | 13.679.916 | **13.803.767** (identidade exata, Δ = 0) |
| imigração de origem não informada | 1.095.432 (7,4%) | **1.040.706 (7,0%)** |
| `fluxos.parquet` | 29.437 pares | **29.647** |
| `fluxos_origem_agregada.parquet` | 168 linhas | **não existe** |
| população de Goiás (UF 52) | 3.121.125 | **3.121.125** (inalterada — a unidade é UF 17) |
