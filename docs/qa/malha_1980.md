# QA — malha municipal 1980 (F9.4)

Gerado por `geo/fetch_1980.sh`. Fonte: `05_malha_municipal_1980.zip` (IBGE geoftp, arquivo
nacional único, dado público). Saída: `data/geo/raw/1980/BR_Municipios_1980.shp` (gitignored,
dado geográfico — não é microdado controlado, mas segue o padrão de não versionar `data/geo/raw`).

## Campos e CRS encontrados

- Shapefile bruto: campos `codigo` (numérico, 7 dígitos) e `nome` (string). Sem `SIGLA_UF`.
- CRS original: `World_Polyconic` (datum SIRGAS 2000 / GRS80, meridiano central -54, unidade
  metro) — igual ao padrão já visto em `fetch_1991.sh`, diferente do SIRGAS 2000 geográfico
  (graus) de 2022/2010/2000.

## Decisões

- **Sem `-dissolve`**: diferente de 1991 (27 municípios partidos em registros repetidos) e de
  2000/2010 (fusão de 27 shapefiles por UF), aqui os 3.991 registros já têm 3.991 códigos
  `codigo` distintos (confirmado via CSV exportado do `.dbf`) — nenhuma duplicidade de código.
- **Sem filtro de sentinela**: não há códigos `"0"`, `"9999910"/"9999920"` (como em 1991) nem
  nomes vazios/fora do padrão de 7 dígitos. O único código fora do padrão de UF atual é
  `2000107`/Fernando de Noronha (prefixo `20`, território federal até 1988, incorporado a PE
  depois) — é um município legítimo do Censo 1980, mantido sem filtro. **Como tratar
  2000107 no cruzamento com `labels_1980`/pipeline é decisão do agente `metodologo`**, não
  desta etapa de geo.
- **Sem `-snap -clean`**: testado isoladamente — ao contrário de 1991 (0 mudança), o `-clean`
  padrão do mapshaper removeu 2.490 slivers e reduziu 3.991 para 3.985 feições (6 municípios
  desaparecem). Descartado para preservar fidelidade à fonte; malha final mantém as 3.991
  feições originais.
- **Reprojetado para EPSG:4674** (SIRGAS 2000 geográfico), mesmo datum de origem, sem
  transformação de datum — necessário para que centroides/bounding box fiquem em graus.
- Campos renomeados/derivados: `CD_MUN` (de `codigo`, como string), `NM_MUN` (de `nome`),
  `SIGLA_UF` (derivado do prefixo de 2 dígitos de `CD_MUN` via tabela de UF).

## Contagem final

- **3.991 feições**, **3.991 códigos `CD_MUN` distintos** (7 dígitos, sem duplicidade).
- Referências para cruzamento (não decididas aqui): BD (censo) tem 3.938 `id_municipio`
  distintos; cópias DBF citadas no enunciado têm 3.990 `UF‖MUNIC`. A diferença entre 3.991
  (malha) e 3.938 (BD) é esperada — municípios extintos/fundidos até o Censo de 1980 que não
  geram registro de população na base, e possivelmente Fernando de Noronha (território sem
  Censo demográfico municipal próprio em 1980). **A decisão de como reconciliar essas
  contagens é do agente `metodologo`.**
- Lista completa dos 3.991 códigos (`CD_MUN,NM_MUN,SIGLA_UF`) exportada em
  `docs/qa/malha_1980_codigos.csv` (não versionado — bloqueado por `.gitignore`/pre-commit
  como qualquer `*.csv`; arquivo de trabalho local para o cruzamento com `labels_1980.py`).

## Validação de posição (centroide vs. malha 2022)

Centroides calculados via `ST_Centroid` (extensão spatial do DuckDB) em ambas as malhas,
cruzados por `CD_MUN` (código de 7 dígitos):

- Códigos em comum entre 1980 e 2022: **3.938** (bate exatamente com a contagem de
  `id_municipio` distintos citada na BD — indício de que o corte de comparabilidade retroativa
  já usado no pipeline é consistente com a malha).
