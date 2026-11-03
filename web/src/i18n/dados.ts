/** Tradução da prosa que vem dos DADOS publicados (`meta.json` de cada edição e
 *  `series/comparabilidade.json`): avisos, fonte, notas de UF, notas de comparabilidade.
 *
 *  O texto de referência continua sendo o do pipeline; `dados.json` guarda, por chave, o texto
 *  PT de `origem` e as traduções. A tradução só é usada se o texto que chegou nos dados for
 *  IDÊNTICO a `origem` -- se o pipeline mudar o texto e a tradução não acompanhar, o atlas
 *  mostra o português novo em vez de uma tradução velha (e `__tests__/dados.test.ts` acusa a
 *  divergência). Em português, devolve sempre o próprio dado.
 *
 *  O arquivo (~70 KB, os três idiomas) só é baixado quando um idioma diferente do português é
 *  aplicado (`carregarDados`, chamado por `aplicarIdioma`). O idioma ativo fica em estado de
 *  módulo, como os formatadores de `lib/format.ts`: quem chama de um componente já re-renderiza
 *  na troca de idioma porque assina o dicionário (`useT`). */
import type { Lang } from "./tipos";

export interface EntradaDado { origem: string; en: string; fr: string; es: string }

let tabela: Record<string, EntradaDado> | null = null;
let langAtual: Lang = "pt-BR";

export async function carregarDados(lang: Lang): Promise<void> {
  if (lang !== "pt-BR" && !tabela) {
    tabela = (await import("./dados.json")).default as Record<string, EntradaDado>;
  }
  langAtual = lang;
}

/** Só para testes: injeta a tabela e o idioma sem `import()` dinâmico. */
export function definirDadosParaTeste(t: Record<string, EntradaDado> | null, lang: Lang) {
  tabela = t;
  langAtual = lang;
}

/** Texto do dado no idioma ativo. `chave` segue o formato de `dados.json`
 *  (`aviso.2022`, `nota_uf.1980.17`, `notas.<chave>`…). null/undefined passam direto. */
export function textoDado<T extends string | null | undefined>(chave: string, origem: T): T | string {
  if (origem == null || langAtual === "pt-BR" || !tabela) return origem;
  const e = tabela[chave];
  return e && e.origem === origem ? e[langAtual] : origem;
}
