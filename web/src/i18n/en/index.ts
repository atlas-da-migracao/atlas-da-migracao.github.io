/** Dicionário em inglês: tradução do português (`../pt`, a referência), seguindo `../TERMINOLOGIA.md`.
 *  Carregado sob demanda por `aplicarIdioma` (i18n/index.ts). */
import type { Dicionario } from "../pt";
import { comum } from "./comum";
import { app } from "./app";
import { controles } from "./controles";
import { avisos } from "./avisos";
import { tour } from "./tour";
import { legenda } from "./legenda";
import { capa } from "./capa";
import { mapa } from "./mapa";
import { paineis } from "./paineis";
import { rm } from "./rm";
import { graficos } from "./graficos";
import { serie } from "./serie";
import glossarioen from "../glossario/en.json";

export const en: Dicionario = {
  comum, app, controles, avisos, tour, legenda, capa, mapa, paineis, rm, graficos, serie,
  glossario: glossarioen as Dicionario["glossario"],
};
