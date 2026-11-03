import type { Dicionario } from "../pt";

const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** en français, 0 et 1 (et tout |n| < 2) prennent le singulier */
const pl = (n: number, un: string, plusieurs: string) => (Math.abs(n) < 2 ? un : plusieurs);
/** "de Recife" / "d'Osasco" (élision devant voyelle) */
const de = (nome: string) => (/^[aeiouy]/i.test(nome.normalize("NFD")) ? `d'${nome}` : `de ${nome}`);

export const paineis: Dicionario["paineis"] = {
  dp: " :",
  pct: (valor: string) => `${valor} %`,
  tituloAtlas: "Atlas des migrations internes",
  preparandoDados: "préparation des données…",
  limparSelecao: "Effacer la sélection",
  naoExisteNaEdicao: (demonstrativo: string) => ({
    antes: `${maiuscula(demonstrativo)} n'existe pas dans l'édition `,
    depois: " sélectionnée — les éditions anciennes peuvent couvrir un territoire plus petit ou avoir un "
      + "découpage administratif différent.",
  }),

  termos: {
    saldoMigratorio: "Solde migratoire",
    taxaLiquida: "Taux net",
    imigrantes: "Entrants",
    emigrantes: "Sortants",
    ic95: "IC à 95 %",
    precisao: "Précision",
    coefVariacao: "coefficient de variation",
    indiceEficacia: "Indice d'efficacité migratoire",
    idadeSexo: "Âge et sexe",
  },

  principaisOrigens: "Principales origines",
  principaisDestinos: "Principales destinations",
  nenhumFluxo: "Aucun flux au-dessus du seuil de diffusion.",

  perfilMigrantes: "Profil des migrants",
  nesteFluxo: "Dans ce flux",
  fluxoInverso: "Flux inverse",

  observacoes: (nFaixa: string) => `${nFaixa === "<5" ? "moins de 5" : nFaixa} observations`,
  naAmostra: " dans l'échantillon",

  ganhaNaTroca: (quem: string, valor: string, n: number, outro: string) =>
    `${quem} gagne ${valor} ${pl(n, "personne", "personnes")} dans l'échange avec ${outro}`,
  trocaEquilibrada: (par: string) => `échange équilibré entre ${par}`,

  municipio: {
    intro: (de_: string, ate: string, censo: string, proxy: boolean) =>
      `Flux migratoires entre municipalités brésiliennes au cours de la période quinquennale ${de_}–${ate},`
      + (proxy
        ? ` à partir d'un proxy de date fixe du Recensement démographique ${censo} (voir l'avertissement ci-dessous).`
        : ` à partir de la question sur la résidence à une date fixe du Recensement démographique ${censo}.`),
    clique: "Cliquez sur une municipalité de la carte pour voir son solde, ses principaux flux d'entrée "
      + "et de sortie, et le profil des migrants. Cliquez sur un arc pour détailler un flux.",
    municipiosAgregados: (n: number) => `${n} ${pl(n, "municipalité agrégée", "municipalités agrégées")}`,
    habitantes: (valor: string) => `${valor} habitants`,
    aplicandoRecorte: "Application de la ventilation…",
    semDadoRecorte: "Pas de donnée publiée pour cette ventilation dans cette municipalité.",
    taxaDetalhe: "pour mille habitants de 5 ans ou plus",
    avisoRecorte: {
      antes: "Tous les chiffres ci-dessus ne concernent que la ventilation active ",
      depois: ". Sans ventilation, le panneau affiche l'ensemble des migrants.",
    },
    precisaoImigracao: { termo: "Précision", depois: " de l'estimation des entrées" },
    imigNaoInformados: (valor: string, n: number) =>
      `${valor} ${pl(n, "entrant", "entrants")} d'origine non déclarée`,
    imigExterior: (valor: string, n: number) => `${valor} ${pl(n, "arrivée", "arrivées")} de l'étranger`,
    perfilRecorte: {
      antes: "Composition de ",
      forte: "l'ensemble",
      depois: " des migrants de la municipalité : les barres ne suivent pas la ventilation active, qui "
        + "s'applique aux indicateurs et aux flux ci-dessus.",
    },
    chegaramA: (nome: string) => `Arrivés à ${nome}`,
    sairamDe: (nome: string) => `Partis ${de(nome)}`,
    residentesDe: (nome: string) => `Résidents ${de(nome)}`,
  },

  unidade: {
    nivel: {
      antes: "Niveau : ",
      depois: ". Cliquez sur une unité de la carte, ou recherchez-la par son nom, pour voir ses indicateurs et ses principaux flux.",
    },
    notaVazio: "La migration entre municipalités d'une même unité n'est pas comptabilisée ; les couples sous "
      + "le seuil de diffusion sont exclus de la somme. Aucune erreur type n'est publiée à ce niveau "
      + "(voir la page Méthodologie).",
    acordesTitulo: "Flux migratoires entre États",
    taxaPorMil: " (pour mille)",
    explicacao: "Indicateurs agrégés : somme des couples publiés à ce niveau (après le seuil de "
      + "diffusion) ; ils peuvent différer de la somme des municipalités ; pas d'erreur type propre.",
  },

  fluxo: {
    naoPublicado: "Flux non publié",
    naoPublicadoMotivo: (min: number) =>
      `Ce couple origine–destination est sous le seuil de diffusion (moins de ${min} personnes `
      + "dans l'échantillon) et n'est donc pas publié individuellement.",
    titulo: (de_: string, ate: string) => `Flux migratoire ${de_}–${ate}`,
    migrantesNoFluxo: "Migrants du flux",
    abaixoLimiar: "sous le seuil de diffusion",
    saldoPar: "Solde du couple",
    parUnidades: "les deux unités",
    perfilNaoPublicado: (min: number) =>
      `Le profil des migrants de ce flux n'est pas publié : avec moins de ${min} observations dans `
      + "l'échantillon, la ventilation par caractéristique permettrait d'identifier les répondants.",
    explicacaoPerfil: "Les barres comparent les personnes ayant fait ce trajet à trois références : "
      + "l'ensemble des arrivées à destination, l'ensemble des départs de l'origine et la population résidant à destination.",
    imigrantesDe: (nome: string) => `Arrivés à ${nome}`,
    emigrantesDe: (nome: string) => `Partis ${de(nome)}`,
    residentesDe: (nome: string) => `Résidents ${de(nome)}`,
    ondeTrabalham: "Où travaillent les personnes ayant fait ce trajet",
    ondeTrabalhamNota: (origem: string, destino: string, ano: string) =>
      `Parmi les migrants intra-RM partis ${de(origem)} pour s'installer à ${destino}, `
      + `lieu de travail déclaré en ${ano}.`,
  },

  fluxoUnidade: {
    naoPublicadoMotivo: "Ce couple est sous le seuil de diffusion et n'est pas publié individuellement.",
    migrantesNesteFluxo: "Migrants dans ce flux",
    abaixoLimiar: "sous le seuil",
    saldoPar: "Solde du couple",
    naAmostraAgregado: " dans l'échantillon. Niveau agrégé : pas d'erreur type publiée.",
  },

  pendular: {
    carregando: "Chargement du flux pendulaire…",
    naoPublicado: "Flux pendulaire non publié",
    naoPublicadoMotivo: "Ce couple est sous le seuil de diffusion et n'est pas publié individuellement.",
    deslocamento: { termo: "Mobilité pendulaire", deTrabalho: " domicile-travail", deEstudo: " domicile-études" },
    universoEdicao: "Champ de cette édition.",
    pessoasNesteFluxo: "Personnes dans ce flux",
    abaixoLimiar: "sous le seuil",
    saldoPendular: "Solde des navettes du couple",
    tempoMediano: "Durée médiane",
    minutos: (valor: string) => `${valor} min`,
    retornoDiario: "Retour quotidien",
    transporteColetivo: "Transports en commun",
    caracterizacaoNaoPublicada: (min: number) =>
      `La caractérisation de ce flux n'est pas publiée : avec moins de ${min} observations dans l'échantillon, `
      + "le détail permettrait d'identifier les répondants.",
    semReferencia: "Il n'y a pas de référence publiée pour la mobilité pendulaire : la seule ligne est celle "
      + "de ce flux, comparée au flux inverse lorsque celui-ci est aussi publiable.",
  },

  barra: {
    semDado: "pas de donnée publiable",
    segmento: (rotulo: string, pct: string) => `${rotulo} ${pct} %`,
    aria: (serie: string, segmentos: string[]) => `${serie} : ${segmentos.join(", ")}`,
    titulo: (rotulo: string, pct: string) => `${rotulo} : ${pct} %`,
  },

  piramide: {
    menosDe: (valor: string) => `moins de ${valor} %`,
    ariaGrupo: (titulo: string, grupo: string) => `${titulo}. ${grupo} :`,
    ariaFaixa: (faixa: string, homens: string, mulheres: string) => {
      // "60 et plus" -> "60 ans et plus"; "5–14" -> "5–14 ans"
      const idade = / et plus$/.test(faixa) ? faixa.replace(/ et plus$/, " ans et plus") : `${faixa} ans`;
      return `${idade}, hommes ${homens} %, femmes ${mulheres} %`;
    },
    ariaOutros: (pct: string) => `Autres ou masqué : ${pct}.`,
    ariaReferencia: (rotulo: string) => `Référence (${rotulo}) :`,
    ariaReferenciaOutros: (pct: string) => `Référence, autres ou masqué : ${pct}.`,
    homens: (grupo: string) => `Hommes (${grupo})`,
    mulheres: (grupo: string) => `Femmes (${grupo})`,
    residuo: (pctGrupo: string, grupo: string, pctRef: string | null, rotuloRef: string | null) =>
      `Autres ou masqué (hors des barres) : ${pctGrupo} pour « ${grupo} »`
      + (pctRef != null && rotuloRef ? ` ; ${pctRef} pour « ${rotuloRef} »` : "")
      + ". Il s'agit des cellules d'âge et de sexe comptant peu d'observations, que l'atlas ne diffuse pas (seuil "
      + "de diffusion), et du sexe inconnu ; c'est pourquoi les barres n'atteignent pas 100 %.",
  },
};
