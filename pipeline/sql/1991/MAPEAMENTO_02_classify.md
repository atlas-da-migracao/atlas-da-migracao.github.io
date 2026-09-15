# Mapeamento de variáveis — edição Censo 1991

Documento de decisão do metodólogo, para o agente que vai escrever
`pipeline/sql/1991/01_extract.sql` e `pipeline/sql/1991/02_classify.sql`.
**Não é SQL**: é a especificação linha a linha do que cada coluna do contrato deve conter.
O cabeçalho de comentário a colar no topo do `02_classify.sql` está em
`pipeline/sql/1991/CABECALHO_02_classify.txt`; o rascunho da justificativa em prosa está em
`pipeline/sql/1991/RASCUNHO_METODOLOGIA.md` (a entrar em `docs/METODOLOGIA.md` em F7.7).

Fontes usadas:

- `pipeline/layout_1991.py` (141 posições, geradas do header dBase III dos 27 DBF)
- `pipeline/labels_1991.py` (4.491 municípios, `UF_SEQ_1991`, `ESPECIAIS_1991`, `FRACAO_1991`)
- `data/raw1991/Documentação/Dicionário 1991.xls` (categorias, NSA e ignorado de cada variável)
- `data/raw1991/LEIA_ME.DOC` (contagem oficial de domicílios e pessoas por UF)
- `data/raw1991/Arquivos Auxiliares/FRACAMO.TXT` (frações efetivas de amostragem)
- `data/interim/1991/municipios_ref.parquet` (recortes de 2022 aplicados retroativamente)
- Consultas **agregadas** (contagens, somas de peso, percentis, cruzamentos com n ≥ 5) sobre
  `data/interim/1991/raw_txt/*.txt`. Nenhum registro individual foi lido, impresso ou exportado.

---

## 0. Armadilhas de layout (ler antes de escrever o `01_extract.sql`)

| Item | O que é | Por que importa |
|---|---|---|
| **`controle` dos arquivos TXT está ERRADO** | `scripts/prep_1991.py` reconstrói a chave de domicílio incrementando um contador quando `PESSOAN = 1`, mas a função `get_pessoan_position()` tem um *fallback* para `(380, 1)` que foi o que acabou valendo. `PESSOAN` está em **`(418, 2)`**; `(380, 1)` é o primeiro dígito de `MIANMOMU`. | Os 9 bytes de controle gravados nas posições 493–501 dão **1.726.116** domicílios distintos. O valor correto é **4.024.553** (contagem de `PESSOAN = 1`). Evidência dupla: (a) o `LEIA_ME.DOC` declara 5.486 domicílios e 23.102 pessoas em RR, e `PESSOAN = 1` dá exatamente 5.486 em RR (o controle atual dá 2.544); (b) nacionalmente, `COUNT(PESSOAN=1)` = 4.024.553 = `COUNT(PARENDOM=1)` (3.971.593 chefes) + `COUNT(PARENDOM=20)` (52.960 "individual", moradores de domicílio coletivo), identidade exata. Média resultante: **4,24 pessoas por domicílio** (com o controle atual sairia 9,88). **Dependência de implementação: `scripts/prep_1991.py` precisa ser corrigido e os 27 TXT regerados antes de rodar `01_extract.sql`.** `controle` é a UPA do estimador de variância — com a chave errada, `se`/`cv` de toda a edição saem errados. |
| `PESO` **já traz o ponto decimal** | `(223, 12, N, 7)`. O conteúdo é do tipo `"     1.0000587"`/`"    47.2636218"`, não um inteiro com 7 decimais implícitos. | `peso = TRY_CAST(SUBSTR(linha, 223, 12) AS DOUBLE)`, **sem dividir por 1e7**. Validação: Σ peso nacional = **146.815.790**, contra os 146.825.475 do Censo 1991 (−0,007%). Dividir por 1e7 daria 14,68. |
| Campos numéricos vêm **alinhados à direita com espaços** | Herança do dBase III: `MIMO86MU` = `"   5"`, não `"0005"`. | Todo código tem de passar por `LPAD(TRIM(x), <n>, '0')` antes de qualquer `JOIN` ou comparação. Ignorar isso fez 52% das origens municipais "não casarem" com o dicionário numa primeira tentativa; com o `LPAD`, casam **100%**. |
| `cd_mun` tem **6 dígitos**, não 7 | `UFNUM (41, 2) ‖ MUNICNUM (170, 4)` = UF + sequencial, **sem dígito verificador**. As chaves de `MUNICIPIOS_1991` têm 7 dígitos. | O código de 7 dígitos do contrato tem de vir de um `JOIN` com `MUNICIPIOS_1991` pelos **6 primeiros dígitos da chave** (`SUBSTR(cd7, 1, 6)`). Verificado: os 4.491 municípios têm 4.491 prefixos de 6 dígitos distintos (bijeção), e 100% dos `cd_mun` da amostra casam. |
| Um arquivo só, sem arquivo de domicílios | As variáveis de domicílio (`ESPECIE`, `SITSET`, `RDOMICIV`, `PESO`, …) vêm **replicadas em cada linha de pessoa**. | Não há `01_extract` de domicílios nem `LEFT JOIN` por `controle` como em 2000/2010/2022. O `GROUP BY controle` continua necessário **apenas** para contar moradores elegíveis da renda per capita (§4). |
| Sentinelas de NSA/ignorado têm **larguras diferentes** | `RPRINCIV` `(454, 7)`: NSA `9999998`, ignorado `9999999`. `RDOMICIV` `(236, 9)`: NSA `999999998`, ignorado `999999999`. | Copiar a sentinela de uma para a outra silencia o filtro. (O topo de código legítimo de `RPRINCIV` observado é 9.999.997, colado na sentinela.) |
| `LRECL` | 492 bytes de dados + 9 de `controle` = **501 caracteres** por linha lida (o `\n` não entra). Nenhuma linha destoa. | `read_csv(..., delim=chr(1), header=false, quote='', columns={'linha':'VARCHAR'})` preserva o comprimento exato. Não usar `LENGTH(linha) = 502`. |

---

## 1. Colunas intermediárias — `01_extract.sql` → `data/interim/1991/pessoas.parquet`

