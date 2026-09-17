# Genealogia municipal (F12.1)

Gerado por `pipeline/build_genealogia.py`. Metadado de comparabilidade territorial para a seção "Ao longo dos censos" (F12) -- **não é AMC** e não entra no SQL do pipeline nem em `municipios_ref`. Fonte: sobreposição espacial das malhas municipais públicas do IBGE (`data/geo/raw/**`), nunca microdados.

## Ausência por edição

| Edição | Municípios de 2022 ausentes na malha | `multiplos_pais` | `sem_intersecao_por_centroide` | `sem_correspondencia` | `unidade_agregada` |
|---|---:|---:|---:|---:|---:|
| 2010 | 5 (esperado ~8, `docs/METODOLOGIA.md`) | 1 | 0 | 0 | 0 |
| 2000 | 63 (esperado ~66, `docs/METODOLOGIA.md`) | 22 | 0 | 0 | 0 |
| 1991 | 1079 (esperado ~1082, `docs/METODOLOGIA.md`) | 277 | 0 | 0 | 0 |
| 1980 | 1631 (esperado ~1634, `docs/METODOLOGIA.md`) | 281 | 0 | 0 | 139 |

A contagem "esperado" de `docs/METODOLOGIA.md` mede **códigos de `labels.RECORTES` sem par na edição**, uma tabela de rótulos; esta genealogia mede **códigos de `municipios_ref.parquet` (2022, 5.570 municípios) sem par na MALHA** (shapefile) da edição. As duas contam quase a mesma coisa, mas de fontes diferentes -- se divergirem muito, ver a nota abaixo, por edição.

## Casos sem interseção direta (ilhas/arquipélagos)

Nenhum caso: todo município de 2022 teve pelo menos uma interseção geométrica direta com algum polígono da malha de cada edição antiga. O plano do F12.1 previa ~7 casos (ilhas/arquipélagos, ex.: Fernando de Noronha) exigindo o casamento por centroide -- não ocorreram porque **os scripts de aquisição da malha já normalizam esses códigos antes de publicar o shapefile**: Fernando de Noronha (2605459) chega com o mesmo código em todas as edições -- inclusive 1980, onde `geo/fetch_1980.sh` remapeia explicitamente o código de Território Federal '2000107' para '2605459' -- logo aparece como `existia = true`, não como caso sem interseção. Não há, na malha nacional consolidada que o atlas usa, nenhum outro arquipélago publicado como município que fique geometricamente isolado o bastante para falhar `ST_Intersects` contra as quatro malhas antigas.


## `NORTEGO` como pai em 1980 (Tocantins)

139 municípios de 2022 têm `cd_mun_mae = 'NORTEGO'` na edição 1980, dos quais 139 com `metodo = 'unidade_agregada'` (os 139 municípios de UF '17', Tocantins -- tratados à parte da sobreposição espacial genérica, ver docstring do módulo, passo 4: o dado publicado de 1980 não distingue os 52 municípios de origem, então nenhum deles pode aparecer como pai único mesmo que a malha traga o polígono real dissolvido sob o mesmo código.)

## Cobertura de RGI/RGInt/RM por edição

### RGI

| Edição | Unidades de RGI de 2022 com >=1 município presente | Total de RGI com município em 2022 |
|---|---:|---:|
| 2010 | 510 | 510 |
| 2000 | 510 | 510 |
| 1991 | 510 | 510 |
| 1980 | 489 | 510 |

### RGINT

| Edição | Unidades de RGINT de 2022 com >=1 município presente | Total de RGINT com município em 2022 |
|---|---:|---:|
| 2010 | 133 | 133 |
| 2000 | 133 | 133 |
| 1991 | 133 | 133 |
| 1980 | 130 | 133 |

### RM

| Edição | Unidades de RM de 2022 com >=1 município presente | Total de RM com município em 2022 |
|---|---:|---:|
| 2010 | 81 | 81 |
| 2000 | 81 | 81 |
| 1991 | 81 | 81 |
| 1980 | 78 | 81 |

## Nenhum município de 2022 sem linha

0 municípios de 2022 com menos de 4 linhas na genealogia (uma por edição antiga) -- esperado 0.

