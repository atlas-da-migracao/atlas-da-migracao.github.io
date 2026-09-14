/** Matriz de acordes UF x UF (F6 leva 2, pendência 10a): fluxos migratórios entre as 27
 *  UFs, arcos coloridos pela grande região, cordas com opacidade baixa e destaque ao
 *  passar o mouse/focar. Desenho em SVG próprio (como o Sankey), sem lib de renderização --
 *  só o layout vem de d3-chord/d3-shape. */
import { useEffect, useMemo, useRef, useState } from "react";
import { chord, ribbon } from "d3-chord";
import { arc as arcShape } from "d3-shape";
import { prepararMatrizAcordes, type FluxoUF, type UnidadeUF } from "../lib/acordes";
import { REGIAO_ORDEM } from "../lib/uf";
import { CATEGORICO_8, cor as corDeCategoria } from "../lib/paletas";
import { num } from "../lib/format";

const CORES_REGIAO = REGIAO_ORDEM.map((_, i) => CATEGORICO_8[i]);

interface Props {
  fluxos: FluxoUF[];
  unidades: UnidadeUF[];
  escuro: boolean;
  aoSelecionarPar: (o: string, d: string) => void;
  /** UF selecionada no mapa: fica em destaque quando não há hover */
  selecionado?: string | null;
  /** UF sob o cursor no mapa */
  realceExterno?: string | null;
  /** clique no arco de uma UF (null = desmarcar) */
  aoSelecionarUF?: (cd: string | null) => void;
  /** UFs em foco no diagrama, para o mapa esmaecer as demais (null = nenhuma) */
  aoRealcar?: (cds: string[] | null) => void;
}

const TAMANHO = 560;
const RAIO_EXTERNO = TAMANHO / 2 - 60;
const RAIO_INTERNO = RAIO_EXTERNO - 14;

