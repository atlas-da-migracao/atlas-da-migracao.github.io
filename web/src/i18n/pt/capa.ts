/** Textos do namespace `capa` (fonte: português): capa nacional, o painel sem seleção
 *  (src/components/CapaNacional.tsx). Trechos entre ** saem em negrito (components/TextoRico.tsx).
 *  Os dicionários en/fr/es têm o mesmo formato. */
export const capa = {
  aria: "Panorama nacional",
  titulo: "Atlas da migração interna",

  /** `nMun`: total de municípios já formatado, ou null enquanto não carregou */
  intro: (nMun: string | null, de: string, ate: string, censo: string, proxy: boolean) =>
    `Fluxos migratórios entre ${nMun ? `os ${nMun}` : "os"} municípios brasileiros no quinquênio ${de}–${ate}, ${
      proxy
        ? `a partir de um proxy de data fixa do Censo Demográfico ${censo} (ver aviso abaixo).`
        : `a partir do quesito de data fixa do Censo Demográfico ${censo}.`}`,

  /** número em destaque (`milhoes` já formatado) */
  numeroDestaque: (milhoes: string, de: string, ate: string) =>
    `${milhoes} milhões de pessoas mudaram de município entre ${de} e ${ate}`,

  /** linha de apoio (todos os valores já formatados) */
  apoio: (pares: string, semOrigem: string, exterior: string, pop5: string) =>
    `${pares} pares origem–destino publicados · ${semOrigem} chegadas com origem não informada · ${exterior} vindas do exterior · população de referência (5 anos ou mais): ${pop5}.`,

  padraoPredominante: "Padrão migratório predominante no país",
  padraoSufixo: ":",

  maioresFluxos: "Maiores fluxos do país",
  recorteRotulo: "Recorte:",
  recorteExplicacao: "— volume só desse subgrupo de migrantes.",

  achados: {
    titulo: "Três achados da pesquisa",
    /** `pctNucleo`, `pctDF`: números já formatados, sem o símbolo de porcentagem */
    nucleo: (pctNucleo: string, pctDF: string) =>
      `Entre quem saiu do núcleo metropolitano para a periferia, **${pctNucleo}%** seguem trabalhando no núcleo — na RIDE-DF, essa taxa chega a **${pctDF}%**.`,
    verRideDF: "Ver a RIDE-DF",
    superior: (pct: string) =>
      `Entre os migrantes de 25 anos ou mais do Rio de Janeiro para São Paulo, **${pct}%** têm superior completo — uma seletividade educacional acentuada.`,
    verFluxoRioSP: "Ver o fluxo Rio → São Paulo",
    pendular: (pessoas: string) =>
      `Guarulhos → São Paulo é o maior par pendular de trabalho do país: **${pessoas} pessoas** moram em Guarulhos e trabalham em São Paulo.`,
    verParPendular: "Ver o par pendular",
  },

  instrucao:
    "Clique em um município no mapa para ver seu saldo, os principais fluxos de entrada e de saída, e o perfil dos migrantes. Clique em um arco para detalhar um fluxo.",
};
