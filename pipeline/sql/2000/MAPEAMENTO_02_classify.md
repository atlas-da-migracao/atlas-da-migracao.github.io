# Mapeamento de variáveis — edição Censo 2000

Documento de decisão do metodólogo, para o agente que vai escrever
`pipeline/sql/2000/01_extract.sql` e `pipeline/sql/2000/02_classify.sql`.
**Não é SQL**: é a especificação linha a linha do que cada coluna do contrato deve conter.
O cabeçalho de comentário a colar no topo do `02_classify.sql` está em
`pipeline/sql/2000/CABECALHO_02_classify.txt`; a justificativa em prosa está em
`docs/METODOLOGIA.md`, seção "Edição Censo 2000 e comparabilidade com 2022 e 2010".

Fontes usadas (todas documentação **pública** do IBGE, nenhum microdado foi lido):

- `pipeline/layout_2000.py` (posições, geradas do SAS `LE PESSOAS.sas` / `LE DOMIC.sas`)
- `pipeline/labels_2000.py` (municípios, sequenciais de UF, sentinelas, países, RMs)
- `data/raw2000/1_Documentacao_20170908/SAS/LE {PESSOAS,DOMIC}.sas` (rótulos e regras de branco)
- `data/raw2000/1_Documentacao_20170908/Documentacao/Documentaá∆o.doc` (notas metodológicas)
- `data/raw2000/1_Documentacao_20170908/Instrumentos de coleta/Manual do Recenseador.pdf`
- `.../Arquivos Auxiliares/{CnaeDom-Estrutura.xls, Ocupacao-Estrutura.doc, Estrutura Migracao V4210, V4260.xls, Municipios e Pais Estrangeiro - V4276.xls}`

---

## 0. Armadilhas de layout (ler antes de escrever o `01_extract.sql`)

| Item | O que é | Por quê importa |
|---|---|---|
| `AREAP` em posição **diferente** nos dois arquivos | Pessoas: `(51, 13)`. Domicílios: `(52, 13)` | `controle = AREAP ‖ V0300` tem de usar 51 em pessoas e **52** em domicílios; `V0300` é `(39, 8)` nos dois. Copiar a posição de um arquivo para o outro quebra 100% do join. |
| `V4572` no SAS = `V4752` na documentação | A instrução `INPUT` do SAS nomeia a idade em anos completos como `V4572` (@79, 3 díg.), mas a marca de imputação vizinha é `M4752` e as notas metodológicas chamam a variável de **V4752**. É um erro de digitação da própria fonte. | A chave em `layout_2000.LAYOUT_PESSOAS` é `'V4572'`. A posição (79, 3) está certa; só o nome está trocado. |
| Idade "a partir de 1 ano" | `V4752` = idade em anos completos **a partir de 1 ano**; `V4754` = idade em meses para menores de 1 ano (`00` também para todos os de 1 ano ou mais) | Menores de 1 ano provavelmente vêm com `000`/branco em `V4752`. Irrelevante para o atlas (universo 5+), mas conferir no QA que `MIN(idade) = 0` e que `COUNT(*) WHERE idade IS NULL` é zero ou desprezível. |
| `P001` tem 8 decimais implícitos | `(335, 11, N, 8)` em pessoas; `(157, 11, N, 8)` em domicílios | `peso = CAST(SUBSTR(...) AS DOUBLE) / 1e8` (em 2010 o divisor é `1e13`; **não** copiar). |
| LRECL | Pessoas 390 (varia 369–390, right-trim de campos brancos no fim), Domicílios 170 | **Atualizado após o QA**: pessoas filtradas com `LENGTH(linha) >= 369`; domicílios com `LENGTH(linha) >= 167`, não `= 170` — um domicílio coletivo legítimo (V1111-V1113 em branco) vem com 167 caracteres, e nenhum campo lido por este pipeline passa da posição 156. Ver o cabeçalho de `01_extract.sql` para o achado completo. |
| `V4514`, `V4526`, `V4615`, `V7617` têm 2 decimais implícitos | `(222, 6, N, 2)` etc. | `/ 1e2`. `V7203`/`V7204` têm 1 decimal; não são usados. |

---

## 1. Colunas intermediárias — `01_extract.sql` → `data/interim/2000/pessoas.parquet`

O `02_classify.sql` de 2022/2010 consome uma lista fixa de colunas do parquet de pessoas.
O extrator de 2000 tem de produzir **todas** elas (as não existentes como `CAST(NULL AS ...)`),
porque o classificador as referencia por nome.

