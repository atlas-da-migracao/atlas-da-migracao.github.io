# Desenho da seção "Ao longo dos censos" (F12.4-d)

> Documento de desenho fechado **antes** da implementação (F12.5). Vale como especificação de
> interface para `web/src/lib/serie.ts`, `ResumoSerie.tsx`, `SerieCensos.tsx` e os small multiples
> de mapa. Base de dados: `data/processed/series/*` e `comparabilidade.json`; regras em
> `pipeline/comparabilidade_regras.py` e `docs/METODOLOGIA.md`, "Comparação entre censos (F12)".
> Nada aqui reimplementa regra metodológica: o documento diz **como mostrar** o que aquelas
> regras decidem.

Convenções herdadas do resto do atlas e que esta seção **não** altera: tokens de `styles/tokens.css`
(`--ink`, `--ink-secondary`, `--ink-muted-texto`, `--plane`, `--surface-raised`, `--arc-in`,
`--arc-out`), caixas `.aviso`/`.aviso-proxy` (`AvisoProxy.tsx`), KPIs `.kpis > .kpi`, seções
`.secao`/`.secao-titulo`, tabelas `.tabela-scroll`, overlay `.pagina-cheia` com `role="dialog"`,
foco no botão de fechar e `Esc` (`PaginaMetodologia.tsx`), paletas de `lib/paletas.ts` e escala
divergente de `lib/escalas.ts`.

Vocabulário fixo de edições, sempre nesta ordem cronológica nos gráficos e tabelas:
**1980 · 1991 · 2000 · 2010 · 2022** (da esquerda para a direita; o tempo corre para a direita).
Nos textos, 1980 é sempre acompanhado de "(proxy)".

---

## 1. Hierarquia das três camadas

### 1.1 Princípio

| Camada | Para quem | O que contém | Estado inicial | Onde |
|---|---|---|---|---|
| **1 — Síntese** | gestor | uma frase gerada + 3 números grandes com sparkline de 5 pontos | sempre visível | `ResumoSerie.tsx`, embutido no painel de cada nível; e topo de `SerieCensos.tsx` |
| **2 — Gráficos** | os dois | os 4 blocos em gráficos com rótulo direto e ressalva ao lado | aberta na seção completa; fechada no resumo embutido | `SerieCensos.tsx` |
| **3 — Tabela + metodologia + exportação** | pesquisador | medidas × edições com `n`, CV, IC, precisão, estado de comparabilidade, motivo de ausência; fórmula e referência; CSV/PNG | fechada (`<details>`) por bloco | `SerieCensos.tsx`, ao pé de cada bloco |

Regras que valem nas três camadas:

- **Uma célula sem número nunca é "0" nem "—" sozinho.** Ela mostra uma das cinco palavras:
  `não existia`, `sem cobertura`, `cobertura insuficiente`, `suprimido`, `não medido`. No gráfico,
  a forma correspondente (seção 4.4); na tabela, a palavra + tooltip com a nota de
  `comparabilidade.json`.
- **O estado de comparabilidade é um selo, não uma cor.** `comparavel` não tem selo;
  `comparavel_com_ressalva` recebe um selo "ressalva" (ícone `ⓘ` + texto curto) com tooltip da
  nota; `nao_comparavel` não produz número em lugar nenhum (invariante da F12.5-t).
- **1980 leva o selo "proxy" na própria célula/ponto**, não só no rodapé: sufixo "(proxy)" no
  rótulo do eixo, marcador de ponto diferente (losango vazado em vez de círculo cheio), coluna da
  tabela com cabeçalho "1980 (proxy)".
- **A camada aberta não vai à URL.** Só `?pagina=serie` (seção completa) e `?serie=1` (resumo
  expandido no painel). Território e nível continuam nos parâmetros já existentes (`?n`, `?mun`,
  `?sel`, `?rm`).
- **Nível é contexto fixo da seção.** A seção abre no nível e na unidade selecionados e não tem
  seletor de nível próprio: trocar de nível é fechar a seção e trocar no cabeçalho. Isso é a forma
  mais barata de impedir a leitura de CMI/ANMR entre níveis (regra dura de escala) — não existe
  vista em que dois níveis apareçam lado a lado, exceto na figura de Courgeau, que existe
  exatamente para mostrar o efeito de escala e é rotulada como tal.

### 1.2 Município — exemplo: Sobral/CE (série completa, 1:1 nas cinco edições)

Números **ilustrativos** (ordem de grandeza plausível para um município de ~200 mil habitantes
que era polo de absorção regional em 1980 e hoje troca população com a região):

```
┌─ Painel do município (nível mun) ───────────────────────────────────────────────────┐
│ Sobral/CE · Região imediata de Sobral · 203.682 habitantes                            │
│ [KPIs da edição ativa, já existentes]                                                 │
│                                                                                       │
│ ── Ao longo dos censos ─────────────────────────────── [Ver a série completa ↗] ──   │  ← ResumoSerie
│                                                                                       │
│ Entre 1980 e 2022, Sobral passou de absorção (IEM +0,24) para rotatividade           │  CAMADA 1
│ (IEM +0,03): continua recebendo gente, mas agora perde quase o mesmo tanto.          │  (frase)
│ O ponto de 1980 é uma estimativa por proxy, que tende a aproximar o índice de zero.  │
│                                                                                       │
│ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐                                │
│ │ Saldo 2017–22 │ │ Eficácia 2022 │ │ Rotatividade  │                                │  CAMADA 1
│ │   +590        │ │   +0,03       │ │   19.410      │                                │  (3 números)
│ │ ▁▃▅▂▁ ±3‰     │ │ ◇▅▃▂▁ rotat.  │ │ ◇▂▃▅▇ pessoas │                                │
│ │ IC 95%: 120 a │ │ absorção em   │ │ entraram 10.0 │                                │
│ │ 1.060 · +2,9‰ │ │ 1980, rotativ.│ │ mil, saíram   │                                │
│ │               │ │ desde 2000    │ │ 9,4 mil       │                                │
│ └───────────────┘ └───────────────┘ └───────────────┘                                │
│ ◇ = 1980, proxy   ▁▃▅ = sparkline 1980→2022, faixa de IC sombreada                    │
└───────────────────────────────────────────────────────────────────────────────────────┘
```

Detalhes da camada 1 (valem para todos os níveis):

- **Frase**: gerada por `fraseSintese()` (seção 2). Máximo de duas orações + uma oração de
  ressalva quando houver (proxy, truncamento, mãe, cobertura). Sem sigla sem expansão: "IEM" só
  aparece porque o glossário/tooltip está a um foco de distância (`<abbr title>` + `aria-describedby`).
- **Os 3 números** são sempre os mesmos, em todos os níveis, na mesma ordem:
  1. **Saldo** da edição mais recente com número (`saldo`, com IC 95% quando há `se`; TLM em ‰
     como detalhe).
  2. **Eficácia** (`iem`, duas casas, com sinal) + o nome da classe de Baeninger em português
     ("rotatividade", "absorção", "absorção forte", "evasão", "evasão forte", "indefinido").
  3. **Rotatividade** (`imig + emig`), com "entraram X, saíram Y" como detalhe.
  Cada número tem um **sparkline de 5 posições fixas** (1980…2022), sempre com as 5 posições
  desenhadas — posição sem número recebe a marca de ausência (seção 4.4) e não é interpolada
  (a linha se interrompe). Faixa de IC 95% sombreada quando existe `se`. 1980 com losango vazado.
- No **nível municipal**, o número 3 (rotatividade) leva a nota "valores absolutos; compare
  taxas na série completa" quando o município é mãe de algum desmembramento (nota
  `municipio_mae`), porque volume é a medida mais sensível ao degrau de fronteira.

Camada 2 (seção completa, `?pagina=serie`), estrutura de página:

