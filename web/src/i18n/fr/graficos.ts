import type { Dicionario } from "../pt";

/** valeur absolue d'un nombre déjà formaté en fr-FR ("1 234,5", "−3"); Infinity si illisible */
const valeur = (v: string) => {
  const x = Number(v.replace(/[\s  ]/g, "").replace("−", "-").replace(",", "."));
  return Number.isNaN(x) ? Infinity : Math.abs(x);
};
const singulier = (v: string) => valeur(v) < 2;
const personnes = (v: string) => (singulier(v) ? "personne" : "personnes");

export const graficos: Dicionario["graficos"] = {
  acordes: {
    semDados: "Données insuffisantes pour la matrice de cordes.",
    ariaDiagrama: "Diagramme de cordes des flux migratoires entre les 27 unités fédératives ; les mêmes données figurent dans le tableau sous le diagramme.",
    ariaCorda: (a: string, b: string, deAParaB: string, deBParaA: string) =>
      `${a} → ${b} : ${deAParaB} ${personnes(deAParaB)} ; ${b} → ${a} : ${deBParaA} ${personnes(deBParaA)}`,
    ariaArco: (sigla: string, selecionada: boolean) =>
      `${sigla} : ${selecionada ? "désélectionner" : "sélectionner"} sur la carte`,
    tituloArco: (sigla: string, emigrantes: string, imigrantes: string) =>
      `${sigla} : ${emigrantes} ${singulier(emigrantes) ? "personne est partie" : "personnes sont parties"} vers d'autres États ; `
      + `${imigrantes} ${singulier(imigrantes) ? "est arrivée" : "sont arrivées"} d'autres États`,
    nota: "La largeur de l'arc de chaque État est proportionnelle au total des personnes qui l'ont quitté pour d'autres États ; à chaque extrémité d'une corde, la largeur correspond au flux qui part de cet État vers l'autre.",
    tabelaResumo: (limite: string | null) =>
      `Voir le tableau des ${limite == null ? "" : `${limite} plus grands `}flux entre États`,
    colOrigem: "Origine",
    colDestino: "Destination",
    colTotal: "Total",
    rodapeParcial: (limite: string, total: string, pct: string, restantes: string) =>
      `Affichage des ${limite} plus grands des ${total} couples publiés (${pct} % du total des migrants entre États) ; les ${restantes} autres ne sont pas listés, mais figurent dans le diagramme.`,
    rodapeCompleto: (total: string) => `L'ensemble des ${total} couples publiés.`,
  },

  plano: {
    titulo: <T>(mei: T, cmi: T): (string | T)[] => ["Plan ", mei, "×", cmi, ", avec trajectoire entre recensements"],
    eixoX: "CMI (%) →",
    eixoY: "↑ MEI agrégé (%)",
    marcaN: (n: string) => `n = ${n}`,
    marcaAnmr: (k: string) => `ANMR ${k}`,
    trajetoria: (intervalo: string, cai: boolean, de: string, edDe: string, para: string, edPara: string) =>
      `Sur la période ${intervalo}, la trajectoire va vers la ${cai ? "gauche" : "droite"} : la CMI ${cai ? "baisse" : "augmente"} de ${de} % (${edDe}) à ${para} % (${edPara}).`,
    nota: "L'intensité (CMI) dépend aussi du nombre d'unités du niveau : un maillage plus fin élève la CMI sans que le comportement change, si bien qu'une partie de l'écart entre éditions peut tenir au maillage, et non au comportement — voir la figure de Courgeau.",
  },

  fielding: {
    titulo: <T>(beta: T): (string | T)[] => ["Dispersion de Fielding (", beta, "), par édition"],
    semDado: "pas de donnée",
    leitura: {
      equilibrio: "équilibre",
      concentracao: "concentration",
      desconcentracao: "déconcentration",
    },
    beta: (beta: string, ep: string) => `β = ${beta} ± ${ep}`,
    nota: (proxy1980: boolean) =>
      "Droite ajustée par MCO pondérés par la population sur les unités existant dans chaque édition." +
      (proxy1980 ? " En 1980, le taux net est un proxy." : ""),
  },

  courgeau: {
    titulo: <T>(cmi: T, nivelPlural: string): (string | T)[] => [
      "Figure de Courgeau — ", cmi, ` × nombre d'unités du niveau (${nivelPlural} en évidence)`,
    ],
    eixoX: "log10(nombre d'unités du niveau) →",
    eixoY: "↑ CMI (%)",
    carregando: "Chargement de la figure…",
    erro: "Impossible de charger les données de cette figure.",
    semDados: "Pas de données de CMI par niveau pour les éditions cochées.",
    nota: "Plus le maillage compte d'unités, plus l'intensité mesurée est élevée. La pente de chaque ligne correspond à l'ampleur de cet effet dans l'édition.",
  },
};