| Coluna do extrato | Variável(is) 2000 | Lógica | Observação |
|---|---|---|---|
| `uf` | `V0102` (1, 2) | direto | VARCHAR, 2 díg. |
| `cd_mun` | `V1103` (12, 7) | direto | VARCHAR, 7 díg. Domicílios: `V0103`, mesma posição. |
| `cd_apond` | `AREAP` (51, 13) | direto | Estrato de variância. Domicílios: (52, 13). |
| `controle` | `AREAP ‖ V0300` | `SUBSTR(51,13) ‖ SUBSTR(39,8)` | Mesma decisão D2 de 2010: `V0300` sozinho não tem unicidade nacional documentada. |
| `peso` | `P001` (335, 11, 8 dec.) | `/ 1e8` | Peso do domicílio replicado na pessoa (calibração MQG por área de ponderação). |
| `sexo` | `V0401` (69, 1) | `TRY_CAST` → INTEGER | 1 masculino, 2 feminino. Sem categoria "ignorado". |
| `idade` | `V4752`/`V4572` (79, 3) | `TRY_CAST` → INTEGER | Ver armadilha acima. |
| `nasc_local` | `V0415`, `V0417`, `V4210`, `V0419` | `'1'` se `V0415='1'` **ou** `V0417='1'`; `'3'` se `V4210 >= '30'` **ou** `V0419 IN ('2','3')`; `'2'` nos demais casos com `V0417='2'`; NULL se nada se aplica | Vocabulário de `P0480`. `V0417`/`V0418`/`V0419`/`V4210` são **branco para os não migrantes** (quem respondeu `V0415='1'` pula de 4.15 para 4.27) — daí a primeira cláusula. Ordem importa: testar exterior **antes** de "outro município". |
| `nasc_uf` | `V0415`, `V0417`, `V0418`, `V4210` | própria UF (`SUBSTR(linha,1,2)`) quando `V0415='1'` ou `V0417='1'` ou `V0418='1'` ou tudo branco; `UF_SEQ_2000[V4210]` quando `V0418='2'` e `V4210` entre `'01'` e `'27'`; `'99'` quando `V4210='29'` (Brasil sem especificação); NULL quando `V4210 >= '30'` (nasceu no exterior) | **`labels_2000.UF_SEQ_2000` não tem a chave `'29'`** — o código 29 é "BRASIL SEM ESPECIFICAÇÃO", não um país. Tratar explicitamente, senão vira "nasceu no exterior" por omissão. |
| `nasc_mun` | — | `CAST(NULL AS VARCHAR)` | O Censo 2000 **não coleta o município de nascimento** (4.21 pergunta só UF ou país). Mesma ausência de 2010. |
| `nasc_pais` | — | `CAST(NULL AS VARCHAR)` | Não usado a jusante. |
| `nacionalidade` | `V0419` (112, 1) | direto | 1 nato, 2 naturalizado, 3 estrangeiro — valor a valor igual a `P0520`/2022. Branco para não migrantes e naturais da UF: o `COALESCE(...,'1')` fica no `02_classify`, como em 2010. |
| `df_local` | `V0415`, `V0424` | `'1'` se `V0415='1'` **ou** `V0424 IN ('1','2')`; `'2'` se `V0424 IN ('3','4')`; `'3'` se `V0424='5'`; NULL se `V0424='6'` (não era nascido) ou branco | Vocabulário de `P0600`. `V0424 IN ('1','2')` = "neste município, zona urbana/rural" — é o análogo do `P0600=1`, e existe pelo mesmo motivo de 2010 (`V0416` conta anos **desde o último retorno**). A distinção urbano/rural de 1995 **não** é aproveitada (não existe em 2010/2022). |
| `df_uf` | `V4250` (130, 7), `V4260` (138, 2) | `SUBSTR(V4250,1,2)` quando `df_local='2'` e `V4250` não branco; se `V4250` branco, `UF_SEQ_2000[V4260]`; NULL quando `df_local <> '2'` | `V4250 = '5400007'` ("BRASIL SEM ESPECIFICAÇÃO") gera `df_uf = '54'`, que **não é UF real** — é a sentinela de 2000, análoga ao `'98'`/`'99'` de 2010. `V4260='29'` é a mesma coisa pelo lado da UF. |
| `df_mun` | `V4250` (130, 7) | `NULLIF(TRIM(...), '')` | Código IBGE de 7 díg. na malha de **2000** (o manual manda registrar o nome atual do município em 4.25, então não há harmonização 1995→2000 a fazer). Branco para não migrantes, para quem morava neste município, para quem morava no exterior e para os não nascidos. |
| `df_pais` | — | `CAST(NULL AS VARCHAR)` | Não usado a jusante. |
| `freq_escolar` | `V0429` (151, 1) | direto | 1 rede particular, 2 rede pública, 3 já frequentou, 4 nunca. |
| `curso` | `V0430` (153, 2) | direto | 13 códigos, `'01'`..`'13'`. |
| `nivel_instr_7` | — | `CAST(NULL AS VARCHAR)` | Não usado a jusante. |
| `nivel_instr_4` | `V4300` (168, 2) | ver §2, linha `nivel_instr_4` | **Derivado** — o Censo 2000 não tem variável de "nível de instrução" pronta. |
| `anos_estudo` | `V4300` | `TRY_CAST` → INTEGER (NULL para `'20'`/`'30'`) | Não usado a jusante, mas vale carregar para o QA da derivação de `nivel_instr_4`. |
| `estudo_local` | `V4276` (141, 7) + `ocupado` | `NULL` quando a pessoa é ocupada (ver §3); senão: `'1'` se `V4276='0100008'` ou `V4276=cd_mun`; `'2'` se `V4276` é município/UF-sem-especificação ≠ `cd_mun`; `'3'` se `V4276` é país (`'80…'`); NULL se `'0200006'` ou branco | Vocabulário de `P0800` (1 neste município, 2 outro município do Brasil, 3 outro país). |
| `estudo_uf` | `V4276` | `SUBSTR(V4276,1,2)` quando é código brasileiro; `'54'` para `'5400007'`; NULL para país/`0100008`/`0200006` | Só usado pelo `interestadual` pendular, que o pipeline atual não publica; manter por contrato. |
| `estudo_mun` | `V4276` + `ocupado` | NULL quando ocupada; senão o código de 7 díg. quando for município ou UF-sem-especificação; NULL nos demais casos | |
| `estudo_pais` | — | `CAST(NULL AS VARCHAR)` | Não usado a jusante. |
| `ocupado_10` | `V0439`–`V0443` (176–184) | `'1'` se qualquer uma de `V0439..V0443` = `'1'`; `'2'` se todas preenchidas e nenhuma = `'1'`; NULL se todas brancas (menores de 10 anos) | Análogo direto de `P0960`/2022 e `V6920`/2010: o Censo 2000 **não tem** variável derivada de condição de ocupação. Cascata em cadeia (cada quesito só é feito a quem respondeu "não" no anterior), então "qualquer = 1" é a regra correta. Checagem cruzada obrigatória no QA: `ocupado_10='1'` ⇔ `V0447` não branco ⇔ `V4514` não branco. |
| `pos_ocup` | `V0447` (199, 1) + `V0448` (201, 1) | passar os dois; a recodificação fica no `02_classify` (§2) | `V0448` ("era empregado pelo RJU ou como militar") só é preenchida para `V0447='4'`. Sem ela, todo estatutário e militar cai em "sem carteira". |
| `atividade` | `V4462` (193, 5) | `NULLIF(TRIM(...), '')` | Classe de 5 díg. da **CNAE-Domiciliar 1.0** (≠ CNAE-DOM 2.0 de 2010). |
| `grande_grupo` | `V4452` (188, 4) | `NULLIF(TRIM(...), '')` | Código de 4 díg. da **CBO-Domiciliar 2000**. |
| `renda_trab` | `V4514` (222, 6, 2 dec.) | `TRY_CAST(...) / 1e2` | **Já em salários mínimos** (SM de julho/2000 = R$ 151,00). Branco exatamente para menores de 10 anos e para quem não tinha trabalho na semana de referência; trabalhador sem rendimento vem com **zero**, não branco. |
| `renda_todas_fontes` | `V4615` | `CAST(NULL AS DOUBLE)` ou `V4615/1e2` | Não usado a jusante; NULL é suficiente. |
| `trab_local` | `V4276` + `ocupado` | NULL quando **não** ocupada; senão: `'2'` se `V4276='0100008'` ou `V4276=cd_mun`; `'3'` se município/UF-sem-especificação ≠ `cd_mun`; `'4'` se país (`'80…'`); NULL se `'0200006'` ou branco | Vocabulário de `P1120`. **`'1'` (em casa/na propriedade) nunca ocorre em 2000**: o quesito 4.27 tem uma única quadrícula "NESTE MUNICÍPIO", que não separa trabalho no domicílio de trabalho fora dele. Mapear para `'2'` preserva `trabalha_no_mun = trab_local IN ('1','2')` em `07_pendular.sql`. **`'5'` (mais de um município) também nunca ocorre**: 2000 não tem essa categoria. |
| `trab_uf` | `V4276` | `SUBSTR(V4276,1,2)` quando é código brasileiro; `'54'` para `'5400007'`; NULL para país/`0100008`/`0200006` | `'54'` é sentinela, não UF. |
| `trab_mun` | `V4276` + `ocupado` | NULL quando não ocupada; senão o código de 7 díg. quando for município ou UF-sem-especificação; NULL nos demais casos | |
| `trab_pais` | — | `CAST(NULL AS VARCHAR)` | Não usado a jusante. |
| `retorna_3dias` | — | `CAST(NULL AS VARCHAR)` | **Não existe em 2000.** Não há quesito de frequência de retorno (nem diária nem semanal). |
| `transporte` | — | `CAST(NULL AS VARCHAR)` | **Não existe em 2000.** |
| `tempo_desloc_cat` | — | `CAST(NULL AS VARCHAR)` | **Não existe em 2000.** (2010 tinha 5 faixas; 2000 não tem nenhuma.) |
| `tempo_desloc_min` | — | `CAST(NULL AS INTEGER)` | **Não existe em 2000.** |
| `imp_df_local` | `M0424` (129, 1) | `NULLIF(TRIM(...), '')` | **Preencher** (2010 deixava NULL por não ter a marca; 2000 tem). |
| `imp_df_mun` | `M4250` (137, 1) | idem | |
| `imp_trab_mun` | `M4276` (148, 1) | idem | |

