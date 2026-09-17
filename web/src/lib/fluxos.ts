/** Geometria dos fluxos migratórios no mapa (F11, edição "mapa-representação").
 *
 *  Por que isto existe: o `ArcLayer` (ver `lib/arcos.ts`) resolveu a curvatura visível sob
 *  `OrthographicView` (giro para o plano XY, `TILT_ARCO`), mas o `ArcLayer` nativo tem duas
 *  limitações que não dão para contornar com as props que ele expõe: (1) `getWidth` é um
 *  escalar por arco, não por vértice -- a fita não pode afinar ao longo da curva; e (2) a
 *  seta separada (`poligonoSeta`) só tinha a CORDA reta origem->destino disponível como
 *  direção, porque reproduzir a tangente real da parábola do `ArcLayer` em JS replicaria o
 *  shader inteiro. Este módulo substitui as duas camadas por UM polígono por fluxo -- fita +
 *  seta juntas --, desenhado com matemática própria (Bézier quadrática), o que dá acesso à
 *  largura variável por ponto e à tangente exata em qualquer ponto da curva.
 *
 *  Convenção de curvatura: mantemos o mesmo lado de `TILT_ARCO = -90` (ver `lib/arcos.ts`),
 *  para não reabrir a mesma inversão de tinta sobre o oceano medida naquela fase, e para
 *  continuar separando pares recíprocos A->B/B->A sem regra por par (Tobler 1987). O sinal
 *  foi conferido contra o shader do `ArcLayer` (`arc-layer-vertex.glsl.ts`,
 *  `interpolateFlat`): com `tiltAngle = -90°`, `tilt = perp(direção) * z * sin(-90°) =
 *  -perp(direção) * z`, ou seja, o deslocamento vai para `(dy, -dx)` (a direção de viagem
 *  `(dx, dy)` girada 90° no sentido HORÁRIO), não para `(-dy, dx)` (a rotação anti-horária
 *  usada em `poligonoSeta`, que só define os dois lados simétricos da base do triângulo, sem
 *  compromisso de lado). `perpendicular` abaixo usa essa mesma rotação horária.
 */

import { flechaDoArco } from "./arcos";

/** Pontos amostrados ao longo de cada fita, entre a origem e o início da seta -- fixa a
 *  contagem de vértices do polígono (2N + 3, ver `poligonoFluxo`) e a suavidade da curva.
 *  24 é o mesmo tipo de compromisso já usado alhures no mapa (ex. malha de arestas): visível
 *  como curva suave a olho nu, sem inflar o polígono por fluxo (o mapa desenha até ~150
 *  fluxos simultâneos na vista Brasil). */
export const N_AMOSTRAS_CURVA = 24;

/** Amostragem fina, só para inverter comprimento de arco -> parâmetro `t` da Bézier (achar
 *  o ponto exatamente a X metros do destino, medidos AO LONGO da curva, não em linha reta).
 *  Não afeta a contagem de vértices do polígono publicado -- é um cálculo interno, descartado
 *  depois de achar o `t` procurado. */
const RESOLUCAO_COMPRIMENTO = 240;

/** Meia-largura da fita no FIM (logo antes da seta) como fração da meia-largura na origem --
 *  é o afunilamento que dá a leitura de direção "de olho", antes mesmo de reparar na seta.
 *  0,3 (perde 70% da largura) veio de ajuste visual: menor que isso e a ponta da fita fica
 *  fina demais para ler volume por perto da seta; maior, e o afunilamento quase não aparece. */
export const FRACAO_LARGURA_FINAL = 0.3;

/** Raio do nó (círculo de origem/destino), em pixels -- MESMA constante usada por
 *  `MapaAtlas.tsx` para desenhar o `ScatterplotLayer` dos nós (`RAIO_NO_PX`), para a ponta da
 *  seta encostar exatamente na borda do círculo, sem sobrepor nem deixar vão. */
export const RAIO_NO_PX = 4;

