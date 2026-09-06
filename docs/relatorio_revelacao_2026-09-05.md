# Relatório de controle de revelação

- Versão dos dados: **2026-09-05**
- Gerado em: 2026-09-05 20:03 (fuso local)
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

- R6: 7 arquivos sem colunas de domicílio ou área de ponderação
- R1: 53,097 fluxos publicados, todos com n>=5 e domicílios>=3
- R1: 25 categorias de fluxo verificadas célula a célula, nenhuma abaixo do limiar
- R2: nenhum fluxo com menos de 20 observações publica detalhe
- R1: perfis municipais: nenhuma categoria nominal publicada com menos de 5 observações
- R4: 8 colunas de estimativa verificadas, todas em múltiplos de 5
- R5: nenhuma contagem amostral exata publicada; apenas faixas

## Arquivos publicados

| Arquivo | Linhas | Tamanho | SHA-256 (12) |
|---|---:|---:|---|
| `fluxos.parquet` | 53,097 | 0.9 MB | `0246199edecd` |
| `fluxos_rgi.parquet` | 23,083 | 0.3 MB | `07e0d91abc12` |
| `fluxos_rgint.parquet` | 9,155 | 0.1 MB | `cff1994e80f6` |
| `fluxos_uf.parquet` | 689 | 0.0 MB | `a0d0df846b8c` |
| `municipios.parquet` | 5,570 | 0.5 MB | `288cfcf169ce` |
| `municipios_dim.parquet` | 342,005 | 1.8 MB | `6abe75da4a90` |
| `municipios_ref.parquet` | 5,570 | 0.2 MB | `e497fe05679f` |

## Supressão aplicada

- Pares origem→destino existentes na amostra: 326,973
- Pares publicados (após R1): 53,097 (16.2%), cobrindo 67.6% do volume migratório estimado
- Os 273,876 pares suprimidos permanecem contabilizados nos totais municipais de `municipios.parquet`, de modo que nenhum volume é perdido — apenas a identificação do par.
