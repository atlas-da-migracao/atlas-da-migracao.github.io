const nf0 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const num = (v: number | null | undefined) => (v == null ? "—" : nf0.format(v));
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
  return `${inteiroTipografico(contagem ? Math.max(0, inf) : inf)} a ${inteiroTipografico(contagem ? Math.max(0, sup) : sup)}`;
}

export const rotuloPrecisao: Record<string, string> = {
  boa: "boa", cautela: "usar com cautela", baixa: "baixa precisão", sem_estimativa: "sem estimativa",
};
