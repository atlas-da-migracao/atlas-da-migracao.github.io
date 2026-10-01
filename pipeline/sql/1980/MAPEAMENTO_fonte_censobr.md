# Fonte da edição Censo 1980: o Parquet do censobr/IPEA (desde `1.1.0-1980`)

Complemento de `MAPEAMENTO_02_classify.md` (§0 e §3) e de `MAPEAMENTO_norte_goias.md`. Registra por
que a edição 1980 trocou de fonte, o que a fonte nova é, como ela foi validada contra a anterior e o
que muda nos números publicados. Todos os números vêm de consultas **agregadas** (contagens, somas de
peso, multiconjuntos comparados por `EXCEPT ALL`) e dos arquivos já publicados; nenhuma linha de
pessoa foi lida ou impressa. Os resultados dos gates, UF a UF, estão em `docs/qa/censobr_1980.md`,
gerado pelo próprio script de preparação.

| versão dos dados | fonte de `data/raw1980/pessoa_<uf>.parquet` | produzido por |
|---|---|---|
| `1.0.0-1980` a `1.0.7-1980` | Base dos Dados (`basedosdados.br_ibge_censo_demografico.microdados_pessoa_1980`, BigQuery) | `scripts/extract_1980_bd.py` (mantido como registro histórico e como referência dos gates) |
| **`1.1.0-1980`** (atual) | **censobr/IPEA v1.0.0**, `1980_population_v1.0.0.parquet` | **`scripts/prep_1980_censobr.py`** |

O esquema de saída é o mesmo nas duas: 27 Parquet por UF, 39 colunas, mesma ordem e mesmos tipos.
`pipeline/sql/1980/01_extract.sql` não precisa saber de onde os dados vieram — só deixou de aceitar
`id_municipio` nulo (aborta com `error()`), porque a fonte nova tem o código para todos os
registros.

---

## 1. Por que a fonte mudou

### 1.1 O que faltava na Base dos Dados, e por quê

Na tabela da Base dos Dados (BD), **178.636 registros não têm `id_municipio`**: os 178.338 dos 52
municípios do norte de Goiás que em 1988 formaram o Tocantins, e os 298 de Fernando de Noronha
(Território Federal em 1980, `sigla_uf = 'FN'`). Até `1.0.7-1980` isso foi tratado como uma
propriedade da fonte — "a residência é irrecuperável" — e a edição passou por três desenhos para
contornar a lacuna (excluir, publicar só a emigração, publicar uma unidade agregada `NORTEGO`; ver
`MAPEAMENTO_norte_goias.md` §2).

A causa foi achada na auditoria de 30/09/2026, no código de construção da tabela: o do-file Stata
da Base dos Dados (repositório `basedosdados/mais`, `bases/br_ibge_censo_demografico/code/build.do`)
faz um `merge m:1 id_municipio_6` do código de município de 1980 contra o **diretório atual** de
municípios. Os códigos `52xxxx` do norte de Goiás não existem mais nesse diretório (hoje são
`17xxxx`), nem os `20xxxx` de Fernando de Noronha; o merge não casa, `id_municipio` fica vazio e o
código original de seis dígitos é **descartado antes da camada dbt**. Não é `safe_cast` nem efeito
de staging — e por isso a sondagem das quatro camadas da BD (produção, dev e as duas variantes de
staging, `MAPEAMENTO_norte_goias.md` §1.1) devolveu os mesmos 178.338 nulos em todas: ela estava
certa **sobre a BD**. O erro foi estender a conclusão da BD para os microdados.

### 1.2 O que cada fonte tinha

| fonte | município de residência dos 52 | `v517` (tempo no município) | `v518` (município anterior) |
|---|---|---|---|
| Base dos Dados | **não** (perdido no merge) | sim | sim |
| cópia DBF pública do IBGE | sim (`UF` + `MUNIC`) | sim (campo `MITEMPMU`) | **não** |
| **censobr/IPEA v1.0.0** | **sim** (`code_muni`) | sim | **sim** |

