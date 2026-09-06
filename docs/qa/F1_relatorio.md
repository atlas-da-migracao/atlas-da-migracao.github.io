# Relatório de QA — F1 (Extração)

Gerado em 2026-09-05 19:47 -03. Só contém agregados; nenhum registro individual.

## Volumetria

- Registros de pessoas extraídos: **21.539.579** (bate exatamente com o total de Pessoas do Questionário da Amostra, Notas metodológicas 04/2026, Tabela 1).
- Registros de domicílios extraídos: **7.689.963** (idem, Unidades Domiciliares).
- 27 Unidades da Federação presentes; 5.570 municípios distintos observados como residência atual.
- Tempo de extração: 56,4 s (DuckDB, 10 threads, `data/raw` → `data/interim`).

## Consistência de pesos

- Top 5 UF por população estimada (soma de pesos): SP 44,41M · MG 20,54M · RJ 16,06M · BA 14,14M · PR 11,44M — ordem e magnitude batem com os valores oficiais do Censo 2022 por UF.
- Distribuição de sexo (`P0150`): masculino 10.580.693 · feminino 10.938.599 · ignorado 20.287 registros (proporção compatível com o padrão demográfico nacional).
- Idade (`P0181`): 0 a 138 anos, sem valores nulos.

- Soma nacional de `P0111`: **203.080.756** — bate exatamente com o total populacional das Notas metodológicas 04/2026 (Tabela 3).
- Soma de pesos por UF dentro de ±30% de estimativas aproximadas do Censo 2022 para todas as 27 UFs (checagem de ordem de grandeza; a Tabela 3 do IBGE é nacional, não por UF).
- Join pessoas↔domicílios por `controle`: 100% das pessoas casam com um domicílio.

## Migração de data fixa (P0600)

- Registros por categoria de `P0600`: 1 (mesmo município) = 677.907; 2 (outro município do Brasil) = 1.515.030; 3 (outro país) = 40.714; branco (mora há 6+ anos ou < 5 anos) = 19.305.928. Em pessoas ponderadas, os migrantes internos (`P0600=2`) representam ≈ 13,0 milhões de pessoas.

- Percentual de registros (todas as idades) com `P0600 ∈ {2,3}`: **7,22%** — plausível para migração intermunicipal/internacional de 5 anos no Brasil.
- 100% dos códigos de município de residência há 5 anos (quando conhecidos) pertencem à lista oficial de municípios de 2022 — confirma que não há necessidade de harmonização territorial entre 2017 e 2022.
- Percentual de migrantes internos com origem ignorada (`P0620 ∈ {8888888,9999999}`), em contagem não ponderada de registros: **1,09%** nacionalmente (no perfil inicial de 4 UFs do plano, essa taxa variava por UF entre 0% e 2,7%; a média nacional fica dentro dessa faixa e confirma a decisão de tratar como "origem não informada").

## Testes automatizados

`pytest pipeline/tests/test_f1_extract.py`: **8/8 aprovados** (totais, pesos, 27 UFs, distribuição de `P0600`, validade dos códigos de município, integridade do join).

## Próximos passos (F2)

Classificação de status migratório/escolaridade/renda/idade, cálculo de indicadores municipais e da matriz de fluxos, estimação de variância e aplicação das regras de revelação R1–R6.
