/** Camada de idioma do atlas (sem biblioteca de i18n).
 *
 *  - `useT()` devolve o dicionário ativo e faz o componente re-renderizar quando o idioma
 *    muda -- sem remontar a árvore (mapa, gráficos e consultas do DuckDB não reiniciam).
 *  - Funções puras de `lib/` recebem o dicionário como último parâmetro opcional
 *    (`d: Dicionario = pt`), para os testes continuarem valendo em português; quem chama de um
 *    componente passa o `d` de `useT()` (e o põe nas dependências de `useMemo`).
 *  - `t()` é o acesso não reativo, para código fora de componente que não recebe `d`.
 *  - Os dicionários en/fr/es são carregados sob demanda (`import()` dinâmico), fora do bundle
 *    inicial; o português vem sempre junto, porque é o padrão e o fallback.
 *
 *  O idioma em si mora na store (`state/store.ts`, `lang`), espelhado na URL (`?lang=`);
 *  `setLang` chama `aplicarIdioma`, que carrega o dicionário, ajusta a formatação de números
 *  (`lib/format.ts`) e o `<html lang>`. */
import { create } from "zustand";
import { pt, type Dicionario } from "./pt";
import { IDIOMA_PADRAO, type Lang } from "./tipos";
import { definirIdiomaNumeros } from "../lib/format";
import { carregarDados } from "./dados";

export type { Dicionario };
export { pt };
export * from "./tipos";

const CARREGADORES: Record<Exclude<Lang, "pt-BR">, () => Promise<Dicionario>> = {
  en: () => import("./en").then((m) => m.en),
  fr: () => import("./fr").then((m) => m.fr),
  es: () => import("./es").then((m) => m.es),
};

const useDicionario = create<{ lang: Lang; d: Dicionario }>(() => ({ lang: IDIOMA_PADRAO, d: pt }));

let atual: Dicionario = pt;
// trocas rápidas (PT -> EN -> FR antes de o EN chegar): só a última aplica
let pedido = 0;

export async function aplicarIdioma(lang: Lang): Promise<void> {
  const meu = ++pedido;
  const [d] = await Promise.all([
    lang === "pt-BR" ? pt : CARREGADORES[lang](),
    carregarDados(lang),
  ]);
  if (meu !== pedido) return;
  atual = d;
  definirIdiomaNumeros(lang, d.comum.separadorIntervalo);
  if (typeof document !== "undefined") document.documentElement.lang = lang;
  useDicionario.setState({ lang, d });
}

/* Hooks de verdade; o nome em português não casa com a regra do linter, mesmo caso de
   `usarModoEscuro` em state/store.ts. */
export function useT(): Dicionario {
  return useDicionario((s) => s.d);
}

/** Idioma cujo dicionário está efetivamente aplicado (pode atrasar um instante em relação a
 *  `useStore().lang` enquanto o arquivo do idioma novo carrega). */
export function useIdioma(): Lang {
  return useDicionario((s) => s.lang);
}

/** Dicionário ativo, sem assinatura -- para código fora de componente. */
export function t(): Dicionario {
  return atual;
}
