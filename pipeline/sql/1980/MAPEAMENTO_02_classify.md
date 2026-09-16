# Mapeamento de variáveis — edição Censo 1980 (proxy de data fixa 1975–1980)

Documento de decisão do metodólogo (F9.2), para o agente que vai escrever
`pipeline/sql/1980/01_extract.sql`, `02_classify.sql`, `04_flows.sql`, `07_pendular.sql` e
`08_metro.sql`. **Não é SQL**: é a especificação linha a linha do que cada coluna do contrato deve
conter. O cabeçalho de comentário a colar no topo do `02_classify.sql` está em
`pipeline/sql/1980/CABECALHO_02_classify.txt`; a justificativa em prosa entrou direto em
`docs/METODOLOGIA.md`, seção "Edição Censo 1980 e comparabilidade" (rascunho, F9.7 revisa).

Fontes usadas:

- `data/raw1980/pessoa_<uf>.parquet` (27 arquivos, 29.378.753 linhas, Σ `v604` = 119.011.062),
  extraídos da **Base dos Dados** (`basedosdados.br_ibge_censo_demografico.microdados_pessoa_1980`)
  por `scripts/extract_1980_bd.py` em F9.1.
- `~/Downloads/Censo 1980/Documentação/Documentação - 12.doc` — **dicionário oficial do IBGE**
  (posição, largura e categorias de cada variável do arquivo TXT de 204 bytes).
- `~/Downloads/Censo 1980/Variaveis Auxiliares/*.txt` — tabelas auxiliares públicas
  (`V512`, `V530 e V542`, `V532 e V544`, `V606`, `V680 - V681 - V682`).
- `pipeline/labels_1980.py` (`MUNICIPIOS_1980`/`MUN6_1980`, 3.991 códigos derivados da malha
  municipal 1980 do IBGE; `PAISES_V512_1980`; `FAIXAS_SM_1980`).
- `data/interim/1991/raw_txt/*.txt` — **só para a calibração do proxy** (§2.6).
- Consultas **agregadas** (contagens, somas de peso, cruzamentos com n ≥ 5, correlações) sobre os
  parquets acima. Nenhum registro individual foi lido, impresso ou exportado.

---

## 0. Armadilhas desta edição (ler antes de escrever o `01_extract.sql`)

| # | Item | Por que quebra silenciosamente |
|---:|---|---|
| 0.1 | **Não há quesito de data fixa.** A migração publicada é um **proxy** de `v517` (tempo de residência no município) × `v518` (município de residência anterior = *última etapa*). | Apresentar 1980 como "quem morava em outro município há 5 anos" é falso. Ver §2 e o selo `proxy_data_fixa` já declarado em `pipeline/edicoes.py["1980"]`. |
| 0.2 | **Ceará é uma partição com codificação própria.** `v518`/`v527` em CE vêm com **6 dígitos** (`UF‖MUNIC`, sem dígito verificador) e não 7; `v518` de não migrante em CE é **NULL**, não `'0000000'`; `v528`/`v529` usam `'0'` como NSA de menores de 10 anos; `v524` tem 15,2% de NULL. | O `extract_1980_bd.py` faz `LPAD(CAST(v518 AS INT64), 7, '0')`, então o código de 6 dígitos chega como `'0230440'`. Sem a regra de §2.3, **100% das origens do Ceará** (190.963 registros) viram "sem par no dicionário". |
| 0.3 | **A renda existe só no Ceará.** `v607`–`v613`, `v680`, `v681`, `v682` estão preenchidas em **CE e em nenhuma das outras 26 UFs** (0,0% em todas). | `renda_trab`, `renda_pc`, `renda_classe` e `renda_trab_classe` ficam **NULL na edição inteira** (§7). Publicar a renda do Ceará sozinha produziria um mapa em que 26 UFs são "sem informação". |
| 0.4 | **178.338 registros de Goiás não têm município.** São os 52 municípios do norte de Goiás que hoje formam o Tocantins; a BD não publica o código de 6 dígitos original, e a extração não tem chave de linha que permita casar com a cópia DBF pública. | Ver §3. Os RESIDENTES são excluídos: **o território não é unidade da edição**. Quem SAIU de lá, porém, tem origem e destino conhecidos e é publicado sob uma origem agregada (§3.4). |
| 0.5 | **Fernando de Noronha chega com `id_municipio` NULL.** 298 registros com `sigla_uf = 'FN'`; a BD não atribui geocódigo (ao contrário do que o plano presumia). | Ver §4. A atribuição a `2605459` tem de ser feita por `sigla_uf`, e **também no lado da origem** (`v518 = '2000107'` e `'2000008'`). |
| 0.6 | **`UF_SEQ_1980` em `pipeline/labels_1980.py` está errado nas entradas `'07'`–`'14'`.** Ele mapeia `'07'→'17'` (Tocantins, que não existe em 1980) e desloca tudo até `'14'→'27'`. O correto, segundo `PAISES_V512_1980` no mesmo módulo e confirmado nos dados, é `'07'→'21'` (MA), `'08'→'22'` (PI), `'09'→'23'` (CE), `'10'→'24'` (RN), `'11'→'25'` (PB), `'12'→'26'` (PE), `'13'→'27'` (AL), `'14'` = Fernando de Noronha (ver §4); de `'15'` em diante as duas tabelas coincidem. | `nasc_uf` sairia errado para 8 UFs, inclusive as três mais populosas do Nordeste. **Dependência bloqueante para o implementador** (§11.1). Confirmação empírica: `v512 = 14` tem **670** registros (Fernando de Noronha, ~1.300 habitantes) — se fosse Alagoas teriam de ser ~2 milhões; `v512 = 12` tem 1.784.069 (PE) e `v512 = 9` tem 1.525.452 (CE), coerentes com `PAISES_V512_1980` e absurdos com `UF_SEQ_1980`. |
| 0.7 | **`CATEGORIAS_1980` em `pipeline/labels_1980.py` é lixo gerado.** Atribui `{1: 'sim', 2: 'nao', 9: 'ignorado'}` a quase todas as variáveis, inclusive `V501` (sexo: `1` homem, `3` mulher), `V511` (nacionalidade: `2`/`4`/`6`), `V513` (`1` sim / `8` não) e `V598` (`0` urbano / `1` rural). | **Não usar `CATEGORIAS_1980` para nada.** As categorias corretas estão neste documento, tiradas do dicionário oficial. |
| 0.8 | **Não há chave de domicílio.** `numero_ordem` é a ordem da pessoa (1–29). | `controle = NULL`, `se`/`cv` NULL, `renda_pc` NULL — decisão já fechada em F9.0 (§8). |
| 0.9 | **`v606 = 999` é "idade ignorada"** (28.697 registros), não 999 anos. | `idade = NULL`; esses registros ficam fora do universo de 5+ e de todos os cortes etários. |
| 0.10 | **`v604` (peso da pessoa) é inteiro e não tem divisor.** Σ = 119.011.062 contra 119.002.706 da população recenseada (+0,007%). | Não dividir por 1e2/1e8/1e13 como em outras edições. |

---

## 1. Colunas intermediárias — `01_extract.sql` → `data/interim/1980/pessoas.parquet`

| Coluna do extrato | Variável(is) 1980 | Lógica | Observação |
|---|---|---|---|
| `uf` | `sigla_uf` | tabela sigla → código IBGE de 2 díg.; `'FN'` → `'26'` (PE) | Ou `SUBSTR(cd_mun, 1, 2)`, que dá o mesmo resultado depois de §4. |
| `cd_mun` | `id_municipio`, `sigla_uf` | `CASE WHEN sigla_uf = 'FN' THEN '2605459' ELSE id_municipio END` | 7 díg. **Filtrar fora** `sigla_uf = 'GO' AND id_municipio IS NULL` (§3). Resultado: **3.939** municípios. |
| `cd_apond` | `cd_mun`, `v598` | `cd_mun \|\| CASE WHEN v598 = '0' THEN 'U' ELSE 'R' END` | `v598`: `0` urbano (19.908.509), `1` rural (9.470.244), sempre preenchida. Coluna do contrato apenas — **não é UPA**, e `se`/`cv` saem NULL (§8). |
| `controle` | — | `CAST(NULL AS VARCHAR)` | Sem chave de domicílio (§8). |
| `peso` | `v604` | `CAST(v604 AS DOUBLE)`, **sem divisor** | §0.10. |
| `sexo` | `v501` | `'1'` → 1 (masculino); `'3'` → 2 (feminino) | **Atenção: `3`, não `2`.** Sem outras categorias. |
| `idade` | `v606` | `CASE WHEN v606 = 999 THEN NULL ELSE v606 END` | §0.9. |
| `anos_mun` | `v517` | `TRY_CAST` → INTEGER, só para QA do proxy | `0` <1 ano; `1`–`5` anos exatos; `6` 6 a 9 anos; `7` 10 anos ou mais; `8` nasceu aqui; `9` sem declaração. |
| `org6` | `v518` | `CASE WHEN v518 IS NULL OR v518 = '0000000' THEN NULL WHEN SUBSTR(v518,1,1) = '0' THEN SUBSTR(v518,2,6) ELSE SUBSTR(v518,1,6) END` | **Regra do Ceará** (§2.3). Produz sempre um código de 6 díg. `UF‖MUNIC` ou uma sentinela `80…`/`54…`/`99…`/`20…`. |
| `df_local` | `v517`, `org6` | §2.2 | Vocabulário de `P0600`/2022. |
| `df_uf` | `org6` + dicionário de unidades | UF da **unidade de origem** quando `org6` resolve (o que dá `'17'` para os 52 códigos do norte de Goiás — §3); senão `SUBSTR(org6,1,2)` quando `BETWEEN '11' AND '53'`; `'26'` quando `'20'` (Fernando de Noronha, §4); **`NULL`** para `'54'`, `'80'`, `'99'` | Mesma convenção de 1991: **sem sentinela**, `NULL` explícito (§2.5). A UF vem da unidade, não do prefixo, para `interestadual` e `fluxos_uf` não se contradizerem (§3). |
| `df_mun` | `org6` + `muni_lookup` | `JOIN` de `org6` com os prefixos de 6 díg. das UNIDADES da edição → código da unidade; os 52 códigos do norte de Goiás → `'NORTEGO'` (§3); `'200000'`/`'2000107'` → `'2605459'` (§4); `NULL` nas sentinelas | Toda origem que a fonte informa tem unidade desde F9.9 — não há mais origem conhecida sem onde pendurar. |
| `trab6` | `v527` | mesma regra de `org6`, aplicada a `v527` | §6. |
| `nasc_local` | `v513`, `v512` | `'1'` se `v513 = '1'`; se `v513 = '8'`: `'2'` quando `v512 ∈ 1..29`, `'3'` quando `v512 ∈ 30..99` | Vocabulário de `P0480`. §5. |
| `nasc_uf` | `v513`, `v512` | a própria `uf` quando `v513 = '1'`; `UF_SEQ_1980[LPAD(v512,2,'0')]` **corrigido** (§0.6) quando `v513 = '8'` e `v512 ∈ 1..27`; `'26'` quando `v512 = 14`; `NULL` quando `v512 = 29` ou ≥ 30 | §5. |
| `nacionalidade` | `v511` | `'2'` → `'1'` (nato); `'4'` → `'2'` (naturalizado); `'6'` → `'3'` (estrangeiro) | **Recodificar**: 1980 usa 2/4/6, o contrato usa 1/2/3 como em 2022. Sempre preenchida (zero brancos). |
| `nivel_instr_4` | `v523`, `v524` | §5.3 | **Derivado**, como em 2000/1991. |
| `ocupado_10` | `v529`, `idade` | `'1'` se `v529 = '0' AND idade >= 10`; `'2'` se `idade >= 10` e o resto; `NULL` se `idade < 10` ou nula | §6.1. **O filtro de 10 anos é obrigatório** — sem ele a taxa de ocupação nacional sai em 41,7% em vez de 35,47%. |
| `freq_escolar` | `v521`, `v522` | `'1'` se `v521 BETWEEN '1' AND '8'` **ou** `v522 BETWEEN '1' AND '8'`; senão `'4'` | 1980 não separa rede pública de particular; o contrato só precisa de "frequenta / não frequenta". |
| `renda_*` | — | `CAST(NULL AS DOUBLE)` | §7 — a renda só existe no Ceará. |

