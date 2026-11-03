import { LOCALE_NUMEROS, type Lang } from "../i18n/tipos";
import { pt, type Dicionario } from "../i18n/pt";

/** Formatadores do idioma ativo. Começam em português (o padrão, e o que os testes esperam);
 *  `definirIdiomaNumeros` -- chamado por `aplicarIdioma` (i18n/index.ts) a cada troca de
 *  idioma -- troca o locale de todos de uma vez. Estado de módulo em vez de um parâmetro em
 *  cada chamada porque `num`/`sinal`/`ic95` são usados em dezenas de pontos; os componentes
 *  re-renderizam na troca porque assinam o dicionário (`useT`). */
function criar(locale: string) {
  // es-ES não agrupa números de 4 dígitos por padrão ("1234"): força o separador
  const g = { useGrouping: "always" as const };
  return {
    nf0: new Intl.NumberFormat(locale, { ...g, maximumFractionDigits: 0 }),
    nfAte1: new Intl.NumberFormat(locale, { ...g, maximumFractionDigits: 1 }),
    nf1: new Intl.NumberFormat(locale, { ...g, minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    nf2: new Intl.NumberFormat(locale, { ...g, minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  };
}
let { nf0, nfAte1, nf1, nf2 } = criar("pt-BR");
let localeAtual = "pt-BR";
let separadorIntervalo = "a";

export function definirIdiomaNumeros(lang: Lang, separador: string) {
  localeAtual = LOCALE_NUMEROS[lang];
  ({ nf0, nfAte1, nf1, nf2 } = criar(localeAtual));
  separadorIntervalo = separador;
}

/** Locale do `Intl` ativo -- para quem precisa de um formatador próprio (eixos do Plot,
 *  moeda, datas) sem duplicar a escolha do locale. */
export const localeNumeros = () => localeAtual;

export const num = (v: number | null | undefined) => (v == null ? "—" : nf0.format(v));
/** Até 1 casa decimal, sem zero à direita ("10", "92,2") -- rótulos de faixa de legenda. */
export const numAte1 = (v: number | null | undefined) => (v == null ? "—" : nfAte1.format(v));
export const num1 = (v: number | null | undefined) => (v == null ? "—" : nf1.format(v));
export const num2 = (v: number | null | undefined) => (v == null ? "—" : nf2.format(v));

/** Número inteiro com sinal explícito ("+1.234", "−1.234"), com o sinal tipográfico (U+2212).
 *  O sinal é decidido DEPOIS de arredondar: um valor que aparece como "0" não leva "+" nem "−"
 *  (antes, −0,4 saía como "−0"). Arredonda a metade para longe do zero, como o `Intl`. */
export const sinal = (v: number | null | undefined) => {
  if (v == null || !Number.isFinite(v)) return "—";
  const abs = Math.round(Math.abs(v));
  return (abs === 0 ? "" : v > 0 ? "+" : "−") + nf0.format(abs);
};

/** Como `sinal`, mas com 1 casa decimal -- para TAXAS (TLM em ‰, IEM em %), cujos valores
 *  típicos ficam entre −10 e +10, onde o arredondamento para inteiro apaga a informação
 *  ("+0"/"−0" para quase todo o mapa). O sinal também é decidido depois de arredondar:
 *  −0,04 vira "0,0", sem sinal. */
export const sinal1 = (v: number | null | undefined) => {
  if (v == null || !Number.isFinite(v)) return "—";
  const txt = nf1.format(Math.abs(v));
  return (txt === nf1.format(0) ? "" : v > 0 ? "+" : "−") + txt;
};

/** Como `sinal1`, com 2 casas -- para índices na escala −1 a +1 (IEM): "+0,43", "−0,25". */
export const sinal2 = (v: number | null | undefined) => {
  if (v == null || !Number.isFinite(v)) return "—";
  const txt = nf2.format(Math.abs(v));
  return (txt === nf2.format(0) ? "" : v > 0 ? "+" : "−") + txt;
};

/** Inteiro com o sinal tipográfico (U+2212) em vez do hífen do `Intl`. */
const inteiroTipografico = (v: number) => (v < 0 ? "−" + nf0.format(-v) : nf0.format(v));

/** Intervalo de confiança de 95% a partir do erro-padrão.
 *
 *  `contagem` (padrão `true`): o valor é uma CONTAGEM de pessoas (imigrantes, emigrantes,
 *  migrantes de um fluxo), que não pode ser negativa -- com erro-padrão grande, o limite
 *  inferior `valor − 1,96·se` dava um número negativo sem sentido; aqui é truncado em 0.
 *  Para o SALDO (que pode ser negativo de verdade) passe `false`: nenhum limite é truncado e
 *  o sinal negativo sai com o "−" tipográfico. */
export function ic95(valor: number, se: number | null | undefined, contagem = true): string {
  if (!se || !isFinite(se)) return "—";
  const m = 1.96 * se;
  const inf = Math.round(valor - m);
  const sup = Math.round(valor + m);
  return `${inteiroTipografico(contagem ? Math.max(0, inf) : inf)} ${separadorIntervalo} ${inteiroTipografico(contagem ? Math.max(0, sup) : sup)}`;
}

/** Rótulo da precisão da estimativa (`boa`/`cautela`/`baixa`/`sem_estimativa`) no idioma de `d`;
 *  um valor desconhecido volta como veio. */
export function rotuloPrecisao(precisao: string, d: Dicionario = pt): string {
  return (d.comum.precisao as Record<string, string>)[precisao] ?? precisao;
}
