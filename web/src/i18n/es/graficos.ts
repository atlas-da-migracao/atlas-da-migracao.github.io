import type { Dicionario } from "../pt";

const NB = " ";
/** género gramatical del plural del nivel ("regiones inmediatas" f., "municipios"/"estados" m.) */
const femenino = (plural: string) => /^(regi|unidad|RM)/i.test(plural);

export const graficos: Dicionario["graficos"] = {
  acordes: {
    semDados: "No hay datos suficientes para la matriz de cuerdas.",
    ariaDiagrama: "Diagrama de cuerdas con los flujos migratorios entre las 27 unidades federativas; los mismos datos están en la tabla debajo del diagrama.",
    ariaCorda: (a: string, b: string, deAParaB: string, deBParaA: string) =>
      `${a} → ${b}: ${deAParaB} personas; ${b} → ${a}: ${deBParaA} personas`,
    ariaArco: (sigla: string, selecionada: boolean) =>
      `${sigla}: ${selecionada ? "deseleccionar" : "seleccionar"} en el mapa`,
    tituloArco: (sigla: string, emigrantes: string, imigrantes: string) =>
      `${sigla}: ${emigrantes} personas salieron hacia otros estados; ${imigrantes} llegaron de otros estados`,
    nota: "El ancho del arco de cada estado es proporcional al total de quienes salieron de él hacia otros estados; en cada extremo de una cuerda, el ancho es el flujo que sale de ese estado hacia el otro.",
    tabelaResumo: (limite: string | null) =>
      `Ver la tabla de los ${limite == null ? "" : `${limite} mayores `}flujos entre estados`,
    colOrigem: "Origen",
    colDestino: "Destino",
    colTotal: "Total",
    rodapeParcial: (limite: string, total: string, pct: string, restantes: string) =>
      `Se muestran los ${limite} mayores de ${total} pares publicados (${pct}${NB}% del total de migrantes entre estados); los otros ${restantes} no se listan, pero están en el diagrama.`,
    rodapeCompleto: (total: string) => `Los ${total} pares publicados.`,
  },

  plano: {
    titulo: <T>(mei: T, cmi: T): (string | T)[] => ["Plano ", mei, "×", cmi, ", con trayectoria entre censos"],
    eixoX: "CMI (%) →",
    eixoY: "↑ MEI agregado (%)",
    marcaN: (n: string) => `n = ${n}`,
    marcaAnmr: (k: string) => `ANMR ${k}`,
    trajetoria: (intervalo: string, cai: boolean, de: string, edDe: string, para: string, edPara: string) =>
      `Entre ${intervalo}, la trayectoria va hacia la ${cai ? "izquierda" : "derecha"}: la CMI ${cai ? "baja" : "sube"} de ${de}${NB}% (${edDe}) a ${para}${NB}% (${edPara}).`,
    nota: "La intensidad (CMI) también depende del número de unidades del nivel: una malla más fina eleva la CMI sin que el comportamiento cambie, de modo que parte de la diferencia entre ediciones puede deberse a la malla y no al comportamiento — ver la figura de Courgeau.",
  },

  fielding: {
    titulo: <T>(beta: T): (string | T)[] => ["Dispersión de Fielding (", beta, "), por edición"],
    semDado: "sin dato",
    leitura: {
      equilibrio: "equilibrio",
      concentracao: "concentración",
      desconcentracao: "desconcentración",
    },
    beta: (beta: string, ep: string) => `β = ${beta} ± ${ep}`,
    nota: (proxy1980: boolean) =>
      "Recta ajustada por MCO ponderados por población sobre las unidades existentes en cada edición." +
      (proxy1980 ? " En 1980, la tasa neta es un proxy." : ""),
  },

  courgeau: {
    titulo: <T>(cmi: T, nivelPlural: string): (string | T)[] => [
      "Figura de Courgeau — ", cmi,
      ` × número de unidades del nivel (${nivelPlural} destacad${femenino(nivelPlural) ? "as" : "os"})`,
    ],
    eixoX: "log10(n.º de unidades del nivel) →",
    eixoY: "↑ CMI (%)",
    carregando: "Cargando la figura…",
    erro: "No fue posible cargar los datos de esta figura.",
    semDados: "No hay datos de CMI por nivel para las ediciones marcadas.",
    nota: "Cuantas más unidades tiene la malla, mayor es la intensidad medida. La pendiente de cada línea es el tamaño de ese efecto en la edición.",
  },
};
