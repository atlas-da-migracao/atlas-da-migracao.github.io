/** Flecha dos fluxos de origem-destino no mapa (F10/F11, edição "mapa-representação").
 *
 *  Histórico: até F10 este módulo também continha a curvatura em si, via `ArcLayer` do
 *  deck.gl (`getHeight`/`getTilt`, girando a parábola nativa da camada -90° para dentro do
 *  plano XY -- necessário porque `OrthographicView` não projeta deslocamento em Z, e a flecha
 *  colapsava na corda reta; ver o commit da F10 para a medição completa). A F11 substituiu o
 *  `ArcLayer` por uma Bézier quadrática própria (`lib/fluxos.ts`, `poligonoFluxo`) -- a
 *  camada precisava de largura variável por ponto (afunilamento) e da tangente exata da
 *  curva, que o `ArcLayer` não expõe. Só a FLECHA (fração do vão, teto em metros) continua
 *  aqui, calibrada nesta fase e reaproveitada por `lib/fluxos.ts` via `flechaDoArco`.
 *
 *  O lado da flecha -- sempre o mesmo em relação ao sentido de viagem, convenção de Tobler
 *  (1987), o que separa qualquer par recíproco A→B/B→A sem regra por par -- é decidido em
 *  `lib/fluxos.ts` (`perpendicularHoraria`), replicando o giro de -90° que a F10 mediu como
 *  correto: com esse sinal os fluxos dominantes Nordeste→Sudeste (os mais grossos em 1980)
 *  curvam para o interior, não para o mar; com o sinal oposto a tinta sobre o oceano crescia
 *  em todas as cinco edições (1980: 3.242 → 3.993 px; 2022: 1.350 → 2.749, medidos com o
 *  `ArcLayer` antigo).
 */

/** Flecha do arco como fração do vão, para arcos curtos. Historicamente era o `getHeight`
 *  passado ao `ArcLayer` (que multiplica por `0,5 × vão` para achar a flecha); `lib/fluxos.ts`
 *  usa o mesmo fator através de `flechaDoArco` abaixo. 0,3 dá uma flecha de ~15% do vão. */
export const ALTURA_ARCO = 0.3;

/** Teto da flecha em METROS (unidade do Albers, portanto a mesma regra em qualquer zoom).
 *  Sem o teto, um fluxo de 2.400 km abriria uma alça de ~360 km, que joga tinta longe da
 *  costa de novo; com o teto, a curvatura cresce até 150 km e depois o arco fica mais
 *  "achatado" -- ainda fora da corda (que é o que desempilha o feixe), sem varrer o mar. */
export const FLECHA_MAX_M = 150_000;

/** Fração do vão (equivalente ao antigo `getHeight` do `ArcLayer`) para um vão de `vao`
 *  metros: `ALTURA_ARCO` nos arcos curtos, reduzida nos longos para respeitar `FLECHA_MAX_M`.
 *  Vão 0 (origem = destino, que não deve ocorrer nos dados) cai no valor nominal. Função
 *  pela flecha em metros (`flechaDoArco`, abaixo), não pela fração bruta -- exportada mesmo
 *  assim porque os testes deste módulo verificam a fração diretamente. */
export function alturaDoArco(vao: number): number {
  if (!Number.isFinite(vao) || vao <= 0) return ALTURA_ARCO;
  return Math.min(ALTURA_ARCO, (2 * FLECHA_MAX_M) / vao);
}

/** Flecha do fluxo em METROS para um vão de `vao` metros -- usada por `lib/fluxos.ts`
 *  (`pontoControle`) para deslocar o ponto de controle da Bézier perpendicularmente à corda. */
export function flechaDoArco(vao: number): number {
  return 0.5 * alturaDoArco(vao) * Math.max(0, vao);
}