### Domicílios → `data/interim/2000/domicilios.parquet`

| Coluna | Variável(is) | Lógica | Observação |
|---|---|---|---|
| `uf`, `cd_mun`, `cd_apond` | `V0102` (1,2), `V0103` (12,7), `AREAP` **(52,13)** | direto | Atenção à posição de `AREAP`. |
| `controle` | `AREAP ‖ V0300` | `SUBSTR(52,13) ‖ SUBSTR(39,8)` | |
| `tipo_domicilio` | `V0201` (72, 1) | direto (1 particular permanente, 2 particular improvisado, 3 coletivo) | Não usado a jusante, mas útil no QA da renda per capita. |
| `renda_pc` | `V7617` (151, 6, 2 dec.) ÷ nº de moradores **elegíveis** | `V7617/1e2 / NULLIF(<moradores elegíveis>, 0)`, só quando `V0201 IN ('1','2')`; NULL para `V0201='3'` | Ver §4. **Não usar `V7100` cru como denominador.** |

---

## 2. Contrato de `pessoas_classificado.parquet` — as 49 colunas, na ordem

Mesmo nome, mesma ordem e mesmo tipo de 2022/2010, para que `03_indicators.sql`,
`04_flows.sql`, `07_pendular.sql` e `08_metro.sql` sejam reaproveitados.

| # | Coluna do contrato | Variável(is) 2000 | Lógica / CASE resumido | Observação |
|---|---|---|---|---|
| 1 | `uf` | `V0102` | passthrough | |
| 2 | `cd_mun` | `V1103` | passthrough | VARCHAR com zero-padding, nunca INTEGER. |
| 3 | `cd_apond` | `AREAP` | passthrough | Estrato do estimador de variância. |
| 4 | `controle` | `AREAP‖V0300` | passthrough | UPA do estimador de variância. |
| 5 | `peso` | `P001/1e8` | passthrough | |
| 6 | `idade` | `V4752` | passthrough | |
| 7 | `df_mun` | `V4250` | passthrough | |
| 8 | `df_uf` | `SUBSTR(V4250,1,2)` | passthrough | |
| 9 | `nivel_instr_4` | `V4300` | `'00'..'07'`→`'1'`; `'08'..'10'`→`'2'`; `'11'..'14'`→`'3'`; `'15'..'17'`→`'4'`; `'20'`→`'5'`; `'30'`→`'1'` | **Derivado de anos de estudo** (§5). Cortes-padrão do IBGE: 8 anos ≈ fundamental completo, 11 ≈ médio completo, 15 ≈ superior completo. `'30'` (alfabetização de adultos) é "sem instrução ou fundamental incompleto". O valor `'5'` cai no `ELSE 'nao_determinado'` do `CASE` compartilhado. |
| 10 | `renda_pc` | `V7617` ÷ moradores elegíveis | passthrough do parquet de domicílios | Em SM. Ver §4. |
| 11 | `imp_df_local` | `M0424` | passthrough | Vocabulário de marcas próprio de 2000 (`0` sem imputação, `1` NIM/IMPS, `2`–`C` estágios PRÉ-DIA/DIA/SPLUS). **Não comparável valor a valor** com as marcas `MP*` de 2022; uso interno de QA, nunca publicado. |
| 12 | `imp_df_mun` | `M4250` | passthrough | idem |
| 13 | `imp_trab_mun` | `M4276` | passthrough | idem |
| 14 | `trab_local` | `V4276` | passthrough (recodificado no extrato) | `'1'` e `'5'` nunca ocorrem — ver §1. |
| 15 | `trab_uf` | `V4276` | passthrough | Sentinela `'54'`. |
| 16 | `trab_mun` | `V4276` | passthrough | |
| 17 | `retorna_3dias` | — | `CAST(NULL AS VARCHAR)` | **NULL sempre.** |
| 18 | `transporte` | — | `CAST(NULL AS VARCHAR)` | **NULL sempre.** |
| 19 | `tempo_desloc_cat` | — | `CAST(NULL AS VARCHAR)` | **NULL sempre.** |
| 20 | `tempo_desloc_min` | — | `CAST(NULL AS INTEGER)` | **NULL sempre.** |
| 21 | `renda_trab` | `V4514/1e2` | passthrough | Em SM. |
| 22 | `freq_escolar` | `V0429` | passthrough | |
| 23 | `curso` | `V0430` | passthrough | |
| 24 | `estudo_local` | `V4276` | passthrough | NULL para ocupados (§3). |
| 25 | `estudo_uf` | `V4276` | passthrough | |
| 26 | `estudo_mun` | `V4276` | passthrough | NULL para ocupados (§3). |
| 27 | `ocupado` | `V0439`–`V0443` | `COALESCE(ocupado_10 = '1', FALSE)` | Universo 10 anos ou mais, idêntico a `P0960`/`V6920`. |
| 28 | `estudante` | `V0429` | `COALESCE(freq_escolar IN ('1','2'), FALSE)` | Mesma forma de 2010 (que separa rede pública/particular). **Ressalva de universo:** em 2000 o pré-vestibular conta como frequência à escola; em 2010/2022 não. Diferença pequena e para cima no denominador `estudantes`. |
| 29 | `pendular_trab` | `trab_local`, `trab_mun`, `cd_mun` | `COALESCE(trab_local='3' AND trab_mun IS NOT NULL AND SUBSTR(trab_mun,3,4) <> '0000' AND trab_mun <> cd_mun, FALSE)` | Universo: **ocupados** (o filtro `ocupado AND pendular_trab` continua em `07_pendular.sql`). O teste `SUBSTR(...,3,4) <> '0000'` substitui o `<> '99999'` de 2010 — ver §6. |
| 30 | `pendular_estudo` | `estudo_local`, `estudo_mun`, `cd_mun` | `COALESCE(estudo_local='2' AND estudo_mun IS NOT NULL AND SUBSTR(estudo_mun,3,4) <> '0000' AND estudo_mun <> cd_mun, FALSE)` | Universo efetivo: **estudantes não ocupados**, garantido estruturalmente porque `estudo_local`/`estudo_mun` já vêm NULL para ocupados (§3). |
| 31 | `pos_grupo` | `V0447` + `V0448` | `'1','3'`→`empregado_com_carteira`; `'4'` **e** `V0448='1'`→`militar_estatutario`; `'2'` ou (`'4'` e `V0448` ≠ `'1'`)→`empregado_sem_carteira`; `'5'`→`empregador`; `'6','7','8','9'`→`conta_propria_familiar` | **Ordem obrigatória**: testar `militar_estatutario` antes de `empregado_sem_carteira`. Em 2000 estatutários e militares foram codificados como "empregado sem carteira" e só se separam por `V0448`; ignorá-la infla a informalidade em vários pontos percentuais. |
| 32 | `setor_grupo` | `V4462` (CNAE-Dom 1.0) | por divisão (2 primeiros díg.), com a divisão 64 aberta na classe de 5 díg. — ver §7 | |
| 33 | `ocup_grupo` | `V4452` (CBO-Dom 2000) | `'0000'`→`'11'`; 1º díg. `'0'`→`'10'`; 1º díg. `'9'`→`'07'`; senão `'0'‖1º díg.` — ver §8 | A categoria `'09'` ("ocupações elementares") **nunca é produzida** em 2000. |
| 34 | `modo_grupo` | — | `CAST(NULL AS VARCHAR)` | **NULL sempre.** |
| 35 | `renda_trab_classe` | `renda_trab` | NULL→`sem_declaracao`; ≤1→`ate_1_sm`; ≤2→`de_1_a_2_sm`; ≤3→`de_2_a_3_sm`; ≤5→`de_3_a_5_sm`; senão `mais_de_5_sm` | **Idêntico ao de 2010** (cortes em SM, sem multiplicar por 151). `sem_declaracao` em 2000 significa "não ocupado" — nunca ocorre dentro de `pt`. |
| 36 | `curso_grupo` | `V0430` | `'01'..'07'`→`infantil_fundamental`; `'08','09','10'`→`medio`; `'11'`→`pre_vestibular`; `'12'`→`graduacao`; `'13'`→`pos_graduacao` | Ver §9. `pre_vestibular` é **categoria nova**, exclusiva de 2000 → dependência de front-end. `pos_graduacao` em 2000 = mestrado + doutorado; especialização não conta como frequência à escola em 2000. |
| 37 | `is_migrante` | `df_local` | `COALESCE(df_local IN ('2','3'), FALSE)` | `COALESCE` obrigatório: branco = não migrante. |
| 38 | `is_mig_interno` | `df_local` | `COALESCE(df_local='2', FALSE)` | |
| 39 | `is_mig_internacional` | `df_local` | `COALESCE(df_local='3', FALSE)` | |
| 40 | `origem_conhecida` | `df_local`, `df_mun` | `COALESCE(df_local='2' AND df_mun IS NOT NULL AND SUBSTR(df_mun,3,4) <> '0000', FALSE)` | §6. |
| 41 | `origem_valida` | idem + `cd_mun` | `origem_conhecida AND df_mun <> cd_mun` | Única fonte de `fluxos`/`emig`/`saldo`; garante Σ imigrantes = Σ emigrantes. |
| 42 | `interestadual` | `df_local`, `df_uf`, `uf` | `COALESCE(df_local='2' AND df_uf IS NOT NULL AND df_uf <> uf AND df_uf <> '54', FALSE)` | `'54'` é a sentinela "Brasil sem especificação" — o análogo de `'88'/'98'/'99'` de 2010. |
| 43 | `status` | `df_local`, `nasc_local`, `nacionalidade`, `df_mun` | vocabulário **reduzido de 2010**: `internacional_brasileiro` / `internacional_estrangeiro` / `retorno_natal` / `nascido_exterior` / `origem_nao_informada` / `nao_natural` / `outro` | Ver §10. `COALESCE(nacionalidade,'1')` obrigatório (branco = brasileiro nato natural da UF). Sentinela de origem desconhecida = `SUBSTR(df_mun,3,4)='0000'`. |
| 44 | `retorno_uf_natal` | `df_local`, `nasc_local`, `nasc_uf`, `uf`, `df_uf` | `COALESCE(df_local='2' AND nasc_local='2' AND nasc_uf=uf AND df_uf <> uf AND df_uf <> '54', FALSE)` | Mesma forma de 2010, trocando as sentinelas. |
| 45 | `edu_grupo` | `nivel_instr_4` | `CASE WHEN idade >= 25 THEN CASE nivel_instr_4 ... END END` — **o mesmo CASE de 2022/2010, sem alteração** | Só muda a **origem** de `nivel_instr_4` (§5). Vocabulário de saída idêntico: `sem_instr_fund_incompleto`, `fund_completo_medio_incompleto`, `medio_completo_superior_incompleto`, `superior_completo`, `nao_determinado`. |
| 46 | `renda_classe` | `renda_pc` | NULL→`nao_aplicavel`; ≤0,25→`ate_1_4_sm`; ≤0,50→`de_1_4_a_1_2_sm`; ≤1→`de_1_2_a_1_sm`; ≤2→`de_1_a_2_sm`; senão `mais_de_2_sm` | **Idêntico ao de 2010** (cortes em SM). `nao_aplicavel` = domicílio coletivo. |
| 47 | `idade_grupo` | `idade` | idêntico a 2022/2010 | `05_14/15_24/25_39/40_59/60_mais`, NULL para <5. |
| 48 | `sexo_label` | `V0401` | `CASE sexo WHEN 1 THEN 'M' WHEN 2 THEN 'F' ELSE 'ignorado' END` | `V0401` não tem categoria "ignorado" em 2000 — o `ELSE` só pega branco. |
| 49 | `idade_sexo_grupo` | `idade`, `V0401` | idêntico a 2022/2010 | |

