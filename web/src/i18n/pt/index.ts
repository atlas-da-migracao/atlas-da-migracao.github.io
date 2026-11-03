/** Dicionário de referência (português). Cada namespace corresponde a uma área da interface;
 *  `Dicionario` é o formato que en/fr/es precisam repetir chave a chave (o `tsc` acusa a falta). */
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
import glossarioPt from "../glossario/pt.json";
import type { ChaveGlossario, TermoGlossario } from "../../lib/glossario";

/** Glossário (37 termos): o texto mora em `i18n/glossario/<lang>.json`, que o gerador de SEO também lê. */
const glossario = glossarioPt as Record<ChaveGlossario, TermoGlossario>;

export const pt = { comum, app, controles, avisos, tour, legenda, capa, mapa, paineis, rm, graficos, serie, glossario };

/** O formato que en/fr/es repetem. Amplia os literais inferidos do português para `string`:
 *  sem isto, `(on) => on ? "Fluxos: ligados" : "Fluxos: desligados"` teria como retorno a união
 *  dos dois literais, e nenhuma tradução caberia. Funções genéricas que devolvem pedaços
 *  (`<T>(slot: T) => (string | T)[]`) passam intactas: só as que devolvem texto são ampliadas. */
type Ampliar<T> =
  T extends string ? string
  : T extends (...a: infer A) => string ? (...a: A) => string
  : T extends (...a: never[]) => unknown ? T
  : T extends readonly (infer E)[] ? readonly Ampliar<E>[]
  : T extends object ? { [K in keyof T]: Ampliar<T[K]> }
  : T;
export type Dicionario = Ampliar<typeof pt>;
