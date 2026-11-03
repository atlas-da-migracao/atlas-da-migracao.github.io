/** Textos do namespace `legenda` (fonte: português): legenda do mapa (src/components/Legenda.tsx).
 *  As faixas de cor da legenda divergente estão em `comum.faixasLegenda`.
 *  Os dicionários en/fr/es têm o mesmo formato. */
export const legenda = {
  chip: "Legenda",
  minimizar: "Minimizar legenda",

  /** título por métrica */
  titulos: {
    saldo: "Saldo migratório (pessoas)",
    tlm: "Taxa líquida de migração (por mil)",
    imig: "Imigrantes (pessoas)",
    emig: "Emigrantes (pessoas)",
    iem: "Índice de eficácia migratória (−1 a +1)",
  },

  espigas: {
    aria: "Comprimento da espiga cresce com a raiz quadrada do valor; amostras de referência",
    ganho: "ganho",
    perda: "perda",
    imigrantes: "imigrantes",
    emigrantes: "emigrantes",
    /** amostras de referência, já formatadas e separadas por " · " */
    valores: (lista: string) => `${lista} pessoas`,
    semAncora: "comprimento cresce com a raiz quadrada do valor",
  },

  fluxos: {
    descricao: "Fluxos: fita afunila da origem ao destino, termina em seta; um círculo marca cada ponta",
    espessuraAria: "Espessura da fita cresce com a raiz quadrada do volume; amostras de referência",
    espessuraSemAncoraAria: "Espessura da fita cresce com o volume, na raiz quadrada",
    espessuraSemAncora: "espessura cresce com o volume (raiz quadrada)",
    /** amostras de referência de espessura, já formatadas e separadas por " · " */
    espessuraValores: (lista: string) => `${lista} pessoas`,
    /** nota do corte da camada de fluxos; o menor volume entre ** vai em negrito.
     *  `escopo`: "selecao" (entrada e saída do lugar selecionado) ou "pais"; `limite` já formatado ou null */
    corte: (escopo: "pais" | "selecao", limite: string | null, menor: string) => {
      const quando = escopo === "selecao"
        ? `o mapa desenha só os maiores fluxos de entrada e de saída do lugar selecionado${
            limite ? ` (até ${limite} de cada lado)` : ""}`
        : `o mapa desenha só os ${limite ? `${limite} ` : ""}maiores fluxos do país${
            limite ? " (o mesmo número em todas as edições)" : ""}`;
      return `Corte: ${quando}. O menor fluxo desenhado tem **${menor}** pessoas: pares abaixo desse volume existem nos dados e no painel, mas não aparecem no mapa.`;
    },
  },

  /** nota do nível agregado; `nivel` = rótulo curto do nível ("Reg. imediata") */
  notaNivel: (nivel: string) =>
    `Nível agregado (${nivel}): migração entre municípios da mesma unidade não é contabilizada; pares suprimidos ficam fora da soma; sem erro-padrão publicado.`,
};