---

## 3. Deslocamento pendular: uma pergunta, dois universos

O Censo 2000 tem **um único quesito de deslocamento**, o 4.27 — "EM QUE MUNICÍPIO E UNIDADE DA
FEDERAÇÃO, OU PAÍS ESTRANGEIRO, TRABALHA OU ESTUDA?" (`V4276`) —, sem filtro de idade e sem
quesito separado para estudo. O Manual do Recenseador (p. 67) resolve o conflito com uma
instrução literal:

> "Caso trabalhe e estude em municípios distintos de onde mora, registre o município em que
> trabalha."

Ou seja, **o trabalho tem precedência**. Consequências operacionais, todas obrigatórias:

1. Para quem é **ocupado** (`ocupado_10 = '1'`), `V4276` é o município de **trabalho**:
   preencher `trab_local`/`trab_uf`/`trab_mun` e deixar `estudo_*` **NULL**.
2. Para quem **não é ocupado**, `V4276` só pode ser o município de **estudo** (ou
   `0200006` = "não trabalha, nem estuda"): preencher `estudo_*` e deixar `trab_*` **NULL**.
3. Quem trabalha **e** estuda contribui só para o fluxo de trabalho. Não há dupla contagem, e
   `pendular_trab` e `pendular_estudo` continuam a ser colunas separadas do contrato.
4. O universo de restrição **não** entra como um `AND NOT ocupado` no `02_classify.sql`: ele é
   estrutural, no `01_extract.sql`, porque para um ocupado a informação de onde estuda
   simplesmente **não existe** no dado. Um NULL diz isso; um filtro a jusante, não.
5. **Viés conhecido, para baixo, no fluxo de estudo.** A quadrícula "1 - NESTE MUNICÍPIO" vale
   "caso a pessoa recenseada trabalhe **ou** estude no município de residência": quem trabalha no
   próprio município e estuda em outro assinala "neste município", e desaparece do fluxo de
   estudo. Somado ao item 3, `saida_estudo` em 2000 é um **piso**, não uma estimativa do total —
   não comparável em nível com 2010/2022, só em composição e em direção.

Códigos especiais de `V4276` (`labels_2000.CODIGOS_ESPECIAIS_2000`):

