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

/** Paleta categórica de 8 slots (módulo metropolitano), validada aos pares adjacentes
 *  com o validador da skill dataviz. Usada quando uma dimensão nominal precisa de mais
 *  de 4 categorias (setor, ocupação agrupada) -- nunca mais de 8, por regra da skill. */
const CLARO_8 = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];
const ESCURO_8 = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"];
export const CATEGORICO_8 = CLARO_8.map((claro, i) => ({ claro, escuro: ESCURO_8[i] }));

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
      // só na edição 2010: sem código de município de nascimento, primeira_saida e
      // etapas_multiplas são indistinguíveis e colapsam nesta categoria (nunca aparece junto
      // com as duas acima -- reaproveita a cor de "primeira_saida", o mais próximo semântico --
      // fica depois de nascido_exterior de propósito, para não entrar nos 4 primeiros slots
      // categóricos que o teste de contraste valida como simultaneamente distintos)
      { chave: "nao_natural", rotulo: "Não natural do destino", cor: CATEGORICO[1] },
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
    nota: "em salários mínimos" as string | null,
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

/** Nome legível de um recorte, a partir da chave "dimensao__categoria". */
export function rotuloRecorte(chave: string): string {
  const [dim, cat] = chave.split("__") as [NomeDimensao, string];
  return DIMENSOES[dim]?.categorias.find((c) => c.chave === cat)?.rotulo ?? chave;
}

/** Faixas etárias como rampa ordinal; o sexo vira linha separada. */
export const FAIXAS_IDADE = [
  { chave: "05_14", rotulo: "5 a 14", cor: AZUL(0) },
  { chave: "15_24", rotulo: "15 a 24", cor: AZUL(1) },
  { chave: "25_39", rotulo: "25 a 39", cor: AZUL(2) },
  { chave: "40_59", rotulo: "40 a 59", cor: AZUL(3) },
  { chave: "60_mais", rotulo: "60 ou mais", cor: AZUL(4) },
];

export const cor = (c: { claro: string; escuro: string }, escuro: boolean) => (escuro ? c.escuro : c.claro);

/** Cor monocromática dos fluxos O/D no mapa (F11, mapa-representação). Grafite/ardósia: a
 *  direção é lida pela FORMA (afunilamento + seta + nós), não pela cor, que fica livre para
 *  separar "isto é um fluxo" de "isto é um dado" -- a dupla azul/laranja já significa
 *  entrada/saída nas espigas e no coroplético divergente. Fica aqui, e não em `MapaAtlas.tsx`,
 *  porque a legenda precisa da mesma cor: um token, um significado. Ponto de troca único das
 *  alternativas ainda em aberto (verde-azulado/violeta por direção, ou azul/laranja
 *  dessaturado). Ver o comentário em `MapaAtlas.tsx`, `ARC_FLUXO_CLARO`. */
export const FLUXO_MAPA = { claro: "#52514e", escuro: "#c3c2b7" } as const;

/** Converte um hex "#rrggbb" em [r,g,b] para as camadas deck.gl. */
export function hexParaRgb(h: string): [number, number, number] {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}

// ================= Módulo metropolitano (F5b) =================

/** Tipologia dos fluxos intra-RM: nominal, 3 categorias fixas. */
export const TIPOLOGIA_INTRA_RM = {
  titulo: "Tipologia do fluxo",
  nota: null as string | null,
  categorias: [
    { chave: "nucleo_periferia", rotulo: "Núcleo → periferia", cor: CATEGORICO[0] },
    { chave: "periferia_nucleo", rotulo: "Periferia → núcleo", cor: CATEGORICO[1] },
    { chave: "periferia_periferia", rotulo: "Periferia → periferia", cor: CATEGORICO[2] },
  ],
} as const;

/** Classe do local de trabalho dos migrantes intra-RM (sub-painel "Migrantes e trabalho"). */
export const CLASSE_TRAB = {
  origem: { rotulo: "Voltou a trabalhar na origem", cor: CATEGORICO[0] },
  nucleo: { rotulo: "Passou a trabalhar no núcleo", cor: CATEGORICO[1] },
  outro: { rotulo: "Trabalha em outro município da RM", cor: CATEGORICO[2] },
  proprio: { rotulo: "Trabalha no próprio município", cor: NEUTRO },
  varios: { rotulo: "Vários municípios", cor: NEUTRO },
  nao_informado: { rotulo: "Não informado", cor: NEUTRO },
  exterior: { rotulo: "Exterior", cor: NEUTRO },
  outros: { rotulo: "Outros", cor: NEUTRO },
} as const;

/** Classe do local de estudo dos migrantes intra-RM (mesmas cores de CLASSE_TRAB,
 *  rótulos próprios para não confundir "trabalho" com "estudo" na aba de estudo). */
