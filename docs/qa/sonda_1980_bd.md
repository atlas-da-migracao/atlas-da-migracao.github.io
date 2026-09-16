# Sondagem — basedosdados.br_ibge_censo_demografico.microdados_pessoa_1980

Todas as consultas abaixo são agregadas (COUNT/SUM/GROUP BY); nenhuma linha individual foi lida ou impressa.

## (a) Contagem de registros e Σ peso por UF

- AC: n=70,503 | Σpeso=301,276
- AL: n=490,216 | Σpeso=1,982,915
- AM: n=338,052 | Σpeso=1,430,528
- AP: n=42,752 | Σpeso=175,258
- BA: n=2,345,216 | Σpeso=9,455,392
- CE: n=1,307,351 | Σpeso=5,288,429
- DF: n=290,017 | Σpeso=1,176,908
- ES: n=501,651 | Σpeso=2,023,338
- FN: n=298 | Σpeso=1,274
- GO: n=953,137 | Σpeso=3,860,174
- MA: n=973,793 | Σpeso=3,996,444
- MG: n=3,329,884 | Σpeso=13,380,105
- MS: n=328,244 | Σpeso=1,369,779
- MT: n=264,639 | Σpeso=1,138,918
- PA: n=828,740 | Σpeso=3,403,498
- PB: n=699,007 | Σpeso=2,770,346
- PE: n=1,521,170 | Σpeso=6,142,229
- PI: n=514,497 | Σpeso=2,139,196
- PR: n=1,876,014 | Σpeso=7,629,849
- RJ: n=2,779,456 | Σpeso=11,291,631
- RN: n=472,982 | Σpeso=1,898,835
- RO: n=116,536 | Σpeso=491,025
- RR: n=18,323 | Σpeso=79,121
- RS: n=1,925,700 | Σpeso=7,773,849
- SC: n=891,701 | Σpeso=3,628,292
- SE: n=292,409 | Σpeso=1,140,379
- SP: n=6,206,465 | Σpeso=25,042,074

**TOTAL: n=29,378,753 (esperado 29,378,455) | Σpeso=119,011,062 (esperado ≈119,002,706)**
- Conferência ES: Σpeso=2,023,338 (esperado 2,023,338)

## (b) v518 ("UF do município que morava anteriormente") — é município ou só UF?

- v517=10+ anos (7): n=5,907,024 | v518 preenchido=0 (0.0%) | quartis(len)=[1, 1, 1, 1, 1]
- v517=<10 anos (0-6): n=6,304,634 | v518 preenchido=6,304,634 (100.0%) | quartis(len)=[6, 7, 7, 7, 7]
- v517=nasceu (8): n=17,111,135 | v518 preenchido=0 (0.0%) | quartis(len)=[1, 1, 1, 1, 1]
- v517=outro/s_decl: n=55,960 | v518 preenchido=7,959 (14.2%) | quartis(len)=[1, 1, 1, 1, 7]

Interpretação esperada se v518 = código de município (7 dígitos): preenchimento alto (~100%) para faixas <10 anos, ~0% para 'nasceu'.

## (b2) Distribuição de v518 (top 20 valores, amostra de dígitos iniciais)

  prefixo2=35: n=1,205,168
  prefixo2=31: n=782,337
  prefixo2=41: n=756,825
  prefixo2=43: n=416,243
  prefixo2=29: n=403,671
  prefixo2=26: n=353,727
  prefixo2=33: n=350,187
  prefixo2=52: n=279,732
  prefixo2=23: n=266,884
  prefixo2=21: n=211,254
  prefixo2=42: n=202,475
  prefixo2=25: n=158,736
  prefixo2=32: n=129,489
  prefixo2=15: n=115,493
  prefixo2=24: n=108,607
  prefixo2=27: n=104,298
  prefixo2=50: n=101,930
  prefixo2=22: n=98,677
  prefixo2=51: n=69,193
  prefixo2=28: n=52,528
  prefixo2=80: n=42,965
  prefixo2=53: n=37,406
  prefixo2=13: n=34,128
  prefixo2=11: n=12,322
  prefixo2=12: n=9,332
  prefixo2=16: n=4,161
  prefixo2=54: n=2,922
  prefixo2=14: n=1,199
  prefixo2=99: n=533
  prefixo2=20: n=171

## (c) id_municipio — contagem de municípios distintos

- COUNT(DISTINCT id_municipio) = 3,938 (esperado 3,990)
- comprimentos distintos de id_municipio: 1 (min=7, max=7; esperado sempre 7)

## (d) numero_ordem — é ordem da pessoa (sem chave de domicílio) ou id de domicílio?

