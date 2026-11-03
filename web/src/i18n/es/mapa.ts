import type { Dicionario } from "../pt";

const personas = (n: number) => (Math.abs(n) === 1 ? "persona" : "personas");

export const mapa: Dicionario["mapa"] = {
  reenquadrarPadrao: "Ver Brasil",
  ariaPadrao: "Mapa coroplético de Brasil con arcos de flujos migratorios",
  paragrafoLeitor: (descricao: string) =>
    `${descricao} Los mismos datos aparecen, en forma de tabla, en el panel lateral `
    + "(indicadores y principales flujos de origen y destino). Use la búsqueda del encabezado para "
    + "seleccionar un municipio o una unidad con el teclado.",

  semDados: "sin datos",
  metricaTlm: (valor: string) => `${valor} por cada mil habitantes`,
  metricaSaldo: (valor: string, n: number) => `saldo ${valor} ${personas(n)}`,
  metricaImig: (valor: string, n: number) => `${valor} ${Math.abs(n) === 1 ? "inmigrante" : "inmigrantes"}`,
  metricaEmig: (valor: string, n: number) => `${valor} ${Math.abs(n) === 1 ? "emigrante" : "emigrantes"}`,
  metricaIem: (valor: string) => `eficacia ${valor}`,
  precisaoImigracao: (rotulo: string) => `precisión de la inmigración: ${rotulo}`,
  fluxoClique: (valor: string, n: number) => `${valor} ${personas(n)} · haga clic para ver el perfil`,
  precisaoFluxo: (rotulo: string) => `precisión: ${rotulo}`,
};
