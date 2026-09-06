/** Diagrama aluvial de 3 colunas: morava em (2017) -> mora em (2022) -> trabalha em (2022).
 *  Camada visual fina sobre d3-sankey (só o layout; a marcação é SVG simples, sem
 *  biblioteca de desenho, como as demais barras do atlas). */
import { useMemo } from "react";
import { sankey, sankeyLinkHorizontal } from "d3-sankey";
import type { SankeyGraph, SankeyLink, SankeyNode } from "d3-sankey";
import type { DadosSankey } from "../lib/rm";
import { CLASSE_TRAB, cor } from "../lib/paletas";

interface NoDatum { id: string; rotulo: string }
interface LinkDatum { classe: string }
type No = SankeyNode<NoDatum, LinkDatum>;
type Link = SankeyLink<NoDatum, LinkDatum>;

interface Props {
  dados: DadosSankey;
  escuro: boolean;
  largura?: number;
  altura?: number;
}

const CINZA_RESIDENCIA = { claro: "#c3c2b7", escuro: "#52514e" };

function corDoLink(classe: string, escuro: boolean): string {
  if (classe === "residencia" || classe === "outros") return cor(CINZA_RESIDENCIA, escuro);
  const c = (CLASSE_TRAB as Record<string, { rotulo: string; cor: { claro: string; escuro: string } }>)[classe];
  return c ? cor(c.cor, escuro) : cor(CINZA_RESIDENCIA, escuro);
}

export function Sankey({ dados, escuro, largura = 340, altura = 340 }: Props) {
  const layout = useMemo(() => {
    if (dados.nodes.length === 0 || dados.links.length === 0) return null;
    const grafo: SankeyGraph<NoDatum, LinkDatum> = {
      nodes: dados.nodes.map((n) => ({ ...n })),
      links: dados.links.map((l) => ({ ...l, value: l.value })),
    };
    const gerador = sankey<NoDatum, LinkDatum>()
      .nodeId((d) => d.id)
      .nodeWidth(12)
      .nodePadding(9)
      .extent([[1, 6], [largura - 1, altura - 6]]);
    return gerador(grafo);
  }, [dados, largura, altura]);

  if (!layout) return <p className="muted">Caminhos insuficientes para o diagrama.</p>;

  const path = sankeyLinkHorizontal<NoDatum, LinkDatum>();
  const profundidadeMax = Math.max(...layout.nodes.map((n) => n.depth ?? 0));

  return (
    <svg viewBox={`0 0 ${largura} ${altura}`} width="100%" height={altura} role="img"
         aria-label="Diagrama de fluxo: onde os migrantes moravam em 2017, passaram a morar e trabalham em 2022">
      <g>
        {(layout.links as Link[]).map((l, i) => (
          <path key={i} d={path(l) ?? undefined} fill="none"
                stroke={corDoLink((l as unknown as { classe: string }).classe, escuro)}
                strokeOpacity={0.5} strokeWidth={Math.max(1, l.width ?? 1)} />
        ))}
      </g>
      <g>
        {(layout.nodes as No[]).map((n) => {
          const fimDaColuna = (n.depth ?? 0) === profundidadeMax;
          return (
            <g key={n.id}>
              <rect x={n.x0} y={n.y0} width={(n.x1 ?? 0) - (n.x0 ?? 0)}
                    height={Math.max(1, (n.y1 ?? 0) - (n.y0 ?? 0))}
                    fill={escuro ? "#c3c2b7" : "#52514e"} />
              <text x={fimDaColuna ? (n.x0 ?? 0) - 5 : (n.x1 ?? 0) + 5}
                    y={((n.y0 ?? 0) + (n.y1 ?? 0)) / 2} dy="0.32em" fontSize={9.5}
                    textAnchor={fimDaColuna ? "end" : "start"}
                    fill={escuro ? "#ffffff" : "#0b0b0b"}>
                {n.rotulo}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
