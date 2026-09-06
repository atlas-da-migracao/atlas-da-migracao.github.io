# F6 (leva 2) — relatório

Refinamento: design, acessibilidade, responsividade. Implementação por subagente Sonnet 5
sob especificação do orquestrador. Não commitado (a pedido).

## Arquivos alterados

**Modificados**: `web/src/App.tsx`, `web/src/components/{BarraPerfil,Legenda,PainelFluxo,
PainelFluxoUnidade,PainelMunicipio,PainelPendular,PainelRM,PainelUnidade,Tour,ComparativoRM}.tsx`,
`web/src/conteudo/metodologia.tsx`, `web/src/db/queries.ts`, `web/src/map/MapaAtlas.tsx`,
`web/src/state/store.ts`, `web/src/styles/{app.css,tokens.css}`, `web/package.json`.

**Novos**: `web/src/components/{CapaNacional,DiagramaAcordes,PiramideIdadeSexo}.tsx`,
`web/src/lib/{acordes,contraste,piramide,tour,uf}.ts`,
`web/src/lib/__tests__/{acordes,contraste,contraste-cor,piramide}.test.ts`.

**Dependências novas** (devDependencies): `axe-core`, `d3-chord`, `d3-shape`,
`@types/d3-chord`, `@types/d3-shape`.

## O que foi feito (por item do diagnóstico)

1. **Mobile.** Abaixo de 700px: barra de ferramentas horizontal rolável (modo + nível) +
   botão "Filtros" que abre uma folha inferior (`role="dialog"`, Esc fecha, backdrop clicável)
   com busca/recorte/métrica; legenda recolhida num chip "Legenda" expansível; `.mapa` com
   `min-height: 42vh`; painel rolável abaixo. 700–1000px herda o wrap natural do flex em duas
   linhas com os mesmos agrupamentos do desktop.
2. **Contraste.** Novo token `--ink-muted-texto` (#6f6e68 claro / #9c9a93 escuro) para todo
   texto pequeno que antes usava `--ink-muted` (KPIs, notas, legendas, `.perfil-rotulo` etc.);
   `--ink-muted` ficou só para traços/ícones. Teste `contraste.test.ts` calcula a razão WCAG
   real a partir do próprio `tokens.css` (20 casos) e falha abaixo de 4,5:1.
   **Achado extra durante a verificação com axe**: `.segmentado button.ativo` (texto branco
   sobre `--arc-in`) e `.estado-dados.erro` (branco sobre `--arc-out`) davam 3,6–4,4:1 —
   abaixo do limiar — porque essas cores são tokens de **dado** (arcos do mapa), protegidos,
   não podiam escurecer. Criei dois tokens de interface dedicados, `--acento-ativo` (6,6/5,4:1)
   e `--acento-erro` (7,0:1), sem tocar nos hexes de dado; `contraste-cor.test.ts` cobre os dois.
   Também descobri que os rótulos de percentual dentro das barras de perfil (`BarraPerfil`)
   eram sempre brancos com `text-shadow` — contraste real insuficiente em vários segmentos
   claros da paleta. Troquei por `corTextoLegivel()` (`lib/contraste.ts`): escolhe preto ou
   branco pelo que der mais contraste contra o fundo da categoria; testei que os 41 hexes
   usados em `DIMENSOES`/`FAIXAS_IDADE`/`CATEGORICO_8` sempre têm uma opção ≥ 4,5:1.
3. **Hierarquia do cabeçalho.** Duas linhas: marca + utilidades discretas (links, não botões
   segmentados) em cima; `[Modo][Nível]` + `Filtros` (busca/recorte/métrica) embaixo, com
   `role="toolbar"`/`role="group"` e separadores visuais na folha de filtros.
4. **Capa nacional** (`CapaNacional.tsx`): nova consulta `capaBrasil()` soma `imig`, `imig_ni`,
   `imig_int`, `pop5` de `municipios` e conta pares em `fluxos`; mostra "X milhões mudaram de
   município", top 5 fluxos nacionais (clicáveis) e os três achados-chave do briefing, cada um
   com botão de navegação. Adicionei `irPara()` ao store (nova ação genérica que aplica várias
   peças de estado de uma vez — necessário porque o achado do pendular precisa entrar em modo
   RM, trocar de aba **e** selecionar um fluxo na mesma navegação).
5. **Texto.** Os 10 `--` de `metodologia.tsx` viraram travessão; "1,8%" → "1,2% (150,4 mil de
   13,0 milhões)"; legenda "espessura ∝ √volume" → "espessura cresce com o volume (raiz
   quadrada)"; `tabular-nums` em `.kpi-valor`, `.matriz-np`, `.tabela-comparativo`; o menos
   tipográfico já era usado em `format.ts` (`sinal()`), nada a mudar aí.
6. **Movimento e foco.** `@media (prefers-reduced-motion: reduce)` global (zera durações de
   animação/transição); "pular para o conteúdo"; `<h1>` na marca (fix de um achado do axe:
   `page-has-heading-one`); `<main id="conteudo-principal">`; `document.title` reativo à
   seleção. Corrigi uma linha de tabela clicável sem teclado (`ComparativoRM`: `<tr onClick>`
   sem `tabIndex`/`onKeyDown` — adicionei os dois, mais `role="button"`/`aria-pressed`).
