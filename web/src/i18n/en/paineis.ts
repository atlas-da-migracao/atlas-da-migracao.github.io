/** `paineis` namespace (English): side panels (municipality, aggregate unit, flow, flow between
 *  units, commuting) and profile charts (`BarraPerfil`, `PiramideIdadeSexo`). Same shape and
 *  conventions as `pt/paineis.ts`; the raw `n` decides singular/plural. */
import type { Dicionario } from "../pt";

/** first letter in upper case (start of sentence) */
const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const pessoas = (n: number) => (Math.abs(n) === 1 ? "person" : "people");

export const paineis: Dicionario["paineis"] = {
  dp: ":",
  pct: (valor: string) => `${valor}%`,
  tituloAtlas: "Atlas of internal migration",
  preparandoDados: "preparing the data…",
  limparSelecao: "Clear selection",
  naoExisteNaEdicao: (demonstrativo: string) => ({
    antes: `${maiuscula(demonstrativo)} does not exist in the selected `,
    depois: " edition — older editions may cover a smaller territory or have a different "
      + "administrative division.",
  }),

  termos: {
    saldoMigratorio: "Net migration",
    taxaLiquida: "Net migration rate",
    imigrantes: "In-migrants",
    emigrantes: "Out-migrants",
    ic95: "95% CI",
    precisao: "Precision",
    coefVariacao: "coefficient of variation",
    indiceEficacia: "Migration effectiveness index",
    idadeSexo: "Age and sex",
  },

  principaisOrigens: "Top origins",
  principaisDestinos: "Top destinations",
  nenhumFluxo: "No flow above the disclosure threshold.",

  perfilMigrantes: "Profile of migrants",
  nesteFluxo: "In this flow",
  fluxoInverso: "Reverse flow",

  observacoes: (nFaixa: string) => `${nFaixa === "<5" ? "fewer than 5" : nFaixa} observations`,
  naAmostra: " in the sample",

  ganhaNaTroca: (quem: string, valor: string, n: number, outro: string) =>
    `${quem} gains ${valor} ${pessoas(n)} in the exchange with ${outro}`,
  trocaEquilibrada: (par: string) => `balanced exchange between ${par}`,

  municipio: {
    intro: (de: string, ate: string, censo: string, proxy: boolean) =>
      `Migration flows between Brazilian municipalities in the five-year period ${de}–${ate},`
      + (proxy
        ? ` based on a fixed-date proxy from the ${censo} Demographic Census (see notice below).`
        : ` based on the fixed-date question of the ${censo} Demographic Census.`),
    clique: "Click a municipality on the map to see its net migration, top inflows and outflows, "
      + "and the profile of migrants. Click an arc to see the details of a flow.",
    municipiosAgregados: (n: number) => `${n} aggregated ${n === 1 ? "municipality" : "municipalities"}`,
    habitantes: (valor: string) => `${valor} inhabitants`,
    aplicandoRecorte: "Applying the breakdown…",
    semDadoRecorte: "No data published for this breakdown in this municipality.",
    taxaDetalhe: "per 1,000 population aged 5+",
    avisoRecorte: {
      antes: "All figures above refer only to the active breakdown ",
      depois: ". Without the breakdown, the panel shows all migrants.",
    },
    precisaoImigracao: { termo: "Precision", depois: " of the in-migration estimate" },
    imigNaoInformados: (valor: string, n: number) =>
      `${valor} ${Math.abs(n) === 1 ? "in-migrant" : "in-migrants"} with origin not reported`,
    imigExterior: (valor: string, _n: number) => `${valor} from abroad`,
    perfilRecorte: {
      antes: "Composition of ",
      forte: "all",
      depois: " migrants in the municipality: the bars do not follow the active breakdown, which "
        + "applies to the indicators and flows above.",
    },
    chegaramA: (nome: string) => `Arrived in ${nome}`,
    sairamDe: (nome: string) => `Left ${nome}`,
    residentesDe: (nome: string) => `Residents of ${nome}`,
  },

  unidade: {
    nivel: { antes: "Level: ", depois: ". Click a unit on the map, or search by name, to see its indicators and top flows." },
    notaVazio: "Migration between municipalities in the same unit is not counted; pairs below the "
      + "disclosure threshold are left out of the sum. No standard error is published at this level "
      + "(see the Methodology page).",
    acordesTitulo: "Migration flows between states",
    taxaPorMil: " (per 1,000)",
    explicacao: "Aggregate indicators: sum of the published pairs at this level (after the disclosure "
      + "threshold); they may differ from the sum of the municipalities; no standard error of their own.",
  },

  fluxo: {
    naoPublicado: "Flow not published",
    naoPublicadoMotivo: (min: number) =>
      `This origin–destination pair fell below the disclosure threshold (fewer than ${min} people `
      + "in the sample), so it is not published individually.",
    titulo: (de: string, ate: string) => `Migration flow ${de}–${ate}`,
    migrantesNoFluxo: "Migrants in the flow",
    abaixoLimiar: "below the disclosure threshold",
    saldoPar: "Net migration for the pair",
    parUnidades: "the two units",
    perfilNaoPublicado: (min: number) =>
      `The profile of migrants in this flow is not published: with fewer than ${min} observations in the `
      + "sample, a breakdown by characteristic would identify the respondents.",
    explicacaoPerfil: "The bars compare those who made this move with three references: everyone "
      + "who arrived at the destination, everyone who left the origin, and the resident population of the destination.",
    imigrantesDe: (nome: string) => `In-migrants to ${nome}`,
    emigrantesDe: (nome: string) => `Out-migrants from ${nome}`,
    residentesDe: (nome: string) => `Residents of ${nome}`,
    ondeTrabalham: "Where those who made this move work",
    ondeTrabalhamNota: (origem: string, destino: string, ano: string) =>
      `Intra-RM migrants who left ${origem} and moved to ${destino}, `
      + `by place of work reported in ${ano}.`,
  },

  fluxoUnidade: {
    naoPublicadoMotivo: "This pair fell below the disclosure threshold and is not published individually.",
    migrantesNesteFluxo: "Migrants in this flow",
    abaixoLimiar: "below the threshold",
    saldoPar: "Net migration for the pair",
    naAmostraAgregado: " in the sample. Aggregate level: no standard error published.",
  },

  pendular: {
    carregando: "Loading the commuting flow…",
    naoPublicado: "Commuting flow not published",
    naoPublicadoMotivo: "This pair fell below the disclosure threshold and is not published individually.",
    deslocamento: { termo: "Commuting", deTrabalho: " to work", deEstudo: " to school" },
    universoEdicao: "Universe of this edition.",
    pessoasNesteFluxo: "People in this flow",
    abaixoLimiar: "below the threshold",
    saldoPendular: "Net commuting for the pair",
    tempoMediano: "Median time",
    minutos: (valor: string) => `${valor} min`,
    retornoDiario: "Daily return",
    transporteColetivo: "Public transport",
    caracterizacaoNaoPublicada: (min: number) =>
      `The characteristics of this flow are not published: with fewer than ${min} observations in the sample, `
      + "the breakdown would identify the respondents.",
    semReferencia: "There is no published reference for commuting: the only row is this flow, "
      + "compared with the reverse flow when that one can also be published.",
  },

  barra: {
    semDado: "no publishable data",
    segmento: (rotulo: string, pct: string) => `${rotulo} ${pct}%`,
    aria: (serie: string, segmentos: string[]) => `${serie}: ${segmentos.join(", ")}`,
    titulo: (rotulo: string, pct: string) => `${rotulo}: ${pct}%`,
  },

  piramide: {
    menosDe: (valor: string) => `less than ${valor}%`,
    ariaGrupo: (titulo: string, grupo: string) => `${titulo}. ${grupo}:`,
    ariaFaixa: (faixa: string, homens: string, mulheres: string) =>
      `age ${faixa}, males ${homens}%, females ${mulheres}%`,
    ariaOutros: (pct: string) => `Other or suppressed: ${pct}.`,
    ariaReferencia: (rotulo: string) => `Reference (${rotulo}):`,
    ariaReferenciaOutros: (pct: string) => `Reference, other or suppressed: ${pct}.`,
    homens: (grupo: string) => `Males (${grupo})`,
    mulheres: (grupo: string) => `Females (${grupo})`,
    residuo: (pctGrupo: string, grupo: string, pctRef: string | null, rotuloRef: string | null) =>
      `Other or suppressed (outside the bars): ${pctGrupo} of ${grupo}`
      + (pctRef != null && rotuloRef ? `; ${pctRef} of ${rotuloRef}` : "")
      + ". These are the age-and-sex cells with few observations, which the atlas does not release "
      + "(disclosure threshold), plus unknown sex; that is why the bars do not add up to 100%.",
  },
};
