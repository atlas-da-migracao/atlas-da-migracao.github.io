# SEO — Atlas da Migração Interna no Brasil

Estratégia de descoberta orgânica implementada na fase F8, antes da publicação em GitHub
Pages. Resume o que foi feito, o que ficou como tarefa manual do autor, e o que foi
deliberadamente evitado.

## Diagnóstico

O atlas é uma SPA (React 19 + DuckDB-WASM): o `#root` fica vazio até o motor WASM (~8 MB)
baixar e inicializar, então rastreadores que não esperam JavaScript — ou que têm orçamento de
rastreamento curto — veem uma página quase sem conteúdo. Ao mesmo tempo, o valor do atlas está
concentrado em milhares de recortes territoriais (5.570 municípios, 510 regiões imediatas, 133
regiões intermediárias, 27 UFs, 81 regiões metropolitanas/RIDEs) que hoje só existem como
estado de uma única URL (`/`) com parâmetros de query.

## O que foi implementado

### 1. Páginas HTML estáticas geradas no build (`pipeline/build_paginas.py`)

Gerador Python + DuckDB + Jinja2 (autoescape ligado) que lê exclusivamente as tabelas já
aprovadas pelo gate de revelação em `data/processed` e escreve `web/dist/**/index.html` depois
de `vite build`. Nunca escreve em `web/public` (não infla o repositório com HTML gerado).

- **6.331 páginas** com URLs limpas e uma pasta por página (`/municipio/<slug>/`,
  `/uf/<sigla>/`, `/regiao-imediata/<slug>/`, `/regiao-intermediaria/<slug>/`,
  `/regiao-metropolitana/<slug>/`), mais os índices (`/municipios/`, `/ufs/`, `/regioes/`,
  `/regioes-metropolitanas/`) e as páginas de conteúdo fixo (`/achados/`, `/metodologia/`,
  `/glossario/`, `/dados/`, `/sobre/`, `/en/`).
- Cada página de município tem **conteúdo substantivo único**: abertura em prosa (população,
  saldo, taxa líquida, IEM, classificação), tabela de indicadores com IC 95% e faixa de
  precisão, 10 principais origens/destinos com link cruzado para a página do outro município
  e para o par no app (`/?o=&d=`), perfis de imigrantes/emigrantes/residentes (status,
  escolaridade, renda, idade×sexo), bloco pendular, link para a RM (se houver), nota
  metodológica e "como citar". Páginas de UF/RGI/RGInt somam os fluxos publicados entre
  unidades distintas (nunca recalculam nada fora das tabelas) e listam os municípios membros.
  Páginas de RM reproduzem a matriz núcleo×periferia, o cruzamento migração×trabalho e a lista
  de municípios com o núcleo destacado.
- `<title>` único (≤ 60 caracteres quando possível), `<meta name="description">` única
  (≤ 160), `<link rel="canonical">`, `robots: index,follow`, Open Graph + Twitter Card
  (`summary_large_image`, imagem `/og.png` gerada com Pillow — 1200×630, texto simples),
  JSON-LD `BreadcrumbList` + `WebPage` (`isPartOf` WebSite, `about` uma
  `AdministrativeArea`/`Place` com `identifier` = código IBGE e `containedInPlace`); a home e
  `/dados/` também publicam um `Dataset` (com `distribution` apontando para os Parquet
  publicados, `temporalCoverage`, `spatialCoverage`, `variableMeasured`).
- HTML semântico e leve (sem depender de JS), CSS próprio pequeno `/static.css` (derivado dos
  tokens de `tokens.css`, claro/escuro via `prefers-color-scheme`), tabelas com `<caption>`,
  `<th scope>` e `tabular-nums`. Cabeçalho comum com link para o app e para os índices,
  breadcrumbs, rodapé com fonte/aviso/metodologia/dados/sobre.
- `sitemap.xml` (particiona automaticamente se ultrapassar 45.000 URLs — não é o caso: 6.331),
  `robots.txt` (`Allow: /` + `Sitemap:` absoluto), `404.html` com busca por link para os
  índices (marcado `noindex`), `humans.txt`.
