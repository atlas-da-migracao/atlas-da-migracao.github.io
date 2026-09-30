/** Matriz de acordes UF x UF (F6 leva 2, pendência 10a): fluxos migratórios entre as 27
 *  UFs, arcos coloridos pela grande região, cordas com opacidade baixa e destaque ao
 *  passar o mouse/focar. Desenho em SVG próprio (como o Sankey), sem lib de renderização --
 *  só o layout vem de d3-chord/d3-shape. */
import { useEffect, useMemo, useRef, useState } from "react";
import { chord, ribbon } from "d3-chord";
import { arc as arcShape } from "d3-shape";
import { prepararMatrizAcordes, type FluxoUF, type UnidadeUF } from "../lib/acordes";
import { posicionarRotulosAngulares } from "../lib/rotulos";
import { REGIAO_ORDEM } from "../lib/uf";
import { CATEGORICO_8, cor as corDeCategoria } from "../lib/paletas";
import { num, num1 } from "../lib/format";

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
const RAIO_ROTULO = RAIO_EXTERNO + 14;
/** caixa de um rótulo de sigla (duas letras a 9,5 px) com um respiro, em unidades do viewBox */
const ROTULO_LARGURA = 18;
const ROTULO_ALTURA = 12;
/** deslocamento (em unidades do viewBox) a partir do qual um rótulo afastado do seu arco ganha
 *  uma linha-guia até ele */
const LIMIAR_GUIA = 5;
/** a tabela alternativa lista só os maiores fluxos -- dizer quantos (ver o rodapé dela) */
const LINHAS_TABELA = 100;

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
    // Rótulos: cada sigla nasce no ângulo central do próprio arco, mas as UFs do Norte (RO, AC,
    // AM, RR, PA, AP, TO) têm arcos de ~1° e os rótulos se sobrepunham. Os ângulos são
    // relaxados até nenhum par vizinho se sobrepor; quem saiu do lugar ganha uma linha-guia.
    const angulosArco = grupos.groups.map((g) => (g.startAngle + g.endAngle) / 2);
    const angulosRotulo = posicionarRotulosAngulares(angulosArco, RAIO_ROTULO, ROTULO_LARGURA, ROTULO_ALTURA);
    return { grupos, gerArc, gerRibbon, angulosArco, angulosRotulo };
  }, [dados]);

  // tabela alternativa: só os `LINHAS_TABELA` maiores pares, e o quanto do total eles cobrem
  const tabela = useMemo(() => {
    const ordenados = [...fluxos].sort((a, b) => b.total - a.total);
    const mostrados = ordenados.slice(0, LINHAS_TABELA);
    const soma = (l: FluxoUF[]) => l.reduce((acc, f) => acc + f.total, 0);
    const totalGeral = soma(ordenados);
    return {
      mostrados, total: ordenados.length,
      pctMostrado: totalGeral > 0 ? (soma(mostrados) / totalGeral) * 100 : 100,
    };
  }, [fluxos]);

  if (!layout || dados.codigos.length === 0) {
    return <p className="muted">Sem dados suficientes para a matriz de acordes.</p>;
  }

  const { grupos, gerArc, gerRibbon, angulosArco, angulosRotulo } = layout;

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
                    aria-label={`${dados.siglas[c.source.index]} → ${dados.siglas[c.target.index]}: ${num(dados.matriz[c.source.index][c.target.index])} pessoas; ` +
                      `${dados.siglas[c.target.index]} → ${dados.siglas[c.source.index]}: ${num(dados.matriz[c.target.index][c.source.index])} pessoas`}
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
            const anguloRotulo = angulosRotulo[i];
            const x = Math.sin(anguloRotulo) * RAIO_ROTULO;
            const y = -Math.cos(anguloRotulo) * RAIO_ROTULO;
            // linha-guia do arco até o rótulo, só quando o rótulo foi afastado do seu lugar
            const deslocado = Math.abs(anguloRotulo - angulosArco[i]) * RAIO_EXTERNO > LIMIAR_GUIA;
            // a largura do arco é a EMIGRAÇÃO da UF (grupos de `chord()` = soma da linha da
            // matriz); a imigração é a soma da coluna
            const emigrantes = dados.matriz[i].reduce((acc, v) => acc + v, 0);
            const imigrantes = dados.matriz.reduce((acc, linha) => acc + linha[i], 0);
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
                {deslocado && (
                  <line x1={Math.sin(angulosArco[i]) * RAIO_EXTERNO} y1={-Math.cos(angulosArco[i]) * RAIO_EXTERNO}
                        x2={Math.sin(anguloRotulo) * (RAIO_ROTULO - 7)} y2={-Math.cos(anguloRotulo) * (RAIO_ROTULO - 7)}
                        style={{ stroke: "var(--ink-secondary)", strokeWidth: 0.6 }}
                        opacity={emFoco ? 0.7 : 0.25} pointerEvents="none" />
                )}
                <text x={x} y={y} textAnchor="middle" dominantBaseline="middle"
                      className="acorde-rotulo" opacity={emFoco ? 1 : 0.4}>
                  {dados.siglas[i]}
                </text>
                <title>{`${dados.siglas[i]}: ${num(emigrantes)} pessoas saíram para outras UFs; ${num(imigrantes)} chegaram de outras UFs`}</title>
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

      <p className="muted-pequeno">
        A largura do arco de cada UF é proporcional ao total de quem saiu dela para outras UFs;
        em cada ponta de uma corda, a largura é o fluxo que sai daquela UF para a outra.
      </p>

      <details className="tabela-alternativa">
        <summary>
          Ver a tabela dos {tabela.total > LINHAS_TABELA ? `${num(LINHAS_TABELA)} maiores ` : ""}fluxos entre UFs
        </summary>
        <table className="tabela-fluxos">
          <thead>
            <tr><th>Origem</th><th>Destino</th><th className="valor-cel">Total</th></tr>
          </thead>
          <tbody>
            {tabela.mostrados.map((f, i) => (
              <tr key={i}>
                <td>{nomePorCodigo.get(f.origem) ?? f.origem}</td>
                <td>{nomePorCodigo.get(f.destino) ?? f.destino}</td>
                <td className="valor-cel">{num(f.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted-pequeno">
          {tabela.total > LINHAS_TABELA
            ? <>Mostrando os {num(LINHAS_TABELA)} maiores de {num(tabela.total)} pares publicados
                ({num1(tabela.pctMostrado)}% do total de migrantes entre UFs); os outros{" "}
                {num(tabela.total - LINHAS_TABELA)} não estão listados, mas estão no diagrama.</>
            : <>Todos os {num(tabela.total)} pares publicados.</>}
        </p>
      </details>
    </div>
  );
}
