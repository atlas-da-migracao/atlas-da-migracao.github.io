import type { Dicionario } from "../pt";

/** valeur absolue d'un nombre déjà formaté en fr-FR ("1 234,5", "−3"); Infinity si illisible */
const valeur = (v: string) => {
  const x = Number(v.replace(/[\s  ]/g, "").replace("−", "-").replace(",", "."));
  return Number.isNaN(x) ? Infinity : Math.abs(x);
};
/** en français, 0 et 1 (et tout |x| < 2) prennent le singulier */
const personnes = (v: string) => (valeur(v) < 2 ? "personne" : "personnes");

export const legenda: Dicionario["legenda"] = {
  chip: "Légende",
  minimizar: "Réduire la légende",

  titulos: {
    saldo: "Solde migratoire (personnes)",
    tlm: "Taux net de migration (pour mille)",
    imig: "Entrants (personnes)",
    emig: "Sortants (personnes)",
    iem: "Indice d'efficacité migratoire (−1 à +1)",
  },

  espigas: {
    aria: "La longueur du pic croît avec la racine carrée de la valeur ; valeurs de référence",
    ganho: "gain",
    perda: "perte",
    imigrantes: "entrants",
    emigrantes: "sortants",
    valores: (lista: string) => `${lista} personnes`,
    semAncora: "la longueur croît avec la racine carrée de la valeur",
  },

  fluxos: {
    descricao: "Flux : le ruban s'affine de l'origine à la destination et se termine par une flèche ; un cercle marque chaque extrémité",
    espessuraAria: "L'épaisseur du ruban croît avec la racine carrée du volume ; valeurs de référence",
    espessuraSemAncoraAria: "L'épaisseur du ruban croît avec le volume, en racine carrée",
    espessuraSemAncora: "l'épaisseur croît avec le volume (racine carrée)",
    espessuraValores: (lista: string) => `${lista} personnes`,
    corte: (escopo: "pais" | "selecao", limite: string | null, menor: string) => {
      const quando = escopo === "selecao"
        ? `la carte ne dessine que les plus grands flux d'entrée et de sortie du lieu sélectionné${
            limite ? ` (jusqu'à ${limite} de chaque côté)` : ""}`
        : `la carte ne dessine que les ${limite ? `${limite} ` : ""}plus grands flux du pays${
            limite ? " (le même nombre dans toutes les éditions)" : ""}`;
      return `Seuil d'affichage : ${quando}. Le plus petit flux dessiné compte **${menor}** ${personnes(menor)} : les couples en dessous de ce volume existent dans les données et dans le panneau, mais n'apparaissent pas sur la carte.`;
    },
  },

  notaNivel: (nivel: string) =>
    `Niveau agrégé — ${nivel} : la migration entre municipalités d'une même unité n'est pas comptabilisée ; les couples masqués sont exclus de la somme ; pas d'erreur type publiée.`,
};