| Coluna do extrato | Variável(is) 1991 | Lógica | Observação |
|---|---|---|---|
| `uf` | `UFNUM` (41, 2) | direto | VARCHAR, 2 díg. |
| `cd_mun` | `UFNUM ‖ MUNICNUM` + `MUNICIPIOS_1991` | `JOIN` do código de 6 díg. → chave de 7 díg. | Ver §0. 4.491 municípios, 0 sem par. |
| `cd_apond` | `cd_mun`, `SITSET` (174, 1) | `cd_mun ‖ CASE WHEN SITSET IN ('1','2','3') THEN 'U' ELSE 'R' END` | **Aproximação** — 1991 não tem área de ponderação. Ver §5. |
| `controle` | `PESSOAN` (418, 2) | contador acumulado que incrementa em `PESSOAN = 1`, por arquivo/UF | Ver §0. **Precisa de correção no `prep_1991.py`.** |
| `peso` | `PESO` (223, 12) | `TRY_CAST(... AS DOUBLE)`, **sem divisor** | Ver §0. |
| `sexo` | `SEXO` (484, 1) | `TRY_CAST` → INTEGER | 1 masculino, 2 feminino. Sem branco e sem categoria "ignorado" (verificado: só 1 e 2). |
| `idade` | `IDADEANO` (373, 3) | `TRY_CAST` → INTEGER | 0–130. 41 registros em 17,0 milhões com idade nula (0,0002%). |
| `df_local` | `MIMO86UF` (397, 2) | `'1'` se `TRIM(MIMO86UF) IN ('', '0', '70')`; `'3'` se `= '80'`; `'2'` nos demais (`'11'`–`'53'`, `'54'`, `'99'`) | Ver §2. Vocabulário de `P0600`/2022. |
| `df_uf` | `MIMO86UF` | o próprio valor quando `IN ('11'..'53')`; **`NULL`** para `'54'`, `'80'`, `'99'`, branco e `'70'` | 1991 **não usa sentinela** de UF (divergência frente ao `'54'` de 2000 e ao `'98'/'99'` de 2010) — ver §2. |
| `df_mun` | `MIMO86UF`, `MIMO86MU` (393, 4) | `JOIN` de `MIMO86UF ‖ LPAD(TRIM(MIMO86MU),4,'0')` com os 6 primeiros díg. de `MUNICIPIOS_1991`; `NULL` quando a UF não é válida ou quando o município é `'0000'`/`'9999'` | **O código é `MIMO86UF ‖ MIMO86MU`, nunca `UFNUM ‖ MIMO86MU`**: `MIMO86MU` é o município *dentro da UF de origem*. Verificado: 1.551.374 casam, **0 sem par**, 49.404 com `'0000'`. |
| `nasc_local` | `MINASCMU` (402, 1), `MIUFPAIS` (403, 2) | `'1'` se `MINASCMU IN ('1','2')`; `'3'` se `MINASCMU='3'` e `MIUFPAIS` ≥ 30; `'2'` se `MINASCMU='3'` e `MIUFPAIS` ∈ 1–27 ou = 29 | Vocabulário de `P0480`. Ver §3. |
| `nasc_uf` | `MINASCMU`, `MIUFPAIS`, `UF_SEQ_1991` | a própria `uf` quando `MINASCMU IN ('1','2')`; `UF_SEQ_1991[MIUFPAIS]` quando `MINASCMU='3'` e `MIUFPAIS` ∈ 1–27; `NULL` quando `MIUFPAIS` = 29 ou ≥ 30 | `MIUFPAIS` é um **sequencial 1–27**, não o código IBGE. **`UF_SEQ_1991['16'] = '29'` (BA)** — o dicionário do IBGE traz "SE" em 15 *e* em 16, erro de digitação já corrigido no módulo gerado; confirmado nesta revisão. |
| `nacionalidade` | `MINACION` (401, 1) | `NULLIF(TRIM(...), '')`, `NULLIF(..., '0')` | 1 nato, 2 naturalizado, 3 estrangeiro — valor a valor igual a `P0520`/2022. Branca (NSA) para `MINASCMU IN ('1','2')`; o `COALESCE(..., '1')` fica no `02_classify`, como em 2000/2010. |
| `nivel_instr_4` | `EDANOEST` (303, 2) | ver §6 | **Derivado** de anos de estudo, como em 2000. |
| `anos_estudo` | `EDANOEST` | `TRY_CAST` → INTEGER (`NULL` para 20/30/31) | Só para QA da derivação. |
| `renda_trab` | `RPRINCIV` (454, 7) | `TRY_CAST(...) / 36161.60`; `NULL` quando `9999998` (NSA) ou `9999999` (ignorado) | **Em salários mínimos**, convertidos aqui — 1991 não divulga a renda em SM. Ver §7. |
| `rprincif` | `RPRINCIF` (452, 2) | `TRY_CAST` → INTEGER | Só para QA da conversão (§7); não vai ao contrato. |
| `renda_dom` | `RDOMICIV` (236, 9) | `TRY_CAST(...) / 36161.60`; `NULL` quando `999999998`/`999999999` | Renda **domiciliar**, replicada na linha da pessoa. |
| `parendom` | `PARENDOM` (414, 2) | `TRY_CAST` → INTEGER | Denominador da renda per capita (§4). |
| `tipo_domicilio` | `ESPECIE` (214, 1) | direto | 1 particular permanente, 2 particular improvisado, 3 coletivo. |
| `ocupado_10` | `POSOCUP` (420, 2) | `'1'` se `POSOCUP` ∈ 1–11; `'2'` se `= 0`/branco e `idade >= 10`; `NULL` se `idade < 10` | Universo verificado: `MIN(idade)` entre ocupados = **10**, e `POSOCUP ∈ 1..11` ⇔ `RPRINCIF ∈ 1..15` com **zero discordância** (6,97 milhões de registros do Sudeste). Mesmo universo de `P0960`/2022, `V6920`/2010 e da cascata de 2000. |
| `freq_escolar` | `EDGRAU` (308, 1), `EDCURSNS` (305, 1) | `'1'` se `EDGRAU` ∈ 1–5 **ou** `EDCURSNS` ∈ 1–6; senão `'4'` | 1991 não separa rede pública de particular; o contrato só precisa de "frequenta / não frequenta". |
| `curso`, `estudo_*`, `trab_*`, `retorna_3dias`, `transporte`, `tempo_desloc_*`, `imp_*`, `nasc_mun`, `nasc_pais`, `df_pais`, `nivel_instr_7`, `pos_ocup`, `atividade`, `grande_grupo`, `renda_todas_fontes` | — | `CAST(NULL AS <tipo>)` | Ver §8 e §9. |

---

## 2. Migração de data fixa 1986 → 1991 — a correção mais importante desta edição

### 2.1 O Censo 1991 **tem** o município de origem

`docs/EDICOES.md` (aviso 2) e o plano registravam, por antecipação, que *"o Censo 1991 pergunta
apenas a UF ou o país de residência 5 anos antes, sem o município — o que inviabiliza a matriz
origem→destino municipal"*. **Isso está errado e fica corrigido aqui.** O par de variáveis é:

- `MIMO86UF` (397, 2) — "Lugar de moradia em 01/09/86": códigos IBGE de UF `11`–`53`, mais
  `54` "Brasil não especificado", `70` "Neste município", `80` "País estrangeiro ou mal definido",
  `99` "Ignorado" e `0`/branco (NSA);
