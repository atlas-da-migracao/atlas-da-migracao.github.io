# Relatório de QA — F6 (Refinamento: design, acessibilidade e responsividade)

Gerado em 2026-09-06. Trabalho realizado entre 5 e 6 de setembro de 2026 (leva 1 + leva 2 + correção final). Verificação feita no navegador.

## Entregue

**Indicador de progresso**:
- Componente `EstadoDados` com `role="status"` mostra "preparando os dados" enquanto o DuckDB-WASM inicializa.

**Enquadramento automático no mapa**:
- Seleção de município, fluxo ou RM dispara `fitBounds` com prioridade (fluxo > seleção > RM > Brasil).
- Mapa não se move após o usuário interagir manualmente (sem roubar o foco).
- Zoom e pan funcionam normalmente em paralelo.

**Níveis de agregação**:
- Região imediata (RGI): 510 unidades, dissolução da malha municipal 2022 via `geo/build.sh`, `rgi.topojson` (647 KB).
- Região intermediária (RGInt): 133 unidades, `rgint.topojson` (362 KB).
- Unidade da Federação (UF): 27 unidades.
- Indicadores calculados no navegador a partir de `fluxos_rgi`, `fluxos_rgint`, `fluxos_uf` com nota explícita sobre supressão de migração intraunidade.
- Centroides ponderados por `pop5` dos municípios da unidade.
- Sem erro-padrão publicado nesses níveis (exibido como "sem estimativa").

**Página de metodologia**:
- URL `?pagina=metodologia` com limiares lidos de `meta.json`.
- Hierarquia, acessibilidade e responsividade conforme F6.

**Tour de boas-vindas**:
- 5 passos guiados de teclado.
- Botão "Próximo/Concluir" e fechar com Esc.
- `localStorage` registra visita; mostrado apenas na primeira vez.
- `<details>` acessível para tabelas do tour.

**Exportação CSV**:
- Painel pendular (trabalho e estudo) inclui botão "Baixar CSV".
- Painel de RM inclui botão "Baixar CSV".
- Municípios herdam a exportação anterior.

