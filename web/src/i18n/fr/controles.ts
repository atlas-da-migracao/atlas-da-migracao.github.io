import type { Dicionario } from "../pt";

export const controles: Dicionario["controles"] = {
  busca: {
    placeholderMun: "Rechercher une municipalité…",
  },

  filtro: {
    rotulo: "Ventilation :",
    todos: "Tous les migrants",
    limparAria: "Effacer la ventilation",
    limpar: "effacer",
  },

  seletorRM: {
    aria: "Choisir une région métropolitaine",
    escolha: "Choisissez une RM…",
    grupoRIDE: "RIDE",
    grupoRM: "Régions métropolitaines",
    municipios: (n: number) => `${n} mun.`,
  },

  estadoDados: {
    preparando: (mensagem: string) => `Préparation des données… ${mensagem}`,
    etapas: {
      baixando: "téléchargement du moteur…",
      baixandoMotor: "téléchargement du moteur de requêtes…",
      iniciando: "démarrage de la base…",
      registrando: (i: string, n: string) => `enregistrement des tables ${i}/${n}`,
    },
    falha: (erro: string | null) => (erro ? `Impossible de préparer les données : ${erro}` : "Impossible de préparer les données."),
    tentarDeNovo: "réessayer",
  },
};