- `MIMO86MU` (393, 4) — "Município moradia em 86": o sequencial de 4 dígitos **dentro da UF de
  `MIMO86UF`**, mais `0000` (UF sem especificação) e `9999` (NSA).

A matriz origem→destino **municipal** de 1991 é, portanto, publicável, e a edição não precisa ficar
restrita a UF/RGInt. A única perda frente a 2000/2010/2022 é o deslocamento pendular (§8).

### 2.2 Regra de classificação (confirmada em escala nacional)

```
TRIM(MIMO86UF) IN ('', '0', '70')   -> df_local = '1'  (não migrante)
MIMO86UF = '80'                     -> df_local = '3'  (internacional)
caso contrário                      -> df_local = '2'  (migrante interno)
     df_uf  = MIMO86UF quando IN ('11'..'53'), senão NULL  ('54' e '99')
     df_mun = MUNICIPIOS_1991[MIMO86UF ‖ LPAD(TRIM(MIMO86MU),4,'0')], senão NULL
```

**Por que branco ⇔ não migrante.** O quesito de data fixa de 1991 só foi feito a quem **não**
respondeu "sempre morou neste município". Cruzamento nacional de `MIMO86UF` (agrupado) ×
`MINASCMU` × (idade < 5), contagens amostrais, células com n ≥ 5:

| `MIMO86UF` | `MINASCMU` | idade < 5 | n | Σ peso |
|---|---|---|---:|---:|
| branco/NSA | 1 sempre morou | não | 8.744.696 | 73.764.279 |
| branco/NSA | 1 sempre morou | sim | 1.806.604 | 15.136.841 |
| branco/NSA | 2 morou em outro | **sim** | 12.078 | 100.209 |
| branco/NSA | 3 não nasceu aqui | **sim** | 155.153 | 1.295.348 |
| `70` neste município | 2 | não | 367.783 | 3.151.805 |
| `70` neste município | 3 | não | 4.350.146 | 39.384.024 |
| UF válida (`11`–`53`) | 2 | não | 155.811 | 1.302.327 |
| UF válida (`11`–`53`) | 3 | não | 1.444.967 | 12.601.432 |
| `54` Brasil s/ especificação | 2 / 3 | não | 123 / 717 | 902 / 6.464 |
| `80` exterior/mal definido | 2 / 3 | não | 1.016 / 5.966 | 9.811 / 56.406 |
| `99` ignorado | 2 / 3 | não | 109 / 502 | 921 / 4.641 |

A tabela é **exaustiva e sem exceções**: (a) não existe registro com `MIMO86UF` branco,
`MINASCMU ≠ 1` e idade ≥ 5; (b) não existe registro com `MINASCMU = 1` e `MIMO86UF` preenchido;
(c) todo valor preenchido de `MIMO86UF` pertence a alguém de 5 anos ou mais. O branco é, portanto,
o *skip pattern* do questionário — exatamente o papel do `V0415 = 1` em 2000 —, e não uma
não-resposta. É por isso que o `COALESCE` para "não migrante" continua obrigatório.

**Consistência `MINASCMU = 1` ⇔ `df_local = '1'`: 100,000%, zero exceções.** Diferente do que a
tarefa previa como possível, não há resíduo a explicar: a consistência é **estrutural** (o quesito
não foi feito a quem respondeu "sempre morou"), não empírica. Ela não deve ser reportada como
"validação independente" — é uma tautologia do desenho do questionário, e está registrada aqui
justamente para que ninguém a apresente como evidência de qualidade do dado.

### 2.3 Taxa de migração de data fixa obtida

Universo de 5 anos ou mais (Σ peso = 130.283.012):

| `df_local` | n | Σ peso | % dos 5+ | % da população total |
|---|---:|---:|---:|---:|
| `'1'` não migrante | 13.462.625 | 116.300.108 | 89,27% | — |
| `'2'` migrante interno | 1.602.229 | **13.916.688** | **10,68%** | **9,48%** |
| `'3'` internacional | 6.982 | 66.217 | 0,05% | 0,05% |

**10,68% dos residentes de 5 anos ou mais** mudaram de município entre 01/09/1986 e 01/09/1991
(9,48% da população total). Está dentro da faixa de 8–10% citada no plano quando medida sobre a
população total, e ligeiramente acima quando medida sobre o universo do quesito — que é o
denominador correto e o usado nas outras edições. **Não foi possível conferir contra um valor
publicado pelo IBGE** (esta sessão não tem acesso à internet e a documentação do DVD não traz
tabulações de migração): o número está reportado como obtido, não como cross-checado.

Decomposição interna, para ordem de grandeza (n = amostral, w = ponderado):

| | n | Σ peso | % dos migrantes internos |
|---|---:|---:|---:|
| origem municipal conhecida | 1.551.374 | 13.456.190 | 96,7% |
| origem não informada (`0000`, `54`, `99`) | 50.855 | 460.498 | 3,3% |
| interestaduais | 559.054 | — | 36,0% (ponderado) |
| origem = destino (inconsistência) | **23** | — | 0,0014% |

Os 23 registros com origem igual ao destino são excluídos por `origem_valida`, como nas outras
edições.

### 2.4 Códigos de origem sem par no dicionário: **zero**

Cruzamento de `MIMO86UF ‖ LPAD(TRIM(MIMO86MU),4,'0')` com os 6 primeiros dígitos de
`MUNICIPIOS_1991`, restrito a `MIMO86UF ∈ ('11'..'53')` e idade ≥ 5:

| situação | n | Σ peso |
|---|---:|---:|
| casa com `MUNICIPIOS_1991` | 1.551.374 | 13.456.190 |
| `MIMO86MU = '0000'` (UF sem especificação) | 49.404 | 447.570 |
| `MIMO86MU = '9999'` (NSA) | 0 | 0 |
| **sem par no dicionário** | **0** | **0** |

Não há caso a tratar. Se um aparecer numa reexecução (por exemplo depois de corrigir o
`prep_1991.py`), a regra é a mesma do `'0000'`: `df_mun = NULL`, `origem_conhecida = FALSE`,
`status = 'origem_nao_informada'` — a pessoa conta na imigração total do destino e fica fora da
matriz e da emigração. **O `01_extract.sql` deve falhar alto (ou registrar contagem no QA) se
a contagem de "sem par" for maior que zero**, em vez de deixar virar `NULL` silenciosamente.

### 2.5 Por que 1991 usa `NULL` e não uma sentinela em `df_uf`/`df_mun`

2010 usa `UF‖'99999'`/`9899999`; 2000 usa os 27 códigos com `SUBSTR(cod,3,4) = '0000'`. Em 1991 as
sentinelas de origem desconhecida (`'54'`, `'99'`, `MIMO86MU='0000'`) **não vivem no espaço de
códigos de município** — não há um código de 7 dígitos plausível para fabricar. Fabricar um
(`'5400000'`, digamos) criaria um valor que não existe em `MUNICIPIOS_1991` e que poderia vazar
para `fluxos` num `JOIN` mal guardado. Decisão: **`df_uf` e `df_mun` ficam `NULL`**, e as colunas
derivadas passam a testar `IS NOT NULL` em vez de comparar com sentinela:

