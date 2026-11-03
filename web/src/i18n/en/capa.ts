/** `capa` namespace (English): national overview, the panel with no selection
 *  (src/components/CapaNacional.tsx). Text between ** is bold (components/TextoRico.tsx).
 *  Same shape as `pt/capa.ts`. */
import type { Dicionario } from "../pt";

export const capa: Dicionario["capa"] = {
  aria: "National overview",
  titulo: "Atlas of internal migration",

  intro: (nMun: string | null, de: string, ate: string, censo: string, proxy: boolean) =>
    `Migration flows between ${nMun ? `the ${nMun} ` : ""}Brazilian municipalities in the five-year period ${de}–${ate}, ${
      proxy
        ? `based on a fixed-date proxy from the ${censo} Demographic Census (see notice below).`
        : `based on the fixed-date question of the ${censo} Demographic Census.`}`,

  numeroDestaque: (milhoes: string, de: string, ate: string) =>
    `${milhoes} million people moved to another municipality between ${de} and ${ate}`,

  apoio: (pares: string, semOrigem: string, exterior: string, pop5: string) =>
    `${pares} published origin–destination pairs · ${semOrigem} arrivals with origin not reported · ${exterior} arrivals from abroad · reference population (aged 5 and over): ${pop5}.`,

  padraoPredominante: "Predominant migration pattern in the country",
  padraoSufixo: ":",

  maioresFluxos: "Largest flows in the country",
  recorteRotulo: "Breakdown:",
  recorteExplicacao: "— volume for this subgroup of migrants only.",

  achados: {
    titulo: "Three research findings",
    nucleo: (pctNucleo: string, pctDF: string) =>
      `Among those who moved from the metropolitan core to the periphery, **${pctNucleo}%** still work in the core — in the RIDE-DF, this share reaches **${pctDF}%**.`,
    verRideDF: "View the RIDE-DF",
    superior: (pct: string) =>
      `Among migrants aged 25 and over who moved from Rio de Janeiro to São Paulo, **${pct}%** have completed higher education — a marked educational selectivity.`,
    verFluxoRioSP: "View the Rio → São Paulo flow",
    pendular: (pessoas: string) =>
      `Guarulhos → São Paulo is the country's largest commuting pair for work: **${pessoas} people** live in Guarulhos and work in São Paulo.`,
    verParPendular: "View the commuting pair",
  },

  instrucao:
    "Click a municipality on the map to see its net migration, top inflows and outflows, and the profile of migrants. Click an arc to see the details of a flow.",
};