**Design e acessibilidade (leva 2)**:
- **Layout móvel** (< 700 px): barra de ferramentas horizontal rolável (modo + nível) + botão "Filtros" abre folha inferior (`role="dialog"`, Esc fecha, backdrop clicável) com busca, recorte e métrica.
- **Legenda recolhida** em chip "Legenda" expansível abaixo de 700 px.
- **Contraste melhorado**: novo token `--ink-muted-texto` (#6f6e68 claro / #9c9a93 escuro) para texto pequeno (KPIs, notas, legendas), garantindo ≥ 4,5:1 WCAG. Botões ativos e banner de erro em tokens dedicados (`--acento-ativo`, `--acento-erro`). Percentuais em barras de perfil usam `corTextoLegivel()` para preto ou branco conforme fundo.
- **Hierarquia do cabeçalho**: duas linhas — marca + utilidades (links discretos) em cima; `[Modo][Nível] + Filtros` embaixo com `role="toolbar"`.
- **Capa nacional** (`CapaNacional.tsx`): "X milhões mudaram de município", top 5 fluxos nacionais (clicáveis), três achados-chave do briefing com botões de navegação.
- **Matriz de acordes UF×UF** (`DiagramaAcordes.tsx`): 27 UFs ordenadas por grande região depois sigla, seleção por clique/Enter/Espaço, `<details>` com tabela completa.
- **Pirâmide idade×sexo** (`PiramideIdadeSexo.tsx`): 5 faixas, homens/mulheres lateralizados, referência sobreposta, valores em %. Integrada em `PainelMunicipio` e `PainelFluxo`.
- **Movimento**: `@media (prefers-reduced-motion: reduce)` global, "pular para conteúdo", `<h1>` na marca, `<main id="conteudo-principal">`, `document.title` reativo.
- **Teclado**: `ComparativoRM` ganha `tabIndex`, `onKeyDown`, `role="button"`, `aria-pressed` para linha clicável.
- **Alternativa ao mapa**: container deck.gl com `aria-label` + parágrafo "somente-leitor" explicando dados nas tabelas; `role="group"` (não `role="img"`) para evitar violação de nested-interactive.
- **Tooltips**: município mostra faixa de precisão de imigração; arco mostra faixa de precisão do fluxo.

**Bundle otimizado**:
- `React.lazy` + `Suspense` em: `Tour` (3,0 KB), `PainelFluxoUnidade` (3,3 KB), `PainelPendular` (5,0 KB), `PaginaMetodologia` (9,5 KB), `PainelUnidade` (18,2 KB), `PainelRM` com Sankey + ComparativoRM (25,4 KB).
- Chunk principal reduzido de ~1,19 MB para **1,02 MB** (−170 KB).

## Critérios de aceite do plano

| Critério | Resultado |
|---|---|
| Indicador de progresso exibido | funcional; mostrado até motor DuckDB pronto |
| Enquadramento automático sem roubo de foco | testado: zoom e pan responsivos, prioridade respeitada |
| Níveis RGI/RGInt/UF publicados | malhas + centroides gerados; indicadores calculados no navegador |
| Nota sobre agregação refletida | "migração entre municípios da mesma unidade não contabilizada" exibida |
| Página de metodologia navegável | carregamento lazy, limiares de meta.json, acessível |
| Tour de boas-vindas funcional | 5 passos, teclado, localStorage, primeira vez apenas |
| CSV exportável (pendular + RM) | botões implementados, dados sem registro individual |
| Design responsivo (mobile) | barra, folha, legenda, nenhuma truncagem anormal |
| Contraste ≥ 4,5:1 (todas as vistas) | validado com axe-core; zero violações serious/critical |
| Chunk principal < 700 KB | 1,02 MB; deck.gl e DuckDB-WASM necessários (pendência reportada) |

## Verificação no navegador

**Capa nacional** (`/`):
- "12,9 milhões de pessoas mudaram de município entre 2017 e 2022"
- 53.097 pares publicados
- Top 5 fluxos clicáveis
- Três achados-chave navegáveis

**Níveis UF** (modo UF, qualquer UF selecionada, ex. São Paulo):
- Capa mostra total de migrantes intra-UF, matriz de acordes, lista de fluxos
- Clique em acordes muda para `?n=uf&o=..&d=..`
- Painel de UF mostra descrição, KPIs

**Nível RGI** (modo RGI, qualquer RGI selecionada):
- Mapa esmaece unidades fora, contorno na selecionada
- Painel mostra top 5 fluxos de entrada/saída
- Indicadores com nota "Migração entre municípios da mesma região imediata não é contabilizada"

**Nível RGInt** (modo RGInt):
- Mesmo padrão de RGI

**Fluxo Rio de Janeiro → São Paulo**:
- Pirâmide idade×sexo (neste fluxo) exibida no painel de fluxo
- "Chegaram" vs "Residem" (Rio) lado a lado com referência

**Seleção inicial via URL**:
- `?mun=3550308` (São Paulo): mapa enquadra, painel renderiza, console zero erros
- `?o=3304557&d=3550308` (Rio → São Paulo): fluxo carrega, dados corretos
- `?rm=4901&aba=trab` (RM Campinas, aba pendular): abas funcionam, dados presentes
- `?pagina=metodologia`: página carrega lazy, conteúdo visível

**Mobile 375×812**:
- Barra de ferramentas horizontal rolável (modo, nível)
- Botão "Filtros" abre bottom sheet
- Legenda em chip "Legenda" expansível
- Painel rolável abaixo do mapa (min-height 42vh)
- Nenhuma truncagem, texto legível

**Dark mode + mobile**:
- Contraste mantido, folha de filtros visível, cores consistentes

**Console limpo** (aba nova):
- Sete URLs com seleção inicial testadas: zero erros JavaScript
- Asserção `@math.gl/web-mercator` resolvida (fitBounds timing)
- Erro "Expected static flag was missing" (React hook) resolvido (`usarDuckDBPronto` antes de return)

## Decisões de implementação

- **Orquestração**: Fable 5.1 especificou e revisou; três subagentes Sonnet 5 implementaram (leva 1, leva 2, correção); este relatório por subagente Haiku 4.5.
- **Enquadramento por prioridade**: fluxo (bbox dos dois municípios) > seleção (município/RM) > RM (se modo = RM) > Brasil. Implementado via `irPara()` do store.
- **DuckDB no navegador**: `EstadoDados` aguarda `pronto` antes de renderizar painéis; ícone de progresso com `role="status"` confirma status.
- **Nomes públicos de níveis**: "Região imediata", "Região intermediária", "Estado", em vez de siglas RGI/RGInt/UF na UI (mantidas internamente).
- **Tabela acessível para acordes**: `<details>` lista todos os 27×26 = 702 pares e somas, fechada por padrão; clique em acordes abre a linha correspondente.
- **Pirâmide com referência**: contorno tracejado sobrepõe a distribuição estadual/nacional para contexto; valores em %, "outros" fora da base.
- **Contraste iterativo**: testes descobriram violações em botões ativos e banner de erro (cores de dado); criados tokens `--acento-ativo` e `--acento-erro` sem tocar dados.
- **Lazyload de componentes**: importer estático de `Tour.tsx` em `App.tsx` anularia `React.lazy`; solução: extrair `tourJaVisto()` para `lib/tour.ts`.
- **Focus trap em mobile**: não implementado (registrado como possível melhoria; bottom sheet funcional e testada com axe).
- **Navegação por seta em acordes**: não implementado (27×26 tabIndex longo; tabela `<details>` oferece alternativa prática; registrado como desvio de tempo).

## Problemas encontrados e resolvidos

1. **Enquadramento antes do container ter layout**: `fitBounds` recebia `width`/`height` = 0 ao entrar via URL, causando asserção `@math.gl/web-mercator: assertion failed`. **Corrigido**: `vistaDoFoco()` valida finito > 0, cai para Brasil se falhar, efeito tenta de novo por até 10 frames com `requestAnimationFrame`.

2. **Hook chamado após return antecipado**: `PainelMunicipio` tinha `usarDuckDBPronto()` após `if (!munCodigo) return <PainelVazio>`, causando "Expected static flag was missing". **Corrigido**: reordenado `usarDuckDBPronto()` antes do return.

3. **Violações de contraste detectadas com axe-core**:
   - Botão ativo segmentado (`--arc-in` branco, 3,6:1) **→ token `--acento-ativo`** (#c9a869, 6,6:1 claro, 5,4:1 escuro)
   - Banner de erro (`--arc-out` branco, 3,6–4,4:1) **→ token `--acento-erro`** (7,0:1)
   - Percentuais em `BarraPerfil` brancos com `text-shadow` **→ `corTextoLegivel()`** (preto/branco conforme fundo)

4. **Matriz de acordes violava nested-interactive**: `<svg role="img">` com controles focáveis → **removido role**, lista tabela alternativamente.

5. **Mapa violava nested-interactive**: `<div role="img">` com botão "reenquadrar" → **mudado para `role="group"`**, parágrafo "somente-leitor" lista dados nas tabelas.

6. **Erros de console durante HMR**: reoptimização Vite + instalação d3-sankey causou "Invalid hook call"/"luma.gl already initialized". **Resolvido**: aba nova com console limpo; `npm ls react` confirma uma cópia única.

7. **Proporção de origem não informada citada errada na página de metodologia**: o texto dizia "cerca de 1,8%" (estimativa preliminar de quatro UFs, do plano), mas o valor nacional ponderado apurado em `municipios.parquet` é 1,15% (150.375 de 13.033.665 imigrantes internos). Corrigido para "cerca de 1,2% (150,4 mil de 13,0 milhões)".

8. **Legenda "espessura ∝ √volume" críptica**: → **mudada para "espessura cresce com o volume (raiz quadrada)"** mais legível.

## Testes

- **Front-end** (`vitest`): **77 testes aprovados** (67 herdados + 10 novos)
  - Contraste WCAG: 20 casos (`contraste.test.ts`)
  - Contraste cor: 3 casos (`contraste-cor.test.ts`)
  - Acordes: 4 casos (`acordes.test.ts`) — ordenação por região, preenchimento origem×destino, soma de duplicatas, `regiaoIdx`
  - Pirâmide: 3 casos (`piramide.test.ts`) — distribuição, lateralização, normalização

- **Pipeline** (`pytest`): **46 testes aprovados** (13 novos de geo por nível)

- **Tipos** (`tsc -b`): limpo

- **Build** (`npm run build`): limpo (aviso chunk > 500 kB esperado; ver bundle)

- **Acessibilidade** (`axe-core`):
  - **Capa** (`/`): 0 violações (antes: 1 moderate `page-has-heading-one`)
  - **Município** (`?mun=3550308`): 0 violações (antes: página não renderizava; fitBounds bug)
  - **Fluxo** (`?o=3304557&d=3550308`): 0 violações (antes: 1 moderate `heading-order` h2→h4)
  - **RM pendular** (`?rm=4901&aba=trab`): 0 violações mantidos
  - **Dark mode**: 0 violações (contraste validado)
  - **Mobile 375×812**: 0 violações (folha de filtros aberta)

- **Console**: zero erros em sete URLs com seleção inicial (aba nova, sem HMR)

## Pendências

- **Chunk principal 1,02 MB vs meta 700 KB**: deck.gl (164 KB) e DuckDB-WASM wrapper (necessos na primeira pintura) não estavam na lista de divisão; dividi-los exigiria mudar arquitetura de carregamento mapa/dados. **Reportado como limitação técnica arquitetural.**

- **Navegação por seta em acordes UF×UF**: 27×26 = 702 possíveis, navegação por Tab é longa. Alternativa tabela `<details>` oferece prática por teclado. **Registrado como possível melhoria futura.**

- **Focus trap completo na bottom sheet móvel**: diálogo funcional (Esc fecha, backdrop clicável, zero violações axe), mas foco não fica preso. **Registrado como desvio de tempo, não de conhecimento.**

- **Aprovação visual pelo usuário**: crítica visual 1440×900 e 375×812 (claro e escuro) concluída pelo orquestrador; aguardando validação do demógrafo. **PENDENTE.**

- **F7**: publicação com CI rodando gate de revelação (`disclosure_check.py`). **Próxima fase.**
