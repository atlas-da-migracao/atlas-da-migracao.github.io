import type { Dicionario } from "../pt";

export const controles: Dicionario["controles"] = {
  busca: {
    placeholderMun: "Buscar municipio…",
  },

  filtro: {
    rotulo: "Filtro:",
    todos: "Todos los migrantes",
    limparAria: "Quitar filtro",
    limpar: "quitar",
  },

  seletorRM: {
    aria: "Elegir región metropolitana",
    escolha: "Elija una RM…",
    grupoRIDE: "RIDE",
    grupoRM: "Regiones metropolitanas",
    municipios: (n: number) => `${n} mun.`,
  },

  estadoDados: {
    preparando: (mensagem: string) => `Preparando los datos… ${mensagem}`,
    etapas: {
      baixando: "descargando el motor…",
      baixandoMotor: "descargando el motor de consultas…",
      iniciando: "iniciando la base de datos…",
      registrando: (i: string, n: string) => `registrando tablas ${i}/${n}`,
    },
    falha: (erro: string | null) => (erro ? `No fue posible preparar los datos: ${erro}` : "No fue posible preparar los datos."),
    tentarDeNovo: "intentar de nuevo",
  },
};
