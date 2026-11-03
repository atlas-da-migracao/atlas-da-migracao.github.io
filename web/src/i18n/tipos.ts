/** Idiomas do atlas. O português é o padrão e o texto de referência: os outros três são
 *  traduções dele (ver `i18n/TERMINOLOGIA.md`). Sem dependência de React nem de `window`,
 *  para poder ser importado por `state/url.ts` e pelos testes em vitest `node`. */

export const IDIOMAS = ["pt-BR", "en", "fr", "es"] as const;
export type Lang = (typeof IDIOMAS)[number];
export const IDIOMA_PADRAO: Lang = "pt-BR";

/** Locale do `Intl` para números em cada idioma. O espanhol usa `es-ES` com agrupamento
 *  forçado (ver `lib/format.ts`): sem ele, "1234" sairia sem separador de milhar. */
export const LOCALE_NUMEROS: Record<Lang, string> = {
  "pt-BR": "pt-BR", en: "en-US", fr: "fr-FR", es: "es-ES",
};

/** Rótulo do seletor de idioma: sigla no botão, nome no próprio idioma no `title`/`aria-label`. */
export const ROTULO_IDIOMA: Record<Lang, { curto: string; nome: string }> = {
  "pt-BR": { curto: "PT", nome: "Português" },
  en: { curto: "EN", nome: "English" },
  fr: { curto: "FR", nome: "Français" },
  es: { curto: "ES", nome: "Español" },
};

/** `?lang=` validado contra a whitelist; aceita também "pt" como sinônimo de "pt-BR".
 *  null quando ausente ou inválido (quem chama decide o fallback). */
export function lerLang(s: string | null | undefined): Lang | null {
  if (!s) return null;
  if (s === "pt") return "pt-BR";
  return (IDIOMAS as readonly string[]).includes(s) ? (s as Lang) : null;
}

/** Primeiro idioma suportado na lista do navegador ("en-GB" -> "en", "pt-PT" -> "pt-BR"). */
export function langDoNavegador(preferidos: readonly string[]): Lang | null {
  for (const p of preferidos) {
    const base = p.toLowerCase().split("-")[0];
    const lang = lerLang(base);
    if (lang) return lang;
  }
  return null;
}
