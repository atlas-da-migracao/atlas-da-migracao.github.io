/** Mapa do atlas: coroplético dos municípios + arcos de fluxo.
 *  Sem basemap externo -- a base é a própria malha do IBGE, o que evita dependência
 *  de terceiros e mantém a leitura cartográfica limpa. */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import DeckGL from "@deck.gl/react";
import { GeoJsonLayer, ArcLayer } from "@deck.gl/layers";
import { WebMercatorViewport } from "@deck.gl/core";
import type { MapViewState, PickingInfo } from "@deck.gl/core";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { Fluxo, Metrica } from "../lib/types";
import { validarEExpandirBbox, type Bbox } from "../lib/rm";
import { corDivergente, type RGB } from "../lib/escalas";
import { num, sinal, rotuloPrecisao } from "../lib/format";
import { hexParaRgb } from "../lib/paletas";

// F3 (mapa-representação): cores dos arcos, nos dois temas -- mesmos hex de --arc-in/--arc-out
// em styles/tokens.css (não dá para ler custom properties de dentro de uma cor do deck.gl,
// que precisa de RGB numérico). ORIGEM_* é o cinza neutro (--axis) usado na ponta de origem de
// um arco direcionado: o degradê de cor (não só de alfa) fica mais forte assim -- a origem
// "esvanece" para cinza, o destino chega na cor cheia da direção.
const ARC_IN_CLARO = hexParaRgb("#2a78d6"), ARC_IN_ESCURO = hexParaRgb("#3987e5");
const ARC_OUT_CLARO = hexParaRgb("#eb6834"), ARC_OUT_ESCURO = hexParaRgb("#d95926");
const ORIGEM_CLARO = hexParaRgb("#c3c2b7"), ORIGEM_ESCURO = hexParaRgb("#383835");