```
origem_conhecida = COALESCE(df_local = '2' AND df_mun IS NOT NULL, FALSE)
origem_valida    = COALESCE(df_local = '2' AND df_mun IS NOT NULL AND df_mun <> cd_mun, FALSE)
interestadual    = COALESCE(df_local = '2' AND df_uf  IS NOT NULL AND df_uf  <> uf, FALSE)
```

Verificado que isso é seguro a jusante: `03_indicators.sql` e `04_flows.sql` só usam `df_mun` sob
`origem_valida` (linhas 41, 70–71, 132–142 de `03`; 18, 31, 74 de `04`), e `imig_ni` é calculado
por diferença, não por sentinela.

---

## 3. Naturalidade, nacionalidade e `status`

`MINASCMU` (402, 1) dá o local de nascimento em três valores: `1` "sempre morou",
`2` "morou em outro", `3` "não nasceu". Os dois primeiros significam **nascido neste município**;
só o terceiro abre o bloco de UF/país (`MIUFPAIS`) e de nacionalidade (`MINACION`).

Cruzamento nacional `MINASCMU` × grupo de `MIUFPAIS` × `MINACION` (n ≥ 5), **exaustivo**:

| `MINASCMU` | `MIUFPAIS` | `MINACION` | n |
|---|---|---|---:|
| 1 sempre morou | branco/NSA | branco | 10.551.328 |
| 2 morou em outro | branco/NSA | branco | 536.921 |
| 3 não nasceu | 1–27 (UF) | 1 nato | 5.861.188 |
| 3 não nasceu | 29 Brasil s/ esp. | 1 nato | 17.570 |
| 3 não nasceu | 30–98 (país) | 2 naturalizado | 16.785 |
| 3 não nasceu | 30–98 (país) | 3 estrangeiro | 61.507 |
| 3 não nasceu | 99 estrangeiro s/ esp. | 2 / 3 | 62 / 351 |

Três consequências:

1. `MIUFPAIS` e `MINACION` são **brancos para `MINASCMU ∈ {1,2}`** — quem nasceu no município não
   responde nem UF de nascimento nem nacionalidade. Daí o `COALESCE(nacionalidade, '1')`
   obrigatório no `status`: branco = brasileiro nato, mesmo motivo de 2000 e 2010.
2. `MIUFPAIS = 29` ("Brasil sem especificação") vem sempre com `MINACION = 1`. Cai em
   `nasc_local = '2'` e `nasc_uf = NULL`. **Mesma subcontagem conhecida de 2000**: brasileiros
   natos nascidos no exterior são instruídos a registrar "Brasil" e acabam em `nao_natural` em vez
   de `nascido_exterior`.
3. `MIUFPAIS = 100` ("NSA" no dicionário) **não ocorre** — o campo tem 2 posições e o NSA é o
   branco. Não escrever `CASE` para o 100.

### Vocabulário de `status`: o reduzido de 2010/2000

Já registrado em `pipeline/disclosure_rules.STATUS_POR_EDICAO["1991"] =
["retorno_natal", "nao_natural", "nascido_exterior"]` — **conferido, e é o que esta especificação
propõe**. Motivo: 1991 não coleta o *município* de nascimento (só UF ou país), então
`primeira_saida` e `etapas_multiplas` de 2022 são indistinguíveis e colapsam em `nao_natural`.

```
df_local='3' e COALESCE(nacionalidade,'1') IN ('1','2') -> internacional_brasileiro
df_local='3'                                            -> internacional_estrangeiro
df_local='2' e nasc_local='1'                           -> retorno_natal
df_local='2' e nasc_local='3'                           -> nascido_exterior
df_local='2' e df_mun IS NULL                           -> origem_nao_informada
df_local='2' e nasc_local='2'                           -> nao_natural
df_local='2'                                            -> outro
senão                                                   -> NULL
```

`retorno_natal` em 1991 é **medido pelo próprio quesito, sem inferência**: entre migrantes
(`df_local = '2'`), `nasc_local = '1'` só pode vir de `MINASCMU = 2` — "nasceu aqui, mas já morou
em outro lugar" —, porque `MINASCMU = 1` implica `df_local = '1'` estruturalmente (§2.2).

Distribuição obtida (universo: migrantes de data fixa, 5+):

| `status` | n | Σ peso | % dos migrantes |
|---|---:|---:|---:|
| `nao_natural` | 1.394.367 | 12.139.977 | 86,8% |
| `retorno_natal` | 156.043 | 1.304.151 | 9,3% |
| `origem_nao_informada` | 46.593 | 424.321 | 3,0% |
| `internacional` (os dois) | 6.982 | 66.217 | 0,5% |
| `nascido_exterior` | 5.226 | 48.239 | 0,3% |

`retorno_uf_natal` segue a forma das outras edições, trocando a sentinela por `IS NOT NULL`:
`df_local='2' AND nasc_local='2' AND nasc_uf = uf AND df_uf IS NOT NULL AND df_uf <> uf`.

---

## 4. Renda domiciliar per capita

`RDOMICIV` (236, 9) é a renda domiciliar em **Cruzeiros correntes**, replicada em cada linha de
pessoa do domicílio. 1991 não tem uma variável de renda per capita pronta (2010 tem `V6532`;
2022 tem `D0360`) — ela é construída, com a mesma armadilha de 2000.

**A convenção de 2000 vale em 1991, e isso foi verificado, não presumido.** Reconstruindo a chave
de domicílio por `PESSOAN = 1` em RR (4.892 domicílios particulares com renda válida) e comparando
`RDOMICIV` com a soma de `RTOTALPV` (renda total individual) dos moradores:

| denominador testado | domicílios em que `RDOMICIV` = soma | entre os 75 domicílios **com** pensionista/empregado |
|---|---:|---:|
| soma de **todos** os moradores | 4.824 / 4.892 (98,6%) | **7 / 75** |
| soma **excluindo** `PARENDOM ∈ {14, 15, 16}` | **4.892 / 4.892 (100%)** | **75 / 75** |

`RDOMICIV` exclui do numerador pensionistas (14), empregados domésticos (15) e parentes do
empregado doméstico (16), exatamente como `V7616`/`V7617` em 2000. O denominador tem de excluir os
mesmos:

```
renda_pc(SM) = (RDOMICIV / 36161.60) / NULLIF(<moradores com PARENDOM NOT IN (14,15,16)>, 0)
```

