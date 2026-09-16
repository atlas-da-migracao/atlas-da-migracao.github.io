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
 *  devolve 0 -- espiga degenerada, mas nunca uma divisão por zero. `fatorZoom` (default 1)
 *  multiplica o resultado -- ver `fatorAlturaPorZoom` abaixo. */
export function alturaEspigaPx(
  valor: number, maiorAbsoluto: number, teto = TETO_ESPIGA_PX, fatorZoom = 1,
): number {
  if (!Number.isFinite(valor) || !Number.isFinite(maiorAbsoluto) || maiorAbsoluto <= 0) return 0;
  const fracao = Math.sqrt(Math.min(1, Math.abs(valor) / maiorAbsoluto));
  return teto * fracao * fatorZoom;
}

/** Zoom da vista Brasil (`VISTA_BRASIL.zoom` em MapaAtlas.tsx) -- referência abaixo da qual
 *  `fatorAlturaPorZoom` não encolhe mais (a espiga já está no tamanho original ali). */
export const ZOOM_REFERENCIA_ESPIGA = -12;

/** Quanto a altura da espiga cresce por nível de zoom, em relação à vista Brasil -- pedido do
 *  usuário: no zoom fixo em pixels de antes, a espiga sempre ocupava os mesmos ~120px de
 *  tela em QUALQUER zoom (por desenho -- é o que garante que ela nunca suma na vista
 *  nacional), mas isso a fazia parecer pequena demais perto da malha já bem maior na tela ao
 *  aproximar numa RM (a malha cresce com o zoom, a espiga não). 0 = sem crescimento (o
 *  comportamento antigo); 1 = cresce exatamente como a geografia (volta a ficar minúscula na
 *  vista Brasil, o problema oposto). 0,55 é o meio-termo: ~6,5x mais alta no zoom típico de
 *  uma RM (uns 5-6 níveis além da vista Brasil) sem re-abrir o problema na vista nacional. */
export const FATOR_ZOOM_ESPIGA = 0.55;

/** Teto do crescimento -- sem isto, selecionar um município muito pequeno sozinho na tela
 *  (zoom bem alto) faria a espiga crescer sem limite e virar um traço grotesco cobrindo o
 *  mapa. 6x o tamanho original já é bem mais que suficiente para o caso de uso (RM). */
const TETO_FATOR_ZOOM = 6;

/** Multiplicador do teto/altura da espiga para o `zoom` cartesiano atual (log2(px/metro),
 *  ver `fitBoundsCartesiano` em lib/rm.ts) -- ver constantes acima. Nunca menor que 1 (não
 *  encolhe além do desenho original ao afastar mais que a vista Brasil). */
export function fatorAlturaPorZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1;
  const cresc = Math.pow(2, FATOR_ZOOM_ESPIGA * Math.max(0, zoom - ZOOM_REFERENCIA_ESPIGA));
  return Math.min(TETO_FATOR_ZOOM, Math.max(1, cresc));
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

/** Âncora FIXA (não recalculada por edição) das espigas no nível MUNICÍPIO, para as três
 *  métricas de contagem -- maior |valor| observado entre as 5 edições publicadas (2022, 2010,
 *  2000, 1991, 1980), conferido diretamente em `municipios.parquet` de cada uma:
 *
 *    saldo: 2022 -479.395 (SP) · 2010 -388.275 (SP) · 2000 -533.310 (SP, MAIOR) ·
 *           1991 -435.510 (SP) · 1980 +150.660 (Brasília/DF)
 *    imig:  2022  311.895 · 2010  386.920 · 2000  488.905 · 1991  500.460 ·
 *           1980  809.075 (MAIOR)
 *    emig:  2022  791.290 · 2010  775.195 · 2000 1.022.215 (MAIOR) · 1991  935.970 ·
 *           1980  841.965
 *
 *  Por quê: normalizar cada edição pelo PRÓPRIO maior valor (o que o mapa fazia antes desta
 *  correção) faz edições com distribuição menos concentrada -- 1980 tem só 3.940 unidades e,
 *  no proxy de data fixa, mais municípios ficam com saldo próximo do maior valor da própria
 *  edição -- parecerem muito mais "cheias" de espigas grandes que as outras, mesmo quando o
 *  volume absoluto é menor (o maior saldo de 1980, 150.660, é 3,5x menor que o de 2000). Uma
 *  âncora comum faz a mesma altura em pixels valer a mesma contagem de pessoas em qualquer
 *  edição -- comparável entre censos, não só dentro de um.
 *
 *  Só vale para o nível MUNICÍPIO -- nos níveis agregados (RGI/RGInt/UF) o valor típico por
 *  unidade já é bem maior (soma de vários municípios), então a âncora continua sendo
 *  recalculada por edição/nível (ver `MapaAtlas.tsx`/`App.tsx`, guardado por `campoId ===
 *  "CD_MUN"`). Se uma edição nova for publicada com um valor acima destes, os números aqui
 *  precisam ser conferidos de novo (não há teste automático para isso -- é um dado, não uma
 *  invariante do código). */
export const ANCORA_ESPIGA_MUNICIPIO: Record<"saldo" | "imig" | "emig", number> = {
  saldo: 533_310,
  imig: 809_075,
  emig: 1_022_215,
};