- Distância > 100 km entre os centroides: **17 casos**, todos amazônicos/Centro-Oeste, exceto
  um caso litorâneo explicado por ilhas oceânicas — padrão esperado de F7.4 (municípios de 1980
  muito maiores, depois desmembrados, mantendo o código na sede que ficou menor/deslocada):

  | CD_MUN  | Município (1980) / UF        | Distância (km) |
  |---------|-------------------------------|-----------------|
  | 1507201 | São Domingos do Capim/PA      | 201,7 |
  | 2102903 | Carutapera/MA                 | 192,2 |
  | 1302009 | Itapiranga/AM                 | 169,4 |
  | 5107305 | São José do Rio Claro/MT      | 144,0 |
  | 5105507 | Vila Bela da Santíssima Trindade/MT | 141,6 |
  | 5103502 | Diamantino/MT                 | 129,5 |
  | 1600402 | Mazagão/AP                    | 128,7 |
  | 5105309 | Luciára/MT                    | 127,9 |
  | 3205309 | Vitória/ES                    | 125,7 |
  | 1600303 | Macapá/AP                     | 125,0 |
  | 5105903 | Nobres/MT                     | 119,3 |
  | 1400100 | Boa Vista/RR                  | 113,3 |
  | 5101803 | Barra do Garças/MT            | 111,9 |
  | 5100250 | Alta Floresta/MT              | 108,1 |
  | 1503606 | Itaituba/PA                   | 106,6 |
  | 5107909 | Sinop/MT                      | 106,1 |
  | 1300805 | Borba/AM                      | 100,6 |

  O caso de Vitória/ES não é um erro: a envoltória do polígono de 2022 (`CD_MUN=3205309`)
  se estende até `lon ≈ -28,8`, incluindo o Arquipélago de Trindade e Martim Vaz (parte do
  município), o que desloca o centroide para leste; a malha de 1980 não carrega esse
  deslocamento do mesmo jeito. Os demais 16 casos são todos de municípios amazônicos/MT que
  passaram por desmembramentos entre 1980 e 2022, consistente com o esperado pelo enunciado.

## Não executado (fora do escopo desta etapa)

- `geo/build.sh 1980` e `pipeline/build_centroids.py` — dependem de `municipios_ref` de 1980
  (fase posterior).
- Nenhum arquivo em `pipeline/` ou `scripts/` foi tocado.

---

## Adendo F9.9 — as 52 feições do norte de Goiás passaram de removidas a dissolvidas

Quando este QA foi escrito, `geo/fetch_1980.sh` **removia** (`-filter`) as 52 feições do norte de
Goiás, porque a edição não publicava o território: a saída tinha 3.939 feições e o Tocantins era um
buraco. Desde a versão `1.0.2-1980` dos dados o território é publicado como **uma unidade agregada**
(`'NORTEGO'`, ver `pipeline/unidades_agregadas_1980.py`), e as 52 feições são **dissolvidas numa
só** em vez de removidas. Saída atual: **3.940 feições**.

O dissolve é aplicado **só a essas 52**, numa camada própria (`-filter ... + name=nortego`,
`-dissolve`, `-merge-layers`). As outras 3.939 não passam por nenhuma operação de geometria — o que
importa justamente por causa do achado registrado acima, de que nesta malha as operações de limpeza
são destrutivas (`-clean` removeu 2.490 slivers e comeu 6 municípios). O risco topológico fica
confinado ao subconjunto, e a fronteira com Goiás, Pará, Maranhão, Bahia e Mato Grosso é
bit-a-bit a mesma de antes.

Conferido depois do dissolve:

| verificação | resultado |
|---|---|
| feições na saída | 3.940 (3.939 + a unidade) |
| geometrias inválidas (`ST_IsValid`) | **0** |
| forma da unidade | polígono único, sem partes soltas nem buracos, 2.442 vértices |
| área do polígono dissolvido × união exata das 52 feições brutas | 22,886914 × 22,886915 grau² (centroide igual até a 8ª casa decimal) — o dissolve **não move a fronteira externa** |
| soma das áreas das 52 brutas × área da união delas | 278.641.666.704 m² nos dois casos — **sem sobreposição nem vão interno** entre as 52, o que torna o dissolve topologicamente trivial |
| área resultante × Tocantins de hoje | 278.642 km² × 277.720 km² (−0,33%, diferença da cartografia de 1980 e de ajustes posteriores de limite) |
| centroide da unidade | (−48,3318; −10,1476), no centro do Tocantins |

Custo no TopoJSON: `municipios.topojson` foi de 914 KB para 1,18 MB (orçamento do
`test_f3_geo.py`: 2 MB). A feição retém 1.613 dos seus 2.442 vértices depois do `-simplify 1%`
porque a fronteira é longa e fica repartida em 790 arcos, e o mínimo de dois vértices por arco
domina — é precisão retida, não desperdício.

Também mudou em `geo/build.sh`: um `-filter "cd_rgi != null"` (e o equivalente em RGInt) antes do
`-dissolve` dos recortes. A unidade agregada cobre 11 RGIs e 3 RGInts de 2022 e não é de nenhuma
(`cd_rgi`/`cd_rgint` NULL em `municipios_ref`); sem o filtro, o dissolve criaria uma 490ª "RGI" sem
código com a forma do território. O mesmo filtro existe do lado do dado, em
`web/src/db/queries.ts`.
