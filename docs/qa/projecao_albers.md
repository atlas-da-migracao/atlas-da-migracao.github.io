# QA — projeção cartográfica do atlas: cônica equivalente de Albers (Fase 4 / F10)

Decisão metodológica e cartográfica (agente `metodologo`) sobre a substituição do Web Mercator
pela projeção de área equivalente na vista padrão do mapa. Só dado geográfico público
(`data/processed/**/geo`, malha do IBGE) — nenhum microdado envolvido, nenhuma regra de sigilo
acionada.

Texto público correspondente: `docs/METODOLOGIA.md`, seção **"Cartografia: projeção cônica
equivalente de Albers (F10)"** (entre "Níveis de agregação (F6)" e "Edição Censo 2010 e
comparabilidade com 2022"). Este documento é o registro da decisão e da verificação numérica;
a Metodologia é o texto para quem lê o site.

---

## 1. Decisão: parâmetros da projeção

**Cônica equivalente de Albers (`aea`)**, com paralelos padrão −2°/−22°, origem em −12°/−54°,
sobre o elipsoide GRS80 (o datum da malha do IBGE, SIRGAS 2000), em metros:

| Parâmetro | Valor | Papel |
| --- | --- | --- |
| Projeção | Albers Equal Area Conic (`+proj=aea`) | equivalência de área exata por construção |
| 1º paralelo padrão `lat_1` | **−2°** | paralelo sem distorção de forma (norte) |
| 2º paralelo padrão `lat_2` | **−22°** | paralelo sem distorção de forma (sul) |
| Latitude de origem `lat_0` | **−12°** | origem do eixo Y (y = 0 no centro do país) |
| Meridiano central `lon_0` | **−54°** | único meridiano vertical na tela; o mesmo da Policônica do IBGE |
| Falso leste/norte `x_0`/`y_0` | **0 / 0** | origem no centro do território — coordenadas simétricas, boas para `OrthographicView` |
| Elipsoide | **GRS80** (SIRGAS 2000) | mesmo elipsoide da malha de entrada; sem `+datum` porque não há mudança de datum |
| Unidade | **metro** | |

String proj4 canônica (a mesma nas 5 edições e nos 4 produtos):

```
+proj=aea +lat_1=-2 +lat_2=-22 +lat_0=-12 +lon_0=-54 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs
```

Equivalente em d3-geo, caso alguém precise reproduzir a projeção no navegador (aproximação
**esférica** — ver o alerta em §5):

```js
d3.geoConicEqualArea().parallels([-2, -22]).rotate([54, 0]).center([0, -12])
```

### Por que estes valores, e não outros

1. **Interoperabilidade acima de otimização.** −2°/−22°, origem −12°/−54° é o conjunto de
   parâmetros de fato padrão na cartografia temática brasileira de área equivalente (mapas
   temáticos do IBGE, MapBiomas, INPE/PRODES, Embrapa). Um leitor consegue sobrepor o mapa do
   atlas a um mapa de bioma ou de uso da terra sem reprojetar nada.
2. **A escolha dos paralelos não afeta a área.** Em Albers a equivalência é exata para
   *quaisquer* φ1/φ2; os paralelos só governam a distorção de **forma**. Portanto não há
   trade-off de exatidão a otimizar — só de aparência (medida em §2.3).
3. **EPSG:5880 (SIRGAS 2000 / Brazil Polyconic) foi descartado**: é a projeção "oficial" do mapa
   de referência do Brasil, mas é **policônica, não equivalente** — não resolve o problema que
   motivou a fase. Mantivemos dela apenas o meridiano central (−54°), o que preserva a orientação
   familiar do mapa do Brasil.
4. **Mollweide/sinusoidal/Eckert IV descartadas**: são equivalentes, mas pseudocilíndricas — feitas
   para o planisfério. Num recorte de latitudes médias/baixas e ~39° de amplitude latitudinal, a
   cônica dá forma sensivelmente melhor. `_GlobeView` descartado por curvar o território e
   inviabilizar a leitura comparativa do coroplético.
5. **A regra do um sexto de Snyder** (φ1/φ2 a um sexto da amplitude a partir de cada extremo)
   daria, para o Brasil (+5,27° a −33,75°), **−1,23°/−27,25°** — mede-se em §2.3 o que se ganharia:
   ~3 pontos percentuais de forma no extremo sul, e nada de área. Não compensa perder a
   interoperabilidade do item 1.

