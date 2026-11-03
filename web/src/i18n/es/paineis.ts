import type { Dicionario } from "../pt";

const NB = " ";
const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const personas = (n: number) => (Math.abs(n) === 1 ? "persona" : "personas");

export const paineis: Dicionario["paineis"] = {
  dp: ":",
  pct: (valor: string) => `${valor}${NB}%`,
  tituloAtlas: "Atlas de la migración interna",
  preparandoDados: "preparando los datos…",
  limparSelecao: "Borrar selección",
  naoExisteNaEdicao: (demonstrativo: string) => ({
    antes: `${maiuscula(demonstrativo)} no existe en la edición `,
    depois: " seleccionada — las ediciones antiguas pueden cubrir un territorio menor o tener una "
      + "división administrativa diferente.",
  }),

  termos: {
    saldoMigratorio: "Saldo migratorio",
    taxaLiquida: "Tasa neta",
    imigrantes: "Inmigrantes",
    emigrantes: "Emigrantes",
    ic95: `IC 95${NB}%`,
    precisao: "Precisión",
    coefVariacao: "coeficiente de variación",
    indiceEficacia: "Índice de eficacia migratoria",
    idadeSexo: "Edad y sexo",
  },

  principaisOrigens: "Principales orígenes",
  principaisDestinos: "Principales destinos",
  nenhumFluxo: "Ningún flujo por encima del umbral de divulgación.",

  perfilMigrantes: "Perfil de los migrantes",
  nesteFluxo: "En este flujo",
  fluxoInverso: "Flujo inverso",

  observacoes: (nFaixa: string) => `${nFaixa === "<5" ? "menos de 5" : nFaixa} observaciones`,
  naAmostra: " en la muestra",

  ganhaNaTroca: (quem: string, valor: string, n: number, outro: string) =>
    `${quem} gana ${valor} ${personas(n)} en el intercambio con ${outro}`,
  trocaEquilibrada: (par: string) => `intercambio equilibrado entre ${par}`,

  municipio: {
    intro: (de: string, ate: string, censo: string, proxy: boolean) =>
      `Flujos migratorios entre municipios brasileños en el quinquenio ${de}–${ate},`
      + (proxy
        ? ` a partir de un proxy de fecha fija del Censo Demográfico ${censo} (ver el aviso más abajo).`
        : ` a partir de la pregunta de fecha fija del Censo Demográfico ${censo}.`),
    clique: "Haga clic en un municipio del mapa para ver su saldo, los principales flujos de entrada "
      + "y de salida, y el perfil de los migrantes. Haga clic en un arco para ver el detalle de un flujo.",
    municipiosAgregados: (n: number) => (n === 1 ? `${n} municipio agregado` : `${n} municipios agregados`),
    habitantes: (valor: string) => `${valor} habitantes`,
    aplicandoRecorte: "Aplicando el filtro…",
    semDadoRecorte: "No hay dato publicado para este filtro en este municipio.",
    taxaDetalhe: "por cada mil habitantes de 5 años o más",
    avisoRecorte: {
      antes: "Todas las cifras anteriores se refieren solo al filtro activo ",
      depois: ". Sin el filtro, el panel muestra el total de migrantes.",
    },
    precisaoImigracao: { termo: "Precisión", depois: " de la estimación de inmigración" },
    imigNaoInformados: (valor: string, n: number) =>
      `${valor} ${n === 1 ? "inmigrante" : "inmigrantes"} con origen no declarado`,
    imigExterior: (valor: string, n: number) => `${valor} ${n === 1 ? "procedente" : "procedentes"} del exterior`,
    perfilRecorte: {
      antes: "Composición de ",
      forte: "todos",
      depois: " los migrantes del municipio: las barras no siguen el filtro activo, que se aplica "
        + "a los indicadores y a los flujos de arriba.",
    },
    chegaramA: (nome: string) => `Llegaron a ${nome}`,
    sairamDe: (nome: string) => `Salieron de ${nome}`,
    residentesDe: (nome: string) => `Residentes de ${nome}`,
  },

  unidade: {
    nivel: { antes: "Nivel: ", depois: ". Haga clic en una unidad del mapa, o búsquela por el nombre, para ver sus indicadores y principales flujos." },
    notaVazio: "La migración entre municipios de una misma unidad no se contabiliza; los pares por debajo del "
      + "umbral de divulgación quedan fuera de la suma. No hay error estándar publicado en este nivel "
      + "(ver la página de Metodología).",
    acordesTitulo: "Flujos migratorios entre estados",
    taxaPorMil: " (por mil)",
    explicacao: "Indicadores agregados: suma de los pares publicados en este nivel (tras el umbral de "
      + "divulgación); pueden diferir de la suma de los municipios; sin error estándar propio.",
  },

  fluxo: {
    naoPublicado: "Flujo no publicado",
    naoPublicadoMotivo: (min: number) =>
      `Este par origen–destino quedó por debajo del umbral de divulgación (menos de ${min} personas `
      + "en la muestra) y por eso no se publica individualmente.",
    titulo: (de: string, ate: string) => `Flujo migratorio ${de}–${ate}`,
    migrantesNoFluxo: "Migrantes en el flujo",
    abaixoLimiar: "por debajo del umbral de divulgación",
    saldoPar: "Saldo del par",
    parUnidades: "las dos unidades",
    perfilNaoPublicado: (min: number) =>
      `El perfil de los migrantes de este flujo no se publica: con menos de ${min} observaciones en la `
      + "muestra, el desglose por característica permitiría identificar a los informantes.",
    explicacaoPerfil: "Las barras comparan a quienes hicieron este recorrido con tres referencias: todos los "
      + "que llegaron al destino, todos los que salieron del origen y la población residente en el destino.",
    imigrantesDe: (nome: string) => `Inmigrantes a ${nome}`,
    emigrantesDe: (nome: string) => `Emigrantes de ${nome}`,
    residentesDe: (nome: string) => `Residentes de ${nome}`,
    ondeTrabalham: "Dónde trabajan quienes hicieron este recorrido",
    ondeTrabalhamNota: (origem: string, destino: string, ano: string) =>
      `De los migrantes intra-RM que salieron de ${origem} y pasaron a vivir en ${destino}, `
      + `lugar de trabajo declarado en ${ano}.`,
  },

  fluxoUnidade: {
    naoPublicadoMotivo: "Este par quedó por debajo del umbral de divulgación y no se publica individualmente.",
    migrantesNesteFluxo: "Migrantes en este flujo",
    abaixoLimiar: "por debajo del umbral",
    saldoPar: "Saldo del par",
    naAmostraAgregado: " en la muestra. Nivel agregado: sin error estándar publicado.",
  },

  pendular: {
    carregando: "Cargando el flujo pendular…",
    naoPublicado: "Flujo pendular no publicado",
    naoPublicadoMotivo: "Este par quedó por debajo del umbral de divulgación y no se publica individualmente.",
    deslocamento: { termo: "Movilidad pendular", deTrabalho: " por trabajo", deEstudo: " por estudio" },
    universoEdicao: "Universo de esta edición.",
    pessoasNesteFluxo: "Personas en este flujo",
    abaixoLimiar: "por debajo del umbral",
    saldoPendular: "Saldo pendular del par",
    tempoMediano: "Tiempo mediano",
    minutos: (valor: string) => `${valor} min`,
    retornoDiario: "Retorno diario",
    transporteColetivo: "Transporte público",
    caracterizacaoNaoPublicada: (min: number) =>
      `La caracterización de este flujo no se publica: con menos de ${min} observaciones en la muestra, `
      + "el desglose permitiría identificar a los informantes.",
    semReferencia: "No hay referencia publicada para la movilidad pendular: la única línea es la "
      + "de este flujo, comparada con el flujo inverso cuando este también es publicable.",
  },

  barra: {
    semDado: "sin dato publicable",
    segmento: (rotulo: string, pct: string) => `${rotulo} ${pct}${NB}%`,
    aria: (serie: string, segmentos: string[]) => `${serie}: ${segmentos.join(", ")}`,
    titulo: (rotulo: string, pct: string) => `${rotulo}: ${pct}${NB}%`,
  },

  piramide: {
    menosDe: (valor: string) => `menos de ${valor}${NB}%`,
    ariaGrupo: (titulo: string, grupo: string) => `${titulo}. ${grupo}:`,
    ariaFaixa: (faixa: string, homens: string, mulheres: string) =>
      `${faixa} años, hombres ${homens}${NB}%, mujeres ${mulheres}${NB}%`,
    ariaOutros: (pct: string) => `Otros o suprimido: ${pct}.`,
    ariaReferencia: (rotulo: string) => `Referencia (${rotulo}):`,
    ariaReferenciaOutros: (pct: string) => `Referencia, otros o suprimido: ${pct}.`,
    homens: (grupo: string) => `Hombres (${grupo})`,
    mulheres: (grupo: string) => `Mujeres (${grupo})`,
    residuo: (pctGrupo: string, grupo: string, pctRef: string | null, rotuloRef: string | null) =>
      `Otros o suprimido (fuera de las barras): ${pctGrupo} de ${grupo}`
      + (pctRef != null && rotuloRef ? `; ${pctRef} de ${rotuloRef}` : "")
      + ". Son las celdas de edad y sexo con pocas observaciones, que el atlas no divulga (umbral "
      + `de divulgación), más el sexo ignorado; por eso las barras no suman 100${NB}%.`,
  },
};