| Código | Significado | `trab_local` (ocupado) | `estudo_local` (não ocupado) |
|---|---|---|---|
| `0100008` | NESTE MUNICÍPIO | `'2'` | `'1'` |
| `0200006` | NÃO TRABALHA, NEM ESTUDA | NULL | NULL |
| 7 díg. IBGE = `cd_mun` | (imputação/inconsistência) | `'2'` | `'1'` |
| 7 díg. IBGE ≠ `cd_mun` | outro município | `'3'` | `'2'` |
| `UU00001` (27 códigos) | UF sem especificação / Brasil sem especificação | `'3'`, destino desconhecido | `'2'`, destino desconhecido |
| `80xxxxx` (69 códigos) | país estrangeiro | `'4'` | `'3'` |

**Não existe** em 2000 o equivalente de `P1120=5` / `V0660=5` ("mais de um município"):
`varios_municipios` sai zerado em `municipios_pendular.parquet`. Também não existe o
equivalente de `P1120=1` ("em casa ou na propriedade").

---

## 4. Renda domiciliar per capita

O Censo 2000 **não publica** uma variável de rendimento domiciliar per capita (2010 tem `V6532`,
2022 tem `D0360`). Tem de ser construída — e a construção ingênua está errada:

- `V7616`/`V7617` (rendimento domiciliar em R$ / em SM) já excluem do **numerador**, por
  definição do IBGE, "as pessoas consideradas na condição do domicílio como pensionistas,
  empregados domésticos e parentes dos empregados domésticos" (Documentação, V7616/V7617).
- `V7100` ("total de moradores no domicílio") **inclui** essas pessoas.

Dividir `V7617` por `V7100` mistura duas populações e subestima a renda per capita justamente
nos domicílios que têm empregado doméstico residente ou pensionista. A construção correta,
compatível com `V6532`/2010 e `D0360`/2022:

```
renda_pc(SM) = (V7617 / 100) / NULLIF(<nº de moradores com V0402 NOT IN ('09','10','11')>, 0)
```

onde o denominador vem de um `GROUP BY controle` sobre o arquivo de **pessoas** (`V0402` =
relação com o responsável pelo domicílio: `09` pensionista, `10` empregado doméstico,
`11` parente do empregado doméstico). Calcular só para `V0201 IN ('1','2')` (domicílio
particular); `NULL` para `V0201 = '3'` (coletivo), que vira `nao_aplicavel` no `renda_classe`,
exatamente como em 2010/2022.

QA: conferir que `<moradores elegíveis> <= V7100` em 100% dos domicílios particulares e que a
diferença agregada é da ordem de 1% dos moradores.

Topo de código: `V7616` satura em R$ 999.998 (e `V7617` no equivalente em SM), assim como
`V4513`. Irrelevante para classes de SM, mas registrar no QA.

---

## 5. Escolaridade: `V4300` (anos de estudo), e não `V0432`+`V0434`+`V4355`

Fonte escolhida: **`V4300` — "ANOS DE ESTUDO"**, derivada pelo próprio IBGE.

Por quê não `V0432`/`V0433`/`V0434`/`V4355`: essas quatro são **brancas para os estudantes**
("Branco – para os estudantes", SAS e Documentação). Reconstruir o nível de instrução a partir
delas produziria NULL para toda pessoa que ainda frequenta escola — inclusive os 25+ em EJA,
graduação e pós, que é exatamente a ponta alta da distribuição e a mais seletiva na migração.
Cobrir os dois ramos exigiria combinar `V0430`+`V0431` (estudantes) com
`V0432`+`V0433`+`V0434` (não estudantes) e reimplementar, com risco, a regra que o IBGE já
aplicou para produzir `V4300`.

`V4300` não tem cláusula de branco (é calculada para toda a população) e tem vocabulário
fechado: `'00'`–`'17'` anos, `'20'` não determinado, `'30'` alfabetização de adultos.

Recodificação para `nivel_instr_4` (vocabulário de `P0770`/`V6400`):

| `V4300` | `nivel_instr_4` | `edu_grupo` |
|---|---|---|
| `'00'`–`'07'`, `'30'` | `'1'` | `sem_instr_fund_incompleto` |
| `'08'`–`'10'` | `'2'` | `fund_completo_medio_incompleto` |
| `'11'`–`'14'` | `'3'` | `medio_completo_superior_incompleto` |
| `'15'`–`'17'` | `'4'` | `superior_completo` |
| `'20'` | `'5'` | `nao_determinado` |

Cortes: são os limiares clássicos do IBGE (8 anos = fundamental completo; 11 = médio completo;
15 = superior completo). **Aproximação conhecida:** graduações de 3 anos totalizam 14 anos de
estudo e caem em `medio_completo_superior_incompleto`, então `superior_completo` fica
ligeiramente subestimado em 2000 frente a 2010/2022, onde a variável de nível vem do curso
concluído e não da contagem de anos. Deve ser medido no QA comparando a proporção de
`superior_completo` entre 25+ em 2000 com a série do IBGE.

---

## 6. Origem "UF sem especificação" — o equivalente do `UF99999` de 2010

Em 2010 a origem desconhecida é `UF‖'99999'` (um código por UF). Em 2000 a sentinela tem
**outra forma**: `labels_2000.UF_SEM_ESPECIFICACAO_2000`, 27 códigos de 7 dígitos que parecem
códigos de município legítimos (dígito verificador incluso) — `1100001` = "RONDÔNIA - SEM
ESPECIFICAÇÃO", `3500006` = "SÃO PAULO - SEM ESPECIFICAÇÃO", …, mais `5400007` = "BRASIL - SEM
ESPECIFICAÇÃO" (o caso "não sabe nem a UF"). O Distrito Federal não tem código próprio de
"sem especificação", por ter um único município.

Teste estrutural seguro: **`SUBSTR(codigo, 3, 4) = '0000'`**. Verificado contra
`labels_2000.MUNICIPIOS_2000`: nenhum dos 5.507 municípios reais de 2000 casa com esse padrão,
e os 27 sentinelas casam todos. Vale igualmente para `V4250` (origem) e `V4276` (destino
pendular). Alternativa equivalente e mais explícita: `IN (<lista de 27>)`.

Tratamento: idêntico ao de 2022/2010 — esses registros contam na **imigração total** do destino
(`is_mig_interno`, `imig_ni`) e recebem `status = 'origem_nao_informada'`, mas ficam **fora** da
matriz origem→destino e do cômputo de emigração (`origem_conhecida` e `origem_valida` falsos).

Na UF, a sentinela correspondente é `df_uf = '54'` (de `5400007`), equivalente ao `'98'/'99'` de
2010 e ao `'88'/'99'` de 2022. `V4260 = '29'` ("BRASIL SEM ESPECIFICAÇÃO") é a mesma coisa pelo
lado do sequencial — e **`labels_2000.UF_SEQ_2000` não tem a chave `'29'`**, então é preciso
tratá-la explicitamente em vez de deixar cair no ramo "país estrangeiro".

---

## 7. `setor_grupo` — CNAE-Domiciliar 1.0 → os 8 grupos de 2022

`V4462` é a **classe de 5 dígitos da CNAE-Dom 1.0** (seções A–Q, estrutura de 1994), não a
CNAE-DOM 2.0 de 2010 (seções A–V) nem os 22 grupos já agregados de `P1030`/2022. O princípio do
crosswalk é o mesmo das duas edições anteriores: **agregar por seção**, e depois mapear as seções
para os 8 grupos publicados. A seção sai da **divisão** (2 primeiros dígitos), com uma exceção.