/** Comprimento da seta (da base ao ápice), em pixels. */
export const COMPRIMENTO_SETA_FLUXO_PX = 15;

/** Meia-largura da base da seta, como múltiplo da meia-largura da fita NA ORIGEM (não na
 *  ponta afunilada). Calibrado na verificação visual: medir a base sobre a largura JÁ
 *  afunilada (0,3 da original) fazia a seta sair mais estreita que a própria fita -- ela
 *  sumia, e a direção voltava a depender só do afunilamento. Sobre a largura de origem, a
 *  seta cresce junto com o volume do fluxo, como na referência visual. */
export const LARGURA_BASE_SETA_FATOR = 0.7;

/** Piso da meia-largura da base da seta, em pixels -- a maioria dos fluxos desenha perto da
 *  largura mínima (~1,5px, `LARGURA_MIN` em MapaAtlas.tsx), e sem este piso a seta ficaria
 *  com ~1px de base: invisível. 5 dá uma base de 10px -- na verificação visual, 7px ainda
 *  empatava com o diâmetro do nó (9px) e a seta não se destacava do círculo. */
export const MEIA_BASE_SETA_MIN_PX = 5;

/** Fração máxima do comprimento da curva que os custos FIXOS em pixels (raio do nó +
 *  comprimento da seta) podem ocupar. Acima disso, nó/seta/base são escalados para caber --
 *  ver o comentário em `poligonoFluxo`. 0,55 deixa pelo menos 45% da curva como fita, o que
 *  ainda lê como fluxo (e não como uma seta solta) no pior caso. */
export const FRACAO_MAXIMA_CUSTO_FIXO = 0.55;

/** Fração máxima do comprimento da curva que a LARGURA total da fita (e a base da seta) podem
 *  ocupar. Mesmo motivo de `FRACAO_MAXIMA_CUSTO_FIXO`, para o outro eixo: a largura também é
 *  fixada em pixels, e num fluxo curto visto de longe uma fita de 6px vale 43 km sobre um vão
 *  de 15 km -- o polígono sai mais largo que comprido, uma mancha em vez de uma seta. 0,35
 *  mantém a fita sempre pelo menos ~3x mais longa que larga, que é o que ainda lê como fluxo. */
export const FRACAO_MAXIMA_LARGURA = 0.35;

/** Um ponto 2D simples -- Bézier não precisa de mais que isso. */
export type Ponto = [number, number];

/** Ponto da Bézier QUADRÁTICA `P0`(origem) -> `C`(controle) -> `P2`(destino) no parâmetro
 *  `t` em [0, 1]. `B(t) = (1-t)²P0 + 2(1-t)t·C + t²P2`. */
function bezierPonto(p0: Ponto, c: Ponto, p2: Ponto, t: number): Ponto {
  const u = 1 - t;
  return [
    u * u * p0[0] + 2 * u * t * c[0] + t * t * p2[0],
    u * u * p0[1] + 2 * u * t * c[1] + t * t * p2[1],
  ];
}

/** Tangente (não normalizada) da Bézier em `t`: `B'(t) = 2(1-t)(C-P0) + 2t(P2-C)`. Nunca é o
 *  vetor nulo para P0 != P2 e C fora do segmento P0-P2 (o caso de qualquer fluxo com flecha >
 *  0, que é todo fluxo com vão > 0 -- ver `flechaDoArco`), então não precisa de guarda contra
 *  divisão por zero na normalização de quem chama. */
function bezierTangente(p0: Ponto, c: Ponto, p2: Ponto, t: number): Ponto {
  const u = 1 - t;
  return [
    2 * u * (c[0] - p0[0]) + 2 * t * (p2[0] - c[0]),
    2 * u * (c[1] - p0[1]) + 2 * t * (p2[1] - c[1]),
  ];
}

/** Perpendicular de um vetor de direção (não precisa estar normalizado), rotacionado 90° no
 *  sentido HORÁRIO -- o mesmo lado que `getTilt = -90` no `ArcLayer` produz (ver o comentário
 *  no topo do arquivo). Devolve um vetor não normalizado (mesma norma do vetor de entrada);
 *  quem chama normaliza quando precisa de um deslocamento de comprimento definido. */
