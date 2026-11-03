/** Textos do namespace `tour` (fonte: português): tour de boas-vindas (src/components/Tour.tsx).
 *  As chaves de `passos` são as do próprio passo (o alvo CSS fica no componente).
 *  Os dicionários en/fr/es têm o mesmo formato. */
export const tour = {
  passos: {
    mapa: {
      titulo: "O mapa",
      texto: "Cada município é colorido pela métrica escolhida. Clique num município para ver seus " +
        "fluxos migratórios como arcos; clique num arco para detalhar aquele par.",
    },
    busca: {
      titulo: "Busca",
      texto: "Digite o nome de um município (ou, em outros níveis, de uma região ou UF) para ir direto a ele.",
    },
    metrica: {
      titulo: "Métrica do mapa",
      texto: "Alterne entre saldo migratório, taxa líquida, imigrantes, emigrantes e eficácia migratória: " +
        "a cor do mapa muda de acordo.",
    },
    painel: {
      titulo: "Painel de detalhes",
      texto: "Ao selecionar um município ou um fluxo, este painel mostra os indicadores, os principais " +
        "fluxos e o perfil dos migrantes.",
    },
    modoRm: {
      titulo: "Regiões metropolitanas",
      texto: "Este modo troca o recorte para dentro de uma região metropolitana: migração intra-RM e, " +
        "conforme o censo selecionado, deslocamento pendular de trabalho e estudo.",
    },
    modoCensos: {
      titulo: "Ao longo dos censos",
      texto: "Compare um mesmo território — município, região imediata, região intermediária, UF ou " +
        "região metropolitana — entre dois ou mais censos (1980 a 2022). Busque o território, marque " +
        "os censos que quer comparar e veja fluxos, saldos, medidas e o perfil dos migrantes lado a " +
        "lado, com um mapa comparativo e a evolução em gráficos.",
    },
  },
  contagem: (passo: number, total: number) => `Passo ${passo} de ${total}`,
  pular: "Pular",
  voltar: "Voltar",
  proximo: "Próximo",
  concluir: "Concluir",
};
