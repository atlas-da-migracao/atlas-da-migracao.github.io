import type { Dicionario } from "../pt";

export const tour: Dicionario["tour"] = {
  passos: {
    mapa: {
      titulo: "El mapa",
      texto: "Cada municipio se colorea según la métrica elegida. Haga clic en un municipio para ver sus " +
        "flujos migratorios como arcos; haga clic en un arco para ver el detalle de ese par.",
    },
    busca: {
      titulo: "Búsqueda",
      texto: "Escriba el nombre de un municipio (o, en otros niveles, de una región o estado) para ir directo a él.",
    },
    metrica: {
      titulo: "Métrica del mapa",
      texto: "Alterne entre saldo migratorio, tasa neta, inmigrantes, emigrantes y eficacia migratoria: " +
        "el color del mapa cambia en consecuencia.",
    },
    painel: {
      titulo: "Panel de detalles",
      texto: "Al seleccionar un municipio o un flujo, este panel muestra los indicadores, los principales " +
        "flujos y el perfil de los migrantes.",
    },
    modoRm: {
      titulo: "Regiones metropolitanas",
      texto: "Este modo cambia la delimitación al interior de una región metropolitana: migración intra-RM y, " +
        "según el censo seleccionado, movilidad pendular por trabajo y estudio.",
    },
    modoCensos: {
      titulo: "A lo largo de los censos",
      texto: "Compare un mismo territorio —municipio, región inmediata, región intermedia, estado o " +
        "región metropolitana— entre dos o más censos (1980 a 2022). Busque el territorio, marque " +
        "los censos que quiere comparar y vea flujos, saldos, medidas y el perfil de los migrantes lado a " +
        "lado, con un mapa comparativo y la evolución en gráficos.",
    },
  },
  contagem: (passo: number, total: number) => `Paso ${passo} de ${total}`,
  pular: "Omitir",
  voltar: "Atrás",
  proximo: "Siguiente",
  concluir: "Finalizar",
};
