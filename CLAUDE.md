# CLAUDE.md — Atlas da Migração Interna no Brasil (Censo 2022)

Convenções para qualquer sessão Claude Code neste projeto. Ler antes de começar a trabalhar.
Plano completo: `PLANO_Atlas_Migracao_Censo2022.pdf` (raiz) e `~/.claude/plans/atue-como-um-dem-grafo-polished-crescent.md`.
Plano da edição Censo 2010 (segunda edição do atlas, em andamento no branch `censo-2010`): `~/.claude/plans/eager-puzzling-wren.md`.
Plano da edição Censo 1991 (quarta edição, branch `censo-1991`): `~/.claude/plans/elabore-um-plano-para-warm-hartmanis.md`. Essa edição não tem deslocamento pendular e os microdados chegam em DBF — a conversão para largura fixa é feita por `scripts/prep_1991.py` antes do pipeline, a partir do symlink `data/raw1991`.
Convenções para trabalhar com múltiplas edições/censos (layout por edição, overrides de SQL, recortes retroativos, vocabulários) e guia para incluir uma edição nova: `docs/EDICOES.md`.

## Regras de sigilo (não negociáveis)

Os microdados em `data/raw` são de **acesso controlado** do IBGE (Censo 2022). Isso impõe:

1. **Nunca imprimir registros individuais** dos CSV/Parquet de `data/raw` ou `data/interim` em saída de ferramenta. Proibido: `head -n <N>` além do cabeçalho, `SELECT * ... LIMIT`, `cat` de linhas de dados, prints de linhas de DataFrame. Permitido: esquemas (`DESCRIBE`), contagens, somas de peso, distribuições de frequência agregadas com `n ≥ 5`.
2. **Nada de `data/raw`/`data/interim` sai da máquina**: não colar trechos em prompts, não enviar a subagentes remotos/nuvem, não publicar em Artifact. Subagentes locais recebem só instruções e caminhos, nunca conteúdo dos arquivos.
3. `data/processed` só é copiado para `web/public/data` ou commitado depois de passar por `pipeline/disclosure_check.py` (regras R1–R9, ver `docs/METODOLOGIA.md`).
4. `.gitignore` e o hook `pre-commit` bloqueiam `data/raw`, `data/interim`, `data/geo/raw`, qualquer `*.csv` e `docs/termos/*`. Não contornar esses bloqueios.
5. Em caso de dúvida sobre se uma saída individualiza alguém, tratar como individualizante e não publicar.
6. **`data/processed` é versionado (F7), mas só via o gate.** Diferente de `data/raw`/`data/interim`, `data/processed/**` (parquet, json, `geo/*.topojson`, `geo/*.parquet`, `.gate_ok`) é commitado no repositório — é o agregado já aprovado que o CI usa para publicar o site sem precisar de acesso aos microdados. O hook `pre-commit` roda `pipeline/verify_gate.py` automaticamente sempre que houver arquivo de `data/processed` no stage e bloqueia o commit se ele reprovar. Nunca commitar `data/processed` sem rodar `disclosure_check.py` antes.

## Caminhos

- Microdados brutos: `data/raw` (symlink) → `<UF>/Pessoas_<UF>_controlado.csv`, `Domicilios_*`, `Familia_*`, `Mortalidade_*`.
- Rótulos/códigos (públicos, gerados): `pipeline/labels.py` (regenerar com `python pipeline/gen_labels.py data/raw`).
- Malha municipal 2022 (shapefile IBGE): `data/geo/raw/BR_Municipios_2022.{shp,dbf,shx,prj,cpg}`.
- Dados intermediários: `data/interim` (Parquet, gitignored). Dados publicáveis: `data/processed` (Parquet/JSON/TopoJSON, **versionado no git**, só depois do gate — ver `.gate_ok` e `pipeline/verify_gate.py`).
- Metodologia: `docs/METODOLOGIA.md`. Termos de acesso (fora do repo): `docs/termos/`.
- SEO/páginas estáticas: `docs/SEO.md` (estratégia) e `pipeline/build_paginas.py` (gerador, lê só `data/processed`, escreve em `web/dist`).