com o denominador vindo de um `GROUP BY controle` sobre o próprio arquivo (uma vez que o
`controle` esteja corrigido — §0). Calcular só para `ESPECIE IN ('1','2')`; **`NULL` para
`ESPECIE = '3'`** (domicílio coletivo, 74.902 registros / 678.886 ponderados), que vira
`nao_aplicavel` no `renda_classe`, como nas outras três edições. `RDOMICIV = 999999998` (NSA) ou
`999999999` (ignorado) → `NULL`.

Volume afetado: **94.889** moradores com `PARENDOM ∈ {14,15,16}` no país — 16.669 pensionistas,
72.769 empregados domésticos residentes e 5.451 parentes do empregado doméstico (0,56% dos
17,0 milhões de registros). Usar o denominador errado subestimaria a renda per capita justamente
nos domicílios de renda mais alta, que são os que têm empregado doméstico residente.

QA obrigatório: `<moradores elegíveis> <= <total de moradores>` em 100% dos domicílios
particulares.

---

## 5. Estrato de variância: `cd_mun × situação urbano/rural`

**O Censo 1991 não tem área de ponderação.** Ela é o estrato do estimador de conglomerados em
último estágio usado pelo atlas (`03_indicators.sql`, `04_flows.sql`) e existe em 2022, 2010 e
2000 (9.336 áreas). Decisão do usuário, registrada aqui com a fórmula exata:

```
cd_apond = cd_mun || CASE WHEN SITSET IN ('1','2','3') THEN 'U' ELSE 'R' END
```

`SITSET` (174, 1) é a situação do setor censitário: `1` área urbanizada, `2` área não urbanizada,
`3` área urbanizada isolada (os três = **urbano**), `4`–`8` aglomerados rurais e área rural
(= **rural**). Distribuição nacional, exaustiva:

| `SITSET` | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | nulo / `0` / `9` |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| n | 11.892.728 | 83.506 | 85.813 | 145.220 | 398.490 | 24.234 | 7.726 | 4.407.995 | **0** |

`SITSET` está **sempre preenchido e sempre em 1–8** — nenhum nulo, nenhum `'0'`, nenhum `'9'`.
O `ELSE 'R'` do `CASE` é seguro. Validação cruzada da variável e do peso ao mesmo tempo: a
proporção **ponderada** de população urbana resultante é **75,60%**, contra os 75,59% publicados
pelo IBGE para 1991 (na amostra não ponderada seriam 70,76% — a diferença é o efeito do peso, e é
o que se espera).

Tamanho dos estratos: **8.939** estratos (contra 9.336 áreas de ponderação em 2000 — mesma ordem
de grandeza), mediana de **877** registros por estrato, mínimo 2; apenas **1** estrato com menos de
5 registros, 8 com menos de 20, 29 com menos de 50.

**Isto é uma aproximação, não o desenho amostral do IBGE.** A calibração de 1991 não foi feita por
município × situação, e o estrato aqui é maior (mais heterogêneo) do que uma área de ponderação
real, o que tende a **inflar** a variância estimada — erro conservador, não anticonservador.
A validação fica para depois de o pipeline rodar: comparar a distribuição do CV dos fluxos
publicados de 1991 com a de 2000 (critério: mediana e média do CV dentro de ±10 pontos
percentuais). **Se reprovar, a decisão já registrada é publicar `se` e `cv` como `NULL` em toda a
edição 1991**, mantendo `n` e o arredondamento das regras R1–R9. Nesta fase só a fórmula está
decidida; o resultado, não.

Material disponível e não usado: `data/raw1991/Arquivos Auxiliares/FRACAMO.TXT` traz as frações
efetivas de amostragem por nível geográfico, e `pipeline/labels_1991.FRACAO_1991` tem 10 entradas
(não 4.491 — **atenção, o docstring do módulo gerado diz "código município → fração efetiva %",
o que não corresponde ao conteúdo**). Uma correção de população finita a partir dessas frações é
possível e não foi adotada, para manter o estimador idêntico ao das outras três edições.

---

## 6. Escolaridade: `EDANOEST` (anos de estudo)

`EDANOEST` (303, 2) é a variável derivada de anos de estudo do próprio IBGE, com vocabulário
fechado: `0`–`17` anos, `20` "não determinado", `30` "alfabetização de adultos", `31` NSA.
Recodificação para `nivel_instr_4`, **os mesmos cortes-padrão do IBGE usados em 2000**:

| `EDANOEST` | `nivel_instr_4` | `edu_grupo` |
|---|---|---|
| `0`–`7`, **`30`** | `'1'` | `sem_instr_fund_incompleto` |
| `8`–`10` | `'2'` | `fund_completo_medio_incompleto` |
| `11`–`14` | `'3'` | `medio_completo_superior_incompleto` |
| `15`–`17` | `'4'` | `superior_completo` |
| `20` | `'5'` | `nao_determinado` |

**Decisão sobre o `30` ("alfabetização de adultos"): vai para `'1'`, não para `NULL`.** É
exatamente a escolha de 2000 (§5 do mapeamento daquela edição) e é a leitura correta do conteúdo —
quem está em alfabetização de adultos não concluiu o fundamental, e é substantivamente
"sem instrução ou fundamental incompleto". Mandá-lo para `NULL` (ou para `nao_determinado`)
misturaria uma categoria **conhecida** com uma **desconhecida** e criaria uma diferença artificial
frente a 2000. Volume: 51.666 registros entre os 25+ (0,67% do universo), grande demais para ser
descartado e pequeno demais para mover o indicador.

`edu_grupo` usa o **mesmo `CASE` de 2022/2010/2000, sem alteração**, com o mesmo universo de
**25 anos ou mais**. Distribuição de `EDANOEST` entre os 25+ (7.683.457 registros): `0` = 1.890.285;
`20` = 2.471 (0,03%); `30` = 51.666; `31` (NSA) = **0** — `EDANOEST` está preenchida para toda a
população, inclusive menores de 5 anos.

Aproximação conhecida, idêntica à de 2000: graduações de 3 anos totalizam 14 anos de estudo e caem
em `medio_completo_superior_incompleto`, então `superior_completo` fica ligeiramente subestimado
frente a 2022/2010, onde o nível vem do curso concluído.

---

## 7. Salário mínimo de referência — `Cr$ 36.161,60`

1991 é a primeira edição em que a renda **não** vem pronta em número de salários mínimos (2010:
`V6525`/`V6532`; 2000: `V4514`/`V7617`). `RPRINCIV` (454, 7) e `RDOMICIV` (236, 9) estão em
**Cruzeiros correntes**. Mas o IBGE publica, ao lado de cada uma, a **faixa já calculada em
múltiplos de salário mínimo**: `RPRINCIF` (452, 2) e `RDONOMIF` (245, 2). Isso permite recuperar o
salário mínimo implícito por reconciliação, em vez de escolhê-lo por memória histórica.

### Reconciliação de `RPRINCIF` (1–13) com `RPRINCIV` — nacional, 17,0 milhões de registros

