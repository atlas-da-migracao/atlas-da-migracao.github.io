/** Escalas de cor do mapa.
 *
 *  Saldo migratório usa escala DIVERGENTE (vermelho = perda, cinza = perto de zero,
 *  azul = ganho), centrada em zero, conforme a skill dataviz. Cada braço foi validado
 *  como rampa de matiz único: claridade monotônica, salto entre passos >= 0,06 e
 *  dispersão de matiz <= 3°. O extremo claro fica perto da superfície de propósito --
 *  é a regra do coroplético, em que o passo mais claro significa "perto de zero".
 *
 *  Regra de alívio (contraste abaixo de 3:1 nos passos claros): a legenda mostra as
 *  faixas de valor e o painel lateral traz os números exatos do município selecionado.
 */

export type RGB = [number, number, number];

const hex = (h: string): RGB => [
  parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16),
];

export const DIVERGENTE = {
  claro: {
    neg: ["#f3ada7", "#e06e68", "#8c2828"].map(hex) as RGB[],
    zero: hex("#f0efec"),
    pos: ["#9ec5f4", "#5598e7", "#184f95"].map(hex) as RGB[],
  },
  escuro: {
    neg: ["#fbd5d1", "#d65854", "#b43b3a"].map(hex) as RGB[],
    zero: hex("#383835"),
    pos: ["#cde2fb", "#3987e5", "#256abf"].map(hex) as RGB[],
  },
};

/** Quebras simétricas em torno de zero, a partir dos quantis do valor absoluto.
 *  Simetria é obrigatória numa escala divergente: um ganho e uma perda de mesma
 *  magnitude precisam ter a mesma intensidade de cor. */
export function quebrasSimetricas(valores: number[]): number[] {
  const abs = valores.map(Math.abs).filter((v) => v > 0).sort((a, b) => a - b);
  if (abs.length === 0) return [1, 2, 3];
  const q = (p: number) => abs[Math.min(abs.length - 1, Math.floor(p * abs.length))];
  // a primeira quebra define a faixa "perto de zero": generosa de propósito, para que
  // o mapa mostre estrutura espacial em vez de ruído município a município
  return [q(0.6), q(0.85), q(0.96)];
}

/** Cor de um valor na escala divergente, dadas as quebras (crescentes, positivas). */
export function corDivergente(v: number | null, quebras: number[], escuro: boolean): RGB {
  const p = escuro ? DIVERGENTE.escuro : DIVERGENTE.claro;
  if (v == null || !isFinite(v)) return p.zero;
  const a = Math.abs(v);
  if (a < quebras[0]) return p.zero;
  const nivel = a < quebras[1] ? 0 : a < quebras[2] ? 1 : 2;
  return v > 0 ? p.pos[nivel] : p.neg[nivel];
}

/** Rótulos das faixas da legenda, do maior ganho à maior perda. */
export function faixasLegenda(quebras: number[], unidade: string) {
  const f = (v: number) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: unidade === "‰" ? 1 : 0 }).format(v);
  return [
    { nivel: 2, sinal: 1, rotulo: `ganho acima de ${f(quebras[2])}${unidade}` },
    { nivel: 1, sinal: 1, rotulo: `${f(quebras[1])} a ${f(quebras[2])}${unidade}` },
    { nivel: 0, sinal: 1, rotulo: `${f(quebras[0])} a ${f(quebras[1])}${unidade}` },
    { nivel: -1, sinal: 0, rotulo: `perto de zero (±${f(quebras[0])}${unidade})` },
    { nivel: 0, sinal: -1, rotulo: `${f(quebras[0])} a ${f(quebras[1])}${unidade}` },
    { nivel: 1, sinal: -1, rotulo: `${f(quebras[1])} a ${f(quebras[2])}${unidade}` },
    { nivel: 2, sinal: -1, rotulo: `perda acima de ${f(quebras[2])}${unidade}` },
  ];
}

export function corDaFaixa(nivel: number, sinal: number, escuro: boolean): string {
  const p = escuro ? DIVERGENTE.escuro : DIVERGENTE.claro;
  const rgb = sinal === 0 ? p.zero : sinal > 0 ? p.pos[nivel] : p.neg[nivel];
  return `rgb(${rgb.join(",")})`;
}
