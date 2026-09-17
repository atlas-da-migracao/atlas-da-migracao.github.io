# Relatório de controle de revelação

- Versão dos dados: **1.0.3-1991**
- Gerado em: 2026-09-17 16:24 (fuso local)
- Fonte: IBGE, Censo Demográfico 1991, microdados da amostra (dados públicos).

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

- R6: 10 arquivos sem colunas de domicílio ou área de ponderação
- R1: 44,407 fluxos publicados, todos com ≥ 5 pessoas e ≥ 3 domicílios
- R1: 24 categorias de fluxo verificadas célula a célula, nenhuma abaixo do limiar
- R2: nenhum fluxo com menos de 20 observações publica detalhe
- R1: perfis municipais: nenhuma categoria nominal publicada com menos de 5 observações
- R1: rm_fluxos_intra.parquet: todas as linhas acima do limiar de 5 observações
- R4: 10 colunas de estimativa verificadas, todas em múltiplos de 5
- R5: nenhuma contagem amostral exata publicada; apenas faixas

## Arquivos publicados

| Arquivo | Linhas | Tamanho | SHA-256 (12) |
|---|---:|---:|---|
| `fluxos.parquet` | 44,407 | 0.8 MB | `3240808eacaa` |
| `fluxos_rgi.parquet` | 18,120 | 0.2 MB | `66519b9d8f04` |
| `fluxos_rgint.parquet` | 6,762 | 0.1 MB | `7baf0da23610` |
| `fluxos_uf.parquet` | 670 | 0.0 MB | `a5d0c92eb35d` |
| `municipios.parquet` | 4,491 | 0.4 MB | `2bcee5432f7f` |
| `municipios_dim.parquet` | 259,960 | 1.3 MB | `7445abedb441` |
| `municipios_ref.parquet` | 4,491 | 0.1 MB | `541522dbe982` |
| `rm.parquet` | 1,132 | 0.0 MB | `22328ff14dfc` |
| `rm_fluxos_intra.parquet` | 4,712 | 0.1 MB | `135f26bac47e` |
| `rm_resumo.parquet` | 81 | 0.0 MB | `cf4f056fe3a1` |

## Supressão aplicada

- Pares origem→destino existentes na amostra: 217,689
- Pares publicados (após R1): 44,407 (20.4%), cobrindo 71.6% do volume migratório estimado
- Os 173,282 pares suprimidos permanecem contabilizados nos totais municipais de `municipios.parquet`, de modo que nenhum volume é perdido — apenas a identificação do par.
