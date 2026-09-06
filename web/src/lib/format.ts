const nf0 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const num = (v: number | null | undefined) => (v == null ? "—" : nf0.format(v));
export const num1 = (v: number | null | undefined) => (v == null ? "—" : nf1.format(v));
export const num2 = (v: number | null | undefined) => (v == null ? "—" : nf2.format(v));
export const sinal = (v: number | null | undefined) =>
  v == null ? "—" : (v > 0 ? "+" : v < 0 ? "−" : "") + nf0.format(Math.abs(v));

/** Intervalo de confiança de 95% a partir do erro-padrão. */
export function ic95(valor: number, se: number | null | undefined): string {
  if (!se || !isFinite(se)) return "—";
  const m = 1.96 * se;
  return `${num(Math.round(valor - m))} a ${num(Math.round(valor + m))}`;
}

export const rotuloPrecisao: Record<string, string> = {
  boa: "boa", cautela: "usar com cautela", baixa: "baixa precisão", sem_estimativa: "sem estimativa",
};