---

## 2. Verificação numérica

Feita sobre a malha publicada de UF da edição 2022 (`data/processed/geo/uf.topojson` e
`uf_albers.topojson`, decodificados com `geo/decode_topojson.mjs`), com DuckDB spatial:
área verdadeira = `ST_Area_Spheroid` sobre a geometria geográfica (atenção: essa função espera a
ordem *(lat, lon)* — é preciso `ST_FlipCoordinates` antes, senão os valores saem sem sentido);
área Albers = `ST_Area` planar sobre o arquivo em metros; área Mercator = `ST_Area` após
`ST_Transform` para EPSG:3857.

### 2.1 Albers preserva área (confirmado, não assumido)

| | valor |
| --- | --- |
| Área do território nas 27 UFs, elipsoidal (GRS80) | 8.497.263 km² |
| A mesma, medida no plano Albers publicado | 8.497.266 km² |
| Razão | **1,00000** |
| Razão área-Albers / área-real, por UF: mínimo / máximo | **0,99982 / 1,00003** |

O pior caso é o Distrito Federal (−0,018%), a menor unidade da malha — o resíduo é da quantização
do TopoJSON (grade de 1e5 sobre o bbox nacional, ~47 m), não da projeção. Todas as outras 26 UFs
batem em 1,0000 nas quatro casas. **Equal-area verificada empiricamente sobre a malha que o atlas
realmente publica**, e não só pela definição.

### 2.2 O que Mercator fazia (a distorção corrigida)

Área aparente por unidade de área real, normalizada pelo Amapá (UF mais próxima do Equador):

| UF | latitude do centroide | Mercator (AP = 1,000) | Albers (AP = 1,000) |
| --- | ---: | ---: | ---: |
| RR | +2,08° | 1,001 | 1,000 |
| AP | +1,45° | 1,000 | 1,000 |
| PA | −3,98° | 1,007 | 1,000 |
| BA | −12,48° | 1,049 | 1,000 |
| MG | −18,46° | 1,110 | 1,000 |
| SP | −22,27° | **1,165** | 1,000 |
| PR | −24,64° | 1,207 | 1,000 |
| SC | −27,25° | 1,261 | 1,000 |
| RS | −29,70° | **1,321** | 1,000 |

Ou seja: no mapa que o atlas publicava até aqui, **o Rio Grande do Sul ocupava 32% mais tela** e
**São Paulo 16,5% mais tela** do que a mesma quantidade de território no extremo norte — dentro do
mesmo mapa, na mesma classe de cor. Em pontos extremos do território a conta fecha ainda mais alto
(fator de área = sec²φ): +0,8% no Monte Caburaí (+5,27°) contra **+44,6%** no Chuí (−33,75°), uma
diferença de **43%** entre as duas pontas do país. Na projeção adotada, esses 32%/16,5%/43% caem
todos a **0,00%** (±0,02% de quantização).

Convém registrar, porque é contraintuitivo e já rendeu confusão: o Mercator **não** "infla a
Amazônia" no mapa do Brasil. A ampliação é para longe do Equador, e no Brasil isso significa o
**Sul**. A correção vai encolher o Sul e aumentar o peso relativo do Norte na tela.

### 2.3 Distorção de forma (o preço da equivalência)

Escala ao longo do paralelo, `k = nρ/cos φ` (a escala ao longo do meridiano é `1/k`, que é
exatamente o que mantém o produto — a área — igual a 1):

| latitude | k com −2°/−22° (adotado) | k com −1,23°/−27,25° (Snyder 1/6) | Mercator (área) |
| ---: | ---: | ---: | ---: |
| +5,27° (Monte Caburaí) | 1,029 | 1,031 | 1,009 |
| 0° | 1,007 | 1,005 | 1,000 |
| −10° | 0,986 | 0,978 | 1,031 |
| −20° | 0,994 | 0,979 | 1,133 |
| −30° | 1,038 | 1,013 | 1,333 |
| −33,75° (Chuí) | **1,066** | 1,037 | 1,447 |

Desvio máximo de forma no território: **+6,6%** (Chuí) e **+2,9%** (Caburaí) com os parâmetros
adotados, contra 3,7% se seguíssemos Snyder. Menos de 3 pontos percentuais de diferença, no ponto
mais extremo do país, contra a perda de comparabilidade com todo o acervo temático brasileiro:
mantém-se −2°/−22°. Para referência, os 6,6% de forma que aceitamos são um quinto dos 44% de área
que estamos eliminando.

