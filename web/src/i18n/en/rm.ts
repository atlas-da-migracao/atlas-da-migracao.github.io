/** `rm` namespace (English): metropolitan region panel (`PainelRM.tsx`), RM comparison
 *  (`ComparativoRM.tsx`) and Sankey (`Sankey.tsx`). Same shape as `pt/rm.ts`. */
import type { Dicionario } from "../pt";

export const rm: Dicionario["rm"] = {
  pct: (v: string) => `${v}%`,
  min: (v: string) => `${v} min`,
  semDados: "Not enough data.",

  painel: {
    tituloVazio: "Atlas of internal migration",
    naoExisteNaEdicao: <T>(edicao: T): (string | T)[] => [
      "This metropolitan region does not exist in the selected ", edicao,
      " edition — older editions may cover a smaller territory or have a different administrative division.",
    ],
    voltarBrasil: "Back to Brazil",
    carregando: "Loading the metropolitan region…",
    sairModoRM: "Exit RM mode",
    linhaResumo: (nucleo: string, nMunicipios: number, pop: string) =>
      `Core: ${nucleo} · ${nMunicipios} ${nMunicipios === 1 ? "municipality" : "municipalities"} · ${pop} inhabitants`,
    abasAria: "Metropolitan panel tab",
    abas: {
      mig: "Intra-RM migration",
      trab: "Commuting to work",
      estudo: "Commuting to school",
    },
    incluirCruzam: "Include flows that cross the RM boundary",
    cruzamLimite: "Flows that cross the RM boundary",
    comparativoTitulo: "Comparison of the 20 largest metropolitan regions",
  },

  tabelaFluxos: {
    vazio: "No flow above the disclosure threshold.",
  },

  mig: {
    migrantesIntra: "Intra-RM migrants",
    saldoExterno: "Net migration with the rest of the country",
    entradasSaidas: (entradas: string, saidas: string) => `in ${entradas} · out ${saidas}`,
    matrizTitulo: "Core × periphery matrix",
    destinoNucleo: "To core",
    destinoPeriferia: "To periphery",
    origemNucleo: "From core",
    origemPeriferia: "From periphery",
    saldoPorMunicipio: "Intra-RM net migration by municipality",
    principaisFluxos: "Top intra-RM flows",
    cliquePerfil: "Click a row to see the full profile of migrants in this pair.",
  },

  migTrab: {
    titulo: "Migrants and work",
    ocupados: "Employed migrants",
    fazemPendular: "Commute",
    voltamOrigem: "Went back to working in the origin",
    trabalhamNucleo: "Work in the core",
    trabalhamOndeMoram: "Work where they live",
    explicacao: (anoOrigem: string, anoDestino: string, top: number, residual: string) =>
      `Lived in (${anoOrigem}) → lives in (${anoDestino}) → works in (${anoDestino}), for the ${top} largest paths in the RM with a known place of work; the rest is grouped under “${residual}”.`,
    verTabela: "View as a table",
    colOrigem: (ano: string) => `Origin (${ano})`,
    colResidencia: (ano: string) => `Residence (${ano})`,
    colTrabalho: (ano: string) => `Work (${ano})`,
    colClasse: "Class",
    colTotal: "Total",
    colFaixaN: "n band",
    carregandoDiagrama: "Loading the diagram…",
    caminhosInsuficientes: "Not enough paths for the diagram in this RM.",
  },

  trab: {
    ocupados: "Employed",
    pendulares: "Commuters",
    pctDosOcupados: (v: string) => `${v}% of the employed`,
    tempoMediano: "Median time",
    retornoDiario: "Daily return",
    transporteColetivo: "Public transport",
    maiorTaxaSaida: "Highest out-commuting rate",
    maiorIndiceAtracao: "Highest attraction index",
    principaisFluxos: "Top commuting flows",
    cliqueCaracterizacao: "Click a row to see the characteristics of the flow.",
  },

  estudo: {
    estudantesPendulares: "Student commuters in the RM",
    entradasPorEstudo: "Inflows for study",
    piso: "Lower bound, not an estimate of the total: this edition has a single work-or-study question, with work taking precedence, so this flow covers only students who are not employed.",
    principaisFluxos: "Top commuting flows to school",
    migEstudamOutro: "Intra-RM migrants who study in another municipality",
    ondeEstudam: "Where they study",
    migrantesQueEstudam: "Migrants who study",
  },

  comparativo: {
    colunas: {
      pop: "Population",
      mig_intra: "Intra-RM migration",
      saldo_externo: "External net",
      pct_pendular: "% commuting",
      tempo_mediano: "Median time",
      pct_coletivo: "% public transport",
    },
    ver: (nome: string) => `View ${nome}`,
    nMunicipios: (n: number) => `${n} mun.`,
  },

  sankey: {
    ariaDiagrama: (anoOrigem: string, anoDestino: string) =>
      `Flow diagram: where migrants lived in ${anoOrigem}, and where they came to live and work in ${anoDestino}`,
    caminhosInsuficientes: "Not enough paths for the diagram.",
  },
};
