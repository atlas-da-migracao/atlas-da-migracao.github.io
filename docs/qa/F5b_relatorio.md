# Relatório de QA — F5b (Módulo metropolitano)

Gerado em 2026-09-05. Verificação feita no navegador, com o servidor de desenvolvimento.

## Entregue

- **Modo "Regiões metropolitanas"** no cabeçalho, segmentado em Brasil | Regiões metropolitanas, com seletor de 81 RMs/RIDEs ordenado por população.
- **Estado da RM na URL** (`rm=`, `aba=mig|trab|estudo`, `cruzar=1`) — qualquer vista é compartilhável.
- **Mapa com enquadramento automático** (`fitBounds`) na RM selecionada, municípios fora esmaecidos, núcleo com contorno destacado. Botão "Ver a RM".
- **Painel de RM** (`PainelRM`) com três abas:
  - **Migração intra-RM**: KPIs, matriz núcleo×periferia 2×2, ranking de saldo intra-RM por município, arcos coloridos por tipologia, seleção abre `PainelFluxo`.
  - **Pendular trabalho**: KPIs, rankings por taxa de saída e índice de atração (filtrado a municípios com ≥ 1.000 ocupados), arcos intra-RM com opção de incluir fluxos que cruzam o limite, seleção abre novo `PainelPendular` com IC 95%, fluxo inverso, saldo pendular do par, tempo mediano, % retorno diário, % coletivo, barras 100% para frequência, modo, tempo, posição, setor, ocupação, renda do trabalho e escolaridade, comparadas com o fluxo inverso.
  - **Pendular estudo**: KPIs, arcos, painel com nível de ensino, bloco de migrantes intra-RM que estudam fora.
- **Sub-painel "Migrantes e trabalho"** com KPIs e diagrama aluvial de três colunas (morava em 2017 → mora em 2022 → trabalha em 2022) via d3-sankey, com tabela acessível em `<details>`.
- **Bloco "Onde trabalham"** no `PainelFluxo` quando o par pertence a uma RM, respondendo onde trabalham os migrantes intra-RM que fizeram aquele percurso.
- **Comparativo ordenável** das 20 maiores RMs (mig_intra, saldo externo, % pendular, tempo mediano, % coletivo); clique na linha troca a RM.
- **Espessura dos arcos normalizada** pelo maior fluxo em tela, entre 1,5 e 14 px, proporcional à raiz quadrada do volume, com indicação na legenda ("espessura ∝ √volume").

## Critérios de aceite do plano

| Critério | Resultado |
|---|---|
| Troca de RM em < 300 ms | **32–37 ms** (com DuckDB aquecido); primeira carga leva 5,4–5,8 s, dominada pela inicialização do DuckDB-WASM |
| Painel pendular soma ao total do fluxo | verificado: as barras usam as próprias categorias publicadas do par |
| Aluvial soma aos migrantes ocupados | tripla origem→residência→trabalho validada no pipeline (F2b); "outros" preserva o total |
| Supressão e CV respeitados | só faixas de n, rótulo de precisão com CV, mensagem padrão para fluxo sem detalhe |
| RMs revisadas sem erro | São Paulo, Rio de Janeiro, Belo Horizonte, Porto Alegre, Fortaleza, Recife, Curitiba, Salvador, Campinas, Goiânia, Manaus, Vale do Paraíba e Litoral Norte, RIDE do DF; valores idênticos aos do relatório F2b |

## Verificação no navegador

**RM de São Paulo** (console limpo em aba nova):
- 477.425 migrantes intra-RM
- Saldo com resto do país: −470.010 (entradas 411.085, saídas 881.095)
- Núcleo→periferia: 42,8% (204.360 migrantes)

**Aba Pendular trabalho da RM-SP**:
- 9.951.130 ocupados
- 1.442.040 pendulares (14,5%)
- Tempo mediano: 60 min
- Retorno diário: 94,6%
- Transporte coletivo: 51,1%

**Aba Pendular estudo**:
- 388.690 estudantes pendulares
- 409.035 entradas por estudo

**Painel pendular Luziânia/GO → Brasília/DF** (RIDE-DF):
- 20.510 pessoas (IC 95% 19.521 a 21.499)
- Fluxo inverso: 1.055
- Saldo pendular do par: +19.455
- Tempo mediano: 90 min
- Retorno diário: 94,6%
- Transporte coletivo: 67,5%
- Precisão boa (CV 2,5%), 500+ observações

