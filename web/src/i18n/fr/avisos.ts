import type { Dicionario } from "../pt";

export const avisos: Dicionario["avisos"] = {
  proxy: {
    selo: "Mention « proxy ».",
    resumoPadrao:
      "Cette édition ne comporte pas de question sur la résidence à une date fixe : la migration publiée est estimée par un proxy calibré, et non mesurée directement.",
    saibaMais: "En savoir plus sur le calibrage",
  },
  unidade: {
    naoEMunicipio: "Ce n'est pas une municipalité.",
  },
  ufForaDaEpoca: {
    titulo: "Cet État n'existait pas à l'époque du recensement.",
  },
};