## Comandos

```bash
source .venv/bin/activate          # Python 3.14 + duckdb, pyarrow, pandas, openpyxl, pytest
python pipeline/run.py             # orquestra as etapas do pipeline (a implementar por fase)
python pipeline/validate.py        # testes de consistência (ver plano, seção Verificação)
python pipeline/disclosure_check.py --versao <v>  # gate de revelação R1–R9; grava data/processed/.gate_ok (JSON: versão, timestamp, SHA-256 de cada arquivo publicável)
python pipeline/verify_gate.py       # confere o carimbo do gate de forma independente, SEM microdados (roda no CI e em qualquer clone)
./geo/build.sh                     # malha 2022 -> TopoJSON (municípios + UF), dado público
python pipeline/build_centroids.py # centroides via extensão espacial do DuckDB
python pipeline/build_meta.py      # data/processed/meta.json (rótulos, cortes, limiares)
npm run dev --prefix web             # servidor de desenvolvimento do atlas (porta 5174)
npm run sync-data --prefix web       # copia data/processed -> web/public/data (exige .gate_ok)
npm run copy-duckdb --prefix web     # copia o runtime do DuckDB-WASM para web/public/duckdb
npm test --prefix web                # testes do front-end (vitest)
SITE_URL=https://<dominio> npm run build:site --prefix web  # vite build + páginas estáticas de SEO (exige SITE_URL)
python pipeline/build_paginas.py [--producao] [--out DIR]    # gerador de páginas de SEO (ver docs/SEO.md); roda depois de `vite build`, escreve em web/dist
```

## Orquestração de modelos

Duas convenções convivem no repo:

- **Plano original (Censo 2022, F0–F7)**: troca manual do modelo da sessão (`/model`) por fase —
  ver plano, seção "Orquestração de modelos Claude". Sonnet 5 para implementação; Opus 5 para
  metodologia, SQL de classificação/variância, arquitetura e crítica de design; Fable 5.1 só nos
  pontos mais difíceis; Haiku 4.5 via subagente para tarefas mecânicas.
- **A partir da edição Censo 2010**: alternância **automática** via subagentes de modelo fixo em
  `.claude/agents/` — a sessão principal roda em Sonnet 5 e despacha para:
  - `metodologo` (Opus 5) — decisões metodológicas: classificação de migração/pendular no SQL,
    comparabilidade entre censos, regras de revelação, texto de `docs/METODOLOGIA.md`.
  - `implementador` (Sonnet 5) — código com especificação já definida: parametrização do
    pipeline por edição, geo, componentes React/TypeScript, CI.
  - `mecanico` (Haiku 4.5) — tarefas mecânicas bem especificadas: parsear planilhas de
    labels/layout, testes a partir de spec, comparação de layouts, substituições de texto.
  - `auditor` (Fable 5.1) — só nos checkpoints de maior risco: coerência estatística de uma
    extração/classificação nova, ou crítica final de UX/design/texto.
  Use esses agentes (Agent tool, `subagent_type`) em vez de trocar `/model` manualmente.

## Convenções de código

- SQL do pipeline em `pipeline/sql/NN_nome.sql`, executado por DuckDB via `pipeline/run.py`.
- Códigos de município/UF sempre como `VARCHAR` com zero-padding (7 e 2 dígitos) — nunca `INTEGER` (perde zeros à esquerda).
- Toda tabela de saída em `data/processed` inclui `n` (contagem amostral não ponderada) e, quando aplicável, `se`/`cv`.
- Web: TypeScript estrito, componentes funcionais, estado da seleção (`origem`, `destino`, `metrica`, `nivel`, `filtros`) refletido na URL.