export const VISTA_BRASIL: MapViewState = {
  longitude: -53.5, latitude: -14.5, zoom: 3.35, pitch: 0, bearing: 0,
};

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
  /** bbox [minLon,minLat,maxLon,maxLat] para enquadrar a seleção atual; null = Brasil.
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

export function MapaAtlas({
  malha, contornos = null, porCodigo, metrica, quebras, arcos, selecionado, escuro, aoSelecionar, aoSelecionarFluxo,
  foco = null, zoomMaximo, rotuloReenquadrar = "Ver o Brasil", destacar = null, perimetro = null, nucleo = null,
  campoId = "CD_MUN", rotuloDaFeicao, descricaoAcessivel, aoPassarFeicao,
  mostrarFluxos = true, maiorFluxoEdicao = null,
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
  // vista controlada: garante que a carga da página sempre comece enquadrando o Brasil
  const [vista, setVista] = useState<MapViewState>(VISTA_BRASIL);
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

  /** Vista que enquadra o `foco` (fitBounds com 48px de margem) ou o Brasil, se não houver
   *  foco, o contêiner ainda não tiver sido medido, ou o bbox não puder ser validado. Função
   *  pura (não é hook): chamada de dentro do efeito abaixo e do clique em "reenquadrar". */
  const vistaDoFoco = (): MapViewState => {
    if (!tamanho || tamanho.width <= 0 || tamanho.height <= 0) return VISTA_BRASIL;
    const bbox = validarEExpandirBbox(foco);
    if (!bbox) return VISTA_BRASIL;
    const vp = new WebMercatorViewport({ width: tamanho.width, height: tamanho.height });
    const ajustado = vp.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: 48 });
    const zoom = zoomMaximo != null ? Math.min(ajustado.zoom, zoomMaximo) : ajustado.zoom;
    return { longitude: ajustado.longitude, latitude: ajustado.latitude, zoom, pitch: 0, bearing: 0 };
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

  const camadas = useMemo(() => {
    if (!malha) return [];
    const contorno: RGB = escuro ? [70, 70, 68] : [225, 224, 217];
    // UF é o único nível cujo contorno "normal" deve se destacar mais (hierarquia
    // figura-fundo): mais escuro/mais grosso que a fronteira municipal.
    const ehUf = campoId === "cd_uf";

    const municipios = new GeoJsonLayer({
      id: "municipios",
      data: malha,
      pickable: true,
      // F2 (mapa-representacao): sem contorno por feição -- fronteira "normal" agora vem da
      // malha de arestas (camada "contornos-malha" abaixo), que não duplica arestas
      // compartilhadas nem desenha arestas internas de MultiPolygon.
      stroked: false,
      filled: true,
      getFillColor: (f: Feature<Geometry, Record<string, string>>) => {
        const cd = f.properties[campoId];
        const c = corDivergente(valorDaMetrica(porCodigo.get(cd), metrica), quebras, escuro);
        const fora = destacar && !destacar.has(cd);
        return [...c, fora ? 70 : 235] as [number, number, number, number];
      },
      onClick: (info: PickingInfo) => {
        const cd = (info.object as Feature<Geometry, Record<string, string>> | undefined)?.properties?.[campoId];
        aoSelecionar(cd ?? null);
        return true;
      },
      updateTriggers: {
        getFillColor: [metrica, quebras.join(","), escuro, porCodigo.size, destacar],
      },
    });

    // Contorno "normal": malha de arestas (fronteiras únicas), não por feição. `contornos`
    // vem de topojson.mesh((a,b) => a !== b) em App.tsx -- some tanto a duplicação de uma
    // fronteira compartilhada (desenhada 1x em vez de 2x) quanto a aresta interna de um
    // MultiPolygon da mesma feição (ex.: a grade que aparecia dentro do NORTEGO em 1980).
    const contornosMalha = contornos && new GeoJsonLayer({
      id: "contornos-malha",
      data: [contornos],
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
      pickable: false,
      stroked: true,
      filled: false,
      lineWidthUnits: "pixels",
      lineJointRounded: true,
      getLineWidth: 2.5,
      getLineColor: escuro ? [255, 255, 255, 235] : [11, 11, 11, 235],
      updateTriggers: { getLineColor: [escuro] },
    });

    // F3 (mapa-representação): direção legível dentro do que o ArcLayer nativo do deck.gl
    // oferece. O ArcLayer NÃO afunila (getWidth é um escalar por arco, não por vértice --
    // não há prop de largura variável ao longo da curva); implementamos só os outros dois
    // recursos do plano:
    // (2) curvatura/tilt: sinal oposto conforme o par ordenado (origem < destino ou não),
    //     não conforme "entrada"/"saida" -- assim QUALQUER par recíproco A->B e B->A (inclusive
    //     nos módulos sem campo `direcao`, como os fluxos intra-RM e pendulares) fica separado
    //     visualmente, em vez de um esconder o outro exatamente na mesma curva.
    // (3) degradê de cor mais forte: a ponta de origem vai para um cinza neutro (--axis) em
    //     vez de só reduzir o alfa da mesma cor -- a ponta de destino chega na cor cheia da
    //     direção (entrada/saída) ou da tipologia (RM). Sem direção real (ex.: maioresFluxos
    //     da vista Brasil sem seleção, que não marca `direcao`), as duas pontas ficam neutras
    //     em vez de aplicar a cor de "entrada" por padrão -- ver App.tsx.
    const TILT = 15;
    const arcCor = (d: Fluxo & { direcao?: string; corRgb?: RGB }) => {
      if (d.corRgb) return d.corRgb;
      if (d.direcao === "entrada") return escuro ? ARC_IN_ESCURO : ARC_IN_CLARO;
      if (d.direcao === "saida") return escuro ? ARC_OUT_ESCURO : ARC_OUT_CLARO;
      return null; // sem direção conhecida: neutro nas duas pontas
    };
    const fluxos = new ArcLayer({
      id: "arcos",
      data: arcos,
      visible: mostrarFluxos,
      pickable: mostrarFluxos,
      getSourcePosition: (d: Fluxo) => [d.lon_o!, d.lat_o!],
      getTargetPosition: (d: Fluxo) => [d.lon_d!, d.lat_d!],
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
      getHeight: 0.35,
      getTilt: (d: Fluxo) => (d.origem < d.destino ? TILT : -TILT),
      onClick: (info: PickingInfo) => {
        const f = info.object as Fluxo | undefined;
        if (f) aoSelecionarFluxo(f.origem, f.destino);
        return true;
      },
      updateTriggers: { getSourceColor: [escuro], getTargetColor: [escuro], getWidth: [maiorVolume] },
    });

    return [municipios, contornosMalha, contornoRM, contornoSelecao, fluxos];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [malha, contornos, porCodigo, metrica, quebras, arcos, selecionado, escuro, aoSelecionar, aoSelecionarFluxo,
      maiorVolume, destacar, perimetro, nucleo, campoId, mostrarFluxos]);

  const dica = hover?.object as
    | (Feature<Geometry, Record<string, string>> & Fluxo)
    | undefined;

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
        viewState={vista}
        onViewStateChange={({ viewState, interactionState }) => {
          // deck.gl também emite esse evento ao montar/redimensionar; só o gesto do
          // usuário deve tirar o mapa do enquadramento inicial.
          const gesto = Boolean(
            interactionState?.isDragging || interactionState?.isZooming || interactionState?.isPanning,
          );
          if (!gesto && !moveu) return;
          setVista(viewState as MapViewState);
          if (gesto) setMoveu(true);
        }}
        controller={{ dragRotate: false }}
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
          {"properties" in dica && dica.properties?.[campoId] ? (
            <>
              <strong>{rotuloDaFeicao?.(dica.properties[campoId]) ?? dica.properties[campoId]}</strong>
              <div>
                {(() => {
                  const m = porCodigo.get(dica.properties[campoId]);
                  if (!m) return "sem dados";
                  return metrica === "tlm"
                    ? `${sinal(m.tlm)} por mil habitantes`
                    : `saldo ${sinal(m.saldo)} pessoas`;
                })()}
              </div>
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
