# Relatório de controle de revelação

- Versão dos dados: **1.1.0-1980**
- Gerado em: 2026-10-01 00:56 (fuso local)
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
- R1: 29,840 fluxos publicados, todos com ≥ 20 pessoas (edição sem chave de domicílio: o piso de domicílios é substituído pelo piso elevado de pessoas)
- R1: 24 categorias de fluxo verificadas célula a célula, nenhuma abaixo do limiar
- R2: nenhum fluxo com menos de 50 observações publica detalhe
- R6: os 52 municípios do norte de Goiás (17xxxxx) e Fernando de Noronha publicados como municípios, cada um uma vez, sem código de 1980 nem 'NORTEGO' em nenhum arquivo
- R1: perfis municipais: nenhuma categoria nominal publicada com menos de 20 observações
- R1: pendular_trab: 2,596 fluxos publicados, todos acima do limiar
- R2: pendular_trab_dim: detalhe restrito a fluxos com n>=50
- R1: pendular_estudo: 575 fluxos publicados, todos acima do limiar
- R2: pendular_estudo_dim: detalhe restrito a fluxos com n>=50
- R1: rm_fluxos_intra.parquet: todas as linhas acima do limiar de 20 observações
- R1: rm_mig_estudo.parquet: todas as linhas acima do limiar de 20 observações
- R4: 15 colunas de estimativa verificadas, todas em múltiplos de 5
- R5: nenhuma contagem amostral exata publicada; apenas faixas

## Arquivos publicados

| Arquivo | Linhas | Tamanho | SHA-256 (12) |
|---|---:|---:|---|
| `fluxos.parquet` | 29,840 | 0.5 MB | `dd6720a0a3a6` |
| `fluxos_rgi.parquet` | 12,226 | 0.1 MB | `0bc463dd2a26` |
| `fluxos_rgint.parquet` | 4,654 | 0.0 MB | `8e64724cb329` |
| `fluxos_uf.parquet` | 587 | 0.0 MB | `363b35490f50` |
| `municipios.parquet` | 3,991 | 0.3 MB | `25918c76b0cf` |
| `municipios_dim.parquet` | 152,824 | 0.8 MB | `64e91643b13d` |
| `municipios_pendular.parquet` | 3,991 | 0.1 MB | `47ff9eb9e1bc` |
| `municipios_ref.parquet` | 3,991 | 0.1 MB | `f0be08ff451d` |
| `pendular_estudo.parquet` | 575 | 0.0 MB | `b9380e19d2fe` |
| `pendular_estudo_dim.parquet` | 824 | 0.0 MB | `7ce82bba415a` |
| `pendular_trab.parquet` | 2,596 | 0.0 MB | `751cd1b7553d` |
| `pendular_trab_dim.parquet` | 14,903 | 0.1 MB | `05a6a0a6f979` |
| `rm.parquet` | 1,032 | 0.0 MB | `3820166c490c` |
| `rm_fluxos_intra.parquet` | 3,504 | 0.0 MB | `afc64d6da5a4` |
| `rm_mig_estudo.parquet` | 1,099 | 0.0 MB | `39e1fe0dd73c` |
| `rm_mig_pendular.parquet` | 2,161 | 0.0 MB | `30a4bb7e2ce4` |
| `rm_mig_pendular_resumo.parquet` | 966 | 0.0 MB | `3970bb1a73ea` |
| `rm_resumo.parquet` | 80 | 0.0 MB | `a368c2455db3` |

## Supressão aplicada

- Pares origem→destino existentes na amostra: 272,239
- Pares publicados (após R1): 29,840 (11.0%), cobrindo 70.5% do volume migratório estimado
- Os 242,399 pares suprimidos permanecem contabilizados nos totais municipais de `municipios.parquet`, de modo que nenhum volume é perdido — apenas a identificação do par.