```
┌─ Ao longo dos censos — Sobral/CE (município) ────────────────────────────── [×] ─┐
│ [camada 1 repetida, largura total]                                                 │
│                                                                                    │
│ ▸ Bloco 1 · A migração de Sobral, censo a censo                                    │
│     [tabela com sparkline]  [pequenos gráficos de linha: TLM, IEM, taxas brutas]   │
│     [mapa comparativo: 5 small multiples da região imediata, IEM]                  │
│     ▹ Detalhes, fórmulas e download (camada 3)                                     │
│ ▸ Bloco 2 · O sistema de municípios em que Sobral está                             │
│     [plano MEI × CMI com trajetória] [dispersão de Fielding] [figura de Courgeau]  │
│     ▹ Detalhes …                                                                   │
│ ▸ Bloco 3 · De onde vieram e para onde foram                                       │
│     [tabela de postos origens | destinos] [diagrama de acordes por edição]          │
│     ▹ Detalhes …                                                                   │
│ ▸ Bloco 4 · Quem migra                                                             │
│     [barras 100% por edição] [5 pirâmides] [idade mediana, razão de sexo, OR]      │
│     ▹ Detalhes …                                                                   │
│ Glossário · Metodologia (link para ?pagina=metodologia#f12)                        │
└────────────────────────────────────────────────────────────────────────────────────┘
```

Os quatro blocos são `<section>` com `aria-labelledby` e um índice fixo no topo (âncoras
`#bloco-1`…`#bloco-4`) — em tela estreita ele vira a navegação principal (seção 6).

### 1.3 Município truncado — exemplo: Palmas/TO (criado em 1989)

```
Frase:  Palmas foi criado em 1989; em 1980 seu território fazia parte de Norte de Goiás
        (atual Tocantins), unidade agregada. De 1991 a 2022, Palmas manteve-se em absorção
        forte (IEM +0,52 → +0,36): recebe o dobro do que perde, mas a vantagem encolheu.
        [Abrir a série de Norte de Goiás (atual Tocantins) ↗]

Números:  Saldo 2017–22  +14.300     Eficácia 2022  +0,36 absorção forte    Rotatividade 51.000
          ░▂▅▇▆                      ░▇▇▆▅                                  ░▁▃▅▇
          ░ = não existia (hachura diagonal na 1ª posição do sparkline)
```

- A posição 1980 de **todo** sparkline/tabela/gráfico do município leva a trama "não existia" e
  o tooltip "Não existia em 1980: território de Norte de Goiás (atual Tocantins)".
- O botão "Abrir a série de …" chama `selecionarMunicipio(cd_mae)` e reabre `?pagina=serie`;
  a série do mãe abre com o aviso `municipio_mae` no topo e **nunca** no mesmo gráfico.
- Se o mãe for `NORTEGO`, o botão leva à unidade agregada de 1980 e o aviso `unidade_agregada_1980`
  substitui o texto padrão de mãe.

### 1.4 Município-mãe — exemplo: Santarém/PA (cedeu Mojuí dos Campos em 2013)

```
┌ aviso, no topo da seção ─────────────────────────────────────────────────────────┐
│ Até 2010, Santarém incluía o território que hoje é Mojuí dos Campos. Parte da    │
│ queda de população e de fluxos entre 2010 e 2022 é mudança de fronteira, não     │
│ migração. Leia taxas e o índice de eficácia; evite comparar volumes.             │
│ [Ver a série de Mojuí dos Campos ↗]                                              │
└──────────────────────────────────────────────────────────────────────────────────┘
```

Nos gráficos de volume do Bloco 1 (imigração, emigração, saldo, rotatividade), uma **linha
vertical tracejada** marca a edição do desmembramento com o rótulo "fronteira mudou". As taxas e
o IEM não recebem a linha (o aviso já cobre) — reservar a marca para as medidas mais afetadas evita
banalizá-la.

### 1.5 Região imediata — exemplo: RGI de Sobral (cobertura plena nas cinco edições)

Igual ao município, com três diferenças:

- Cabeçalho: "Região imediata de Sobral · 27 municípios em 2022 · cobertura: 100% em todas as
  edições" — a **frase de cobertura** substitui a linha de população/RGI do município.
- Não há Bloco 4 de perfil por unidade? **Há**: `perfil_serie.parquet` traz `nivel ∈ {…}`; se a
  F12.4 não publicou perfil para agregados, o Bloco 4 mostra "Perfil publicado só no nível
  municipal" e some do índice. (Decidir na F12.5 pela existência de linhas, não por nível
  hard-coded.)
- Bloco 2 usa `sistema_serie` com `nivel = rgi`: "o sistema das 510 regiões imediatas".

Selo de cobertura por célula quando `estado_cobertura = parcial`: "cobertura 96%" ao lado do
número, em `muted-pequeno`. Quando `insuficiente`: célula com hachura diagonal + palavra.

### 1.6 Região intermediária — exemplo: RGInt de Sobral

Idêntico a 1.5. Diferença de conteúdo: a figura de Courgeau destaca o ponto do nível ativo
(`rgint`, 133 unidades) com contorno mais grosso.

### 1.7 UF — exemplo: Ceará

- Cabeçalho: "Ceará · 184 municípios em 2022 · cobertura: 100% em todas as edições".
- Frase-síntese igual; o Bloco 3 (fluxos) usa `fluxos_uf` e o **diagrama de acordes** já
  existente, um por edição (5 small multiples de acordes, ou um acordes com seletor de edição em
  tela estreita).
- Tocantins é o caso especial de UF: 1980 com número e nota `unidade_agregada_1980` (a UF `17` é
  coberta por `NORTEGO`); Bloco 3 e qualquer medida `composicao_interna` em 1980 com "cobertura
  insuficiente".

### 1.8 Região metropolitana — exemplo: RM de Fortaleza

```
Cabeçalho: RM de Fortaleza · 19 municípios em 2022 · cobertura: 100% (2022–2000) · 91% (1991) ·
           88% (1980, insuficiente)

Frase:     Entre 1991 e 2022, a RM de Fortaleza passou de absorção (IEM +0,19) para rotatividade
           (IEM +0,04): a região ainda atrai, mas o saldo caiu a um décimo do que era. Em 1980
           menos de 90% da população de hoje estava coberta pelos municípios da época; não há
           número para esse ano.

Números:   Saldo 2017–22 +12.800   Eficácia 2022 +0,04 rotatividade   Rotatividade 290.000
           ▒▅▃▂▁                   ▒▇▅▃▂                               ▒▃▅▆▇
           ▒ = cobertura insuficiente (hachura diagonal, tooltip com o percentual)
```

Bloco 1 da RM tem um **sub-bloco intrametropolitano** (`rm_mig_intra`, `rm_tipologia`,
`rm_pendular_intra`), que segue `cobertura_cod` e as travas `rm_unitaria`/`nucleo_divergente`:
RM reduzida a um município mostra "cobertura insuficiente — a região tinha um só município"
(nunca zero). O deslocamento pendular em 1991 mostra "não medido" (trama pontilhada) em toda a
coluna, com a nota `sem_pendular_1991`.

---

## 2. Redação das frases-síntese (`lib/serie.ts`, `fraseSintese()`)

### 2.1 Entradas

```ts
interface EntradaFrase {
  nome: string;                    // "Sobral", "Região imediata de Sobral", "Ceará", "RM de Fortaleza"
  nivel: "mun" | "rgi" | "rgint" | "uf" | "rm";
  pontos: Array<{                  // sempre 5, em ordem cronológica 1980 → 2022
    edicao: "1980" | "1991" | "2000" | "2010" | "2022";
    estado: "numero" | "nao_existia" | "sem_cobertura" | "cobertura_insuficiente" | "suprimido" | "nao_medido";
    iem: number | null; se_iem: number | null;
    tipo: TipoIEM | null;          // classificar_iem(iem, se_iem); null quando sem número
    imig: number | null; emig: number | null; saldo: number | null; tlm: number | null;
    cobertura_pop: number | null;
  }>;
  mae?: { nome: string; edicoes: string[]; agregada: boolean };   // quando nao_existia
  filhos?: { nomes: string[]; ultimaEdicaoJunto: string };         // quando é município-mãe
  rmUnitaria?: string[];                                            // edições em que a RM tinha 1 município
}
```

### 2.2 Regras determinísticas

R1. **Âncoras.** `fim` = ponto mais recente com `estado = numero` e `tipo ≠ null`; `ini` = ponto
mais antigo com `estado = numero` e `tipo ≠ null`. Se `ini === fim` → T5. Se não há nenhum → T6.