- **Nenhum truque de SEO**: sem keyword stuffing, sem páginas vazias/doorway, sem texto
  oculto, sem cloaking. Toda página traz a atribuição ao IBGE e o aviso padrão de
  `meta.json` (regra R9), e nenhuma sugere caráter oficial.
- **Sigilo preservado**: o gerador só lê `data/processed` (já passou pelo gate R1-R9:
  supressão, arredondamento a múltiplos de 5, contagens amostrais só em faixas). Nenhuma
  página imprime uma contagem amostral exata — testado por regex em
  `pipeline/tests/test_paginas.py`.

### 2. `web/index.html` com conteúdo indexável antes do React montar

Título, parágrafo do que é o atlas, os números nacionais já apurados (12,9 milhões de pessoas,
5.570 municípios, 53.097 pares publicados) e links para os índices — tudo dentro de `#root`,
substituído quando o React monta. Um `<footer id="rodape-estatico">` **fora** de `#root`
permanece visível mesmo depois da montagem. `<title>`, description, canonical, OG/Twitter,
JSON-LD `WebSite` (com `SearchAction` apontando para `/?q={search_term_string}`) e `Dataset`.

O `SearchAction` funciona de verdade: `web/src/App.tsx` lê `?q=` uma vez que os municípios
carregam, normaliza (sem acento/caixa, mesma lógica de `Busca.tsx`) e seleciona o primeiro
resultado — testado manualmente em `?q=guarulhos`.

### 3. Domínio configurável (`SITE_URL`)

O domínio final ainda não foi escolhido. `web/index.html` usa o placeholder literal
`__SITE_URL__`; um plugin mínimo em `web/vite.config.ts` (`transformIndexHtml`) o substitui
pelo valor de `SITE_URL` no build, com fallback para `https://EXEMPLO.invalid` (RFC 2606) fora
de produção. `pipeline/build_paginas.py --producao` **falha com mensagem clara** se `SITE_URL`
não estiver definido, para nunca publicar por engano com o domínio placeholder.

### 4. Integração de build

`npm run build:site` = `vite build && python3 ../pipeline/build_paginas.py --producao`
(documentado em `CLAUDE.md`). `vite.config.ts` tem `build.sourcemap: false` explícito e
`base: "/"`.

### 5. Auditoria

Lighthouse (`npx lighthouse`, Chrome headless, preset desktop) contra `vite preview` servindo
`web/dist`:

| Página | SEO | Acessibilidade | Boas práticas | Desempenho (desktop) |
|---|---|---|---|---|
| `/` | 100 | 100 | 100 | 91 |
| `/municipio/sao-paulo-sp-3550308/` | 100 | 100 | 96 | 100 |
| `/regiao-metropolitana/regiao-metropolitana-de-sao-paulo-4901/` | 100 | 100 | 96 | 100 |

Correção barata aplicada: faltava um favicon (`web/public/favicon.svg`, referenciado com
`<link rel="icon">` no `index.html` e em toda página estática) — o navegador tentava
`/favicon.ico`, gerando um 404 que zerava o audit "errors-in-console" de boas práticas; com o
favicon, `/` foi para 100/100/100/91.

Em mobile (rede/CPU emulados, throttled), o desempenho da home cai para 62 — decorrência do
bundle principal de ~1 MB (deck.gl + DuckDB-WASM na primeira pintura), já registrado como
limitação arquitetural conhecida em `docs/qa/F6_relatorio.md` ("Pendências"); não é uma
regressão desta fase, e corrigi-la exigiria redesenhar o carregamento do mapa/dados — fora do
escopo de F8 (SEO). SEO/Acessibilidade/Boas práticas seguem 100/100/100 em mobile.

Um verificador Python complementar roda como parte de `pipeline/tests/test_paginas.py`:
title/description únicos e presentes, canonical correto, JSON-LD válido, nenhum link interno
quebrado, sitemap cobrindo todas as páginas, tamanho médio de página.

