# Relatório de controle de revelação

- Versão dos dados: **1.0.3-2000**
- Gerado em: 2026-09-17 16:24 (fuso local)
- Fonte: IBGE, Censo Demográfico 2000, microdados da amostra (dados públicos).

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
- R1: 52,655 fluxos publicados, todos com ≥ 5 pessoas e ≥ 3 domicílios
- R1: 24 categorias de fluxo verificadas célula a célula, nenhuma abaixo do limiar
- R2: nenhum fluxo com menos de 20 observações publica detalhe
- R1: perfis municipais: nenhuma categoria nominal publicada com menos de 5 observações
- R1: pendular_trab: 12,651 fluxos publicados, todos acima do limiar
- R2: pendular_trab_dim: detalhe restrito a fluxos com n>=20
- R1: pendular_estudo: 5,640 fluxos publicados, todos acima do limiar
- R2: pendular_estudo_dim: detalhe restrito a fluxos com n>=20
- R1: rm_fluxos_intra.parquet: todas as linhas acima do limiar de 5 observações
- R1: rm_mig_estudo.parquet: todas as linhas acima do limiar de 5 observações
- R4: 15 colunas de estimativa verificadas, todas em múltiplos de 5
- R5: nenhuma contagem amostral exata publicada; apenas faixas

## Arquivos publicados

| Arquivo | Linhas | Tamanho | SHA-256 (12) |
|---|---:|---:|---|
| `fluxos.parquet` | 52,655 | 1.0 MB | `2d9a6e42ad13` |
| `fluxos_rgi.parquet` | 20,100 | 0.2 MB | `a3deddcfd0ab` |
| `fluxos_rgint.parquet` | 7,966 | 0.1 MB | `85f3c27a45f6` |
| `fluxos_uf.parquet` | 685 | 0.0 MB | `8438d1c9c8cb` |
| `municipios.parquet` | 5,507 | 0.5 MB | `f96e2282c35c` |
| `municipios_dim.parquet` | 320,278 | 1.6 MB | `35f9ac4d5ce4` |
| `municipios_pendular.parquet` | 5,507 | 0.2 MB | `6e354d6ac459` |
| `municipios_ref.parquet` | 5,507 | 0.2 MB | `71c0493d9b9f` |
| `pendular_estudo.parquet` | 5,640 | 0.1 MB | `c4933cc24b34` |
| `pendular_estudo_dim.parquet` | 6,300 | 0.0 MB | `841e17c37d5d` |
| `pendular_trab.parquet` | 12,651 | 0.2 MB | `a4ae698d85f7` |
| `pendular_trab_dim.parquet` | 75,134 | 0.4 MB | `284eb79adb78` |
| `rm.parquet` | 1,382 | 0.0 MB | `d21ae2add829` |
| `rm_fluxos_intra.parquet` | 5,997 | 0.1 MB | `fb0db5dcad41` |
| `rm_mig_estudo.parquet` | 3,187 | 0.0 MB | `500e22756994` |
| `rm_mig_pendular.parquet` | 4,784 | 0.1 MB | `7a2225ec30ef` |
| `rm_mig_pendular_resumo.parquet` | 1,368 | 0.0 MB | `e17dc423d69e` |
| `rm_resumo.parquet` | 81 | 0.0 MB | `78482dead937` |

## Supressão aplicada

- Pares origem→destino existentes na amostra: 274,764
- Pares publicados (após R1): 52,655 (19.2%), cobrindo 71.4% do volume migratório estimado
- Os 222,109 pares suprimidos permanecem contabilizados nos totais municipais de `municipios.parquet`, de modo que nenhum volume é perdido — apenas a identificação do par.
