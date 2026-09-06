# CLAUDE.md — Atlas da Migração Interna no Brasil (Censo 2022)

Convenções para qualquer sessão Claude Code neste projeto. Ler antes de começar a trabalhar.
Plano completo: `PLANO_Atlas_Migracao_Censo2022.pdf` (raiz) e `~/.claude/plans/atue-como-um-dem-grafo-polished-crescent.md`.

## Regras de sigilo (não negociáveis)

Os microdados em `data/raw` são de **acesso controlado** do IBGE (Censo 2022). Isso impõe:

1. **Nunca imprimir registros individuais** dos CSV/Parquet de `data/raw` ou `data/interim` em saída de ferramenta. Proibido: `head -n <N>` além do cabeçalho, `SELECT * ... LIMIT`, `cat` de linhas de dados, prints de linhas de DataFrame. Permitido: esquemas (`DESCRIBE`), contagens, somas de peso, distribuições de frequência agregadas com `n ≥ 5`.
2. **Nada de `data/raw`/`data/interim` sai da máquina**: não colar trechos em prompts, não enviar a subagentes remotos/nuvem, não publicar em Artifact. Subagentes locais recebem só instruções e caminhos, nunca conteúdo dos arquivos.
3. `data/processed` só é copiado para `web/public/data` ou commitado depois de passar por `pipeline/disclosure_check.py` (regras R1–R9, ver `docs/METODOLOGIA.md`).
4. `.gitignore` e o hook `pre-commit` bloqueiam `data/raw`, `data/interim`, `data/geo/raw`, qualquer `*.csv` e `docs/termos/*`. Não contornar esses bloqueios.
5. Em caso de dúvida sobre se uma saída individualiza alguém, tratar como individualizante e não publicar.

## Caminhos

- Microdados brutos: `data/raw` (symlink) → `<UF>/Pessoas_<UF>_controlado.csv`, `Domicilios_*`, `Familia_*`, `Mortalidade_*`.
- Rótulos/códigos (públicos, gerados): `pipeline/labels.py` (regenerar com `python pipeline/gen_labels.py data/raw`).
- Malha municipal 2022 (shapefile IBGE): `data/geo/raw/BR_Municipios_2022.{shp,dbf,shx,prj,cpg}`.
- Dados intermediários: `data/interim` (Parquet, gitignored). Dados publicáveis: `data/processed` (Parquet/JSON, só após o gate).
- Metodologia: `docs/METODOLOGIA.md`. Termos de acesso (fora do repo): `docs/termos/`.
- SEO/páginas estáticas: `docs/SEO.md` (estratégia) e `pipeline/build_paginas.py` (gerador, lê só `data/processed`, escreve em `web/dist`).

## Comandos

```bash
source .venv/bin/activate          # Python 3.14 + duckdb, pyarrow, pandas, openpyxl, pytest
python pipeline/run.py             # orquestra as etapas do pipeline (a implementar por fase)
python pipeline/validate.py        # testes de consistência (ver plano, seção Verificação)
python pipeline/disclosure_check.py  # gate de revelação R1–R9 antes de publicar
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

Ver plano, seção "Orquestração de modelos Claude": Sonnet 5 para implementação (F0/F1/F3/componentes de F4-F5-F5b/F7); Opus 5 para metodologia, SQL de classificação/variância, arquitetura e crítica de design (F2/F2b/F6); Fable 5.1 só nos pontos mais difíceis; Haiku 4.5 via subagente para tarefas mecânicas (labels, testes a partir de spec, relatórios).

## Convenções de código

- SQL do pipeline em `pipeline/sql/NN_nome.sql`, executado por DuckDB via `pipeline/run.py`.
- Códigos de município/UF sempre como `VARCHAR` com zero-padding (7 e 2 dígitos) — nunca `INTEGER` (perde zeros à esquerda).
- Toda tabela de saída em `data/processed` inclui `n` (contagem amostral não ponderada) e, quando aplicável, `se`/`cv`.
- Web: TypeScript estrito, componentes funcionais, estado da seleção (`origem`, `destino`, `metrica`, `nivel`, `filtros`) refletido na URL.
