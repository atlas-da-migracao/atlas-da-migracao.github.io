import type { Dicionario } from "../pt";

/** "de Recife" / "d'Osasco" / "d'États" (élision devant voyelle) */
const de = (s: string) => (/^[aeiouy]/i.test(s.normalize("NFD")) ? `d'${s}` : `de ${s}`);
/** « texte » avec espaces fines insécables */
const g = (s: string) => `« ${s} »`;
/** "1980", "1980 et 1991", "1980, 1991 et 2000" */
const liste = (xs: string[]) =>
  xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} et ${xs[xs.length - 1]}`;
/** valeur absolue d'un nombre déjà formaté en fr-FR; Infinity si illisible */
const valeur = (v: string) => {
  const x = Number(v.replace(/[\s  ]/g, "").replace("−", "-").replace(",", "."));
  return Number.isNaN(x) ? Infinity : Math.abs(x);
};
const pl = (v: string, un: string, plusieurs: string) => (valeur(v) < 2 ? un : plusieurs);

export const serie: Dicionario["serie"] = {
  edicaoProxy: (ano: string) => `${ano} (proxy)`,

  tipoIem: {
    rotatividade: "rotation",
    absorcao: "absorption",
    absorcao_forte: "forte absorption",
    evasao: "répulsion",
    evasao_forte: "forte répulsion",
    indefinido: "situation indéterminée (petit échantillon)",
  },

  tipoFluxo: {
    curta_intra: "Courte distance, intra-étatique",
    curta_inter: "Courte distance, interétatique",
    longa_intra: "Longue distance, intra-étatique",
    longa_inter: "Longue distance, interétatique",
  },

  palavraEstado: {
    numero: "",
    nao_existia: "n'existait pas",
    sem_cobertura: "sans couverture",
    cobertura_insuficiente: "couverture insuffisante",
    suprimido: "masqué",
    nao_medido: "non mesuré",
    nao_comparavel: "non comparable",
  },

  medidas: {
    tlm: "Taux net de migration",
    iem: "Indice d'efficacité migratoire",
    tbi: "Taux brut d'entrée",
    tbe: "Taux brut de sortie",
    imig: "Entrants",
    emig: "Sortants",
    saldo: "Solde",
    turnover: "Rotation (entr.+sort.)",
    distancia_media: "Distance moyenne (km)",
    pct_interestadual: "% qui franchit les limites de l'État",
    gini_linha: "Concentration des destinations (Gini)",
  },

  frase: {
    semSerie: (nome: string, motivo: string, mae: { nome: string; agregada: boolean } | null) =>
      `Il n'y a pas de série pour ${nome} : ${motivo}.` +
      (mae
        ? ` Ouvrez la série ${de(mae.nome)}, ${mae.agregada
            ? "dans laquelle le territoire est agrégé" : "dont le territoire faisait partie"}.`
        : ""),
    motivoDominante: {
      nao_existia: "le territoire n'existait en tant qu'unité dans aucune édition disposant de données suffisantes",
      sem_cobertura: "aucune édition n'a une couverture territoriale suffisante",
      cobertura_insuficiente: "la couverture territoriale est insuffisante dans toutes les éditions",
      suprimido: "les flux ont été masqués par le seuil de diffusion dans toutes les éditions",
      nao_medido: "l'indicateur n'est publié dans aucune édition",
      outro: "les données sont insuffisantes",
    },
    soUmaEdicao: (p: { nome: string; edicao: string; tipo: string; iem: string; imig: string; emig: string }) =>
      `Il n'y a de données pour ${p.nome} qu'en ${p.edicao} : classe ${g(p.tipo)} (IEM ${p.iem}), avec ` +
      `${p.imig} ${pl(p.imig, "arrivée", "arrivées")} et ${p.emig} ${pl(p.emig, "départ", "départs")}.`,
    nasDemaisEdicoes: (
      motivo: "nao_existia" | "agregado" | "cobertura" | "suprimido" | "nao_medido", maeNome: string,
    ) => {
      const texto = motivo === "agregado" ? `le territoire est publié agrégé dans ${maeNome}`
        : motivo === "nao_existia" ? "il n'existait pas"
        : motivo === "cobertura" ? "la couverture est insuffisante"
        : motivo === "suprimido" ? "la donnée a été masquée"
        : "la donnée n'a pas été mesurée";
      return `Dans les autres éditions, ${texto}.`;
    },
    indefinidoAmbos: (nome: string, indices: { edicao: string; iem: string }[]) =>
      `Dans aucun recensement l'échantillon ${de(nome)} n'est assez grand pour classer ` +
      `la migration : les indices (${indices.map((p) => `${p.edicao} : ${p.iem}`).join(", ")}) ont une marge supérieure à leur propre valeur.`,
    indefinidoUmaPonta: (p: {
      nome: string; edicaoFim: string; tipoFim: string; edicaoIni: string; iemIni: string; margem: string;
    }) =>
      `En ${p.edicaoFim}, ${p.nome} relève de la classe ${g(p.tipoFim)}. En ${p.edicaoIni}, ` +
      `l'échantillon est trop petit pour dire s'il y avait un gain ou une perte (IEM ${p.iemIni}, avec ` +
      `une marge de ${p.margem}). La comparaison entre les deux extrémités n'est pas concluante.`,
    incertezaProxyMesmaClasse: (p: { nome: string; tipo: string; min: string; max: string }) =>
      `${p.nome} relève de la classe ${g(p.tipo)} dans tous les recensements disposant de données ` +
      `(IEM entre ${p.min} et ${p.max}). L'écart par rapport à 1980 est inférieur à l'incertitude du proxy de cette année-là ; ` +
      "il n'est pas prudent d'affirmer une tendance.",
    incertezaProxyMudaClasse: (p: {
      nome: string; tipoIni: string; tipoFim: string; edicaoFim: string; iemIni: string; iemFim: string;
    }) =>
      `${p.nome} passe de la classe ${g(p.tipoIni)} (1980) à la classe ${g(p.tipoFim)} ` +
      `(${p.edicaoFim}), mais l'IEM ne bouge presque pas (de ${p.iemIni} à ${p.iemFim}) — ` +
      "l'écart franchit un seuil de la classification sans être, en réalité, un grand changement. " +
      "L'écart par rapport à 1980 est inférieur à l'incertitude du proxy de cette année-là ; il n'est pas prudent d'affirmer une tendance.",
    manteveGrande: (p: {
      nome: string; tipo: string; maisPerto: boolean; iemIni: string; iemFim: string; complemento: string;
    }) =>
      `${p.nome} reste dans la classe ${g(p.tipo)}, mais ` +
      `${p.maisPerto ? "plus près" : "plus loin"} de l'équilibre (IEM de ${p.iemIni} ` +
      `à ${p.iemFim}) : ${p.complemento}.`,
    manteveEstavel: (p: {
      nome: string; tipo: string; edicaoIni: string; iemIni: string; iemFim: string; complemento: string;
    }) =>
      `${p.nome} relève de la classe ${g(p.tipo)} depuis ${p.edicaoIni} (IEM de ` +
      `${p.iemIni} à ${p.iemFim}) : ${p.complemento}.`,
    mudou: (p: {
      nome: string; edicaoIni: string; edicaoFim: string; tipoIni: string; iemIni: string;
      tipoFim: string; iemFim: string; complemento: string;
    }) =>
      `Entre ${p.edicaoIni} et ${p.edicaoFim}, ${p.nome} passe de la classe ` +
      `${g(p.tipoIni)} (IEM ${p.iemIni}) à la classe ${g(p.tipoFim)} ` +
      `(IEM ${p.iemFim}) : ${p.complemento}.`,
    complemento: {
      up_up: "il arrive plus de monde qu'avant, et il en part davantage aussi",
      flat_up: "les arrivées se maintiennent, mais les départs sont désormais presque aussi nombreux",
      down_up: "il arrive moins de monde et il en part davantage",
      up_flat: "il arrive plus de monde, sans hausse équivalente des départs",
      flat_flat: "les entrées et les sorties ont peu changé",
      down_flat: "il arrive moins de monde qu'avant",
      up_down: "il arrive plus de monde et il en part moins",
      flat_down: "il part moins de monde qu'avant",
      down_down: "il arrive et il part moins de personnes qu'avant",
    },
    complementoPorTaxas: (texto: string) =>
      `${texto} — d'après les taux, qui neutralisent en partie le changement de limites`,
    proxyEstimativa: "Ce chiffre est une estimation par proxy, et non une mesure directe.",
    proxyPontoInicial: "Le point de 1980 est une estimation par proxy, qui tend à rapprocher l'indice de zéro " +
      "— le changement réel peut être plus important.",
    coberturaInsuficiente: (edicoes: string[]) =>
      `En ${liste(edicoes)}, moins de 90 % de la population actuelle était couverte par les municipalités de ` +
      `l'époque ; il n'y a pas de chiffre pour ${edicoes.length > 1 ? "ces années" : "cette année"}.`,
    rmUnitaria: (edicoes: string[]) =>
      `En ${liste(edicoes)}, la région ne comptait qu'une seule municipalité : les indicateurs ` +
      "internes n'existent pas, ils ne sont pas nuls.",
    maeAgregada: (nome: string, edicoes: string[], maeNome: string) =>
      `${edicoes.length > 0 ? `En ${liste(edicoes)}` : "Dans les éditions antérieures"}, ${nome} n'a pas de chiffre propre : ` +
      `le territoire est publié agrégé dans ${maeNome}.`,
    criadoDepois: (nome: string, edicao: string, maeNome: string) =>
      `La municipalité ${de(nome)} a été créée après ${edicao} ; jusque-là, son territoire faisait partie ${de(maeNome)}.`,
    maeIncluia: (nome: string, filhos: string[], ateEdicao: string | null) => {
      const nomes = filhos.length > 3
        ? `${filhos.slice(0, 3).join(", ")} et d'autres`
        : liste(filhos);
      const ate = ateEdicao ? `Jusqu'en ${ateEdicao}, ` : "Auparavant, ";
      return `${ate}${nome} englobait le territoire qui correspond aujourd'hui à ${nomes} ; ` +
        "une partie de la variation des volumes depuis lors tient au changement de limites, et non à la migration.";
    },
  },

  seletor: {
    aria: "Recensements comparés (cochez-en de 2 à 5)",
    minimoDuas: "Cochez au moins deux éditions",
  },

  modo: {
    aria: "Territoire et recensements comparés",
    placeholderBusca: "Rechercher une municipalité, une région, un État ou une RM…",
    falhaUnidades: (erro: string) => `Échec du chargement des unités : ${erro}`,
    vazioTitulo: "Comparer un territoire au fil des recensements",
    vazioTexto: "Choisissez une municipalité, une région immédiate ou intermédiaire, un État ou une région " +
      "métropolitaine pour voir comment la migration a évolué entre 1980 et 2022.",
    naoEncontradaTitulo: "Cette unité n'existe pas dans la base territoriale de 2022",
    naoEncontradaTexto: {
      antes: "Le code ",
      depois: " ne correspond à aucune unité du maillage de 2022, qui est la base territoriale comparée " +
        "dans les cinq recensements. Le lien est peut-être ancien ou incomplet.",
    },
    voltarBusca: "Retour à la recherche",
  },

  resumo: {
    titulo: "Au fil des recensements",
    verSerieCompleta: "Voir la série complète ↗",
    abrirSerieDe: (nome: string) => `Ouvrir la série ${de(nome)} ↗`,
    saldo: "Solde",
    ariaSaldo: (valor: string) => `Solde, ${valor}`,
    eficacia: "Efficacité",
    ariaEficacia: (tipo: string) => `Efficacité, ${tipo}`,
    semClassificacao: "non classé",
    movimento: "Mouvement total",
    ariaMovimento: "Mouvement total (entrées + sorties)",
    entraramSairam: (entraram: string, sairam: string) => `entrées ${entraram}, sorties ${sairam}`,
  },

  celula: {
    ariaRessalva: (texto: string) => `Réserve : ${texto}`,
    naoCalculavel: "Impossible de calculer cet indicateur pour cette unité/édition.",
    naoPublicado: "non publié",
    ressalvaPadrao: "Comparabilité limitée dans cette édition.",
  },

  secao: {
    indiceAria: "Parties de la série",
    bloco: (n: number) => `Partie ${n}`,
    semSerie: "Aucune série publiée pour cette unité.",
    selo1980: "Mention « proxy » (1980).",
    aviso1980Padrao: "Le Recensement 1980 ne comporte pas de question sur la résidence à une date fixe : la migration publiée est estimée par un proxy calibré, et non mesurée directement.",
    glossario: "Glossaire",
    metodologia: { antes: "Méthodologie complète : ", botao: "méthodologie complète", depois: "." },
  },

  bloco1: {
    titulo: (demonstrativo: string) => `Partie 1 · La migration dans ${demonstrativo}, recensement par recensement`,
    colMedida: "Indicateur",
    colTendencia: "tend.",
    tipoFluxo: "Type de flux prédominant",
    notaTendencia: (intervalo: string) =>
      `Colonne ${g("tend.")} = sparkline ${intervalo} ; position en pointillés = pas de chiffre pour cette édition.`,
    nota1980: "1980 porte la mention « proxy » (voir l'avertissement en haut de la section).",
    notaRessalva: "ⓘ = réserve de comparabilité (survolez avec la souris ; le texte complet figure ci-dessous).",
    ressalvasResumo: (n: number) => `Réserves de comparabilité (${n})`,
    ressalvaItem: (medidas: string[], edicoes: string[]) => `${medidas.join(", ")} (${edicoes.join(", ")}) :`,
  },

  bloco2: {
    titulo: (plural: string) => `Partie 2 · Le système ${de(plural)} dont fait partie cette unité`,
    tituloRM: "Partie 2 · Le système des régions métropolitaines",
    naoCalculadoRM: "Non calculé pour les régions métropolitaines : la série publiée ne présente le système (CMI, MEI agrégé, ANMR, " +
      "β de Fielding, D de Duncan) que pour les municipalités, les régions immédiates, les régions intermédiaires et les États.",
    carregando: "Chargement du système…",
    nota: "Ces chiffres décrivent l'ensemble des unités du niveau, et non l'unité sélectionnée. Ils " +
      "varient avec le nombre d'unités et ne sont comparables qu'au sein d'un même niveau.",
    duncanFrase: (lista: string) => ({
      antes: "Dans quelle mesure la structure des flux a changé d'un recensement à l'autre (",
      termo: "D de Duncan",
      depois: `, par rapport à l'édition précédente) : ${lista}.`,
    }),
    colEdicao: "Édition",
    colNUnidades: "n unités",
    colDuncan: { termo: "D de Duncan", depois: " (préc.)" },
    anteriorNaoMarcada: (edicao: string) => `L'édition précédente (${edicao}) n'est pas cochée.`,
  },

  bloco3: {
    titulo: "Partie 3 · D'où ils sont venus et où ils sont allés",
    naoCalculadoRM: "Non calculé pour les régions métropolitaines : les flux entre couples d'unités ne sont publiés " +
      "dans la série que pour les municipalités, les régions immédiates, les régions intermédiaires et les États.",
    origens: "Principales origines",
    destinos: "Principales destinations",
    nenhumPar: (titulo: string) => `${titulo} : aucun couple publié.`,
    motivoSuprimido: "▒ masq.",
    motivoNaoExistia: "░ n'exist. pas",
    motivoNaoMedido: "non mesuré",
    motivoOutro: "—",
    postoTotal: (posto: string, total: string) => `${posto}${posto === "1" ? "er" : "e"} · ${total}`,
    foraDaLista: (n: number, nFmt: string) =>
      n > 1
        ? `${nFmt} autres partenaires ayant déjà figuré parmi les 10 premiers dans une édition n'apparaissent pas ici.`
        : `${nFmt} autre partenaire ayant déjà figuré parmi les 10 premiers dans une édition n'apparaît pas ici.`,
    mostrarPrimeiros: (n: number) => `N'afficher que les ${n} premiers`,
    mostrarTodos: "Tout afficher",
    notaPosto: (edicao: string) => ({
      antes: "",
      termo: "Rang",
      depois: ` et volume par édition, triés selon le rang en ${edicao} ` +
        "(l'édition cochée la plus récente), les ex æquo étant départagés par les éditions antérieures.",
    }),
  },

  bloco4: {
    titulo: "Partie 4 · Qui migre (arrivées)",
    carregando: "Chargement du profil…",
    tituloBarraDepois: ", par édition",
    semDado: "pas de donnée publiable",
    motivoVazio: {
      nao_existia: "n'existait pas dans cette édition",
      sem_cobertura: "sans couverture dans cette édition",
      cobertura_insuficiente: "couverture insuffisante dans cette édition",
      suprimido: "masqué (sous le seuil de diffusion)",
    },
  },

  mapa: {
    aria: "Carte comparative",
    naoPublicadoRM: "Carte comparative non publiée pour les régions métropolitaines à ce stade.",
    titulo: "Carte comparative, recensement par recensement",
    medida: "Indicateur :",
    carregarMunicipais: (n: number) => `Charger les cartes municipales des ${n} éditions cochées`,
    erro: (erro: string) => `Impossible de charger la carte comparative : ${erro}`,
    erroDesconhecido: "erreur inconnue",
    quebrasFixas: (lista: string, iem: boolean) =>
      `Seuils fixes (identiques dans toutes les éditions) : ${lista}${iem ? " (indice, pas %)" : " ‰"}.`,
    carregandoPainel: "chargement…",
    ariaPainel: (medida: string, edicao: string) => `Carte de l'indicateur ${g(medida)} en ${edicao}`,
    legendaAria: "Légende de la carte comparative",
    tramasAria: "Hachures diagonales : territoire non comparable. Croisées : masqué (secret statistique). Pointillés : non mesuré. Horizontales : indéterminé, échantillon trop petit pour classer.",
    tramaDiagonal: "non comparable (n'existait pas / couverture insuffisante)",
    tramaCruzada: "masqué (secret statistique)",
    tramaPontilhada: "non mesuré (le recensement ne posait pas la question)",
    tramaIndefinida: "indéterminé (échantillon trop petit pour classer)",
  },
};