O teste é: para cada faixa, o valor mínimo e o valor máximo observados de `RPRINCIV`, divididos
pelo candidato a SM, têm de cair dentro dos limites nominais da faixa segundo o dicionário.

| cat | faixa nominal (SM) | `RPRINCIV` mín | `RPRINCIV` máx | máx / 36.161,60 | máx / 17.000 | máx / 42.000 |
|---:|---|---:|---:|---:|---:|---:|
| 1 | até 0,25 | 1 | 9.040 | **0,25** | 0,53 ✗ | 0,22 |
| 4 | > 0,75 a 1 | 27.124 | 36.162 | **1,00** | 2,13 ✗ | 0,86 ✗ |
| 7 | > 1,5 a 2 | 54.243 | 72.323 | **2,00** | 4,25 ✗ | 1,72 ✗ |
| 10 | > 5 a 10 | 180.810 | 361.610 | **10,00** | 21,27 ✗ | 8,61 ✗ |
| 12 | > 15 a 20 | 543.000 | 723.000 | **19,99** | 42,53 ✗ | 17,21 ✗ |

**Placar completo nas 13 faixas** (razão arredondada a 2 casas, como o IBGE faria ao classificar):

| candidato | faixas reproduzidas |
|---|---|
| **Cr$ 36.161,60** | **13 / 13** |
| Cr$ 17.000,00 (vigente até agosto/1991) | 1 / 13 |
| Cr$ 42.000,00 (candidato do plano para setembro/1991) | 1 / 13 |
| Cr$ 12.325,60 (janeiro/1991) | 1 / 13 |
| Cr$ 15.895,46 (fevereiro/1991) | 1 / 13 |

**Os dois candidatos do plano estão ambos errados**, e não por pouco: erram 12 das 13 faixas.

### Confirmação independente, pelo lado do domicílio

Mesma reconciliação com `RDONOMIF` × `RDOMICIV` (11 faixas, outro quesito, outro universo —
arquivos de MG, ES e RJ): **11/11 faixas** reproduzidas com Cr$ 36.161,60. Esse teste ainda **crava
o centavo**: a faixa 3 ("> 0,5 a 1 SM") termina em `RDOMICIV = 36.161` e a faixa 4 ("> 1 a 2 SM")
começa em `36.164`, o que exclui 36.162 e qualquer valor acima — o limite de 1 SM está entre
36.161 e 36.164, e 36.161,60 é o único valor "redondo" no intervalo.

**Conclusão: `salario_minimo = 36161.60`** (Cruzeiros, vigente na data de referência do Censo,
01/09/1991), gravado em `pipeline/edicoes.py`. Ressalva honesta: o valor foi **derivado dos
próprios dados**, reconciliado contra duas variáveis de faixa independentes do IBGE; **não foi
cross-checado contra uma fonte legal externa** (sem acesso à internet nesta sessão, e o DVD não
documenta o SM usado). A evidência interna é forte — 24 limites de faixa reproduzidos ao
cruzeiro —, mas quem tiver acesso à legislação de 1991 deve confirmar antes da publicação final.

### Consequências para as colunas de renda

- `renda_trab` = `RPRINCIV / 36161.60`, em SM. `NULL` para `9999998` (NSA, 10.707.861 registros =
  não ocupados) e `9999999` (ignorado, 111.689 = `RPRINCIF = 15` "sem declaração").
  `RPRINCIF = 14` ("sem rendimento", 297.028) vem com `RPRINCIV = 0` → `renda_trab = 0`, **não**
  `NULL`: trabalhador sem rendimento é um valor medido, como em 2000.
- `renda_pc` = `RDOMICIV / 36161.60 / <moradores elegíveis>`, em SM (§4).
- Os cortes relativos de `renda_classe` (1/4, 1/2, 1, 2 SM) e de `renda_trab_classe`
  (1, 2, 3, 5 SM) ficam **idênticos** aos das outras três edições. Nenhum deflator é aplicado:
  o corte é relativo ao SM de cada censo, que é o que torna as edições comparáveis apesar do
  Cruzeiro, do Real e da hiperinflação de 1991.
- `renda_trab_classe` fica **`NULL`** mesmo assim — é dimensão exclusiva do módulo pendular
  (`07_pendular.sql`), que 1991 não publica (§8). `renda_trab` em si é preenchida, por ser barata
  e verdadeira, e por servir ao QA da conversão.

---

## 8. O que **não existe** em 1991

**Não há deslocamento pendular.** O questionário da amostra de 1991 não pergunta em que município
a pessoa trabalha ou estuda. `LOCTRAB` (379, 1) — a variável que mais se parece com isso — é o
**tipo de local de trabalho**, não o município: `1`/`2` no domicílio, `3`/`4` via pública,
`5` propriedade agropecuária, `6` empresa ou firma, `7` casa do cliente/patrão, `8` outro, `9` NSA.
Distribuição nacional: 3.364.331 em "empresa ou firma", 1.700.148 em "propriedade agropecuária",
10.707.861 brancos (exatamente os não ocupados). **`LOCTRAB` não deve ser usado para nada de
pendular, nem como proxy.** `pipeline/edicoes.py` já declara `pendular=False` e `pula_scripts=["07"]`
para esta edição.

Colunas do contrato que ficam **`NULL` explícito** (`CAST(NULL AS <tipo>)`, nunca `0`/`FALSE`):

| # | Coluna | Tipo | Motivo |
|---:|---|---|---|
| 11 | `imp_df_local` | VARCHAR | 1991 não divulga marcas de imputação (como 2010; 2000 tem). |
| 12 | `imp_df_mun` | VARCHAR | idem |
| 13 | `imp_trab_mun` | VARCHAR | idem, e não há quesito de município de trabalho |
| 14 | `trab_local` | VARCHAR | sem quesito de município de trabalho |
| 15 | `trab_uf` | VARCHAR | idem |
| 16 | `trab_mun` | VARCHAR | idem |
| 17 | `retorna_3dias` | VARCHAR | sem quesito de frequência de retorno |
| 18 | `transporte` | VARCHAR | sem quesito de meio de transporte |
| 19 | `tempo_desloc_cat` | VARCHAR | sem quesito de tempo de deslocamento |
| 20 | `tempo_desloc_min` | INTEGER | idem |
| 23 | `curso` | VARCHAR | dimensão `nivel` é exclusiva do módulo pendular de estudo |
| 24 | `estudo_local` | VARCHAR | sem quesito de município de estudo |
| 25 | `estudo_uf` | VARCHAR | idem |
| 26 | `estudo_mun` | VARCHAR | idem |
| 29 | `pendular_trab` | BOOLEAN | **`NULL`, não `FALSE`** — "não medido" ≠ "medido e negativo" |
| 30 | `pendular_estudo` | BOOLEAN | idem |
| 31 | `pos_grupo` | VARCHAR | dimensão exclusiva do módulo pendular |
| 32 | `setor_grupo` | VARCHAR | idem |
| 33 | `ocup_grupo` | VARCHAR | idem |
| 34 | `modo_grupo` | VARCHAR | idem, e sem quesito de transporte |
| 35 | `renda_trab_classe` | VARCHAR | idem (§7) |
| 36 | `curso_grupo` | VARCHAR | idem |

