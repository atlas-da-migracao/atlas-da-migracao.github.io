import type { Dicionario } from "../pt";

const BASE = "Atlas des migrations internes";

export const app: Dicionario["app"] = {
  titulo: "Atlas des migrations internes au Brésil",
  pularConteudo: "Aller au contenu",

  tituloAba: {
    base: BASE,
    censos: "Au fil des recensements — Atlas des migrations internes au Brésil",
    comNome: (nome: string) => `${nome} — ${BASE}`,
    fluxo: (origem: string, destino: string) => `${origem} → ${destino} — ${BASE}`,
  },

  cabecalho: {
    subtituloCensos: "Au fil des recensements, 1980–2022",
    edicaoCenso: "Édition du recensement",
    metodologia: "Méthodologie",
    comoUsar: "Mode d'emploi",
    mudarParaClaro: "Passer au thème clair",
    mudarParaEscuro: "Passer au thème sombre",
  },

  barra: {
    modoENivel: "Mode et niveau de la carte",
    modoAtlas: "Mode de l'atlas",
    brasil: "Brésil",
    regioesMetropolitanas: "Régions métropolitaines",
    aoLongoDosCensos: "Au fil des recensements",
    nivelAgregacao: "Niveau d'agrégation",
    filtros: (ativo: boolean) => `Filtres${ativo ? " •" : ""}`,
    filtrosDoMapa: "Filtres de la carte",
    fechar: "Fermer",
    metricaDoMapa: "Indicateur de la carte",
  },

  placeholderBusca: {
    mun: "Rechercher une municipalité…",
    rgi: "Rechercher une région immédiate…",
    rgint: "Rechercher une région intermédiaire…",
    uf: "Rechercher un État…",
  },

  metricas: {
    saldo: "Solde",
    tlm: "Taux net",
    imig: "Entrants",
    emig: "Sortants",
    iem: "Efficacité",
  },

  avisoNivelRecorte: "La ventilation par caractéristique n'existe qu'au niveau municipal ; elle a été réinitialisée lors du changement de niveau.",

  verFluxo: "Voir le flux",
  verBrasil: "Voir le Brésil",

  descricaoMapa: {
    rm: "Carte de la région métropolitaine sélectionnée, avec le centre et la périphérie mis en évidence.",
    nacional: (nivel: string, metrica: string) =>
      `Carte choroplèthe du Brésil (niveau : ${nivel}), colorée selon l'indicateur « ${metrica} », avec des arcs indiquant les principaux flux migratoires.`,
  },

  legendaRM: {
    migTitulo: "Migration à l'intérieur de la région métropolitaine",
    migNota: "La couleur indique la position des deux extrémités dans la RM (centre ou périphérie) ; le sens se lit à la forme.",
    pendularTitulo: (trabalho: boolean) => `Navettes domicile-${trabalho ? "travail" : "études"}`,
    pendularCategoria: (trabalho: boolean) => `Résidence → ${trabalho ? "travail" : "études"}`,
    pendularNota: (cruzar: boolean) => cruzar
      ? "Couleur unique : tout flux va de la résidence à la destination. Les flux estompés franchissent la limite de la RM."
      : "Couleur unique : tout flux va de la résidence à la destination.",
  },

  semDado: "pas de donnée",
  semDadoRecorte: "pas de donnée publiée pour cette ventilation",

  mapa: {
    fluxos: (ligado: boolean) => (ligado ? "Flux : activés" : "Flux : désactivés"),
    satelite: (ligado: boolean) => (ligado ? "Satellite : activé" : "Satellite : désactivé"),
    tamanhoMinimoFluxo: "Taille minimale du flux",
    corteAria: (corte: string, visiveis: string, total: string) =>
      `à partir de ${corte} personnes, ${visiveis} flux sur ${total}`,
    corteVisivel: (corte: string, visiveis: string, total: string) =>
      `à partir de **${corte}** personnes · ${visiveis} flux sur ${total}`,
    atribuicaoSatelite: "Image satellite : NASA Visible Earth, Blue Marble.",
  },

  erros: {
    malha: (detalhe: string) => `Échec du chargement du maillage : ${detalhe}`,
    malhaNivel: (nivel: string, detalhe: string) => `Échec du chargement du maillage (${nivel}) : ${detalhe}`,
    unidades: (nivel: string, detalhe: string) => `Échec de la requête sur les unités (${nivel}) : ${detalhe}`,
    meta: (detalhe: string) => `Échec du chargement des métadonnées : ${detalhe}`,
    municipios: (detalhe: string) => `Échec de la requête sur les données : ${detalhe}`,
    rm: (detalhe: string) => `Échec du chargement de la RM : ${detalhe}`,
    fluxosRM: (detalhe: string) => `Échec de la requête sur les flux de la RM : ${detalhe}`,
    fluxosNivel: (nivel: string, detalhe: string) => `Échec de la requête sur les flux (${nivel}) : ${detalhe}`,
    maioresFluxos: (detalhe: string) => `Échec de la requête sur les principaux flux : ${detalhe}`,
    fluxos: (detalhe: string) => `Échec de la requête sur les flux : ${detalhe}`,
    recorte: (detalhe: string) => `Échec de l'application de la ventilation : ${detalhe}`,
    tentarDeNovo: "réessayer",
  },

  rodape: {
    dadosDe: (versao: string) => `Données de la version ${versao}.`,
    dadosCensos: "Données des recensements démographiques 1980–2022.",
    metodologia: "Méthodologie",
    comoCitar: "Comment citer :",
    orcid: "ORCID",
    citacaoAtlas: (censo: string) =>
      `Atlas da migração interna no Brasil [Atlas des migrations internes au Brésil]. Données du Recensement démographique ${censo} (IBGE).`,
    doi: "DOI :",
  },
};