---

## 2. Migração: o proxy de data fixa 1975–1980

### 2.1 O que o Censo 1980 pergunta, e o que ele não pergunta

O Censo 1980 **não tem quesito de data fixa**. Tem três quesitos de migração encadeados:

- `v516` (70, 1) — tempo de residência **na UF atual**;
- `v517` (71, 1) — tempo de residência **no município atual**: `0` menos de 1 ano; `1`–`5` o número
  exato de anos; `6` de 6 a 9 anos; `7` 10 anos ou mais; `8` "nasceu"; `9` sem declaração;
- `v518` (72, 7) — **"Unidade da Federação do município que morava anteriormente"**, apesar do nome:
  é o **código de município** de 7 dígitos da residência **imediatamente anterior** (*última etapa*).

O quesito de origem só foi feito a quem mora no município **há menos de 10 anos**, e foi feito
inclusive aos naturais do município (o que torna o retorno mensurável — Rigotti, NEPO/Unicamp,
cap. VII). Verificado, nacional e exaustivo:

| `v517` | `v518` | n |
|---|---|---:|
| `0`–`6` (menos de 10 anos) | preenchido, 7 díg. | 6.304.634 |
| `7` (10 anos ou mais) | `'0000000'` | 5.907.024 |
| `8` (nasceu) | `'0000000'` ou NULL (Ceará) | 16.168.223 + 942.912 |
| `9` (sem declaração) | `'0000000'` (48.001) / preenchido (7.959) | 55.960 |

**A sentinela de "não mudou" é `'0000000'`** (e `NULL` no Ceará, §0.2) — não existe um valor
"mesmo município". Ou seja: `v517` sozinho decide quem é migrante; `v518` só diz de onde.

### 2.2 Regra de classificação

Universo: **5 anos ou mais de idade** (`v606 >= 5`, `v606 <> 999`), como nas outras quatro edições.

```
v517 NOT IN ('0','1','2','3','4')                 -> df_local = '1'  (não migrante)
v517 IN ('0','1','2','3','4') e:
    org6 IS NULL                                  -> df_local = '2', origem não informada
    SUBSTR(org6,1,2) = '80'                       -> df_local = '3'  (internacional)
    SUBSTR(org6,1,2) IN ('54','99')               -> df_local = '2', origem não informada
    SUBSTR(org6,3,4) = '0000'                     -> df_local = '2', df_uf conhecida, df_mun NULL
    senão                                         -> df_local = '2', df_mun = MUN6_1980[org6]
```

**A janela é quinquenal por decisão, não por desenho do questionário**: `v517 ∈ 0..4` significa
"chegou ao município atual entre 01/09/1975 e 01/09/1980", alinhado aos quinquênios das outras
edições. O universo real do quesito de origem é **decenal** (`v517 ∈ 0..6`); o decenal entra na
calibração (§2.6) e na metodologia, **nunca nas tabelas publicadas**.

`v517 = '5'` ("5 anos exatos") fica **fora** do universo de migrante: a calibração em 1991 mostra
que o análogo exato (`MIANMOMU = 5`) tem **zero** migrantes de data fixa verdadeiros em 279.530
registros — a fronteira é limpa e o corte `< 5` é o correto.

### 2.3 A regra do Ceará: `v518`/`v527` com 6 dígitos

`scripts/extract_1980_bd.py` grava `LPAD(CAST(CAST(v518 AS INT64) AS STRING), 7, '0')`. Nas 26
partições normais o valor original tem 7 dígitos e nada muda. **No Ceará o valor original tem 6**
(`UF‖MUNIC`, sem dígito verificador), e o `LPAD` acrescenta um zero à esquerda. Evidência:

| Verificação | Resultado |
|---|---|
| Registros com `v518` começando em `'0'` (≠ `'0000000'`) | 190.963 — **todos em `sigla_uf = 'CE'`**, e são **100%** dos `v518` preenchidos do Ceará |
| Mesma anomalia em `v527` | 13.090 — **todos em CE** |
| `SUBSTR(v518, 2, 6)` casa com `MUN6_1980` | **179.772** registros / 1.227 códigos distintos |
| Os 11.191 restantes | são `UF‖'0000'` (ex.: `'0230000'` = Ceará sem município, 8.663) e as sentinelas `'0800000'` (exterior, 193), `'0540000'` (91), `'0990000'` (21) — **o mesmo conjunto de sentinelas das outras UFs, em 6 dígitos** |
| UF de origem recuperada, top | `23` (o próprio Ceará) 157.396; depois `35`, `26`, `22`, `25`, `24`, `21` — padrão migratório plausível |
| Interpretação alternativa (dígito perdido à direita) | descartada: não casaria com nenhum código e produziria UFs inexistentes |

Não há ambiguidade possível: **nenhum código de UF brasileiro começa com `0`**, então um `v518` que
começa com `0` é sempre um código de 6 dígitos deslocado. Regra: se `SUBSTR(v518,1,1) = '0'` e
`v518 <> '0000000'`, o código é `SUBSTR(v518,2,6)`; senão é `SUBSTR(v518,1,6)`.

**Isto encerra o achado "prefixos 01-09" de `docs/qa/sonda_1980_bd.md` §(c).** Os prefixos
`01`,`02`,`03`,`04`,`05`,`08`,`09` não são uma codificação de UF desconhecida nem erro de parsing:
são o segundo dígito de um código de 6 posições (`02` ⇒ UF `2x`, `03` ⇒ UF `3x` …). A cauda é
dominada por `02` (177.274) simplesmente porque a maior parte da migração do Ceará é intraestadual
(UF `23`). **Nenhuma incerteza permanece**; a decisão "tratar como origem não informada" que a
sondagem sugeria como caminho seguro seria um erro, e jogaria fora 179.772 origens municipais
válidas — 100% das do Ceará.

### 2.4 Resultado da classificação (universo 5+, após as exclusões de §3)

*(Números corrigidos em F9.7 contra o resultado publicado — ver a nota ao fim desta subseção.*
*ATENÇÃO: esta tabela é do universo de `1.0.1-1980`, SEM os 178.338 residentes do norte de Goiás.*
*Desde F9.9 eles entram (§3): a origem municipal conhecida passa a 13.803.767 e a origem não*
*informada a 1.040.706. As proporções e o argumento sobre o proxy não mudam.)*

| `df_local` | n | Σ peso | % dos 5+ |
|---|---:|---:|---:|
| `'1'` não migrante | 21.441.009 | 86.978.035 | 85,4% |
| `'2'` migrante interno, origem municipal conhecida | 3.381.506 | 13.679.916 | 13,4% |
| `'2'` migrante interno, origem não informada | 270.583 | 1.095.432 | 1,1% |
| **total de migrantes internos** | **3.652.089** | **14.775.348** | **14,5%** |
| `'3'` internacional | 26.463 | 107.535 | 0,1% |

**14,5% dos residentes de 5 anos ou mais** mudaram de município entre 1975 e 1980 segundo o proxy —
contra 10,68% em 1991 (data fixa verdadeira). Parte da diferença é real (os anos 1970 foram o pico
da migração rural-urbana e da ocupação das fronteiras agrícolas), parte é o viés do proxy
(+7,3% de volume, §2.6). **Os dois números não são diretamente comparáveis** e a UI tem de dizer
isso (selo `proxy_data_fixa`).

Decomposição da origem não informada (270.583 registros = 7,4% dos migrantes internos):

| situação | n |
|---|---:|
| `UF‖'0000'` — UF de origem conhecida, município não especificado | 253.578 |
| `'54…'` (Brasil sem especificação) e `'99…'` (ignorado) | 1.655 |
| origem no norte de Goiás — **origem conhecida sem unidade publicável** (§3.3–§3.5) | 15.350 |
| origem com par no dicionário mas igual ao destino (autoloop) | **0** |

**A terceira linha não é do mesmo tipo das duas primeiras**, e desde F9.8 isso está explícito
nos dados — mas **desde F9.9 são só duas**, ambas do próprio questionário. A terceira parcela
de antes (os 15.350 do norte de Goiás, cuja origem a fonte informa) saiu daqui: com a unidade
agregada `'NORTEGO'` (§3) eles têm `df_mun` e são `origem_valida` como qualquer migrante. A
categoria caiu de 7,4% para **7,0%** e voltou a significar só o que o nome diz.

Em 1991 a origem não informada é 3,3% dos migrantes; em 1980 é 7,0% — mais que o dobro, mas da
mesma ordem. Todos esses registros contam na **imigração total** do destino e ficam **fora da
matriz O/D** e da emigração, exatamente como nas outras edições.

> **Nota de F9.7 — por que os números desta subseção mudaram.** A versão anterior trazia 255.251
> registros de origem não informada (6,9%) e 3.396.838 de origem conhecida, e não fechava com §3.3:
> faltava a **terceira linha** da decomposição. Os 52 códigos do norte de Goiás ficam fora de
> `municipios_ref` por decisão de §3.3, então quem declarou origem lá cai em origem não informada —
> **15.350 registros** no universo publicado (5+, janela quinquenal, já retirados os residentes do
> norte de Goiás). Os 30.656 citados em §3.3 são a contagem no arquivo de entrada, **antes** da
> exclusão do destino e do corte de 5 anos ou mais; não são o número que aparece nas tabelas. A
> linha `UF‖'0000'` também caiu de 253.596 para 253.578 (18 registros) pela mesma razão de universo.
> Conferido contra `data/interim/1980/pessoas_classificado.parquet` e
> `data/processed/1980/municipios.parquet`: 270.583 = 253.578 + 1.655 + 15.350, Σ peso 1.095.432, e
> `imig_ni / (imig + imig_ni)` = 7,41% no publicado. **Regra que fica**: quando duas regras da
> edição interagem — aqui, a resolução de `org6` (§2.3/§2.5) e a exclusão de Goiás/Tocantins
> (§3.3) —, documente o número do **resultado final**, não o de cada regra medida isoladamente. O
> mesmo vale para as taxas de §6 e §12, apuradas no arquivo de entrada: as versões do universo
> publicado estão em `docs/METODOLOGIA.md`, item 6 da seção de 1980 (ocupação 35,52%, pendular
> 3,28%, escolaridade 84,91/5,75/6,04/3,23/0,07).

