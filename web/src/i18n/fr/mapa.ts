import type { Dicionario } from "../pt";

/** en français, 0 et 1 (et tout |n| < 2) prennent le singulier */
const pl = (n: number, un: string, plusieurs: string) => (Math.abs(n) < 2 ? un : plusieurs);

export const mapa: Dicionario["mapa"] = {
  reenquadrarPadrao: "Voir le Brésil",
  ariaPadrao: "Carte choroplèthe du Brésil avec des arcs de flux migratoires",
  paragrafoLeitor: (descricao: string) =>
    `${descricao} Les mêmes données figurent, sous forme de tableau, dans le panneau latéral `
    + "(indicateurs et principaux flux d'origine et de destination). Utilisez la recherche de l'en-tête "
    + "pour sélectionner une municipalité ou une unité au clavier.",

  semDados: "pas de données",
  metricaTlm: (valor: string) => `${valor} pour mille habitants`,
  metricaSaldo: (valor: string, n: number) => `solde ${valor} ${pl(n, "personne", "personnes")}`,
  metricaImig: (valor: string, n: number) => `${valor} ${pl(n, "entrant", "entrants")}`,
  metricaEmig: (valor: string, n: number) => `${valor} ${pl(n, "sortant", "sortants")}`,
  metricaIem: (valor: string) => `efficacité ${valor}`,
  precisaoImigracao: (rotulo: string) => `précision des entrées : ${rotulo}`,
  fluxoClique: (valor: string, n: number) =>
    `${valor} ${pl(n, "personne", "personnes")} · cliquez pour voir le profil`,
  precisaoFluxo: (rotulo: string) => `précision : ${rotulo}`,
};