Comparação com a lista de 2000, como pedido: 2000 deixa `NULL` apenas as colunas 17–20 e 34
(`retorna_3dias`, `transporte`, `tempo_desloc_cat`, `tempo_desloc_min`, `modo_grupo`). **1991
acrescenta 16 colunas** — as 14 restantes da tabela acima mais `imp_df_local` e `imp_df_mun`, que
2000 preenche e 2010 já deixava nulas. Nenhuma coluna que 2000 preenche e 1991 também poderia
preencher ficou de fora.

**Material disponível e deliberadamente não publicado** (mesma regra da zona urbano/rural de 1995
em 2000 — fica registrado como matéria-prima para análise futura, não vira coluna do contrato):

- **Última etapa migratória.** `MIANTEUF` (390, 2) e `MIANTEMU` (386, 4) dão a UF e o município da
  **residência imediatamente anterior** — um quesito que 2000, 2010 e 2022 não têm no contrato
  publicado (as três colapsam tudo em `nao_natural` / `origem = data fixa`). **Decisão: não
  publicar como coluna.** Publicá-la criaria um eixo sem par em nenhuma outra edição, e criaria
  ambiguidade sobre qual é "a" origem de um migrante de 1991 — um seletor com dois conceitos de
  origem confundiria mais do que informaria. A informação continua nos microdados e pode virar
  uma análise avulsa.
- `MIMO86ZN` (399, 1): zona urbana/rural da moradia em 1986 — o análogo exato do `V0424` de 2000,
  e pela mesma razão não aproveitado.
- `MIANTEZN`, `MIMUMOZN`, `MIANORES`, `RACACOR`, `RELIGIAO`, `DEFICIE`, o bloco de fecundidade
  (`FL*`), o bloco de mortalidade (`UVIVID*`, `SC*`) e todo o bloco de características do
  domicílio.

**Armadilha de tempo de residência.** `MIANMOMU` (380, 2, "anos que mora no município"),
`MIANMOUF` (382, 2) e `MIULTMUD` (405, 2, "última mudança") **não devem ser usados para
identificar migrante de data fixa** — é a mesma armadilha do `V0416` de 2000 e do `V0624` de 2010:
esses contadores medem tempo desde o último retorno/última mudança, não a posição em 01/09/1986.
A identificação correta é **só** por `MIMO86UF` / `MIMO86MU`.

**Raça/cor não é publicada.** `RACACOR` (422, 1) existe e está bem preenchida (8.685.312 branca,
7.338.017 parda, 861.007 preta, 67.338 amarela, 35.793 indígena, 58.245 ignorada). Mas o contrato
de 49 colunas **não tem coluna de raça/cor em nenhuma das três edições já publicadas** (conferido
nos esquemas de `pessoas_classificado.parquet` de 2022, 2010 e 2000). Introduzi-la só em 1991
quebraria o contrato e produziria um recorte disponível numa edição e ausente nas outras — além de
exigir uma decisão de revelação nova (R1–R9 não têm limiar calibrado para essa dimensão).
**Decisão: não publicar.** Se o atlas quiser a dimensão raça/cor, ela deve entrar por todas as
edições de uma vez, como mudança de contrato.

---

## 9. Contrato de `pessoas_classificado.parquet` — as 49 colunas, na ordem

Mesmo nome, mesma ordem e mesmo tipo de 2022/2010/2000 (esquema conferido nos três parquets).

| # | Coluna | Tipo | Variável(is) 1991 | Lógica resumida |
|---:|---|---|---|---|
| 1 | `uf` | VARCHAR | `UFNUM` | passthrough |
| 2 | `cd_mun` | VARCHAR | `UFNUM‖MUNICNUM` + dicionário | 7 díg. via join (§0) |
| 3 | `cd_apond` | VARCHAR | `cd_mun`, `SITSET` | `cd_mun ‖ 'U'/'R'` (§5) |
| 4 | `controle` | VARCHAR | `PESSOAN` | contador por `PESSOAN=1` (§0) |
| 5 | `peso` | DOUBLE | `PESO` | sem divisor (§0) |
| 6 | `idade` | INTEGER | `IDADEANO` | passthrough |
| 7 | `df_mun` | VARCHAR | `MIMO86UF‖MIMO86MU` | §2; `NULL` = origem não informada |
| 8 | `df_uf` | VARCHAR | `MIMO86UF` | §2; `NULL` para 54/80/99 |
| 9 | `nivel_instr_4` | VARCHAR | `EDANOEST` | §6 |
| 10 | `renda_pc` | DOUBLE | `RDOMICIV`, `PARENDOM`, `ESPECIE` | §4, em SM |
| 11 | `imp_df_local` | VARCHAR | — | `NULL` (§8) |
| 12 | `imp_df_mun` | VARCHAR | — | `NULL` (§8) |
| 13 | `imp_trab_mun` | VARCHAR | — | `NULL` (§8) |
| 14 | `trab_local` | VARCHAR | — | `NULL` (§8) |
| 15 | `trab_uf` | VARCHAR | — | `NULL` (§8) |
| 16 | `trab_mun` | VARCHAR | — | `NULL` (§8) |
| 17 | `retorna_3dias` | VARCHAR | — | `NULL` (§8) |
| 18 | `transporte` | VARCHAR | — | `NULL` (§8) |
| 19 | `tempo_desloc_cat` | VARCHAR | — | `NULL` (§8) |
| 20 | `tempo_desloc_min` | INTEGER | — | `NULL` (§8) |
| 21 | `renda_trab` | DOUBLE | `RPRINCIV` | `/ 36161.60` (§7) |
| 22 | `freq_escolar` | VARCHAR | `EDGRAU`, `EDCURSNS` | `'1'` frequenta / `'4'` não |
| 23 | `curso` | VARCHAR | — | `NULL` (§8) |
| 24 | `estudo_local` | VARCHAR | — | `NULL` (§8) |
| 25 | `estudo_uf` | VARCHAR | — | `NULL` (§8) |
| 26 | `estudo_mun` | VARCHAR | — | `NULL` (§8) |
| 27 | `ocupado` | BOOLEAN | `POSOCUP` | `COALESCE(ocupado_10 = '1', FALSE)` — universo 10+ verificado |
| 28 | `estudante` | BOOLEAN | `EDGRAU`, `EDCURSNS` | `COALESCE(freq_escolar = '1', FALSE)` |
| 29 | `pendular_trab` | BOOLEAN | — | `CAST(NULL AS BOOLEAN)` (§8) |
| 30 | `pendular_estudo` | BOOLEAN | — | `CAST(NULL AS BOOLEAN)` (§8) |
| 31 | `pos_grupo` | VARCHAR | — | `NULL` (§8) |
| 32 | `setor_grupo` | VARCHAR | — | `NULL` (§8) |
| 33 | `ocup_grupo` | VARCHAR | — | `NULL` (§8) |
| 34 | `modo_grupo` | VARCHAR | — | `NULL` (§8) |
| 35 | `renda_trab_classe` | VARCHAR | — | `NULL` (§7, §8) |
| 36 | `curso_grupo` | VARCHAR | — | `NULL` (§8) |
| 37 | `is_migrante` | BOOLEAN | `df_local` | `COALESCE(df_local IN ('2','3'), FALSE)` |
| 38 | `is_mig_interno` | BOOLEAN | `df_local` | `COALESCE(df_local = '2', FALSE)` |
| 39 | `is_mig_internacional` | BOOLEAN | `df_local` | `COALESCE(df_local = '3', FALSE)` |
| 40 | `origem_conhecida` | BOOLEAN | `df_local`, `df_mun` | `COALESCE(df_local='2' AND df_mun IS NOT NULL, FALSE)` (§2.5) |
| 41 | `origem_valida` | BOOLEAN | idem + `cd_mun` | `origem_conhecida AND df_mun <> cd_mun` |
| 42 | `interestadual` | BOOLEAN | `df_local`, `df_uf`, `uf` | `COALESCE(df_local='2' AND df_uf IS NOT NULL AND df_uf <> uf, FALSE)` |
| 43 | `status` | VARCHAR | `df_local`, `nasc_local`, `nacionalidade`, `df_mun` | §3, vocabulário reduzido |
| 44 | `retorno_uf_natal` | BOOLEAN | `df_local`, `nasc_local`, `nasc_uf`, `uf`, `df_uf` | §3 |
| 45 | `edu_grupo` | VARCHAR | `nivel_instr_4`, `idade` | **mesmo `CASE` das outras edições**, universo 25+ |
| 46 | `renda_classe` | VARCHAR | `renda_pc` | mesmos cortes (1/4, 1/2, 1, 2 SM); `NULL` → `nao_aplicavel` |
| 47 | `idade_grupo` | VARCHAR | `idade` | idêntico às outras edições; `NULL` para <5 |
| 48 | `sexo_label` | VARCHAR | `SEXO` | `1→'M'`, `2→'F'`, `ELSE 'ignorado'` (o `ELSE` nunca ocorre) |
| 49 | `idade_sexo_grupo` | VARCHAR | `idade`, `SEXO` | idêntico às outras edições |

