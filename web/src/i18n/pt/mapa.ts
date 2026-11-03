/** Textos do namespace `mapa` (fonte: português). Os dicionários en/fr/es têm o mesmo formato.
 *  Cobre `map/MapaAtlas.tsx`: rótulos acessíveis e a dica flutuante (tooltip do deck.gl).
 *  Os argumentos numéricos chegam já formatados (`num`, `sinal`...); o `n` cru que acompanha
 *  algumas frases serve só para o plural nos outros idiomas (em português a frase é a mesma). */
export const mapa = {
  /** rótulo do botão de reenquadrar quando o chamador não passa um */
  reenquadrarPadrao: "Ver o Brasil",
  /** aria-label do contêiner do mapa quando não há descrição específica da vista */
  ariaPadrao: "Mapa coroplético do Brasil com arcos de fluxo migratório",
  /** parágrafo só para leitor de tela: descrição da vista + onde estão os mesmos dados em texto */
  paragrafoLeitor: (descricao: string) =>
    `${descricao} Os mesmos dados aparecem, em forma de tabela, no painel ao lado `
    + "(indicadores e principais fluxos de origem e destino). Use a busca do cabeçalho para "
    + "selecionar um município ou unidade pelo teclado.",

  /** dica flutuante: frase da métrica ativa */
  semDados: "sem dados",
  metricaTlm: (valor: string) => `${valor} por mil habitantes`,
  metricaSaldo: (valor: string, n: number) => `saldo ${valor} ${Math.abs(n) === 1 ? "pessoa" : "pessoas"}`,
  metricaImig: (valor: string, n: number) => `${valor} ${n === 1 ? "imigrante" : "imigrantes"}`,
  metricaEmig: (valor: string, n: number) => `${valor} ${n === 1 ? "emigrante" : "emigrantes"}`,
  metricaIem: (valor: string) => `eficácia ${valor}`,
  /** linha de precisão sob a dica de uma unidade (precisão da estimativa de imigração) */
  precisaoImigracao: (rotulo: string) => `precisão da imigração: ${rotulo}`,
  /** dica de um fluxo */
  fluxoClique: (valor: string, n: number) => `${valor} ${n === 1 ? "pessoa" : "pessoas"} · clique para ver o perfil`,
  precisaoFluxo: (rotulo: string) => `precisão: ${rotulo}`,
};
