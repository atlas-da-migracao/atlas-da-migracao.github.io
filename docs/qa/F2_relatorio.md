# Relatório de QA — F2 (Indicadores, fluxos, variância e revelação)

Gerado em 2026-09-05. Só contém agregados; nenhum registro individual.

## Resultados centrais

| Medida | Valor |
|---|---:|
| Migrantes internos com origem conhecida (data fixa 2017→2022) | 12.883.156 pessoas |
| Registros amostrais correspondentes | 1.498.576 |
| Migrantes com origem não informada | 120.733 pessoas |
| Imigrantes internacionais | 455.013 pessoas |
| Pares origem→destino observados | 326.973 |
| Municípios cobertos | 5.570 |

Identidade contábil Σ imigrantes = Σ emigrantes = 12.883.156 e Σ saldos = 0: **verificadas**.

## Composição dos migrantes internos

| Status migratório | Participação |
|---|---:|
| Primeira saída do município natal | 45,7% |
| Migração de etapas múltiplas | 39,2% |
| Retorno ao município natal | 14,7% |
| Nascido no exterior | 0,4% |

## Verificações demográficas previstas no plano

- **Retorno ao município natal**: Nordeste 22,6% contra 14,7% do Brasil — confirma o padrão histórico de retorno nordestino.
- **Seletividade migratória**: entre pessoas de 25 anos ou mais, 27,0% dos migrantes têm superior completo contra 17,8% dos residentes não migrantes; na base da distribuição, 25,1% contra 36,0% sem instrução ou fundamental incompleto.
- **Renda domiciliar per capita**: 21,9% dos migrantes vivem em domicílios acima de 2 salários mínimos per capita contra 15,7% dos residentes.
- **Saldos estaduais**: Santa Catarina lidera com +351,6 mil (49,2 por mil habitantes de 5+), seguida de Goiás e Mato Grosso; as maiores perdas são de Rio de Janeiro, Maranhão, Pará e Distrito Federal.
- **Desconcentração metropolitana**: os maiores fluxos do país são núcleo→periferia — São Paulo→Guarulhos (23,4 mil), Brasília→Águas Lindas de Goiás (21,6 mil), Brasília→Valparaíso de Goiás (21,1 mil), Belo Horizonte→Contagem (19,2 mil), Salvador→Lauro de Freitas (18,1 mil).
- **Corredores interestaduais**: São Paulo↔Bahia é o par mais intenso (123,1 mil de ida e 110,6 mil de volta); Rio Grande do Sul→Santa Catarina e Paraná→Santa Catarina confirmam a atração catarinense.

## Precisão das estimativas

Estimador de conglomerados últimos (domicílio como unidade primária, área de ponderação como estrato), com a forma fechada `Σ_h n_h/(n_h−1)·(S2_h − S1_h²/n_h)`.

Comparação com a Função Generalizada de Variância publicada pelo IBGE (`cv = 4,0616·t^−0,5004`):

| Faixa de imigrantes | Municípios | CV observado (mediana) | CV pela FGV | Razão |
|---|---:|---:|---:|---:|
| menos de 500 | 1.838 | 15,5% | 23,4% | 0,64 |
| 500 a 5.000 | 3.255 | 11,3% | 12,6% | 0,91 |
| 5.000 a 50.000 | 458 | 5,1% | 4,1% | 1,24 |
| mais de 50.000 | 19 | 2,7% | 1,6% | 1,74 |

A razão fica entre 0,6 e 1,8 em todas as faixas, ordem de grandeza compatível com a função do IBGE. A FGV é um ajuste médio nacional, e nosso estimador é específico por município, então divergências nessa magnitude são esperadas.

Qualidade da estimativa de imigração por município: 4.239 com CV até 15% (boa), 1.312 entre 15% e 30% (cautela), 19 acima de 30% (baixa precisão, sinalizada no dashboard).

## Controle de revelação

O gate `pipeline/disclosure_check.py` recalcula as contagens amostrais a partir dos microdados e confronta com o publicado. Resultado: **aprovado**, sem violações. Relatório detalhado em `docs/relatorio_revelacao_2026-09-05.md`.

- 53.097 dos 326.973 pares (16,2%) atendem ao limiar de 5 pessoas e 3 domicílios e são publicados individualmente; eles cobrem a maior parte do volume migratório.
- Os pares suprimidos continuam somados nos totais municipais, de modo que nenhum volume é perdido — apenas a identificação do par.
- 25 categorias de fluxo verificadas célula a célula; nenhuma abaixo do limiar.
- Nenhum arquivo publicado contém identificador de domicílio ou área de ponderação; todas as estimativas em múltiplos de 5; contagens amostrais apenas em faixas.

## Problemas encontrados e corrigidos

1. **Flags booleanas com `NULL`** — `P0600` é branco (NULL) para quem mora há 6+ anos no município. Como `NULL IN (...)` resulta em `NULL`, `NOT is_migrante` eliminava silenciosamente 19,3 milhões de registros, e o grupo de comparação "residentes" ficava reduzido a 6,4 milhões de pessoas em vez de 189,6 milhões. Corrigido com `COALESCE(..., FALSE)` em todas as flags. O efeito era material: a diferença de superior completo entre migrantes e residentes passou de 3,2 para 9,2 pontos percentuais depois da correção.
2. **`NULL` nas colunas de categoria dos fluxos** — `SUM(...) FILTER (...)` devolve `NULL` quando nenhuma pessoa cai na categoria, e qualquer soma downstream virava `NULL`. Corrigido com `COALESCE(..., 0)` nos 27 agregados; as categorias agora reconciliam exatamente com o total.
3. **Dois registros com origem igual ao destino** — inconsistência residual da fonte (um no Paraná, outro no Rio Grande do Sul, 25 pessoas ponderadas). Isolados pela flag `origem_valida`, que exclui autoloops de fluxos e emigração.

## Testes automatizados

`pytest`: **21 aprovados** (8 da F1 e 13 da F2), cobrindo ausência de `NULL` nas flags, identidade contábil, reconciliação das categorias, coerência do CV com a FGV do IBGE, seletividade migratória, retorno nordestino e as regras de revelação sobre os arquivos publicados.