### 6. Testes

`pipeline/tests/test_paginas.py` (17 testes, roda o gerador uma vez por sessão em diretório
temporário): contagens por tipo de página (5.570/27/510/133/81 + páginas fixas), title/
description/canonical presentes e corretos numa amostra, aviso padrão e atribuição ao IBGE em
toda página, JSON-LD válido (`json.loads`) com `BreadcrumbList` apontando corretamente para a
própria página, ausência de padrões de `n` exato, ausência de links internos quebrados,
sitemap cobrindo 100% das páginas, `robots.txt` correto, tamanho médio de página ≤ 40 KB
(medido: 21,4 KB), tempo de geração reportado (medido: ~11 s para as 6.331 páginas), e o
conteúdo estático + JSON-LD de `web/index.html`.

`pytest -q` na raiz: 63 testes aprovados (46 herdados + 17 novos). `npm run build:site` com
`SITE_URL=https://exemplo.invalid`: build completo em ~11 s de geração, sem erros.

## O que ficou para o usuário

- **Escolher e registrar o domínio final** e definir `SITE_URL` no ambiente de build/CI.
- **Google Search Console** e **Bing Webmaster Tools**: verificar a propriedade (recomendado
  por DNS, mais robusto que meta tag), enviar `sitemap.xml`, monitorar cobertura de indexação
  e Core Web Vitals.
- **Descrição e tópicos do repositório GitHub** (`about`, `topics`): usar palavras-chave como
  "censo-2022", "migração-interna", "ibge", "demografia", "brasil" para descoberta dentro do
  próprio GitHub.
- **DOI no Zenodo** (dados + código) — os placeholders de "como citar" em `/dados/` e nas
  páginas de município já têm o formato pronto para receber o DOI.
- **Licença dos dados publicados** — placeholder marcado em `/dados/`; a escolha (ex.: CC BY
  4.0) é do autor.
- **Autoria e contato** — placeholders em `/sobre/`, `/dados/` e no rodapé de cada página de
  município ("como citar").
- **Divulgação em listas e associações de demografia** (ex. ABEP) e redes acadêmicas — fora do
  escopo técnico deste projeto, mas é o canal com maior retorno esperado para tráfego
  qualificado de pesquisadores.
- **Registrar as páginas em serviços de indexação de dados** (ex. Google Dataset Search, que
  já é alimentado automaticamente pelo `Dataset` JSON-LD de `/dados/` e da home, uma vez que o
  site esteja no ar e indexado).

## O que foi deliberadamente evitado

- **Nenhum keyword stuffing** nem texto oculto (`display:none`, cor igual ao fundo etc.).
- **Nenhuma página doorway**: toda página de município/UF/RGI/RGInt/RM tem conteúdo real e
  distinto, derivado diretamente das tabelas publicadas — não um template raso repetido só
  trocando o nome.
- **Nenhum cloaking**: o HTML servido a rastreadores é exatamente o mesmo servido a um
  navegador comum (arquivos estáticos, sem user-agent sniffing).
- **Nenhuma alegação de caráter oficial**: toda página cita o IBGE como fonte dos microdados e
  deixa claro (aviso padrão de `meta.json`) que as estimativas são do autor, sujeitas a erro
  amostral, e podem divergir das tabulações oficiais (SIDRA).
- **Não se publicou nenhuma contagem amostral exata** nem qualquer dado fora do que já está em
  `data/processed` — o gerador não recalcula estatísticas novas, só formata, soma (nos níveis
  agregados, exatamente como o app interativo) ou tira intervalo de confiança (valor ±
  1,96×erro-padrão) a partir de colunas já publicadas.
- **Não se copiou `data/raw`/`data/interim`** para lugar nenhum do site nem do build; o
  gerador só abre `data/processed`.
- **Não se investiu em corrigir o bundle mobile de ~1 MB** nesta fase — é uma limitação
  arquitetural pré-existente e documentada (F6), e uma correção de fundo (code-splitting do
  deck.gl/DuckDB-WASM) está fora do escopo de SEO.
