/** Mapa do atlas: coroplético dos municípios + arcos de fluxo.
 *  Sem basemap externo -- a base é a própria malha do IBGE, o que evita dependência
 *  de terceiros e mantém a leitura cartográfica limpa. */
import { useEffect, useMemo, useRef, useState } from "react";
import DeckGL from "@deck.gl/react";
import { GeoJsonLayer, ArcLayer } from "@deck.gl/layers";
import { WebMercatorViewport } from "@deck.gl/core";
import type { MapViewState, PickingInfo } from "@deck.gl/core";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { Fluxo, Metrica } from "../lib/types";
import type { Bbox } from "../lib/rm";
import { corDivergente, type RGB } from "../lib/escalas";
import { num, sinal, rotuloPrecisao } from "../lib/format";

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
  malha, porCodigo, metrica, quebras, arcos, selecionado, escuro, aoSelecionar, aoSelecionarFluxo,
  foco = null, zoomMaximo, rotuloReenquadrar = "Ver o Brasil", destacar = null, nucleo = null,
  campoId = "CD_MUN", rotuloDaFeicao, descricaoAcessivel,
}: Props) {
  const [hover, setHover] = useState<PickingInfo | null>(null);
  // vista controlada: garante que a carga da página sempre comece enquadrando o Brasil
  const [vista, setVista] = useState<MapViewState>(VISTA_BRASIL);
  const [moveu, setMoveu] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  /** Vista que enquadra o `foco` (fitBounds com 48px de margem) ou o Brasil, se não houver foco.
   *  F6 leva 2: `fitBounds` derruba a árvore inteira (sem error boundary) se width/height forem
   *  0 -- o que acontece quando o efeito roda antes do container ter layout (ex.: entrando
   *  direto por link com ?mun=... antes da 1a pintura) ou o próprio viewport ainda mede 0.
   *  Nesses casos, cai para a vista do Brasil em vez de quebrar a página. */
  const vistaDoFoco = (): MapViewState => {
    if (!foco) return VISTA_BRASIL;
    const el = containerRef.current;
    const width = el?.clientWidth || window.innerWidth;
    const height = el?.clientHeight || window.innerHeight;
    if (!width || !height || !Number.isFinite(width) || !Number.isFinite(height)) return VISTA_BRASIL;
    try {
      const vp = new WebMercatorViewport({ width, height });
      const ajustado = vp.fitBounds([[foco[0], foco[1]], [foco[2], foco[3]]], { padding: 48 });
      const zoom = zoomMaximo != null ? Math.min(ajustado.zoom, zoomMaximo) : ajustado.zoom;
      return { longitude: ajustado.longitude, latitude: ajustado.latitude, zoom, pitch: 0, bearing: 0 };
    } catch {
      return VISTA_BRASIL;
    }
  };

  // recalcula o enquadramento sempre que a seleção muda (não a cada re-render: só quando
  // a *identidade* do foco muda -- assim um gesto do usuário depois não é sobrescrito).
  // F6 leva 2: se o container ainda mede 0 (ex.: entrando direto por link, antes da 1a
  // pintura ter layout), tenta de novo em alguns frames -- em vez de travar na vista do
  // Brasil para sempre por causa de uma corrida de layout.
  const focoChave = foco ? foco.join(",") : null;
  useEffect(() => {
    setVista(vistaDoFoco());
    setMoveu(false);
    if (!foco) return;
    let tentativas = 0;
    let vivo = true;
    const tentar = () => {
      const el = containerRef.current;
      if (!vivo || tentativas >= 10) return;
      tentativas++;
      if (!el || el.clientWidth === 0 || el.clientHeight === 0) {
        requestAnimationFrame(tentar);
        return;
      }
      setVista(vistaDoFoco());
    };
    const raf = requestAnimationFrame(tentar);
    return () => { vivo = false; cancelAnimationFrame(raf); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focoChave]);

  // Espessura dos arcos: proporcional à raiz quadrada do volume (área ~ volume, leitura
  // perceptualmente honesta), normalizada pelo maior fluxo EM TELA. Assim o maior arco de
  // qualquer vista é sempre nitidamente grosso e os menores, finos -- a hierarquia não
  // depende da escala absoluta do município escolhido.
  const maiorVolume = useMemo(() => Math.max(1, ...arcos.map((a) => a.total)), [arcos]);
  const LARGURA_MIN = 1.5, LARGURA_MAX = 14;
  const larguraDoArco = (total: number) =>
    LARGURA_MIN + (LARGURA_MAX - LARGURA_MIN) * Math.sqrt(Math.max(0, total) / maiorVolume);

  const camadas = useMemo(() => {
    if (!malha) return [];
    const contorno: RGB = escuro ? [70, 70, 68] : [225, 224, 217];

    const municipios = new GeoJsonLayer({
      id: "municipios",
      data: malha,
      pickable: true,
      stroked: true,
      filled: true,
      lineWidthUnits: "pixels",
      getLineWidth: (f: Feature<Geometry, Record<string, string>>) => {
        const cd = f.properties[campoId];
        if (cd === selecionado) return 2;
        if (nucleo && cd === nucleo) return 3;
        return 0.3;
      },
      getLineColor: (f: Feature<Geometry, Record<string, string>>) => {
        const cd = f.properties[campoId];
        if (cd === selecionado) return escuro ? [255, 255, 255, 255] : [11, 11, 11, 255];
        if (nucleo && cd === nucleo) return escuro ? [255, 255, 255, 220] : [11, 11, 11, 220];
        const fora = destacar && !destacar.has(cd);
        return [...contorno, fora ? 90 : 180];
      },
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
        getLineColor: [selecionado, escuro, nucleo, destacar, campoId],
        getLineWidth: [selecionado, nucleo, campoId],
      },
    });

    const fluxos = new ArcLayer({
      id: "arcos",
      data: arcos,
      pickable: true,
      getSourcePosition: (d: Fluxo) => [d.lon_o!, d.lat_o!],
      getTargetPosition: (d: Fluxo) => [d.lon_d!, d.lat_d!],
      getSourceColor: (d: Fluxo & { direcao?: string; cruza?: boolean; corRgb?: RGB }) => {
        const a = d.cruza ? 90 : 200;
        if (d.corRgb) return [...d.corRgb, a] as [number, number, number, number];
        return (d.direcao === "saida" ? [235, 104, 52, a] : [42, 120, 214, a]) as [number, number, number, number];
      },
      getTargetColor: (d: Fluxo & { direcao?: string; cruza?: boolean; corRgb?: RGB }) => {
        const a = d.cruza ? 40 : 90;
        if (d.corRgb) return [...d.corRgb, a] as [number, number, number, number];
        return (d.direcao === "saida" ? [235, 104, 52, a] : [42, 120, 214, a]) as [number, number, number, number];
      },
      getWidth: (d: Fluxo) => larguraDoArco(d.total),
      widthMinPixels: LARGURA_MIN,
      widthMaxPixels: LARGURA_MAX,
      opacity: 0.75,
      widthUnits: "pixels",
      getHeight: 0.35,
      onClick: (info: PickingInfo) => {
        const f = info.object as Fluxo | undefined;
        if (f) aoSelecionarFluxo(f.origem, f.destino);
        return true;
      },
      updateTriggers: { getSourceColor: [escuro], getTargetColor: [escuro], getWidth: [maiorVolume] },
    });

    return [municipios, fluxos];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [malha, porCodigo, metrica, quebras, arcos, selecionado, escuro, aoSelecionar, aoSelecionarFluxo, maiorVolume,
      destacar, nucleo, campoId]);

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
        onHover={setHover}
        getCursor={({ isHovering }) => (isHovering ? "pointer" : "grab")}
        style={{ background: escuro ? "#0d0d0d" : "#f9f9f7" }}
      />
      {moveu && (
        <button
          className="reenquadrar"
          onClick={() => { setVista(vistaDoFoco()); setMoveu(false); }}
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