### 2.5 `NULL`, não sentinela

Mesma decisão de 1991, pelo mesmo motivo: as sentinelas de origem desconhecida de 1980
(`UF‖'0000'`, `'54…'`, `'99…'`) não vivem no espaço de códigos de município, e fabricar um código
de 7 dígitos criaria um valor inexistente em `MUNICIPIOS_1980` que poderia vazar num `JOIN` mal
guardado. Então:

```
origem_conhecida = COALESCE(df_local = '2' AND df_mun IS NOT NULL, FALSE)
origem_valida    = COALESCE(df_local = '2' AND df_mun IS NOT NULL AND df_mun <> cd_mun, FALSE)
interestadual    = COALESCE(df_local = '2' AND df_uf  IS NOT NULL AND df_uf  <> uf, FALSE)
```

`df_uf` **é** preenchida no caso `UF‖'0000'` (a UF de origem é conhecida), o que mantém
`interestadual` correto para os 253.578 registros desse tipo, que ficariam de fora se `df_uf`
seguisse `df_mun`.

### 2.6 Calibração do proxy contra a data fixa verdadeira de 1991

O Censo 1991 tem **os três** quesitos: tempo de residência (`MIANMOMU`), última etapa
(`MIANTEUF`/`MIANTEMU`) e data fixa verdadeira (`MIMO86UF`/`MIMO86MU`). Construiu-se sobre
`data/interim/1991/raw_txt/*.txt` **exatamente o mesmo proxy** que 1980 vai usar
(`MIANMOMU < 5` + `MIANTEUF‖MIANTEMU` como origem), no mesmo universo (5+, 15.071.836 registros,
Σ peso 130.283.012), e comparou-se com a verdade. Todos os números abaixo são agregados.

**(a) Captação — 100,0%.** Dos **1.602.229** migrantes internos de data fixa verdadeiros,
**zero** são classificados como não migrantes pelo proxy. Não é acaso: quem mudou de município
entre 1986 e 1991 mora no município atual há menos de 5 anos por construção. A captação é
**estrutural**, e é a parte forte do proxy.

**(b) Falsos positivos — 6,9%.** Dos 1.721.718 registros que o proxy chama de migrantes internos,
**118.815** (1.015.947 ponderados) não são migrantes de data fixa: são pessoas que saíram **e
voltaram** dentro do quinquênio (estavam neste mesmo município em 01/09/1986). Distribuídos de
forma quase uniforme pelos anos de residência (25.245 com <1 ano até 19.424 com 4 anos).
Consequência agregada: o proxy **infla o volume de migrantes internos em +7,5% na amostra e +7,3%
no ponderado** (14.938.430 contra 13.916.690).

**(c) Concordância da origem municipal — 89,2%.** Entre os 1.510.784 registros que proxy e verdade
concordam ser migrantes e para os quais os dois têm origem municipal:

| origem do proxy vs origem verdadeira | n | % |
|---|---:|---:|
| **mesmo município** | 1.346.962 | **89,16%** |
| outro município da mesma UF | 96.149 | 6,36% |
| **UF diferente** | 67.673 | **4,48%** |

Ou seja: **95,5% das origens estaduais estão certas**, e 89,2% das municipais. Os 10,8% errados
são migração em etapas — quem veio da Bahia para o interior de São Paulo em 1987 e se mudou para
a capital em 1990 aparece, no proxy, como migrante *intra*-São Paulo.

**(d) Efeito nas medidas publicadas — correlações altíssimas, com atenuação e um viés de distância.**

| medida | correlação proxy × verdade |
|---|---:|
| Imigração por UF (volume ponderado) | **0,9984** |
| Emigração por UF | **0,9964** |
| Taxa líquida de migração (TLM) por UF | **0,9965** |
| Imigração por município (4.491 municípios) | **0,9997** |
| Emigração por município | **0,9998** |
| TLM por município | **0,9791** |
| TLM por município, população ≥ 50 mil (399 municípios) | **0,9964** |
| Volume dos pares O/D municipais | **0,9969** |

- **Atenuação do saldo**: a regressão de TLM proxy sobre TLM verdadeira tem coeficiente **0,912**
  por UF e **0,941** por município — o proxy **encolhe** os saldos em torno de 6–9%, porque os
  falsos positivos de ida-e-volta somam imigração e emigração sem saldo.
- **Viés de distância**: a proporção de migrantes **interestaduais** cai de **35,07%** (verdade)
  para **32,96%** (proxy). A migração de etapas múltiplas transfere fluxos de longa distância para
  fluxos curtos — o proxy **subestima sistematicamente a migração interestadual** e superestima a
  intraestadual.
- **Sinal do saldo trocado em 241 de 4.491 municípios (5,4%)**, quase todos pequenos.
- **Pares O/D**: dos 218.924 pares que o proxy produz, **188.647 (86,2%)** existem na matriz
  verdadeira. Os 30.277 restantes são pares curtos gerados por etapas intermediárias.
- **Origem não informada** sobe de 3,2% (verdade) para 5,8% (proxy).

**(e) Por que o proxy decenal foi rejeitado.** Aplicando o mesmo teste com `MIANMOMU < 10`
(o universo real do quesito de origem), os falsos positivos saltam de 118.815 para **1.301.806** —
o proxy passaria a classificar como migrante do quinquênio 81% mais gente do que existe. O
quinquenal (`v517 ∈ 0..4`) é a única janela defensável.

**Selo de precisão conceitual da edição 1980**, para ir ao `meta.json` e à UI:

> O proxy capta **100%** dos migrantes de data fixa, acerta a origem municipal de **89%** deles e a
> UF de origem de **96%**, ao custo de **+7%** de volume (migração de ida-e-volta) e de uma
> subestimação de cerca de **2 pontos percentuais** na participação da migração interestadual.
> As taxas líquidas municipais reproduzem as verdadeiras com correlação de **0,98**
> (**0,996** entre municípios de 50 mil habitantes ou mais).

**Ressalva obrigatória:** a calibração foi feita em **1991**, não em 1980. Ela mede o erro do
*conceito*, não o erro *desta* edição: se a migração de retorno e de etapas múltiplas foi mais
intensa em 1975–1980 (fronteiras agrícolas, retorno do Sudeste para o Nordeste) do que em
1986–1991, os desvios acima são um **piso**. Não há como testar isso — 1980 não tem data fixa.

### 2.7 Material disponível e não publicado

- `v515` — zona urbana/rural do município de residência anterior. Análogo exato do `V0424` de 2000
  e do `MIMO86ZN` de 1991, não aproveitado pela mesma razão (não tem par no contrato).
- `v516` — tempo de residência na UF. Permitiria separar migração intra e interestadual por tempo,
  e cruzar com `v517` para detectar migração de duas etapas *dentro* do quinquênio. Fica registrado
  como matéria-prima para análise futura; não vira coluna.
- `v514` (onde morou neste município), `v509` (cor), `v503` (relação com o chefe), `v526` (estado
  conjugal), blocos de fecundidade e previdência. **Cor/raça segue não publicada**, pela mesma
  decisão de 1991: o contrato de 49 colunas não tem essa dimensão em nenhuma edição, e ela só deve
  entrar por todas de uma vez.

---

## 3. Decisão: os 52 municípios de Goiás que hoje são Tocantins

### 3.1 O fato

`docs/qa/sonda_1980_bd.md` registrou que **178.338 registros de `sigla_uf = 'GO'` têm
`id_municipio` NULL**, e que a cópia DBF pública do IBGE tem **52 códigos `UF‖MUNIC` de prefixo 52
que não aparecem na BD**, somando exatamente 178.338. Confirmado nesta análise por outro caminho:

- `MUN6_1980` tem **223** municípios de Goiás; os parquets da BD trazem **171** códigos distintos de
  GO. Diferença: **52**, exatamente os ausentes.
- O peso desses 178.338 registros é **739.049**. A população de Goiás em 1980 é 3.860.174 (soma dos
  pesos da partição GO); tirando os 739.049 restam **3.121.125**. A população do território que
  hoje é **Goiás** em 1980 era ~3,12 milhões, e a do território que hoje é **Tocantins**, ~739 mil.
  **A coincidência é exata**: os 52 municípios são, precisamente, o Tocantins.

### 3.2 O placar