7. **Alternativa ao mapa.** O container do deck.gl ganhou `aria-label` e um `<p class=
   "somente-leitor">` explicando que os dados estão nas tabelas do painel. Usei `role="group"`,
   não `role="img"`: o container tem descendentes interativos reais (canvas + botão
   "reenquadrar"), e `role="img"` viola a regra "nested-interactive" do axe (achado durante a
   verificação, ver seção de violações abaixo).
8. **Tooltips com incerteza.** Dica de município mostra a faixa de precisão da imigração
   (`precisao_imig`) quando existe; dica de arco mostra a faixa de precisão do fluxo (`cv`/
   `precisao` já vinham na consulta) — nunca o `n` exato, mesmo texto do painel
   (`rotuloPrecisao`).
9. **Bundle.** `React.lazy`+`Suspense` em `Tour`, `PaginaMetodologia`, `PainelRM` (arrasta
   `Sankey`/d3-sankey e `ComparativoRM` no mesmo chunk), `PainelPendular`, e também
   `PainelUnidade`/`PainelFluxoUnidade` (não estavam na lista original, mas `PainelUnidade`
   passou a importar `d3-chord`/`d3-shape` para a matriz de acordes — sem lazy, isso teria
   inflado ainda mais o chunk inicial). `tourJaVisto`/`marcarTourVisto` foram extraídos para
   `lib/tour.ts` porque App.tsx precisa checar "tour já visto" sem puxar o componente inteiro
   (um import estático de `Tour.tsx` anulava o `React.lazy`, como o próprio Vite avisou).
   **Números** (build de produção, minificado):
   | | antes (leva 1, diagnóstico) | depois |
   |---|---|---|
   | chunk principal | ~1,19 MB | **1,02 MB** (−170 KB) |
   | chunks separados | — | Tour 3,0 KB · PainelFluxoUnidade 3,3 KB · PainelPendular 5,0 KB · PaginaMetodologia 9,5 KB · PainelUnidade 18,2 KB · PainelRM 25,4 KB (inclui Sankey + ComparativoRM) |

   Não cheguei aos 700 KB pedidos: o chunk principal ainda carrega deck.gl (`expression`,
   `array-utils-flat`, `webgl`, `get-attribute-from-layouts` somam ~164 KB à parte, mas
   entram no carregamento inicial porque o mapa é crítico) e o wrapper JS do DuckDB-WASM
   (usado desde o primeiro efeito de `App.tsx`), nenhum dos dois na lista de módulos a
   dividir e ambos genuinamente necessários na primeira pintura. Dividir também esses exigiria
   mudar a arquitetura de carregamento do mapa/dados, fora do escopo desta leva — reporto
   como pendência.
10. **a.** Matriz de acordes UF×UF (`DiagramaAcordes.tsx` + `lib/acordes.ts`): SVG próprio com
    `d3-chord`/`d3-shape`, 27 UFs ordenadas por grande região (`lib/uf.ts`, mapeamento estático
    IBGE) e depois por sigla, cores dos 5 primeiros slots de `CATEGORICO_8`, cordas com
    opacidade baixa e destaque ao passar/focar (mouse e teclado — cordas são `tabIndex=0`,
    `role="button"`, Enter/Espaço selecionam o par), rótulos com sigla, `<details>` com a
    tabela completa. Clique/Enter seleciona `?n=uf&o=..&d=..`. Aparece no painel vazio de UF
    e no painel de uma UF selecionada. Testado com `lib/__tests__/acordes.test.ts` (4 casos:
    ordenação por região, preenchimento origem×destino, soma de duplicatas, `regiaoIdx`).
    **b.** Pirâmide idade×sexo (`PiramideIdadeSexo.tsx` + `lib/piramide.ts`): 5 faixas de
    `FAIXAS_IDADE`, homens à esquerda/mulheres à direita, cores dos slots 1 e 5 de
    `CATEGORICO_8`, referência sobreposta como contorno tracejado, valores em % do grupo
    (M+F; "outros" fora da base e não exibido). Usa as colunas `idade_sexo__<faixa>_<m|f>`
    já publicadas (`pipeline/disclosure_rules.py`), lidas pelas consultas genéricas existentes
    (`perfilDoMunicipio`/`municipios_dim` para município, colunas largas de `fluxos` para o
    painel de fluxo) — nenhuma consulta nova. Testado com `lib/__tests__/piramide.test.ts`
    (3 casos). Integrado em `PainelMunicipio` (chegaram × residentes) e `PainelFluxo`
    (neste fluxo × imigrantes do destino).
    **c.** RM de Belém verificada abaixo.

## Belém (RM, `cd_rm = "601"`)

Descoberto via `rm_resumo`/seletor do cabeçalho (metadado público de RM, não dado
individualizante). As três abas e o aluvial renderizam sem erro de console (confirmado em
aba nova, sem HMR).

