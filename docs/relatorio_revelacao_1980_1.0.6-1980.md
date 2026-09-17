# Relatório de controle de revelação

- Versão dos dados: **1.0.6-1980**
- Gerado em: 2026-09-17 17:28 (fuso local)
- Fonte: IBGE, Censo Demográfico 1980, microdados da amostra (dados públicos).

## Regras aplicadas

| Regra | Parâmetro |
|---|---|
| R1 limiar por célula | ≥ 20 pessoas (edição sem chave de domicílio: o piso de domicílios é substituído pelo piso elevado de pessoas) |
| R2 detalhe por características | só em fluxos com ≥ 50 observações (elevado por ausência de chave de domicílio) |
| R3 supressão complementar | categorias suprimidas somadas em `outros` da mesma dimensão |
| R4 arredondamento | múltiplos de 5 |
| R5 contagem amostral | publicada apenas em faixas |
| R6 geografia e cruzamentos | município é a menor unidade; sem área de ponderação nem identificador de domicílio |

## Verificações independentes

- R6: 18 arquivos sem colunas de domicílio ou área de ponderação
- R1: edição sem chave de domicílio confirmada (`controle` nulo em 100% dos registros): R1 = ≥ 20 pessoas (edição sem chave de domicílio: o piso de domicílios é substituído pelo piso elevado de pessoas); R2 = só em fluxos com ≥ 50 observações (elevado por ausência de chave de domicílio)
- R1: 29,647 fluxos publicados, todos com ≥ 20 pessoas (edição sem chave de domicílio: o piso de domicílios é substituído pelo piso elevado de pessoas)
- R1: 24 categorias de fluxo verificadas célula a célula, nenhuma abaixo do limiar
- R2: nenhum fluxo com menos de 50 observações publica detalhe
- R6: unidade agregada NORTEGO (52 municípios de 1980): publicada como uma unidade, sem autoloop e sem componente solto
- R1: perfis municipais: nenhuma categoria nominal publicada com menos de 20 observações
- R1: pendular_trab: 2,599 fluxos publicados, todos acima do limiar
- R2: pendular_trab_dim: detalhe restrito a fluxos com n>=50
- R1: pendular_estudo: 764 fluxos publicados, todos acima do limiar
- R2: pendular_estudo_dim: detalhe restrito a fluxos com n>=50
- R1: rm_fluxos_intra.parquet: todas as linhas acima do limiar de 20 observações
- R1: rm_mig_estudo.parquet: todas as linhas acima do limiar de 20 observações
- R4: 15 colunas de estimativa verificadas, todas em múltiplos de 5
- R5: nenhuma contagem amostral exata publicada; apenas faixas

## Arquivos publicados

| Arquivo | Linhas | Tamanho | SHA-256 (12) |
|---|---:|---:|---|
| `fluxos.parquet` | 29,647 | 0.5 MB | `84dfc071a201` |
| `fluxos_rgi.parquet` | 11,928 | 0.1 MB | `31667b4ab9ca` |
| `fluxos_rgint.parquet` | 4,492 | 0.0 MB | `a64e074b774f` |
| `fluxos_uf.parquet` | 587 | 0.0 MB | `60c97ba02ca6` |
| `municipios.parquet` | 3,940 | 0.3 MB | `cda3caee6f8f` |
| `municipios_dim.parquet` | 150,892 | 0.8 MB | `c3705606be15` |
| `municipios_pendular.parquet` | 3,940 | 0.1 MB | `3a2899b3262b` |
| `municipios_ref.parquet` | 3,940 | 0.1 MB | `7b7de3de9d5f` |
| `pendular_estudo.parquet` | 764 | 0.0 MB | `f325d225c494` |
| `pendular_estudo_dim.parquet` | 1,235 | 0.0 MB | `4aab9bb9de25` |
| `pendular_trab.parquet` | 2,599 | 0.0 MB | `49aa2a47c75c` |
| `pendular_trab_dim.parquet` | 14,924 | 0.1 MB | `4ad5024346a3` |
| `rm.parquet` | 1,019 | 0.0 MB | `789fa5e645ef` |
| `rm_fluxos_intra.parquet` | 3,477 | 0.0 MB | `c773a1efc8eb` |
| `rm_mig_estudo.parquet` | 1,112 | 0.0 MB | `5518990d9b72` |
| `rm_mig_pendular.parquet` | 2,148 | 0.0 MB | `ca7e1b4018e0` |
| `rm_mig_pendular_resumo.parquet` | 953 | 0.0 MB | `cff916b0655f` |
| `rm_resumo.parquet` | 78 | 0.0 MB | `afb194f0ce5e` |

## Supressão aplicada

- Pares origem→destino existentes na amostra: 268,382
- Pares publicados (após R1): 29,647 (11.0%), cobrindo 70.8% do volume migratório estimado
- Os 238,735 pares suprimidos permanecem contabilizados nos totais municipais de `municipios.parquet`, de modo que nenhum volume é perdido — apenas a identificação do par.
