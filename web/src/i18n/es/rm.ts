import type { Dicionario } from "../pt";

const NB = " ";

export const rm: Dicionario["rm"] = {
  pct: (v: string) => `${v}${NB}%`,
  min: (v: string) => `${v} min`,
  semDados: "No hay datos suficientes.",

  painel: {
    tituloVazio: "Atlas de la migración interna",
    naoExisteNaEdicao: <T>(edicao: T): (string | T)[] => [
      "Esta región metropolitana no existe en la edición ", edicao,
      " seleccionada — las ediciones antiguas pueden cubrir un territorio menor o tener una división administrativa diferente.",
    ],
    voltarBrasil: "Volver a Brasil",
    carregando: "Cargando la región metropolitana…",
    sairModoRM: "Salir del modo RM",
    linhaResumo: (nucleo: string, nMunicipios: number, pop: string) =>
      `Núcleo: ${nucleo} · ${nMunicipios} ${nMunicipios === 1 ? "municipio" : "municipios"} · ${pop} habitantes`,
    abasAria: "Pestaña del panel metropolitano",
    abas: {
      mig: "Migración intra-RM",
      trab: "Pendular por trabajo",
      estudo: "Pendular por estudio",
    },
    incluirCruzam: "Incluir los flujos que cruzan el límite de la RM",
    cruzamLimite: "Flujos que cruzan el límite de la RM",
    comparativoTitulo: "Comparación entre las 20 mayores regiones metropolitanas",
  },

  tabelaFluxos: {
    vazio: "Ningún flujo por encima del umbral de divulgación.",
  },

  mig: {
    migrantesIntra: "Migrantes intra-RM",
    saldoExterno: "Saldo con el resto del país",
    entradasSaidas: (entradas: string, saidas: string) => `entradas ${entradas} · salidas ${saidas}`,
    matrizTitulo: "Matriz núcleo × periferia",
    destinoNucleo: "Destino núcleo",
    destinoPeriferia: "Destino periferia",
    origemNucleo: "Origen núcleo",
    origemPeriferia: "Origen periferia",
    saldoPorMunicipio: "Saldo intra-RM por municipio",
    principaisFluxos: "Principales flujos intra-RM",
    cliquePerfil: "Haga clic en una fila para ver el perfil completo de los migrantes de este par.",
  },

  migTrab: {
    titulo: "Migrantes y trabajo",
    ocupados: "Migrantes ocupados",
    fazemPendular: "En movilidad pendular",
    voltamOrigem: "Vuelven a trabajar en el origen",
    trabalhamNucleo: "Trabajan en el núcleo",
    trabalhamOndeMoram: "Trabajan donde viven",
    explicacao: (anoOrigem: string, anoDestino: string, top: number, residual: string) =>
      `Vivía en (${anoOrigem}) → vive en (${anoDestino}) → trabaja en (${anoDestino}), para los ${top} mayores recorridos de la RM con destino de trabajo conocido; el resto aparece agregado en «${residual}».`,
    verTabela: "Ver como tabla",
    colOrigem: (ano: string) => `Origen (${ano})`,
    colResidencia: (ano: string) => `Residencia (${ano})`,
    colTrabalho: (ano: string) => `Trabajo (${ano})`,
    colClasse: "Clase",
    colTotal: "Total",
    colFaixaN: "Rango de n",
    carregandoDiagrama: "Cargando el diagrama…",
    caminhosInsuficientes: "No hay recorridos suficientes para el diagrama en esta RM.",
  },

  trab: {
    ocupados: "Ocupados",
    pendulares: "Pendulares",
    pctDosOcupados: (v: string) => `${v}${NB}% de los ocupados`,
    tempoMediano: "Tiempo mediano",
    retornoDiario: "Retorno diario",
    transporteColetivo: "Transporte público",
    maiorTaxaSaida: "Mayor tasa de salida pendular",
    maiorIndiceAtracao: "Mayor índice de atracción",
    principaisFluxos: "Principales flujos pendulares",
    cliqueCaracterizacao: "Haga clic en una fila para ver la caracterización del flujo.",
  },

  estudo: {
    estudantesPendulares: "Estudiantes pendulares de la RM",
    entradasPorEstudo: "Entradas por estudio",
    piso: "Piso, no estimación del total: esta edición tiene una pregunta única de trabajo o estudio, con precedencia del trabajo, y por eso este flujo cubre solo a los estudiantes no ocupados.",
    principaisFluxos: "Principales flujos pendulares por estudio",
    migEstudamOutro: "Migrantes intra-RM que estudian en otro municipio",
    ondeEstudam: "Dónde estudian",
    migrantesQueEstudam: "Migrantes que estudian",
  },

  comparativo: {
    colunas: {
      pop: "Población",
      mig_intra: "Migración intra-RM",
      saldo_externo: "Saldo externo",
      pct_pendular: "% pendular",
      tempo_mediano: "Tiempo mediano",
      pct_coletivo: "% transp. público",
    },
    ver: (nome: string) => `Ver ${nome}`,
    nMunicipios: (n: number) => `${n} mun.`,
  },

  sankey: {
    ariaDiagrama: (anoOrigem: string, anoDestino: string) =>
      `Diagrama de flujo: dónde vivían los migrantes en ${anoOrigem}, dónde pasaron a vivir y dónde trabajan en ${anoDestino}`,
    caminhosInsuficientes: "No hay recorridos suficientes para el diagrama.",
  },
};
