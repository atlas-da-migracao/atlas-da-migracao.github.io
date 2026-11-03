/** `serie` namespace (English): the "Across the censuses" section. Same shape and conventions as
 *  `pt/serie.ts`: the summary sentence is built by whole-block functions, so English decides its
 *  own syntax and word order. */
import type { Dicionario } from "../pt";

/** list in running text: "a", "a and b", "a, b, and c" */
const juntar = (xs: string[]) =>
  xs.length <= 1 ? xs.join("")
    : xs.length === 2 ? `${xs[0]} and ${xs[1]}`
    : `${xs.slice(0, -1).join(", ")}, and ${xs[xs.length - 1]}`;

/** English ordinal suffix for an already formatted rank ("1" -> "1st", "12" -> "12th") */
const ordinal = (posto: string) => {
  const n = Number(posto.replace(/\D/g, ""));
  if (!Number.isFinite(n) || posto.trim() === "") return posto;
  const r100 = n % 100;
  const sufixo = r100 >= 11 && r100 <= 13 ? "th"
    : n % 10 === 1 ? "st" : n % 10 === 2 ? "nd" : n % 10 === 3 ? "rd" : "th";
  return `${posto}${sufixo}`;
};

export const serie: Dicionario["serie"] = {
  edicaoProxy: (ano: string) => `${ano} (proxy)`,

  tipoIem: {
    rotatividade: "turnover",
    absorcao: "absorption",
    absorcao_forte: "strong absorption",
    evasao: "depletion",
    evasao_forte: "strong depletion",
    indefinido: "undetermined (small sample)",
  },

  tipoFluxo: {
    curta_intra: "Short-distance, intrastate",
    curta_inter: "Short-distance, interstate",
    longa_intra: "Long-distance, intrastate",
    longa_inter: "Long-distance, interstate",
  },

  palavraEstado: {
    numero: "",
    nao_existia: "did not exist",
    sem_cobertura: "no coverage",
    cobertura_insuficiente: "insufficient coverage",
    suprimido: "suppressed",
    nao_medido: "not measured",
    nao_comparavel: "not comparable",
  },

  medidas: {
    tlm: "Net migration rate",
    iem: "Migration effectiveness index",
    tbi: "Crude in-migration rate",
    tbe: "Crude out-migration rate",
    imig: "In-migrants",
    emig: "Out-migrants",
    saldo: "Net migration",
    turnover: "Turnover (in+out)",
    distancia_media: "Mean distance (km)",
    pct_interestadual: "% crossing state lines",
    gini_linha: "Destination concentration (Gini)",
  },

  frase: {
    semSerie: (nome: string, motivo: string, mae: { nome: string; agregada: boolean } | null) =>
      `There is no series for ${nome}: ${motivo}.` +
      (mae
        ? ` Open the series for ${mae.nome}, ${mae.agregada
            ? "in which the territory is aggregated" : "which the territory used to be part of"}.`
        : ""),
    motivoDominante: {
      nao_existia: "the territory did not exist as a unit in any edition with enough data",
      sem_cobertura: "no edition has enough territorial coverage",
      cobertura_insuficiente: "territorial coverage is insufficient in every edition",
      suprimido: "the flows were suppressed by the disclosure threshold in every edition",
      nao_medido: "the measure is not published in any edition",
      outro: "there are not enough data",
    },
    soUmaEdicao: (p: { nome: string; edicao: string; tipo: string; iem: string; imig: string; emig: string }) =>
      `There are data for ${p.nome} only in ${p.edicao}: ${p.tipo} (IEM ${p.iem}), with ${p.imig} people arriving and ${p.emig} leaving.`,
    nasDemaisEdicoes: (
      motivo: "nao_existia" | "agregado" | "cobertura" | "suprimido" | "nao_medido", maeNome: string,
    ) => {
      const texto = motivo === "agregado" ? `the territory is published aggregated into ${maeNome}`
        : motivo === "nao_existia" ? "it did not exist"
        : motivo === "cobertura" ? "coverage is insufficient"
        : motivo === "suprimido" ? "the data were suppressed"
        : "the data were not measured";
      return `In the other editions, ${texto}.`;
    },
    indefinidoAmbos: (nome: string, indices: { edicao: string; iem: string }[]) =>
      `In no census is the sample for ${nome} large enough to classify ` +
      `migration: the indices (${indices.map((p) => `${p.edicao}: ${p.iem}`).join(", ")}) have a margin larger than the value itself.`,
    indefinidoUmaPonta: (p: {
      nome: string; edicaoFim: string; tipoFim: string; edicaoIni: string; iemIni: string; margem: string;
    }) =>
      `In ${p.edicaoFim}, ${p.nome} shows ${p.tipoFim}. In ${p.edicaoIni}, the ` +
      `sample is too small to tell whether there was a gain or a loss (IEM ${p.iemIni}, with a ` +
      `margin of ${p.margem}). The comparison between the two end points is inconclusive.`,
    incertezaProxyMesmaClasse: (p: { nome: string; tipo: string; min: string; max: string }) =>
      `${p.nome} falls under ${p.tipo} in every census with data ` +
      `(IEM between ${p.min} and ${p.max}). The difference from 1980 is smaller than the uncertainty of that year's proxy; ` +
      "it is not safe to claim a trend.",
    incertezaProxyMudaClasse: (p: {
      nome: string; tipoIni: string; tipoFim: string; edicaoFim: string; iemIni: string; iemFim: string;
    }) =>
      `${p.nome} goes from ${p.tipoIni} (1980) to ${p.tipoFim} ` +
      `(${p.edicaoFim}), but the IEM barely moves (${p.iemIni} to ${p.iemFim}) — ` +
      "the difference crosses a classification threshold without actually being a large change. " +
      "The difference from 1980 is smaller than the uncertainty of that year's proxy; it is not safe to claim a trend.",
    manteveGrande: (p: {
      nome: string; tipo: string; maisPerto: boolean; iemIni: string; iemFim: string; complemento: string;
    }) =>
      `${p.nome} remains in ${p.tipo}, but ` +
      `${p.maisPerto ? "closer to" : "farther from"} balance (IEM from ${p.iemIni} ` +
      `to ${p.iemFim}): ${p.complemento}.`,
    manteveEstavel: (p: {
      nome: string; tipo: string; edicaoIni: string; iemIni: string; iemFim: string; complemento: string;
    }) =>
      `${p.nome} has been in ${p.tipo} since ${p.edicaoIni} (IEM from ` +
      `${p.iemIni} to ${p.iemFim}): ${p.complemento}.`,
    mudou: (p: {
      nome: string; edicaoIni: string; edicaoFim: string; tipoIni: string; iemIni: string;
      tipoFim: string; iemFim: string; complemento: string;
    }) =>
      `Between ${p.edicaoIni} and ${p.edicaoFim}, ${p.nome} shifted from ` +
      `${p.tipoIni} (IEM ${p.iemIni}) to ${p.tipoFim} ` +
      `(IEM ${p.iemFim}): ${p.complemento}.`,
    complemento: {
      up_up: "more people arrive than before, and more leave as well",
      flat_up: "it still receives people, but now loses almost as many",
      down_up: "fewer people arrive and more leave",
      up_flat: "more people arrive and departures have not kept pace",
      flat_flat: "arrivals and departures changed little",
      down_flat: "fewer people arrive than before",
      up_down: "more people arrive and fewer leave",
      flat_down: "fewer people leave than before",
      down_down: "fewer people arrive and leave than before",
    },
    complementoPorTaxas: (texto: string) =>
      `${texto} — judging by the rates, which partly offset the boundary change`,
    proxyEstimativa: "This figure is a proxy estimate, not a direct measurement.",
    proxyPontoInicial: "The 1980 point is a proxy estimate, which tends to pull the index toward zero " +
      "— the real change may be larger.",
    coberturaInsuficiente: (edicoes: string[]) =>
      `In ${juntar(edicoes)}, less than 90% of today's population was covered by the municipalities of the ` +
      `time; there is no figure for ${edicoes.length > 1 ? "those years" : "that year"}.`,
    rmUnitaria: (edicoes: string[]) =>
      `In ${juntar(edicoes)}, the region had a single municipality: the internal indicators ` +
      "do not exist; they are not zero.",
    maeAgregada: (nome: string, edicoes: string[], maeNome: string) =>
      `${edicoes.length > 0 ? `In ${juntar(edicoes)}` : "In earlier editions"}, ${nome} has no figure of its own: ` +
      `the territory is published aggregated into ${maeNome}.`,
    criadoDepois: (nome: string, edicao: string, maeNome: string) =>
      `${nome} was created after ${edicao}; until then its territory was part of ${maeNome}.`,
    maeIncluia: (nome: string, filhos: string[], ateEdicao: string | null) => {
      const nomes = filhos.length > 3
        ? `${filhos.slice(0, 3).join(", ")}, and others`
        : juntar(filhos);
      const ate = ateEdicao ? `Until ${ateEdicao}, ` : "Previously, ";
      return `${ate}${nome} included the territory that is now ` +
        `${nomes}; part of the change in volume since then is due to boundaries, not migration.`;
    },
  },

  seletor: {
    aria: "Censuses compared (select 2 to 5)",
    minimoDuas: "Select at least two editions",
  },

  modo: {
    aria: "Territory and censuses compared",
    placeholderBusca: "Search for a municipality, region, state or RM…",
    falhaUnidades: (erro: string) => `Failed to load the units: ${erro}`,
    vazioTitulo: "Compare a territory across the censuses",
    vazioTexto: "Choose a municipality, an immediate or intermediate region, a state or a metropolitan " +
      "region to see how migration changed between 1980 and 2022.",
    naoEncontradaTitulo: "This unit does not exist in the 2022 territorial base",
    naoEncontradaTexto: {
      antes: "The code ",
      depois: " does not match any unit in the 2022 boundary map, which is the territorial base compared " +
        "across the five censuses. The link may be outdated or incomplete.",
    },
    voltarBusca: "Back to search",
  },

  resumo: {
    titulo: "Across the censuses",
    verSerieCompleta: "View the full series ↗",
    abrirSerieDe: (nome: string) => `Open the series for ${nome} ↗`,
    saldo: "Net migration",
    ariaSaldo: (valor: string) => `Net migration, ${valor}`,
    eficacia: "Effectiveness",
    ariaEficacia: (tipo: string) => `Effectiveness, ${tipo}`,
    semClassificacao: "not classified",
    movimento: "Total movement",
    ariaMovimento: "Total movement (in + out)",
    entraramSairam: (entraram: string, sairam: string) => `${entraram} in, ${sairam} out`,
  },

  celula: {
    ariaRessalva: (texto: string) => `Caveat: ${texto}`,
    naoCalculavel: "This measure could not be calculated for this unit/edition.",
    naoPublicado: "not published",
    ressalvaPadrao: "Limited comparability in this edition.",
  },

  secao: {
    indiceAria: "Parts of the series",
    bloco: (n: number) => `Part ${n}`,
    semSerie: "There is no published series for this unit.",
    selo1980: "Proxy badge (1980).",
    aviso1980Padrao: "The 1980 Census has no fixed-date question: the published migration is estimated with a calibrated proxy, not measured directly.",
    glossario: "Glossary",
    metodologia: { antes: "Full methodology: ", botao: "full methodology", depois: "." },
  },

  bloco1: {
    titulo: (demonstrativo: string) => `Part 1 · Migration in ${demonstrativo}, census by census`,
    colMedida: "Measure",
    colTendencia: "trend",
    tipoFluxo: "Predominant flow type",
    notaTendencia: (intervalo: string) =>
      `“Trend” column = sparkline ${intervalo}; dashed position = no figure in that edition.`,
    nota1980: "1980 carries the proxy badge (see the notice at the top of the section).",
    notaRessalva: "ⓘ = comparability caveat (hover to read it; the full text is below).",
    ressalvasResumo: (n: number) => `Comparability ${n === 1 ? "caveat" : "caveats"} (${n})`,
    ressalvaItem: (medidas: string[], edicoes: string[]) => `${medidas.join(", ")} (${edicoes.join(", ")}):`,
  },

  bloco2: {
    titulo: (plural: string) => `Part 2 · The system of ${plural} this unit belongs to`,
    tituloRM: "Part 2 · The system of metropolitan regions",
    naoCalculadoRM: "Not calculated for metropolitan regions: the published series provides the system measures (CMI, aggregate MEI, ANMR, " +
      "Fielding's β, Duncan's D) only for municipalities, immediate regions, intermediate regions and states.",
    carregando: "Loading the system…",
    nota: "These figures describe the set of units at this level, not the selected unit. They " +
      "change with the number of units and can only be compared within the same level.",
    duncanFrase: (lista: string) => ({
      antes: "How much the structure of flows changed between censuses (",
      termo: "Duncan's D",
      depois: `, compared with the previous edition): ${lista}.`,
    }),
    colEdicao: "Edition",
    colNUnidades: "n units",
    colDuncan: { termo: "Duncan's D", depois: " (prev.)" },
    anteriorNaoMarcada: (edicao: string) => `The previous edition (${edicao}) is not selected.`,
  },

  bloco3: {
    titulo: "Part 3 · Where they came from and where they went",
    naoCalculadoRM: "Not calculated for metropolitan regions: flows between pairs of units are published " +
      "in the series only for municipalities, immediate regions, intermediate regions and states.",
    origens: "Top origins",
    destinos: "Top destinations",
    nenhumPar: (titulo: string) => `${titulo}: no published pair.`,
    motivoSuprimido: "▒ suppr.",
    motivoNaoExistia: "░ did not exist",
    motivoNaoMedido: "not measured",
    motivoOutro: "—",
    postoTotal: (posto: string, total: string) => `${ordinal(posto)} · ${total}`,
    foraDaLista: (n: number, nFmt: string) =>
      n > 1
        ? `${nFmt} more partners that were among the top 10 in some edition do not appear here.`
        : `${nFmt} more partner that was among the top 10 in some edition does not appear here.`,
    mostrarPrimeiros: (n: number) => `Show only the top ${n}`,
    mostrarTodos: "Show all",
    notaPosto: (edicao: string) => ({
      antes: "",
      termo: "Rank",
      depois: ` and volume by edition, sorted by rank in ${edicao} ` +
        "(the most recent selected edition), with ties broken by the earlier ones.",
    }),
  },

  bloco4: {
    titulo: "Part 4 · Who migrates (arrivals)",
    carregando: "Loading profile…",
    tituloBarraDepois: ", by edition",
    semDado: "no publishable data",
    motivoVazio: {
      nao_existia: "did not exist in this edition",
      sem_cobertura: "no coverage in this edition",
      cobertura_insuficiente: "insufficient coverage in this edition",
      suprimido: "suppressed (below the disclosure threshold)",
    },
  },

  mapa: {
    aria: "Comparative map",
    naoPublicadoRM: "Comparative map not published for metropolitan regions at this stage.",
    titulo: "Comparative map, census by census",
    medida: "Measure:",
    carregarMunicipais: (n: number) => `Load the municipal maps for the ${n} selected editions`,
    erro: (erro: string) => `Could not load the comparative map: ${erro}`,
    erroDesconhecido: "unknown error",
    quebrasFixas: (lista: string, iem: boolean) =>
      `Fixed breaks (the same in every edition): ${lista}${iem ? " (index, not %)" : "‰"}.`,
    carregandoPainel: "loading…",
    ariaPainel: (medida: string, edicao: string) => `Map of ${medida} in ${edicao}`,
    legendaAria: "Comparative map legend",
    tramasAria: "Diagonal: territory not comparable. Crosshatched: suppressed for confidentiality. Dotted: not measured. Horizontal: undetermined, sample too small to classify.",
    tramaDiagonal: "not comparable (did not exist / insufficient coverage)",
    tramaCruzada: "suppressed (confidentiality)",
    tramaPontilhada: "not measured (the census did not ask)",
    tramaIndefinida: "undetermined (sample too small to classify)",
  },
};