---

## 3. Texto para `docs/METODOLOGIA.md`

**Já incorporado** — seção "Cartografia: projeção cônica equivalente de Albers (F10)", logo depois
de "Níveis de agregação (F6)" (que é onde a malha e os centroides já eram descritos) e antes das
seções por edição, porque a decisão vale para as cinco edições ao mesmo tempo. A seção tem quatro
partes: o problema (Mercator e o coroplético), os parâmetros adotados, como a projeção entra no
pipeline, e o que Albers não resolve. Todos os números citados lá foram reconferidos nesta
verificação e batem: +0,8% de área no extremo norte, +44% no extremo sul, ~43% de diferença entre
as pontas, +6,6%/+3,0% de forma com os paralelos adotados, 3,7% com os de Snyder.

Um ponto de conteúdo a manter em qualquer reescrita futura: a seção afirma explicitamente que
**a vista geográfica (Mercator) continua publicada e não é legado** — é o que sustenta a camada de
satélite e o zoom intramunicipal do módulo metropolitano. Isso não é um detalhe de implementação;
é a declaração pública de que o atlas usa duas projeções para dois usos diferentes de mapa, e
o leitor precisa saber qual está vendo.

---

## 4. Interação com a camada de satélite (Fase 6) — sem impedimento

Confirmado: os parâmetros escolhidos **não** inviabilizam o plano da Fase 6.

- Albers é invertível em forma fechada, então o `TileLayer` continua podendo descobrir quais
  tiles XYZ pedir: inverter os quatro cantos do viewport (metros → lon/lat), tomar o bbox
  geográfico e derivar z/x/y como de costume. Nenhum parâmetro adotado introduz singularidade
  dentro do território — o polo da projeção (onde ρ degenera) fica muito além do bbox do Brasil,
  e `n = (sin φ1 + sin φ2)/2 ≈ −0,2047` está longe de zero (cônica bem-condicionada; nada da
  degeneração que apareceria com φ1 ≈ −φ2).
- O warp por tile é linear e continua válido: em z ≥ 6, um tile cobre no máximo ~5° de longitude,
  e a diferença entre o quadrilátero Albers exato e o quadrilátero interpolado a partir dos quatro
  cantos fica abaixo de um pixel. Se aparecer emenda visível na vista nacional, a saída é
  subdividir o tile em 2×2 quads, como o plano já prevê — nada disso depende dos paralelos.
- Recomendação para a Fase 6, decorrente de §2.3: **não desligar a projeção Albers ao ligar o
  satélite**. Trocar de projeção junto com a camada faria a malha "respirar" (Sul encolhendo e
  crescendo 30%) a cada clique no botão, e o leitor leria isso como um bug. A camada de imagem é
  uma camada, não um modo — como o plano já decidiu.
- A malha em graus (`*.topojson`, `lon`/`lat`) segue publicada exatamente para o caso em que a
  Fase 6 (ou o módulo RM) precise de uma vista Mercator de verdade; o custo é ~2 MB por edição já
  contabilizado no orçamento.

---

## 5. Especificação de implementação (para o `implementador`)

> **Estado em 2026-09-16**: esta especificação **já está implementada** na árvore de trabalho do
> branch `mapa-representacao` (não commitada). O que segue é a especificação normativa — serve
> como critério de revisão do que existe e como referência para quem mexer nisso depois.
> Verificado nesta sessão: `geo/build.sh` gera os `*_albers.topojson` com a string proj4 acima;
> `centroides*.parquet` têm `x_albers`/`y_albers`; `meta.json` tem `bounds_albers`;
> `MapaAtlas.tsx` usa `OrthographicView` + `COORDINATE_SYSTEM.CARTESIAN`; `rm.ts` tem
> `fitBoundsCartesiano`.

### 5.1 Onde a pré-projeção roda: **no pipeline**, não no front-end

Decisão: **`geo/build.sh`, via `mapshaper -proj` com a string proj4 da §1**. Razões, em ordem:

1. **Uma fonte de verdade.** `d3-geo` no navegador trabalha sobre um modelo **esférico**; o
   pipeline (PROJ/GEOS, `+ellps=GRS80`) sobre o elipsoide. Projetar dos dois lados produziria duas
   malhas ligeiramente diferentes para o mesmo território, e a verificação de §2.1 deixaria de
   valer para o que está na tela. A equivalência de área verificada é a do arquivo publicado.
2. **Custo zero em runtime.** Reprojetar 5.570 polígonos no carregamento é trabalho de CPU no
   dispositivo do leitor, a cada visita, para produzir sempre o mesmo resultado.
3. **`d3-geo` não é dependência direta do `web/`** (está em `node_modules` só como transitiva,
   3.1.1) — usá-la exigiria promovê-la a dependência direta para nada.

Regras de construção (todas já refletidas em `geo/build.sh`):

- **`-proj` antes de `-simplify`**, nunca depois. Simplificar em graus pondera implicitamente a
  tolerância pela latitude (um centésimo de grau vale menos metros no Sul); simplificar em metros
  aplica a mesma tolerância métrica ao país inteiro. Os percentuais de simplificação por produto
  (1% municípios, 1,5% RGI/RGInt, 5% UF) e `keep-shapes` ficam iguais.
- **Arquivos paralelos, não substitutos**: `municipios.topojson` **e** `municipios_albers.topojson`,
  e idem para `uf`, `rgi`, `rgint`, em cada uma das 5 edições. Nunca sobrescrever o arquivo em graus.
- **Mesma quantização (1e5)** nos dois. Medido: em metros, 1e5 dá arquivo do mesmo tamanho
  (1,97 MB para municípios 2022, dentro do orçamento de 2 MB de `pipeline/tests/test_f3_geo.py`)
  e resolução da mesma ordem (~47 m).
- **Mesma cadeia de validação** (`-clean` → quantização → `-clean` sobre o GeoJSON decodificado →
  reparo dirigido → `pipeline/validate_geo.py`) para os dois arquivos, com o mesmo critério de
  aprovação: 0 inválidos OGC, 0 falhas de earcut. Armadilha registrada: rodar `-clean` direto sobre
  o `.topojson` quantizado **em metros** derruba o mapshaper ("Invalid node geometry"); é preciso
  decodificar para GeoJSON antes.
- **Centroides: um arquivo só, quatro colunas.** `centroides*.parquet` = `lon`, `lat`,
  `x_albers`, `y_albers` na mesma linha da mesma unidade. No nível município, `x_albers`/`y_albers`
  são a **projeção do mesmo ponto** já publicado (`ST_PointOnSurface` da geometria geográfica) —
  assim a âncora do arco/espiga/dica é literalmente o mesmo ponto do território nas duas vistas.
  Nos níveis agregados (RGI/RGInt/UF), a média ponderada por `pop5` é calculada **duas vezes**, em
  graus e em metros: média ponderada não comuta com projeção, e projetar a média em graus
  deslocaria a âncora em relação à malha desenhada.
- **`meta.json` publica `bounds_albers`** (`x_min`, `x_max`, `y_min`, `y_max` em metros) por edição
  — é o bbox nacional que o front usa para o enquadramento inicial sem precisar varrer a malha.

### 5.2 Front-end: de `MapView` para `OrthographicView` + CARTESIAN

- `const VIEW = new OrthographicView({ id: "mapa", flipY: false })`. **`flipY: false` é
  obrigatório**: as coordenadas são cartográficas (Y cresce para o norte), não de tela (Y para
  baixo, que é o default do `OrthographicView`). Com o default, o mapa sai de cabeça para baixo.
- `coordinateSystem: COORDINATE_SYSTEM.CARTESIAN` em **todas** as camadas (`GeoJsonLayer`,
  `ArcLayer`, camadas de símbolo, `PathLayer` do contorno por malha). Sem isso, o deck.gl trata os
  metros como graus e reprojeta o que já está projetado.
- **`GeoJsonLayer`, nunca `PolygonLayer`**, em CARTESIAN: `PolygonLayer` com coordenadas
  cartesianas quebra MultiPolygon (armadilha conhecida do deck.gl; vale para todos os estados
  costeiros e ilhas).
- O `viewState` deixa de ser `{longitude, latitude, zoom}` e passa a ser
  `{target: [x, y, 0], zoom}`, onde `zoom = log2(px por metro)` — `zoom: 0` no `OrthographicView`
  mapeia 1 unidade de mundo (aqui, 1 metro) a 1 px.