function perpendicularHoraria([dx, dy]: Ponto): Ponto {
  return [dy, -dx];
}

function norma([x, y]: Ponto): number {
  return Math.hypot(x, y);
}

function normalizado(v: Ponto): Ponto {
  const n = norma(v);
  return n > 1e-12 ? [v[0] / n, v[1] / n] : [0, 0];
}

function distancia(a: Ponto, b: Ponto): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

/** Pontos da Bézier quadrática em `n + 1` amostras igualmente espaçadas em `t`, de `0` a
 *  `tFinal` (default 1 = a curva inteira, até o destino). Exportada para teste/depuração --
 *  é a mesma amostragem que `poligonoFluxo` usa para desenhar os dois lados da fita, só que
 *  aqui devolve os pontos da LINHA DE CENTRO, não os dois lados já deslocados pela largura. */
export function pontosCurva(p0: Ponto, c: Ponto, p2: Ponto, n: number = N_AMOSTRAS_CURVA, tFinal = 1): Ponto[] {
  const pontos: Ponto[] = [];
  for (let i = 0; i < n; i++) {
    const t = (tFinal * i) / (n - 1);
    pontos.push(bezierPonto(p0, c, p2, t));
  }
  return pontos;
}

/** Ponto de controle da Bézier: o meio da corda origem-destino, deslocado perpendicularmente
 *  (sentido horário -- ver `perpendicularHoraria`) por `2 × flechaDoArco(vão)`. O fator 2 não
 *  é arbitrário: o desvio da curva em relação à CORDA, no ponto médio (t=0,5), de uma Bézier
 *  quadrática é exatamente METADE do deslocamento do ponto de controle em relação ao mesmo
 *  ponto médio (`B(0,5) - médio(P0,P2) = (C - médio(P0,P2)) / 2`). Compensando com ×2, a
 *  flecha VISÍVEL desta curva fica igual à do `ArcLayer` que ela substitui -- mesma curvatura
 *  medida e calibrada em `lib/arcos.ts` (teto de 150km, fração de 30% do vão nos fluxos
 *  curtos), sem recalibrar nada aqui. */
function pontoControle(xo: number, yo: number, xd: number, yd: number): Ponto {
  const dx = xd - xo, dy = yd - yo;
  const vao = Math.hypot(dx, dy);
  const flecha = flechaDoArco(vao);
  const perp = normalizado(perpendicularHoraria([dx, dy]));
  const meioX = (xo + xd) / 2, meioY = (yo + yd) / 2;
  return [meioX + perp[0] * 2 * flecha, meioY + perp[1] * 2 * flecha];
}

/** Acha o parâmetro `t` da Bézier cujo ponto fica a `alvoM` metros do DESTINO (`t = 1`),
 *  medidos ao longo da curva (comprimento de arco), não em linha reta -- é o que recua a fita
 *  antes do nó de destino/da seta pela distância real percorrida pela curva ali, não pela
 *  corda. Sem forma fechada para o comprimento de arco de uma Bézier quadrática; resolvido
 *  por amostragem fina (`RESOLUCAO_COMPRIMENTO`) e interpolação linear dentro do segmento que
 *  contém o alvo -- preciso o bastante para um recuo de poucos pixels (a curvatura dentro de
 *  1/240 do parâmetro é desprezível). Se `alvoM` for maior que o comprimento inteiro da curva
 *  (fluxo mais curto que o recuo, praticamente não ocorre nos dados -- o recuo é de poucos
 *  metros no zoom típico), devolve `0` (recua até a origem, no limite).
 */
/** Comprimento total da curva, em metros (mesma amostragem de `tAComprimentoDoDestino`) --
 *  usado para limitar os custos FIXOS em pixels (nó + seta) ao tamanho do próprio fluxo. */
