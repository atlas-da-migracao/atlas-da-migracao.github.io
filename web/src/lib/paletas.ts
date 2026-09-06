/** Paletas dos gráficos de perfil.
 *
 *  Todas validadas com scripts/validate_palette.js da skill dataviz, nos dois modos:
 *  - escolaridade e renda são ORDINAIS (níveis ordenados), então recebem rampa de matiz
 *    único: azul para escolaridade, laranja para renda -- a regra da skill para quando
 *    dois contextos sequenciais aparecem juntos. Ambas passam em claridade monotônica,
 *    salto entre passos e contraste do extremo claro.
 *  - status migratório é NOMINAL, então recebe os slots categóricos na ordem fixa.
 *    Em modo claro dois slots ficam abaixo de 3:1; vale a regra de alívio da skill,
 *    atendida pela legenda com rótulos visíveis ao lado de cada barra.
 *  - idade/sexo combina faixa etária (ordinal) com sexo (nominal): a faixa vira rampa
 *    e o sexo vira linhas separadas, em vez de dez cores concorrentes.
 */

export interface Categoria {
  chave: string;
  rotulo: string;
  cor: { claro: string; escuro: string };
}

const ordinal = (claro: string[], escuro: string[]) => (i: number) => ({ claro: claro[i], escuro: escuro[i] });

const AZUL = ordinal(
  ["#86b6ef", "#5598e7", "#2a78d6", "#1c5cab", "#0d366b"],
  ["#b7d3f6", "#86b6ef", "#3987e5", "#256abf", "#184f95"],
);
const LARANJA = ordinal(
  ["#e89d83", "#da7550", "#bf5329", "#9c390c", "#611f02"],
  ["#f2c4b4", "#e89d83", "#d06238", "#af4517", "#883008"],
);
const CATEGORICO = [
  { claro: "#2a78d6", escuro: "#3987e5" },
  { claro: "#eb6834", escuro: "#d95926" },
  { claro: "#1baf7a", escuro: "#199e70" },
  { claro: "#eda100", escuro: "#c98500" },
];
const NEUTRO = { claro: "#c3c2b7", escuro: "#52514e" };

/** Dimensões do perfil, na ordem em que aparecem no painel. */
export const DIMENSOES = {
  status: {
    titulo: "Status migratório",
    nota: null as string | null,
    categorias: [
      { chave: "retorno_natal", rotulo: "Retorno ao município natal", cor: CATEGORICO[0] },
      { chave: "primeira_saida", rotulo: "Primeira saída do natal", cor: CATEGORICO[1] },
      { chave: "etapas_multiplas", rotulo: "Etapas múltiplas", cor: CATEGORICO[2] },
      { chave: "nascido_exterior", rotulo: "Nascido no exterior", cor: CATEGORICO[3] },
      { chave: "outros", rotulo: "Outros ou suprimido", cor: NEUTRO },
    ],
  },
  edu: {
    titulo: "Escolaridade",
    nota: "pessoas de 25 anos ou mais",
    categorias: [
      { chave: "sem_instr_fund_incompleto", rotulo: "Sem instrução ou fundamental incompleto", cor: AZUL(0) },
      { chave: "fund_completo_medio_incompleto", rotulo: "Fundamental completo", cor: AZUL(1) },
      { chave: "medio_completo_superior_incompleto", rotulo: "Médio completo", cor: AZUL(2) },
      { chave: "superior_completo", rotulo: "Superior completo", cor: AZUL(4) },
      { chave: "nao_determinado", rotulo: "Não determinado", cor: NEUTRO },
      { chave: "outros", rotulo: "Outros ou suprimido", cor: NEUTRO },
    ],
  },
  renda: {
    titulo: "Renda domiciliar per capita",
    nota: "em salários mínimos de 2022 (R$ 1.212)",
    categorias: [
      { chave: "ate_1_4_sm", rotulo: "Até ¼", cor: LARANJA(0) },
      { chave: "de_1_4_a_1_2_sm", rotulo: "De ¼ a ½", cor: LARANJA(1) },
      { chave: "de_1_2_a_1_sm", rotulo: "De ½ a 1", cor: LARANJA(2) },
      { chave: "de_1_a_2_sm", rotulo: "De 1 a 2", cor: LARANJA(3) },
      { chave: "mais_de_2_sm", rotulo: "Mais de 2", cor: LARANJA(4) },
      { chave: "nao_aplicavel", rotulo: "Domicílio coletivo", cor: NEUTRO },
      { chave: "outros", rotulo: "Outros ou suprimido", cor: NEUTRO },
    ],
  },
} as const;

export type NomeDimensao = keyof typeof DIMENSOES;

/** Faixas etárias como rampa ordinal; o sexo vira linha separada. */
export const FAIXAS_IDADE = [
  { chave: "05_14", rotulo: "5 a 14", cor: AZUL(0) },
  { chave: "15_24", rotulo: "15 a 24", cor: AZUL(1) },
  { chave: "25_39", rotulo: "25 a 39", cor: AZUL(2) },
  { chave: "40_59", rotulo: "40 a 59", cor: AZUL(3) },
  { chave: "60_mais", rotulo: "60 ou mais", cor: AZUL(4) },
];

export const cor = (c: { claro: string; escuro: string }, escuro: boolean) => (escuro ? c.escuro : c.claro);
