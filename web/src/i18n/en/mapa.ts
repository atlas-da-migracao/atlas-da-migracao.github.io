/** `mapa` namespace (English): accessible labels and the deck.gl tooltip of `map/MapaAtlas.tsx`.
 *  Same shape as `pt/mapa.ts`; the raw `n` decides singular/plural. */
import type { Dicionario } from "../pt";

const pessoas = (n: number) => (Math.abs(n) === 1 ? "person" : "people");

export const mapa: Dicionario["mapa"] = {
  reenquadrarPadrao: "Zoom to Brazil",
  ariaPadrao: "Choropleth map of Brazil with migration flow arcs",
  paragrafoLeitor: (descricao: string) =>
    `${descricao} The same data appear as tables in the side panel `
    + "(indicators and top origin and destination flows). Use the search box in the header to "
    + "select a municipality or unit with the keyboard.",

  semDados: "no data",
  metricaTlm: (valor: string) => `${valor} per 1,000 population`,
  metricaSaldo: (valor: string, n: number) => `net migration ${valor} ${pessoas(n)}`,
  metricaImig: (valor: string, n: number) => `${valor} ${Math.abs(n) === 1 ? "in-migrant" : "in-migrants"}`,
  metricaEmig: (valor: string, n: number) => `${valor} ${Math.abs(n) === 1 ? "out-migrant" : "out-migrants"}`,
  metricaIem: (valor: string) => `effectiveness ${valor}`,
  precisaoImigracao: (rotulo: string) => `in-migration precision: ${rotulo}`,
  fluxoClique: (valor: string, n: number) => `${valor} ${pessoas(n)} · click to see the profile`,
  precisaoFluxo: (rotulo: string) => `precision: ${rotulo}`,
};
