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
import { escolherLadosDosRotulos, type LadoRotulo } from "../lib/rotulos";
import { usarModoEscuro } from "../state/store";
import { Termo } from "./Termo";

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

/** Geometria do plano MEI×CMI. As margens são explícitas (e não as do Plot) para que a posição
 *  em pixels de cada ponto seja conhecida antes de desenhar -- é ela que permite escolher o lado
 *  de cada rótulo sem sobreposição (2010 e 2022 ficam a ~15 px um do outro). */
const PLANO = { largura: 420, altura: 320, topo: 24, direita: 40, base: 40, esquerda: 48, raio: 4 };
/** caixa de um rótulo de ponto: duas linhas ("2010" e "n = 5.565") */
const ROTULO_PONTO = { largura: 50, altura: 24 };

/** Deslocamentos das duas linhas do rótulo (edição; n) por lado do ponto, em pixels -- a caixa
 *  do rótulo encosta no ponto (raio + 2 px de folga) do lado escolhido. */
const DESLOCAMENTO_ROTULO: Record<LadoRotulo, {
  dx: number; dyEdicao: number; dyN: number; ancora: "start" | "middle" | "end";
}> = {
  acima: { dx: 0, dyEdicao: -24, dyN: -12, ancora: "middle" },
  abaixo: { dx: 0, dyEdicao: 12, dyN: 24, ancora: "middle" },
  direita: { dx: PLANO.raio + 2, dyEdicao: -6, dyN: 6, ancora: "start" },
  esquerda: { dx: -(PLANO.raio + 2), dyEdicao: -6, dyN: 6, ancora: "end" },
};

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
    // Rótulos (edição + "n = ...") sem sobreposição: posição de cada ponto em pixels -> lado
    // escolhido por `escolherLadosDosRotulos` -> uma marca de texto por lado (dx/dy do Plot são
    // constantes por marca, não canais).
    const larguraUtil = PLANO.largura - PLANO.esquerda - PLANO.direita;
    const alturaUtil = PLANO.altura - PLANO.topo - PLANO.base;
    const lados = escolherLadosDosRotulos(
      pontos.map((p) => ({
        x: PLANO.esquerda + (p.cmi! / cmiMax) * larguraUtil,
        y: PLANO.topo + (1 - p.mei! / meiMax) * alturaUtil,
      })),
      ROTULO_PONTO.largura, ROTULO_PONTO.altura, PLANO.raio,
      { largura: PLANO.largura, altura: PLANO.altura },
    );
    const rotulos = (Object.keys(DESLOCAMENTO_ROTULO) as LadoRotulo[]).flatMap((lado) => {
      const doLado = pontos.filter((_, i) => lados[i] === lado);
      if (doLado.length === 0) return [];
      const d = DESLOCAMENTO_ROTULO[lado];
      return [
        Plot.text(doLado, { x: "cmi", y: "mei", text: "edicao", dx: d.dx, dy: d.dyEdicao, textAnchor: d.ancora, fontSize: 10 }),
        Plot.text(doLado, {
          x: "cmi", y: "mei", dx: d.dx, dy: d.dyN, textAnchor: d.ancora, fontSize: 9, fill: "var(--ink-secondary)",
          text: (p) => `n = ${num(p.n_unidades)}`,
        }),
      ];
    });
    return Plot.plot({
      width: PLANO.largura, height: PLANO.altura,
      marginTop: PLANO.topo, marginRight: PLANO.direita, marginBottom: PLANO.base, marginLeft: PLANO.esquerda,
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
          x: "cmi", y: "mei", r: PLANO.raio,
          symbol: (d) => (d.edicao === "1980" ? "diamond" : "circle"),
          fill: (d) => (d.edicao === "1980" ? "none" : "var(--ink)"),
          stroke: "var(--ink)",
        }),
        ...rotulos,
      ],
    });
  }, [pontos.map((p) => `${p.edicao}:${p.cmi}:${p.mei}:${p.n_unidades}`).join("|")]);

  // Sentido da trajetória, lido dos DADOS (primeiro e último ponto marcados): o texto antigo
  // dizia "deslocamento para a direita" quando o CMI cai entre os censos (trajetória para a
  // ESQUERDA no eixo x).
  const primeiro = pontos[0];
  const ultimo = pontos[pontos.length - 1];
  const trajetoria = pontos.length >= 2 && primeiro.cmi != null && ultimo.cmi != null
    ? { cai: ultimo.cmi < primeiro.cmi, de: primeiro, para: ultimo }
    : null;

  return (
    <figure className="serie-grafico">
      <figcaption>
        Plano <Termo chave="mei_agregado">MEI</Termo>×<Termo chave="cmi">CMI</Termo>, com trajetória entre censos
      </figcaption>
      <div ref={containerRef} />
      <p className="muted-pequeno">
        {trajetoria && <>
          Entre {rotuloIntervalo(edicoes)} a trajetória vai para a {trajetoria.cai ? "esquerda" : "direita"}:
          o CMI {trajetoria.cai ? "cai" : "sobe"} de {num2(trajetoria.de.cmi)}% ({trajetoria.de.edicao}) para{" "}
          {num2(trajetoria.para.cmi)}% ({trajetoria.para.edicao}).{" "}
        </>}
        A intensidade (CMI) também depende do número de unidades do nível: uma malha mais fina
        eleva o CMI sem que o comportamento mude, então parte da diferença entre edições pode ser
        malha, não comportamento — ver figura de Courgeau.
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
      <figcaption>Dispersão de Fielding (<Termo chave="beta_fielding">β</Termo>), por edição</figcaption>
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
  const escuro = usarModoEscuro();
  const [porEdicao, setPorEdicao] = useState<Record<EdicaoSerie, { nivel: NivelSerie; n_unidades: number; cmi: number | null }[]>>(
    {} as Record<EdicaoSerie, { nivel: NivelSerie; n_unidades: number; cmi: number | null }[]>,
  );
  // a figura ficava em branco durante a carga (e para sempre em caso de erro, engolido por um
  // `.catch(() => {})`): agora o estado aparece em texto
  const [estado, setEstado] = useState<"carregando" | "pronto" | "erro">("carregando");
  useEffect(() => {
    let vivo = true;
    setEstado("carregando");
    Promise.all(edicoes.map((e) => serieCourgeau(e).then((r) => [e, r] as const))).then((resultados) => {
      if (!vivo) return;
      const obj = Object.fromEntries(resultados) as typeof porEdicao;
      setPorEdicao(obj);
      setEstado("pronto");
    }).catch(() => { if (vivo) setEstado("erro"); });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edicoes.join(",")]);

  const dados = useMemo(() => edicoes.flatMap((e) =>
    (porEdicao[e] ?? []).filter((l) => l.cmi != null && l.n_unidades > 0)
      .map((l) => ({ ...l, edicao: e, log_n: Math.log10(l.n_unidades) })),
  ), [porEdicao, edicoes]);

  const { containerRef } = useFigura(() => {
    if (dados.length === 0) return null;
    // cores da paleta DO TEMA (antes: sempre `false` = paleta clara, também no tema escuro)
    const corDaEdicao = (e: EdicaoSerie) => corDaPaleta(AZUL(slotEdicao(e)), escuro);
    const doNivel = dados.filter((d) => d.nivel === nivelAtivo);
    return Plot.plot({
      width: 360, height: 240, marginRight: 60,
      x: { label: "log10(nº de unidades do nível) →" },
      y: { label: "↑ CMI (%)", domain: [0, Math.max(1, ...dados.map((d) => d.cmi!)) * 1.1] },
      color: { legend: false },
      marks: [
        Plot.line(dados, {
          x: "log_n", y: "cmi", z: "edicao", curve: "linear", strokeWidth: 1.5,
          stroke: (d) => corDaEdicao(d.edicao),
        }),
        Plot.dot(dados, {
          x: "log_n", y: "cmi", r: 2.5,
          fill: (d) => corDaEdicao(d.edicao),
        }),
        // destaque do nível ativo: anel de tinta por fora de um ponto maior (o raio 4 x 2,5 de
        // antes quase não se via)
        Plot.dot(doNivel, {
          x: "log_n", y: "cmi", r: 6.5, strokeWidth: 2, stroke: "var(--ink)",
          fill: (d) => corDaEdicao(d.edicao),
        }),
        Plot.text(
          edicoes.map((e) => dados.filter((d) => d.edicao === e).sort((a, b) => b.log_n - a.log_n)[0])
            .filter((d): d is NonNullable<typeof d> => Boolean(d)),
          { x: "log_n", y: "cmi", text: "edicao", dx: 18, fontSize: 9 },
        ),
      ],
    });
  }, [dados.map((d) => `${d.edicao}:${d.nivel}:${d.cmi}`).join("|"), nivelAtivo, escuro]);

  return (
    <figure className="serie-grafico">
      <figcaption>
        Figura de Courgeau — <Termo chave="cmi">CMI</Termo> × número de unidades do nível ({ROTULO_NIVEL[nivelAtivo]} em destaque)
      </figcaption>
      <div ref={containerRef} />
      {estado === "carregando" && <p className="muted-pequeno" role="status">Carregando a figura…</p>}
      {estado === "erro" && <p className="muted-pequeno" role="alert">Não foi possível carregar os dados desta figura.</p>}
      {estado === "pronto" && dados.length === 0 && (
        <p className="muted-pequeno">Sem dados de CMI por nível para as edições marcadas.</p>
      )}
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