export const CLASSE_ESTUDO = {
  origem: { rotulo: "Voltou a estudar na origem", cor: CATEGORICO[0] },
  nucleo: { rotulo: "Passou a estudar no núcleo", cor: CATEGORICO[1] },
  outro: { rotulo: "Estuda em outro município da RM", cor: CATEGORICO[2] },
  proprio: { rotulo: "Estuda no próprio município", cor: NEUTRO },
  varios: { rotulo: "Vários municípios", cor: NEUTRO },
  nao_informado: { rotulo: "Não informado", cor: NEUTRO },
} as const;

const FREQUENCIA_8 = (i: number) => CATEGORICO_8[i];

/** Dimensões do perfil pendular (forma igual a DIMENSOES, para reutilizar BarraPerfil). */
export const DIMENSOES_PENDULAR = {
  frequencia: {
    titulo: "Frequência de retorno",
    nota: null as string | null,
    categorias: [
      { chave: "retorno_diario", rotulo: "Retorna 3+ dias/semana", cor: FREQUENCIA_8(0) },
      { chave: "semanal_longa", rotulo: "Retorno semanal ou mais longo", cor: FREQUENCIA_8(1) },
      { chave: "ignorado", rotulo: "Ignorado", cor: NEUTRO },
    ],
  },
  /** só na edição 2010: V0661 pergunta "retorna DIARIAMENTE" (sim/não), não "3+ dias por
   *  semana" -- definição diferente da de 2022, mesmo par de chaves (ver docs/METODOLOGIA.md) */
  frequencia2010: {
    titulo: "Frequência de retorno",
    nota: null as string | null,
    categorias: [
      { chave: "retorno_diario", rotulo: "Retorna diariamente", cor: FREQUENCIA_8(0) },
      { chave: "semanal_longa", rotulo: "Não retorna diariamente", cor: FREQUENCIA_8(1) },
      { chave: "ignorado", rotulo: "Ignorado", cor: NEUTRO },
    ],
  },
  modo: {
    titulo: "Modo de transporte",
    nota: null as string | null,
    categorias: [
      { chave: "a_pe_bicicleta", rotulo: "A pé ou bicicleta", cor: FREQUENCIA_8(0) },
      { chave: "motocicleta", rotulo: "Motocicleta ou mototáxi", cor: FREQUENCIA_8(1) },
      { chave: "automovel_taxi", rotulo: "Automóvel ou táxi", cor: FREQUENCIA_8(2) },
      { chave: "onibus_van_brt", rotulo: "Ônibus, van ou BRT", cor: FREQUENCIA_8(3) },
      { chave: "trem_metro", rotulo: "Trem ou metrô", cor: FREQUENCIA_8(4) },
      { chave: "outros", rotulo: "Outros", cor: FREQUENCIA_8(5) },
      { chave: "ignorado", rotulo: "Ignorado", cor: NEUTRO },
    ],
  },
  /** tempo agrupado em 5 classes ordinais, a partir das 9 categorias publicadas */
  tempo: {
    titulo: "Tempo de deslocamento",
    nota: null as string | null,
    categorias: [
      { chave: "ate_15min", rotulo: "Até 15 min", cor: AZUL(0) },
      { chave: "de_16_a_30min", rotulo: "16 a 30 min", cor: AZUL(1) },
      { chave: "de_31min_a_1h", rotulo: "31 min a 1 h", cor: AZUL(2) },
      { chave: "de_1_a_2h", rotulo: "1 a 2 h", cor: AZUL(3) },
      { chave: "mais_de_2h", rotulo: "Mais de 2 h", cor: AZUL(4) },
      { chave: "outros", rotulo: "Não se desloca / ignorado", cor: NEUTRO },
    ],
  },
  /** só na edição 2010: V0662 tem 5 faixas próprias (ver 02_classify.sql), não aninhadas nas
   *  8 de 2022 -- por isso é um vocabulário à parte, não um reagrupamento de "tempo" acima. */
  tempo2010: {
    titulo: "Tempo de deslocamento",
    nota: "só quem retorna para casa diariamente" as string | null,
    categorias: [
      { chave: "ate_5min", rotulo: "Até 5 min", cor: AZUL(0) },
      { chave: "de_6_a_30min", rotulo: "6 a 30 min", cor: AZUL(1) },
      { chave: "de_31min_a_1h", rotulo: "31 min a 1 h", cor: AZUL(2) },
      { chave: "de_1_a_2h", rotulo: "1 a 2 h", cor: AZUL(3) },
      { chave: "mais_de_2h", rotulo: "Mais de 2 h", cor: AZUL(4) },
      { chave: "nao_se_aplica", rotulo: "Não retorna diariamente", cor: NEUTRO },
    ],
  },
  posicao: {
    titulo: "Posição na ocupação",
    nota: null as string | null,
    categorias: [
      { chave: "empregado_com_carteira", rotulo: "Empregado com carteira", cor: FREQUENCIA_8(0) },
      { chave: "empregado_sem_carteira", rotulo: "Empregado sem carteira", cor: FREQUENCIA_8(1) },
      { chave: "militar_estatutario", rotulo: "Militar ou estatutário", cor: FREQUENCIA_8(2) },
      { chave: "empregador", rotulo: "Empregador", cor: FREQUENCIA_8(3) },
      { chave: "conta_propria_familiar", rotulo: "Conta própria ou familiar", cor: FREQUENCIA_8(4) },
      { chave: "ignorado", rotulo: "Ignorado", cor: NEUTRO },
    ],
  },
  setor: {
    titulo: "Setor de atividade",
    nota: null as string | null,
    categorias: [
      { chave: "agropecuaria", rotulo: "Agropecuária", cor: FREQUENCIA_8(0) },
      { chave: "industria", rotulo: "Indústria", cor: FREQUENCIA_8(1) },
      { chave: "construcao", rotulo: "Construção", cor: FREQUENCIA_8(2) },
      { chave: "comercio", rotulo: "Comércio", cor: FREQUENCIA_8(3) },
      { chave: "transporte_logistica", rotulo: "Transporte e logística", cor: FREQUENCIA_8(4) },
      { chave: "servicos_empresariais", rotulo: "Serviços empresariais", cor: FREQUENCIA_8(5) },
      { chave: "admin_educacao_saude", rotulo: "Administração, educação e saúde", cor: FREQUENCIA_8(6) },
      { chave: "outros_servicos", rotulo: "Outros serviços", cor: FREQUENCIA_8(7) },
      { chave: "ignorado", rotulo: "Ignorado", cor: NEUTRO },
    ],
  },
  /** grandes grupos ocupacionais (01..11), agrupados em 8 classes por semelhança de conteúdo */
  ocupacao: {
    titulo: "Grupo ocupacional",
    nota: null as string | null,
    categorias: [
      { chave: "dirigentes_profissionais", rotulo: "Dirigentes e profissionais", cor: FREQUENCIA_8(0) },
      { chave: "tecnicos_administrativo", rotulo: "Técnicos e apoio administrativo", cor: FREQUENCIA_8(1) },
      { chave: "servicos_vendedores", rotulo: "Serviços e vendedores", cor: FREQUENCIA_8(2) },
      { chave: "agropecuaria", rotulo: "Agropecuária", cor: FREQUENCIA_8(3) },
      { chave: "industria_operadores", rotulo: "Indústria, construção e operadores", cor: FREQUENCIA_8(4) },
      { chave: "elementares", rotulo: "Ocupações elementares", cor: FREQUENCIA_8(5) },
      { chave: "forcas_seguranca", rotulo: "Forças armadas, polícia e bombeiros", cor: FREQUENCIA_8(6) },
      { chave: "mal_definidas", rotulo: "Mal definidas / ignorado", cor: NEUTRO },
    ],
  },
  renda_trab: {
    titulo: "Rendimento do trabalho",
    nota: "em salários mínimos" as string | null,
    categorias: [
      { chave: "ate_1_sm", rotulo: "Até 1 salário mínimo", cor: LARANJA(0) },
      { chave: "de_1_a_2_sm", rotulo: "De 1 a 2 salários mínimos", cor: LARANJA(1) },
      { chave: "de_2_a_3_sm", rotulo: "De 2 a 3 salários mínimos", cor: LARANJA(2) },
      { chave: "de_3_a_5_sm", rotulo: "De 3 a 5 salários mínimos", cor: LARANJA(3) },
      { chave: "mais_de_5_sm", rotulo: "Mais de 5 salários mínimos", cor: LARANJA(4) },
      { chave: "sem_declaracao", rotulo: "Sem declaração", cor: NEUTRO },
    ],
  },
  edu: DIMENSOES.edu,
  /** nível de estudo pendular: 4 categorias, rampa azul pulando o índice 3 (vazio aqui) */
  nivel: {
    titulo: "Nível de estudo",
    nota: null as string | null,
    categorias: [
      { chave: "infantil_fundamental", rotulo: "Infantil ou fundamental", cor: AZUL(0) },
      { chave: "medio", rotulo: "Médio", cor: AZUL(1) },
      // exclusiva da edição Censo 2000 (V0430 = 11): o pré-vestibular conta como frequência
      // à escola em 2000 e não em 2010/2022 -- ver pipeline/sql/2000/MAPEAMENTO_02_classify.md
      // §9 e docs/METODOLOGIA.md. Cor reaproveitada de AZUL(3), não usada por nenhuma outra
      // categoria desta dimensão.
      { chave: "pre_vestibular", rotulo: "Pré-vestibular", cor: AZUL(3) },
      { chave: "graduacao", rotulo: "Graduação", cor: AZUL(2) },
      { chave: "pos_graduacao", rotulo: "Pós-graduação", cor: AZUL(4) },
      { chave: "ignorado", rotulo: "Ignorado", cor: NEUTRO },
    ],
  },
} as const;

export type NomeDimensaoPendular = keyof typeof DIMENSOES_PENDULAR;