| Divisões (2 díg.) | Seção CNAE-Dom 1.0 | `setor_grupo` |
|---|---|---|
| `01`, `02` | A Agricultura, pecuária, silvicultura e exploração florestal | `agropecuaria` |
| `05` | B Pesca | `agropecuaria` |
| `10`–`14` | C Indústrias extrativas (inclui `12`, sob o cabeçalho da divisão 13) | `industria` |
| `15`–`37` | D Indústrias de transformação | `industria` |
| `40`, `41` | E Eletricidade, gás e água | `industria` |
| `45` | F Construção | `construcao` |
| `50`, `53` | G Comércio; reparação | `comercio` |
| `55` | H Alojamento e alimentação | `outros_servicos` |
| `60`–`63` | I Transporte e armazenagem | `transporte_logistica` |
| **`64`** | I Correio **e** telecomunicações | **dividir na classe**: `64010` (correio) → `transporte_logistica`; `64020` (telecomunicações) → `servicos_empresariais` |
| `65`–`67` | J Intermediação financeira | `servicos_empresariais` |
| `70`–`74` | K Imobiliárias, aluguéis e serviços às empresas | `servicos_empresariais` |
| `75` | L Administração pública, defesa e seguridade social | `admin_educacao_saude` |
| `80` | M Educação | `admin_educacao_saude` |
| `85` | N Saúde e serviços sociais | `admin_educacao_saude` |
| `90`–`93` | O Outros serviços coletivos, sociais e pessoais | `outros_servicos` |
| `95` | P Serviços domésticos | `outros_servicos` |
| `99` | Q Organismos internacionais | `outros_servicos` |
| `00` | Atividades mal especificadas | `outros_servicos` |

Notas para quem escrever o `CASE`:

- **A divisão 64 é a única que não pode ser resolvida em 2 dígitos.** Na CNAE-Dom 1.0 correio e
  telecomunicações moram juntos na seção I (transporte e comunicações); na CNAE 2.0 de 2010 o
  correio ficou em H (transporte, divisão 53 → `transporte_logistica`) e as telecomunicações em J
  (informação e comunicação, divisão 61 → `servicos_empresariais`). Testar `V4462 = '64010'` e
  `'64020'` **antes** de qualquer `BETWEEN` de 2 dígitos que cubra 64.
- Faixas com buracos: não existem as divisões 03, 04, 06–09, 38, 39, 42–44, 46–49, 51, 52,
  54, 56–59, 68, 69, 76–79, 81–84, 86–89, 94, 96–98. Por isso `BETWEEN '10' AND '41'`,
  `BETWEEN '65' AND '74'`, `BETWEEN '75' AND '85'` e `BETWEEN '90' AND '99'` são seguros e
  compactos — mas só enquanto o `'45'`, o `'50'/'53'`, o `'55'` e a divisão `64` forem testados
  antes/fora dessas faixas.
- `NULL`/branco (menores de 10 anos e não ocupados) → `NULL`, que `07_pendular.sql` transforma
  em `'ignorado'`.
- Perda de detalhe conhecida: a CNAE-Dom 1.0 funde atacado e varejo numa única divisão (53) e
  não separa "água e esgoto" da geração de energia — nenhuma das duas afeta os 8 grupos.

---

## 8. `ocup_grupo` — CBO-Domiciliar 2000 → os códigos `'01'`..`'11'`

`V4452` é o código de 4 dígitos da CBO-Domiciliar 2000 (família CBO-94/2002), cujo **grande
grupo é o primeiro dígito**, mais o código especial `0000` = "OCUPAÇÕES MAL ESPECIFICADAS".
Estruturalmente é o mesmo formato da COD 2010, mas os grandes grupos **não** são os da ISCO-08:

| 1º díg. 2000 | Título CBO-Dom 2000 | → `ocup_grupo` | Equivalente 2022/2010 |
|---|---|---|---|
| `1` | Membros superiores do poder público, dirigentes, gerentes | `'01'` | Diretores e gerentes |
| `2` | Profissionais das ciências e das artes | `'02'` | Profissionais das ciências e intelectuais |
| `3` | Técnicos de nível médio | `'03'` | Técnicos de nível médio |
| `4` | Trabalhadores de serviços administrativos | `'04'` | Apoio administrativo |
| `5` | Trabalhadores dos serviços, vendedores | `'05'` | Serviços e vendedores |
| `6` | Trabalhadores agropecuários, florestais, caça e pesca | `'06'` | Agropecuária |
| `7` | Trabalhadores da produção de bens e serviços industriais | `'07'` | Construção, artes mecânicas e ofícios |
| `8` | Trabalhadores da produção de bens e serviços industriais (cont.) | `'08'` | Operadores de instalações e máquinas |
| `9` | **Trabalhadores de reparação e manutenção** | **`'07'`** | — (ver abaixo) |
| `0` | Membros das forças armadas, policiais e bombeiros militares | `'10'` | idem |
| `0000` | Ocupações mal especificadas | `'11'` | Ocupações maldefinidas |

Ordem obrigatória no `CASE`: `'0000'` **antes** do teste de prefixo `'0'`.

**A decisão não óbvia é o grande grupo 9.** A CBO-Dom 2000 não tem um grande grupo de "ocupações
elementares" (o GG 9 da ISCO-08, usado em 2010 e 2022): o seu GG 9 é "trabalhadores de reparação
e manutenção" — mecânicos, eletricistas, reparadores —, que na ISCO-08 caem majoritariamente no
GG 7. Mapear `9 → '09'` por simetria de dígito rotularia trabalhadores qualificados como
"Ocupações elementares" no front-end (`MAPA_OCUPACAO` em `web/src/lib/rm.ts` manda `'09'` para a
classe `elementares`). Mapeia-se `9 → '07'`, que o front-end agrega em
`industria_operadores` junto com `'08'` — rótulo correto.

### Consequências a declarar — a redistribuição atinge três classes, não uma

A ressalva óbvia é que `elementares` fica **estruturalmente vazia** em 2000 (não é zero por
acaso) e que `industria_operadores` fica **mais larga**, porque absorve o GG 9 de reparação e
manutenção. Mas essa é só metade do problema, e a metade menor.

O problema maior não é o mapeamento do GG 9 — é que a CBO-Dom 2000 **não tem o conceito de
ocupação elementar em lugar nenhum**. Os três blocos de trabalho não qualificado que a ISCO-08
reúne no seu GG 9 estão, na CBO-Dom 2000, distribuídos pelos grandes grupos da atividade
correspondente:

| Bloco (ISCO-08 GG 9 "elementares") | Onde está na CBO-Dom 2000 | → `ocup_grupo` | Classe do front |
|---|---|---|---|
| Trabalhadores domésticos, faxineiros, ajudantes de limpeza | GG 5 (serviços, vendedores) | `'05'` | `servicos_vendedores` |
| Trabalhadores agrícolas e da pecuária sem qualificação | GG 6 (agropecuários, florestais) | `'06'` | `agropecuaria` |
| Serventes de obra, ajudantes de produção, carregadores | GG 7 (produção industrial) | `'07'` | `industria_operadores` |

