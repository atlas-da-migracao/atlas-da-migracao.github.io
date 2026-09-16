/** Geometria das espigas bipolares (F5, edição "mapa-representação").
 *
 *  Por que isto existe: coroplético mede área, não valor -- um município enorme da Amazônia
 *  "pesa" na leitura visual pelo tamanho do polígono, não pelo saldo/imigração/emigração que
 *  ele de fato registra (ver a avaliação em `~/.claude/plans/fa-a-uma-avalia-o-do-fancy-seal.md`,
 *  seção D). Para as métricas de CONTAGEM (saldo, imigrantes, emigrantes) o valor passa a ser
 *  codificado em COMPRIMENTO -- a variável perceptualmente mais precisa (Bertin/Cleveland) --
 *  por um triângulo fino ancorado no centroide: base fixa em pixels, altura ∝ √|valor|. TLM e
 *  IEM (taxas) continuam coropléticos -- área é a codificação correta quando o valor já é uma
 *  razão, não uma soma que cresce com o tamanho do município.
 *
 *  Por que a base é fixa em PIXELS e a altura é convertida de pixels para METROS: a vista do
 *  mapa é `OrthographicView` + `COORDINATE_SYSTEM.CARTESIAN` desde a Fase 4 (Albers) --
 *  `web/src/map/MapaAtlas.tsx` já resolve esse mesmo problema para a flecha dos arcos
 *  (`lib/arcos.ts`). Um polígono do deck.gl é sempre desenhado em coordenadas do MUNDO (aqui,
 *  metros); para que a espiga pareça ter ~2,5 px de largura em qualquer zoom, e não 2,5 METROS
 *  (invisível) ou 2,5 px do mundo na escala 1:1 (gigante quando afastado), a largura/altura
 *  desejadas em pixels precisam ser convertidas para metros ANTES de gerar os vértices --
 *  recalculado a cada mudança de zoom via `updateTriggers`, o mesmo padrão de `arcos.ts`.
 *
 *  `zoom` aqui é o mesmo `zoom` do `OrthographicView`: `log2(escala)`, escala em px por metro
 *  de mundo (ver `fitBoundsCartesiano` em `lib/rm.ts`: `zoom = log2(escala)`, `escala =
 *  largura_util / largura_bbox`). Logo 1 px de tela = `1 / escala` = `2^(-zoom)` metros de
 *  mundo -- é a função `metrosPorPixel` abaixo.
 */

/** Base do triângulo, em pixels -- fixa: não cresce com o valor (só a altura muda). */
export const BASE_ESPIGA_PX = 2.5;

/** Teto da altura, em pixels, na vista Brasil -- evita que o maior valor da edição (ex.: o
 *  saldo de São Paulo) produza uma espiga fora de proporção com o resto do mapa. */
export const TETO_ESPIGA_PX = 120;

/** Metros de mundo equivalentes a 1 pixel de tela, no zoom cartesiano dado (`log2(escala)`,
 *  escala em px/metro -- ver `fitBoundsCartesiano`). Escala 0 (zoom -Infinity) nunca ocorre
 *  na prática (o controller trava entre -15 e -2, ver MapaAtlas.tsx), mas a função não
 *  assume isso: é pura aritmética, sem checagem de intervalo. */
export function metrosPorPixel(zoom: number): number {
  return 1 / Math.pow(2, zoom);
}

/** Altura da espiga em PIXELS, dado o valor, o maior |valor| da métrica entre as unidades
 *  visíveis (âncora da escala -- ver App.tsx) e o teto em pixels. Escala em RAIZ QUADRADA
 *  (área do triângulo ~ altura × base fixa, então altura ∝ √valor mantém a leitura de área
 *  proporcional ao volume, a mesma convenção já usada na espessura dos arcos -- `arcos.ts`/
 *  `larguraDoArco` em MapaAtlas.tsx). `maiorAbsoluto <= 0` (nenhum dado, ou métrica ausente)
 *  devolve 0 -- espiga degenerada, mas nunca uma divisão por zero. */
export function alturaEspigaPx(valor: number, maiorAbsoluto: number, teto = TETO_ESPIGA_PX): number {
  if (!Number.isFinite(valor) || !Number.isFinite(maiorAbsoluto) || maiorAbsoluto <= 0) return 0;
  const fracao = Math.sqrt(Math.min(1, Math.abs(valor) / maiorAbsoluto));
  return teto * fracao;
}

/** Vértices (metros, Albers) de um triângulo isósceles ancorado em `(cx, cy)`: base horizontal
 *  de `basePx` pixels centrada no centroide, ápice a `alturaPx` pixels de distância, para
 *  CIMA (`direcao = 1`, ganho/entrada) ou para BAIXO (`direcao = -1`, perda/saída) -- a
 *  "espiga bipolar". `alturaPx = 0` (valor 0, ou maiorAbsoluto 0) devolve um triângulo
 *  degenerado (altura 0), não um erro -- o SolidPolygonLayer simplesmente não desenha nada
 *  de visível, e o chamador já filtra valores 0 antes (ver MapaAtlas.tsx). */
export function poligonoEspiga(
  cx: number,
  cy: number,
  alturaPx: number,
  zoom: number,
  direcao: 1 | -1 = 1,
  basePx: number = BASE_ESPIGA_PX,
): [number, number][] {
  const mpp = metrosPorPixel(zoom);
  const meiaBaseM = (basePx / 2) * mpp;
  const alturaM = alturaPx * mpp * direcao;
  return [
    [cx - meiaBaseM, cy],
    [cx + meiaBaseM, cy],
    [cx, cy + alturaM],
  ];
}
