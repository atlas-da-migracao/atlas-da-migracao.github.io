/** Textos do namespace `controles` (fonte: português): busca, recorte, seletor de RM e o
 *  indicador de carga dos dados. Os dicionários en/fr/es têm o mesmo formato. */
export const controles = {
  busca: {
    placeholderMun: "Buscar município…",
  },

  filtro: {
    rotulo: "Recorte:",
    todos: "Todos os migrantes",
    limparAria: "Limpar recorte",
    limpar: "limpar",
  },

  seletorRM: {
    aria: "Escolher região metropolitana",
    escolha: "Escolha uma RM…",
    grupoRIDE: "RIDEs",
    grupoRM: "Regiões metropolitanas",
    /** abreviação de "municípios" na opção: "Belo Horizonte (Belo Horizonte/MG · 34 mun.)" */
    municipios: (n: number) => `${n} mun.`,
  },

  estadoDados: {
    preparando: (mensagem: string) => `Preparando os dados… ${mensagem}`,
    /** etapas informadas por db/duckdb.ts (a mensagem original chega em português) */
    etapas: {
      baixando: "baixando o motor…",
      baixandoMotor: "baixando o motor de consulta…",
      iniciando: "iniciando o banco…",
      registrando: (i: string, n: string) => `registrando tabelas ${i}/${n}`,
    },
    falha: (erro: string | null) => (erro ? `Não foi possível preparar os dados: ${erro}` : "Não foi possível preparar os dados."),
    tentarDeNovo: "tentar de novo",
  },
};