export function DiagramaAcordes({ fluxos, unidades, escuro, aoSelecionarPar, selecionado = null,
                                  realceExterno = null, aoSelecionarUF, aoRealcar }: Props) {
  const [hover, setHover] = useState<number | null>(null);

  const dados = useMemo(() => prepararMatrizAcordes(fluxos, unidades), [fluxos, unidades]);
  const indiceDe = (cd: string | null) => {
    const i = cd == null ? -1 : dados.codigos.indexOf(cd);
    return i < 0 ? null : i;
  };
  const iSelecionado = indiceDe(selecionado);
  const ativo = hover ?? indiceDe(realceExterno) ?? iSelecionado;

  const realcarRef = useRef(aoRealcar);
  realcarRef.current = aoRealcar;
  useEffect(() => () => realcarRef.current?.(null), []);

  const entrar = (i: number, par?: number) => {
    setHover(i);
    aoRealcar?.(par == null ? [dados.codigos[i]] : [dados.codigos[i], dados.codigos[par]]);
  };
  const sair = () => {
    setHover(null);
    aoRealcar?.(null);
  };
  const alternarUF = (i: number) =>
    aoSelecionarUF?.(i === iSelecionado ? null : dados.codigos[i]);
  const nomePorCodigo = useMemo(
    () => new Map(unidades.map((u) => [u.codigo, u.uf_sigla ?? u.nome])), [unidades]);

  const layout = useMemo(() => {
    if (dados.matriz.length === 0) return null;
    const gerador = chord().padAngle(0.02).sortSubgroups((a, b) => b - a);
    const grupos = gerador(dados.matriz);
    const gerArc = arcShape<typeof grupos.groups[number]>().innerRadius(RAIO_INTERNO).outerRadius(RAIO_EXTERNO);
    const gerRibbon = ribbon<unknown, typeof grupos[number]>().radius(RAIO_INTERNO);
    return { grupos, gerArc, gerRibbon };
  }, [dados]);

  if (!layout || dados.codigos.length === 0) {
    return <p className="muted">Sem dados suficientes para a matriz de acordes.</p>;
  }

  const { grupos, gerArc, gerRibbon } = layout;

  return (
    <div className="acordes-figura">
      {/* sem role="img" no <svg>: as cordas abaixo são controles interativos reais (clique/teclado),
          e um role de imagem não pode ter descendentes interativos (regra "nested-interactive" do axe) */}
      <svg viewBox={`0 0 ${TAMANHO} ${TAMANHO}`}
           aria-label={`Diagrama de acordes com os fluxos migratórios entre as 27 unidades da federação; ` +
             `os mesmos dados estão na tabela abaixo do diagrama.`}>
        <g transform={`translate(${TAMANHO / 2}, ${TAMANHO / 2})`}>
          {grupos.map((c, i) => {
            const emFoco = ativo == null || c.source.index === ativo || c.target.index === ativo;
            const cIni = corDeCategoria(CORES_REGIAO[dados.regiaoIdx[c.source.index]], escuro);
            return (
              <path key={i} d={gerRibbon(c) ?? undefined} className="acorde-corda"
                    fill={cIni} opacity={emFoco ? 0.55 : 0.06}
                    onMouseEnter={() => entrar(c.source.index, c.target.index)}
                    onMouseLeave={sair}
                    onFocus={() => entrar(c.source.index, c.target.index)}
                    onBlur={sair}
                    onClick={() => aoSelecionarPar(dados.codigos[c.source.index], dados.codigos[c.target.index])}
                    tabIndex={0}
                    role="button"
                    aria-label={`${dados.siglas[c.source.index]} → ${dados.siglas[c.target.index]}: ${num(c.source.value)} pessoas`}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        aoSelecionarPar(dados.codigos[c.source.index], dados.codigos[c.target.index]);
                      }
                    }} />
            );
          })}
          {grupos.groups.map((g, i) => {
            const emFoco = ativo == null || i === ativo;
            const centroide = gerArc.centroid(g);
            const angulo = (g.startAngle + g.endAngle) / 2;
            const raioRotulo = RAIO_EXTERNO + 14;
            const x = Math.sin(angulo) * raioRotulo;
            const y = -Math.cos(angulo) * raioRotulo;
            return (
              <g key={i}>
                <path d={gerArc(g) ?? undefined}
                      className={`acorde-arco${aoSelecionarUF ? " clicavel" : ""}${i === iSelecionado ? " selecionado" : ""}`}
                      fill={corDeCategoria(CORES_REGIAO[dados.regiaoIdx[i]], escuro)}
                      opacity={emFoco ? 1 : 0.3}
                      onMouseEnter={() => entrar(i)} onMouseLeave={sair}
                      {...(aoSelecionarUF ? {
                        role: "button", tabIndex: 0, "aria-pressed": i === iSelecionado,
                        "aria-label": `${dados.siglas[i]}: ${i === iSelecionado ? "desmarcar" : "selecionar"} no mapa`,
                        onClick: () => alternarUF(i),
                        onFocus: () => entrar(i), onBlur: sair,
                        onKeyDown: (e: React.KeyboardEvent) => {
                          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); alternarUF(i); }
                        },
                      } : {})} />
                <text x={x} y={y} textAnchor="middle" dominantBaseline="middle"
                      className="acorde-rotulo" opacity={emFoco ? 1 : 0.4}>
                  {dados.siglas[i]}
                </text>
                <title>{`${dados.siglas[i]}: ${num(centroide ? g.value : g.value)} pessoas no total`}</title>
              </g>
            );
          })}
        </g>
      </svg>

      <ul className="perfil-legenda" aria-hidden="true">
        {REGIAO_ORDEM.map((r, i) => (
          <li key={r}>
            <span className="amostra pequena" style={{ background: corDeCategoria(CORES_REGIAO[i], escuro) }} />
            {r}
          </li>
        ))}
      </ul>

      <details className="tabela-alternativa">
        <summary>Ver a tabela de fluxos entre UFs</summary>
        <table className="tabela-fluxos">
          <thead>
            <tr><th>Origem</th><th>Destino</th><th className="valor-cel">Total</th></tr>
          </thead>
          <tbody>
            {fluxos.slice(0, 100).map((f, i) => (
              <tr key={i}>
                <td>{nomePorCodigo.get(f.origem) ?? f.origem}</td>
                <td>{nomePorCodigo.get(f.destino) ?? f.destino}</td>
                <td className="valor-cel">{num(f.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
