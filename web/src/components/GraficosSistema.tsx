/** F12.5-gráficos -- os 3 gráficos do Bloco 2 ("O sistema"), seção 3.2 do documento de
 *  desenho: (a) plano MEI×CMI com trajetória e contornos de ANMR constante; (b) dispersão de
 *  Fielding (5 small multiples); (c) figura de Courgeau (CMI × nº de unidades, 5 linhas por
 *  edição). O item (d) (Duncan D + log-linear, "linha de 4 números") NÃO tem gráfico próprio
 *  por especificação -- está em `SerieCensos.tsx`, junto do resto do Bloco 2.
 *
 *  DESVIO DOCUMENTADO -- (b) Dispersão de Fielding: a especificação pede uma nuvem de pontos
 *  por unidade (x = log10 densidade, y = taxa líquida) mais a reta ajustada. `unidades_serie`
 *  (a única tabela publicada ao front para esta seção) NÃO publica população nem área por
 *  unidade -- só `pipeline/area_km2.parquet` (usado internamente por `build_series.py` para
 *  calcular `beta_fielding`/`ep_beta`, ambos publicados em `sistema_serie`) tem essa
 *  informação, e não é copiado para `data/processed/series`. Reconstruir a nuvem de pontos
 *  exigiria publicar população e área por unidade/edição -- uma decisão de pipeline (o que
 *  publicar, se pop/área correspondem à mesma definição territorial usada no cálculo de
 *  `beta_fielding`) que não me cabe tomar aqui (ver CLAUDE.md: decisões de comparabilidade são
 *  do agente `metodologo`). Esta implementação usa só o que já é publicado: os cinco painéis
 *  mostram o coeficiente β±erro-padrão (já calculado e publicado) e a leitura em palavras, sem
 *  a nuvem de pontos -- sinalizado como pendência, não aproximado com dado inventado.
 *
 *  Usa @observablehq/plot (já dependência do projeto) -- `Plot.plot()` devolve um `<svg>` (ou
 *  `<figure>` com `<svg>` dentro, quando há legenda de cor); anexado a uma `<div>` via ref em
 *  `useEffect`, removendo o anterior antes de cada novo desenho (padrão recomendado pela
 *  própria documentação do Plot para uso fora de notebooks Observable).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import * as Plot from "@observablehq/plot";
import { serieCourgeau } from "../db/queries";
import { rotuloEdicao, rotuloIntervalo, slotEdicao, type EdicaoSerie, type NivelSerie } from "../lib/serie";
import { AZUL, cor as corDaPaleta } from "../lib/paletas";
import { num, num2 } from "../lib/format";

const ROTULO_NIVEL: Record<NivelSerie, string> = {
  mun: "municípios", rgi: "regiões imediatas", rgint: "regiões intermediárias", uf: "UFs", rm: "regiões metropolitanas",
};

/** Renderiza uma figura do Plot dentro de uma <div>. */
function useFigura(desenhar: () => (SVGSVGElement | HTMLElement) | null, deps: unknown[]) {
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.innerHTML = "";
    const figura = desenhar();
    if (!figura) return;
    el.appendChild(figura);
    return () => { el.innerHTML = ""; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { containerRef };
}

interface LinhaSistema {
  edicao: EdicaoSerie; n_unidades: number | null; cmi: number | null; mei: number | null;
  anmr: number | null; beta_fielding: number | null; ep_beta: number | null;
}

function normalizar(linhas: Record<string, unknown>[]): LinhaSistema[] {
  return linhas.map((l) => ({
    edicao: l.edicao as EdicaoSerie,
    n_unidades: (l.n_unidades as number) ?? null,
    cmi: (l.cmi as number) ?? null,
    mei: (l.mei as number) ?? null,
    anmr: (l.anmr as number) ?? null,
    beta_fielding: (l.beta_fielding as number) ?? null,
    ep_beta: (l.ep_beta as number) ?? null,
  }));
}

/** (a) Plano MEI×CMI com trajetória, seção 3.2-a. 420x320px. */
function PlanoMeiCmi({ linhas, edicoes }: { linhas: LinhaSistema[]; edicoes: readonly EdicaoSerie[] }) {
  const pontos = linhas.filter((l) => l.cmi != null && l.mei != null);
  const { containerRef } = useFigura(() => {
    if (pontos.length === 0) return null;
    const cmiMax = Math.max(1, ...pontos.map((p) => p.cmi!)) * 1.15;
    const meiMax = Math.max(1, ...pontos.map((p) => p.mei!)) * 1.15;
    // contornos de ANMR constante: mei = 100 * anmr / cmi
    const niveisAnmr = [0.5, 1, 2, 4];
    const contornos = niveisAnmr.flatMap((k) => {
      const cmis = Array.from({ length: 60 }, (_, i) => cmiMax * (i + 1) / 60);
      return cmis
        .map((cmi) => ({ cmi, mei: (100 * k) / cmi, k }))
        .filter((p) => p.mei <= meiMax);
    });
    // segmento 1980->edição seguinte tracejado (proxy), separado do resto (sólido) -- Plot.line
    // não aceita um acessor por-segmento para strokeDasharray, então a linha é desenhada em
    // duas séries: os dois primeiros pontos (tracejado) e o restante (sólido), com o ponto
    // seguinte repetido nas duas para não deixar um vão na trajetória. Só existe segmento
    // tracejado quando o PRIMEIRO ponto da trajetória é "1980" -- se 1980 não está marcada,
    // não há trecho de proxy a destacar (não há segmento órfão).
    const primeiroEhProxy = pontos.length > 0 && pontos[0].edicao === "1980";
    const segmentoProxy = primeiroEhProxy ? pontos.slice(0, 2) : [];
    const segmentoResto = primeiroEhProxy ? pontos.slice(1) : pontos;
    return Plot.plot({
      width: 420, height: 320, marginRight: 40,
      x: { label: "CMI (%) →", domain: [0, cmiMax] },
      y: { label: "↑ MEI agregado (%)", domain: [0, meiMax] },
      marks: [
        Plot.line(contornos, {
          x: "cmi", y: "mei", z: "k", stroke: "#c3c2b7", strokeWidth: 1, curve: "basis",
        }),
        ...niveisAnmr.map((k) => Plot.text([{ cmi: cmiMax * 0.97, mei: (100 * k) / (cmiMax * 0.97) }], {
          x: "cmi", y: "mei", text: () => `ANMR ${num2(k)}`, fill: "#898781", fontSize: 9, dx: -4,
        })),
        Plot.line(segmentoProxy, { x: "cmi", y: "mei", stroke: "var(--ink-secondary)", strokeDasharray: "4,3" }),
        Plot.line(segmentoResto, { x: "cmi", y: "mei", stroke: "var(--ink)" }),
        Plot.dot(pontos, {
          x: "cmi", y: "mei", r: 4,
          symbol: (d) => (d.edicao === "1980" ? "diamond" : "circle"),
          fill: (d) => (d.edicao === "1980" ? "none" : "var(--ink)"),
          stroke: "var(--ink)",
        }),
        Plot.text(pontos, { x: "cmi", y: "mei", text: "edicao", dy: -12, fontSize: 10 }),
        Plot.text(pontos, {
          x: "cmi", y: "mei", dy: 16, fontSize: 9, fill: "var(--ink-secondary)",
          text: (d) => `n = ${num(d.n_unidades)}`,
        }),
      ],
    });
  }, [pontos.map((p) => `${p.edicao}:${p.cmi}:${p.mei}`).join("|")]);

  return (
    <figure className="serie-grafico">
      <figcaption>Plano MEI×CMI, com trajetória entre censos</figcaption>
      <div ref={containerRef} />
      <p className="muted-pequeno">
        A intensidade (CMI) cresce com o número de unidades; parte do deslocamento para a
        direita entre {rotuloIntervalo(edicoes)} é malha mais fina, não comportamento — ver
        figura de Courgeau.
      </p>
    </figure>
  );
}

/** (b) Dispersão de Fielding -- ver desvio documentado no cabeçalho do arquivo: sem nuvem de
 *  pontos por unidade (dado não publicado ao front), só β±erro-padrão e leitura em palavras. */
function DispersaoFielding({ linhas, edicoes }: { linhas: LinhaSistema[]; edicoes: readonly EdicaoSerie[] }) {
  const leitura = (beta: number | null, ep: number | null): string => {
    if (beta == null || ep == null) return "sem dado";
    if (Math.abs(beta) < 2 * ep) return "equilíbrio";
    return beta > 0 ? "concentração" : "desconcentração";
  };
  return (
    <figure className="serie-grafico serie-fielding">
      <figcaption>Dispersão de Fielding (β), por edição</figcaption>
      <div className="serie-fielding-paineis">
        {linhas.map((l) => (
          <div key={l.edicao} className="serie-fielding-painel">
            <div className="muted-pequeno">{rotuloEdicao(l.edicao)}</div>
            <div className="serie-fielding-beta">
              {l.beta_fielding != null ? `β = ${num2(l.beta_fielding)} ± ${num2(l.ep_beta)}` : "sem dado"}
            </div>
            <div className="muted-pequeno">{leitura(l.beta_fielding, l.ep_beta)}</div>
          </div>
        ))}
      </div>
      <p className="muted-pequeno">
        Reta ajustada por MQO ponderado por população sobre as unidades existentes em cada
        edição.{edicoes.includes("1980") && " Em 1980 a taxa líquida é proxy."} A nuvem de
        pontos por unidade não está publicada ao front nesta fase (depende de publicar
        população/área por unidade em `data/processed/series` -- decisão de pipeline/
        metodologia fora de escopo aqui).
      </p>
    </figure>
  );
}

/** (c) Figura de Courgeau -- CMI de todos os níveis, na mesma edição, 5 linhas (uma por
 *  edição). 360x240px. */
function FiguraCourgeau({ nivelAtivo, edicoes }: { nivelAtivo: NivelSerie; edicoes: readonly EdicaoSerie[] }) {
  const [porEdicao, setPorEdicao] = useState<Record<EdicaoSerie, { nivel: NivelSerie; n_unidades: number; cmi: number | null }[]>>(
    {} as Record<EdicaoSerie, { nivel: NivelSerie; n_unidades: number; cmi: number | null }[]>,
  );
  useEffect(() => {
    let vivo = true;
    Promise.all(edicoes.map((e) => serieCourgeau(e).then((r) => [e, r] as const))).then((resultados) => {
      if (!vivo) return;
      const obj = Object.fromEntries(resultados) as typeof porEdicao;
      setPorEdicao(obj);
    }).catch(() => {});
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edicoes.join(",")]);

  const dados = useMemo(() => edicoes.flatMap((e) =>
    (porEdicao[e] ?? []).filter((l) => l.cmi != null && l.n_unidades > 0)
      .map((l) => ({ ...l, edicao: e, log_n: Math.log10(l.n_unidades) })),
  ), [porEdicao, edicoes]);

  const { containerRef } = useFigura(() => {
    if (dados.length === 0) return null;
    return Plot.plot({
      width: 360, height: 240, marginRight: 60,
      x: { label: "log10(nº de unidades do nível) →" },
      y: { label: "↑ CMI (%)", domain: [0, Math.max(1, ...dados.map((d) => d.cmi!)) * 1.1] },
      color: { legend: false },
      marks: [
        Plot.line(dados, {
          x: "log_n", y: "cmi", z: "edicao", curve: "linear",
          stroke: (d) => corDaPaleta(AZUL(slotEdicao(d.edicao)), false),
        }),
        Plot.dot(dados, {
          x: "log_n", y: "cmi",
          fill: (d) => corDaPaleta(AZUL(slotEdicao(d.edicao)), false),
          r: (d) => (d.nivel === nivelAtivo ? 4 : 2.5),
        }),
        Plot.text(
          edicoes.map((e) => dados.filter((d) => d.edicao === e).sort((a, b) => b.log_n - a.log_n)[0])
            .filter((d): d is NonNullable<typeof d> => Boolean(d)),
          { x: "log_n", y: "cmi", text: "edicao", dx: 18, fontSize: 9 },
        ),
      ],
    });
  }, [dados.map((d) => `${d.edicao}:${d.nivel}:${d.cmi}`).join("|"), nivelAtivo]);

  return (
    <figure className="serie-grafico">
      <figcaption>Figura de Courgeau — CMI × número de unidades do nível ({ROTULO_NIVEL[nivelAtivo]} em destaque)</figcaption>
      <div ref={containerRef} />
      <p className="muted-pequeno">
        Quanto mais unidades tem a malha, maior a intensidade medida. A inclinação de cada
        linha é o tamanho desse efeito na edição.
      </p>
    </figure>
  );
}

interface Props {
  nivel: NivelSerie;
  linhasSistema: Record<string, unknown>[];
  edicoes: readonly EdicaoSerie[];
}

export function GraficosSistema({ nivel, linhasSistema, edicoes }: Props) {
  const linhas = useMemo(() => normalizar(linhasSistema), [linhasSistema]);
  return (
    <div className="serie-graficos-sistema">
      <PlanoMeiCmi linhas={linhas} edicoes={edicoes} />
      <DispersaoFielding linhas={linhas} edicoes={edicoes} />
      <FiguraCourgeau nivelAtivo={nivel} edicoes={edicoes} />
    </div>
  );
}
