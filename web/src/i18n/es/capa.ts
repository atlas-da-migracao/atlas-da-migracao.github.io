import type { Dicionario } from "../pt";

const NB = " ";

export const capa: Dicionario["capa"] = {
  aria: "Panorama nacional",
  titulo: "Atlas de la migración interna",

  intro: (nMun: string | null, de: string, ate: string, censo: string, proxy: boolean) =>
    `Flujos migratorios entre ${nMun ? `los ${nMun}` : "los"} municipios brasileños en el quinquenio ${de}–${ate}, ${
      proxy
        ? `a partir de un proxy de fecha fija del Censo Demográfico ${censo} (ver el aviso más abajo).`
        : `a partir de la pregunta de fecha fija del Censo Demográfico ${censo}.`}`,

  numeroDestaque: (milhoes: string, de: string, ate: string) =>
    `${milhoes} millones de personas cambiaron de municipio entre ${de} y ${ate}`,

  apoio: (pares: string, semOrigem: string, exterior: string, pop5: string) =>
    `${pares} pares origen–destino publicados · ${semOrigem} llegadas con origen no declarado · ${exterior} llegadas desde el exterior · población de referencia (5 años o más): ${pop5}.`,

  padraoPredominante: "Patrón migratorio predominante en el país",
  padraoSufixo: ":",

  maioresFluxos: "Mayores flujos del país",
  recorteRotulo: "Filtro:",
  recorteExplicacao: "— volumen solo de este subgrupo de migrantes.",

  achados: {
    titulo: "Tres hallazgos de la investigación",
    nucleo: (pctNucleo: string, pctDF: string) =>
      `Entre quienes salieron del núcleo metropolitano hacia la periferia, el **${pctNucleo}${NB}%** sigue trabajando en el núcleo; en la RIDE-DF, esa proporción llega al **${pctDF}${NB}%**.`,
    verRideDF: "Ver la RIDE-DF",
    superior: (pct: string) =>
      `Entre los migrantes de 25 años o más de Rio de Janeiro a São Paulo, el **${pct}${NB}%** tiene educación superior completa: una selectividad educativa marcada.`,
    verFluxoRioSP: "Ver el flujo Rio → São Paulo",
    pendular: (pessoas: string) =>
      `Guarulhos → São Paulo es el mayor par pendular por trabajo del país: **${pessoas} personas** viven en Guarulhos y trabajan en São Paulo.`,
    verParPendular: "Ver el par pendular",
  },

  instrucao:
    "Haga clic en un municipio del mapa para ver su saldo, los principales flujos de entrada y de salida, y el perfil de los migrantes. Haga clic en un arco para ver el detalle de un flujo.",
};
