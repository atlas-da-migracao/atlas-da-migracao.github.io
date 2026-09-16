/** Geometria dos arcos de fluxo no mapa (F10, edição "mapa-representação").
 *
 *  Por que isto existe: o `ArcLayer` do deck.gl desenha uma parábola cuja flecha vai no eixo
 *  **Z** (`getHeight`) e, opcionalmente, é girada para o plano XY por `getTilt` (ver
 *  `interpolateFlat` em `@deck.gl/layers/dist/arc-layer/arc-layer-vertex.glsl`: o
 *  deslocamento é `perp(direção) * z * sin(tilt)` e a altura que sobra é `z * cos(tilt)`).
 *
 *  Sob `MapView` (câmera em perspectiva) uma flecha em Z lê como curva. Sob `OrthographicView`
 *  -- a vista do atlas desde a Fase 4 (Albers) -- a projeção é paralela e a câmera olha na
 *  vertical: **um deslocamento em Z não tem projeção alguma em tela**, e o arco colapsa
 *  exatamente na corda reta origem→destino. Consequência medida na vista Brasil de 1980: as
 *  cordas Rio/São Paulo → Salvador/Recife/João Pessoa/Natal cruzam o Atlântico (a costa
 *  brasileira é *concava* nesse corredor) e ~150 cordas de 5 a 14 px empilhadas nos mesmos
 *  poucos polos viravam uma lâmina opaca sobre o mar, com a mesma cor neutra do coroplético --
 *  lida como "um triângulo sólido saindo do Nordeste", não como fluxos.
 *
 *  Correção: girar a parábola 90° para DENTRO do plano do mapa (`TILT_ARCO`), o que
 *  (a) torna a curvatura visível na projeção ortográfica, (b) tira cada arco da corda, então
 *  o feixe se abre em vez de empilhar, e (c) dá curvatura convencional à Tobler (1987) --
 *  sempre para o mesmo lado do sentido de viagem --, o que separa qualquer par recíproco
 *  A→B e B→A sem precisar de regra por par.
 */

/** Flecha do arco como fração do vão, para arcos curtos. O deslocamento máximo do ArcLayer é
 *  `0,5 × altura × vão`, então 0,3 dá uma flecha de ~15% do vão. */
export const ALTURA_ARCO = 0.3;

/** Giro da parábola para o plano do mapa. -90° põe a flecha à **direita** do sentido de
 *  viagem (convenção de Tobler). O sinal não é indiferente na escala do Brasil: com -90 os
 *  fluxos dominantes Nordeste→Sudeste (os mais grossos em 1980) curvam para o interior e os
 *  de volta para o mar; com +90 é o contrário, e a tinta sobre o oceano medida na vista
 *  nacional cresce em todas as cinco edições (1980: 3.242 → 3.993 px; 2022: 1.350 → 2.749). */
export const TILT_ARCO = -90;

/** Teto da flecha em METROS (unidade do Albers, portanto a mesma regra em qualquer zoom).
 *  Sem o teto, um fluxo de 2.400 km abriria uma alça de ~360 km, que joga tinta longe da
 *  costa de novo; com o teto, a curvatura cresce até 150 km e depois o arco fica mais
 *  "achatado" -- ainda fora da corda (que é o que desempilha o feixe), sem varrer o mar. */
export const FLECHA_MAX_M = 150_000;

/** Altura (fração do vão) a passar ao `getHeight` do ArcLayer para um vão de `vao` metros:
 *  `ALTURA_ARCO` nos arcos curtos, reduzida nos longos para respeitar `FLECHA_MAX_M`.
 *  Vão 0 (origem = destino, que não deve ocorrer nos dados) cai no valor nominal. */
export function alturaDoArco(vao: number): number {
  if (!Number.isFinite(vao) || vao <= 0) return ALTURA_ARCO;
  return Math.min(ALTURA_ARCO, (2 * FLECHA_MAX_M) / vao);
}

/** Flecha resultante, em metros -- só para teste/documentação (o shader calcula o mesmo). */
export function flechaDoArco(vao: number): number {
  return 0.5 * alturaDoArco(vao) * Math.max(0, vao);
}
