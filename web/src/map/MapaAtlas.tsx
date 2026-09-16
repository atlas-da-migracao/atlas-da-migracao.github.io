/** Mapa do atlas: coroplético dos municípios + arcos de fluxo.
 *  Sem basemap externo -- a base é a própria malha do IBGE, o que evita dependência
 *  de terceiros e mantém a leitura cartográfica limpa. */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import DeckGL from "@deck.gl/react";
import { GeoJsonLayer, ArcLayer, SolidPolygonLayer } from "@deck.gl/layers";
import { OrthographicView, COORDINATE_SYSTEM } from "@deck.gl/core";
import type { PickingInfo } from "@deck.gl/core";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { Fluxo, Metrica } from "../lib/types";
import { fitBoundsCartesiano, validarEExpandirBbox, type Bbox } from "../lib/rm";
import { corDivergente, type RGB } from "../lib/escalas";
import { num, sinal, rotuloPrecisao } from "../lib/format";
import { hexParaRgb } from "../lib/paletas";
import { alturaDoArco, TILT_ARCO } from "../lib/arcos";
import { alturaEspigaPx, poligonoEspiga } from "../lib/espigas";

// F10: o mapa deixou de usar MapView (Web Mercator) -- a vista padrão agora é
// OrthographicView + COORDINATE_SYSTEM.CARTESIAN, consumindo diretamente as coordenadas em
// metros dos arquivos `*_albers.topojson`/`x_albers`,`y_albers` (pré-projetados no pipeline,
// ver docs/METODOLOGIA.md). O front NUNCA reprojeta: só renderiza o que já vem em metros.
// `flipY: false` porque o Albers do pipeline é um referencial cartesiano padrão (Y cresce
// para o norte), não coordenadas de tela (Y para baixo, o default do OrthographicView).
const VIEW = new OrthographicView({ id: "mapa", flipY: false });

/** Vista cartesiana: `target` no centro do que deve aparecer (metros, Albers) e `zoom` em
 *  log2(px por metro) -- ver `fitBoundsCartesiano` em lib/rm.ts. Substitui o antigo
 *  `MapViewState` (longitude/latitude/zoom) de quando o mapa era Web Mercator. */
export interface VistaCartesiana {
  target: [number, number, number];
  zoom: number;
  transitionDuration?: number;
}

// F3 (mapa-representação): cores dos arcos, nos dois temas -- mesmos hex de --arc-in/--arc-out
// em styles/tokens.css (não dá para ler custom properties de dentro de uma cor do deck.gl,
// que precisa de RGB numérico). ORIGEM_* é o cinza neutro (--axis) usado na ponta de origem de
// um arco direcionado: o degradê de cor (não só de alfa) fica mais forte assim -- a origem
// "esvanece" para cinza, o destino chega na cor cheia da direção.
const ARC_IN_CLARO = hexParaRgb("#2a78d6"), ARC_IN_ESCURO = hexParaRgb("#3987e5");
const ARC_OUT_CLARO = hexParaRgb("#eb6834"), ARC_OUT_ESCURO = hexParaRgb("#d95926");
const ORIGEM_CLARO = hexParaRgb("#c3c2b7"), ORIGEM_ESCURO = hexParaRgb("#383835");

// F5 (mapa-representação): preenchimento neutro da malha quando a métrica é de CONTAGEM
// (saldo, imigrantes, emigrantes) -- o coroplético fica reservado às taxas (TLM/IEM), a
// contagem passa a ser lida pelo comprimento das espigas (ver ESPIGAS_METRICAS abaixo). Não é
// --surface (quase idêntico a --plane, o fundo do canvas -- ver `style` do DeckGL): um passo a
// mais de bege/cinza garante que a malha continue lendo como "figura" mesmo sem cor de dado.
const NEUTRO_CLARO = hexParaRgb("#eeece4"), NEUTRO_ESCURO = hexParaRgb("#242422");

/** Métricas de CONTAGEM (soma que cresce com o tamanho do município) -- coroplético para elas
 *  distorce por área; passam a usar espigas bipolares. TLM e IEM já são razões (por mil
 *  habitantes, proporção do fluxo) e continuam coropléticas, sem espiga. */
const ESPIGAS_METRICAS = new Set<Metrica>(["saldo", "imig", "emig"]);

/** Ponto de dado de uma espiga: já resolvido para altura/direção/cor, um por unidade com
 *  centroide conhecido e valor não nulo/diferente de zero na métrica ativa. */
