/** Os quatro dicionários têm o mesmo formato (o `tsc` já garante as chaves; aqui se confere em
 *  tempo de execução o que o tipo não vê): nenhum valor vazio, funções que não lançam com
 *  argumentos plausíveis, e nenhum texto em português esquecido num dicionário estrangeiro.
 *  Também os glossários: mesmas 37 chaves e os mesmos campos em todos os idiomas. */
import { describe, expect, it } from "vitest";
import { pt, type Dicionario } from "../pt";
import { en } from "../en";
import { fr } from "../fr";
import { es } from "../es";
import gPt from "../glossario/pt.json";
import gEn from "../glossario/en.json";
import gFr from "../glossario/fr.json";
import gEs from "../glossario/es.json";

const ESTRANGEIROS: [string, Dicionario][] = [["en", en], ["fr", fr], ["es", es]];

/** Folhas do dicionário como [caminho, valor]; funções são chamadas com argumentos de teste
 *  (strings, números e booleanos) para que o texto que produzem também seja conferido. */
function folhas(o: unknown, caminho = ""): [string, string][] {
  if (typeof o === "string") return [[caminho, o]];
  if (typeof o === "function") {
    const args = Array.from({ length: o.length }, (_, i) => (i % 2 ? 3 : "X"));
    let r: unknown;
    try { r = (o as (...a: unknown[]) => unknown)(...args); } catch { return []; }
    if (Array.isArray(r)) return r.filter((x) => typeof x === "string").map((x, i) => [`${caminho}()[${i}]`, x]);
    return folhas(r, `${caminho}()`);
  }
  if (o && typeof o === "object") {
    return Object.entries(o).flatMap(([k, v]) => folhas(v, caminho ? `${caminho}.${k}` : k));
  }
  return [];
}

// palavras que só existem em português (nem em en/fr/es) -- heurística de texto esquecido. As
// bordas são por letra Unicode: `\b` do JS trata "á" como não-letra, e "están" casaria "está".
// Nomes próprios ("São Paulo") e o título original do atlas, citado de propósito nas
// traduções, não contam.
const PALAVRAS_PT = /(?<!\p{L})(não|município|municípios|também|então|até|você|região|regiões|edição|edições|população|migração|saídas|deslocamento|observações|carregando)(?!\p{L})/iu;
const PERMITIDOS = [/São Paulo/g, /Atlas da migração interna no Brasil/g];
const semPermitidos = (v: string) => PERMITIDOS.reduce((t, re) => t.replace(re, ""), v);

describe("paridade dos dicionários", () => {
  const ptFolhas = new Map(folhas(pt));

  for (const [lang, d] of ESTRANGEIROS) {
    describe(lang, () => {
      const suas = folhas(d);

      it("não é o próprio dicionário português", () => {
        expect(d).not.toBe(pt);
      });

      it("nenhum texto vazio onde o português tem texto", () => {
        const vazios = suas.filter(([k, v]) => !v.trim() && (ptFolhas.get(k) ?? "").trim()).map(([k]) => k);
        expect(vazios).toEqual([]);
      });

      it("nenhum trecho em português esquecido", () => {
        const esquecidos = suas.filter(([, v]) => PALAVRAS_PT.test(semPermitidos(v))).map(([k, v]) => `${k}: ${v}`);
        expect(esquecidos).toEqual([]);
      });
    });
  }
});

describe("paridade dos glossários", () => {
  const ref = gPt as Record<string, Record<string, string>>;
  for (const [lang, g] of [["en", gEn], ["fr", gFr], ["es", gEs]] as const) {
    it(`${lang}: mesmas chaves, mesmos campos, nada vazio`, () => {
      const outro = g as Record<string, Record<string, string>>;
      expect(Object.keys(outro)).toEqual(Object.keys(ref));
      for (const [k, termo] of Object.entries(ref)) {
        expect(Object.keys(outro[k]).sort(), k).toEqual(Object.keys(termo).sort());
        for (const v of Object.values(outro[k])) expect(v.trim(), k).not.toBe("");
      }
    });
  }
});
