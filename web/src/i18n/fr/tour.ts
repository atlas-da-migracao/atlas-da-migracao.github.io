import type { Dicionario } from "../pt";

export const tour: Dicionario["tour"] = {
  passos: {
    mapa: {
      titulo: "La carte",
      texto: "Chaque municipalité est colorée selon l'indicateur choisi. Cliquez sur une municipalité pour voir " +
        "ses flux migratoires sous forme d'arcs ; cliquez sur un arc pour détailler ce couple.",
    },
    busca: {
      titulo: "Recherche",
      texto: "Tapez le nom d'une municipalité (ou, à d'autres niveaux, d'une région ou d'un État) pour y accéder directement.",
    },
    metrica: {
      titulo: "Indicateur de la carte",
      texto: "Alternez entre solde migratoire, taux net, entrants, sortants et efficacité migratoire : " +
        "la couleur de la carte change en conséquence.",
    },
    painel: {
      titulo: "Panneau de détails",
      texto: "Lorsque vous sélectionnez une municipalité ou un flux, ce panneau affiche les indicateurs, les " +
        "principaux flux et le profil des migrants.",
    },
    modoRm: {
      titulo: "Régions métropolitaines",
      texto: "Ce mode recentre la carte à l'intérieur d'une région métropolitaine : migration intra-RM et, " +
        "selon le recensement sélectionné, navettes domicile-travail et domicile-études.",
    },
    modoCensos: {
      titulo: "Au fil des recensements",
      texto: "Comparez un même territoire — municipalité, région immédiate, région intermédiaire, État ou " +
        "région métropolitaine — entre deux recensements ou plus (de 1980 à 2022). Recherchez le territoire, " +
        "cochez les recensements à comparer et consultez côte à côte les flux, les soldes, les indicateurs et " +
        "le profil des migrants, avec une carte comparative et l'évolution en graphiques.",
    },
  },
  contagem: (passo: number, total: number) => `Étape ${passo} sur ${total}`,
  pular: "Passer",
  voltar: "Retour",
  proximo: "Suivant",
  concluir: "Terminer",
};