interface PontoEspiga {
  cd: string;
  x: number;
  y: number;
  /** valor com sinal (saldo) ou magnitude (imig/emig, sempre >= 0) usado na escala */
  valor: number;
  /** 1 = espiga para cima (ganho/entrada), -1 = para baixo (perda) */
  sinal: 1 | -1;
  corChave: "ganho" | "perda" | "entrada" | "saida";
}

/** Valor e cor de uma espiga a partir do indicador da unidade e da métrica ativa. `null`
 *  quando a métrica não é de contagem, ou o valor é nulo/zero (nada a desenhar). Saldo é
 *  BIPOLAR (sinal do próprio saldo); imigrantes/emigrantes são sempre positivos e sempre para
 *  cima, com a cor de "entrada"/"saída" já usada nos arcos (consistência de paleta). */
function espigaDaMetrica(m: ValorMapa | undefined, metrica: Metrica): Omit<PontoEspiga, "cd" | "x" | "y"> | null {
  if (!m || !ESPIGAS_METRICAS.has(metrica)) return null;
  if (metrica === "saldo") {
    if (!m.saldo) return null;
    return { valor: m.saldo, sinal: m.saldo >= 0 ? 1 : -1, corChave: m.saldo >= 0 ? "ganho" : "perda" };
  }
  if (metrica === "imig") {
    if (!m.imig) return null;
    return { valor: m.imig, sinal: 1, corChave: "entrada" };
  }
  if (!m.emig) return null;
  return { valor: m.emig, sinal: 1, corChave: "saida" };
}

/** F10: bounds (metros, Albers) da malha nacional de municípios -- valores medidos na edição
 *  2022 (ver `meta.bounds_albers`, pipeline/build_meta.py); as 5 edições têm extensão
 *  territorial muito próxima (a maior diferença é o Fernando de Noronha/litoral entre
 *  edições, <5% na maior dimensão), então serve de FALLBACK só até `meta.json` responder
 *  (`boundsNacional` prop, abaixo) -- nunca usado se a edição já carregou. */
const LIMITES_BRASIL_FALLBACK = { x_min: -2_178_086, x_max: 2_561_841, y_min: -2_385_699, y_max: 1_902_805 };

/** Vista cartesiana que enquadra o Brasil inteiro; fallback antes da 1a medida do contêiner
 *  (ver `vistaDoFoco`). Não é mais uma constante fixa como no Web Mercator (não há "zoom que
 *  sempre fica bom" em unidades de metros por pixel, cartesiano puro) -- é recalculada assim
 *  que o contêiner é medido, via `fitBoundsCartesiano`. */
export const VISTA_BRASIL: VistaCartesiana = { target: [0, 0, 0], zoom: -12 };

/** Campos mínimos usados na coloração do coroplético -- Municipio e UnidadeAgregada (F6:
 *  níveis RGI/RGInt/UF) satisfazem essa forma, então o mapa não precisa saber qual é qual. */
export interface ValorMapa {
  saldo: number; tlm: number | null; imig: number; emig: number; iem: number | null;
  /** só existe no nível município (níveis agregados não têm erro-padrão próprio) */
  cv_imig?: number | null; precisao_imig?: string;
}

