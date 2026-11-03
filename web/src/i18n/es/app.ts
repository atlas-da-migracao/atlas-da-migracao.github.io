import type { Dicionario } from "../pt";

const BASE = "Atlas de la migración interna";

/** minúscula inicial solo cuando el rótulo es una palabra común ("Municipio" -> "municipio");
 *  las siglas ("RM", "UF") y los rótulos con sigla quedan intactos */
const minusculaInicial = (s: string) =>
  /^\p{Lu}\p{Ll}/u.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s;

export const app: Dicionario["app"] = {
  titulo: "Atlas de la migración interna en Brasil",
  pularConteudo: "Saltar al contenido",

  tituloAba: {
    base: BASE,
    censos: "A lo largo de los censos — Atlas de la migración interna en Brasil",
    comNome: (nome: string) => `${nome} — ${BASE}`,
    fluxo: (origem: string, destino: string) => `${origem} → ${destino} — ${BASE}`,
  },

  cabecalho: {
    subtituloCensos: "A lo largo de los censos, 1980–2022",
    edicaoCenso: "Edición del Censo",
    metodologia: "Metodología",
    comoUsar: "Cómo usar",
    mudarParaClaro: "Cambiar a tema claro",
    mudarParaEscuro: "Cambiar a tema oscuro",
  },

  barra: {
    modoENivel: "Modo y nivel del mapa",
    modoAtlas: "Modo del atlas",
    brasil: "Brasil",
    regioesMetropolitanas: "Regiones metropolitanas",
    aoLongoDosCensos: "A lo largo de los censos",
    nivelAgregacao: "Nivel de agregación",
    filtros: (ativo: boolean) => `Filtros${ativo ? " •" : ""}`,
    filtrosDoMapa: "Filtros del mapa",
    fechar: "Cerrar",
    metricaDoMapa: "Métrica del mapa",
  },

  placeholderBusca: {
    mun: "Buscar municipio…",
    rgi: "Buscar región inmediata…",
    rgint: "Buscar región intermedia…",
    uf: "Buscar estado…",
  },

  metricas: {
    saldo: "Saldo",
    tlm: "Tasa neta",
    imig: "Inmigrantes",
    emig: "Emigrantes",
    iem: "Eficacia",
  },

  avisoNivelRecorte: "El filtro por característica solo existe en el nivel municipal; se quitó al cambiar de nivel.",

  verFluxo: "Ver el flujo",
  verBrasil: "Ver Brasil",

  descricaoMapa: {
    rm: "Mapa de la región metropolitana seleccionada, con el núcleo y la periferia destacados.",
    nacional: (nivel: string, metrica: string) =>
      `Mapa coroplético de Brasil por ${minusculaInicial(nivel)}, coloreado según la métrica «${metrica}», con arcos que indican los principales flujos migratorios.`,
  },

  legendaRM: {
    migTitulo: "Migración dentro de la región metropolitana",
    migNota: "El color identifica la posición de los dos extremos en la RM (núcleo o periferia); la dirección se lee por la forma.",
    pendularTitulo: (trabalho: boolean) => `Movilidad pendular por ${trabalho ? "trabajo" : "estudio"}`,
    pendularCategoria: (trabalho: boolean) => `Residencia → ${trabalho ? "trabajo" : "estudio"}`,
    pendularNota: (cruzar: boolean) => cruzar
      ? "Color único: todo flujo va de la residencia al destino. Los flujos atenuados cruzan el límite de la RM."
      : "Color único: todo flujo va de la residencia al destino.",
  },

  semDado: "sin dato",
  semDadoRecorte: "sin dato publicado para el filtro",

  mapa: {
    fluxos: (ligado: boolean) => (ligado ? "Flujos: activados" : "Flujos: desactivados"),
    satelite: (ligado: boolean) => (ligado ? "Satélite: activado" : "Satélite: desactivado"),
    tamanhoMinimoFluxo: "Tamaño mínimo del flujo",
    corteAria: (corte: string, visiveis: string, total: string) =>
      `desde ${corte} personas, ${visiveis} de ${total} flujos`,
    corteVisivel: (corte: string, visiveis: string, total: string) =>
      `desde **${corte}** personas · ${visiveis} de ${total} flujos`,
    atribuicaoSatelite: "Imagen satelital: NASA Visible Earth, Blue Marble.",
  },

  erros: {
    malha: (detalhe: string) => `Error al cargar la malla: ${detalhe}`,
    malhaNivel: (nivel: string, detalhe: string) => `Error al cargar la malla (${nivel}): ${detalhe}`,
    unidades: (nivel: string, detalhe: string) => `Error al consultar las unidades (${nivel}): ${detalhe}`,
    meta: (detalhe: string) => `Error al cargar los metadatos: ${detalhe}`,
    municipios: (detalhe: string) => `Error al consultar los datos: ${detalhe}`,
    rm: (detalhe: string) => `Error al cargar la RM: ${detalhe}`,
    fluxosRM: (detalhe: string) => `Error al consultar los flujos de la RM: ${detalhe}`,
    fluxosNivel: (nivel: string, detalhe: string) => `Error al consultar los flujos (${nivel}): ${detalhe}`,
    maioresFluxos: (detalhe: string) => `Error al consultar los mayores flujos: ${detalhe}`,
    fluxos: (detalhe: string) => `Error al consultar los flujos: ${detalhe}`,
    recorte: (detalhe: string) => `Error al aplicar el filtro: ${detalhe}`,
    tentarDeNovo: "intentar de nuevo",
  },

  rodape: {
    dadosDe: (versao: string) => `Datos de ${versao}.`,
    dadosCensos: "Datos de los Censos Demográficos 1980–2022.",
    metodologia: "Metodología",
    comoCitar: "Cómo citar:",
    orcid: "ORCID",
    citacaoAtlas: (censo: string) =>
      `Atlas da migração interna no Brasil [Atlas de la migración interna en Brasil]. Datos del Censo Demográfico ${censo} (IBGE).`,
    doi: "DOI:",
  },
};
