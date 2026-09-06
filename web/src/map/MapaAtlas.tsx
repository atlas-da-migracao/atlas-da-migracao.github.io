/** Mapa do atlas: coroplético dos municípios + arcos de fluxo.
 *  Sem basemap externo -- a base é a própria malha do IBGE, o que evita dependência
 *  de terceiros e mantém a leitura cartográfica limpa. */
import { useEffect, useMemo, useState } from "react";
import DeckGL from "@deck.gl/react";
import { GeoJsonLayer, ArcLayer } from "@deck.gl/layers";
import type { MapViewState, PickingInfo } from "@deck.gl/core";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { Fluxo, Metrica, Municipio } from "../lib/types";
import { corDivergente, type RGB } from "../lib/escalas";
import { num, sinal } from "../lib/format";

export const VISTA_BRASIL: MapViewState = {
  longitude: -53.5, latitude: -14.5, zoom: 3.35, pitch: 0, bearing: 0,
};

interface Props {
  malha: FeatureCollection | null;
  porCodigo: Map<string, Municipio>;
  metrica: Metrica;
  quebras: number[];
  arcos: (Fluxo & { direcao?: string })[];
  selecionado: string | null;
  escuro: boolean;
  aoSelecionar: (cd: string | null) => void;
  aoSelecionarFluxo: (o: string, d: string) => void;
}

const valorDaMetrica = (m: Municipio | undefined, metrica: Metrica): number | null => {
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
}: Props) {
  const [hover, setHover] = useState<PickingInfo | null>(null);
  // vista controlada: garante que a carga da página sempre comece enquadrando o Brasil
  const [vista, setVista] = useState<MapViewState>(VISTA_BRASIL);
  const [moveu, setMoveu] = useState(false);

  useEffect(() => { setVista(VISTA_BRASIL); }, []);

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
      getLineWidth: (f: Feature<Geometry, { CD_MUN: string }>) =>
        f.properties.CD_MUN === selecionado ? 2 : 0.3,
      getLineColor: (f: Feature<Geometry, { CD_MUN: string }>) =>
        f.properties.CD_MUN === selecionado
          ? (escuro ? [255, 255, 255, 255] : [11, 11, 11, 255])
          : [...contorno, 180],
      getFillColor: (f: Feature<Geometry, { CD_MUN: string }>) =>
        [...corDivergente(valorDaMetrica(porCodigo.get(f.properties.CD_MUN), metrica), quebras, escuro), 235] as
          [number, number, number, number],
      onClick: (info: PickingInfo) => {
        const cd = (info.object as Feature<Geometry, { CD_MUN: string }> | undefined)?.properties?.CD_MUN;
        aoSelecionar(cd ?? null);
        return true;
      },
      updateTriggers: {
        getFillColor: [metrica, quebras.join(","), escuro, porCodigo.size],
        getLineColor: [selecionado, escuro],
        getLineWidth: [selecionado],
      },
    });

    const fluxos = new ArcLayer({
      id: "arcos",
      data: arcos,
      pickable: true,
      getSourcePosition: (d: Fluxo) => [d.lon_o!, d.lat_o!],
      getTargetPosition: (d: Fluxo) => [d.lon_d!, d.lat_d!],
      getSourceColor: (d: Fluxo & { direcao?: string }) =>
        (d.direcao === "saida" ? [235, 104, 52, 200] : [42, 120, 214, 200]) as [number, number, number, number],
      getTargetColor: (d: Fluxo & { direcao?: string }) =>
        (d.direcao === "saida" ? [235, 104, 52, 90] : [42, 120, 214, 90]) as [number, number, number, number],
      getWidth: (d: Fluxo) => Math.max(1, Math.sqrt(d.total) / 34),
      // fluxos de baixa precisão aparecem esmaecidos, nunca escondidos
      opacity: 0.7,
      widthUnits: "pixels",
      getHeight: 0.35,
      onClick: (info: PickingInfo) => {
        const f = info.object as Fluxo | undefined;
        if (f) aoSelecionarFluxo(f.origem, f.destino);
        return true;
      },
      updateTriggers: { getSourceColor: [escuro], getTargetColor: [escuro] },
    });

    return [municipios, fluxos];
  }, [malha, porCodigo, metrica, quebras, arcos, selecionado, escuro, aoSelecionar, aoSelecionarFluxo]);

  const dica = hover?.object as
    | (Feature<Geometry, { CD_MUN: string; NM_MUN: string; SIGLA_UF: string }> & Fluxo)
    | undefined;

  return (
    <div style={{ position: "absolute", inset: 0 }}>
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
          onClick={() => { setVista(VISTA_BRASIL); setMoveu(false); }}
        >
          Ver o Brasil
        </button>
      )}
      {dica && hover && (
        <div className="dica" style={{ left: hover.x + 12, top: hover.y + 12 }}>
          {"properties" in dica && dica.properties?.CD_MUN ? (
            <>
              <strong>{dica.properties.NM_MUN}/{dica.properties.SIGLA_UF}</strong>
              <div>
                {(() => {
                  const m = porCodigo.get(dica.properties.CD_MUN);
                  if (!m) return "sem dados";
                  return metrica === "tlm"
                    ? `${sinal(m.tlm)} por mil habitantes`
                    : `saldo ${sinal(m.saldo)} pessoas`;
                })()}
              </div>
            </>
          ) : (
            <>
              <strong>{dica.nm_origem}/{dica.uf_origem} → {dica.nm_destino}/{dica.uf_destino}</strong>
              <div>{num(dica.total)} pessoas · clique para ver o perfil</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