- **`fitBounds` cartesiano**: `WebMercatorViewport.fitBounds` não existe em modo ortográfico.
  Substituir por uma função pura (`fitBoundsCartesiano` em `web/src/lib/rm.ts`), sem `window`/DOM,
  testável isolada:

  ```
  escala = min((largura - 2·padding) / Δx, (altura - 2·padding) / Δy)
  target = [(minX+maxX)/2, (minY+maxY)/2, 0]
  zoom   = log2(escala)
  ```

  A guarda contra bbox degenerado (`validarEExpandirBbox`) continua necessária — bbox de área zero
  daria `zoom` infinito —, mas a margem mínima passa a ser expressa em **metros** (2.200 m, o
  equivalente dos antigos 0,02°), não em graus.
- **Limites de zoom explícitos.** O `OrthographicView` não herda a faixa 0–20 do `MapView`; sem
  `minZoom`/`maxZoom` no controlador, a roda do mouse leva o mapa a escalas absurdas.
- **Bboxes que alimentam o fit passam a ser em metros** (`bboxDeCentroides`, `bboxDeGeometria`,
  `uniaoDeBboxes`): trocar a fonte de `lon`/`lat` para `x_albers`/`y_albers`. Os nomes de variável
  que dizem "lon/lat" nessas funções ficam como legado — vale um comentário, não vale a
  renomeação em cascata.
- **Arcos**: o `ArcLayer` funciona em CARTESIAN, mas o `getHeight`/deslocamento em **Z** deixa de
  ter efeito visível — sob projeção paralela com câmera na vertical, um deslocamento em Z não tem
  projeção em tela e o arco colapsa na corda reta origem→destino. A curvatura precisa ser produzida
  **no plano XY** (`getTilt`, ou `PathLayer` com curva quadrática), não pela altura.
- **URL/estado**: se um dia houver alternância entre as duas vistas, o parâmetro é `proj=` no
  `store.ts`, com Albers como default (e o valor ausente significando Albers, para não invalidar
  links antigos). Hoje a vista Albers é a única do mapa nacional.
- Depois de regenerar geo: `build_centroids.py` → `build_meta.py` → `disclosure_check.py --versao`
  (patch de geo) por edição → `verify_gate.py` → `npm run sync-data`. Só `geo/`, `meta.json` e
  `.gate_ok` devem mudar; se `disclosure_check` acusar mudança em tabela de dado, algo saiu do
  escopo desta fase.

### 5.3 Critérios de aceite

1. `pipeline/validate_geo.py` aprova os **40** arquivos (4 produtos × 5 edições × {graus, Albers}):
   0 inválidos OGC, 0 falhas de earcut.
2. Área de cada UF no arquivo Albers bate com `ST_Area_Spheroid` (flipado) da mesma UF no arquivo
   em graus dentro de **±0,05%** — vale a pena virar teste em `pipeline/tests/test_f3_geo.py`,
   porque é o único teste que falha se alguém trocar a projeção por uma não equivalente.
3. `municipios_albers.topojson` ≤ 2 MB por edição; 1:1 com `municipios_ref.parquet`.
4. `fitBoundsCartesiano` com teste unitário (bbox quadrado, bbox degenerado, padding maior que o
   viewport).
5. Visual: o Brasil não sai de cabeça para baixo (`flipY`), os arcos curvam, e a seleção de um
   município enquadra o polígono — nas 5 edições, incluindo o `NORTEGO` de 1980.

---

## 6. Dependências de outras fases

- **Fase 6 (satélite)**: sem impedimento (§4); recomendação registrada de não trocar de projeção
  ao ligar a camada.
- **Fase 7 (refinamento)**: a regra 8 do plano ("sem ornamento") ganha um motivo a mais —
  **Albers não tem escala uniforme**, então não existe barra de escala válida para o mapa
  nacional. Só faz sentido mostrar barra de escala no zoom de RM, e ainda assim como escala local.
  A legenda/rodapé deve declarar a projeção, como o plano já previa.
- **Fase 5 (espigas/símbolos)**: as espigas passam a ser desenhadas em coordenadas cartesianas em
  metros; a conversão px↔metro deixa de precisar de `viewport.getDistanceScales()` por latitude —
  em CARTESIAN é um fator único, `2^zoom` px por metro, igual em todo o mapa. Simplifica.
