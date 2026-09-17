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
    // "perto de zero" seria falso quando quebras[0] é grande (ex.: ±92,2‰ no Censo 1980 --
    // a inflação de volume do proxy e o ruído de municípios pequenos alargam o 60º percentil).
    // "baixa variação" descreve a mesma faixa (os 60% de menor |valor| da edição) sem prometer
    // proximidade de zero que o número ao lado pode desmentir.
    { nivel: -1, sinal: 0, rotulo: `baixa variação (±${f(quebras[0])}${unidade})` },
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

// --------------------------------------------------------------------------------------
// F12.5-cartografia: cor por valor com QUEBRAS FIXAS (docs/design_serie_censos.md, seção 4) --
// usada pelos 5 small multiples de MapaSerieCensos.tsx. Diferente de `corDivergente`/
// `quebrasSimetricas` acima (mapa principal, quebras por quantil, recalculadas por edição),
// aqui as quebras são as MESMAS constantes nas cinco edições (`QUEBRAS_FIXAS` de `lib/serie.ts`)
// -- é o que torna os cinco painéis comparáveis entre si. `corDivergente()` já aceita um array
// de 3 quebras crescentes, o formato exato de QUEBRAS_FIXAS.iem/tlm: reaproveitado sem
// alteração. Para tbi/tbe (sequenciais, 5 classes) a função nova abaixo é o equivalente.
// --------------------------------------------------------------------------------------
import { classeSequencial, QUEBRAS_FIXAS, type EdicaoSerie } from "./serie";
import { AZUL, LARANJA } from "./paletas";

export type MedidaMapaSerie = "iem" | "tlm" | "tbi" | "tbe";

/** Cor de uma classe sequencial (tbi/tbe), a partir de uma rampa ordinal de `paletas.ts`
 *  (AZUL ou LARANJA) e das quebras fixas (4 quebras, 5 classes) -- seção 4.2/4.3. */
export function corSequencial(
  v: number | null, quebras: readonly number[],
  rampa: (i: number) => { claro: string; escuro: string }, escuro: boolean,
): string {
  const i = classeSequencial(v, quebras);
  const c = rampa(i);
  return escuro ? c.escuro : c.claro;
}

/** Cor de uma unidade no mapa comparativo, para qualquer uma das 4 medidas permitidas
 *  (iem/tlm divergentes; tbi/tbe sequenciais), sempre com `QUEBRAS_FIXAS` -- nunca quantis,
 *  nunca recalculada por edição (regra dura da seção 4.1). Volume (saldo/imig/emig) não é
 *  uma medida válida aqui: quem chama já filtra isso na UI (seletor de medida do mapa). */
export function corMedidaSerie(medida: MedidaMapaSerie, v: number | null, escuro: boolean): string {
  if (medida === "iem" || medida === "tlm") {
    const rgb = corDivergente(v, [...QUEBRAS_FIXAS[medida]], escuro);
    return `rgb(${rgb.join(",")})`;
  }
  const rampa = medida === "tbi" ? AZUL : LARANJA;
  return corSequencial(v, QUEBRAS_FIXAS[medida], rampa, escuro);
}

/** Rótulos de legenda das 4 medidas do mapa comparativo (seção 4.2 -- textos fixos do
 *  documento de desenho, não gerados por fórmula: os limiares de iem/tlm têm nomes da
 *  tipologia de Baeninger, não "faixas" genéricas). */
export const LEGENDA_MEDIDA_SERIE: Record<MedidaMapaSerie, { cor: string; rotulo: string }[]> = {
  iem: [
    { cor: "pos2", rotulo: "absorção muito forte (acima de +0,60)" },
    { cor: "pos1", rotulo: "absorção forte (+0,33 a +0,60)" },
    { cor: "pos0", rotulo: "absorção (+0,15 a +0,33)" },
    { cor: "zero", rotulo: "rotatividade (−0,15 a +0,15)" },
    { cor: "neg0", rotulo: "evasão (−0,33 a −0,15)" },
    { cor: "neg1", rotulo: "evasão forte (−0,60 a −0,33)" },
    { cor: "neg2", rotulo: "evasão muito forte (abaixo de −0,60)" },
  ],
  tlm: [
    { cor: "pos2", rotulo: "ganho acima de 80‰" },
    { cor: "pos1", rotulo: "ganho de 30 a 80‰" },
    { cor: "pos0", rotulo: "ganho de 10 a 30‰" },
    { cor: "zero", rotulo: "quase equilíbrio (±10‰)" },
    { cor: "neg0", rotulo: "perda de 10 a 30‰" },
    { cor: "neg1", rotulo: "perda de 30 a 80‰" },
    { cor: "neg2", rotulo: "perda acima de 80‰" },
  ],
  tbi: [
    { cor: "seq0", rotulo: "até 25‰" },
    { cor: "seq1", rotulo: "25 a 50‰" },
    { cor: "seq2", rotulo: "50 a 80‰" },
    { cor: "seq3", rotulo: "80 a 130‰" },
    { cor: "seq4", rotulo: "130‰ ou mais" },
  ],
  tbe: [
    { cor: "seq0", rotulo: "até 25‰" },
    { cor: "seq1", rotulo: "25 a 50‰" },
    { cor: "seq2", rotulo: "50 a 80‰" },
    { cor: "seq3", rotulo: "80 a 130‰" },
    { cor: "seq4", rotulo: "130‰ ou mais" },
  ],
};

/** Cor efetiva de cada slot de legenda acima ("pos2", "neg0", "seq3"...), para desenhar a
 *  amostra de cor ao lado do rótulo. */
export function corDoSlotLegenda(medida: MedidaMapaSerie, cor: string, escuro: boolean): string {
  if (medida === "iem" || medida === "tlm") {
    const p = escuro ? DIVERGENTE.escuro : DIVERGENTE.claro;
    if (cor === "zero") return `rgb(${p.zero.join(",")})`;
    const sinalCor = cor.startsWith("pos") ? p.pos : p.neg;
    return `rgb(${sinalCor[Number(cor.slice(3))].join(",")})`;
  }
  const rampa = medida === "tbi" ? AZUL : LARANJA;
  const c = rampa(Number(cor.slice(3)));
  return escuro ? c.escuro : c.claro;
}

export type { EdicaoSerie };
