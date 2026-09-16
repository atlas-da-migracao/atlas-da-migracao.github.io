# Relatório de controle de revelação

- Versão dos dados: **2026-09-16b**
- Gerado em: 2026-09-16 16:44 (fuso local)
- Fonte: IBGE, Censo Demográfico 2022, microdados da amostra (acesso controlado).

## Regras aplicadas

| Regra | Parâmetro |
|---|---|
| R1 limiar por célula | ≥ 5 pessoas e ≥ 3 domicílios |
| R2 detalhe por características | só em fluxos com ≥ 20 observações |
| R3 supressão complementar | categorias suprimidas somadas em `outros` da mesma dimensão |
| R4 arredondamento | múltiplos de 5 |
| R5 contagem amostral | publicada apenas em faixas |
| R6 geografia e cruzamentos | município é a menor unidade; sem área de ponderação nem identificador de domicílio |

## Verificações independentes

- R6: 18 arquivos sem colunas de domicílio ou área de ponderação
- R1: 53,097 fluxos publicados, todos com ≥ 5 pessoas e ≥ 3 domicílios
- R1: 25 categorias de fluxo verificadas célula a célula, nenhuma abaixo do limiar
- R2: nenhum fluxo com menos de 20 observações publica detalhe
- R1: perfis municipais: nenhuma categoria nominal publicada com menos de 5 observações
- R1: pendular_trab: 21,327 fluxos publicados, todos acima do limiar
- R2: pendular_trab_dim: detalhe restrito a fluxos com n>=20
- R1: pendular_estudo: 16,429 fluxos publicados, todos acima do limiar
- R2: pendular_estudo_dim: detalhe restrito a fluxos com n>=20
- R1: rm_fluxos_intra.parquet: todas as linhas acima do limiar de 5 observações
- R1: rm_mig_estudo.parquet: todas as linhas acima do limiar de 5 observações
- R4: 15 colunas de estimativa verificadas, todas em múltiplos de 5
- R5: nenhuma contagem amostral exata publicada; apenas faixas

## Arquivos publicados

| Arquivo | Linhas | Tamanho | SHA-256 (12) |
|---|---:|---:|---|
| `fluxos.parquet` | 53,097 | 0.9 MB | `62803324eeea` |
| `fluxos_rgi.parquet` | 23,083 | 0.3 MB | `07e0d91abc12` |
| `fluxos_rgint.parquet` | 9,155 | 0.1 MB | `cff1994e80f6` |
| `fluxos_uf.parquet` | 689 | 0.0 MB | `a0d0df846b8c` |
| `municipios.parquet` | 5,570 | 0.5 MB | `87303103cc5e` |
| `municipios_dim.parquet` | 342,005 | 1.7 MB | `2808d9c810ec` |
| `municipios_pendular.parquet` | 5,570 | 0.2 MB | `b0aac3d9de2d` |
| `municipios_ref.parquet` | 5,570 | 0.2 MB | `e497fe05679f` |
| `pendular_estudo.parquet` | 16,429 | 0.3 MB | `9bde67bfe9e8` |
| `pendular_estudo_dim.parquet` | 31,748 | 0.2 MB | `332cce38adfb` |
| `pendular_trab.parquet` | 21,327 | 0.5 MB | `b364c0886d93` |
| `pendular_trab_dim.parquet` | 209,743 | 1.3 MB | `6ca5ca87e485` |
| `rm.parquet` | 1,388 | 0.0 MB | `632be34d4c56` |
| `rm_fluxos_intra.parquet` | 6,490 | 0.1 MB | `6783e332892a` |
| `rm_mig_estudo.parquet` | 2,851 | 0.0 MB | `937577efa031` |
| `rm_mig_pendular.parquet` | 5,350 | 0.1 MB | `462fbb26a151` |
| `rm_mig_pendular_resumo.parquet` | 1,375 | 0.0 MB | `382c79e4a4b3` |
| `rm_resumo.parquet` | 81 | 0.0 MB | `6fe6f87faf40` |

## Supressão aplicada

- Pares origem→destino existentes na amostra: 326,973
- Pares publicados (após R1): 53,097 (16.2%), cobrindo 67.6% do volume migratório estimado
- Os 273,876 pares suprimidos permanecem contabilizados nos totais municipais de `municipios.parquet`, de modo que nenhum volume é perdido — apenas a identificação do par.
