// F9.10: triangula cada feição de um GeoJSON (FeatureCollection de Polygon/MultiPolygon) com
// o MESMO earcut que o deck.gl usa em produção (web/node_modules/earcut) e reporta, por
// feição, se algum triângulo tem o centroide fora do polígono, e o desvio entre a soma das
// áreas dos triângulos e a área do polígono (anel externo menos buracos, shoelace).
//
// Não é dado de microdados -- só opera sobre malha pública (TopoJSON já decodificado para
// GeoJSON por quem chama este script). Usado por pipeline/validate_geo.py.
//
// Uso: node geo/validate_earcut.mjs <entrada.geojson>
// Saída: JSON na stdout, uma lista de { id, campo_id, nome, desvio_area, fora_do_poligono }
// -- só as feições com problema (desvio_area > 0.001 ou fora_do_poligono > 0).
import fs from "node:fs";
import earcut from "../web/node_modules/earcut/src/earcut.js";

const CAMPOS_ID = ["CD_MUN", "cd_uf", "cd_rgi", "cd_rgint"];
const CAMPOS_NOME = ["NM_MUN", "uf_sigla", "nm_rgi", "nm_rgint"];

function areaAnel(anel) {
  let a = 0;
  for (let i = 0, n = anel.length - 1; i < n; i++) {
    a += anel[i][0] * anel[i + 1][1] - anel[i + 1][0] * anel[i][1];
  }
  return a / 2;
}

// Ponto-em-polígono (ray casting), considerando buracos: dentro do anel externo E fora de
// todo buraco.
function pontoNoAnel(pt, anel) {
  let dentro = false;
  for (let i = 0, j = anel.length - 1; i < anel.length; j = i++) {
    const xi = anel[i][0], yi = anel[i][1];
    const xj = anel[j][0], yj = anel[j][1];
    const intersecta = yi > pt[1] !== yj > pt[1] &&
      pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi;
    if (intersecta) dentro = !dentro;
  }
  return dentro;
}

function pontoNoPoligono(pt, poligono) {
  if (!pontoNoAnel(pt, poligono[0])) return false;
  for (let h = 1; h < poligono.length; h++) {
    if (pontoNoAnel(pt, poligono[h])) return false;
  }
  return true;
}

// Triângulos com área abaixo desta fração da área total do polígono são ruído de ponto
// flutuante do próprio earcut (vértices quase coincidentes, tipicamente numa costura de
// -dissolve) -- invisíveis em qualquer zoom e não a "faixa/triângulo cortando o mapa" que
// esta checagem existe para pegar. Achado por inspeção: o falso positivo mais comum tem
// fração ~1e-18; um triângulo espúrio real (ver docstring de pipeline/gridsplit_geom.py)
// cobre uma fração substancial (>50%) da área. 1e-6 dá bastante margem entre os dois.
const FRACAO_MINIMA_TRIANGULO = 1e-6;

function checaFeicao(feature) {
  const geom = feature.geometry;
  if (!geom) return null;
  const poligonos = geom.type === "Polygon" ? [geom.coordinates]
    : geom.type === "MultiPolygon" ? geom.coordinates : [];
  let areaPoligono = 0;
  const triangulos = [];
  for (const poligono of poligonos) {
    const externo = Math.abs(areaAnel(poligono[0]));
    const buracos = poligono.slice(1).reduce((s, h) => s + Math.abs(areaAnel(h)), 0);
    areaPoligono += externo - buracos;

    const flat = earcut.flatten(poligono);
    const idx = earcut(flat.vertices, flat.holes, flat.dimensions);
    const v = flat.vertices;
    for (let i = 0; i < idx.length; i += 3) {
      const a = idx[i] * 2, b = idx[i + 1] * 2, c = idx[i + 2] * 2;
      const tArea = Math.abs((v[b] - v[a]) * (v[c + 1] - v[a + 1]) - (v[c] - v[a]) * (v[b + 1] - v[a + 1])) / 2;
      const centroide = [(v[a] + v[b] + v[c]) / 3, (v[a + 1] + v[b + 1] + v[c + 1]) / 3];
      triangulos.push({ tArea, dentro: pontoNoPoligono(centroide, poligono) });
    }
  }
  const areaTriangulos = triangulos.reduce((s, t) => s + t.tArea, 0);
  const foraDoPoligono = triangulos.filter(
    (t) => !t.dentro && (areaPoligono <= 0 || t.tArea / areaPoligono > FRACAO_MINIMA_TRIANGULO)
  ).length;
  const desvio = areaPoligono > 0 ? Math.abs(areaTriangulos - areaPoligono) / areaPoligono : 0;
  return { desvio, foraDoPoligono };
}

function main() {
  const [, , entrada] = process.argv;
  const fc = JSON.parse(fs.readFileSync(entrada, "utf8"));
  const problemas = [];
  for (const f of fc.features) {
    const r = checaFeicao(f);
    if (!r) continue;
    if (r.desvio > 0.001 || r.foraDoPoligono > 0) {
      const props = f.properties || {};
      const campoId = CAMPOS_ID.find((c) => c in props);
      const campoNome = CAMPOS_NOME.find((c) => c in props);
      problemas.push({
        id: campoId ? props[campoId] : null,
        nome: campoNome ? props[campoNome] : null,
        desvio_area: +r.desvio.toFixed(5),
        fora_do_poligono: r.foraDoPoligono,
      });
    }
  }
  process.stdout.write(JSON.stringify(problemas));
}

main();
