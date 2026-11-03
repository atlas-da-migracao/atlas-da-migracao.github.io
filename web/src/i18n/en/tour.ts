/** `tour` namespace (English): welcome tour (src/components/Tour.tsx). Same shape as `pt/tour.ts`. */
import type { Dicionario } from "../pt";

export const tour: Dicionario["tour"] = {
  passos: {
    mapa: {
      titulo: "The map",
      texto: "Each municipality is colored by the chosen metric. Click a municipality to see its " +
        "migration flows as arcs; click an arc to see the details of that pair.",
    },
    busca: {
      titulo: "Search",
      texto: "Type the name of a municipality (or, at other levels, of a region or state) to go straight to it.",
    },
    metrica: {
      titulo: "Map metric",
      texto: "Switch between net migration, net rate, in-migrants, out-migrants and migration effectiveness: " +
        "the map colors change accordingly.",
    },
    painel: {
      titulo: "Details panel",
      texto: "When you select a municipality or a flow, this panel shows the indicators, the top " +
        "flows and the profile of migrants.",
    },
    modoRm: {
      titulo: "Metropolitan regions",
      texto: "This mode moves the view inside a metropolitan region: intra-RM migration and, " +
        "depending on the selected census, commuting to work and school.",
    },
    modoCensos: {
      titulo: "Across the censuses",
      texto: "Compare the same territory — municipality, immediate region, intermediate region, state or " +
        "metropolitan region — across two or more censuses (1980 to 2022). Search for the territory, check " +
        "the censuses you want to compare, and see flows, net figures, measures and the profile of migrants " +
        "side by side, with a comparative map and charts of the change over time.",
    },
  },
  contagem: (passo: number, total: number) => `Step ${passo} of ${total}`,
  pular: "Skip",
  voltar: "Back",
  proximo: "Next",
  concluir: "Done",
};
