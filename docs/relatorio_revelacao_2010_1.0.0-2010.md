# Relatório de controle de revelação

- Versão dos dados: **1.0.0-2010**
- Gerado em: 2026-09-14 15:24 (fuso local)
- Fonte: IBGE, Censo Demográfico 2010, microdados da amostra (acesso controlado).

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
- R1: 52,895 fluxos publicados, todos com n>=5 e domicílios>=3
- R1: 24 categorias de fluxo verificadas célula a célula, nenhuma abaixo do limiar
- R2: nenhum fluxo com menos de 20 observações publica detalhe
- R1: perfis municipais: nenhuma categoria nominal publicada com menos de 5 observações
- R1: pendular_trab: 23,255 fluxos publicados, todos acima do limiar
- R2: pendular_trab_dim: detalhe restrito a fluxos com n>=20
- R1: pendular_estudo: 17,932 fluxos publicados, todos acima do limiar
- R2: pendular_estudo_dim: detalhe restrito a fluxos com n>=20
- R1: rm_fluxos_intra.parquet: todas as linhas acima do limiar de 5 observações
- R1: rm_mig_estudo.parquet: todas as linhas acima do limiar de 5 observações
- R4: 15 colunas de estimativa verificadas, todas em múltiplos de 5
- R5: nenhuma contagem amostral exata publicada; apenas faixas

## Arquivos publicados

| Arquivo | Linhas | Tamanho | SHA-256 (12) |
|---|---:|---:|---|
| `fluxos.parquet` | 52,895 | 0.9 MB | `7cbbea4ed959` |
| `fluxos_rgi.parquet` | 21,337 | 0.2 MB | `ba11fe38876b` |
| `fluxos_rgint.parquet` | 8,189 | 0.1 MB | `7ae16ca72484` |
| `fluxos_uf.parquet` | 688 | 0.0 MB | `53e44cc0991a` |
| `municipios.parquet` | 5,565 | 0.5 MB | `2b0852c984a9` |
| `municipios_dim.parquet` | 331,985 | 1.7 MB | `9b54177538b6` |
| `municipios_pendular.parquet` | 5,565 | 0.2 MB | `9cd881390748` |
| `municipios_ref.parquet` | 5,565 | 0.2 MB | `60f7d8c6d64c` |
| `pendular_estudo.parquet` | 17,932 | 0.3 MB | `9847ab97cc35` |
| `pendular_estudo_dim.parquet` | 35,457 | 0.2 MB | `cd24a64ad755` |
| `pendular_trab.parquet` | 23,255 | 0.4 MB | `a7a360544265` |
| `pendular_trab_dim.parquet` | 181,001 | 1.1 MB | `e5accbb6a8a1` |
| `rm.parquet` | 1,384 | 0.0 MB | `fc9f48ad4e5f` |
| `rm_fluxos_intra.parquet` | 6,399 | 0.1 MB | `7528f38a5c26` |
| `rm_mig_estudo.parquet` | 3,003 | 0.0 MB | `7c46d7d8ee2e` |
| `rm_mig_pendular.parquet` | 5,286 | 0.1 MB | `fed172f19aa8` |
| `rm_mig_pendular_resumo.parquet` | 1,375 | 0.0 MB | `64b08aab7cf6` |
| `rm_resumo.parquet` | 81 | 0.0 MB | `3b70184805a1` |

## Supressão aplicada

- Pares origem→destino existentes na amostra: 298,493
- Pares publicados (após R1): 52,895 (17.7%), cobrindo 68.2% do volume migratório estimado
- Os 245,598 pares suprimidos permanecem contabilizados nos totais municipais de `municipios.parquet`, de modo que nenhum volume é perdido — apenas a identificação do par.