R2. **Guarda de "indefinido".** Se o `tipo` da âncora for `indefinido`, a âncora anda para a
próxima edição com tipo definido (para dentro do intervalo). Se ainda assim uma das âncoras for
`indefinido`, usar T4. `indefinido` nunca é apresentado como "rotatividade".

R3. **Nome da classe** (`nomeTipo`): `rotatividade` → "rotatividade"; `absorcao` → "absorção";
`absorcao_forte` → "absorção forte"; `evasao` → "evasão"; `evasao_forte` → "evasão forte";
`indefinido` → "situação indefinida (amostra pequena)".

R4. **Complemento** (`complemento(ini, fim)`), escolhido pela direção de `imig` e `emig` entre as
âncoras, com limiar de 10% para "manteve":

| imig | emig | texto |
|---|---|---|
| ↑ | ↑ | "chega mais gente do que antes, e sai mais também" |
| ≈ | ↑ | "continua recebendo gente, mas agora perde quase o mesmo tanto" |
| ↓ | ↑ | "chega menos gente e sai mais" |
| ↑ | ≈ | "chega mais gente e a saída não acompanhou" |
| ≈ | ≈ | "entradas e saídas mudaram pouco" |
| ↓ | ≈ | "chega menos gente do que antes" |
| ↑ | ↓ | "chega mais gente e sai menos" |
| ≈ | ↓ | "sai menos gente do que antes" |
| ↓ | ↓ | "entram e saem menos pessoas do que antes" |

No nível `mun` com `filhos` (município-mãe) o complemento usa **taxas** (`tbi`/`tbe`) em vez de
volumes, e recebe o sufixo "— descontada a mudança de fronteira".

R5. **Formato do IEM**: sinal explícito e duas casas, `+0,24`, `−0,08`, `0,00`.

R6. **Ordem das orações**: [prefixo de truncamento/mãe] + [oração principal] + [complemento] +
[ressalva de proxy] + [ressalva de cobertura]. Cada ressalva é uma frase curta separada.

R7. **Ressalva de proxy (obrigatória quando `ini.edicao === "1980"`)**: "O ponto de 1980 é uma
estimativa por proxy, que tende a aproximar o índice de zero — a mudança real pode ser maior."
Quando `fim` também for 1980 (só existe 1980), a ressalva vira "Este número é uma estimativa por
proxy, não uma medida direta."

R8. **Ressalva de cobertura**: para cada edição com `cobertura_insuficiente` ou `sem_cobertura`
entre 1980 e `fim`, uma única frase: "Em {anos} menos de 90% da população de hoje estava coberta
pelos municípios da época; não há número para {esse ano | esses anos}." Para `rmUnitaria`:
"Em {anos} a região tinha um só município: os indicadores internos não existem, não são zero."

### 2.3 Templates

**T1 — mudou de classe**
> Entre {ini.ano} e {fim.ano}, {nome} passou de {nomeTipo(ini)} (IEM {iem_ini}) para
> {nomeTipo(fim)} (IEM {iem_fim}): {complemento}.

Ex.: *Entre 1980 e 2022, Sobral passou de absorção (IEM +0,24) para rotatividade (IEM +0,03):
continua recebendo gente, mas agora perde quase o mesmo tanto. O ponto de 1980 é uma estimativa
por proxy, que tende a aproximar o índice de zero — a mudança real pode ser maior.*

**T2 — manteve a classe**
> {nome} está em {nomeTipo(fim)} desde {ini.ano} (IEM de {iem_ini} para {iem_fim}): {complemento}.

Variante quando |Δiem| ≥ 0,10 dentro da mesma classe: substituir "está em … desde" por
"continua em {nomeTipo}, mas {mais perto | mais longe} do equilíbrio (IEM de {iem_ini} para
{iem_fim})". Ex.: *Palmas continua em absorção forte, mas mais perto do equilíbrio (IEM de +0,52
para +0,36): chega mais gente e sai mais também.*

**T3 — truncado (município criado depois de uma edição)** — prefixo antes de T1/T2:
> {nome} foi criado depois de {última edição sem existir}; até então seu território fazia parte
> de {mae.nome}{", unidade agregada" se agregada}. {T1 ou T2 sobre a série curta}

Ex.: *Mojuí dos Campos foi criado depois de 2010; até então seu território fazia parte de
Santarém. Só há dado para Mojuí dos Campos em 2022: evasão (IEM −0,21), com 480 pessoas chegando
e 740 saindo.* (aqui a série curta caiu em T5)

**T4 — uma das âncoras é indefinida (amostra pequena)**
> Em {fim.ano}, {nome} tem {nomeTipo(fim)}. Em {ini.ano} a amostra é pequena demais para dizer
> se havia ganho ou perda (IEM {iem_ini}, com margem de ±{1,96·se}). A comparação entre as duas
> pontas não é conclusiva.

Se **as duas** âncoras forem indefinidas: *Em nenhum censo a amostra de {nome} é grande o
bastante para classificar a migração: os índices ({lista de "ano: iem"}) têm margem maior que o
próprio valor.*

**T5 — só uma edição com número**
> Só há dado para {nome} em {fim.ano}: {nomeTipo(fim)} (IEM {iem_fim}), com {imig} pessoas
> chegando e {emig} saindo. {motivo das outras: "Nas demais edições, {não existia | a cobertura é
> insuficiente | o dado foi suprimido}."}