A afirmação registrada em `1.0.2-1980` de que o DBF "não tem `V517` nem `V518`" estava errada pela
metade: ela foi conferida só no dicionário (`Layout/Documentação.xls`), e o campo `MITEMPMU` existe
no arquivo e bate valor a valor com `v517`. Só `V518` falta ao DBF. Cada uma das duas fontes antigas
tinha a metade que faltava à outra; o censobr tem as duas no mesmo registro.

---

## 2. O que é o censobr, e de onde vem

O **censobr** é o pacote do IPEA que distribui microdados dos censos demográficos em Parquet. A
edição usa o arquivo `1980_population_v1.0.0.parquet` da release `v1.0.0` do repositório
`ipea/censobr_prep_data` (<https://github.com/ipea/censobr_prep_data/releases/tag/v1.0.0>,
16/09/2026): 557 MB, 29.378.753 registros, 99 colunas, SHA-256
`0bb8cdf0001aa7e830933bb47ee29fe8fcb28392bfa1083c272788df51e89616`.

**Procedência.** A cadeia é: microdados da amostra do IBGE → arquivos harmonizados do Data Zoom
(PUC-Rio) → a versão *legacy* da amostra de 1980 (R. J. Barbosa) → Parquet do censobr v1.0.0. A
Base dos Dados parte **dos mesmos arquivos Data Zoom**. Consequência metodológica que precisa ficar
escrita: a identidade célula a célula entre BD e censobr (§3) mostra que **o censobr não perde nada
do que a BD tinha**, mas não é uma validação independente contra o IBGE — as duas têm a mesma
origem. As âncoras independentes são as comparações com a cópia DBF do IBGE: contagens por UF
(idênticas, exceto Fernando de Noronha, ausente das 26 partições do DBF), o peso do registro de MS
(§4, item c) e a convenção de universos (§4, item b), em que o censobr coincide com o DBF e a BD não.
O repositório `ipea/censobr_prep_data` não traz citação bibliográfica formal para esse conjunto: em
`R/microdata_1980.R` e `references/microdata_1980_ftp_vs_aux.md` ele o descreve como a "amostra
preparada" — CSVs de 2018, convertidos em Parquet e hospedados no release `release_legacy` do próprio
repositório —, preferida à republicação em DBF que o IBGE colocou no FTP em 2025 (que não traz
`V518`). A identificação com os arquivos Data Zoom vem da identidade célula a célula com a Base dos
Dados (§3), que declara essa origem; nenhuma das duas distribuições é a cópia do IBGE.

### 2.1 Colunas usadas e mapeamento para o esquema de 39 colunas

`scripts/prep_1980_censobr.py` (`COLUNAS` e `sql_saida()`) filtra por UF (`V2`) e grava as 39
colunas que `scripts/extract_1980_bd.py` produzia:

| coluna do esquema | origem no censobr | tratamento |
|---|---|---|
| `id_municipio` | `code_muni` | `CAST` para `VARCHAR`, 7 dígitos, **código da malha de 1980**: os 52 do norte de Goiás chegam como `52xxxxx` e Fernando de Noronha como `2000107`. A recodificação para o código publicado (`17xxxxx`, `2605459`) **não** é feita aqui, e sim no pipeline (`pipeline/norte_goias_1980.py`, via `mun6_lookup` e a vista `recodificacao` de `01_extract.sql`). `code_muni_1980` (6 dígitos) é o prefixo de `code_muni` em 100% dos registros e não é usado. 3.991 códigos distintos. |
| `sigla_uf` | `abbrev_state` | como vem (`'FN'` para Fernando de Noronha) |
| `numero_ordem` | — | `NULL`: `V500` não existe no censobr (§4, item d) |
| `v598`, `v211`, `v501`, `v503`, `v509`, `v511`–`v517`, `v520`–`v524`, `v528`–`v530`, `v532`, `v533`, `v604`, `v606`, `v607`–`v613`, `v680`–`v682` | `V598`, `V211`, `V501`, … (mesmo número) | só `CAST` para o tipo da BD (`VARCHAR` ou `BIGINT`); nenhum valor recodificado |
| `v518`, `v527` | `V518`, `V527` | `codigo7()`: o censobr traz 6 dígitos (`UF‖MUNIC`) como inteiro; o script acrescenta o dígito verificador do IBGE (abaixo); `0`/`NULL` → `'0000000'` |

