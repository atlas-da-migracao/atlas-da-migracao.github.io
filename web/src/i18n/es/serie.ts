import type { Dicionario } from "../pt";

const NB = " ";

/** "y" pasa a "e" ante palabra que empieza con sonido /i/ (Itu, Ilhéus, Hidrolândia), pero no
 *  ante diptongo ("y Iauaretê" no; regla simplificada) */
const conjuncionY = (siguiente: string) => (/^[hH]?[iíIÍ](?![aeouáéóú])/.test(siguiente) ? "e" : "y");

/** "A", "A y B", "A, B y C" */
const listaY = (itens: string[]) => {
  if (itens.length <= 1) return itens.join("");
  const ultimo = itens[itens.length - 1];
  return `${itens.slice(0, -1).join(", ")} ${conjuncionY(ultimo)} ${ultimo}`;
};

export const serie: Dicionario["serie"] = {
  edicaoProxy: (ano: string) => `${ano} (proxy)`,

  tipoIem: {
    rotatividade: "rotación",
    absorcao: "absorción",
    absorcao_forte: "absorción fuerte",
    evasao: "expulsión",
    evasao_forte: "expulsión fuerte",
    indefinido: "indefinido (muestra pequeña)",
  },

  tipoFluxo: {
    curta_intra: "Corta distancia, intraestatal",
    curta_inter: "Corta distancia, interestatal",
    longa_intra: "Larga distancia, intraestatal",
    longa_inter: "Larga distancia, interestatal",
  },

  palavraEstado: {
    numero: "",
    nao_existia: "no existía",
    sem_cobertura: "sin cobertura",
    cobertura_insuficiente: "cobertura insuficiente",
    suprimido: "suprimido",
    nao_medido: "no medido",
    nao_comparavel: "no comparable",
  },

  medidas: {
    tlm: "Tasa neta de migración",
    iem: "Índice de eficacia migratoria",
    tbi: "Tasa bruta de inmigración",
    tbe: "Tasa bruta de emigración",
    imig: "Inmigrantes",
    emig: "Emigrantes",
    saldo: "Saldo",
    turnover: "Rotación (entr.+sal.)",
    distancia_media: "Distancia media (km)",
    pct_interestadual: "% que cruza el límite estatal",
    gini_linha: "Concentración de destinos (Gini)",
  },

  frase: {
    semSerie: (nome: string, motivo: string, mae: { nome: string; agregada: boolean } | null) =>
      `No hay serie para ${nome}: ${motivo}.` +
      (mae
        ? ` Abra la serie de ${mae.nome}, ${mae.agregada
            ? "en la que el territorio está agregado" : "de la que el territorio formaba parte"}.`
        : ""),
    motivoDominante: {
      nao_existia: "el territorio no existía como unidad en ninguna edición con datos suficientes",
      sem_cobertura: "ninguna edición tiene cobertura territorial suficiente",
      cobertura_insuficiente: "la cobertura territorial es insuficiente en todas las ediciones",
      suprimido: "los flujos fueron suprimidos por el umbral de divulgación en todas las ediciones",
      nao_medido: "la medida no se publica en ninguna edición",
      outro: "no hay datos suficientes",
    },
    soUmaEdicao: (p: { nome: string; edicao: string; tipo: string; iem: string; imig: string; emig: string }) =>
      `Solo hay datos para ${p.nome} en ${p.edicao}: ${p.tipo} (IEM ${p.iem}), con ${p.imig} personas que llegan y ${p.emig} que salen.`,
    nasDemaisEdicoes: (
      motivo: "nao_existia" | "agregado" | "cobertura" | "suprimido" | "nao_medido", maeNome: string,
    ) => {
      const texto = motivo === "agregado" ? `el territorio se publica agregado en ${maeNome}`
        : motivo === "nao_existia" ? "no existía"
        : motivo === "cobertura" ? "la cobertura es insuficiente"
        : motivo === "suprimido" ? "el dato fue suprimido"
        : "el dato no fue medido";
      return `En las demás ediciones, ${texto}.`;
    },
    indefinidoAmbos: (nome: string, indices: { edicao: string; iem: string }[]) =>
      `En ningún censo la muestra de ${nome} es lo bastante grande para clasificar ` +
      `la migración: los índices (${indices.map((p) => `${p.edicao}: ${p.iem}`).join("; ")}) tienen un margen mayor que su propio valor.`,
    indefinidoUmaPonta: (p: {
      nome: string; edicaoFim: string; tipoFim: string; edicaoIni: string; iemIni: string; margem: string;
    }) =>
      `En ${p.edicaoFim}, ${p.nome} presenta ${p.tipoFim}. En ${p.edicaoIni}, la ` +
      `muestra es demasiado pequeña para saber si había ganancia o pérdida (IEM ${p.iemIni}, con ` +
      `un margen de ${p.margem}). La comparación entre los dos extremos no es concluyente.`,
    incertezaProxyMesmaClasse: (p: { nome: string; tipo: string; min: string; max: string }) =>
      `${p.nome} aparece en ${p.tipo} en todos los censos con datos ` +
      `(IEM entre ${p.min} y ${p.max}). La diferencia con respecto a 1980 es menor que la incertidumbre del proxy de ese año; ` +
      "no es seguro afirmar una tendencia.",
    incertezaProxyMudaClasse: (p: {
      nome: string; tipoIni: string; tipoFim: string; edicaoFim: string; iemIni: string; iemFim: string;
    }) =>
      `${p.nome} pasa de ${p.tipoIni} (1980) a ${p.tipoFim} ` +
      `(${p.edicaoFim}), pero el IEM casi no se mueve (de ${p.iemIni} a ${p.iemFim}): ` +
      "la diferencia cruza un umbral de la clasificación sin ser, en realidad, un cambio grande. " +
      "La diferencia con respecto a 1980 es menor que la incertidumbre del proxy de ese año; no es seguro afirmar una tendencia.",
    manteveGrande: (p: {
      nome: string; tipo: string; maisPerto: boolean; iemIni: string; iemFim: string; complemento: string;
    }) =>
      `${p.nome} sigue en ${p.tipo}, pero ` +
      `${p.maisPerto ? "más cerca" : "más lejos"} del equilibrio (IEM de ${p.iemIni} ` +
      `a ${p.iemFim}): ${p.complemento}.`,
    manteveEstavel: (p: {
      nome: string; tipo: string; edicaoIni: string; iemIni: string; iemFim: string; complemento: string;
    }) =>
      `${p.nome} está en ${p.tipo} desde ${p.edicaoIni} (IEM de ` +
      `${p.iemIni} a ${p.iemFim}): ${p.complemento}.`,
    mudou: (p: {
      nome: string; edicaoIni: string; edicaoFim: string; tipoIni: string; iemIni: string;
      tipoFim: string; iemFim: string; complemento: string;
    }) =>
      `Entre ${p.edicaoIni} y ${p.edicaoFim}, ${p.nome} pasó de ` +
      `${p.tipoIni} (IEM ${p.iemIni}) a ${p.tipoFim} ` +
      `(IEM ${p.iemFim}): ${p.complemento}.`,
    complemento: {
      up_up: "llega más gente que antes, y también sale más",
      flat_up: "sigue recibiendo gente, pero ahora pierde casi la misma cantidad",
      down_up: "llega menos gente y sale más",
      up_flat: "llega más gente y las salidas no acompañaron ese aumento",
      flat_flat: "las entradas y las salidas cambiaron poco",
      down_flat: "llega menos gente que antes",
      up_down: "llega más gente y sale menos",
      flat_down: "sale menos gente que antes",
      down_down: "entran y salen menos personas que antes",
    },
    complementoPorTaxas: (texto: string) =>
      `${texto}, según las tasas, que descuentan en parte el cambio de límites`,
    proxyEstimativa: "Esta cifra es una estimación por proxy, no una medida directa.",
    proxyPontoInicial: "El punto de 1980 es una estimación por proxy, que tiende a acercar el índice a cero; " +
      "el cambio real puede ser mayor.",
    coberturaInsuficiente: (edicoes: string[]) =>
      `En ${listaY(edicoes)}, menos del 90${NB}% de la población actual estaba cubierta por los municipios de la ` +
      `época; no hay cifra para ${edicoes.length > 1 ? "esos años" : "ese año"}.`,
    rmUnitaria: (edicoes: string[]) =>
      `En ${listaY(edicoes)}, la región tenía un solo municipio: los indicadores ` +
      "internos no existen, no son cero.",
    maeAgregada: (nome: string, edicoes: string[], maeNome: string) =>
      `${edicoes.length > 0 ? `En ${listaY(edicoes)}` : "En ediciones anteriores"}, ${nome} no tiene cifra propia: ` +
      `el territorio se publica agregado en ${maeNome}.`,
    criadoDepois: (nome: string, edicao: string, maeNome: string) =>
      `${nome} fue creado después de ${edicao}; hasta entonces, su territorio formaba parte de ${maeNome}.`,
    maeIncluia: (nome: string, filhos: string[], ateEdicao: string | null) => {
      const nomes = filhos.length > 3
        ? `${filhos.slice(0, 3).join(", ")} y otros`
        : listaY(filhos);
      const ate = ateEdicao ? `Hasta ${ateEdicao}, ` : "Antes, ";
      return `${ate}${nome} incluía el territorio que hoy ` +
        `es ${nomes}; parte de la variación de volumen desde entonces se debe a los límites, no a la migración.`;
    },
  },

  seletor: {
    aria: "Censos comparados (marque de 2 a 5)",
    minimoDuas: "Marque al menos dos ediciones",
  },

  modo: {
    aria: "Territorio y censos comparados",
    placeholderBusca: "Buscar municipio, región, estado o RM…",
    falhaUnidades: (erro: string) => `Error al cargar las unidades: ${erro}`,
    vazioTitulo: "Compare un territorio a lo largo de los censos",
    vazioTexto: "Elija un municipio, una región inmediata o intermedia, un estado o una región " +
      "metropolitana para ver cómo cambió la migración entre 1980 y 2022.",
    naoEncontradaTitulo: "Esta unidad no existe en la base territorial de 2022",
    naoEncontradaTexto: {
      antes: "El código ",
      depois: " no corresponde a ninguna unidad de la malla de 2022, que es la base territorial comparada " +
        "en los cinco censos. Es posible que el enlace sea antiguo o esté incompleto.",
    },
    voltarBusca: "Volver a la búsqueda",
  },

  resumo: {
    titulo: "A lo largo de los censos",
    verSerieCompleta: "Ver la serie completa ↗",
    abrirSerieDe: (nome: string) => `Abrir la serie de ${nome} ↗`,
    saldo: "Saldo",
    ariaSaldo: (valor: string) => `Saldo, ${valor}`,
    eficacia: "Eficacia",
    ariaEficacia: (tipo: string) => `Eficacia, ${tipo}`,
    semClassificacao: "sin clasificación",
    movimento: "Movimiento total",
    ariaMovimento: "Movimiento total (entradas + salidas)",
    entraramSairam: (entraram: string, sairam: string) => `entraron ${entraram}, salieron ${sairam}`,
  },

  celula: {
    ariaRessalva: (texto: string) => `Salvedad: ${texto}`,
    naoCalculavel: "No fue posible calcular esta medida para esta unidad/edición.",
    naoPublicado: "no publicado",
    ressalvaPadrao: "Comparabilidad limitada en esta edición.",
  },

  secao: {
    indiceAria: "Bloques de la serie",
    bloco: (n: number) => `Bloque ${n}`,
    semSerie: "No hay serie publicada para esta unidad.",
    selo1980: "Distintivo «proxy» (1980).",
    aviso1980Padrao: "El Censo 1980 no tiene pregunta de fecha fija: la migración publicada se estima mediante un proxy calibrado, no se mide directamente.",
    glossario: "Glosario",
    metodologia: { antes: "Metodología completa: ", botao: "abrir la página de metodología", depois: "." },
  },

  bloco1: {
    titulo: (demonstrativo: string) => `Bloque 1 · La migración en ${demonstrativo}, censo a censo`,
    colMedida: "Medida",
    colTendencia: "tend.",
    tipoFluxo: "Tipo de flujo predominante",
    notaTendencia: (intervalo: string) =>
      `Columna «tend.» = sparkline ${intervalo}; posición con trazo discontinuo = sin cifra en esa edición.`,
    nota1980: "1980 lleva el distintivo «proxy» (ver el aviso al inicio de la sección).",
    notaRessalva: "ⓘ = salvedad de comparabilidad (pase el puntero por encima; el texto completo está más abajo).",
    ressalvasResumo: (n: number) => `Salvedades de comparabilidad (${n})`,
    ressalvaItem: (medidas: string[], edicoes: string[]) => `${medidas.join(", ")} (${edicoes.join(", ")}):`,
  },

  bloco2: {
    titulo: (plural: string) => `Bloque 2 · El sistema de ${plural} en el que se inserta esta unidad`,
    tituloRM: "Bloque 2 · El sistema de regiones metropolitanas",
    naoCalculadoRM: "No calculado para regiones metropolitanas: la serie publicada presenta el sistema (CMI, MEI agregado, ANMR, " +
      "β de Fielding, D de Duncan) solo para municipios, regiones inmediatas, regiones intermedias y estados.",
    carregando: "Cargando el sistema…",
    nota: "Estas cifras describen el conjunto de unidades del nivel, no la unidad seleccionada. " +
      "Cambian con el número de unidades y solo pueden compararse dentro de un mismo nivel.",
    duncanFrase: (lista: string) => ({
      antes: "Cuánto cambió la estructura de los flujos entre censos (",
      termo: "D de Duncan",
      depois: `, en comparación con la edición anterior): ${lista}.`,
    }),
    colEdicao: "Edición",
    colNUnidades: "n unidades",
    colDuncan: { termo: "D de Duncan", depois: " (ant.)" },
    anteriorNaoMarcada: (edicao: string) => `La edición anterior (${edicao}) no está marcada.`,
  },

  bloco3: {
    titulo: "Bloque 3 · De dónde vinieron y adónde fueron",
    naoCalculadoRM: "No calculado para regiones metropolitanas: los flujos entre pares de unidades se publican " +
      "en la serie solo para municipios, regiones inmediatas, regiones intermedias y estados.",
    origens: "Principales orígenes",
    destinos: "Principales destinos",
    nenhumPar: (titulo: string) => `${titulo}: ningún par publicado.`,
    motivoSuprimido: "▒ supr.",
    motivoNaoExistia: "░ no exist.",
    motivoNaoMedido: "no medido",
    motivoOutro: "—",
    postoTotal: (posto: string, total: string) => `${posto}.º · ${total}`,
    foraDaLista: (n: number, nFmt: string) =>
      n > 1
        ? `Otras ${nFmt} contrapartes que alguna vez estuvieron entre las 10 primeras en alguna edición no aparecen aquí.`
        : `Otra contraparte que alguna vez estuvo entre las 10 primeras en alguna edición no aparece aquí.`,
    mostrarPrimeiros: (n: number) => `Mostrar solo los ${n} primeros`,
    mostrarTodos: "Mostrar todos",
    notaPosto: (edicao: string) => ({
      antes: "",
      termo: "Posición",
      depois: ` en el ranking y volumen por edición, ordenados por la posición en ${edicao} ` +
        "(la edición marcada más reciente); los empates se resuelven por las ediciones anteriores.",
    }),
  },

  bloco4: {
    titulo: "Bloque 4 · Quién migra (llegaron)",
    carregando: "Cargando el perfil…",
    tituloBarraDepois: ", por edición",
    semDado: "sin dato publicable",
    motivoVazio: {
      nao_existia: "no existía en esta edición",
      sem_cobertura: "sin cobertura en esta edición",
      cobertura_insuficiente: "cobertura insuficiente en esta edición",
      suprimido: "suprimido (por debajo del umbral de divulgación)",
    },
  },

  mapa: {
    aria: "Mapa comparativo",
    naoPublicadoRM: "Mapa comparativo no publicado para regiones metropolitanas en esta fase.",
    titulo: "Mapa comparativo, censo a censo",
    medida: "Medida:",
    carregarMunicipais: (n: number) => `Cargar los mapas municipales de las ${n} ediciones marcadas`,
    erro: (erro: string) => `No fue posible cargar el mapa comparativo: ${erro}`,
    erroDesconhecido: "error desconocido",
    quebrasFixas: (lista: string, iem: boolean) =>
      `Cortes fijos (los mismos en todas las ediciones): ${lista}${iem ? " (índice, no %)" : `${NB}‰`}.`,
    carregandoPainel: "cargando…",
    ariaPainel: (medida: string, edicao: string) => `Mapa de ${medida} en ${edicao}`,
    legendaAria: "Leyenda del mapa comparativo",
    tramasAria: "Diagonal: territorio no comparable. Cruzada: suprimido por secreto estadístico. Punteada: no medido. Horizontal: indefinido, muestra demasiado pequeña para clasificar.",
    tramaDiagonal: "no comparable (no existía / cobertura insuficiente)",
    tramaCruzada: "suprimido (secreto estadístico)",
    tramaPontilhada: "no medido (el censo no lo preguntó)",
    tramaIndefinida: "indefinido (muestra demasiado pequeña para clasificar)",
  },
};