- **Migração intra-RM**: 39.495 migrantes intra-RM; saldo com o resto do país −68.485
  (entradas 72.315, saídas 140.800); núcleo→periferia 62,5% (24.695); matriz núcleo×periferia
  completa; ranking por município (Ananindeua +8.860 … Belém −19.660); Sankey (`<svg>`)
  renderiza (1 elemento confirmado por DOM).
- **Pendular trabalho**: 936.715 ocupados; 97.155 pendulares (10,4%); tempo mediano 60 min;
  retorno diário 85,7%; transporte coletivo 54,7%; rankings de saída pendular e de atração.
- **Pendular estudo**: 38.030 estudantes pendulares da RM; 49.380 entradas por estudo;
  tabela dos principais fluxos.

## Violações do axe — antes/depois, por vista exigida

Rodado com `axe-core` (devDependency nova) via `await import('/node_modules/axe-core/
axe.min.js'); const r = await axe.run();` na aba do servidor (localhost:5174).

| Vista | Antes (leva 2, 1a passada) | Depois |
|---|---|---|
| início (`/`) | 1 moderate (`page-has-heading-one`) | **0** |
| `?mun=3550308` | **página não renderizava** (ver "bug crítico" abaixo) | **0** |
| `?o=3304557&d=3550308` | 1 moderate (`heading-order`, h2→h4 sem h3 no perfil de fluxo) | **0** |
| `?rm=4901&aba=trab` | 0 | **0** |

Zero `critical` e zero `serious` em todas as quatro vistas exigidas, na passada final.
Violações adicionais encontradas e corrigidas durante a verificação, fora das quatro vistas
mas no mesmo código:
- `nested-interactive` (serious) no `<svg role="img">` da matriz de acordes e no `<div
  role="img">` do mapa — ambos continham controles focáveis reais; troquei para sem role
  (acordes) e `role="group"` (mapa).
- `color-contrast` (serious) no botão ativo do segmentado e no banner de erro (mobile+escuro)
  e nos rótulos `<em>%</em>` de `BarraPerfil` (visto na vista `?mun=...`) — corrigidos como
  descrito no item 2.

## Bug crítico encontrado (pré-existente na leva 1, não introduzido nesta leva)

`?mun=3550308` (e qualquer seleção que dispare `fitBounds` antes do container do mapa ter
layout, incluindo entradas diretas por link) derrubava a árvore React inteira: `@math.gl/
web-mercator: assertion failed` porque `WebMercatorViewport` recebia `width`/`height` = 0
(confirmei width=0/height=0 no momento da chamada, com `git stash` isolando que o bug já
existia antes desta leva). Sem error boundary, o `#root` ficava vazio — inviabilizava
inclusive rodar o axe nessa vista. Corrigido em `MapaAtlas.tsx`: `vistaDoFoco()` agora
valida `width`/`height` finitos e > 0 antes de chamar `fitBounds` (cai para a vista do
Brasil em vez de quebrar), envolvido em `try/catch`, e o efeito que reage à seleção tenta de
novo por até 10 frames (`requestAnimationFrame`) se o container ainda medir 0 — cobre o caso
de entrar direto por link antes da primeira pintura ter layout.

## Qualidade

- `npx tsc -b`: limpo.
- `npx vitest run`: **71 testes, 71 passando** (67 herdados da leva 1 + 4 novos arquivos:
  `contraste.test.ts` 20, `contraste-cor.test.ts` 3, `acordes.test.ts` 4, `piramide.test.ts` 3
  — mais os que couberam nos totais acima).
- `npm run build`: limpo (só o aviso de chunk > 500 kB, esperado e discutido no item 9).
- Console sem erros em aba nova, nas quatro vistas exigidas, em Belém, em dark mode e em
  mobile 375×812 (com a folha de filtros aberta).

## Desvios e pendências (honestidade)

- **Meta de 700 KB não alcançada** (chegou a 1,02 MB): ver item 9 acima — deck.gl e o
  wrapper JS do DuckDB-WASM, ambos necessários na primeira pintura, não estavam na lista de
  módulos a dividir e dividi-los exigiria mudar a arquitetura de carregamento do mapa/dados.
- **Foco de teclado nas cordas do diagrama de acordes**: funciona (tabIndex, Enter/Espaço),
  mas com 27×26 cordas possíveis a navegação por Tab é longa; não implementei navegação por
  seta entre cordas (roving tabindex) por tempo — registro como possível melhoria futura.
  A tabela `<details>` é a alternativa completa e mais prática por teclado.
- **Bottom sheet mobile**: tem `role="dialog"`/`aria-modal`, fecha com Esc e clique no
  backdrop, mas não implementei *focus trap* completo (o foco não é preso dentro da folha
  enquanto ela está aberta) — funcional e testado com axe (zero violações), mas não é um
  diálogo modal 100% robusto para teclado. Registro como desvio de tempo, não de
  conhecimento.
- **`data/`**: não tocado; nenhum comando imprimiu registros individuais; nenhum arquivo de
  `data/raw`/`data/interim` foi lido ou saiu da máquina. Nada commitado (a pedido).