**Universo.** O filtro de 5 anos ou mais vale para o quesito de data fixa e, como nas outras
edições, é estrutural: `MIMO86UF` só é preenchida para quem tem 5 anos ou mais (§2.2). As colunas
`idade_grupo`/`idade_sexo_grupo` já saem `NULL` para menores de 5.

---

## 10. Dependências fora do SQL (para o `implementador`)

1. **`scripts/prep_1991.py` está errado** e os 27 TXT precisam ser regerados — `PESSOAN` em
   `(418, 2)`, não no fallback `(380, 1)` (§0). Sem isso, `controle` está errado e `se`/`cv` da
   edição inteira saem inválidos. É a única dependência **bloqueante**.
2. `pipeline/edicoes.py`: `salario_minimo = 36161.60` (já atualizado nesta entrega, §7).
3. `pipeline/sql/1991/08_metro.sql` precisa de override: com `pendular = False`, a tripla
   origem → residência → trabalho do módulo metropolitano não existe, e `pct_diario`,
   `pct_coletivo` e `tempo_mediano` são todos `CAST(NULL AS DOUBLE)`. Só `pula_scripts = ["07"]`
   não basta.
4. `web/src/lib/edicoes.ts`: entrada `"1991"` com todos os recursos pendulares desligados e
   `statusCategorias` = o vocabulário reduzido.
5. `pipeline/labels_1991.FRACAO_1991` tem 10 entradas, e o docstring do módulo a descreve como
   "código município → fração efetiva %" — a descrição não corresponde ao conteúdo. Não é usada por
   esta especificação, mas vale corrigir ou remover (§5).

---

## 11. Lista de verificações para o QA da F2 (edição 1991)

1. Σ `peso` da amostra ≈ **146.815.790** (Censo 1991: 146.825.475, −0,007%).
2. **17.045.712** registros, **27** UFs, **4.491** municípios distintos, todos presentes em
   `MUNICIPIOS_1991` **e** em `labels.RECORTES` (verificado: 0 faltantes).
3. `COUNT(DISTINCT controle)` = **4.024.553** = `COUNT(PARENDOM=1)` (3.971.593) +
   `COUNT(PARENDOM=20)` (52.960); média de 4,24 pessoas por domicílio. **Se der 1.726.116, o
   `prep_1991.py` não foi corrigido — parar.** Conferir também RR = 5.486 domicílios / 23.102
   pessoas contra o `LEIA_ME.DOC`.
4. Proporção **ponderada** de população urbana (`SITSET ∈ {1,2,3}`) = **75,60%**; `SITSET` sempre
   em 1–8, zero nulos.
5. Zero registros com `MIMO86UF ∈ ('11'..'53')` e `MIMO86UF‖MIMO86MU` sem par em
   `MUNICIPIOS_1991`. **Falhar alto se > 0.**
6. `df_local = '2'` em **10,68%** dos 5+ (Σ peso 13.916.688); `df_local = '3'` em 0,05%.
7. Σ imigrantes = Σ emigrantes; Σ saldos = 0; zero pares origem = destino em `fluxos_bruto`
   (os 23 registros inconsistentes são removidos por `origem_valida`).
8. `POSOCUP ∈ 1..11` ⇔ `RPRINCIF ∈ 1..15`, zero discordâncias; `MIN(idade)` entre ocupados = 10.
9. `<moradores elegíveis> <= <total de moradores>` em 100% dos domicílios particulares (§4).
10. `renda_pc` nula em 100% dos registros com `ESPECIE = '3'` (74.902 registros).
11. Todas as 22 colunas da tabela do §8 nulas em **100%** das linhas; nenhuma delas com `0`,
    `FALSE` ou string vazia.
12. `status` só assume os 7 valores do §3; `origem_nao_informada` ≈ 3,0% dos migrantes internos,
    `retorno_natal` ≈ 9,3%, `nascido_exterior` ≈ 0,3%.
13. **8.939** estratos distintos em `cd_apond`; nenhum com 0 registros; comparar a distribuição do
    CV dos fluxos com a de 2000 (§5) — critério de ±10 p.p. na mediana e na média.
