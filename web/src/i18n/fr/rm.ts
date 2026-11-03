import type { Dicionario } from "../pt";

/** en français, 0 et 1 (et tout |n| < 2) prennent le singulier */
const pl = (n: number, un: string, plusieurs: string) => (Math.abs(n) < 2 ? un : plusieurs);

export const rm: Dicionario["rm"] = {
  pct: (v: string) => `${v} %`,
  min: (v: string) => `${v} min`,
  semDados: "Données insuffisantes.",

  painel: {
    tituloVazio: "Atlas des migrations internes",
    naoExisteNaEdicao: <T>(edicao: T): (string | T)[] => [
      "Cette région métropolitaine n'existe pas dans l'édition ", edicao,
      " sélectionnée — les éditions anciennes peuvent couvrir un territoire plus petit ou avoir un découpage administratif différent.",
    ],
    voltarBrasil: "Retour au Brésil",
    carregando: "Chargement de la région métropolitaine…",
    sairModoRM: "Quitter le mode RM",
    linhaResumo: (nucleo: string, nMunicipios: number, pop: string) =>
      `Centre : ${nucleo} · ${nMunicipios} ${pl(nMunicipios, "municipalité", "municipalités")} · ${pop} habitants`,
    abasAria: "Onglet du panneau métropolitain",
    abas: {
      mig: "Migration intra-RM",
      trab: "Navettes travail",
      estudo: "Navettes études",
    },
    incluirCruzam: "Inclure les flux qui franchissent la limite de la RM",
    cruzamLimite: "Flux qui franchissent la limite de la RM",
    comparativoTitulo: "Comparaison des 20 plus grandes régions métropolitaines",
  },

  tabelaFluxos: {
    vazio: "Aucun flux au-dessus du seuil de diffusion.",
  },

  mig: {
    migrantesIntra: "Migrants intra-RM",
    saldoExterno: "Solde avec le reste du pays",
    entradasSaidas: (entradas: string, saidas: string) => `entrées ${entradas} · sorties ${saidas}`,
    matrizTitulo: "Matrice centre × périphérie",
    destinoNucleo: "Destination centre",
    destinoPeriferia: "Destination périphérie",
    origemNucleo: "Origine centre",
    origemPeriferia: "Origine périphérie",
    saldoPorMunicipio: "Solde intra-RM par municipalité",
    principaisFluxos: "Principaux flux intra-RM",
    cliquePerfil: "Cliquez sur une ligne pour voir le profil complet des migrants de ce couple.",
  },

  migTrab: {
    titulo: "Migrants et emploi",
    ocupados: "Migrants en emploi",
    fazemPendular: "Font des navettes",
    voltamOrigem: "Retournent travailler dans la municipalité d'origine",
    trabalhamNucleo: "Travaillent dans le centre",
    trabalhamOndeMoram: "Travaillent là où ils habitent",
    explicacao: (anoOrigem: string, anoDestino: string, top: number, residual: string) =>
      `Résidence en ${anoOrigem} → résidence en ${anoDestino} → lieu de travail en ${anoDestino}, pour les ${top} principaux parcours de la RM dont le lieu de travail est connu ; le reste apparaît agrégé dans « ${residual} ».`,
    verTabela: "Voir sous forme de tableau",
    colOrigem: (ano: string) => `Origine (${ano})`,
    colResidencia: (ano: string) => `Résidence (${ano})`,
    colTrabalho: (ano: string) => `Travail (${ano})`,
    colClasse: "Classe",
    colTotal: "Total",
    colFaixaN: "Tranche de n",
    carregandoDiagrama: "Chargement du diagramme…",
    caminhosInsuficientes: "Parcours insuffisants pour le diagramme dans cette RM.",
  },

  trab: {
    ocupados: "Personnes en emploi",
    pendulares: "Navetteurs",
    pctDosOcupados: (v: string) => `${v} % des personnes en emploi`,
    tempoMediano: "Durée médiane",
    retornoDiario: "Retour quotidien",
    transporteColetivo: "Transports en commun",
    maiorTaxaSaida: "Plus fort taux de navettes sortantes",
    maiorIndiceAtracao: "Plus fort indice d'attraction",
    principaisFluxos: "Principaux flux de navettes",
    cliqueCaracterizacao: "Cliquez sur une ligne pour voir la caractérisation du flux.",
  },

  estudo: {
    estudantesPendulares: "Étudiants navetteurs de la RM",
    entradasPorEstudo: "Entrées pour études",
    piso: "Plancher, et non estimation du total : cette édition comporte une question unique travail ou études, le travail primant, et ce flux ne couvre donc que les étudiants sans emploi.",
    principaisFluxos: "Principaux flux de navettes domicile-études",
    migEstudamOutro: "Migrants intra-RM qui étudient dans une autre municipalité",
    ondeEstudam: "Où ils étudient",
    migrantesQueEstudam: "Migrants qui étudient",
  },

  comparativo: {
    colunas: {
      pop: "Population",
      mig_intra: "Migration intra-RM",
      saldo_externo: "Solde externe",
      pct_pendular: "% navetteurs",
      tempo_mediano: "Durée médiane",
      pct_coletivo: "% transports en commun",
    },
    ver: (nome: string) => `Voir ${nome}`,
    nMunicipios: (n: number) => `${n} mun.`,
  },

  sankey: {
    ariaDiagrama: (anoOrigem: string, anoDestino: string) =>
      `Diagramme de flux : où les migrants habitaient en ${anoOrigem}, où ils se sont installés et où ils travaillent en ${anoDestino}`,
    caminhosInsuficientes: "Parcours insuffisants pour le diagramme.",
  },
};