Ou seja: **três** classes de 2000 ficam mais largas que as suas homônimas de 2010/2022, cada uma
por absorver um pedaço diferente do que virou "elementares" na ISCO-08 — e não só
`industria_operadores`.

Isso é visível nos dados publicados. Distribuição da dimensão `ocupacao` de
`pendular_trab_dim.parquet` (universo: deslocamentos pendulares para trabalho em pares publicados,
já agrupada pelo `MAPA_OCUPACAO` do front-end; % da soma de `valor`):

| Classe do front | 2000 | 2010 | 2022 |
|---|---:|---:|---:|
| `servicos_vendedores` | **31,5%** | 15,2% | 17,1% |
| `industria_operadores` | **29,6%** | 21,7% | 19,2% |
| `tecnicos_administrativo` | 21,4% | 18,5% | 20,7% |
| `dirigentes_profissionais` | 9,8% | 13,8% | 18,7% |
| `mal_definidas` | 4,9% | 12,0% | 8,9% |
| `forcas_seguranca` | 1,5% | 0,9% | 0,8% |
| `agropecuaria` | **1,3%** | 0,5% | 0,3% |
| `elementares` | **0,0%** | 17,5% | 14,4% |

As três classes em negrito são as que absorvem a massa: os 17,5% de `elementares` de 2010 somem e
reaparecem principalmente em `servicos_vendedores` (+16,3 p.p. de 2010 para 2000) e
`industria_operadores` (+7,9 p.p.), com `agropecuaria` quase triplicando (+0,8 p.p. — proporção
pequena porque quem trabalha na agropecuária raramente faz deslocamento pendular intermunicipal,
não porque o efeito seja pequeno).

Duas leituras erradas que esta tabela precisa impedir:

- **"Serviços e vendedores dobrou entre 2000 e 2010"** — não dobrou; a classe de 2000 contém os
  trabalhadores domésticos que em 2010 estão em `elementares`.
- **"A agropecuária pendular caiu para um terço"** — a de 2000 inclui os trabalhadores agrícolas
  sem qualificação, que em 2010 estão em `elementares`.

Três ressalvas sobre a própria tabela, para não sobreatribuir:

- `mal_definidas` (4,9% / 12,0% / 8,9%) varia por qualidade de codificação, não por questionário,
  e dilui todas as outras classes em proporção diferente a cada edição — o que torna as
  comparações de p.p. acima aproximadas.
- `dirigentes_profissionais` sobe monotonicamente (9,8% → 13,8% → 18,7%) e **não** é artefato de
  classificação: os GG 1 e 2 da CBO-Dom 2000 correspondem aos GG 1 e 2 da ISCO-08 sem
  redistribuição. Essa é uma mudança real da composição ocupacional dos pendulares.

- **O universo da tabela é o pendular publicado, não a população ocupada.** As proporções acima
  valem para quem faz deslocamento pendular intermunicipal para trabalho, em pares que passaram no
  gate de revelação. Sobre toda a população ocupada as proporções são outras — `agropecuaria`, em
  particular, é uma fatia grande dos ocupados e minúscula dos pendulares, porque trabalho agrícola
  raramente atravessa a divisa do município. Uma auditoria intermediária mediu a redistribuição no
  universo mais largo e chegou a números bem diferentes em nível (agropecuária na casa dos 10–20%,
  não 1%), mantendo o mesmo padrão qualitativo das três classes. Ao citar percentuais, diga sempre
  de qual universo.

Conclusão operacional: a dimensão `ocupacao` de 2000 lê-se dentro da edição (qual classe domina
qual fluxo), nunca como série entre edições — nem mesmo para `servicos_vendedores`,
`agropecuaria` e `industria_operadores`, que à primeira vista parecem ter o mesmo rótulo nas três.

---

## 9. `curso_grupo` — e o pré-vestibular

`V0430` tem 13 códigos, contra 11 de `P0660`/2022 e 12 de `V0629`/2010.

| `V0430` | Descrição | `curso_grupo` |
|---|---|---|
| `01` creche, `02` pré-escolar, `03` classe de alfabetização, `04` alfabetização de adultos, `05` EF regular seriado, `06` EF regular não-seriado, `07` supletivo do EF | | `infantil_fundamental` |
| `08` EM regular seriado, `09` EM regular não-seriado, `10` supletivo do EM | | `medio` |
| `11` | **Pré-vestibular** | **`pre_vestibular`** |
| `12` | Superior — graduação | `graduacao` |
| `13` | Superior — mestrado ou doutorado | `pos_graduacao` |

Duas divergências, ambas declaradas em vez de aproximadas:

1. **`pre_vestibular` é categoria nova, só de 2000.** O pré-vestibular conta como frequência à
   escola no Censo 2000 (Manual, quesito 4.29) e não conta em 2010 nem em 2022. Dobrá-lo em
   `medio` colocaria na faixa "médio" gente que **já concluiu** o médio (o Manual manda registrar
   ensino médio para quem cursa os dois simultaneamente, então `V0430='11'` é o cursinho puro);
   jogá-lo em `ignorado` esconderia um fluxo pendular real e clássico (cursinho na cidade maior).
   **Dependência de front-end:** adicionar a chave `pre_vestibular` a `DIMENSOES_PENDULAR.nivel`
   em `web/src/lib/paletas.ts` e o rótulo em `pipeline/edicoes.py` (`rotulos_pendular`), como já
   se fez com as faixas de tempo de 2010. Se o implementador preferir não tocar no vocabulário
   compartilhado, a alternativa é uma variante `nivel2000` no mesmo esquema de `tempo2010` — o
   que **não** pode acontecer é cair calado em `medio`.
