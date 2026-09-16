# Relatório de controle de revelação

- Versão dos dados: **1.0.0-1980**
- Gerado em: 2026-09-16 10:51 (fuso local)
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
- R1: 29,437 fluxos publicados, todos com ≥ 20 pessoas (edição sem chave de domicílio: o piso de domicílios é substituído pelo piso elevado de pessoas)
- R1: 24 categorias de fluxo verificadas célula a célula, nenhuma abaixo do limiar
- R2: nenhum fluxo com menos de 50 observações publica detalhe
- R1: perfis municipais: nenhuma categoria nominal publicada com menos de 20 observações
- R1: pendular_trab: 2,593 fluxos publicados, todos acima do limiar
- R2: pendular_trab_dim: detalhe restrito a fluxos com n>=50
- R1: pendular_estudo: 761 fluxos publicados, todos acima do limiar
- R2: pendular_estudo_dim: detalhe restrito a fluxos com n>=50
- R1: rm_fluxos_intra.parquet: todas as linhas acima do limiar de 20 observações
- R1: rm_mig_estudo.parquet: todas as linhas acima do limiar de 20 observações
- R4: 15 colunas de estimativa verificadas, todas em múltiplos de 5
- R5: nenhuma contagem amostral exata publicada; apenas faixas

## Arquivos publicados

| Arquivo | Linhas | Tamanho | SHA-256 (12) |
|---|---:|---:|---|
| `fluxos.parquet` | 29,437 | 0.5 MB | `f46b64d004bc` |
| `fluxos_rgi.parquet` | 11,928 | 0.1 MB | `c7843a3e169c` |
| `fluxos_rgint.parquet` | 4,492 | 0.0 MB | `ff14634e95b7` |
| `fluxos_uf.parquet` | 553 | 0.0 MB | `3ad1d4b9a381` |
| `municipios.parquet` | 3,939 | 0.3 MB | `b376f7fb31a7` |
| `municipios_dim.parquet` | 150,753 | 0.7 MB | `983fa376cbe6` |
| `municipios_pendular.parquet` | 3,939 | 0.1 MB | `99df50c0f22a` |
| `municipios_ref.parquet` | 3,939 | 0.1 MB | `6f828b2fbe9a` |
| `pendular_estudo.parquet` | 761 | 0.0 MB | `f7ee1d0b9dbb` |
| `pendular_estudo_dim.parquet` | 1,223 | 0.0 MB | `ac8169747346` |
| `pendular_trab.parquet` | 2,593 | 0.0 MB | `62887843d114` |
| `pendular_trab_dim.parquet` | 14,897 | 0.1 MB | `c5690f86f2ab` |
| `rm.parquet` | 1,019 | 0.0 MB | `789fa5e645ef` |
| `rm_fluxos_intra.parquet` | 3,477 | 0.0 MB | `37efe82c7400` |
| `rm_mig_estudo.parquet` | 1,112 | 0.0 MB | `b40158e6d7a7` |
| `rm_mig_pendular.parquet` | 2,148 | 0.0 MB | `3a240787b7b9` |
| `rm_mig_pendular_resumo.parquet` | 953 | 0.0 MB | `e89c8fbd4456` |
| `rm_resumo.parquet` | 78 | 0.0 MB | `1438306b3102` |

## Supressão aplicada

- Pares origem→destino existentes na amostra: 267,073
- Pares publicados (após R1): 29,437 (11.0%), cobrindo 70.7% do volume migratório estimado
- Os 237,636 pares suprimidos permanecem contabilizados nos totais municipais de `municipios.parquet`, de modo que nenhum volume é perdido — apenas a identificação do par.