interface Props {
  malha: FeatureCollection | null;
  /** F2 (mapa-representacao): malha de arestas (topojson.mesh, fronteiras únicas) da mesma
   *  malha ativa -- usada só para o contorno "normal", em vez de contornar cada feição (o
   *  que desenha toda fronteira compartilhada duas vezes e revela arestas internas de
   *  MultiPolygon, ex.: a grade do NORTEGO). null enquanto a topologia bruta não carregou. */
  contornos?: Feature | null;
  porCodigo: Map<string, ValorMapa>;
  metrica: Metrica;
  quebras: number[];
  arcos: (Fluxo & { direcao?: string })[];
  selecionado: string | null;
  escuro: boolean;
  aoSelecionar: (cd: string | null) => void;
  aoSelecionarFluxo: (o: string, d: string) => void;
  /** bbox [minX,minY,maxX,maxY] em metros (Albers) para enquadrar a seleção atual; null = Brasil.
   *  Prioridade decidida pelo chamador: fluxo > município > RM > Brasil. */
  foco?: Bbox | null;
  /** teto de zoom ao enquadrar `foco` (ex.: município muito pequeno não deve aproximar demais) */
  zoomMaximo?: number;
  /** rótulo do botão de reenquadrar, quando o usuário já moveu o mapa */
  rotuloReenquadrar?: string;
  /** municípios a destacar (modo RM); os demais recebem alpha reduzido */
  destacar?: Set<string> | null;
  /** contorno externo da RM ativa (municípios dissolvidos) */
  perimetro?: Feature | null;
  /** código do núcleo da RM ativa, para contorno mais grosso */
  nucleo?: string | null;
  /** F6: nome da propriedade que identifica a feição na malha ativa (CD_MUN por padrão;
   *  cd_rgi/cd_rgint/SIGLA_UF nos níveis agregados). */
  campoId?: string;
  /** F6: rótulo textual da feição sob o cursor, para a dica flutuante (nome/UF do município
   *  ou da unidade agregada); se omitido, a dica mostra só o código. */
  rotuloDaFeicao?: (cd: string) => string | null;
  /** F6 leva 2: descrição da vista atual, para quem usa leitor de tela (o canvas do deck.gl
   *  não expõe conteúdo textual por si só; os mesmos dados estão nas tabelas do painel). */
  descricaoAcessivel?: string;
  /** avisado quando a feição sob o cursor muda (código, ou null fora da malha) */
  aoPassarFeicao?: (cd: string | null) => void;
  /** F3 (mapa-representação): liga/desliga a camada de arcos (ArcLayer); default true. Os
   *  arcos continuam calculados em `arcos` (o painel lateral não depende disto) -- só a
   *  camada do mapa some. */
  mostrarFluxos?: boolean;
  /** F3: maior fluxo municipal publicado NESTA edição (meta.maior_fluxo) -- base da escala de
   *  espessura absoluta dos arcos. Se ausente (meta ainda não carregou), cai de volta no maior
   *  fluxo EM TELA (comportamento anterior), só para não desenhar arcos invisíveis antes da
   *  1a resposta de `meta.json`. */
  maiorFluxoEdicao?: number | null;
  /** F10: bounds (metros, Albers) da malha nacional desta edição (`meta.bounds_albers`) --
   *  usado para enquadrar o Brasil (foco=null) sem esperar o TopoJSON de municípios (mais
   *  pesado) carregar. `null`/ausente cai no fallback aproximado `LIMITES_BRASIL_FALLBACK`. */
  boundsNacional?: { x_min: number; x_max: number; y_min: number; y_max: number } | null;
  /** F5 (mapa-representação): centroide (metros, Albers) de cada unidade da malha ativa --
   *  âncora das espigas bipolares. `null`/mapa vazio enquanto a consulta de centroides não
   *  respondeu: nesse intervalo a métrica de contagem já pinta a malha neutra (não pisca de
   *  volta ao coroplético), só as espigas ficam ausentes até os pontos chegarem. */
  centroides?: Map<string, { x: number; y: number }> | null;
}

const valorDaMetrica = (m: ValorMapa | undefined, metrica: Metrica): number | null => {
  if (!m) return null;
  switch (metrica) {
    case "saldo": return m.saldo;
    case "tlm": return m.tlm;
    case "imig": return m.imig;
    case "emig": return -m.emig;   // saídas lidas como perda, para manter a divergência
    case "iem": return m.iem == null ? null : m.iem * 100;
  }
};

/** F5 (mapa-representação): frase da dica flutuante para a métrica ativa -- usada tanto no
 *  hover sobre o polígono (metrica de taxa, coroplético) quanto sobre a espiga (metrica de
 *  contagem). Antes só existia a frase de saldo/TLM; imigrantes e emigrantes caíam por engano
 *  na frase de saldo (o valor de `valorDaMetrica`, com sinal invertido para o coroplético, não
 *  o valor bruto que o leitor espera ver na dica). */
const textoMetrica = (m: ValorMapa | undefined, metrica: Metrica): string => {
  if (!m) return "sem dados";
  switch (metrica) {
    case "tlm": return `${sinal(m.tlm)} por mil habitantes`;
    case "saldo": return `saldo ${sinal(m.saldo)} pessoas`;
    case "imig": return `${num(m.imig)} imigrantes`;
    case "emig": return `${num(m.emig)} emigrantes`;
    case "iem": return m.iem == null ? "sem dados" : `eficácia ${sinal(Math.round(m.iem * 1000) / 10)}%`;
  }
};

