# Relatório de QA — F2b (Deslocamento pendular e módulo metropolitano)

Gerado em 2026-09-05. Só contém agregados; nenhum registro individual.

## Volumetria

| Medida | Valor |
|---|---:|
| Ocupados que trabalham em outro município (pendulares) | 9.057.282 pessoas |
| Pares origem→destino de trabalho | 120.435 |
| Estudantes que estudam em outro município | 3.811.136 pessoas |
| Pares origem→destino de estudo | 90.929 |
| Regiões metropolitanas e RIDEs | 81 (1.388 municípios) |
| Migrantes intrametropolitanos (2017→2022) | 2.782.848 pessoas |

Identidades verificadas: Σ saídas = Σ entradas para trabalho e para estudo; Σ da tripla origem→residência→trabalho = migrantes intra-RM ocupados (1.571.255).

## Pendularidade para trabalho

No Brasil, **10,2% dos ocupados trabalham em outro município**. Sergipe (15,6%), Rio Grande do Norte (15,1%) e Pernambuco (14,7%) lideram.

Maiores fluxos pendulares do país:

| Origem | Destino | Pessoas | Retorno diário | Tempo mediano |
|---|---|---:|---:|---:|
| Guarulhos/SP | São Paulo/SP | 77.499 | 96% | 80 min |
| Osasco/SP | São Paulo/SP | 68.745 | 96% | 60 min |
| Contagem/MG | Belo Horizonte/MG | 61.338 | 96% | 60 min |
| Jaboatão dos Guararapes/PE | Recife/PE | 57.119 | 92% | 60 min |
| Ribeirão das Neves/MG | Belo Horizonte/MG | 56.184 | 96% | 90 min |
| Aparecida de Goiânia/GO | Goiânia/GO | 51.959 | 96% | 40 min |
| Águas Lindas de Goiás/GO | Brasília/DF | 47.327 | 96% | 90 min |

Os dois casos de checagem previstos no plano se confirmam: **Guarulhos→São Paulo é o maior par pendular do país** e **Santana→Macapá** aparece com 4.606 pessoas (258º maior par).

Caracterização nacional dos pendulares: 38,7% usam ônibus, van ou BRT; 37,8% automóvel ou táxi; 12,0% motocicleta; 3,9% trem ou metrô. 84,4% retornam para casa três ou mais dias por semana. Tempo mediano de deslocamento: 50 minutos. 60,1% são empregados com carteira assinada, acima da média dos ocupados, o que indica que a pendularidade se associa ao emprego formal.

Municípios com maior taxa de saída pendular (mínimo de 20 mil ocupados): Francisco Morato/SP (50,0%), São Gonçalo do Amarante/RN (49,8%), Valparaíso de Goiás/GO (49,2%). Maiores índices de atração: Vitória/ES (1,37), Barueri/SP (1,36), Goiana/PE (1,28), Extrema/MG (1,28).

## Pendularidade para estudo

44,8% dos estudantes pendulares cursam graduação, o que reflete a concentração do ensino superior nos polos regionais. Os maiores fluxos são Contagem→Belo Horizonte (19.779), Parnamirim→Natal (19.058) e Jaboatão→Recife (18.686).

## Migração intrametropolitana

Tipologia dos fluxos dentro das regiões metropolitanas:

| Direção | Pessoas | Participação |
|---|---:|---:|
| Núcleo → periferia | 1.224.079 | 44,0% |
| Periferia → periferia | 1.089.148 | 39,1% |
| Periferia → núcleo | 469.621 | 16,9% |

A predominância do sentido núcleo→periferia confirma a desconcentração residencial das metrópoles brasileiras.

## Cruzamento migração × pendularidade (achado central)

Entre os **679.751 ocupados que se mudaram do núcleo metropolitano para a periferia** entre 2017 e 2022, **46,5% continuam trabalhando no núcleo**. Ou seja, quase metade dessa desconcentração é residencial, não produtiva: a moradia se deslocou, o emprego não.

| Região metropolitana | Migrantes núcleo→periferia ocupados | Seguem trabalhando no núcleo | Trabalham onde moram |
|---|---:|---:|---:|
| RIDE do Distrito Federal | 43.941 | 59,3% | 36,4% |
| Recife | 28.380 | 52,1% | 34,7% |
| Curitiba | 42.395 | 50,4% | 38,3% |
| Goiânia | 28.871 | 50,3% | 40,6% |
| Belo Horizonte | 53.999 | 48,7% | 38,5% |
| Fortaleza | 30.218 | 48,7% | 43,0% |
| São Paulo | 123.121 | 47,8% | 39,0% |
| Rio de Janeiro | 31.587 | 40,9% | 49,0% |

Considerando todos os migrantes intrametropolitanos ocupados (1.571.255), 54,5% trabalham no município onde passaram a morar, 27,4% voltam a trabalhar no município de onde saíram, 6,1% trabalham no núcleo (sem ter vindo dele) e 8,4% em outro município da região.

## Panorama das maiores regiões metropolitanas

| Região metropolitana | Municípios | População | Migração interna | Saldo com o resto do país | Pendularidade | Tempo mediano |
|---|---:|---:|---:|---:|---:|---:|
| São Paulo | 39 | 20,7 mi | 477.424 | −470.010 | 14,5% | 60 min |
| Rio de Janeiro | 22 | 12,0 mi | 225.772 | −227.085 | 11,9% | 90 min |
| Belo Horizonte | 34 | 5,1 mi | 180.108 | −34.433 | 19,4% | 60 min |
| RIDE do Distrito Federal | 34 | 4,5 mi | 127.780 | +7.873 | 10,6% | 80 min |
| Porto Alegre | 34 | 4,0 mi | 152.098 | −92.849 | 18,8% | 40 min |
| Recife | 14 | 3,7 mi | 124.256 | −29.245 | 21,2% | 60 min |
| Curitiba | 29 | 3,6 mi | 122.326 | +10.319 | 17,3% | 50 min |
| Campinas | 20 | 3,2 mi | 75.639 | +42.933 | 16,5% | 40 min |

As duas maiores metrópoles perdem população para o resto do país, enquanto Campinas, Curitiba e a RIDE-DF ganham. O Rio de Janeiro tem o maior tempo mediano de deslocamento pendular e a maior dependência de transporte coletivo (66,5%).

## Controle de revelação

Gate `pipeline/disclosure_check.py`: **aprovado**, agora cobrindo as 18 tabelas publicadas. Verificações adicionais da F2b: limiar nos fluxos pendulares de trabalho (21.327 publicados) e de estudo (16.429), detalhe restrito a fluxos com pelo menos 20 observações, e limiar nas tabelas metropolitanas. Conjunto publicável completo: 6,3 MB.

## Testes automatizados

`pytest`: **33 aprovados** (8 da F1, 13 da F2, 12 da F2b), cobrindo as identidades de saída e entrada, ausência de autoloops, universo restrito a ocupados e estudantes, a liderança de Guarulhos→São Paulo, a presença de Santana→Macapá, a soma da tripla, a coerência da classe "origem", núcleo único por região metropolitana e o limiar nos arquivos publicados.

## Nota de implementação

A caracterização dos fluxos pendulares usa formato longo (`pendular_trab_dim.parquet`), e não colunas largas como na matriz migratória. São nove dimensões e mais de cinquenta categorias; o formato longo mantém o arquivo enxuto, facilita a supressão célula a célula e é consultado com a mesma facilidade pelo DuckDB no navegador.
