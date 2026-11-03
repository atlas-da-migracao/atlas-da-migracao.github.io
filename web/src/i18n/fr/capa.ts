import type { Dicionario } from "../pt";

/** valeur absolue d'un nombre déjà formaté en fr-FR ("1 234,5", "−3"); Infinity si illisible */
const valeur = (v: string) => {
  const x = Number(v.replace(/[\s  ]/g, "").replace("−", "-").replace(",", "."));
  return Number.isNaN(x) ? Infinity : Math.abs(x);
};

export const capa: Dicionario["capa"] = {
  aria: "Panorama national",
  titulo: "Atlas des migrations internes",

  intro: (nMun: string | null, de: string, ate: string, censo: string, proxy: boolean) =>
    `Flux migratoires entre ${nMun ? `les ${nMun}` : "les"} municipalités brésiliennes au cours de la période quinquennale ${de}–${ate}, ${
      proxy
        ? `à partir d'un proxy de date fixe du Recensement démographique ${censo} (voir l'avertissement ci-dessous).`
        : `à partir de la question sur la résidence à une date fixe du Recensement démographique ${censo}.`}`,

  numeroDestaque: (milhoes: string, de: string, ate: string) =>
    `${milhoes} ${valeur(milhoes) < 2 ? "million" : "millions"} de personnes ont changé de municipalité entre ${de} et ${ate}`,

  apoio: (pares: string, semOrigem: string, exterior: string, pop5: string) =>
    `${pares} couples origine–destination publiés · ${semOrigem} arrivées d'origine non déclarée · ${exterior} arrivées de l'étranger · population de référence (5 ans ou plus) : ${pop5}.`,

  padraoPredominante: "Profil migratoire prédominant dans le pays",
  padraoSufixo: " :",

  maioresFluxos: "Principaux flux du pays",
  recorteRotulo: "Ventilation :",
  recorteExplicacao: "— volume de ce seul sous-groupe de migrants.",

  achados: {
    titulo: "Trois résultats de la recherche",
    nucleo: (pctNucleo: string, pctDF: string) =>
      `Parmi les personnes parties du centre métropolitain vers la périphérie, **${pctNucleo} %** continuent de travailler dans le centre — dans la RIDE-DF, ce taux atteint **${pctDF} %**.`,
    verRideDF: "Voir la RIDE-DF",
    superior: (pct: string) =>
      `Parmi les migrants de 25 ans ou plus allant de Rio de Janeiro à São Paulo, **${pct} %** ont achevé des études supérieures — une sélectivité scolaire marquée.`,
    verFluxoRioSP: "Voir le flux Rio → São Paulo",
    pendular: (pessoas: string) =>
      `Guarulhos → São Paulo est le plus important couple de navettes domicile-travail du pays : **${pessoas} personnes** habitent à Guarulhos et travaillent à São Paulo.`,
    verParPendular: "Voir le couple pendulaire",
  },

  instrucao:
    "Cliquez sur une municipalité de la carte pour voir son solde, ses principaux flux d'entrée et de sortie, et le profil des migrants. Cliquez sur un arc pour détailler un flux.",
};
