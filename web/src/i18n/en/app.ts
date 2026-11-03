/** `app` namespace (English): header, toolbar, map, footer, tab titles, load errors and the
 *  metropolitan-mode legend (src/App.tsx). Same shape as `pt/app.ts`. */
import type { Dicionario } from "../pt";

const BASE = "Atlas of internal migration";

/** first letter in lower case, keeping acronyms ("State (UF)" -> "state (UF)") */
const minuscula = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

export const app: Dicionario["app"] = {
  titulo: "Atlas of internal migration in Brazil",
  pularConteudo: "Skip to content",

  tituloAba: {
    base: BASE,
    censos: "Across the censuses — Atlas of internal migration in Brazil",
    comNome: (nome: string) => `${nome} — ${BASE}`,
    fluxo: (origem: string, destino: string) => `${origem} → ${destino} — ${BASE}`,
  },

  cabecalho: {
    subtituloCensos: "Across the censuses, 1980–2022",
    edicaoCenso: "Census edition",
    metodologia: "Methodology",
    comoUsar: "How to use",
    mudarParaClaro: "Switch to light theme",
    mudarParaEscuro: "Switch to dark theme",
  },

  barra: {
    modoENivel: "Map mode and level",
    modoAtlas: "Atlas mode",
    brasil: "Brazil",
    regioesMetropolitanas: "Metropolitan regions",
    aoLongoDosCensos: "Across the censuses",
    nivelAgregacao: "Aggregation level",
    filtros: (ativo: boolean) => `Filters${ativo ? " •" : ""}`,
    filtrosDoMapa: "Map filters",
    fechar: "Close",
    metricaDoMapa: "Map metric",
  },

  placeholderBusca: {
    mun: "Search for a municipality…",
    rgi: "Search for an immediate region…",
    rgint: "Search for an intermediate region…",
    uf: "Search for a state…",
  },

  metricas: {
    saldo: "Net migration",
    tlm: "Net rate",
    imig: "In-migrants",
    emig: "Out-migrants",
    iem: "Effectiveness",
  },

  avisoNivelRecorte: "The breakdown by characteristic exists only at the municipality level; it was cleared when the level changed.",

  verFluxo: "Zoom to the flow",
  verBrasil: "Zoom to Brazil",

  descricaoMapa: {
    rm: "Map of the selected metropolitan region, highlighting the core and the periphery.",
    nacional: (nivel: string, metrica: string) =>
      `Choropleth map of Brazil by ${minuscula(nivel)}, colored by the metric “${metrica}”, with arcs showing the main migration flows.`,
  },

  legendaRM: {
    migTitulo: "Migration within the metropolitan region",
    migNota: "Color shows where the two ends lie in the RM (core or periphery); direction is read from the shape.",
    pendularTitulo: (trabalho: boolean) => `Commuting to ${trabalho ? "work" : "school"}`,
    pendularCategoria: (trabalho: boolean) => `Residence → ${trabalho ? "work" : "school"}`,
    pendularNota: (cruzar: boolean) => cruzar
      ? "Single color: every flow goes from residence to destination. Faded flows cross the RM boundary."
      : "Single color: every flow goes from residence to destination.",
  },

  semDado: "no data",
  semDadoRecorte: "no data published for this breakdown",

  mapa: {
    fluxos: (ligado: boolean) => (ligado ? "Flows: on" : "Flows: off"),
    satelite: (ligado: boolean) => (ligado ? "Satellite: on" : "Satellite: off"),
    tamanhoMinimoFluxo: "Minimum flow size",
    corteAria: (corte: string, visiveis: string, total: string) =>
      `at least ${corte} people, ${visiveis} of ${total} flows`,
    corteVisivel: (corte: string, visiveis: string, total: string) =>
      `at least **${corte}** people · ${visiveis} of ${total} flows`,
    atribuicaoSatelite: "Satellite imagery: NASA Visible Earth, Blue Marble.",
  },

  erros: {
    malha: (detalhe: string) => `Failed to load the boundary map: ${detalhe}`,
    malhaNivel: (nivel: string, detalhe: string) => `Failed to load the boundary map (${nivel}): ${detalhe}`,
    unidades: (nivel: string, detalhe: string) => `Failed to query the units (${nivel}): ${detalhe}`,
    meta: (detalhe: string) => `Failed to load the metadata: ${detalhe}`,
    municipios: (detalhe: string) => `Failed to query the data: ${detalhe}`,
    rm: (detalhe: string) => `Failed to load the RM: ${detalhe}`,
    fluxosRM: (detalhe: string) => `Failed to query the RM flows: ${detalhe}`,
    fluxosNivel: (nivel: string, detalhe: string) => `Failed to query flows (${nivel}): ${detalhe}`,
    maioresFluxos: (detalhe: string) => `Failed to query the largest flows: ${detalhe}`,
    fluxos: (detalhe: string) => `Failed to query flows: ${detalhe}`,
    recorte: (detalhe: string) => `Failed to apply the breakdown: ${detalhe}`,
    tentarDeNovo: "try again",
  },

  rodape: {
    dadosDe: (versao: string) => `Data release ${versao}.`,
    dadosCensos: "Data from the 1980–2022 Demographic Censuses.",
    metodologia: "Methodology",
    comoCitar: "How to cite:",
    orcid: "ORCID",
    citacaoAtlas: (censo: string) =>
      `Atlas da migração interna no Brasil [Atlas of internal migration in Brazil]. Data from the ${censo} Demographic Census (IBGE).`,
    doi: "DOI:",
  },
};