- numero_ordem: min=1, max=29, quartis=[1, 2, 3, 5, 29], distintos=29
Interpretação: max pequeno (dezenas) e muitos repetidos por UF ⇒ é ordem da pessoa no domicílio (equivalente a V500), NÃO uma chave de domicílio — sem chave de domicílio publicada na BD, a variância exige estrato substituto sem UPA (ver decisão de F9.0).

## (e) v527 ("Município que trabalha ou estuda") — validação como pendular

- zero/nulo: 28,419,544 | preenchido: 959,209 (3.26%) | igual ao próprio município: 0 (esperado 0)
  prefixo2=35: n=336,495
  prefixo2=33: n=207,258
  prefixo2=31: n=80,386
  prefixo2=43: n=70,391
  prefixo2=26: n=60,211
  prefixo2=41: n=33,713
  prefixo2=32: n=26,595
  prefixo2=29: n=25,852
  prefixo2=42: n=25,575
  prefixo2=52: n=12,023
  prefixo2=23: n=11,797
  prefixo2=25: n=11,331
  prefixo2=15: n=10,293
  prefixo2=24: n=7,846
  prefixo2=22: n=7,014
  prefixo2=21: n=6,977
  prefixo2=53: n=5,465
  prefixo2=51: n=4,876
  prefixo2=27: n=4,627
  prefixo2=50: n=4,229
  prefixo2=28: n=3,551
  prefixo2=80: n=1,196
  prefixo2=13: n=845
  prefixo2=11: n=310
  prefixo2=16: n=141
  prefixo2=12: n=96
  prefixo2=54: n=57
  prefixo2=14: n=47
  prefixo2=20: n=9
  prefixo2=99: n=3

## (f) v598 (situação urbano/rural da pessoa) — cobertura

- v598=0: n=19,908,509
- v598=1: n=9,470,244

## (g) v511 (nacionalidade) e v512 (UF de nascimento, sequencial) — distribuição

- v511=2: n=29,099,698
- v511=6: n=229,148
- v511=4: n=49,907

- v512=20: n=4,929,411
- v512=17: n=4,142,832
- v512=16: n=2,691,025
- v512=19: n=2,215,578
- v512=23: n=2,085,011
- v512=12: n=1,784,069
- v512=21: n=1,640,130
- v512=9: n=1,525,452
- v512=7: n=985,579
- v512=22: n=928,169
- v512=11: n=891,650
- v512=26: n=826,956
- v512=5: n=749,775
- v512=8: n=605,488
- v512=13: n=595,456
- v512=18: n=545,520
- v512=10: n=543,427
- v512=15: n=352,120
- v512=3: n=332,756
- v512=24: n=232,271
- v512=25: n=191,040
- v512=27: n=106,600
- v512=75: n=98,620
- v512=2: n=71,843
- v512=1: n=43,092
- v512=29: n=35,896
- v512=91: n=34,918
- v512=6: n=34,110
- v512=71: n=27,446
- v512=63: n=24,871
- v512=4: n=13,772
- v512=57: n=9,920
- v512=30: n=6,675
- v512=74: n=5,995
- v512=92: n=5,459

## Após a extração (F9.1, 2026-09-16)

Extração rodada com `scripts/extract_1980_bd.py --project argon-producer-404500`, uma consulta por
`sigla_uf` (27 valores), com todas as travas de F9.0b. Consumo real: **3,457 GiB** no total (dry
run por UF entre 0,008 GiB e 0,699 GiB — SP a maior partição —, todas abaixo do limite de 2 GiB
por consulta e do orçamento de 10 GiB por execução). Contagens gravadas batem exatamente com a
sondagem em todas as 27 UFs: **n=29.378.753 (esperado 29.378.753) | Σv604=119.011.062 (esperado
119.011.062)**. Todas as análises abaixo são agregadas sobre os Parquets locais em `data/raw1980/`
(DuckDB) e sobre contagens de código de município extraídas do header/campos fixos dos DBF
públicos do IBGE (nunca uma linha de pessoa impressa).

### (a) `COUNT(DISTINCT id_municipio)` — 3.938 vs 3.990: causa identificada

- **BD** (`data/raw1980/pessoa_*.parquet`): `id_municipio` tem 7 dígitos em 29.200.117 linhas e é
  **NULL em 178.636 linhas** (178.338 em `sigla_uf='GO'` + 298 em `sigla_uf='FN'`).
  `COUNT(DISTINCT id_municipio)` (que ignora NULL) = **3.938**.
- **DBF público do IBGE** (`~/Downloads/Microdados_Censo_Demografico_1980_Amostra/Dados/*/Pessoas/
  CD80PES*.DBF`, 26 arquivos, campos `UF` (C,2) + `MUNIC` (C,4) lidos pelo header dBase, sem
  decodificar nenhum outro campo de pessoa): **3.990** códigos `UF‖MUNIC` distintos, somando
  29.378.455 registros — bate com o total esperado da amostra (a diferença de 298 para o total da
  BD é exatamente Fernando de Noronha, ausente do DBF).
