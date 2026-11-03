/** `avisos` namespace (English): edition badges and notices. Same shape as `pt/avisos.ts`. */
import type { Dicionario } from "../pt";

export const avisos: Dicionario["avisos"] = {
  proxy: {
    selo: "Proxy badge.",
    resumoPadrao:
      "This edition has no fixed-date question: the published migration is estimated with a calibrated proxy, not measured directly.",
    saibaMais: "Learn more about the calibration",
  },
  unidade: {
    naoEMunicipio: "Not a municipality.",
  },
  ufForaDaEpoca: {
    titulo: "This state did not exist at the time of the census.",
  },
};