export function MapaAtlas({
  malha, contornos = null, porCodigo, metrica, quebras, arcos, selecionado, escuro, aoSelecionar, aoSelecionarFluxo,
  foco = null, zoomMaximo, rotuloReenquadrar = "Ver o Brasil", destacar = null, perimetro = null, nucleo = null,
  campoId = "CD_MUN", rotuloDaFeicao, descricaoAcessivel, aoPassarFeicao,
  mostrarFluxos = true, maiorFluxoEdicao = null, boundsNacional = null, centroides = null,
}: Props) {
  const [hover, setHover] = useState<PickingInfo | null>(null);
  const feicaoSobCursor = useRef<string | null>(null);
  const aoHover = (info: PickingInfo) => {
    setHover(info);
    if (!aoPassarFeicao) return;
    const cd = info.layer?.id === "municipios"
      ? (info.object as Feature<Geometry, Record<string, string>> | undefined)?.properties?.[campoId] ?? null
      : null;
    if (cd !== feicaoSobCursor.current) {
      feicaoSobCursor.current = cd;
      aoPassarFeicao(cd);
    }
  };
  const metricaContagem = ESPIGAS_METRICAS.has(metrica);
  // vista controlada: garante que a carga da página sempre comece enquadrando o Brasil
  const [vista, setVista] = useState<VistaCartesiana>(VISTA_BRASIL);
  const [moveu, setMoveu] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Tamanho medido do contêiner do mapa. `fitBounds` do math.gl lança uma asserção quando
  // chamado com largura/altura 0 (o caso normal na 1a pintura, antes do layout do flex
  // container se resolver) -- em vez de tentar adivinhar isso com `window.innerWidth` como
  // fallback (o bug anterior), simplesmente não enquadramos nada até termos uma medida real
  // do próprio elemento, via ResizeObserver. useLayoutEffect (não useEffect) para medir antes
  // da pintura do navegador, evitando um frame com a vista errada.
  const [tamanho, setTamanho] = useState<{ width: number; height: number } | null>(null);
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const medir = () => {
      const { width, height } = el.getBoundingClientRect();
      setTamanho((anterior) =>
        anterior && anterior.width === width && anterior.height === height ? anterior : { width, height });
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /** Vista que enquadra o `foco` (fit cartesiano com 48px de margem) ou o Brasil, se não
   *  houver foco, o contêiner ainda não tiver sido medido, ou o bbox não puder ser validado.
   *  F10: não existe `WebMercatorViewport.fitBounds` em modo cartesiano (OrthographicView) --
   *  `fitBoundsCartesiano` (lib/rm.ts) é o equivalente escrito à mão: bbox em metros do foco
   *  (ou do Brasil inteiro, via `boundsNacional`/fallback), escala = menor entre
   *  largura_útil/largura_bbox e altura_útil/altura_bbox, zoom = log2(escala). Função pura
   *  (não é hook): chamada de dentro do efeito abaixo e do clique em "reenquadrar". */
  const vistaDoFoco = (): VistaCartesiana => {
    if (!tamanho || tamanho.width <= 0 || tamanho.height <= 0) return VISTA_BRASIL;
    const limites = boundsNacional ?? LIMITES_BRASIL_FALLBACK;
    const bboxBruto: Bbox = foco ?? [limites.x_min, limites.y_min, limites.x_max, limites.y_max];
    const bbox = validarEExpandirBbox(bboxBruto);
    if (!bbox) return VISTA_BRASIL;
    const { target, zoom: zoomAjustado } = fitBoundsCartesiano(bbox, tamanho.width, tamanho.height, 48);
    const zoom = zoomMaximo != null ? Math.min(zoomAjustado, zoomMaximo) : zoomAjustado;
    return { target, zoom };
  };

  // recalcula o enquadramento sempre que a seleção muda (não a cada re-render: só quando
  // a *identidade* do foco muda -- assim um gesto do usuário depois não é sobrescrito) ou
  // quando o contêiner é medido pela 1a vez / muda de tamanho. Uma transição suave via
  // deck.gl (não um temporizador manual) acompanha a troca, exceto quando o usuário pediu
  // menos movimento.
  const focoChave = foco ? foco.join(",") : null;
  const reduzirMovimento = typeof window !== "undefined"
    && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  useEffect(() => {
    const alvo = vistaDoFoco();
    setVista(reduzirMovimento ? alvo : { ...alvo, transitionDuration: 400 });
    setMoveu(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focoChave, tamanho?.width, tamanho?.height, zoomMaximo]);

  // Espessura dos arcos: proporcional à raiz quadrada do volume (área ~ volume, leitura
  // perceptualmente honesta). F3 (mapa-representação): normalizada pelo maior fluxo
  // MUNICIPAL PUBLICADO NESTA EDIÇÃO (meta.maior_fluxo via `maiorFluxoEdicao`), não pelo
  // maior fluxo em tela -- escala absoluta, para que 14px signifiquem o mesmo volume em
  // qualquer vista (Brasil, um município, um nível agregado). Antes da 1a resposta de
  // meta.json (maiorFluxoEdicao null), cai de volta no maior valor em tela, só para não
  // desenhar tudo invisível nesse instante inicial.
  const maiorVolumeEmTela = useMemo(() => Math.max(1, ...arcos.map((a) => a.total)), [arcos]);
  const maiorVolume = maiorFluxoEdicao ?? maiorVolumeEmTela;
  const LARGURA_MIN = 1.5, LARGURA_MAX = 14;
  const larguraDoArco = (total: number) =>
    LARGURA_MIN + (LARGURA_MAX - LARGURA_MIN) * Math.sqrt(Math.min(1, Math.max(0, total) / maiorVolume));

  // F5 (mapa-representação): pontos das espigas bipolares -- um por unidade da malha ativa
  // com centroide conhecido e valor não nulo/zero na métrica de contagem ativa. Ordenado por
  // |valor| ASCENDENTE (maiores por último = desenhados por cima), mesmo padrão já usado nos
  // arcos (ver larguraDoArco acima e o comentário de ordenação em App.tsx). A âncora da escala
  // (maiorAbsoluto) é o maior |valor| ENTRE AS UNIDADES VISÍVEIS no nível ativo -- não uma
  // constante publicada por edição: mais simples (não exige tocar meta.json/pipeline) e já é
  // o padrão usado por `quebrasSimetricas` (App.tsx) para o próprio coroplético.
  const pontosEspiga = useMemo<PontoEspiga[]>(() => {
    if (!metricaContagem || !centroides || centroides.size === 0) return [];
    const pontos: PontoEspiga[] = [];
    for (const [cd, ponto] of centroides) {
      const dado = espigaDaMetrica(porCodigo.get(cd), metrica);
      if (!dado) continue;
      pontos.push({ cd, x: ponto.x, y: ponto.y, ...dado });
    }
    pontos.sort((a, b) => Math.abs(a.valor) - Math.abs(b.valor));
    return pontos;
  }, [metricaContagem, metrica, porCodigo, centroides]);
  const maiorAbsolutoEspiga = useMemo(
    () => Math.max(1, ...pontosEspiga.map((p) => Math.abs(p.valor))), [pontosEspiga]);

  const camadas = useMemo(() => {
    if (!malha) return [];
    const contorno: RGB = escuro ? [70, 70, 68] : [225, 224, 217];
    // UF é o único nível cujo contorno "normal" deve se destacar mais (hierarquia
    // figura-fundo): mais escuro/mais grosso que a fronteira municipal.
    const ehUf = campoId === "cd_uf";

    const municipios = new GeoJsonLayer({
      id: "municipios",
      data: malha,
      // F10: malha e vista em coordenadas cartesianas (metros, Albers) -- ver COORDINATE_SYSTEM
      // no topo do arquivo. Sem isto, o GeoJsonLayer assume LNGLAT (o default) e tenta
      // reprojetar as coordenadas já em metros como se fossem graus.
      coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
      pickable: true,
      // F2 (mapa-representacao): sem contorno por feição -- fronteira "normal" agora vem da
      // malha de arestas (camada "contornos-malha" abaixo), que não duplica arestas
      // compartilhadas nem desenha arestas internas de MultiPolygon.
      stroked: false,
      filled: true,
      getFillColor: (f: Feature<Geometry, Record<string, string>>) => {
        const cd = f.properties[campoId];
        const fora = destacar && !destacar.has(cd);
        // F5 (mapa-representação): contagem (saldo/imig/emig) não pinta a malha -- o valor sai
        // nas espigas (ver camada "espigas" abaixo); a malha fica num neutro fixo, sem
        // competir com a cor de ganho/perda das espigas. Só TLM/IEM continuam coropléticas.
        const c = metricaContagem
          ? (escuro ? NEUTRO_ESCURO : NEUTRO_CLARO)
          : corDivergente(valorDaMetrica(porCodigo.get(cd), metrica), quebras, escuro);
        return [...c, fora ? 70 : 235] as [number, number, number, number];
      },
      onClick: (info: PickingInfo) => {
        const cd = (info.object as Feature<Geometry, Record<string, string>> | undefined)?.properties?.[campoId];
        aoSelecionar(cd ?? null);
        return true;
      },
      updateTriggers: {
        getFillColor: [metrica, metricaContagem, quebras.join(","), escuro, porCodigo.size, destacar],
      },
    });

    // Contorno "normal": malha de arestas (fronteiras únicas), não por feição. `contornos`
    // vem de topojson.mesh((a,b) => a !== b) em App.tsx -- some tanto a duplicação de uma
    // fronteira compartilhada (desenhada 1x em vez de 2x) quanto a aresta interna de um
    // MultiPolygon da mesma feição (ex.: a grade que aparecia dentro do NORTEGO em 1980).
    const contornosMalha = contornos && new GeoJsonLayer({
      id: "contornos-malha",
      data: [contornos],
      coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
      pickable: false,
      stroked: true,
      filled: false,
      lineWidthUnits: "pixels",
      lineJointRounded: true,
      getLineWidth: ehUf ? 1.1 : 0.3,
      getLineColor: ehUf
        ? (escuro ? [150, 150, 145, 220] : [120, 118, 108, 220])
        : [...contorno, 180],
      updateTriggers: { getLineColor: [escuro, ehUf], getLineWidth: [ehUf] },
    });

    // Contorno de seleção e de núcleo de RM: continuam desenhados por feição (precisam da
    // cor/espessura de destaque só numa feição específica), sobre a malha de arestas.
    const contornoSelecao = new GeoJsonLayer({
      id: "contorno-selecao",
      data: malha,
      coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
      pickable: false,
      stroked: true,
      filled: false,
      lineWidthUnits: "pixels",
      getLineWidth: (f: Feature<Geometry, Record<string, string>>) => {
        const cd = f.properties[campoId];
        if (cd === selecionado) return 2;
        if (nucleo && cd === nucleo) return 3;
        return 0;
      },
      getLineColor: (f: Feature<Geometry, Record<string, string>>) => {
        const cd = f.properties[campoId];
        if (cd === selecionado) return escuro ? [255, 255, 255, 255] : [11, 11, 11, 255];
        if (nucleo && cd === nucleo) return escuro ? [255, 255, 255, 220] : [11, 11, 11, 220];
        return [0, 0, 0, 0];
      },
      updateTriggers: {
        getLineColor: [selecionado, escuro, nucleo, campoId],
        getLineWidth: [selecionado, nucleo, campoId],
      },
    });

    const contornoRM = perimetro && new GeoJsonLayer({
      id: "perimetro-rm",
      data: [perimetro],
      coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
      pickable: false,
      stroked: true,
      filled: false,
      lineWidthUnits: "pixels",
      lineJointRounded: true,
      getLineWidth: 2.5,
      getLineColor: escuro ? [255, 255, 255, 235] : [11, 11, 11, 235],
      updateTriggers: { getLineColor: [escuro] },
    });

    // F5 (mapa-representação): espigas bipolares -- só quando a métrica ativa é de contagem
    // (ver ESPIGAS_METRICAS). `getPolygon` recalcula os vértices a cada mudança de zoom
    // (`vista.zoom`, via updateTriggers): a base/altura são pensadas em PIXELS (ver
    // lib/espigas.ts), então precisam ser reconvertidas para metros sempre que a escala
    // px/metro muda -- o mesmo padrão de `getHeight`/`alturaDoArco` no ArcLayer abaixo. Sem
    // stroke: um traço, mesmo fino, dobra a malha de linhas em 5.570 espigas adjacentes e não
    // ajudou a separar espigas vizinhas no resultado visual -- a opacidade (210/255) já basta
    // para diferenciar uma espiga grande cobrindo uma pequena atrás dela.
    const espigas = pontosEspiga.length > 0 && new SolidPolygonLayer<PontoEspiga>({
      id: "espigas",
      data: pontosEspiga,
      coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
      pickable: true,
      filled: true,
      stroked: false,
      getPolygon: (d: PontoEspiga) =>
        poligonoEspiga(d.x, d.y, alturaEspigaPx(d.valor, maiorAbsolutoEspiga), vista.zoom, d.sinal),
      getFillColor: (d: PontoEspiga) => {
        const cor = d.corChave === "ganho" || d.corChave === "entrada"
          ? (escuro ? ARC_IN_ESCURO : ARC_IN_CLARO)
          : (escuro ? ARC_OUT_ESCURO : ARC_OUT_CLARO);
        return [...cor, 210] as [number, number, number, number];
      },
      onClick: (info: PickingInfo) => {
        const d = info.object as PontoEspiga | undefined;
        aoSelecionar(d?.cd ?? null);
        return true;
      },
      updateTriggers: {
        getPolygon: [vista.zoom, maiorAbsolutoEspiga],
        getFillColor: [escuro],
      },
    });

    // F3 (mapa-representação): direção legível dentro do que o ArcLayer nativo do deck.gl
    // oferece. O ArcLayer NÃO afunila (getWidth é um escalar por arco, não por vértice --
    // não há prop de largura variável ao longo da curva); implementamos só os outros dois
    // recursos do plano:
    // (2) curvatura: F10 refez essa parte para a projeção ortográfica -- a parábola do
    //     ArcLayer é girada para dentro do plano do mapa (`getTilt` = -90, flecha sempre à
    //     direita do sentido de viagem, convenção de Tobler), o que separa QUALQUER par
    //     recíproco A->B e B->A sem regra por par, inclusive nos módulos sem campo `direcao`
    //     (fluxos intra-RM e pendulares). Ver o bloco getHeight/getTilt abaixo.
    // (3) degradê de cor mais forte: a ponta de origem vai para um cinza neutro (--axis) em
    //     vez de só reduzir o alfa da mesma cor -- a ponta de destino chega na cor cheia da
    //     direção (entrada/saída) ou da tipologia (RM). Sem direção real (ex.: maioresFluxos
    //     da vista Brasil sem seleção, que não marca `direcao`), as duas pontas ficam neutras
    //     em vez de aplicar a cor de "entrada" por padrão -- ver App.tsx.
    const arcCor = (d: Fluxo & { direcao?: string; corRgb?: RGB }) => {
      if (d.corRgb) return d.corRgb;
      if (d.direcao === "entrada") return escuro ? ARC_IN_ESCURO : ARC_IN_CLARO;
      if (d.direcao === "saida") return escuro ? ARC_OUT_ESCURO : ARC_OUT_CLARO;
      return null; // sem direção conhecida: neutro nas duas pontas
    };
    const fluxos = new ArcLayer({
      id: "arcos",
      data: arcos,
      // F10: posições em metros (x_o/y_o/x_d/y_d, Albers) -- o ArcLayer continua funcionando
      // normalmente em CARTESIAN (o arco é desenhado no plano da vista, não segue a curvatura
      // da Terra em nenhum dos dois modos).
      coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
      visible: mostrarFluxos,
      pickable: mostrarFluxos,
      getSourcePosition: (d: Fluxo) => [d.x_o!, d.y_o!],
      getTargetPosition: (d: Fluxo) => [d.x_d!, d.y_d!],
      getSourceColor: (d: Fluxo & { direcao?: string; cruza?: boolean; corRgb?: RGB }) => {
        // ponta de origem: cinza neutro em todo arco direcionado (entrada/saída) ou sem
        // direção conhecida; a tipologia intra-RM (corRgb) continua colorida nas duas pontas,
        // só com alfa menor na origem -- é uma cor de CATEGORIA do fluxo, não de direção.
        if (d.corRgb) return [...d.corRgb, d.cruza ? 90 : 200] as [number, number, number, number];
        const origem = escuro ? ORIGEM_ESCURO : ORIGEM_CLARO;
        return [...origem, d.cruza ? 90 : 190] as [number, number, number, number];
      },
      getTargetColor: (d: Fluxo & { direcao?: string; cruza?: boolean; corRgb?: RGB }) => {
        if (d.corRgb) return [...d.corRgb, d.cruza ? 40 : 90] as [number, number, number, number];
        const cor = arcCor(d);
        if (cor) return [...cor, d.cruza ? 90 : 230] as [number, number, number, number];
        // sem direção conhecida (ex.: maioresFluxos da vista Brasil sem seleção): as duas
        // pontas ficam neutras, em vez de herdar a cor de "entrada" por padrão.
        const origem = escuro ? ORIGEM_ESCURO : ORIGEM_CLARO;
        return [...origem, d.cruza ? 60 : 170] as [number, number, number, number];
      },
      getWidth: (d: Fluxo) => larguraDoArco(d.total),
      widthMinPixels: LARGURA_MIN,
      widthMaxPixels: LARGURA_MAX,
      opacity: 0.75,
      widthUnits: "pixels",
      // F10: curvatura no PLANO do mapa, não em Z -- `getTilt = -90` gira a parábola do
      // ArcLayer para XY. Sob OrthographicView uma flecha em Z não tem projeção em tela e o
      // arco colapsa na corda reta, que é o que produzia a "lâmina" opaca sobre o Atlântico
      // na vista Brasil de 1980. Motivo, medições e escolha do sinal: lib/arcos.ts.
      getHeight: (d: Fluxo) => alturaDoArco(Math.hypot(d.x_d! - d.x_o!, d.y_d! - d.y_o!)),
      getTilt: TILT_ARCO,
      onClick: (info: PickingInfo) => {
        const f = info.object as Fluxo | undefined;
        if (f) aoSelecionarFluxo(f.origem, f.destino);
        return true;
      },
      updateTriggers: { getSourceColor: [escuro], getTargetColor: [escuro], getWidth: [maiorVolume] },
    });

    return [municipios, contornosMalha, contornoRM, contornoSelecao, espigas, fluxos];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [malha, contornos, porCodigo, metrica, metricaContagem, quebras, arcos, selecionado, escuro, aoSelecionar,
      aoSelecionarFluxo, maiorVolume, destacar, perimetro, nucleo, campoId, mostrarFluxos,
      pontosEspiga, maiorAbsolutoEspiga, vista.zoom]);

  const dica = hover?.object as
    | (Feature<Geometry, Record<string, string>> & Fluxo & PontoEspiga)
    | undefined;
  const camadaHover = hover?.layer?.id;

  return (
    // F6 leva 2: role="group" (não "img") -- o container tem descendentes interativos
    // reais (o canvas do deck.gl e o botão "reenquadrar"), e role="img" proíbe filhos
    // focáveis (regra "nested-interactive" do axe). O rótulo textual completo já está
    // no <p class="somente-leitor"> logo abaixo.
    <div ref={containerRef} style={{ position: "absolute", inset: 0 }}
         role="group" aria-label={descricaoAcessivel ?? "Mapa coroplético do Brasil com arcos de fluxo migratório"}>
      {descricaoAcessivel && (
        <p className="somente-leitor">
          {descricaoAcessivel} Os mesmos dados aparecem, em forma de tabela, no painel ao lado
          (indicadores e principais fluxos de origem e destino). Use a busca do cabeçalho para
          selecionar um município ou unidade pelo teclado.
        </p>
      )}
      <DeckGL
        views={VIEW}
        viewState={vista}
        onViewStateChange={({ viewState, interactionState }) => {
          // deck.gl também emite esse evento ao montar/redimensionar; só o gesto do
          // usuário deve tirar o mapa do enquadramento inicial.
          const gesto = Boolean(
            interactionState?.isDragging || interactionState?.isZooming || interactionState?.isPanning,
          );
          if (!gesto && !moveu) return;
          setVista(viewState as VistaCartesiana);
          if (gesto) setMoveu(true);
        }}
        // F10: OrthographicView não herda os limites de zoom do MapView (0-20ish) -- sem eles,
        // dá para rolar até o mapa sumir de tela ou entrar bem além da resolução da malha
        // simplificada. -15 é um pouco além da vista nacional (zoom -12); -2 ainda dá espaço
        // para aproximar mais que o teto de enquadramento automático de município (-8,25, ver
        // App.tsx) sem chegar a ampliar vértices individuais da malha a 1%.
        controller={{ dragRotate: false, minZoom: -15, maxZoom: -2 }}
        layers={camadas}
        onHover={aoHover}
        getCursor={({ isHovering }) => (isHovering ? "pointer" : "grab")}
        style={{ background: escuro ? "#0d0d0d" : "#f9f9f7" }}
      />
      {moveu && (
        <button
          className="reenquadrar"
          onClick={() => {
            const alvo = vistaDoFoco();
            setVista(reduzirMovimento ? alvo : { ...alvo, transitionDuration: 400 });
            setMoveu(false);
          }}
        >
          {rotuloReenquadrar}
        </button>
      )}
      {dica && hover && (
        <div className="dica" style={{ left: hover.x + 12, top: hover.y + 12 }}>
          {camadaHover === "espigas" ? (
            <>
              <strong>{rotuloDaFeicao?.(dica.cd) ?? dica.cd}</strong>
              <div>{textoMetrica(porCodigo.get(dica.cd), metrica)}</div>
              {(() => {
                const rot = porCodigo.get(dica.cd)?.precisao_imig;
                const rotulo = rot ? rotuloPrecisao[rot] ?? rot : null;
                return rotulo ? <div className="muted-pequeno">precisão da imigração: {rotulo}</div> : null;
              })()}
            </>
          ) : "properties" in dica && dica.properties?.[campoId] ? (
            <>
              <strong>{rotuloDaFeicao?.(dica.properties[campoId]) ?? dica.properties[campoId]}</strong>
              <div>{textoMetrica(porCodigo.get(dica.properties[campoId]), metrica)}</div>
              {(() => {
                const m = porCodigo.get(dica.properties[campoId]);
                const rot = m?.precisao_imig ? rotuloPrecisao[m.precisao_imig] ?? m.precisao_imig : null;
                return rot ? <div className="muted-pequeno">precisão da imigração: {rot}</div> : null;
              })()}
            </>
          ) : (
            <>
              <strong>{dica.nm_origem}/{dica.uf_origem} → {dica.nm_destino}/{dica.uf_destino}</strong>
              <div>{num(dica.total)} pessoas · clique para ver o perfil</div>
              {dica.precisao && (
                <div className="muted-pequeno">
                  precisão: {rotuloPrecisao[dica.precisao] ?? dica.precisao}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