- **Comparação dos conjuntos de código de 6 dígitos** (`SUBSTR(id_municipio,1,6)` na BD vs
  `UF‖MUNIC` no DBF): **0 códigos** estão na BD e não no DBF; **52 códigos** estão no DBF e não na
  BD — **todos com prefixo `52` (Goiás)**. A soma da contagem amostral desses 52 códigos no DBF é
  **178.338**, exatamente igual ao número de linhas com `id_municipio IS NULL` em `sigla_uf='GO'`
  na BD. **Conclusão: não há fusão de municípios na BD** — os 52 códigos de município de Goiás
  1980 simplesmente não têm `id_municipio` (7 dígitos, geocódigo atual) atribuído pelo `dbt` da
  Base dos Dados, provavelmente porque são municípios que hoje pertencem ao **Tocantins** (criado
  em 1988, depois do Censo 1980) e o crosswalk usado pela BD não cobre códigos pré-1988 de GO que
  migraram para TO. Os 52 códigos (`UF‖MUNIC`) e suas contagens (amostra / Σ PESOP) estão em
  `docs/qa/` só como lista de códigos de município (dado agregado/geográfico, não individualizante);
  a lista completa foi gerada em `/tmp` durante a sessão e pode ser regerada com o mesmo método
  (header dBase + campos `UF`/`MUNIC`) caso o metodólogo precise mapear os 52 códigos para os
  municípios atuais de TO ao decidir F9.2/F9.3 — **decisão de mapeamento (juízo metodológico)
  fica para o agente `metodologo`**, não decidida aqui: as opções são (i) recuperar o
  `id_municipio` desses 178.338 registros por join direto `UF‖MUNIC` → DTB de 1980 → código atual,
  sem depender do `id_municipio` já (mal) preenchido pela BD, ou (ii) descartá-los da extração
  (perderiam ~0,6% da amostra nacional e uma fração desproporcional de GO/TO).
- Nenhum caso do sentido oposto (BD com município que "sobra" frente ao DBF) foi encontrado.

### (b) `id_municipio` atribuído pela BD às 298 linhas de `sigla_uf = 'FN'`

- **`id_municipio` é NULL nas 298 linhas de FN**, não `2605459` (código de 2022 de Fernando de
  Noronha, presumido no plano). A BD não atribui nenhum geocódigo a essas linhas. **Isso contradiz
  a decisão pré-registrada no plano** ("FN entra em PE, município 2605459, com nota") — a
  atribuição não vem pronta da fonte; precisa ser feita explicitamente na extração/classificação
  (`01_extract.sql` ou uma etapa antes) por `sigla_uf = 'FN'`, não por `id_municipio`. Sinalizado
  para o `metodologo` decidir o texto/tratamento definitivo em F9.2 (a decisão de *qual* código usar
  já está tomada — `2605459` —, falta só a regra de atribuição no SQL, já que a BD não ajuda aqui).

### (c) Distribuição de comprimento e prefixo de `v518` e `v527` (para o metodólogo)

- **`v518`** ("município de residência anterior/última etapa"): comprimento é sempre **7** dígitos
  quando não-nulo (28.435.841 linhas) ou **NULL** (942.912 linhas — universo `v517 ∈ {7 (10+ anos),
  8 (nasceu)}` mais alguns "outro/s_decl", conforme sondagem (b)). Não há strings de comprimento
  diferente de 7. Prefixo de 2 dígitos (excluindo o sentinela `0000000` = não migrante/não
  aplicável) confirma geocódigos de UF válidos como majoritários (`35` SP, `31` MG, `41` PR, `43`
  RS, `29` BA, …) mais as sentinelas já conhecidas da sondagem (`80` exterior, n=42.772; `54`
  Brasil sem especificação, n=2.831; `99` ignorado, n=512; `20`, n=171). **Achado novo**: uma
  cauda de prefixos de 2 dígitos que **não são geocódigos de UF válidos** (`01`-`09`, exceto os já
  documentados), com contagens pequenas mas não desprezíveis: `02`=177.274, `03`=8.302, `05`=1.951,
  `01`=2.351, `04`=871, `08`=193, `09`=21. Somam ~190 mil registros. Precisa de decisão do
  metodólogo sobre o que esses prefixos significam (candidatos: código de país em faixa diferente
  de 30-98, remanescente de uma tabela de UF anterior à reforma de geocódigos, ou erro de
  parsing/casting da BD) antes de tratá-los como origem/exterior/ignorado em `02_classify.sql`.
