/** `controles` namespace (English): search, breakdown, RM selector and data-loading indicator.
 *  Same shape as `pt/controles.ts`. */
import type { Dicionario } from "../pt";

export const controles: Dicionario["controles"] = {
  busca: {
    placeholderMun: "Search for a municipality…",
  },

  filtro: {
    rotulo: "Breakdown:",
    todos: "All migrants",
    limparAria: "Clear breakdown",
    limpar: "clear",
  },

  seletorRM: {
    aria: "Choose a metropolitan region",
    escolha: "Choose an RM…",
    grupoRIDE: "RIDEs",
    grupoRM: "Metropolitan regions",
    municipios: (n: number) => `${n} mun.`,
  },

  estadoDados: {
    preparando: (mensagem: string) => `Preparing the data… ${mensagem}`,
    etapas: {
      baixando: "downloading the engine…",
      baixandoMotor: "downloading the query engine…",
      iniciando: "starting the database…",
      registrando: (i: string, n: string) => `registering tables ${i}/${n}`,
    },
    falha: (erro: string | null) => (erro ? `Could not prepare the data: ${erro}` : "Could not prepare the data."),
    tentarDeNovo: "try again",
  },
};
