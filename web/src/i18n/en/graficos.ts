/** `graficos` namespace (English): chord diagram between states (`DiagramaAcordes.tsx`) and the
 *  three Part 2 charts of the series (`GraficosSistema.tsx`). Same shape as `pt/graficos.ts`. */
import type { Dicionario } from "../pt";

export const graficos: Dicionario["graficos"] = {
  acordes: {
    semDados: "Not enough data for the chord matrix.",
    ariaDiagrama: "Chord diagram of migration flows among the 27 Federation Units; the same data are in the table below the diagram.",
    ariaCorda: (a: string, b: string, deAParaB: string, deBParaA: string) =>
      `${a} → ${b}: ${deAParaB} people; ${b} → ${a}: ${deBParaA} people`,
    ariaArco: (sigla: string, selecionada: boolean) =>
      `${sigla}: ${selecionada ? "deselect" : "select"} on the map`,
    tituloArco: (sigla: string, emigrantes: string, imigrantes: string) =>
      `${sigla}: ${emigrantes} people left for other states; ${imigrantes} arrived from other states`,
    nota: "The width of each state's arc is proportional to the total number of people who left it for other states; at each end of a chord, the width is the flow leaving that state for the other one.",
    tabelaResumo: (limite: string | null) =>
      limite == null
        ? "View the table of flows between states"
        : `View the table of the ${limite} largest flows between states`,
    colOrigem: "Origin",
    colDestino: "Destination",
    colTotal: "Total",
    rodapeParcial: (limite: string, total: string, pct: string, restantes: string) =>
      `Showing the ${limite} largest of ${total} published pairs (${pct}% of all interstate migrants); the other ${restantes} are not listed, but they are in the diagram.`,
    rodapeCompleto: (total: string) => `All ${total} published pairs.`,
  },

  plano: {
    titulo: <T>(mei: T, cmi: T): (string | T)[] => ["Aggregate ", mei, "×", cmi, " plane, with the trajectory across censuses"],
    eixoX: "CMI (%) →",
    eixoY: "↑ Aggregate MEI (%)",
    marcaN: (n: string) => `n = ${n}`,
    marcaAnmr: (k: string) => `ANMR ${k}`,
    trajetoria: (intervalo: string, cai: boolean, de: string, edDe: string, para: string, edPara: string) =>
      `Over ${intervalo}, the trajectory moves to the ${cai ? "left" : "right"}: the CMI ${cai ? "falls" : "rises"} from ${de}% (${edDe}) to ${para}% (${edPara}).`,
    nota: "Intensity (CMI) also depends on the number of units in the level: a finer subdivision raises the CMI without any change in behavior, so part of the difference between editions may come from the boundaries, not from behavior — see the Courgeau figure.",
  },

  fielding: {
    titulo: <T>(beta: T): (string | T)[] => ["Fielding dispersion (", beta, "), by edition"],
    semDado: "no data",
    leitura: {
      equilibrio: "balance",
      concentracao: "concentration",
      desconcentracao: "deconcentration",
    },
    beta: (beta: string, ep: string) => `β = ${beta} ± ${ep}`,
    nota: (proxy1980: boolean) =>
      "Line fitted by population-weighted OLS on the units that exist in each edition." +
      (proxy1980 ? " In 1980 the net rate is a proxy." : ""),
  },

  courgeau: {
    titulo: <T>(cmi: T, nivelPlural: string): (string | T)[] => [
      "Courgeau figure — ", cmi, ` × number of units in the level (${nivelPlural} highlighted)`,
    ],
    eixoX: "log10(number of units in the level) →",
    eixoY: "↑ CMI (%)",
    carregando: "Loading the figure…",
    erro: "Could not load the data for this figure.",
    semDados: "No CMI data by level for the selected editions.",
    nota: "The more units the boundary set has, the higher the measured intensity. The slope of each line is the size of this effect in that edition.",
  },
};