**T6 — nenhuma edição com número**
> Não há série para {nome}: {motivo dominante em português}. {Se mae: "Abra a série de
> {mae.nome}, de que o território fazia parte."}

**T7 — município-mãe (prefixo, nível `mun` com `filhos`)**
> Até {filhos.ultimaEdicaoJunto}, {nome} incluía o território que hoje é {filhos.nomes, "e
> outros" se > 3}; parte da variação de volume desde então é fronteira, não migração. {T1 ou T2
> com complemento por taxas}

**T8 — 1980 é a única âncora inicial possível e a mudança é pequena (|Δiem| < 0,10, mesma
classe)** — o proxy pode explicar toda a diferença; a frase não deve afirmar tendência:
> {nome} aparece em {nomeTipo(fim)} em todos os censos com dado (IEM entre {min} e {max}). A
> diferença em relação a 1980 é menor que a incerteza do proxy daquele ano.

### 2.4 Testes mínimos para `serie.test.ts` (F12.5-t)

- T1 gerada para (absorção → rotatividade), (evasão forte → evasão), (rotatividade → absorção).
- T2 com e sem a variante "mais perto/longe do equilíbrio".
- T3 com mãe comum e com `NORTEGO`.
- T4 quando `iem = 0,20` e `se = 0,15` (indefinido).
- T5/T6 para município criado em 2013 e para RGI vazia em 1980.
- Ressalva de proxy presente sempre que `ini = 1980`; ausente quando `ini = 1991`.
- Nenhuma frase contém "0,00" como resultado de célula ausente.

---

## 3. Wireframe de cada bloco

Convenções gráficas comuns (Observable Plot, tema claro/escuro):

- **Eixo x categórico** com as cinco edições em posições **fixas e equidistantes** (não é eixo
  de tempo linear: 1980→1991 são 11 anos, os demais 10 — a diferença não justifica escala
  contínua e a equidistância mantém os small multiples alinhados). Rótulos "1980 (proxy)", "1991",
  "2000", "2010", "2022".
- **Zero sempre visível** em taxas líquidas e IEM; eixo y de taxas brutas começa em 0.
- **Ponto**: círculo cheio (dado publicado, `comparavel`); círculo com contorno **tracejado**
  (CV > 25% ou `precisao = cautela/baixa`); **losango vazado** (1980, proxy); posição sem número
  recebe a marca de ausência e a linha se **interrompe** (nunca interpola por cima de uma
  ausência).
- **Faixa de IC 95%** como área a 20% de opacidade da cor da linha, quando há `se`.
- **Ressalva** (`comparavel_com_ressalva`): texto de uma linha em `muted-pequeno` imediatamente
  **abaixo do gráfico**, começando por "Ressalva:", com o ícone ⓘ que abre a nota completa.
  Nunca em rodapé de página.
- **`n` e CV**: no tooltip de cada ponto ("n = 1.240 · CV 6,1% · IC 95%: …") e nas colunas da
  tabela da camada 3; no gráfico só pela forma do ponto (acima).
- Toda figura tem **tabela equivalente** (`<table>` visualmente oculta ou a própria tabela da
  camada 3 referenciada por `aria-describedby`) e botão "Baixar CSV" / "Baixar PNG".

### 3.1 Bloco 1 — medidas da unidade

**Peça principal: tabela medidas × edições com sparkline** (a mesma tabela serve às camadas 2 e 3;
a camada 3 só acrescenta colunas).

```
 Medida                    │ tend. │ 1980 (proxy) │ 1991    │ 2000   │ 2010   │ 2022    │
 ──────────────────────────┼───────┼──────────────┼─────────┼────────┼────────┼─────────┤
 Taxa líquida (‰)          │ ▅▃▂▁▁ │ +24,1 ◇      │ +15,3   │ +8,0   │ +3,9   │ +2,9    │
 Índice de eficácia        │ ▇▅▃▁▁ │ +0,24 ◇      │ +0,18   │ +0,12  │ +0,05  │ +0,03   │
   classe                  │       │ absorção     │ absorção│ rotat. │ rotat. │ rotat.  │
 Taxa bruta de imigração ‰ │ ▆▅▄▄▅ │ 96 ◇ (~90)   │ 81      │ 62     │ 55     │ 49      │
 Taxa bruta de emigração ‰ │ ▂▃▄▄▅ │ 59 ◇ (~55)   │ 55      │ 48     │ 47     │ 46      │
 Imigrantes                │ ▂▃▅▆▇ │ 7.900 ◇      │ 8.600   │ 8.900  │ 9.700  │ 10.000  │
 Emigrantes                │ ▁▃▅▇▇ │ 4.800 ◇      │ 5.900   │ 6.900  │ 8.300  │ 9.400   │
 Saldo                     │ ▇▆▄▂▁ │ +3.100 ◇     │ +2.700  │ +2.000 │ +1.400 │ +590    │
 Rotatividade (entr.+saíd.)│ ▂▃▅▆▇ │ 12.700 ◇     │ 14.500  │ 15.800 │ 18.000 │ 19.400  │
 Distância média (km)      │ ▇▆▅▄▄ │ 410 ◇ ⓘ      │ 380     │ 330    │ 300    │ 290     │
 % que cruza a UF          │ ▆▅▄▄▃ │ 31% ◇ ⓘ      │ 34%     │ 30%    │ 27%    │ 24%     │
 Parceiros publicados      │       │ não compar.  │ 88 ⓘ    │ 112 ⓘ  │ 131 ⓘ  │ 140 ⓘ   │
 Concentração origens (Gini)│▅▅▄▄▄ │ 0,71 ◇ ⓘ     │ 0,70 ⓘ  │ 0,66 ⓘ │ 0,64 ⓘ │ 0,63 ⓘ  │
 ── Deslocamento pendular ─┼───────┼──────────────┼─────────┼────────┼────────┼─────────┤
 Saída p/ trabalho         │ ▁░▃▅▇ │ 900 ⓘ        │ ░░░░░   │ 1.400  │ 2.900  │ 4.100   │
 % ocupados pendulares     │ ▁░▂▄▅ │ 2,1%         │ não med.│ 2,8%   │ 4,6%   │ 5,9%    │
```

- Coluna **"tend."**: sparkline de 5 posições, mesma forma dos KPIs. É a coluna que o gestor lê.
- **1980 com faixa calibrada** entre parênteses e prefixo "~" para medidas com
  `calibracao_1980 ≠ null` (volume ÷1,073; saldo ÷0,941 ou ÷0,912 na UF), tooltip "estimativa
  derivada; a correção é um piso". O bruto é o número principal; o calibrado nunca entra em
  gráfico.
- **Ordem das linhas fixa** (a ordem acima), não ordenável: a tabela é de leitura, não de ranking.
  Taxas antes de volumes de propósito (as taxas são as comparáveis; volumes vêm depois com a
  nota de fronteira quando houver).
- **Célula sem número**: palavra curta + trama de fundo (seção 4.4). "não compar." é o único caso
  em que a célula nem tem trama: é ausência da medida, não do dado (`nao_comparavel`).
- **Camada 3 acrescenta** colunas por edição: `n`, `se`, `cv`, `precisao`, `estado`, `nota`; e um
  cabeçalho por medida com fórmula (`comparabilidade.json → medidas[].formula`) e referência.
  Renderizado em `<details>` "Detalhes, fórmulas e download" para não dobrar a largura da vista
  padrão.

**Gráficos de apoio** (3 pequenos, lado a lado, 260×160 px cada): TLM (‰), IEM com as **bandas
da tipologia** desenhadas como faixas horizontais de fundo (±0,15 e ±1/3, rotuladas "rotatividade",
"absorção/evasão", "forte"), e taxas brutas de imigração/emigração no mesmo gráfico (azul
`--arc-in`, laranja `--arc-out`). Zero visível nos três.

**Mapa comparativo** (seção 4) fecha o bloco: 5 small multiples do **nível ativo** (a unidade
selecionada tem contorno grosso; o enquadramento é a UF ou a RGInt que a contém — não o Brasil
inteiro, para que a unidade seja legível), medida selecionável entre `iem` (padrão), `tlm`,
`tbi`, `tbe`. No nível `mun` o mapa entra sob pedido ("Carregar os mapas municipais das cinco
edições", por desempenho).

### 3.2 Bloco 2 — o sistema (contexto do nível)

Título com o nível explícito: *"O sistema das {5.570 municípios | 510 regiões imediatas | …}"*.
Frase de ressalva fixa no topo do bloco: *"Estes números descrevem o conjunto de unidades do
nível, não {nome}. Eles mudam com o número de unidades e só podem ser comparados dentro do mesmo
nível."*

**(a) Plano MEI × CMI com trajetória** (Rowe et al. 2019, Fig. 2) — 420×320 px:
- x = CMI (%), y = MEI agregado (%), ambos começando em 0.
- **Contornos de ANMR constante** (`ANMR = CMI·MEI/100`) como hipérboles cinza-claro rotuladas
  na margem ("ANMR 0,5", "1", "2", "4").
- Cinco pontos ligados por segmentos com **seta** no sentido cronológico; rótulo do ano ao lado
  de cada ponto; 1980 como losango vazado; segmento 1980→1991 tracejado (proxy).
- Ao lado de cada ponto, em `muted-pequeno`, `n = 3.940` etc. Essa anotação é obrigatória
  (decisão 1 do item 5 da metodologia).
- Ressalva abaixo: "A intensidade (CMI) cresce com o número de unidades; parte do deslocamento
  para a direita entre 1980 e 2022 é malha mais fina, não comportamento — ver figura de Courgeau."

**(b) Dispersão de Fielding** — 5 small multiples de 200×180 px (uma edição cada), mesma escala
de eixos nos cinco:
- x = log₁₀ densidade (hab/km²), y = taxa líquida (‰); pontos pequenos (r = 1,5 px) a 35% de
  opacidade, tamanho fixo (não por população: o peso já está na reta).
- Reta MQO ponderada na cor `--ink`, com **β** e seu erro-padrão como rótulo dentro do painel:
  "β = −2,4 ± 0,3" (1980), … A leitura em palavras sob cada painel: "concentração" (β > 0),
  "desconcentração" (β < 0), "equilíbrio" (|β| < 2·ep).
- A unidade selecionada é destacada como ponto maior com contorno.
- Ressalva: "Reta ajustada por MQO ponderado por população sobre as unidades existentes em cada
  edição ({n}). Em 1980 a taxa líquida é proxy."

**(c) Figura de Courgeau** — 360×240 px, um só painel:
- x = log₁₀ do número de unidades do nível (5 posições: UF 27, RM 81, RGInt 133, RGI 510,
  municípios 3.940–5.570); y = CMI (%). Uma linha por edição (5 linhas, rampa `AZUL` ordinal
  por edição, do claro 1980 ao escuro 2022, **mais** rótulo direto no fim de cada linha — a
  identidade nunca fica só na cor).
- O nível ativo tem uma faixa vertical de fundo.
- Legenda-frase: "Quanto mais unidades tem a malha, maior a intensidade medida. A inclinação de
  cada linha é o tamanho desse efeito na edição." Ao lado da CMI municipal, a anotação
  `Δ esperado` da metodologia (item 5.3), em tooltip.

**(d) Duncan D e log-linear** — não ganham gráfico próprio na camada 2: entram como uma
**linha de quatro números** ("Quanto a estrutura dos fluxos mudou entre censos: 1980→91 0,31 ·
1991→2000 0,22 · 2000→10 0,18 · 2010→22 0,15 — fração dos fluxos que teria de mudar de par") com
`n_pares_comuns` e fração de volume coberta no tooltip. Os parâmetros `O_i`/`D_j` da unidade
aparecem na camada 3 do Bloco 3.

### 3.3 Bloco 3 — fluxos

**(a) Tabela de postos, origens | destinos** (peça principal). Duas tabelas lado a lado (empilhadas
a 400 px), **ordenadas pelo posto na edição mais recente com número**, mostrando os top-10 de 2022
mais qualquer parceiro que tenha estado no top-10 em alguma edição:

```
 Principais origens         │ 1980 (proxy)│ 1991    │ 2000    │ 2010    │ 2022    │
 ───────────────────────────┼─────────────┼─────────┼─────────┼─────────┼─────────┤
 Fortaleza/CE               │ 2º · 640 ◇  │ 1º · 780│ 1º · 820│ 1º · 910│ 1º · 980│
 Santana do Acaraú/CE       │ 1º · 710 ◇  │ 2º · 520│ 3º · 410│ 4º · 380│ 2º · 470│
 Massapê/CE                 │ 4º · 300 ◇  │ 3º · 450│ 2º · 430│ 2º · 440│ 3º · 420│
 São Paulo/SP               │ 3º · 420 ◇  │ 5º · 310│ 6º · 260│ 5º · 300│ 4º · 360│
 Forquilha/CE               │ ░ não exist.│ 8º · 150│ 5º · 280│ 3º · 400│ 5º · 330│
 …                          │             │         │         │         │         │
 Estabilidade do top-10     │      —      │ 7 de 10 │ 8 de 10 │ 9 de 10 │ 8 de 10 │
```

- A célula mostra **posto** (grande) e **volume** (pequeno). O posto é livre de escala e é a
  leitura principal; o volume tem CV no tooltip.
- Célula `suprimido`: "▒ supr." (hachura cruzada) — o parceiro existia mas o par ficou abaixo do
  limiar; `nao_existia`: "░"; 1980 sempre com ◇ e a nota `posto_supressao_1980` no cabeçalho.
- Barras embutidas de volume **não** entram (o volume entre edições é a leitura mais sensível a
  supressão e truncamento; a barra chamaria atenção justamente para ela).
- Última linha: **estabilidade do ranking** (|top10_t ∩ top10_{t−1}| / 10).

**(b) Diagrama de acordes** — nos níveis `uf`/`rgint`/`rgi`, reaproveitar `DiagramaAcordes`
como small multiples (5 painéis de 220 px), com a unidade selecionada destacada; no nível `mun`,
sem acordes (a matriz municipal é esparsa e a peça (a) já cobre). Em tela estreita, um só acordes
com seletor de edição (botões segmentados 1980…2022).

**(c) Par selecionado** (quando a seção é aberta a partir de um painel de fluxo): linha do volume
do par por edição + o componente `OD_ij` do log-linear com a leitura "o par {A}→{B} ficou {mais |
menos} 'preferido' do que o esperado pelos totais (OD de 1,8 para 1,3)". Ressalva
`loglinear_matriz_comum`.

### 3.4 Bloco 4 — perfil

**(a) Barras 100% empilhadas por edição** — `BarraPerfil` com `series` = 5 edições (rótulo
"1980 (proxy)", …), uma `BarraPerfil` por dimensão (`status` harmonizada, `edu`, `renda`,
`idade` por faixa). Edição sem a dimensão (renda em 1980) aparece como linha com "não medido"
(a `BarraPerfil` já mostra `perfil-vazio`; a F12.5 troca o texto "sem dado publicável" por
"não medido nesta edição" via prop nova `motivoVazio`).
- Toggle "Chegaram | Saíram | Residentes" acima do conjunto, não uma barra por direção por edição
  (15 barras por dimensão é ilegível).
- Ressalva `status_colapsado_2022`, `edu_anos_estudo`, `sm_implicito_1991` sob a respectiva barra.

**(b) Pirâmides como small multiples** — 5 × `PiramideIdadeSexo` (migrantes que chegaram vs.
residentes como referência tracejada), 180 px de largura cada, **mesmo `maiorPct` nos cinco** (a
F12.5 acrescenta a prop `maiorPct?: number` para travar a escala entre painéis — sem isso os
painéis reescalam e a comparação mente, mesmo erro da escala de cor por edição).

**(c) Linha de indicadores-resumo** — tabela pequena: idade mediana do migrante, razão de sexo,
faixa etária do pico e intensidade no pico, seletividade por escolaridade (OR) e por renda (OR),
por edição, com sparkline. Ressalvas `faixas_largas` e `seletividade_fim_do_periodo` como uma
única frase abaixo ("Idades calculadas sobre cinco faixas largas; a escolaridade é medida no fim
do período e não distingue causa de consequência").

---

## 4. Cartografia: escala de cor, quebras fixas e tramas

### 4.1 Regras

- Projeção Albers, TopoJSON `*_albers.topojson` já publicados, `MapaAtlas`/deck.gl reaproveitado.
- Coroplético **só** de `iem`, `tlm`, `tbi`, `tbe`. Volume (saldo, imigrantes, emigrantes) não
  entra nos small multiples — quem quiser volume tem a tabela.
- **Escala idêntica nas cinco edições** de um mesmo mapa comparativo, por quebras fixas abaixo.
  `quebrasSimetricas()` (quantis) **não** é usada aqui.
- Os cinco painéis compartilham **um** título, **uma** legenda (à direita ou abaixo) e o
  **mesmo enquadramento** (bbox da UF/RGInt que contém a unidade; no nível `uf`, o Brasil).
- Hover sincronizado: passar o mouse (ou focar) numa unidade realça a mesma unidade nos cinco e
  abre um tooltip único com os cinco valores em linha.

### 4.2 Quebras fixas

Unidades: `iem` no índice [−1, 1] (duas casas — **não** em %; ver 4.5); `tlm`, `tbi`, `tbe` em
‰ da população de 5+ anos, acumulado no quinquênio.

**`iem` — divergente, 7 classes.** As quebras são os **limiares da tipologia de Baeninger**
(`IEM_LIMIAR_ROTATIVIDADE = 0,15`, `IEM_LIMIAR_FORTE = 1/3`) mais um corte superior em 0,60, de
modo que a legenda do mapa e a classificação da frase-síntese sejam a mesma coisa:

| classe | intervalo | cor (`DIVERGENTE`) | rótulo de legenda |
|---|---|---|---|
| evasão muito forte | iem < −0,60 | `neg[2]` | "evasão muito forte (abaixo de −0,60)" |
| evasão forte | −0,60 ≤ iem < −0,33 | `neg[1]` | "evasão forte (−0,60 a −0,33)" |
| evasão | −0,33 ≤ iem < −0,15 | `neg[0]` | "evasão (−0,33 a −0,15)" |
| rotatividade | −0,15 ≤ iem ≤ +0,15 | `zero` | "rotatividade (−0,15 a +0,15)" |
| absorção | 0,15 < iem ≤ 0,33 | `pos[0]` | "absorção (+0,15 a +0,33)" |
| absorção forte | 0,33 < iem ≤ 0,60 | `pos[1]` | "absorção forte (+0,33 a +0,60)" |
| absorção muito forte | iem > 0,60 | `pos[2]` | "absorção muito forte (acima de +0,60)" |

`quebras = [0.15, 1/3, 0.60]` no formato que `corDivergente()` já aceita. Justificativa da
massa: a mediana de |IEM| municipal vai de 0,304 (1980) a 0,173 (2022) (metodologia, item 8), logo
a maior parte das unidades cai nas cinco classes centrais; 0,60 (D/O = 4) isola a cauda sem
esticar a escala até ±1. "muito forte" é rótulo só do mapa; a tipologia textual para em "forte".

**`tlm` — divergente, 7 classes**, `quebras = [10, 30, 80]` ‰:

| intervalo (‰) | cor | rótulo |
|---|---|---|
| < −80 | `neg[2]` | "perda acima de 80‰" |
| −80 a −30 | `neg[1]` | "perda de 30 a 80‰" |
| −30 a −10 | `neg[0]` | "perda de 10 a 30‰" |
| −10 a +10 | `zero` | "quase equilíbrio (±10‰)" |
| +10 a +30 | `pos[0]` | "ganho de 10 a 30‰" |
| +30 a +80 | `pos[1]` | "ganho de 30 a 80‰" |
| > +80 | `pos[2]` | "ganho acima de 80‰" |

Justificativa: 10‰ em cinco anos é ~0,2% ao ano, abaixo do que qualquer política percebe; 80‰
(8% da população em cinco anos) é o regime de fronteira agrícola / cidade nova, raro fora de
1980–1991. As quebras são fixas **inclusive para 1980**, onde a inflação do proxy empurra as
unidades para as classes externas — esse é o efeito que a escala fixa tem de mostrar, não
esconder.

**`tbi` — sequencial, 5 classes**, rampa `AZUL` de `paletas.ts` (validada, claridade monotônica),
`quebras = [25, 50, 80, 130]` ‰:

| intervalo (‰) | cor | rótulo |
|---|---|---|
| < 25 | `AZUL(0)` | "até 25‰" |
| 25–50 | `AZUL(1)` | "25 a 50‰" |
| 50–80 | `AZUL(2)` | "50 a 80‰" |
| 80–130 | `AZUL(3)` | "80 a 130‰" |
| ≥ 130 | `AZUL(4)` | "130‰ ou mais" |

**`tbe` — sequencial, 5 classes**, rampa `LARANJA` (mesmas quebras de `tbi`, para que imigração e
emigração sejam lidas na mesma régua). Azul/laranja repete a convenção entrada/saída de
`--arc-in`/`--arc-out` do resto do atlas.

As quatro listas de quebras vivem em `lib/serie.ts` como constantes exportadas
(`QUEBRAS_FIXAS = { iem: [...], tlm: [...], tbi: [...], tbe: [...] }`) e são a única fonte para
legenda e pintura; o teste da F12.5-t verifica que os cinco painéis recebem o mesmo array.

### 4.3 Paletas

- **Divergente** (`iem`, `tlm`): `DIVERGENTE` de `lib/escalas.ts` — 3 passos por braço + `zero`,
  já validada em claro e escuro, com o mesmo significado (vermelho = perda, azul = ganho) que o
  mapa principal. Não criar uma segunda divergente.
- **Sequencial** (`tbi`): `AZUL` de `lib/paletas.ts` (5 passos). **Sequencial** (`tbe`):
  `LARANJA` (5 passos). Ambas são rampas ordinais de matiz único já validadas pela skill dataviz.
  Não existe hoje nenhuma outra rampa sequencial no repo; não introduzir.
- Contorno das unidades: `--hairline`; unidade selecionada: `--ink`, 2 px.

### 4.4 As três tramas de ausência

Requisito: distinguíveis **sem cor**, em escala de cinza, nos dois temas, em polígonos pequenos
(RGI dentro de uma UF a ~200 px de largura) e na legenda. Todas usam um `<pattern>` SVG (ou
textura deck.gl equivalente) com traço em `--ink-muted` (#898781: 3,5:1 sobre claro, 4,9:1 sobre
escuro — medido) sobre fundo transparente (a superfície do mapa aparece por trás; **nenhuma trama
usa preenchimento sólido**). Motivo medido: o cinza "perto de zero" da divergente e o `NEUTRO`
das paletas ficam a 1,56:1 (claro) e 1,48:1 (escuro) — um sólido cinza para "não medido" seria
confundido com a classe central da escala.

| trama | forma | quando | tooltip |
|---|---|---|---|
| **Diagonal** | hachura simples a 45°, traço 1 px, passo 4 px | `nao_existia` (mun); `sem_cobertura` e `cobertura_insuficiente` (agregados); `rm_unitaria` | "Não existia em {ano}: território de {mãe}" / "Cobertura de {x}% em {ano}: menos de 90% da população de hoje" / "Região com um só município em {ano}" |
| **Cruzada** | hachura em 45° e 135° sobrepostas, traço 1 px, passo 5 px (fica visivelmente mais densa que a diagonal) | `suprimido` (R1/R2, e o `NULL` da harmonização de `status`) | "Suprimido em {ano}: abaixo do limiar de divulgação (n < 5)" |
| **Pontilhada** | pontos de 1,2 px em grade de 4 px | `nao_medido` (o quesito não existe na edição) | "Não medido: o Censo {ano} não pergunta {quesito}" |

Semântica das três famílias, que é o que a legenda diz em uma linha cada:
- diagonal = **"o território não é comparável"** (não existia / sem cobertura / cobertura
  insuficiente);
- cruzada = **"há dado, mas não pode ser publicado"** (sigilo);
- pontilhada = **"o censo não mediu"** (questionário).

Legenda: as três amostras aparecem **sempre**, abaixo das classes de cor, separadas por uma
linha `--hairline`, mesmo quando nenhuma unidade do mapa está ausente — a constância é o que
ensina o leitor a reconhecê-las. Ordem: diagonal, cruzada, pontilhada. Cada amostra é um
quadrado de 14 px com a trama e o texto ao lado; `aria-label` da legenda lista as três
explicitamente.

As mesmas três tramas são usadas **fora do mapa**: nas células da tabela (fundo da célula) e nas
posições vazias dos sparklines (um pequeno retângulo de 6×10 px com a trama no lugar do ponto).
Uma forma, um significado, em toda a seção. Quando um painel inteiro é `nao_medido` (ex.:
deslocamento pendular em 1991), o painel não renderiza mapa vazio: mostra um cartão da mesma
largura com fundo pontilhado e o texto "1991 não mede deslocamento pendular" (nota
`sem_pendular_1991`).

### 4.5 Inconsistências existentes que a F12.5 deve respeitar ou que o chamador deve decidir

Encontradas ao ler o código; **não corrigi nada**, só reporto:

1. **Unidade do IEM.** `App.tsx:590` multiplica `iem` por 100 para o mapa e `Legenda.tsx:33`
   rotula "Índice de eficácia migratória (%)"; `PainelMunicipio.tsx:211` mostra `num2(m.iem)`
   no índice [−1, 1]; `comparabilidade_regras.py` define os limiares no índice. A série deve
   usar o **índice** (duas casas), coerente com a tipologia e com o painel — e a divergência com a
   legenda do mapa principal fica registrada para a F12.6-aud decidir se o mapa principal também
   passa a usar o índice.
2. **Limiares da classificação inline.** `PainelMunicipio.tsx:213` classifica com ±0,10
   ("atração consolidada" / "trocas equilibradas") enquanto a fonte única usa ±0,15 e 1/3 com
   guarda estatística. Quando a série entrar, o painel de cada edição mostrará uma classe e a
   série outra para o mesmo município e o mesmo ano — a F12.5 deve trocar o painel para
   `classificarIem()` de `lib/serie.ts` (ou o chamador decide manter os dois vocabulários, o que
   não recomendo).
3. **Paleta sequencial.** Não há rampa sequencial em `escalas.ts`; a reutilização de
   `AZUL`/`LARANJA` de `paletas.ts` para `tbi`/`tbe` é a única opção sem cor nova, mas o
   contraste entre passos adjacentes é baixo (`AZUL(0)`×`AZUL(1)` = 1,42:1, medido) — em 5
   classes num polígono pequeno isso é aceitável só porque a legenda e o tooltip trazem o
   número; recomendo que os small multiples sequenciais tenham hover sincronizado obrigatório.
4. **`BarraPerfil` e `PiramideIdadeSexo`** precisam de duas props novas pequenas (`motivoVazio`
   e `maiorPct`), descritas em 3.4. Sem `maiorPct`, as pirâmides reescalam por painel.

---

## 5. Glossário de siglas (tooltips)

Cada sigla, na primeira ocorrência de cada bloco, é um `<abbr>` com `title` igual à frase abaixo
e um botão "?" que abre a definição completa com a referência. O glossário inteiro fica no fim
da seção, como lista `<dl>` com âncoras (`#gl-iem` etc.).

| Sigla | Expansão | Definição em português claro |
|---|---|---|
| **IEM** (MEI) | Índice de eficácia migratória (*migration effectiveness index*) | Diferença entre quem chegou e quem saiu, dividida pela soma dos dois. Vai de −1 (só saída) a +1 (só entrada); perto de zero, entra e sai quase o mesmo tanto. Não depende do tamanho do lugar. |
| **CMI** | Taxa bruta de intensidade migratória (*crude migration intensity*) | Porcentagem da população que mudou de município no período, no conjunto de unidades do nível. Cresce quando a malha tem mais unidades, por isso só se compara dentro do mesmo nível. |
| **SMI** | Intensidade migratória padronizada por idade (*standardised migration intensity*) | A CMI recalculada como se a população tivesse sempre a estrutura etária de 2022: separa a mudança de comportamento do envelhecimento. |
| **MEI agregado** | Índice de eficácia migratória do sistema | Metade da soma dos saldos absolutos de todas as unidades, dividida pelo total de migrantes, em %. Mede quanto da migração redistribui população de fato. |
| **ANMR** | Taxa líquida agregada de migração (*aggregate net migration rate*) | Quanto da população foi redistribuída entre unidades pela migração, em %. É igual a CMI × MEI ÷ 100: junta "quanta gente se move" com "quão desequilibrados são os fluxos". |
| **β de Fielding** | Coeficiente de Fielding | Inclinação da reta que relaciona a taxa líquida de migração de cada unidade com a sua densidade (em escala logarítmica). Positivo: a população se concentra nas áreas densas; negativo: se desconcentra; perto de zero: equilíbrio. |
| **Duncan D** | Índice de dissimilaridade de Duncan | Fração dos migrantes que precisaria trocar de par origem→destino para a estrutura de um censo ficar igual à do anterior. 0 = mesma estrutura; 1 = totalmente diferente. |
| **MMD** | Distância média da migração (*mean migration distance*) | Distância média, em km entre centros dos municípios, percorrida por quem migrou para ou de esta unidade, ponderada pelo número de pessoas. |
| **MedMD** | Distância mediana da migração | Distância abaixo da qual ficou metade dos migrantes. Menos sensível que a média a poucos fluxos muito longos. |
| **Gini** (de linha / de coluna) | Índice de Gini da concentração dos fluxos | 0 quando os migrantes vêm (ou vão) em partes iguais de muitos lugares; perto de 1 quando quase todos vêm (ou vão) de um só. |
| **OR** | Razão de chances (*odds ratio*) de seletividade | Quantas vezes a chance de um migrante ter, por exemplo, ensino superior é maior (OR > 1) ou menor (OR < 1) que a de um residente. |
| **TBI / TBE / TLM** | Taxas brutas de imigração e emigração; taxa líquida de migração | Chegadas, saídas e saldo por mil habitantes de 5 anos ou mais, no quinquênio. |
| **IC 95%** | Intervalo de confiança de 95% | Faixa dentro da qual o valor verdadeiro estaria em 95 de 100 amostras como esta. |
| **CV** | Coeficiente de variação | Erro-padrão dividido pela estimativa, em %. Acima de 25% o número é impreciso. |
| **n** | Tamanho da amostra | Número de pessoas da amostra do censo por trás da estimativa (não é o número de migrantes). |
| **proxy (1980)** | Proxy de data fixa | Em 1980 o censo não pergunta onde a pessoa morava cinco anos antes; a migração é estimada por "última mudança + tempo de residência", calibrada contra 1991. |
| **RGI / RGInt / RM** | Região geográfica imediata / intermediária; região metropolitana | Recortes do IBGE de 2022, aplicados a todos os censos. |

---

## 6. Comportamento a 400 px e teclado

### 6.1 Layout estreito (≤ 700 px, testado a 400 px)

- **Seção completa** ocupa a tela (`.pagina-cheia` já é 100%); o índice dos quatro blocos vira
  uma barra horizontal fixa no topo com scroll (`.barra-ferramentas` já tem esse padrão), com o
  bloco visível destacado (`aria-current`).
- **Camada 1**: frase em largura total; os 3 números empilham em **uma coluna** (não 2×2: três
  itens em 2×2 deixam um buraco), cada um com o sparkline à direita do valor.
- **Tabela com sparkline** (Bloco 1, Bloco 3): a coluna "Medida" fica **fixa** (`position:
  sticky; left: 0`) e as cinco colunas de edição rolam horizontalmente dentro de
  `.tabela-scroll`; um indicador de sombra na borda direita + texto "deslize para ver 1980–2010"
  quando há overflow; a coluna "tend." (sparkline) também fica sticky para o gestor ler sem rolar.
- **Gráficos de apoio** (TLM, IEM, taxas): empilham em uma coluna, largura total, altura 140 px.
- **Plano MEI × CMI, Fielding, Courgeau**: largura total, um abaixo do outro. A dispersão de
  Fielding, que são 5 painéis, vira **grid 2 colunas × 3 linhas** (o sexto slot recebe a legenda
  da reta), com os eixos só no primeiro painel de cada linha.
- **Small multiples de mapa**: **grid 2×3** (2022 e 2010 na primeira linha, 2000 e 1991 na
  segunda, 1980 e a legenda na terceira). Não é carrossel: carrossel esconde a comparação, que
  é o objetivo do mapa. Cada painel a 170 px de largura; abaixo de 360 px de viewport, 1 coluna
  e legenda ao fim. O hover sincronizado vira toque: tocar uma unidade num painel realça nos
  cinco e abre o tooltip fixo abaixo do grid (não flutuante).
- **Acordes**: um só diagrama com seletor segmentado de edição (não 5).
- **Barras 100%**: já responsivas; rótulo da série ("1980 (proxy)") acima da barra em vez de à
  esquerda (`.perfil-linha` em coluna).
- **Pirâmides**: 2 colunas × 3 linhas, mesma regra do Fielding.
- **Camada 3** (`<details>`): tabela completa rola horizontalmente com a primeira coluna sticky;
  botões "Baixar CSV"/"PNG" em largura total.

### 6.2 Teclado e foco

Ordem de tabulação, de cima para baixo:

1. Botão fechar (recebe foco ao abrir, como `PaginaMetodologia`; `Esc` fecha; ao fechar, o foco
   volta ao botão "Ver a série completa" que abriu).
2. Índice dos blocos (4 links âncora).
3. Camada 1: a frase não é focável; cada `<abbr>` tem o botão "?" focável; os 3 números são
   `role="group"` com `aria-label` = valor + detalhe + resumo do sparkline ("1980: +24,1‰ proxy;
   1991: …").
4. Por bloco: título → seletor (medida do mapa / direção do perfil / edição do acordes, como
   botões segmentados com setas ← →) → gráfico (`role="img"` com `aria-label` descritivo **ou**,
   quando há elementos interativos como as unidades do mapa e as cordas do acordes, cada elemento
   com `tabIndex=0` e `role="button"`, como `DiagramaAcordes` já faz) → link "tabela equivalente"
   → `<details>` da camada 3 → botões de download.
5. No mapa comparativo, `Tab` percorre as unidades **do primeiro painel** só; `Enter` seleciona
   a unidade nos cinco e move o foco ao tooltip fixo; `Esc` no tooltip volta ao painel. Percorrer
   as unidades dos cinco painéis por `Tab` seria 5× a lista — o realce sincronizado torna isso
   desnecessário.
6. Nas tabelas, `Tab` entra na tabela e as setas navegam células (padrão grid) — apenas na camada
   3; a tabela da camada 2 é estática (só leitura, sem foco por célula).
7. Botão "Abrir a série de {mãe}" é um `<button>` comum, e o aviso `municipio_mae` no topo é
   `role="note"`, anunciado quando a seção abre (`aria-live="polite"` no container do aviso).

Foco visível: usar o mesmo anel de `:focus-visible` dos botões do atlas. Movimento reduzido:
nenhuma animação de trajetória no plano MEI × CMI quando `prefers-reduced-motion`.

---

## 7. Checklist de aceite (F12.5 → base da F12.6-aud)

Roteiro no navegador (Chrome, claro e escuro, 1280 px e 400 px), com **um caso por linha**:

**Truncamento e território**
- [ ] Palmas/TO (`?n=mun&mun=1721000&pagina=serie`): 1980 com hachura diagonal em **todos** os
      sparklines, gráficos e tabelas; frase T3 nomeia "Norte de Goiás (atual Tocantins)"; botão
      abre a série de `NORTEGO` com o aviso de unidade agregada; nenhum "0" em 1980.
- [ ] Mojuí dos Campos/PA: só 2022 com número; frase T5; mãe = Santarém; botão abre Santarém.
- [ ] Santarém/PA: aviso `municipio_mae` no topo; linha "fronteira mudou" em 2010→2022 nos gráficos
      de volume e **não** nos de taxa/IEM.
- [ ] Sobral/CE (1:1): série completa, sem aviso de mãe, frase T1 ou T2 com ressalva de proxy.
- [ ] RGI vazia em 1980 (uma das 21): célula 1980 "sem cobertura" com hachura diagonal; mapa
      comparativo pinta a região com hachura no painel 1980 e com cor nos outros quatro.
- [ ] RM com cobertura < 90% em 1980: "cobertura insuficiente" + percentual no tooltip; 2022–1991
      com número e selo "cobertura x%" quando parcial.
- [ ] RM de Porto Velho em 1991 e 1980: indicadores intra-RM "cobertura insuficiente — um só
      município"; total da RM publicado.
- [ ] Tocantins (UF) em 1980: número com nota `unidade_agregada_1980`; nada de composição interna.

**Ausências e comparabilidade**
- [ ] Deslocamento pendular em 1991: painel/cartão pontilhado "não medido", nota `sem_pendular_1991`;
      nunca zero, nunca hachura diagonal.
- [ ] Renda em 1980: "não medido"; erro amostral em 1980: coluna `se`/`cv` "não medido"; conectividade
      em 1980: "não comparável" **sem** trama (é ausência da medida).
- [ ] Um par suprimido em alguma edição (Bloco 3): hachura cruzada + "supr."; posto ausente.
- [ ] Nenhuma célula com `estado = nao_comparavel` exibe número (varrer o DOM: nenhum dígito
      dentro de `.celula-nao-comparavel`).
- [ ] 1980 sempre com "(proxy)" no rótulo, losango vazado no ponto, e o valor calibrado entre
      parênteses **só** nas medidas com `calibracao_1980`; o calibrado nunca aparece em gráfico.
- [ ] Toda ressalva (`comparavel_com_ressalva`) tem o ⓘ e o tooltip resolve a chave de
      `comparabilidade.json → notas` (nenhum tooltip mostrando a chave crua, ex. "proxy_1980_volume").

**Números**
- [ ] Os valores de 2022, 2010, 2000, 1991 e 1980 da tabela do Bloco 1 são **idênticos** aos KPIs
      do painel da edição correspondente para a mesma unidade (abrir lado a lado).
- [ ] `ANMR = CMI × MEI / 100` bate na tabela do Bloco 2 (duas casas).
- [ ] IEM mostrado no índice [−1, 1] com duas casas e sinal; classe da frase = classe do mapa
      = classe de `classificarIem()`; municípios pequenos com |IEM| ≥ 0,15 e margem maior que o
      valor aparecem como "indefinido", não como "rotatividade".
- [ ] Frase-síntese: nenhuma frase afirma tendência entre 1980 e a edição seguinte quando
      |ΔIEM| < 0,10 (T8).

**Cartografia**
- [ ] As cinco malhas do mapa comparativo usam **o mesmo array de quebras** (inspecionar a prop;
      não confiar no olho): `iem [0.15, 0.333, 0.60]`, `tlm [10, 30, 80]`, `tbi/tbe [25, 50, 80, 130]`.
- [ ] Coroplético só para `iem`, `tlm`, `tbi`, `tbe`; nenhuma opção de volume no seletor.
- [ ] Legenda única para os cinco painéis, com as **três tramas sempre presentes**, na ordem
      diagonal · cruzada · pontilhada.
- [ ] Captura em escala de cinza (DevTools → Rendering → emulate `grayscale`): as três tramas se
      distinguem entre si e da classe central da escala.
- [ ] Hover/toque numa unidade realça nos cinco painéis e o tooltip lista os cinco valores.
- [ ] Projeção Albers (comparar o contorno com o mapa principal; nada de Mercator).
- [ ] Nível `mun`: o mapa municipal só carrega após o clique "Carregar os mapas municipais".

**Acessibilidade e responsividade**
- [ ] `Tab` percorre: fechar → índice → "?" das siglas → grupos de números → por bloco (seletor →
      gráfico/itens → tabela equivalente → details → download). `Esc` fecha e devolve o foco ao
      gatilho.
- [ ] Cada gráfico tem tabela equivalente alcançável por teclado e leitor de tela (`aria-describedby`
      ou link "tabela equivalente").
- [ ] Contraste AA: `npm test` (suíte `contraste-cor`) estendida às cores usadas na seção; texto
      pequeno nunca em `--ink-muted` (usar `--ink-muted-texto`).
- [ ] A 400 px: nada corta horizontalmente sem indicador de rolagem; primeira coluna das tabelas
      fixa; mapas em 2×3; nenhum tooltip flutuante fora da tela; seção inteira navegável por toque.
- [ ] Tema escuro: paletas `escuro` em todos os gráficos e mapas; tramas legíveis.
- [ ] `prefers-reduced-motion`: sem animação de trajetória.

**URL, estado e desempenho**
- [ ] `?pagina=serie` abre/fecha com `pushState`/`popstate` (voltar do navegador fecha a seção);
      `?serie=1` expande o resumo; a camada aberta (2/3) **não** aparece na URL.
- [ ] Trocar de edição no cabeçalho com a seção aberta **não** muda a série (ela é independente
      da edição ativa) — só o painel de fundo.
- [ ] Conexão `serie` separada das cinco conexões por edição (`duckdb.ts`); os cinco parquets
      da série carregam uma vez; console limpo (sem erro nem warning de React).
- [ ] Exportação CSV de cada bloco contém as colunas `n`, `se`, `cv`, `estado`, `nota`; PNG
      inclui título, legenda e a linha de ressalva.

---

## 8. Resumo das decisões

1. **Três camadas, uma vista**: a síntese é sempre visível; gráficos e tabela abrem; a camada
   aberta não vai à URL. O nível é contexto fixo da seção — não existe vista que compare níveis,
   exceto a figura de Courgeau, feita para isso.
2. **Frase-síntese determinística** sobre a tipologia de Baeninger (`classificar_iem`), com oito
   templates (T1–T8) mais a tabela de complemento por direção de entradas/saídas, ressalva de proxy obrigatória
   quando 1980 é âncora, ressalva de cobertura por edição, e uma trava (T8) contra afirmar
   tendência menor que a incerteza do proxy.
3. **Quebras fixas** que **são** a tipologia: `iem [0,15; 1/3; 0,60]`, de modo que legenda do
   mapa, classe da frase e regra da fonte única coincidam; `tlm [10; 30; 80]‰`; `tbi/tbe [25; 50;
   80; 130]‰`. Paletas: `DIVERGENTE` de `escalas.ts` para `iem`/`tlm`; `AZUL`/`LARANJA` de
   `paletas.ts` para `tbi`/`tbe`. Nenhuma cor nova.
4. **Três tramas sem preenchimento sólido**: diagonal (território não comparável: não existia,
   sem cobertura, cobertura insuficiente, RM unitária), cruzada (suprimido) e pontilhada (não
   medido). Sólido cinza foi descartado por medida: 1,5:1 contra a classe central da divergente.
   As mesmas tramas valem no mapa, na tabela e no sparkline.
5. **Dois ajustes de componente** (props `motivoVazio` em `BarraPerfil`, `maiorPct` em
   `PiramideIdadeSexo`) e **duas inconsistências pré-existentes** a decidir (IEM em % no mapa
   principal vs. índice; limiar ±0,10 inline em `PainelMunicipio` vs. ±0,15 da fonte única).