function comprimentoDaCurva(p0: Ponto, c: Ponto, p2: Ponto): number {
  const passo = 1 / RESOLUCAO_COMPRIMENTO;
  let anterior = p0;
  let total = 0;
  for (let i = 1; i <= RESOLUCAO_COMPRIMENTO; i++) {
    const atual = bezierPonto(p0, c, p2, i * passo);
    total += distancia(anterior, atual);
    anterior = atual;
  }
  return total;
}

function tAComprimentoDoDestino(p0: Ponto, c: Ponto, p2: Ponto, alvoM: number): number {
  if (alvoM <= 0) return 1;
  const passo = 1 / RESOLUCAO_COMPRIMENTO;
  let tAnterior = 1;
  let ptAnterior = p2;
  let acumulado = 0;
  for (let i = 1; i <= RESOLUCAO_COMPRIMENTO; i++) {
    const tAtual = 1 - i * passo;
    const ptAtual = bezierPonto(p0, c, p2, tAtual);
    const seg = distancia(ptAnterior, ptAtual);
    if (acumulado + seg >= alvoM) {
      const fracao = seg > 1e-12 ? (alvoM - acumulado) / seg : 0;
      return tAnterior - fracao * passo;
    }
    acumulado += seg;
    tAnterior = tAtual;
    ptAnterior = ptAtual;
  }
  return 0;
}

export interface OpcoesFluxo {
  /** número de amostras da fita entre a origem e a base da seta; default `N_AMOSTRAS_CURVA` */
  n?: number;
  /** fração da meia-largura no fim da fita; default `FRACAO_LARGURA_FINAL` */
  fracaoLarguraFinal?: number;
  /** raio do nó de destino, em pixels; default `RAIO_NO_PX` */
  raioNoPx?: number;
  /** comprimento da seta, em pixels; default `COMPRIMENTO_SETA_FLUXO_PX` */
  comprimentoSetaPx?: number;
  /** múltiplo da largura da fita usado como base da seta; default `LARGURA_BASE_SETA_FATOR` */
  larguraBaseSetaFator?: number;
}

/** Polígono fechado (fita afunilando + seta) de um fluxo origem->destino, em METROS (Albers) --
 *  pronto para um único `SolidPolygonLayer` (uma triangulação por fluxo, em vez de duas
 *  camadas separadas como antes). `null` se origem e destino coincidirem (vão degenerado,
 *  direção indefinida -- não deveria ocorrer nos dados).
 *
 *  Construção (ver comentários das funções auxiliares acima para a matemática de cada peça):
 *  1. Bézier quadrática origem->controle->destino, controle deslocado perpendicularmente à
 *     corda (mesmo lado de `TILT_ARCO = -90`), com a mesma flecha (fração do vão, teto em
 *     metros) já calibrada em `lib/arcos.ts`.
 *  2. A fita para ANTES do destino -- recuo = raio do nó + comprimento da seta, medido ao
 *     longo da curva (`tAComprimentoDoDestino`), não na corda.
 *  3. Meia-largura da fita cai linearmente de `larguraPx/2` (na origem) até
 *     `fracaoLarguraFinal × larguraPx/2` (na base da seta), amostrada em `n` pontos.
 *  4. A seta é um triângulo cuja ponta fica a `raioNoPx` do destino (não no destino -- o nó
 *     circular cobre esse raio), alinhado à TANGENTE da curva ali (não à corda), com base
 *     `larguraBaseSetaFator` vezes a largura (cheia) da fita na base da seta.
 *  5. Vértices, nesta ordem (evita autointerseção em curvatura normal): lado esquerdo da fita
 *     origem->base da seta, base esquerda da seta, ponta, base direita da seta, lado direito
 *     da fita de volta à origem. */
