/** Fumaça das traduções da metodologia: 4 idiomas × 5 edições. Cada combinação tem de renderizar
 *  sem erro e com o MESMO número de <section> que o português -- as traduções seguem a mesma
 *  estrutura condicional por edição (pt.tsx é a referência). O conteúdo em português é conferido
 *  em metodologia.test.tsx.
 *
 *  en/fr/es são carregados com `React.lazy`: `renderToStaticMarkup` só devolveria o fallback do
 *  Suspense, então aqui a renderização é a de `prerender` (react-dom/static), que espera os
 *  módulos carregarem. O idioma é aplicado como no app, por `aplicarIdioma` (dicionário +
 *  locale dos números), no mesmo registro de módulos da página; como o zustand responde à
 *  renderização de servidor com o estado INICIAL (`getServerSnapshot`, sempre pt-BR), os hooks
 *  `useIdioma`/`useT` são trocados por `vi.doMock` pelo idioma recém-aplicado -- no navegador
 *  eles leem o estado corrente. */
import { createElement } from "react";
import { prerender } from "react-dom/static";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Censo } from "../../lib/edicoes";
import type { Lang } from "../../i18n/tipos";
import type { Meta } from "../../lib/types";
import { fakeMeta, prepararModulos } from "./apoio";

const CENSOS: Censo[] = ["1980", "1991", "2000", "2010", "2022"];
const IDIOMAS: Lang[] = ["pt-BR", "en", "fr", "es"];

/** Trecho da frase-modelo de TERMINOLOGIA.md, §4 -- prova que a tradução (e não o fallback do
 *  Suspense) foi renderizada. */
const AVISO_TRADUCAO: Record<Lang, string | null> = {
  "pt-BR": null,
  en: "This is a translation of the Portuguese original",
  fr: "Ceci est une traduction de l&#x27;original en portugais",
  es: "Esta es una traducción del original en portugués",
};

async function renderizar(lang: Lang, censo: Censo, meta: Meta | null): Promise<string> {
  prepararModulos(censo);
  vi.doMock("../../i18n", async (importOriginal) => {
    const real = await importOriginal<typeof import("../../i18n")>();
    await real.aplicarIdioma(lang);
    return { ...real, useIdioma: () => lang, useT: () => real.t() };
  });
  const { Metodologia } = await import("../metodologia");
  const erros: unknown[] = [];
  const { prelude } = await prerender(createElement(Metodologia, { meta }), {
    onError: (e) => { erros.push(e); },
  });
  const html = await new Response(prelude).text();
  expect(erros).toEqual([]);
  return html;
}

const contarSecoes = (html: string) => (html.match(/<section[\s>]/g) ?? []).length;

afterEach(() => vi.unstubAllGlobals());

describe("metodologia nos quatro idiomas", () => {
  for (const censo of CENSOS) {
    it(`${censo}: as quatro versões têm as mesmas seções (com e sem meta)`, async () => {
      for (const meta of [fakeMeta(censo), null]) {
        const referencia = contarSecoes(await renderizar("pt-BR", censo, meta));
        expect(referencia).toBeGreaterThan(5);
        for (const lang of IDIOMAS) {
          const html = await renderizar(lang, censo, meta);
          expect(contarSecoes(html), `${lang} × ${censo}`).toBe(referencia);
          const aviso = AVISO_TRADUCAO[lang];
          if (aviso) expect(html).toContain(aviso);
        }
      }
    });
  }

  it("meta de outra edição (troca de censo): todo idioma mostra só o \"carregando\"", async () => {
    for (const lang of IDIOMAS) {
      const html = await renderizar(lang, "2010", fakeMeta("2022"));
      expect(html).toContain('role="status"');
      expect(contarSecoes(html)).toBe(0);
      expect(html).not.toContain("10.5281/zenodo");
    }
  });

  it("datas e salário mínimo no formato de cada idioma, moeda da edição", async () => {
    const en = await renderizar("en", "2022", fakeMeta("2022"));
    expect(en).toContain("July 31, 2017");
    expect(en).toContain("R$\u00a01,212.00");
    const fr = await renderizar("fr", "1991", fakeMeta("1991"));
    expect(fr).toContain("01/09/1986");
    expect(fr).toContain("Cr$\u00a036\u202f161,60");
    const es = await renderizar("es", "2000", fakeMeta("2000"));
    expect(es).toContain("31/07/1995");
    expect(es).toContain("R$\u00a0151,00");
  });
});
