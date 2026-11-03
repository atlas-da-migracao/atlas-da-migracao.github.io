import type { Dicionario } from "../pt";

export const legenda: Dicionario["legenda"] = {
  chip: "Leyenda",
  minimizar: "Minimizar leyenda",

  titulos: {
    saldo: "Saldo migratorio (personas)",
    tlm: "Tasa neta de migración (por mil)",
    imig: "Inmigrantes (personas)",
    emig: "Emigrantes (personas)",
    iem: "Índice de eficacia migratoria (−1 a +1)",
  },

  espigas: {
    aria: "La longitud de la espiga crece con la raíz cuadrada del valor; muestras de referencia",
    ganho: "ganancia",
    perda: "pérdida",
    imigrantes: "inmigrantes",
    emigrantes: "emigrantes",
    valores: (lista: string) => `${lista} personas`,
    semAncora: "la longitud crece con la raíz cuadrada del valor",
  },

  fluxos: {
    descricao: "Flujos: la cinta se estrecha del origen al destino y termina en una flecha; un círculo marca cada extremo",
    espessuraAria: "El grosor de la cinta crece con la raíz cuadrada del volumen; muestras de referencia",
    espessuraSemAncoraAria: "El grosor de la cinta crece con el volumen, en raíz cuadrada",
    espessuraSemAncora: "el grosor crece con el volumen (raíz cuadrada)",
    espessuraValores: (lista: string) => `${lista} personas`,
    corte: (escopo: "pais" | "selecao", limite: string | null, menor: string) => {
      const quando = escopo === "selecao"
        ? `el mapa dibuja solo los mayores flujos de entrada y de salida del lugar seleccionado${
            limite ? ` (hasta ${limite} de cada lado)` : ""}`
        : `el mapa dibuja solo los ${limite ? `${limite} ` : ""}mayores flujos del país${
            limite ? " (el mismo número en todas las ediciones)" : ""}`;
      return `Corte: ${quando}. El menor flujo dibujado tiene **${menor}** personas: los pares por debajo de ese volumen existen en los datos y en el panel, pero no aparecen en el mapa.`;
    },
  },

  notaNivel: (nivel: string) =>
    `Nivel agregado (${nivel}): la migración entre municipios de una misma unidad no se contabiliza; los pares suprimidos quedan fuera de la suma; sin error estándar publicado.`,
};
