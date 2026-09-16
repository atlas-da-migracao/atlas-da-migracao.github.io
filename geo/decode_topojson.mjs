// Decodifica um TopoJSON (arcos+topologia) para GeoJSON (FeatureCollection de geometrias
// simples), usando a MESMA lib que o front-end usa em runtime (web/node_modules/topojson-client)
// -- para que a validação em pipeline/validate_geo.py veja exatamente a geometria que chega ao
// deck.gl, não uma reconstrução aproximada.
//
// Só opera sobre malha pública já publicada em data/processed/**/geo -- nenhum microdado.
//
// Uso: node geo/decode_topojson.mjs <entrada.topojson> <saida.geojson>
import fs from "node:fs";
import * as topojsonClient from "../web/node_modules/topojson-client/src/index.js";

const [, , entrada, saida] = process.argv;
const topo = JSON.parse(fs.readFileSync(entrada, "utf8"));
const nomeObjeto = Object.keys(topo.objects)[0];
const fc = topojsonClient.feature(topo, topo.objects[nomeObjeto]);
fs.writeFileSync(saida, JSON.stringify(fc));