2. **`pos_graduacao` de 2000 é mais estreita.** Mestrado e doutorado vêm fundidos num único
   código e a especialização não é considerada frequência à escola em 2000
   ("A pessoa que está freqüentando curso de especialização ou extensão universitária, não será
   considerada como freqüentando escola" — Manual, 4.29), enquanto `P0660`/2022 tem
   especialização (`09`), mestrado (`10`) e doutorado (`11`) separados.

---

## 10. `status` — por que 2000 usa o vocabulário reduzido de 2010

Decisão: **manter exatamente o vocabulário de 2010** —
`retorno_natal`, `nao_natural`, `nascido_exterior`, mais `internacional_brasileiro`,
`internacional_estrangeiro` e `origem_nao_informada` —, registrando
`STATUS_POR_EDICAO["2000"] = ["retorno_natal", "nao_natural", "nascido_exterior"]` em
`pipeline/disclosure_rules.py` e a mesma lista em `web/src/lib/edicoes.ts`.

Não é uma escolha de conveniência: é o máximo que o dado permite. A distinção de 2022 entre
`primeira_saida` (a residência de 2017 era o município natal) e `etapas_multiplas` (não era)
exige comparar `df_mun` com `nasc_mun`. O Censo 2000 **não coleta o município de nascimento** —
o quesito 4.21 pergunta "qual é a Unidade da Federação ou país estrangeiro de nascimento?", e
`V4210` é um sequencial de UF/país, nunca um município. É exatamente a mesma ausência de 2010.

O que 2000 tem **a mais** que 2010 no bloco de naturalidade não cria categoria nova:
`V0417` ("nasceu neste município", 1/2) e `V0418` ("nasceu nesta UF", 1/2) são dois quesitos onde
2010 tinha um (`V0618`, de três valores), mas o resultado é o mesmo `nasc_local` de três valores
(neste município / outro município do Brasil / exterior). Uma quarta categoria continua
impossível. Em compensação, `retorno_natal` em 2000 é tão direto quanto em 2010: entre migrantes
(`V0415='2'`), `nasc_local='1'` só pode vir de `V0417='1'` — "não mora aqui desde que nasceu,
mas nasceu aqui" —, medido pelo próprio quesito e não por inferência.

O que 2000 tem a mais e **não** é aproveitado: `V0424` distingue a zona **urbana** da **rural** da
residência de 1995 (códigos 1–4), dimensão que nem 2010 nem 2022 têm. Publicá-la criaria um eixo
sem par nas outras edições; fica registrada aqui como material disponível para análise futura,
não como coluna do contrato.

`CASE` (mesma ordem de 2010, trocando as sentinelas):

```
df_local='3' e COALESCE(nacionalidade,'1') IN ('1','2')  -> internacional_brasileiro
df_local='3'                                             -> internacional_estrangeiro
df_local='2' e nasc_local='1'                            -> retorno_natal
df_local='2' e nasc_local='3'                            -> nascido_exterior
df_local='2' e (df_mun IS NULL ou SUBSTR(df_mun,3,4)='0000') -> origem_nao_informada
df_local='2' e nasc_local='2'                            -> nao_natural
df_local='2'                                             -> outro
senão                                                    -> NULL
```

`COALESCE(nacionalidade, '1')`: `V0419` é branca "para os não migrantes e os naturais da Unidade
da Federação onde foi realizado o Censo 2000", isto é, o branco significa brasileiro nato — o
mesmo motivo do `COALESCE` de 2010.

**Subcontagem conhecida de `nascido_exterior`:** o Manual manda registrar "Brasil" em 4.21 para
os brasileiros natos nascidos em país estrangeiro (`V4210='29'`), e esses declaram `V0419='1'`.
Eles ficam em `nao_natural`, não em `nascido_exterior`. Em 2022 `P0480='3'` os captura. É um
grupo pequeno; medir no QA a proporção de `nascido_exterior` entre migrantes internos nas três
edições.

---

## 11. Módulo metropolitano e `07_pendular.sql`: o que fica NULL

| Coluna | 2022 | 2010 | **2000** | Motivo |
|---|---|---|---|---|
| `pct_coletivo` | valor | NULL | **NULL** | Sem quesito de meio de transporte. |
| `tempo_mediano` | valor | NULL | **NULL** | Sem tempo em minutos (2010 tinha faixas; 2000 não tem nem faixas). |
| `pct_diario` | valor | valor | **NULL** | **Divergência frente a 2010.** O Censo 2000 não tem quesito nenhum de frequência de retorno: nem "retorna diariamente" (`V0661`/2010) nem "retorna 3+ dias por semana" (`P1160`/2022). O bloco de deslocamento de 2000 é o quesito 4.27 e nada mais. |

Gravar sempre `CAST(NULL AS DOUBLE)` explícito, nunca deixar o agregador convergir para NULL por
efeito colateral — e nunca `0`: "esta edição não mede isso" não é "o valor medido é zero".

Dimensões de `pendular_trab_dim_bruto.parquet` em 2000: **seis** — `posicao`, `setor`,
`ocupacao`, `renda_trab`, `edu`, `idade_sexo`. Saem as dimensões `modo` (já ausente em 2010),
`frequencia` e `tempo` (ambas presentes em 2010). Publicar uma dimensão cujas categorias são
todas `'ignorado'`/`'nao_se_aplica'` sugeriria dado que não existe.

`pendular_estudo_dim_bruto.parquet` mantém as duas dimensões de sempre (`nivel`, `idade_sexo`).

Dependências para o implementador, fora do SQL:

- `pipeline/edicoes.py`: entrada `"2000"` com `raw="data/raw2000"`, `interim="data/interim/2000"`,
  `processed="data/processed/2000"`, `geo_raw="data/geo/raw/2000"`, `salario_minimo=151.00`,
  `periodo_referencia={"de": "1995-07-31", "ate": "2000-07-31"}`, `acesso="publico"`,
  `sql_override_dir="pipeline/sql/2000"` e
  `rotulos_pendular={"frequencia": None, "modo": None, "tempo": None}`.
- `pipeline/disclosure_rules.py`: `STATUS_POR_EDICAO["2000"]` (§10) — sem isso
  `dimensoes("2000")` levanta `ValueError` de propósito.
- `web/src/lib/edicoes.ts`: entrada `"2000"`; os flags atuais (`modo`, `tempoMinutos`) não bastam,
  porque 2010 ainda tem faixas de tempo e frequência e 2000 não tem nenhuma das duas — são
  necessários flags novos (p.ex. `tempoFaixas` e `frequencia`) ou `rotuloRetorno: null`.
- `web/src/lib/paletas.ts`: chave `pre_vestibular` na dimensão `nivel` (§9).

---

## 12. Lista de verificações para o QA da F2 (edição 2000)

> **Status: executada.** Os resultados sobre os dados publicados estão em `docs/METODOLOGIA.md`,
> "Validações realizadas (F6, edição Censo 2000)". Resumo: todas passaram; as identidades de
> fechamento (itens 6 e 7) fecham até o arredondamento a múltiplos de 5 das regras de revelação,
> e a Σ `peso` (item 1) deu 169.872.856, +0,04% sobre o universo.

1. Σ `peso` da amostra de pessoas ≈ 169.799.170 (população do Censo 2000). Divergência pequena é
   esperada e documentada pelo IBGE ("é possível a ocorrência de divergência entre o valor do
   número de pessoas calculado através da expansão da amostra e o valor verificado no universo,
   para alguns municípios").
2. 5.507 municípios distintos em `cd_mun`; 27 UFs; todos os `cd_mun` presentes em
   `labels_2000.MUNICIPIOS_2000` **e** em `labels.RECORTES` (já verificado: 0 faltantes).
3. Join pessoas↔domicílios por `controle`: 100%. Conferir que a contagem de áreas de ponderação
   distintas é **9.336** (Documentação, "A definição das áreas de ponderação").
4. `ocupado_10 = '1'` ⇔ `V0447` não branco ⇔ `V4514` não branco (três caminhos independentes).
5. Nenhum `df_mun`/`trab_mun`/`estudo_mun` fora de `MUNICIPIOS_2000 ∪ UF_SEM_ESPECIFICACAO_2000`.
6. Σ imigrantes = Σ emigrantes; Σ saldos = 0; zero pares origem=destino em `fluxos_bruto`.
7. Σ saída pendular para trabalho = Σ entrada pendular para trabalho (idem estudo).
8. `varios_municipios` = 0 em todos os municípios (categoria inexistente em 2000) e
   `trab_local = '1'` em zero registros.
9. `pct_diario`, `pct_coletivo` e `tempo_mediano` nulos em 100% das linhas onde aparecem.
10. `ocup_grupo = '09'` em zero registros (§8); `curso_grupo = 'pre_vestibular'` com contagem
    plausível e não nula.
11. Distribuição do CV dos fluxos na mesma ordem de grandeza de 2010 e 2022 (frações amostrais
    10%/20% em 2000, comparáveis às de 2010).
12. `<moradores elegíveis> <= V7100` em 100% dos domicílios particulares (§4).