O script lê 39 das 99 colunas do censobr (as 38 acima, sem `numero_ordem`, mais `V2`, usada só
para separar as UFs). As 60 restantes ficam de fora nesta versão: identificadores geográficos
(`code_region`, `name_region`, `code_state`, `name_state`, `code_meso`, `code_micro`,
`code_muni_1980`), variáveis de domicílio (`V198`, `V201`–`V209`, `V212`–`V221`), controles
(`V3`–`V6`, `idpessoa`) e quesitos que o contrato de 49 colunas não usa (`V504`, `V505`, `V508`,
`V510`, `V519`, `V525`, `V526`, `V534`–`V536`, `V540`–`V542`, `V544`, `V545`, `V550`–`V557`,
`V570`, `V601`–`V603`, `V605`). Duas delas interessam a uma versão futura: `V525` ("tipo do
último curso concluído"), que cravaria o diploma que `nivel_instr_4` hoje aproxima
(`CABECALHO_02_classify.txt`, ponto 8); e as variáveis de domicílio e controle, cuja aptidão para
reconstruir uma chave de domicílio — e com ela `se`/`cv` e o piso de domicílios de R1 — **não foi
investigada**.

### 2.2 O dígito verificador de `v518`/`v527`

O contrato do pipeline é o código de 7 dígitos que a BD trazia (6 dígitos + dígito verificador).
Manter os 7 dígitos, em vez de passar a 6, tem duas vantagens: `org6`/`trab6` em `01_extract.sql`
continuam funcionando sem alteração, e o gate G4 compara BD e censobr **exatamente**, sem
normalização do lado do censobr.

Algoritmo (módulo 10, pesos 1,2,1,2,1,2 sobre os seis dígitos; produto ≥ 10 soma os dois
algarismos, isto é, subtrai 9): `DV = (10 − Σ mod 10) mod 10`. Implementado duas vezes, em SQL
(`MACRO_DV` de `scripts/prep_1980_censobr.py` e a vista `recodificacao` de `01_extract.sql`) e em
Python (`norte_goias_1980.digito_verificador_ibge`), e conferido em 100% dos códigos de 7 dígitos
de `v518`/`v527` da BD e nos 52 códigos de 2022 do Tocantins. As sentinelas (`80…` exterior,
`54…` Brasil sem especificação, `99…` ignorado, `UF‖'0000'`, `20…` Fernando de Noronha) recebem o
dígito pela mesma regra e saem idênticas às da BD (G4).

---

## 3. Os gates de identidade, e o resultado

`scripts/prep_1980_censobr.py` grava cada UF num diretório temporário, compara com o Parquet da BD
correspondente (`data/raw1980/bd/pessoa_<uf>.parquet`) e só move o resultado para
`data/raw1980/` se **todas** as UFs passarem. As comparações são de multiconjunto (`EXCEPT ALL`
nos dois sentidos, que trata `NULL` como igual a `NULL`): "divergentes" conta os registros de um
lado sem par idêntico do outro, então um registro diferente conta 2.

| gate | colunas | universo | resultado nas 27 UFs |
|---|---|---|---|
| G1 | `v604` (peso) | todos | 0, exceto MS: 2 (o registro de peso 14 na BD e 4 no censobr) |
| G2 | núcleo: `v598`, `v211`, `v501`, `v503`, `v509`, `v511`–`v517`, `v604`, `v606` | todos | 0, exceto MS, PI e MT: 2 cada |
| G3 | núcleo + escolaridade (`v520`–`v524`) | 5 anos ou mais | 0, exceto MS e MT: 2 cada |
| G3 | núcleo + trabalho (`v528`–`v530`, `v532`, `v533`) + `v527` | 10 anos ou mais | 0, exceto MS e MT: 2 cada |
| G4 | núcleo + `v518` (BD normalizada: `NULL` → `'0000000'`; Ceará, 6 dígitos → 6 + DV) | todos | 0, exceto MS, PI e MT: 2 cada |
| G5 | código de município, onde a BD o tem | 29.200.117 registros | **0** |
| — | registros sem município no censobr | todos | **0** |
| — | códigos que só o censobr tem | — | GO: 52 códigos, 178.338 registros; FN: 1 código, 298 registros — exatamente os 178.636 que a BD não localizava |

Totais: 29.378.753 registros nas duas fontes; Σ peso 119.011.062 na BD e **119.011.052** no
censobr.

**Leitura.** A tolerância declarada é de 1 registro por UF (2 divergentes). Em MS, a divergência é
o registro do peso (§4, item c), e ela aparece em todos os gates que incluem `v604`. Em **PI** e
**MT** há **um registro em cada** que difere em alguma coluna do núcleo **que não é o peso** (G1 é 0
nas duas); em MT ele entra também nos universos de G3, em PI não. A coluna foi identificada
comparando o multiconjunto de cada coluna isoladamente entre as duas fontes (`EXCEPT ALL` nos dois
sentidos, só contagens): no **PI** é `v517` (tempo de residência no município, 1 registro), no
**MT** é `v211` (= `TPRESID` do DBF, 1 registro). A causa não foi investigada (seria preciso olhar o
registro, o que as regras de sigilo não permitem fora de agregados); o efeito possível é de um
registro por UF, abaixo de qualquer limiar de publicação. Fora esses três registros, o núcleo, a escolaridade (5 anos ou mais), o
trabalho e `v527` (10 anos ou mais), a origem `v518` e o código de município (onde a BD o tem) são
**idênticos célula a célula** nas 27 UFs.

**Gate previsto e não registrado.** O plano da auditoria previa conferir, para os 52 municípios,
contagem e Σ peso por código contra o DBF do IBGE (`UF` + `MUNIC`). O relatório de
`docs/qa/censobr_1980.md` registra que os 52 códigos do censobr somam os 178.338 registros — o mesmo
total dos 52 códigos do DBF ausentes da BD (sondagem, `docs/qa/sonda_1980_bd.md` §(a)) —, e a
recodificação confere que eles são os 52 municípios de 2022 do Tocantins pelo serial; a igualdade do
conjunto e das contagens **código a código** com o DBF fica **pendente**: o volume externo com a
cópia DBF do IBGE não estava montado na sessão que fechou a `1.1.0-1980`. É uma conferência de
agregados (contagem e Σ `v604` por `UF‖MUNIC` × `code_muni`) a fazer na próxima sessão com o
volume, e a registrar aqui.

---

## 4. As diferenças declaradas, e o efeito em cada indicador

**(a) Município dos 178.636 registros.** A BD não o tem; o censobr traz `code_muni` para todos.
Efeito: os 52 municípios do norte de Goiás passam a ser publicados como municípios comuns, com o
código de 2022 e UF `'17'` (detalhes, números e o que permanece aproximado em
`MAPEAMENTO_norte_goias.md` §2.4 e `docs/METODOLOGIA.md`, item 4 da seção de 1980), e Fernando de
Noronha passa a ser atribuído pelo **código** (`2000107` → `2605459`) em vez da sigla da UF — o
resultado publicado é o mesmo.

**(b) Universos.** O censobr, como a cópia DBF pública do IBGE, aplica o universo de cada quesito:
escolaridade (`v520`–`v524`) **zerada abaixo de 5 anos**; trabalho (`v528`–`v533`) e município de
trabalho ou estudo (`v527`) **nulos abaixo de 10 anos**. A BD trazia os valores brutos, não
editados. Efeito, indicador a indicador:

| indicador | efeito |
|---|---|
| `nivel_instr_4` / dimensões de escolaridade | nenhum: a migração é medida em 5 anos ou mais e `edu_grupo` em 25 anos ou mais, fora da faixa zerada |
| `ocupado_10`, setor, grupo ocupacional | nenhum: `ocupado_10` já exigia 10 anos ou mais (`CABECALHO_02_classify.txt`, ponto 6) |
| `freq_escolar` de menores de 5 anos | passa a "não frequenta" |
| **deslocamento pendular de estudo** | passa a cobrir **só quem tem 10 anos ou mais** |
| deslocamento pendular de trabalho | praticamente nenhum |

O pendular de estudo é o único efeito visível, e é uma **correção declarada, não uma perda**. Os
valores fora do universo na BD são ruído de campo não editado pelo IBGE, não informação: medido nos
Parquet da BD (só agregados), em São Paulo 13.466 crianças de menos de 5 anos vêm com município de
trabalho/estudo preenchido, 363.157 com "última série concluída" maior que zero e 267.607 com
"trabalhou nos últimos 12 meses"; em Goiás, 828, 47.326 e 34.923. E das crianças de menos de 10 anos
com `v527` preenchido, **menos da metade** frequenta escola segundo o próprio registro (711 de 1.744
em GO, 41%; 9.465 de 24.677 em SP, 38%; 2.936 de 6.384 em MG, 46%). A série anterior contava, como
deslocamento para estudo, crianças cujos campos não tinham sido editados.

| arquivo publicado | `1.0.7-1980` (BD) | `1.1.0-1980` (censobr) |
|---|---:|---:|
| `pendular_estudo.parquet` | 764 pares, 272.565 pessoas | **575 pares, 160.855 pessoas** |
| `pendular_trab.parquet` | 2.599 pares, 2.660.250 pessoas | 2.596 pares, 2.659.195 pessoas |

**Consequência para a comparação entre edições.** Nas outras edições com pendular (2022, 2010,
2000), o fluxo de estudo cobre quem frequenta escola **em qualquer idade**; em 1980 ele passa a
cobrir 10 anos ou mais. Somado à precedência do trabalho (o fluxo de estudo de 1980 já era um piso,
como o de 2000), isso faz do pendular de estudo de 1980 uma medida de universo diferente: toda
comparação com as outras edições precisa do aviso de universo (dependência para
`pipeline/comparabilidade_regras.py`, que é do `implementador`).

**(c) Um registro de MS.** Peso 14 na BD, 4 no censobr e na cópia DBF do IBGE (Σ `PESOP` de MS no
DBF = 1.369.769, igual ao censobr). A BD é a que erra. Efeito: Σ peso da edição passa de
119.011.062 a **119.011.052**; 10 pessoas em MS, abaixo de qualquer arredondamento publicado.

**(d) `numero_ordem`.** `V500` (ordem da pessoa no domicílio) não existe no censobr e sai `NULL`. A
edição não a usa: ela nunca foi chave de domicílio (`MAPEAMENTO_02_classify.md` §0.8), e o gate
verifica a ausência de chave por `controle`, que é nulo por construção.

**(e) Renda.** Na BD, `v607`–`v613` e `v680`–`v682` só existiam no Ceará (`MAPEAMENTO_02_classify.md`
§7.1); no censobr estão nas 27 UFs — `v607` > 0 em 21,9% a 40,1% das pessoas de cada UF, faixa
compatível com a taxa de ocupação (26,8%–40,8%). A edição **continua sem
publicar renda** nesta versão: a `1.1.0-1980` é uma mudança de fonte e de território, e abrir uma
dimensão nova (filtro de renda, dimensão do pendular, universos, reconciliação do salário mínimo fora
do Ceará, limiares por categoria) é uma decisão à parte, registrada como trabalho futuro. Renda fica
fora dos gates.

**Sem efeito.** A anomalia do Ceará na BD (`v518`/`v527` com 6 dígitos e zero à esquerda,
`MAPEAMENTO_02_classify.md` §2.3) não existe no censobr: todo `v518`/`v527` sai com 7 dígitos. A
regra de `org6`/`trab6` continua em `01_extract.sql` como tolerância. Os `v518` nulos da BD (quem
mora no município há 10 anos ou mais ou nasceu nele, e todos os não migrantes do Ceará) saem
`'0000000'` no censobr; `01_extract.sql` trata os dois da mesma forma.

---

## 5. O plano B, validado e não usado: vincular a BD à cópia DBF do IBGE

Antes do censobr, a auditoria testou recuperar o município dos 52 pela **vinculação por atributos**
entre a BD (que tem `v518`) e o DBF do IBGE (que tem o município) — não o join posicional rejeitado
em `1.0.0-1980`, e sim uma chave de conteúdo verificável. Com a recodificação de universo do DBF
(educação zerada abaixo de 5 anos, trabalho e `v527` abaixo de 10, `v527 // 10 = TMUNTRAB`), **25
variáveis** são idênticas valor a valor entre as duas fontes em Goiás (953.137 registros dos dois
lados), com **0 chaves de contagem divergente** no estado inteiro; o multiconjunto dos 178.338
registros sem município na BD é idêntico ao dos 52 municípios no DBF; e no gabarito dos 171
municípios de Goiás que têm código nas duas fontes a chave acerta o município em **576.703 de
576.703** registros onde o determina. Nos 52, com a chave e uma cascata de desempate (exclusão de
`v518` igual ao município candidato, ordem no domicílio, coerência domiciliar de `v518`), o par
(origem, município) sai **exato para 95,9%** da massa migrante, **heurístico com 99,95% de acerto
medido para 4,0%**, e **fracionário para 34 registros** (Σ peso 128, 0,06%). Não foi usado porque o
censobr traz o município **no próprio registro** e dispensa qualquer atribuição, exata ou não; com
ele, nenhuma parte da edição depende de vinculação. O plano B fica especificado (plano da auditoria,
seção A4-bis) como alternativa se o censobr deixar de estar disponível ou reprovar num gate futuro.

---

## 6. Como reproduzir

```bash
source .venv/bin/activate

# 1. Obter o Parquet do censobr (público, 557 MB) na pasta gitignored e conferir o SHA-256
mkdir -p data/raw1980/censobr
curl -L -o data/raw1980/censobr/1980_population_v1.0.0.parquet \
  https://github.com/ipea/censobr_prep_data/releases/download/v1.0.0/1980_population_v1.0.0.parquet
shasum -a 256 data/raw1980/censobr/1980_population_v1.0.0.parquet
# esperado: 0bb8cdf0001aa7e830933bb47ee29fe8fcb28392bfa1083c272788df51e89616

# 2. Preparar as 27 partições no esquema de 39 colunas, com os gates contra a BD
#    (se data/raw1980/bd/ existir; senão o script grava sem comparar e o relatório diz "sem BD")
python scripts/prep_1980_censobr.py        # -> data/raw1980/pessoa_<uf>.parquet,
                                           #    data/raw1980/prep_1980_censobr.json,
                                           #    docs/qa/censobr_1980.md

# 3. Pipeline da edição, na ordem de docs/PIPELINE.md, seção 10, com --edicao 1980
python pipeline/build_ref.py --edicao 1980   # municipios_ref (3.991) + mun6_lookup.parquet
python pipeline/run.py --edicao 1980
```

Os Parquet de referência da BD (`data/raw1980/bd/`) só são necessários para repetir os gates; eles
vêm de `scripts/extract_1980_bd.py` (BigQuery, com faturamento), que fica no repositório como
registro histórico. Sem eles, a integridade da entrada é garantida pelo SHA-256 acima, e a
identidade com a BD pelo relatório já versionado em `docs/qa/censobr_1980.md`.
