# Relatório de controle de revelação

- Versão dos dados: **1.0.1-1980**
- Gerado em: 2026-09-16 11:34 (fuso local)
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

- R6: 19 arquivos sem colunas de domicílio ou área de ponderação
- R1: edição sem chave de domicílio confirmada (`controle` nulo em 100% dos registros): R1 = ≥ 20 pessoas (edição sem chave de domicílio: o piso de domicílios é substituído pelo piso elevado de pessoas); R2 = só em fluxos com ≥ 50 observações (elevado por ausência de chave de domicílio)
- R1: 29,437 fluxos publicados, todos com ≥ 20 pessoas (edição sem chave de domicílio: o piso de domicílios é substituído pelo piso elevado de pessoas)
- R1: 24 categorias de fluxo verificadas célula a célula, nenhuma abaixo do limiar
- R2: nenhum fluxo com menos de 50 observações publica detalhe
- R1: fluxos_origem_agregada: 168 linhas publicadas, todas com ≥ 20 pessoas (edição sem chave de domicílio: o piso de domicílios é substituído pelo piso elevado de pessoas)
- R2: fluxos_origem_agregada: nenhuma linha abaixo do piso de detalhe publica caracterização
- R6: fluxos_origem_agregada: origem sintética não colide com nenhuma unidade publicada nem com o destino
- R1: perfis municipais: nenhuma categoria nominal publicada com menos de 20 observações
- R1: pendular_trab: 2,593 fluxos publicados, todos acima do limiar
- R2: pendular_trab_dim: detalhe restrito a fluxos com n>=50
- R1: pendular_estudo: 761 fluxos publicados, todos acima do limiar
- R2: pendular_estudo_dim: detalhe restrito a fluxos com n>=50
- R1: rm_fluxos_intra.parquet: todas as linhas acima do limiar de 20 observações
- R1: rm_mig_estudo.parquet: todas as linhas acima do limiar de 20 observações
- R4: 16 colunas de estimativa verificadas, todas em múltiplos de 5
- R5: nenhuma contagem amostral exata publicada; apenas faixas

## Arquivos publicados

| Arquivo | Linhas | Tamanho | SHA-256 (12) |
|---|---:|---:|---|
| `fluxos.parquet` | 29,437 | 0.5 MB | `77a750ae6f8c` |
| `fluxos_origem_agregada.parquet` | 168 | 0.0 MB | `caaef8e8e89e` |
| `fluxos_rgi.parquet` | 11,928 | 0.1 MB | `1788c29c61af` |
| `fluxos_rgint.parquet` | 4,492 | 0.0 MB | `49cc5a7527b1` |
| `fluxos_uf.parquet` | 553 | 0.0 MB | `a6e225bf2167` |
| `municipios.parquet` | 3,939 | 0.3 MB | `b376f7fb31a7` |
| `municipios_dim.parquet` | 150,753 | 0.7 MB | `48c197be0bab` |
| `municipios_pendular.parquet` | 3,939 | 0.1 MB | `4e565c196844` |
| `municipios_ref.parquet` | 3,939 | 0.1 MB | `6f828b2fbe9a` |
| `pendular_estudo.parquet` | 761 | 0.0 MB | `8552c7fc2e05` |
| `pendular_estudo_dim.parquet` | 1,223 | 0.0 MB | `3da95edef387` |
| `pendular_trab.parquet` | 2,593 | 0.0 MB | `9547be0c0e85` |
| `pendular_trab_dim.parquet` | 14,897 | 0.1 MB | `80b5308f2432` |
| `rm.parquet` | 1,019 | 0.0 MB | `789fa5e645ef` |
| `rm_fluxos_intra.parquet` | 3,477 | 0.0 MB | `397b3e767863` |
| `rm_mig_estudo.parquet` | 1,112 | 0.0 MB | `a795c5623109` |
| `rm_mig_pendular.parquet` | 2,148 | 0.0 MB | `41f30b17ee86` |
| `rm_mig_pendular_resumo.parquet` | 953 | 0.0 MB | `58bf7b49b8ce` |
| `rm_resumo.parquet` | 78 | 0.0 MB | `a3ee46b94d26` |

## Supressão aplicada

- Pares origem→destino existentes na amostra: 267,073
- Pares publicados (após R1): 29,437 (11.0%), cobrindo 70.7% do volume migratório estimado
- Os 237,636 pares suprimidos permanecem contabilizados nos totais municipais de `municipios.parquet`, de modo que nenhum volume é perdido — apenas a identificação do par.
- **Origem agregada** (`fluxos_origem_agregada.parquet`): 15,350 registros de migrante cuja origem é conhecida na fonte mas não é uma unidade publicável desta edição (Σ peso 64,639). No nível de município, 66 pares passam em R1, cobrindo 87.5% dessa massa. Esses registros **não** entram em `fluxos.parquet` nem em `municipios.parquet` — continuam contados como imigração de origem não informada nos totais municipais, e a tabela própria é o único lugar onde o par origem→destino aparece.