**Bloco "Onde trabalham"** — São Paulo → Guarulhos (23.425 migrantes; fluxo inverso 9.095; saldo do par +14.330):
- 6.865 trabalham em São Paulo (100–499 obs.)
- 6.425 trabalham em Guarulhos
- 360 não informado
- 245 em vários municípios

**Aluvial da RM-SP** após correção:
- 13 caminhos (12 + "outros")
- 17 nós
- 26 links
- Antes da correção: 211 paths e 72 rects

**Sub-painel "Migrantes e trabalho" da RM-SP** (KPIs agregados sobre os migrantes intra-RM ocupados):
- 294.010 migrantes intra-RM ocupados
- 143.120 fazem deslocamento pendular (48,7%)
- 28,2% voltam a trabalhar no município de origem; 9,3% trabalham no núcleo sem ter vindo dele; 47,4% trabalham onde passaram a morar

## O que a comparação revela

O bloco "Onde trabalham" responde à pergunta do usuário sobre quantos migrantes intrametropolitanos fazem pendular e para onde — no caso São Paulo→Guarulhos, cerca de metade dos ocupados (6.865 em 13.895, 49%) continua trabalhando na cidade de onde saiu, e outros 46% trabalham em Guarulhos. O cruzamento com a F2b (46,5% dos que saíram do núcleo para a periferia seguem trabalhando no núcleo, 59,3% na RIDE-DF) agora é navegável RM a RM.

A ordem núcleo→periferia varia de 22,1% (Vale do Paraíba) a 69,7% (Goiânia) e 67,9% (Salvador) do total intra-RM, revelando a heterogeneidade das estruturas metropolitanas brasileiras.

## Decisões de implementação

- **Orquestração automática**: a sessão (Fable 5.1) especificou e revisou; implementação por dois subagentes Sonnet 5; este relatório por subagente Haiku 4.5, conforme pedido do usuário no início da fase.
- **Paleta categórica de 8 slots** para setor e ocupação agrupada, validada aos pares adjacentes na skill `dataviz`.
- **Tempo de deslocamento** agrupado em 5 classes para reutilizar a rampa ordinal azul validada.
- **Ocupação agrupada em 8 grupos**; nível de estudo em 4 passos da rampa azul.
- **Ranking de taxa de saída** filtra municípios com ≥ 1.000 ocupados para evitar percentuais de denominador minúsculo.
- **Seletor de RM** só no cabeçalho.
- **Tabela acessível do aluvial** lista caminhos, não links.
- **Nenhuma exportação CSV** específica para RM/pendular; herda só a de município.

## Problemas encontrados e resolvidos

1. **Agrupamento "outros" do aluvial iterava sobre 320 caminhos**, criando um nó e um link por caminho (211 paths/72 rects). Corrigido para um único caminho sintético.
2. **Tabela acessível reconstruía a origem com `replace` sem efeito**, repetindo a residência na coluna de origem. Reescrita para listar os caminhos.
3. **IDs dos nós passaram a ter prefixo de coluna** (o:, r:, t:) porque o mesmo município pode aparecer em colunas diferentes.
4. **`n_faixa` faltava na consulta de caminhos** do aluvial.
5. **Legenda de espessura dos arcos foi revertida por engano** pelo primeiro subagente. Restaurada pelo orquestrador.
6. **Logs de tempo `[F5b]`** passaram a ficar restritos a `import.meta.env.DEV`.
7. **Aba de estudo usava rótulos de trabalho** na legenda de classes. Corrigido com `CLASSE_ESTUDO`.
8. **Erros "Invalid hook call"/"luma.gl already initialized"** vistos durante a sessão eram efeito da reotimização de dependências do Vite após instalar o d3-sankey. Em aba nova com console limpo, resolvido; `npm ls react` confirma uma única cópia.

## Testes

- Front-end (`vitest`): **27 aprovados** (14 anteriores + 13 novos) — bbox de centroides, agrupamento de tempo e ocupação, preparação do sankey com limites de nós/links, testes com 15 e 200 caminhos, ranking de saldo intra-RM.
- Pipeline (`pytest`): **41 aprovados**, sem regressão.
- `tsc` e `build` limpos.

## Pendências

- **Exportação CSV** para painéis pendulares e de RM.
- **Inspeção individual** da RM de Belém.
- **Níveis de agregação** por região geográfica (imediata/intermediária), matriz de acordes UF×UF e idade/sexo nas barras — pendentes da F5, para a F6.
- **Indicador de progresso** para primeira carga a frio (5–6 s) — adiado para a F6.
