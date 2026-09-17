# Atlas da migração interna no Brasil — Censo 2022

**[atlas-da-migracao.github.io](https://atlas-da-migracao.github.io)**

Atlas interativo dos fluxos de migração interna, deslocamento pendular (trabalho e
estudo) e um módulo dedicado às regiões metropolitanas do Brasil no quinquênio
2017–2022, a partir do quesito de **migração de data fixa** dos microdados da amostra
do Censo Demográfico 2022 do IBGE (acesso controlado). Mostra saldo migratório, taxas,
matriz completa de fluxos entre os 5.570 municípios brasileiros e o perfil dos
migrantes (escolaridade, renda, idade, sexo, status migratório) por município, região
imediata, região intermediária, UF e região metropolitana/RIDE.

Ver também `PLANO_Atlas_Migracao_Censo2022.pdf` (plano completo) e `CLAUDE.md`
(convenções para quem for trabalhar no código).

## Principais achados

- **12,9 milhões de pessoas** mudaram de município de residência entre 31/07/2017 e
  31/07/2022, formando **53.097 pares** origem→destino publicados após o controle
  estatístico de revelação.
- **Desconcentração metropolitana sem desconcentração de emprego**: entre as pessoas
  que saíram do núcleo de uma região metropolitana para a periferia, **46,5% continuam
  trabalhando no núcleo** — a moradia se deslocou, o emprego não. Na RIDE do Distrito
  Federal essa parcela chega a **59,3%**.
- **Seletividade educacional do fluxo Rio de Janeiro → São Paulo**: entre os migrantes
  de 25 anos ou mais desse par, **75,1% têm superior completo**.
- **Guarulhos → São Paulo é o maior par de deslocamento pendular do país**: cerca de
  **77,5 mil pessoas** residem em Guarulhos e trabalham em São Paulo.

Ver `/achados/` no site e `docs/qa/*.md` (relatórios de QA de cada fase) para a lista
completa e a metodologia de cada número.

## Fonte e política de uso dos microdados

Fonte: **IBGE, Censo Demográfico 2022, microdados da amostra (acesso controlado)**,
quesito de migração de data fixa (residência em 31/07/2017 comparada à de 31/07/2022).

Os microdados são de **acesso controlado** do IBGE — não estão neste repositório e nunca
saíram do ambiente controlado de quem tem a concessão de acesso. Tudo o que este projeto
publica (site, páginas estáticas, `data/processed/`) já passou por um **gate automático
de controle estatístico de revelação** antes de sair desse ambiente:

- **R1** — toda célula publicada exige um mínimo de observações amostrais e de
  domicílios distintos; abaixo disso é suprimida.
- **R2** — detalhamento por característica (escolaridade, renda, status etc.) só é
  publicado para fluxos com massa amostral suficiente.
- **R3** — supressão complementar: quando uma categoria é suprimida, a segunda menor
  também é, para impedir recuperação por diferença entre as margens.
- **R4** — toda estimativa ponderada publicada é arredondada a múltiplos de 5.
- **R5** — a contagem amostral (`n`) nunca é publicada com valor exato; só em faixas.
- **R6** — a menor unidade geográfica publicada é o município; nenhum cruzamento de três
  ou mais dimensões temáticas.
- **R7–R9** — os dados-fonte nunca saem da máquina local; um gate automatizado roda
  antes de qualquer publicação; toda página traz atribuição e aviso padrão.

Detalhes completos das regras, das definições metodológicas e das limitações conhecidas:
[`docs/METODOLOGIA.md`](docs/METODOLOGIA.md). Evidência de que o gate foi aplicado à
versão atual dos dados: `docs/relatorio_revelacao_<versão>.md` (o nome exato está em
`data/processed/meta.json`, campo `versao_dados`).

## Arquitetura

```
microdados do IBGE (acesso controlado, local)
        │  pipeline/*.sql via DuckDB (pipeline/run.py)
        ▼
data/interim/  (Parquet, nunca sai da máquina, gitignored)
        │  pipeline/publish.py — aplica as regras R1-R6
        ▼
data/interim/*_bruto.parquet
        │  pipeline/disclosure_check.py — gate de revelação (R1-R9), grava
        │  data/processed/.gate_ok e docs/relatorio_revelacao_<versão>.md
        ▼
data/processed/  (Parquet + JSON + TopoJSON, VERSIONADO — já aprovado pelo gate)
        │  ┌─ npm run sync-data ──► web/public/data/ ──► DuckDB-WASM no navegador
        │  │                                              (agregações/filtros em SQL local)
        └──┴─ pipeline/build_paginas.py ──► web/dist/**/index.html
                                             (6.000+ páginas estáticas indexáveis, SEO)
```

- **Pipeline** (`pipeline/`): Python + DuckDB. Lê os CSVs de acesso controlado do IBGE,
  classifica migrantes/status/escolaridade/renda, calcula fluxos e erro-padrão, aplica o
  controle de revelação e grava `data/processed/`.
- **Front-end** (`web/`): Vite + React 19 + TypeScript. Carrega os Parquet publicados em
  DuckDB-WASM (worker) e faz todas as agregações e filtros com SQL local, instantâneo,
  sem servidor de dados. Mapa em MapLibre GL + deck.gl (coroplético + arcos de fluxo),
  gráficos em Observable Plot/D3.
- **Páginas estáticas** (`pipeline/build_paginas.py`): gerador Python + DuckDB + Jinja2
  que lê exclusivamente `data/processed` (já aprovado pelo gate) e escreve uma página
  HTML indexável por município, UF, região imediata/intermediária e região
  metropolitana, mais sitemap, robots.txt e páginas de conteúdo fixo. Ver
  [`docs/SEO.md`](docs/SEO.md).

## Como rodar

Pré-requisitos: Python 3.12+ com `venv`, Node 22+, e — **só para reproduzir o pipeline a
partir dos microdados brutos** — uma concessão de acesso controlado própria aos
microdados da amostra do Censo Demográfico 2022 do IBGE.

> **Os microdados não estão neste repositório.** As etapas que leem `data/raw`
> (extração, classificação, cálculo de fluxos e o próprio gate de revelação) só podem
> ser reproduzidas por quem tem sua própria concessão de acesso do IBGE. **As etapas a
> partir de `data/processed` — que já está neste repositório, versionado e aprovado pelo
> gate — são reprodutíveis por qualquer pessoa**, sem precisar de acesso a microdado
> algum: basta rodar o front-end ou o gerador de páginas estáticas sobre os Parquet já
> publicados.

### Pipeline (requer acesso próprio aos microdados do IBGE)

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

python pipeline/run.py               # orquestra as etapas do pipeline
python pipeline/validate.py          # testes de consistência
python pipeline/disclosure_check.py --versao <AAAA-MM-DD>   # gate de revelação R1-R9
python pipeline/verify_gate.py       # confere o gate de forma independente (sem microdado)

./geo/build.sh                       # malha municipal 2022 -> TopoJSON (dado público)
python pipeline/build_centroids.py
python pipeline/build_meta.py
```

### Front-end e páginas estáticas (reprodutível por qualquer pessoa a partir de `data/processed`)

```bash
cd web
npm ci
npm run copy-duckdb    # runtime do DuckDB-WASM -> public/duckdb
npm run sync-data      # data/processed -> public/data (recusa se .gate_ok estiver ausente)
npm run dev            # servidor de desenvolvimento

# build de produção completo (site + páginas estáticas de SEO)
SITE_URL=https://atlas-da-migracao.github.io npm run build:site
```

Instalar o hook de pre-commit (não viaja com `git clone`):

```bash
cp scripts/pre-commit .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
```

Ele bloqueia commits de `data/raw`, `data/interim`, CSVs e segredos, e roda
`pipeline/verify_gate.py` automaticamente sempre que `data/processed` estiver no stage.

## Testes

```bash
pytest -q                          # pipeline (raiz do repositório)
cd web && npm run test             # componentes/lib (Vitest)
cd web && SITE_URL=https://exemplo.invalid npm run build:site   # build completo local
```

Testes do pipeline que dependem de `data/interim` (não versionado) são pulados
automaticamente quando essa pasta não existe — é o caso do CI, que só tem acesso a
`data/processed`.

## Estrutura de pastas

```
pipeline/           pipeline Python + DuckDB (extração, classificação, fluxos, gate, páginas)
  sql/              SQL de cada etapa
  tests/            pytest
web/                Vite + React + TypeScript
  src/              app, componentes, mapa, gráficos, DuckDB-WASM, estado
  public/           runtime do DuckDB-WASM e dados sincronizados (gerados, gitignored)
geo/                scripts de construção da malha municipal (mapshaper)
data/
  raw/              (gitignored) symlink para os microdados brutos, acesso controlado
  interim/          (gitignored) Parquet intermediário, nunca sai da máquina
  processed/        (VERSIONADO) agregados já aprovados pelo gate de revelação
  geo/raw/          (gitignored) shapefile original do IBGE
docs/               metodologia, SEO, checklist de publicação, relatórios de QA e de revelação
.github/workflows/  CI: verificação, build e publicação em GitHub Pages
```

## Licenças

- **Código-fonte**: [MIT](LICENSE).
- **Dados agregados publicados e conteúdo textual** (`data/processed/`, páginas do
  site, metodologia, achados): [CC BY 4.0](LICENSE-DADOS.md), com **atribuição
  obrigatória ao IBGE** como fonte primária dos microdados.
- **Microdados originais do Censo 2022**: NÃO estão incluídos; permanecem sob os termos
  de acesso controlado do IBGE.

Ver [`LICENSE-DADOS.md`](LICENSE-DADOS.md) para os detalhes de atribuição.

## Como citar

```
Pessini Sobreira, Daniel (https://orcid.org/0000-0002-6632-3991). Atlas da migração interna no Brasil. Dados
dos Censos Demográficos 1980-2022 (IBGE). Versão dos dados: <ver data/processed/meta.json>.
DOI: https://doi.org/10.5281/zenodo.22469791 (todas as versões) /
https://doi.org/10.5281/zenodo.22819760 (v2.0.0). Disponível em: https://atlas-da-migracao.github.io.
Acesso ao depósito no Zenodo temporariamente restrito -- ver docs/CHECKLIST_PUBLICACAO.md.
```

Metadados estruturados para gerenciadores de referência em [`CITATION.cff`](CITATION.cff).

## Aviso

Estimativas elaboradas pelo autor a partir dos microdados da amostra do Censo
Demográfico 2022 (IBGE, acesso controlado), sujeitas a erro amostral e a controle
estatístico de revelação; podem divergir das tabulações oficiais do IBGE (SIDRA). Este
projeto não tem caráter oficial e não é afiliado ao IBGE.

## Como reportar erros

Abra uma [Issue](../../issues) neste repositório descrevendo o problema (página, número
ou comportamento inesperado). Para dúvidas de metodologia, ver primeiro
[`docs/METODOLOGIA.md`](docs/METODOLOGIA.md) e a página `/metodologia/` do site.

---

## English summary

**Atlas of Internal Migration in Brazil** — an interactive atlas of internal migration
flows, commuting (work and school), and a dedicated metropolitan-region module for
Brazil over the 2017–2022 five-year period, built from the fixed-date migration question
in the restricted-access sample microdata of Brazil's 2022 Demographic Census (IBGE).
Live site: **https://atlas-da-migracao.github.io**.

Key findings: 12.9 million people changed municipality of residence in the period,
across 5,570 municipalities; 46.5% of people who left a metropolitan core for its
periphery still work in the core (59.3% in the Federal District integrated region);
75.1% of migrants aged 25+ moving from Rio de Janeiro to São Paulo have a completed
university degree; Guarulhos→São Paulo is the country's largest commuting pair
(~77,500 people).

The original microdata are restricted-access and are **not** included in this
repository; only aggregated, rounded, and disclosure-controlled tables
(`data/processed/`) are published, after an automated statistical disclosure-control
gate (`pipeline/disclosure_check.py`, `pipeline/verify_gate.py`). Source code is MIT
licensed; published data and content are CC BY 4.0 with mandatory attribution to IBGE.
See [`docs/METODOLOGIA.md`](docs/METODOLOGIA.md) and the site's `/en/` page for more.