export function poligonoFluxo(
  xOrigem: number, yOrigem: number, xDestino: number, yDestino: number,
  larguraPx: number, metrosPorPixelAtual: number, opts: OpcoesFluxo = {},
): Ponto[] | null {
  const dx = xDestino - xOrigem, dy = yDestino - yOrigem;
  if (!(Math.hypot(dx, dy) > 1e-6)) return null;

  const n = Math.max(2, opts.n ?? N_AMOSTRAS_CURVA);
  const fracaoFinal = opts.fracaoLarguraFinal ?? FRACAO_LARGURA_FINAL;
  const fatorBaseSeta = opts.larguraBaseSetaFator ?? LARGURA_BASE_SETA_FATOR;

  const p0: Ponto = [xOrigem, yOrigem];
  const p2: Ponto = [xDestino, yDestino];
  const c = pontoControle(xOrigem, yOrigem, xDestino, yDestino);

  // Toda a geometria abaixo é dimensionada em PIXELS e convertida em metros pelo zoom atual --
  // e num fluxo curto visto de longe esses tamanhos fixos podem ser MAIORES que o próprio
  // fluxo. Achado em produção: ao entrar numa RM, os fluxos intra-RM (10-20 km) chegam enquanto
  // a vista ainda está no zoom nacional (~7.100 m/px), onde uma seta de 15px vale 106 km e uma
  // fita de 6px vale 43 km -- a geometria degenerava numa cunha gigante (medido: um fluxo de
  // 15 km virava um polígono de 24x67 km) que cobria o mapa até a vista alcançar o zoom da RM.
  // A defesa é a mesma nos dois eixos: limitar tudo a uma fração do COMPRIMENTO DA CURVA, de
  // modo que a forma seja sempre proporcional ao próprio fluxo, em qualquer zoom e em qualquer
  // ordem de chegada dos dados -- a seta fica menor que o ideal nesse instante, em vez de
  // explodir. Em zoom compatível com o fluxo (o caso normal) nenhum limite chega a morder.
  const comprimentoCurvaM = comprimentoDaCurva(p0, c, p2);

  // (a) LARGURA: fita cheia (2 x meia-largura) limitada a `FRACAO_MAXIMA_LARGURA` da curva.
  const larguraMaximaPx = (FRACAO_MAXIMA_LARGURA * comprimentoCurvaM) / metrosPorPixelAtual;
  const larguraEfetivaPx = Math.min(larguraPx, larguraMaximaPx);

  // Meia-base primeiro: o COMPRIMENTO da seta acompanha a base nos fluxos grossos, senão um
  // fluxo de 14px de largura ganharia uma base larga com um triângulo curto e achatado. O piso
  // em pixels (`MEIA_BASE_SETA_MIN_PX`) também entra no limite de largura -- é ele que domina
  // na maioria dos fluxos, e sem limitá-lo a base sozinha continuaria estourando o vão.
  let meiaBaseSetaPx = Math.max(fatorBaseSeta * (larguraEfetivaPx / 2), MEIA_BASE_SETA_MIN_PX);
  meiaBaseSetaPx = Math.min(meiaBaseSetaPx, larguraMaximaPx / 2);
  const comprimentoSetaPx = Math.max(
    opts.comprimentoSetaPx ?? COMPRIMENTO_SETA_FLUXO_PX, 1.25 * meiaBaseSetaPx,
  );

  // (b) COMPRIMENTO: custos fixos ao longo da curva (raio do nó + seta) limitados a
  // `FRACAO_MAXIMA_CUSTO_FIXO` da curva, deixando o resto para a fita.
  let raioNoM = (opts.raioNoPx ?? RAIO_NO_PX) * metrosPorPixelAtual;
  let comprimentoSetaM = comprimentoSetaPx * metrosPorPixelAtual;
  const custoFixoM = raioNoM + comprimentoSetaM;
  const custoMaximoM = FRACAO_MAXIMA_CUSTO_FIXO * comprimentoCurvaM;
  const escalaCusto = custoFixoM > custoMaximoM && custoFixoM > 0 ? custoMaximoM / custoFixoM : 1;
  raioNoM *= escalaCusto;
  comprimentoSetaM *= escalaCusto;

  // t onde a fita termina (base da seta) e t onde a ponta da seta fica -- ambos medidos como
  // comprimento de arco a partir do destino, não como distância em linha reta.
  const tBaseSeta = tAComprimentoDoDestino(p0, c, p2, raioNoM + comprimentoSetaM);
  const tPonta = tAComprimentoDoDestino(p0, c, p2, raioNoM);

  const meiaLarguraPx = (t: number) => {
    // `t / tBaseSeta` normaliza para [0, 1] dentro do trecho que a fita de fato ocupa (que
    // pode ser bem menor que [0, 1] inteiro em fluxos curtos/zoom aproximado) -- sem isso o
    // afunilamento demoraria a aparecer em fluxos onde a fita só cobre uma fração pequena da
    // curva. `tBaseSeta` é sempre > 0: vem de `tAComprimentoDoDestino`, que só devolve 0
    // quando o recuo pedido é maior que a curva inteira (fluxo degenerado/vão quase nulo).
    const fracao = tBaseSeta > 1e-9 ? Math.min(1, t / tBaseSeta) : 0;
    return (larguraEfetivaPx / 2) * (1 - fracao * (1 - fracaoFinal));
  };

  const esquerda: Ponto[] = [];
  const direita: Ponto[] = [];
  for (let i = 0; i < n; i++) {
    const t = (tBaseSeta * i) / (n - 1);
    const pt = bezierPonto(p0, c, p2, t);
    const perp = normalizado(perpendicularHoraria(bezierTangente(p0, c, p2, t)));
    const meiaM = meiaLarguraPx(t) * metrosPorPixelAtual;
    esquerda.push([pt[0] + perp[0] * meiaM, pt[1] + perp[1] * meiaM]);
    direita.push([pt[0] - perp[0] * meiaM, pt[1] - perp[1] * meiaM]);
  }

  // Seta: ponta alinhada à TANGENTE real da curva em `tPonta` (não à corda) -- é a correção
  // central desta fase em relação ao `poligonoSeta` anterior (ver comentário no topo).
  const tangentePonta = normalizado(bezierTangente(p0, c, p2, tPonta));
  const perpBase = normalizado(perpendicularHoraria(bezierTangente(p0, c, p2, tBaseSeta)));
  const ponta = bezierPonto(p0, c, p2, tPonta);
  const baseSeta = bezierPonto(p0, c, p2, tBaseSeta);
  // Base da seta medida sobre a largura de ORIGEM (com piso em pixels), não sobre a largura
  // já afunilada -- ver LARGURA_BASE_SETA_FATOR/MEIA_BASE_SETA_MIN_PX.
  // a base encolhe junto com o comprimento da seta (ver escalaCusto acima), senão um
  // fluxo curto ganharia um triângulo curto e largo, mais parecido com um losango.
  const meiaLarguraBaseSetaM = meiaBaseSetaPx * metrosPorPixelAtual * escalaCusto;
  // a ponta é o próprio ponto da curva em `tPonta` -- já fica a `raioNoM` do destino por
  // construção de `tAComprimentoDoDestino`; `tangentePonta` só entra na base do triângulo se
  // quisermos "empurrar" a ponta ao longo da tangente, o que não é necessário aqui (o ponto já
  // está no lugar certo). Mantido calculado para documentar/testar o alinhamento (ver
  // `fluxos.test.ts`): a direção ponta<-baseSeta deve coincidir com a tangente em `tPonta`.
  void tangentePonta;

  const baseEsquerda: Ponto = [baseSeta[0] + perpBase[0] * meiaLarguraBaseSetaM, baseSeta[1] + perpBase[1] * meiaLarguraBaseSetaM];
  const baseDireita: Ponto = [baseSeta[0] - perpBase[0] * meiaLarguraBaseSetaM, baseSeta[1] - perpBase[1] * meiaLarguraBaseSetaM];

  return [...esquerda, baseEsquerda, ponta, baseDireita, ...direita.reverse()];
}