- **`v527`** ("município que trabalha ou estuda", pendular): mesmo padrão — comprimento sempre 7
  ou NULL (381.477 linhas nulas), prefixos concentrados nas UFs de maior porte (`35`, `33`, `31`,
  `43`, `26`), sentinelas `80`/`54`/`99`/`20` raras, e a mesma cauda de prefixos `01`-`09` em
  volume bem menor (ex.: `02`=11.739, `03`=1.113) — mesma dúvida do item anterior, provavelmente a
  mesma causa.

### Resumo para F9.2/F9.3 (metodólogo)

1. **52 municípios de Goiás 1980 (hoje Tocantins) chegam com `id_municipio` NULL na BD** — decidir
   se são recuperados via DTB de 1980 (por `UF‖MUNIC`) antes do join de `04_flows`/`08_metro`, ou
   excluídos com nota de cobertura. Sem essa decisão, ~178 mil pessoas (0,6% da amostra) e seus
   fluxos de/para esses municípios ficam fora da extração.
2. **FN não vem com `id_municipio` da BD** — a atribuição a `2605459`/PE (já decidida) precisa ser
   feita no SQL por `sigla_uf = 'FN'`.
3. **Prefixos `01`-`09` (exceto sentinelas conhecidas) em `v518`/`v527`** — ~190 mil e ~13 mil
   registros respectivamente — precisam de interpretação antes da classificação de origem/pendular.

## Encerramento dos três achados em F9.2 (metodólogo, 2026-09-16)

Os três itens do "Resumo para F9.2/F9.3" acima estão **decididos**. Justificativa completa em
`pipeline/sql/1980/MAPEAMENTO_02_classify.md` (§2.3, §3, §4) e em `docs/METODOLOGIA.md`, seção
"Edição Censo 1980 e comparabilidade".

1. **52 municípios de Goiás (hoje Tocantins) — excluídos, com a lacuna declarada.** A opção (i) do
   resumo (recuperar o `id_municipio` via `UF‖MUNIC` → DTB de 1980) é **inviável**: a tabela da
   Base dos Dados não publica o código de 6 dígitos original — `id_municipio` é a única coluna
   geográfica, e nesses 178.338 registros ela é nula. Reextrair não resolve, e um join posicional
   com a cópia DBF do IBGE está descartado (extração sem `ORDER BY` nem chave de linha). Efeito
   real: Goiás fica publicado com 3.121.125 habitantes, **exatamente a população de 1980 do
   território que ainda hoje é Goiás**, e o que falta é o território do atual Tocantins, nomeado.
   Cobertura final: 29.200.415 registros, Σ peso 118.272.013 (99,39%), 3.939 municípios. Os 52
   códigos também não são publicados como origem (30.656 registros vão para "origem não
   informada", com a UF de origem preservada).
2. **Fernando de Noronha — regra escrita.** Atribuição por `sigla_uf = 'FN'` → `cd_mun = '2605459'`,
   `uf = '26'`; e, no lado da origem, `v518`/`v527` iguais a `'2000107'` (141 registros) ou
   `'2000008'` (30) → `'2605459'`; `v512 = 14` (670) → `nasc_uf = '26'`.
3. **Prefixos `01`–`09` em `v518`/`v527` — causa identificada, sem incerteza residual.** São
   códigos de município de **6 dígitos** (UF‖MUNIC, sem dígito verificador) que o
   `LPAD(CAST(v518 AS INT64), 7, '0')` da extração empurrou para a direita. **A anomalia está 100%
   concentrada no Ceará** e cobre **100% dos `v518` preenchidos daquela UF** (190.963 registros;
   13.090 em `v527`). Removido o zero inicial, 179.772 casam com `MUN6_1980` (1.227 municípios) e
   os 11.191 restantes são as mesmas sentinelas das outras UFs em 6 dígitos. Nenhum código de UF
   brasileiro começa com zero, então a regra é inequívoca. **Tratá-los como "origem não informada"
   — a opção que este relatório sugeria como mais segura — jogaria fora todas as origens municipais
   do Ceará.**

**Achado novo de F9.2, não detectado na sondagem:** as variáveis de renda (`v607`–`v613`, `v680`,
`v681`, `v682`) estão preenchidas **apenas na partição do Ceará** e em **0,0% das outras 26 UFs**.
A edição 1980 não publica nenhuma coluna de renda. O salário mínimo de referência foi mesmo assim
reconciliado no Ceará e confirmado em **Cr$ 4.149,60** (13/13 faixas de `v682`).

**Dependência bloqueante para F9.3:** `pipeline/labels_1980.UF_SEQ_1980` está errado nas entradas
`'07'`–`'14'` (mapeia `'07'` para `'17'`/Tocantins, que não existe em 1980, e desloca tudo até
`'14'→'27'`). O correto está em `PAISES_V512_1980`, no mesmo módulo. `CATEGORIAS_1980` também está
errado e não deve ser usado.
