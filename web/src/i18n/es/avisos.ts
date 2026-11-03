import type { Dicionario } from "../pt";

export const avisos: Dicionario["avisos"] = {
  proxy: {
    selo: "Distintivo «proxy».",
    resumoPadrao:
      "Esta edición no tiene pregunta de fecha fija: la migración publicada se estima mediante un proxy calibrado, no se mide directamente.",
    saibaMais: "Más información sobre la calibración",
  },
  unidade: {
    naoEMunicipio: "No es un municipio.",
  },
  ufForaDaEpoca: {
    titulo: "Este estado no existía en la época del censo.",
  },
};