| Opção | Custo | Viabilidade |
|---|---|---|
| **(i) Recuperar `id_municipio` via `UF‖MUNIC` → DTB 1980 → código atual** | zero perda | **Inviável.** A tabela da Base dos Dados **não publica o código de 6 dígitos original** — `id_municipio` é a única coluna geográfica, e nesses 178.338 registros ela é NULL. Não é uma questão de fazer o join melhor: o dado de entrada do join não existe no parquet, e nem na tabela da BD. Reextrair não resolve. |
| **(i') Casar linha a linha com a cópia DBF do IBGE** (que tem `UF`/`MUNIC`) | zero perda | **Rejeitada.** A extração veio do BigQuery **sem `ORDER BY`** e sem chave de linha; o BigQuery não preserva ordem física. Um join posicional entre 29,4 milhões de linhas de duas fontes diferentes seria uma reconstrução de registro individual sem verificação possível — o oposto do que as regras de sigilo e de qualidade deste projeto admitem. |
| **(ii) Excluir os 178.338 registros** | perde 0,61% da amostra nacional e 19,1% da amostra de Goiás | **Adotada.** |

### 3.3 A decisão, e por que ela custa menos do que parece

**Os 178.338 registros são excluídos em `01_extract.sql`** (`WHERE NOT (sigla_uf = 'GO' AND
id_municipio IS NULL)`). A perda **não** é "0,6% espalhados por Goiás": é **exatamente o território
do atual Tocantins**. O efeito real é:

- **Goiás fica publicado nos seus limites de hoje** (3.121.125 habitantes em 1980), o que torna a
  UF `52` de 1980 *mais* comparável com 2022/2010/2000/1991 do que seria com o norte incluído.
- **ATUALIZADO EM F9.9.** Os dois pontos acima descrevem a decisão de F9.2 (versão `1.0.0-1980`),
  que excluía os 178.338 registros. Desde `1.0.2-1980` eles entram na edição sob a unidade agregada
  `'NORTEGO'`, com UF `'17'` — **Goiás continua com os mesmos 3.121.125 habitantes dos seus limites
  de hoje** (a unidade não é somada a ele), e o território deixa de ser um buraco no mapa.
- Cobertura final da edição: **29.378.753 registros** e **Σ peso = 119.011.062** (100% dos
  119.002.706 recenseados). Em `1.0.0`/`1.0.1` eram 29.200.415 e 118.272.013 (99,39%).

**Lado da origem.** Os 52 códigos continuam aparecendo em `v518` de quem migrou do norte de Goiás
para o resto do país: **30.656 registros** (0,83% dos migrantes quinquenais, 127.515 ponderados) no
arquivo de entrada — e, no universo efetivamente publicado (5+, já descontada a migração *interna*
ao território, que desde F9.9 não é migração porque não muda de unidade), **15.350 registros**
(Σ peso 64.639, 0,47% dos migrantes internos). É este segundo
número que entra na decomposição de §2.4.
Eles **não** viram origem *municipal* publicada: os 52 códigos ficam **fora de `municipios_ref`**,
e esses registros continuam com `df_mun = NULL` (`df_uf = '52'`) e fora de `origem_valida`. Motivo:
publicá-los como 52 origens criaria 52 unidades com emigração, população zero, taxa de emigração
infinita e nenhum recorte de 2022 — um artefato visualmente dominante num mapa (a região mais
"esvaziada" do Brasil, por construção). Eles continuam contando na imigração total do destino.
**O que mudou em F9.8** é que o par origem→destino deles deixou de ser jogado fora: ele é publicado
sob uma **origem agregada** única, em tabela própria. Ver §3.4.

**Divergência declarada frente ao plano.** O plano F9 pré-registrava que "municípios de GO em 1980
que hoje são TO ficam em GO (UF de 1980)". Isso pressupunha que o código municipal existisse. Ele
não existe **do lado da residência**, e a decisão muda: **os residentes não ficam em lugar nenhum —
a edição declara a lacuna**. `docs/EDICOES.md` e `docs/METODOLOGIA.md` registram isso.

### 3.4 A assimetria, e o que F9.8 recuperou

A exclusão de §3.3 foi escrita como se fosse uma coisa só. São duas, e só uma delas é uma perda de
dado:

| lado | pergunta | o que a fonte tem | situação |
|---|---|---|---|
| **residência** (quem MORAVA no norte de Goiás em 1980) | em qual dos 52 municípios? | `id_municipio` NULL nos 178.338 registros; a BD não publica o código de 6 dígitos original | **perdido, em definitivo** (as 4 camadas da BD têm os mesmos 178.338 nulos). Mas é só ISSO que se perde: os 178.338 registros entram na edição sob a unidade agregada, com Σ peso 739.049. |
| **origem** (quem SAIU do norte de Goiás entre 1975 e 1980) | de qual dos 52 municípios veio? | `v518` preenchido, com um dos 52 códigos — e o destino é um município publicado normalmente | **não falta dado nenhum.** 15.350 registros / Σ peso 64.639, hoje `origem_valida` com `df_mun = 'NORTEGO'`. |

**A decisão, em três etapas (F9.2 → F9.8 → F9.9).** A forma final está descrita em
`MAPEAMENTO_norte_goias.md`, que é o documento de referência deste ponto; o resumo é: os 52 códigos
resolvem, em `muni_lookup`, para um código sintético único `'NORTEGO'` ("Norte de Goiás (atual
Tocantins)", `pipeline/unidades_agregadas_1980.py`), que **é uma unidade publicada** — tem
população (739.049), `df_mun`, `origem_valida`, UF `'17'`, malha e painel. Antes dela, F9.2 excluía
os residentes e F9.8 publicava só a emigração numa tabela à parte
(`fluxos_origem_agregada.parquet`, hoje inexistente).

**Por que UMA unidade coletiva e não as 52.** Do lado da residência a fonte não permite (a tabela
acima). Do lado da origem, onde os 52 códigos existem, a granularidade também não sobrevive à
revelação. Medido no universo publicável:

| desenho | pares O→D | passam em R1 (n ≥ 20) | massa publicada | com detalhe (n ≥ 50) |
|---|---:|---:|---:|---:|
| **1 origem coletiva** | 468 | 66 | **56.578 (87,5%)** | 52.059 (80,5%) |
| 52 origens separadas | 1.614 | 145 | 41.364 (64,0%) | 30.407 (47,0%) |

Com 52 origens, um terço do que se sabe morre no limiar, e menos da metade da massa chega ao piso
de caracterização — e o preço seriam 52 unidades sem população, malha ou recorte. A composição
municipal da unidade fica documentada em `unidades_agregadas_1980.MEMBROS` (os 52 códigos e nomes,
da malha pública de 1980), de onde pode ser recuperada se um dia houver como publicá-la.

**Por que, em F9.8, a tabela era própria — e por que deixou de ser.** O argumento de F9.8 era: a
origem não tem população, malha nem centroide, e as consultas do front cruzam `fluxos` com
`municipios_ref` e `geo/centroides.parquet` por junção interna — uma origem sem as duas coisas
simplesmente some. O caso extremo é Conceição do Araguaia/PA, cujo fluxo vindo do norte de Goiás é
de **13.795**, onze vezes o maior fluxo de entrada então visível (1.205): integrado sem malha, o
painel do município passaria a somar uma imigração que a lista de origens não explicaria, com a
"origem não informada" que a explicava reduzida a um quinto ao mesmo tempo.

O argumento estava certo, e a conclusão errada — porque a premissa ("a origem não tem malha") era
uma escolha, não um fato. As 52 feições estavam na malha do IBGE o tempo todo; `geo/fetch_1980.sh`
as removia. Dissolvê-las numa feição custou quinze linhas de shell, e com isso a origem ganhou
polígono, centroide, nome e painel. Em F9.9 a tabela separada foi **absorvida**: os mesmos pares
entram em `fluxos.parquet` com origem clicável, e o painel de Conceição do Araguaia mostra "Norte
de Goiás (atual Tocantins)" no topo da lista de origens, com um aviso dizendo o que a unidade é.

**O que mudou nos números publicados** está tabulado em `MAPEAMENTO_norte_goias.md` §5. Em uma
linha: a edição foi de 99,39% para 100% de cobertura, de 3.939 para 3.940 unidades, de 26 para 27
UFs, e a "origem não informada" caiu de 7,4% para 7,0%.

### 3.5 Por que a unidade é publicada sob a UF `'17'`, e não `'52'`

Tentador publicar sob Goiás: o território era Goiás em 1980, o prefixo dos 52 códigos é `52`, e a
emigração interestadual de Goiás subiria de 157.279 para 200.354 (**+27,4%**), quase toda ela
sobrevivendo a R1.

Não se faz isso, e a razão é a mesma que já tinha justificado a exclusão em F9.2: **Goiás é
publicado nos seus limites de hoje** (3.121.125 habitantes), e é isso que torna a UF 52 de 1980
comparável com 1991/2000/2010/2022. Devolver o norte para dentro de Goiás criaria um degrau de 27%
na série da UF que é puramente territorial — o território que emitiu esses migrantes é, de 1988 em
diante, outra unidade da federação.

O argumento de F9.8 contra `'17'` ("Tocantins não existe em 1980, não tem unidade na edição, e um
fluxo cuja origem não aparece em lugar nenhum desequilibraria a soma nacional") caiu junto com a
premissa: agora Tocantins **tem** unidade na edição, e a soma nacional fecha exatamente
(Σ imig = Σ emig = 13.803.767, Δ = 0). Vale então o precedente de Fernando de Noronha (§4), que já
publica um município de 1980 sob a UF de 2022 pelo mesmo motivo — comparabilidade da série. A UF é
lida de `municipios_ref`/`unidades_agregadas.parquet` em todos os pontos (residência, `df_uf` e
`desloc_uf`), nunca de `SUBSTR` do código, para que `interestadual` e `fluxos_uf` não possam
divergir.

---

## 4. Decisão: Fernando de Noronha

**O fato** (confirmado em F9.1, contra o que o plano presumia): as **298** linhas com
`sigla_uf = 'FN'` têm `id_municipio` **NULL** — a BD não lhes atribui geocódigo nenhum. E a malha
municipal de 1980 traz Fernando de Noronha com o código **`2000107`** (prefixo `20`, território
federal até 1988), que não existe no sistema atual.

**A regra, nos dois lados.** O código publicado é `2605459` (Fernando de Noronha/PE nos recortes de
2022 — decisão já tomada em F9.0), e a atribuição é feita **por `sigla_uf`, não por
`id_municipio`**:

```
-- destino (01_extract.sql)
cd_mun = CASE WHEN sigla_uf = 'FN' THEN '2605459' ELSE id_municipio END
uf     = CASE WHEN sigla_uf = 'FN' THEN '26'      ELSE SUBSTR(cd_mun,1,2) END

-- origem (mesmo arquivo, sobre org6)
df_mun = CASE WHEN org6 IN ('200010', '200000') THEN '2605459'
              ELSE MUN6_1980[org6] END
df_uf  = CASE WHEN SUBSTR(org6,1,2) = '20' THEN '26' ELSE ... END

-- pendular (v527, mesma regra sobre trab6)
```

**Volumes.** 298 registros de residência (Σ peso 1.274); no lado da origem, `v518 = '2000107'` em
**141** registros e `v518 = '2000008'` (= UF 20 sem especificação de município, e Fernando de
Noronha só tem um município) em **30**. Os três casos vão para `2605459`.

**Consequências declaradas.** (a) Fernando de Noronha entra em Pernambuco, na UF `26`, e nos
recortes de 2022 de PE — em 1980 era Território Federal, então a UF publicada **não** é a UF de
1980 para esse único município (é a exceção à regra geral da edição, e está declarada aqui).
(b) `MUNICIPIOS_1980['2000107']` precisa ser reapontado para `2605459` em `municipios_ref` (§11.2),
senão a malha de 1980 e o extrato discordam. (c) `v512 = 14` ("Fernando de Noronha" na tabela de UF
de nascimento, **670** registros) recebe o mesmo tratamento: `nasc_uf = '26'`.

---

## 5. Naturalidade, nacionalidade, `status` e escolaridade

### 5.1 `v513` — "Nasceu neste Município?"

Codificação verificada, exaustiva e sem faltantes: **`1` = sim (17.883.978), `8` = não
(11.494.775)**. Não há `2`, não há `9`, não há branco — a entrada correspondente de
`CATEGORIAS_1980` (`{1: sim, 2: nao, 9: ignorado}`) está errada (§0.7).

O cruzamento com `v517` mostra que `v513` é **independente** do tempo de residência, e é isso que
torna o retorno mensurável sem inferência:

| | `v517 ∈ 0..4` | `v517 ∈ 5..6` | `v517 = 7` (10+) | `v517 = 8` (nasceu) |
|---|---:|---:|---:|---:|
| `v513 = 1` (natural daqui) | **294.125** | 135.993 | 332.182 | 17.111.135 |
| `v513 = 8` (não natural) | 3.863.427 | 2.011.089 | 5.574.842 | 0 |

Os 294.125 (260.967 no universo 5+) são **retornados recentes**: nasceram no município, saíram e
voltaram nos últimos 5 anos. Como em 1991, `retorno_natal` é **medido**, não inferido.

### 5.2 `v511`/`v512` e o `status`

`v511` (nacionalidade): `2` nato (29.099.698), `4` naturalizado (49.907), `6` estrangeiro (229.148).
Sempre preenchida. `v512` (UF/país de nascimento, sequencial 1–27 para UF, 29 "Brasil sem
especificação", 30–98 países, 99 estrangeiro sem especificação) também sempre preenchida — melhor
que 1991, onde `MIUFPAIS` é branca para quem nasceu no município. Cruzamento exaustivo, coerente:
todo `v511 = 2` tem `v512 ∈ 1..27` ou `29`; todo `v511 ∈ {4,6}` tem `v512 ∈ 30..99`.

Vocabulário de `status`: **o reduzido de 2010/2000/1991**, já registrado em
`pipeline/disclosure_rules.STATUS_POR_EDICAO["1980"]` — conferido, e é o que esta especificação
propõe. Motivo idêntico ao de 1991: 1980 não coleta o **município** de nascimento, só UF ou país,
então `primeira_saida` e `etapas_multiplas` são indistinguíveis e colapsam em `nao_natural`.

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

`retorno_uf_natal` = `df_local='2' AND nasc_local='2' AND nasc_uf = uf AND df_uf IS NOT NULL AND
df_uf <> uf`, como nas outras edições.

Ordem de grandeza esperada: `retorno_natal` ≈ **7,1%** dos migrantes internos quinquenais
(259.392 de 3.652.089 no publicado), contra 9,3% em 1991; `origem_nao_informada` ≈ **7,4%** (contra
3,0% em 1991) — ver a nota de F9.7 em §2.4.

### 5.3 Escolaridade sem "anos de estudo": `v523` × `v524`

1980 **não tem** a variável derivada de anos de estudo que 2000 e 1991 têm (`EDANOEST`). Tem o par
`v523` ("última série concluída", 0–8 e 9 sem declaração) × `v524` ("grau da última série
concluída"). O `nivel_instr_4` é **reconstruído** a partir dos dois.

**Primeiro, uma correção de dicionário.** A lista de categorias de `v524` no
`Documentação - 12.doc` é a mesma de `v521` ("grau que frequenta") e **está deslocada em um código**
para `v524`. A lista impressa (`0` nenhuma, `1` primário, `2` ginasial, `3` 1º grau, `4` 2º grau,
`5` colegial, `6` supletivo 1º grau, `7` supletivo 2º grau, `8` superior) **descreve corretamente
`v521`** — verificado pelo número de séries de cada grau em `v521 × v520` (grau 1 com séries 1–4;
grau 3 com séries 1–8; grau 8 com séries 1–6) — e **não descreve `v524`**. A leitura correta de
`v524`, estabelecida por quatro testes independentes, é:

| `v524` | Leitura adotada | Séries observadas em `v523` | Idade média (20+) | Mediana da classe de renda (`v682`, 25+) | n (total) |
|---:|---|---|---:|---:|---:|
| `0` | nenhuma / não aplicável (inclui quem **está** estudando) | 0 | 45,2 | 4 | 16.230.316 |
| `1` | alfabetização de adultos (não seriado) | 0 | 44,0 | 4 | 112.147 |
| `2` | **elementar / primário** | 1–5, pico em 4 | 40,8 | 5 | 7.709.377 |
| `3` | **médio 1º ciclo (ginasial)** | 1–5, pico em 4 | 37,8 | 6 | 1.137.093 |
| `4` | **1º grau** (Lei 5.692/71) | 1–8, pico em 8 | 31,1 | 5 | 1.859.841 |
| `5` | **2º grau** | 1–4, pico em 3 | 30,9 | 7 | 786.842 |
| `6` | **médio 2º ciclo (colegial)** | 1–4, pico em 3 | 38,6 | 7 | 519.201 |
| `7` | **superior** | 1–7, pico em 4 e 5 | 37,7 | **9** | 598.734 |
| `8` | **pós-graduação** (mestrado/doutorado, não seriado) | 0 | 41,1 | **9** | 19.653 |

Os quatro testes: (i) **número de séries** — o grau `4` é o único que vai até a 8ª série, o que só
o 1º grau faz; os graus `5` e `6` param na 3ª/4ª, como 2º grau e colegial; (ii) **idade** — `4` e
`5` são os mais jovens (31 anos), como esperado de quem estudou **depois** da reforma de 1971, e
`3`/`6` são mais velhos (38–39), como esperado do sistema ginasial/colegial anterior; (iii) **renda**
— `7` e `8` estão duas classes acima de todos os outros, o que só o superior explica (a leitura
literal do dicionário poria "supletivo de 1º grau" no topo da distribuição de renda, o que é
absurdo); (iv) **ordem de grandeza externa** — sob esta leitura, quem concluiu a 4ª série ou mais do
superior (`v524 = 7 AND v523 >= 4`) é **1,5%** da população, exatamente a proporção conhecida de
diplomados do Censo 1980; sob a leitura literal, "superior" seria 0,067%, vinte vezes menos do que
o IBGE publicou.

**Correspondência para `nivel_instr_4`** (universo de `edu_grupo`: 25 anos ou mais, como nas outras
edições):

| Condição | `nivel_instr_4` | `edu_grupo` |
|---|---|---|
| `v524 ∈ {0,1,2}`; ou `v524='3' AND v523 ∈ {1,2,3}`; ou `v524='4' AND v523 ∈ {1..7}` | `'1'` | `sem_instr_fund_incompleto` |
| `v524='3' AND v523 ∈ {4,5}`; ou `v524='4' AND v523='8'`; ou `v524 ∈ {5,6} AND v523 ∈ {1,2}` | `'2'` | `fund_completo_medio_incompleto` |
| `v524 ∈ {5,6} AND v523 >= '3'`; ou `v524='7' AND v523 ∈ {1,2,3}` | `'3'` | `medio_completo_superior_incompleto` |
| `v524='7' AND v523 >= '4'`; ou `v524='8'` | `'4'` | `superior_completo` |
| `v524` NULL ou `'9'`; ou `v523` NULL ou `'9'` | `'5'` | `nao_determinado` |

Lógica: "fundamental completo" = 8 anos de escolarização, alcançado tanto por **ginasial completo**
(4ª série do médio 1º ciclo, sistema antigo) quanto por **8ª série do 1º grau** (sistema novo);
"médio completo" = 11 anos, alcançado pela 3ª série do 2º grau ou do colegial.

Distribuição resultante entre os 25+, comparada com 1991 pelo mesmo corte:

| `nivel_instr_4` | 1980 | 1991 |
|---|---:|---:|
| `'1'` sem instrução / fundamental incompleto | **84,95%** | 74,30% |
| `'2'` fundamental completo / médio incompleto | **5,73%** | 9,27% |
| `'3'` médio completo / superior incompleto | **6,03%** | 11,39% |
| `'4'` superior completo | **3,21%** | 5,01% |
| `'5'` não determinado | **0,09%** | 0,03% |

Progressão monótona e da magnitude certa para 11 anos de distância — o melhor teste de sanidade
disponível para a recodificação.

**Aproximações a declarar** (mesmo espírito da nota de 2000/1991 sobre graduações de 3 anos):

1. **`v524 = '0'` é ambíguo por desenho**: quem **está** frequentando a escola declara `0/0` em
   `v523`/`v524` (verificado: 520.855 dos que cursam a 5ª série do 1º grau têm `v524 = '0'`).
   No universo de 25+ isso é pequeno, mas o `nivel_instr_4` de estudantes adultos fica
   **subestimado**. Não há correção possível sem inventar dado; fica registrado.
2. **O fim do superior é uma faixa, não um ponto**: cursos de 3, 4, 5 e 6 anos coexistem. O corte
   em `v523 >= 4` classifica como "superior completo" quem concluiu 4 anos de um curso de 5 ou 6
   (superestima) e como "superior incompleto" quem concluiu um curso de 3 anos (subestima). Os dois
   erros andam em direções opostas e são pequenos frente ao total.
3. **`v525`** ("tipo do último curso concluído", 97 categorias — onde o diploma de nível superior é
   identificado nominalmente) **não foi extraído da BD** e permitiria cravar o superior completo.
   Se uma reextração for feita por outro motivo, incluir `v525` e refazer o corte `'4'`.

---

## 6. Deslocamento pendular — `v527`

1980 **tem** módulo pendular, com um único quesito: `v527` (88, 7), **"Município que trabalha ou
estuda"** — estruturalmente idêntico ao `V4276` do Censo 2000, e por isso o
`pipeline/sql/2000/07_pendular.sql` é o modelo direto.

Cobertura: preenchido (≠ `'0000000'`/NULL) em **959.209** registros (3,26%); **nunca igual ao
município de residência** (0 casos — o quesito só é preenchido quando o deslocamento é para fora).

### 6.1 Universo de `ocupado` — o ponto onde 1980 mais engana

`v529` ("ocupação atual"): `0` trabalha, `1` procurou trabalho ou trabalha, `2` procurando trabalho
ou não trabalha, `3` aposentado/pensionista, `4` vive de renda, `5` detento, `6` estudante,
`7` doente/inválido, `8` afazeres domésticos, `9` sem ocupação.
`v528` ("trabalhou nos últimos 12 meses?"): `1` sim, `3` não, `5` frente de seca — **e `0` só no
Ceará**, onde é o NSA de menores de 10 anos.

`v529 = '0'` ⇔ `v530` (ocupação) preenchida, em 100% dos casos, nas 27 partições. Mas
**`v529 = '0'` sozinho não é "ocupado"**:

| regra | taxa ponderada nacional | CE | vizinhos (PI/RN/PB) | referência |
|---|---:|---:|---:|---|
| `v529 = '0'` | 41,7% | **60,4%** | 34,4–36,1% | — |
| `v529 = '0' AND v606 >= 10` | **35,47%** | 31,5% | 29,6–30,3% | **PEA ocupada 1980 ≈ 35,5%** |

Duas patologias somadas: (a) no Ceará, menores de 10 anos vêm com `v529 = '0'` e `v528 = '0'`
(NSA), inflando a taxa em 29 pontos; (b) nas demais UFs, uma fração constante de ~17% das crianças
de 0 a 9 anos também aparece com `v529 = '0'` e ocupação preenchida — artefato da fonte, não
trabalho infantil (é uniforme em todas as idades de 0 a 9, inclusive **0 anos**).

**Regra adotada: `ocupado = (v529 = '0') AND idade >= 10`**, o universo econômico do Censo 1980 e o
mesmo piso de idade verificado em 1991 (`MIN(idade)` entre ocupados = 10). Ela resolve as duas
patologias com um único critério, sem cláusula especial para o Ceará, e reproduz a taxa nacional
publicada com três casas de precisão. Não usar `v528` para definir ocupação (ele mede trabalho nos
últimos 12 meses, não ocupação na semana de referência, e tem NSA próprio no Ceará).

### 6.2 Universos e regra dos dois fluxos (a de 2000)

```
ocupado    = v529 = '0' AND idade >= 10
estudante  = freq_escolar = '1'   (v521 em 1..8 OU v522 em 1..8)
```

**Trabalho precede**: `v527` é um campo único, então quem é ocupado tem o município de **trabalho**
e quem não é ocupado mas estuda tem o de **estudo**. É exatamente o comportamento de 2000, e a
mesma ressalva vale: **o fluxo de estudo é um piso** — quem trabalha *e* estuda em municípios
diferentes só aparece no fluxo de trabalho.

```
trab_local   = NULL se não ocupado; senão '2' se v527 nulo/'0000000';
               '3' se trab6 resolve para município ou UF‖'0000' ≠ cd_mun; '4' se trab6 = '80…'
estudo_local = NULL se ocupado; senão '1' se v527 nulo/'0000000';
               '2' se outro município; '3' se '80…'
trab_mun / estudo_mun = MUN6_1980[trab6], NULL para sentinelas e UF‖'0000'
pendular_trab   = COALESCE(trab_local  = '3' AND trab_mun   IS NOT NULL AND trab_mun   <> cd_mun, FALSE)
pendular_estudo = COALESCE(estudo_local= '2' AND estudo_mun IS NOT NULL AND estudo_mun <> cd_mun, FALSE)
```

`trab_local = '1'` (trabalha em casa/na propriedade) e `'5'` (mais de um município) **nunca ocorrem
em 1980**, exatamente como em 2000 — o quesito não separa essas situações. Mapear "neste município"
para `'2'` preserva `trabalha_no_mun = trab_local IN ('1','2')` em `07_pendular.sql`.

Volumes esperados:

| grupo | com `v527` preenchido |
|---|---:|
| ocupados (10+) | **785.731** |
| estudantes não ocupados | **126.595** |
| nenhum dos dois — **descartados** | 46.883 |
| destino sentinela (exterior `80`, UF sem município) — fora da matriz | 6.875 |

Os 46.883 descartados são 41.267 menores de 10 anos com `v529 = '0'` (o artefato de §6.1) e 5.438
que declaram `v529 = '6'` (estudante) sem frequência escolar corrente. Somam 4,9% dos registros com
`v527`; ficam fora por não terem universo definido, e o número entra no QA.

### 6.3 Dimensões do módulo pendular: **quatro**, não seis

`pendular_trab_dim_bruto` de 2000 tem seis dimensões (posicao, setor, ocupacao, renda_trab, edu,
idade_sexo). Em 1980:

| dimensão | 1980 | motivo |
|---|---|---|
| `setor_grupo` | **publicada**, de `v532` | §6.4 |
| `ocup_grupo` | **publicada**, de `v530` | §6.5 |
| `edu` | publicada, de `nivel_instr_4` | §5.3 |
| `idade_sexo` | publicada | — |
| `renda_trab_classe` | **NULL** | a renda só existe no Ceará (§7) |
| `pos_grupo` | **NULL** | §6.6 |

`tempo_mediano`, `pct_diario` e `pct_coletivo` (em `08_metro.sql`): `CAST(NULL AS DOUBLE)`
explícito. 1980 não tem quesito de frequência de retorno, de tempo de deslocamento nem de meio de
transporte — `rotulos_pendular = {"frequencia": None, "modo": None, "tempo": None}` já está
declarado em `pipeline/edicoes.py["1980"]`.

### 6.4 `setor_grupo` — ramos de atividade de 1980 (`v532`) → os 8 grupos publicados

`v532` ("finalidade ou ramo do negócio", 166 categorias) é organizada em seções contíguas na tabela
auxiliar `V532 e V544 - ok.txt`. O crosswalk é por seção:

| `v532` | Seção de 1980 | `setor_grupo` |
|---|---|---|
| `011`–`042` | Agricultura, silvicultura e pecuária; extração vegetal; pesca | `agropecuaria` |
| `050`–`059` | Extração mineral | `industria` |
| `100`–`300` | Indústria de transformação | `industria` |
| `340` | Indústrias de construção | `construcao` |
| `351`–`354` | Serviços industriais de utilidade pública | `industria` |
| `410`–`424` | Comércio de mercadorias | `comercio` |
| `451`–`464` | Crédito, seguros, capitalização; imóveis e valores mobiliários | `servicos_empresariais` |
| `471`–`477` | Transportes | `transporte_logistica` |
| `481`–`482` | Comunicações | `transporte_logistica` |
| `511`–`512` | Alojamento e alimentação | `outros_servicos` |
| `521`–`545` | Reparação e conservação; serviços pessoais; serviços domiciliares | `outros_servicos` |
| `551`–`552` | Diversões, radiodifusão e televisão | `outros_servicos` |
| `571`–`589` | Técnico-profissionais; auxiliares das atividades econômicas | `servicos_empresariais` |
| `610`–`624` | Serviços comunitários e sociais; médicos, odontológicos, veterinários | `admin_educacao_saude` |
| `631`–`632` | Ensino | `admin_educacao_saude` |
| `711`–`727` | Administração pública; defesa nacional e segurança pública | `admin_educacao_saude` |
| `801` | Organizações internacionais | `outros_servicos` |
| `901`–`902` | Não compreendidas / mal definidas | `outros_servicos` |
| NULL | não ocupados e menores de 10 | `NULL` (vira `'ignorado'` em `07_pendular.sql`) |

Decisões não óbvias, para registro: (a) **comunicações (`481`–`482`) vai para
`transporte_logistica`**, e não para `servicos_empresariais` como as telecomunicações de 2000 — em
1980 a seção é dominada por correios e telégrafos, não por telecomunicações empresariais, e o
código de 3 dígitos não permite separar; (b) **extração mineral em `industria`**, como em todas as
outras edições; (c) **serviços domiciliares (`541`–`545`) em `outros_servicos`**, mesmo destino do
serviço doméstico de 2000/2010/2022.

### 6.5 `ocup_grupo` — grupos ocupacionais de 1980 (`v530`) → `'01'`…`'11'`

`v530` ("ocupação ou cargo nos últimos 12 meses", 366 categorias) é organizada em grandes grupos e
subgrupos nomeados na tabela auxiliar `V530 e V542 - ok.txt`. Crosswalk por faixa de código:

| `v530` | Subgrupo de 1980 | `ocup_grupo` |
|---|---|---|
| `001`–`040` | Empregadores; diretores e chefes da administração pública; administradores e gerentes; chefes de seção | `'01'` dirigentes |
| `050`–`065` | Funções burocráticas ou de escritório | `'04'` apoio administrativo |
| `101`–`104`, `121`–`125`, `141`–`154`, `171`–`183`, `201`–`219`, `231`–`233`, `251`–`293` | Engenheiros, químicos, agrônomos, médicos, matemáticos, economistas, cientistas sociais, professores, magistrados, religiosos, jornalistas, artistas | `'02'` profissionais das ciências |
| `111`–`113`, `131`–`133`, `161`–`168`, `191`–`193`, `221`–`222`, `241`–`244` | Todos os subgrupos nomeados **"Ocupações Auxiliares de…"** | `'03'` técnicos de nível médio |
| `301`–`336` | Agropecuária, caça, pesca, trabalhadores florestais | `'06'` agropecuária |
| `341`–`391` | Extrativa mineral (mineiros, garimpeiros, salineiros, sondadores) | `'08'` operadores de instalações e máquinas |
| `401`–`406` | Mestres, contramestres e técnicos de indústria e construção | `'03'` técnicos de nível médio |
| `411`–`589` | Demais ocupações das indústrias de transformação e da construção civil | `'07'` construção, artes mecânicas e ofícios |
| `601`–`646` | Comércio e atividades auxiliares | `'05'` serviços e vendedores |
| `711`–`762` | Transportes (aéreo, aquaviário, portuário, ferroviário, rodoviário) | `'08'` operadores de instalações e máquinas |
| `771`–`776` | Comunicações (telefonistas, carteiros, telegrafistas) | `'04'` apoio administrativo |
| `801`, `811`–`834` | Proprietários nos serviços; alojamento e alimentação; higiene pessoal; atletas | `'05'` serviços e vendedores |
| `805`, `841`–`845` | Ocupações domésticas remuneradas; porteiros, ascensoristas, vigias e serventes | `'09'` ocupações elementares |
| `851`–`859` | Defesa nacional e segurança pública | `'10'` forças armadas e policiais |
| `911`–`927` | Outras, mal definidas ou não declaradas | `'11'` ocupações maldefinidas |
| NULL | não ocupados e menores de 10 | `NULL` |

**Ordem obrigatória no `CASE`:** testar `805` **antes** da faixa `801`–`834`, e `771`–`776`
**antes** da faixa `711`–`776`.

Ressalva a declarar: ao contrário da CBO-Dom 2000 (que não tem o conceito de ocupação elementar),
a classificação de 1980 **tem** um bloco reconhecível de trabalho não qualificado (serviço
doméstico, porteiros/serventes), então `elementares` **não** fica estruturalmente vazia em 1980 —
mas é mais estreita do que o GG 9 da ISCO-08 de 2010/2022, porque os trabalhadores braçais da
indústria, da construção e da agricultura estão distribuídos pelos grupos da sua atividade.
**Comparações da classe `elementares` entre 1980, 2000 e 2010/2022 não são válidas.**

### 6.6 `pos_grupo` — **não publicada**

`v533` ("posição no estabelecimento") tem 9 categorias: `0` sem remuneração; `1`/`2` trabalhador
agrícola volante (com/sem intermediário); `3` parceiro ou empregado; `4` parceiro ou empregador;
`5` parceiro ou conta própria; `6` empregado; `7` empregador; `8` conta própria; `9` sem declaração.

**O vocabulário publicado do atlas é construído sobre uma distinção que 1980 não faz.** As classes
`empregado_com_carteira` / `empregado_sem_carteira` / `militar_estatutario` dependem dos quesitos de
carteira assinada e de vínculo estatutário, que o Censo 1980 não tem: o código `6` é simplesmente
"empregado". A única variável próxima — `v534`, "contribui para instituto de previdência" — é um
proxy de formalidade, **não foi extraída da BD**, e transformá-la em "carteira assinada" seria
inventar a medida.

**Decisão: `pos_grupo = CAST(NULL AS VARCHAR)` em toda a edição 1980**, pela mesma regra que o
projeto aplica desde 2010 ("NULL explícito para o que a edição não mede"). `v533` fica registrado
como material disponível (o recorte parceiro/volante agrícola é de interesse histórico próprio) e
não publicado, para não criar uma categoria que só existe numa edição.

---

## 7. Renda: por que a edição 1980 não publica nenhuma — e o salário mínimo mesmo assim

### 7.1 O fato que muda a decisão

A cobertura das variáveis de renda nos parquets, por UF:

| variável | CE | as outras 26 UFs |
|---|---:|---:|
| `v607` (rendimento na ocupação principal) | 100% | **0,0%** |
| `v608`, `v609`, `v610`–`v613` | 100% | **0,0%** |
| `v680` (classe de rendimento da ocupação principal) | 60,3% | **0,0%** |
| `v681` (classe de renda total) | 100% | **0,0%** |
| `v682` (classe de rendimento de todas as ocupações) | 31,7% | **0,0%** |

Não é efeito da extração — `scripts/extract_1980_bd.py` roda a mesma `SELECT` nas 27 partições. A
tabela da Base dos Dados simplesmente **não traz renda fora do Ceará**.

### 7.2 Decisão

**`renda_trab`, `renda_pc`, `renda_classe` e `renda_trab_classe` ficam `NULL` na edição 1980
inteira** (`renda_classe` → `'nao_aplicavel'`, como o contrato já faz para domicílio coletivo nas
outras edições). Publicar a renda só do Ceará produziria um mapa em que 26 UFs são "sem
informação" e um recorte de renda nacional construído sobre 4,5% da amostra — pior do que não
publicar.

Isso **reforça** a decisão já tomada em F9.0 por outro motivo (`renda_pc` é inconstruível sem chave
de domicílio): agora as duas colunas de renda caem, não só a per capita. É uma **perda maior do que
o plano F9 previa**, e tem de aparecer em `docs/EDICOES.md` e na UI: o filtro de renda não existe
em 1980.

### 7.3 O salário mínimo de referência, mesmo assim: **Cr$ 4.149,60 — confirmado**

`pipeline/edicoes.py["1980"]` trazia `4149.60` marcado como PROVISÓRIO. **Confirmado por
reconciliação**, com a mesma técnica de 1991 (§7 do mapeamento de 1991), usando o Ceará — a única
partição com renda. `v682` ("classe de rendimento bruto de todas as ocupações", 13 faixas em SM,
tabela auxiliar `V680 - V681 - V682 - ok.txt`) contra `v607 + v608 + v609`:

| faixa | limites nominais (SM) | mín. observado | máx. observado | limite implícito | ÷ 4.149,60 |
|---:|---|---:|---:|---|---:|
| 1 | até 1/8 | 2 | 518 | 1/8 SM ∈ [518, 520) | 518,70 ✓ |
| 2 | > 1/8 a 1/4 | 520 | 1.037 | 1/4 SM ∈ [1.037, 1.039) | 1.037,40 ✓ |
| 3 | > 1/4 a 1/2 | 1.039 | 2.075 | 1/2 SM ∈ [2.075, 2.077) | 2.074,80 ✓ |
| 4 | > 1/2 a 3/4 | 2.077 | 3.112 | 3/4 SM ∈ [3.112, 3.113) | 3.112,20 ✓ |
| 5 | > 3/4 a 1 | 3.113 | 4.150 | 1 SM ∈ [4.150, 4.151) | 4.149,60 ✓ |
| 6 | > 1 a 2 | 4.151 | 8.299 | 2 SM ∈ [8.299, 8.300) | 8.299,20 ✓ |
| 7 | > 2 a 3 | 8.300 | 12.449 | 3 SM ∈ [12.449, 12.450) | 12.448,80 ✓ |
| 8 | > 3 a 5 | 12.450 | 20.748 | 5 SM ∈ [20.748, 20.750) | 20.748,00 ✓ |
| 9 | > 5 a 10 | 20.750 | 41.481 | 10 SM ∈ [41.481, 41.500) | 41.496,00 ✓ |
| 10 | > 10 a 15 | 41.500 | 62.200 | 15 SM ∈ [62.200, 62.352) | 62.244,00 ✓ |
| 11 | > 15 a 20 | 62.352 | 82.960 | 20 SM ∈ [82.960, 83.000) | 82.992,00 ✓ |
| 12 | > 20 | 83.000 | 4.000.000 | — | ✓ |
| 0 | sem renda | 0 | 0 | — | ✓ |

**Placar** (uma faixa conta como reproduzida quando todos os valores observados caem dentro dos
limites nominais, com os limites arredondados ao cruzeiro):

| candidato | faixas reproduzidas |
|---|---|
| **Cr$ 4.149,60** (mínimo legal da região I, maio/1980) | **13 / 13** |
| Cr$ 4.150,00 | 13 / 13 (indistinguível na resolução do dado) |
| Cr$ 3.939,60 · Cr$ 3.734,64 · Cr$ 3.458,00 (mínimos regionais menores de 1980) | 2 / 13 |
| Cr$ 3.300,00 (novembro/1979) | 2 / 13 |
| Cr$ 5.788,80 (novembro/1980) | 2 / 13 |

**O valor provisório estava certo, e agora está demonstrado**, não presumido. Diferente de 1991 —
onde o SM implícito nas faixas (Cr$ 36.161,60) **não** era o mínimo legal vigente —, em 1980 o valor
reconciliado coincide com o mínimo legal da região I em maio de 1980, o que é uma confirmação
externa a mais. Confirmação independente: `v681` (classe de renda total) × soma de `v607`–`v613`
reproduz os mesmos 13 limites, em outro universo. Duas faixas cravam o valor ao cruzeiro: a faixa 6
termina em 8.299 e a 7 começa em 8.300 (⇒ 2 SM < 8.300 ⇒ SM < 4.150,00), e a faixa 8 termina em
20.748 (⇒ 5 SM ≥ 20.748 ⇒ SM ≥ 4.149,60).

`pipeline/edicoes.py` foi atualizado nesta entrega: o comentário "PROVISÓRIO … F9.2 reconcilia"
deu lugar ao registro da reconciliação, e o valor permanece `4149.60`. Ele **não é usado por
nenhuma coluna publicada** (§7.2); fica declarado em `meta.json` para documentar a unidade
monetária da época e para uma eventual reextração que traga a renda das outras 26 UFs.

---

## 8. Variância: `se`/`cv` NULL em toda a edição

Decisão fechada em F9.0 e confirmada aqui: `numero_ordem` vai de 1 a 29 e é a **ordem da pessoa no
domicílio**, não um identificador; a extração veio do BigQuery sem ordem física garantida, então
domicílios **não são reconstruíveis**. Sem a UPA, o estimador de conglomerados últimos usado em
`03_indicators.sql`/`04_flows.sql`/`07_pendular.sql` trataria cada pessoa como uma unidade
independente e **subestimaria** a variância — erro anticonservador, o pior tipo.

```
controle = CAST(NULL AS VARCHAR)
cd_apond = cd_mun || 'U'/'R'     -- coluna do contrato, NÃO é estrato de variância
se, cv   = CAST(NULL AS DOUBLE)  -- em publish.py, override explícito
precisao = 'sem_estimativa'
```

`data/interim/1980/domicilios_apond.parquet` **não é gerado**.

> **Corrigido em F9.5.** A frase que estava aqui — "`n` e o arredondamento das regras R1–R9
> continuam iguais aos das outras edições" — vale para R3–R9, mas **não** para R1/R2. O piso de R1
> tem duas pernas (`n ≥ 5` **e** `≥ 3 domicílios`), e a segunda não é calculável nesta edição:
> `COUNT(DISTINCT controle)` dá 0 para todo grupo e `NULL >= 3` nunca é verdadeiro, de modo que o
> predicado descartaria em silêncio toda linha de fluxos, pendular e RM. A edição declara
> `chave_domicilio = False` em `pipeline/edicoes.py` e passa a usar limiares substitutos,
> calibrados contra as quatro edições que têm a chave: **R1 `n ≥ 20`** (sem piso de domicílios) e
> **R2 `n ≥ 50`**. Justificativa e números em `docs/METODOLOGIA.md`, item 8.2 da seção do Censo
> 1980; implementação em `pipeline/disclosure_rules.py::limiares`.

Isto é uma **divergência declarada** frente a 1991 — que também não tem área de ponderação, mas tem
domicílio reconstruível e por isso publica `se`/`cv` com estrato aproximado. Em 1980 nem o
substituto existe.

---

## 9. Contrato de `pessoas_classificado.parquet` — as 49 colunas, na ordem

Mesmo nome, mesma ordem e mesmo tipo de 2022/2010/2000/1991.

| # | Coluna | Tipo | Variável(is) 1980 | Lógica resumida |
|---:|---|---|---|---|
| 1 | `uf` | VARCHAR | `sigla_uf` | 2 díg.; `'FN'` → `'26'` (§4) |
| 2 | `cd_mun` | VARCHAR | `id_municipio`, `sigla_uf` | §1, §3, §4 — 3.939 municípios + a unidade agregada `'NORTEGO'` |
| 3 | `cd_apond` | VARCHAR | `cd_mun`, `v598` | `cd_mun ‖ 'U'/'R'`; **não é estrato** (§8) |
| 4 | `controle` | VARCHAR | — | `NULL` (§8) |
| 5 | `peso` | DOUBLE | `v604` | sem divisor (§0.10) |
| 6 | `idade` | INTEGER | `v606` | `999` → `NULL` |
| 7 | `df_mun` | VARCHAR | `v518` | §2; `NULL` = origem não informada |
| 8 | `df_uf` | VARCHAR | `v518` | §2; preenchida também no caso `UF‖'0000'` |
| 9 | `nivel_instr_4` | VARCHAR | `v523`, `v524` | §5.3 |
| 10 | `renda_pc` | DOUBLE | — | `NULL` (§7, §8) |
| 11 | `imp_df_local` | VARCHAR | — | `NULL` — a BD não publica marcas de imputação |
| 12 | `imp_df_mun` | VARCHAR | — | `NULL` |
| 13 | `imp_trab_mun` | VARCHAR | — | `NULL` |
| 14 | `trab_local` | VARCHAR | `v527`, `ocupado` | §6.2; `'1'` e `'5'` nunca ocorrem |
| 15 | `trab_uf` | VARCHAR | `v527` | `SUBSTR(trab6,1,2)` quando UF válida; `NULL` nas sentinelas |
| 16 | `trab_mun` | VARCHAR | `v527` + `MUN6_1980` | §6.2 |
| 17 | `retorna_3dias` | VARCHAR | — | `NULL` — sem quesito de frequência de retorno |
| 18 | `transporte` | VARCHAR | — | `NULL` — sem quesito de meio de transporte |
| 19 | `tempo_desloc_cat` | VARCHAR | — | `NULL` — sem quesito de tempo |
| 20 | `tempo_desloc_min` | INTEGER | — | `NULL` |
| 21 | `renda_trab` | DOUBLE | — | `NULL` (§7.2) |
| 22 | `freq_escolar` | VARCHAR | `v521`, `v522` | `'1'` frequenta / `'4'` não |
| 23 | `curso` | VARCHAR | `v521`, `v522` | grau/curso frequentado (passthrough para §9 nota) |
| 24 | `estudo_local` | VARCHAR | `v527`, `ocupado` | §6.2 |
| 25 | `estudo_uf` | VARCHAR | `v527` | idem `trab_uf`, para não ocupados |
| 26 | `estudo_mun` | VARCHAR | `v527` + `MUN6_1980` | §6.2 |
| 27 | `ocupado` | BOOLEAN | `v529`, `idade` | `COALESCE(ocupado_10 = '1', FALSE)` — **10+ obrigatório** (§6.1) |
| 28 | `estudante` | BOOLEAN | `v521`, `v522` | `COALESCE(freq_escolar = '1', FALSE)` |
| 29 | `pendular_trab` | BOOLEAN | `trab_local`, `trab_mun`, `cd_mun` | §6.2 |
| 30 | `pendular_estudo` | BOOLEAN | `estudo_local`, `estudo_mun`, `cd_mun` | §6.2 |
| 31 | `pos_grupo` | VARCHAR | — | `NULL` (§6.6) |
| 32 | `setor_grupo` | VARCHAR | `v532` | §6.4 |
| 33 | `ocup_grupo` | VARCHAR | `v530` | §6.5 |
| 34 | `modo_grupo` | VARCHAR | — | `NULL` — sem quesito de transporte |
| 35 | `renda_trab_classe` | VARCHAR | — | `NULL` (§7.2) |
| 36 | `curso_grupo` | VARCHAR | `v521`, `v522` | `v521 ∈ {1,3,6}` ou `v522 ∈ {1,2,3,5}` → `infantil_fundamental`; `v521 ∈ {2,4,5,7}` ou `v522 ∈ {4,6}` → `medio`; `v522 = 7` → `pre_vestibular`; `v521 = 8` → `graduacao`; `v522 = 8` → `pos_graduacao` |
| 37 | `is_migrante` | BOOLEAN | `df_local` | `COALESCE(df_local IN ('2','3'), FALSE)` |
| 38 | `is_mig_interno` | BOOLEAN | `df_local` | `COALESCE(df_local = '2', FALSE)` |
| 39 | `is_mig_internacional` | BOOLEAN | `df_local` | `COALESCE(df_local = '3', FALSE)` |
| 40 | `origem_conhecida` | BOOLEAN | `df_local`, `df_mun` | §2.5 |
| 41 | `origem_valida` | BOOLEAN | + `cd_mun` | §2.5 |
| 42 | `interestadual` | BOOLEAN | `df_local`, `df_uf`, `uf` | §2.5 |
| 43 | `status` | VARCHAR | `df_local`, `nasc_local`, `nacionalidade`, `df_mun` | §5.2, vocabulário reduzido |
| 44 | `retorno_uf_natal` | BOOLEAN | `df_local`, `nasc_local`, `nasc_uf`, `uf`, `df_uf` | §5.2 |
| 45 | `edu_grupo` | VARCHAR | `nivel_instr_4`, `idade` | mesmo `CASE` das outras edições, 25+ |
| 46 | `renda_classe` | VARCHAR | — | `'nao_aplicavel'` em 100% das linhas (§7.2) |
| 47 | `idade_grupo` | VARCHAR | `idade` | idêntico às outras edições; `NULL` para <5 |
| 48 | `sexo_label` | VARCHAR | `v501` | `'1'→'M'`, `'3'→'F'` — **atenção ao `3`** |
| 49 | `idade_sexo_grupo` | VARCHAR | `idade`, `v501` | idêntico às outras edições |

Nota sobre `curso`/`curso_grupo`: `pre_vestibular` é a categoria que 2000 introduziu; 1980 também a
tem (`v522 = 7`, "vestibular"), então a edição **reusa** o vocabulário de 2000 — nenhuma categoria
nova entra no front-end por causa de 1980.

---

## 10. Divergências declaradas frente às outras edições (tabela de comparabilidade)

| Dimensão | 2022 / 2010 / 2000 / 1991 | 1980 | Comparável? |
|---|---|---|---|
| Conceito de migração | data fixa (quesito direto) | **proxy** última etapa + tempo de residência | **Com ressalva** — ver o selo de §2.6. Volumes +7%; interestadual −2 p.p.; taxas municipais r = 0,98 |
| Período | quinquênio exato | 1975-09-01 → 1980-09-01, janela adotada (não é data de referência do questionário) | com ressalva |
| Município de origem | sim | sim | sim |
| Origem não informada | 1,2% (2022) a 6,8% (2010) | **7,4%** | sim, com o número ao lado |
| `status` | vocabulário reduzido (2010/2000/1991) | idêntico | sim |
| `retorno_natal` | medido (1991) / inferido (2000, 2010) | **medido** (`v513`) | sim |
| Escolaridade | anos de estudo (2000/1991) ou nível (2010/2022) | **reconstruída** de série × grau | com ressalva (§5.3) |
| Renda pessoal e domiciliar | publicadas | **ausentes** | **não** |
| Pendular — fluxos | sim (exceto 1991) | sim | sim, com a ressalva "estudo é piso" de 2000 |
| Pendular — dimensões | 6 (2000) / 7 (2010) | **4** (sem posição, sem renda) | parcial |
| Pendular — tempo/frequência/modo | 2010, 2022 | ausentes (como 2000) | não |
| Erro amostral (`se`/`cv`) | publicado (1991 aproximado) | **`sem_estimativa`** | **não** |
| Cobertura territorial | Brasil inteiro | Brasil inteiro (Σ peso 119,0 mi, 100%), com o atual Tocantins publicado como **uma unidade agregada** de 52 municípios (§3), sem detalhe interno e sem RGI/RGInt: 3.939 municípios + 1 unidade | com nota |

---

## 11. Dependências fora do SQL (para o `implementador`)

1. **BLOQUEANTE — `UF_SEQ_1980` está errado** em `pipeline/labels_1980.py`, entradas `'07'`–`'14'`
   (§0.6). Corrigir para `'07'→'21'`, `'08'→'22'`, `'09'→'23'`, `'10'→'24'`, `'11'→'25'`,
   `'12'→'26'`, `'13'→'27'`, `'14'→'26'` (Fernando de Noronha → PE). Sem isso, `nasc_uf` e
   `retorno_uf_natal` saem errados para oito UFs, incluindo MA, PI, CE, RN, PB, PE e AL.
2. **`municipios_ref` de 1980**: a chave `'2000107'` (Fernando de Noronha na malha de 1980) tem de
   virar `'2605459'`, e os **52 códigos do norte de Goiás** (os `MUN6_1980` de prefixo `52` que não
   aparecem em `id_municipio`) têm de ficar **fora** da tabela (§3.3). Resultado esperado:
   **3.939** municípios, zero sem recorte de 2022 — `build_ref.py --edicao 1980` deve falhar alto se
   o número de municípios sem recorte for maior que zero.
3. **`CATEGORIAS_1980` não deve ser usado** (§0.7). Se for para mantê-lo no módulo, corrigi-lo a
   partir do dicionário oficial; caso contrário, removê-lo é melhor do que deixar um dicionário
   errado importável.
4. `pipeline/edicoes.py`: `salario_minimo = 4149.60` **confirmado** (comentário já atualizado nesta
   entrega); `proxy_data_fixa = True` já declarado.
5. `pipeline/publish.py` para 1980: override explícito gravando `se`/`cv` NULL e
   `precisao = 'sem_estimativa'` (§8) — não deixar isso acontecer por efeito colateral de coluna
   nula. `domicilios_apond.parquet` não é gerado; `03/04/07` precisam tolerar sua ausência.
   **Resolvido em F9.5, e maior do que parecia**: `publish.py`/`disclosure_check.py` também usavam
   `ndom` em predicado de R1, que com `controle` nulo descartaria tudo. Os dois scripts agora
   montam R1/R2 a partir de `disclosure_rules.limiares(ed.chave_domicilio)`; nenhuma comparação
   com `ndom` sobrevive nesta edição. Ver o aviso no fim do §8.
6. `pipeline/sql/1980/08_metro.sql`: modelo de 2000, com `tempo_mediano`/`pct_diario`/`pct_coletivo`
   como `CAST(NULL AS DOUBLE)` explícito e núcleos de RM por fallback (nem toda RM de 2022 tem o
   município-núcleo existente em 1980).
7. `web/src/lib/edicoes.ts["1980"]`: `proxyDataFixa: true`; recursos de renda desligados (novo —
   nenhuma edição anterior exercitou "edição sem renda"); `vocabulario` reusando o de 2000
   (`pre_vestibular`); `statusCategorias` = vocabulário reduzido.
8. **`build_meta.py`**: o texto do selo "proxy" e o número da calibração (§2.6) devem vir de
   `meta.json`, não de string no componente.

---

## 12. Lista de verificações para o QA da F9.3 (auditor)

1. **(revisto em F9.9)** `01_extract.sql` não exclui registro nenhum; os **178.338** de
   `sigla_uf='GO' AND id_municipio IS NULL` recebem `cd_mun = 'NORTEGO'`. Σ peso final =
   **119.011.062** (100% de 119.002.706).
2. **3.940** códigos distintos em `cd_mun`: os **3.939** municípios de `MUNICIPIOS_1980` (com
   `2000107` reapontado), todos com par em `labels.RECORTES`, mais a unidade agregada `'NORTEGO'`,
   que é a única sem recorte de 2022 — e por decisão, não por lacuna (§3).
3. Fernando de Noronha: **298** registros com `cd_mun = '2605459'`; zero registros com `cd_mun`
   começando em `'20'`.
4. Regra do Ceará: **zero** registros com `v518`/`v527` começando em `'0'` chegando ao classificado
   como "sem par"; das 190.963 origens do Ceará, **179.772** resolvem para município e o restante
   são sentinelas conhecidas. **Falhar alto** se a contagem de origens sem par no Ceará for da ordem
   de 190 mil (sinal de que a regra de 6 dígitos não foi aplicada).
5. `df_local = '2'` em **14,5%** dos 5+ (n ≈ 3.652.089, Σ peso ≈ 14.775.348); `df_local = '3'` em
   0,1%; `origem_nao_informada` = **7,4%** dos migrantes internos (270.583 registros — inclui os
   15.350 de origem no norte de Goiás; ver a nota de F9.7 em §2.4).
6. **Zero** pares origem = destino em `fluxos_bruto` (verificado: 0 autoloops já no extrato);
   Σ imigrantes = Σ emigrantes; Σ saldos = 0.
7. Taxa de ocupação ponderada (`ocupado`) = **35,47%** da população total, entre 26,8% (AP) e 40,8%
   (SP). **Se der ~41,7% nacional ou ~60% no Ceará, o filtro de 10 anos não foi aplicado — parar.**
8. `v527` nunca aponta para o próprio município (0 casos); universo pendular = 785.731 ocupados +
   126.595 estudantes não ocupados; 46.883 descartados por falta de universo.
9. `nivel_instr_4` entre os 25+: `'1'` ≈ 84,9%, `'2'` ≈ 5,7%, `'3'` ≈ 6,0%, `'4'` ≈ 3,2%,
   `'5'` ≈ 0,1%. Comparar com 1991 (74,3 / 9,3 / 11,4 / 5,0) — a progressão tem de ser monótona.
10. `renda_pc`, `renda_trab`, `renda_trab_classe` nulos em **100%** das linhas; `renda_classe` =
    `'nao_aplicavel'` em 100%; `pos_grupo`, `modo_grupo`, `retorna_3dias`, `transporte`,
    `tempo_desloc_cat`, `tempo_desloc_min`, `imp_*`, `controle` nulos em 100%.
11. `se`/`cv` nulos em **100%** das linhas de todas as tabelas publicadas; `precisao` =
    `'sem_estimativa'` em 100%.
12. `status` só assume os 7 valores do §5.2; `retorno_natal` ≈ 7,1% dos migrantes internos.
13. Nenhuma unidade publicada com população zero. **Desde F9.9 a checagem mudou de sinal**: o
    código sintético `'NORTEGO'` TEM de aparecer em `municipios_ref`, `municipios_bruto`,
    `municipios.parquet` e nos dois lados de `fluxos.parquet` — com população 739.049 — e
    nenhum dos 52 códigos componentes pode aparecer como unidade à parte (R6 do gate e
    `test_unidade_agregada_*`).
14. **Unidade agregada `'NORTEGO'` (F9.9)**: 1 linha em `municipios_ref`/`municipios`, 66 pares de
    saída e 144 de entrada em `fluxos.parquet`, nenhum autoloop, `cd_rgi`/`cd_rgint`/`cd_rm`
    nulos, UF `'17'`, e uma feição na malha. `fluxos_origem_agregada.parquet` **não existe mais**
    (absorvida).
