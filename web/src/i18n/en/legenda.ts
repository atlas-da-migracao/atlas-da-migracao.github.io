/** `legenda` namespace (English): map legend (src/components/Legenda.tsx). Same shape as
 *  `pt/legenda.ts`; the diverging color bands are in `comum.faixasLegenda`. */
import type { Dicionario } from "../pt";

export const legenda: Dicionario["legenda"] = {
  chip: "Legend",
  minimizar: "Minimize legend",

  titulos: {
    saldo: "Net migration (people)",
    tlm: "Net migration rate (per 1,000)",
    imig: "In-migrants (people)",
    emig: "Out-migrants (people)",
    iem: "Migration effectiveness index (−1 to +1)",
  },

  espigas: {
    aria: "Spike length grows with the square root of the value; reference samples",
    ganho: "gain",
    perda: "loss",
    imigrantes: "in-migrants",
    emigrantes: "out-migrants",
    valores: (lista: string) => `${lista} people`,
    semAncora: "length grows with the square root of the value",
  },

  fluxos: {
    descricao: "Flows: the ribbon tapers from origin to destination and ends in an arrow; a circle marks each end",
    espessuraAria: "Ribbon width grows with the square root of the volume; reference samples",
    espessuraSemAncoraAria: "Ribbon width grows with the volume, on a square-root scale",
    espessuraSemAncora: "width grows with volume (square root)",
    espessuraValores: (lista: string) => `${lista} people`,
    corte: (escopo: "pais" | "selecao", limite: string | null, menor: string) => {
      const quando = escopo === "selecao"
        ? `the map draws only the largest inflows and outflows of the selected place${
            limite ? ` (up to ${limite} on each side)` : ""}`
        : `the map draws only the ${limite ? `${limite} ` : ""}largest flows in the country${
            limite ? " (the same number in every edition)" : ""}`;
      return `Cutoff: ${quando}. The smallest flow drawn has **${menor}** people: pairs below this volume exist in the data and in the panel, but do not appear on the map.`;
    },
  },

  notaNivel: (nivel: string) =>
    `Aggregate level: ${nivel}. Migration between municipalities in the same unit is not counted; suppressed pairs are left out of the sum; no standard error is published.`,
};
