# Relatório de QA — F3 (Geografia)

Gerado em 2026-09-05. Dado geográfico público do IBGE (malha municipal 2022); sem microdados.

## Resultado

| Arquivo | Tamanho | Conteúdo |
|---|---:|---|
| `data/processed/geo/municipios.topojson` | 1,9 MB | 5.570 polígonos municipais, simplificados (1%, topologia preservada) |
| `data/processed/geo/uf.topojson` | 440 KB | 27 limites estaduais, dissolvidos a partir dos municípios |
| `data/processed/geo/centroides.parquet` | poucos KB | 1 ponto (centroide) por município |
| `data/processed/meta.json` | 4,1 KB | rótulos das categorias, cortes de renda/idade, limiares de revelação |

Critérios de aceite do plano: **todos atendidos**.
- 5.570 IDs do TopoJSON batem 1:1 com `municipios.parquet` (mesma fonte de referência territorial).
- Tamanho do TopoJSON de municípios: 1,9 MB, dentro do orçamento de 2 MB (0,6 MB comprimido para transferência).
- 27 UFs presentes no arquivo de limites estaduais.
- Centroides cobrem os 5.570 municípios e caem dentro da caixa geográfica do Brasil continental e insular (longitude −75° a −30°, latitude −35° a 6°).

## Problema encontrado: a malha do IBGE tem 5.572 feições, não 5.570

O shapefile `BR_Municipios_2022.shp` (geoftp do IBGE) contém 5.572 registros, dois a mais que os 5.570 municípios do Censo. Os dois excedentes são **corpos d'água sem população**, incluídos pelo IBGE por completude cartográfica:

| Código | Nome | UF | Área (km²) |
|---|---|---|---:|
| 4300001 | Lagoa Mirim | RS | 2.884,3 |
| 4300002 | Lagoa dos Patos | RS | 10.201,5 |

Foram excluídos explicitamente no `geo/build.sh` e no `pipeline/build_centroids.py`, junto com os códigos-placeholder `8888888`/`9999999` (que não são geográficos). Sem essa exclusão, o mapa teria duas feições sem nenhum dado correspondente em `municipios.parquet`, e os testes de correspondência 1:1 teriam falhado.

## Escolha do nível de simplificação

Testados vários níveis de simplificação (Visvalingam, `mapshaper -simplify`):

| Simplificação | Tamanho | Comprimido (gzip) |
|---:|---:|---:|
| 8% (valor inicial do plano) | 6,5 MB | — |
| 5% | 4,5 MB | — |
| 3% | 3,3 MB | — |
| 2% | 2,6 MB | — |
| 1,5% | 2,2 MB | 0,7 MB |
| 1,2% | 2,0 MB | 0,6 MB |
| **1% (escolhido)** | **1,9 MB** | **0,6 MB** |

O valor de 8% sugerido no plano foi insuficiente para o orçamento de 2 MB, dado o número de municípios e a complexidade da costa brasileira (Amazônia, Marajó, litoral do Rio Grande do Sul). Optou-se por 1%, com margem confortável abaixo do limite, mantendo a topologia entre municípios vizinhos (`keep-shapes`) para não perder polígonos de municípios muito pequenos.

`mapshaper` reporta algumas autointerseções residuais não reparáveis (19 no nível de 1%, sobre 5.570 polígonos) — resíduo comum em simplificação agressiva de malhas complexas; não impede o uso do arquivo em um mapa coroplético nem em `deck.gl`/MapLibre, mas fica registrado aqui para referência caso apareçam artefatos visuais na revisão de F4.

## Testes automatizados

`pytest`: **41 aprovados** (33 anteriores + 8 novos), cobrindo orçamento de tamanho, validade do JSON, correspondência 1:1 de IDs, ausência de corpos d'água/placeholders, 27 UFs, cobertura e plausibilidade geográfica dos centroides, e a validade do `meta.json`.
