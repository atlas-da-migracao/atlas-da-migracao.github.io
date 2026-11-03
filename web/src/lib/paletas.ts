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

import { pt, type Dicionario } from "../i18n/pt";

/** Os TEXTOS (títulos, notas e rótulos de categoria) moram em `i18n/pt/comum.ts`; aqui ficam as
 *  chaves, a ordem e as cores. O campo `rotulo` das constantes abaixo (DIMENSOES, DIMENSOES_PENDULAR,
 *  FAIXAS_IDADE, CLASSE_TRAB, CLASSE_ESTUDO...) é só a REFERÊNCIA EM PORTUGUÊS, para testes e
 *  código sem idioma: na interface use os helpers `dimensao`, `dimensaoPendular`, `tipologiaIntraRM`,
 *  `rotuloCategoria`, `rotuloClasseTrab`... (no fim deste arquivo), que devolvem o texto no idioma
 *  do dicionário `d`. */
export interface Categoria {
  chave: string;
  rotulo: string;
  cor: { claro: string; escuro: string };
}

type Grupo = keyof typeof pt.comum.categorias;
/** rótulo PT de uma categoria, lido do dicionário (o tipo só aceita chaves que existem) */
const rot = <G extends Grupo>(grupo: G, chave: keyof (typeof pt.comum.categorias)[G]): string =>
  (pt.comum.categorias[grupo] as Record<string, string>)[chave as string];

const ordinal = (claro: string[], escuro: string[]) => (i: number) => ({ claro: claro[i], escuro: escuro[i] });

// Exportadas (F12.5): reaproveitadas pelos small multiples sequenciais de tbi/tbe da seção
// "Ao longo dos censos" (lib/serie.ts, QUEBRAS_FIXAS) -- ver docs/design_serie_censos.md, 4.3.
// Não introduzir uma segunda rampa sequencial: estas duas são as únicas validadas pela skill.
export const AZUL = ordinal(
  ["#86b6ef", "#5598e7", "#2a78d6", "#1c5cab", "#0d366b"],
  ["#b7d3f6", "#86b6ef", "#3987e5", "#256abf", "#184f95"],
);
export const LARANJA = ordinal(
  ["#e89d83", "#da7550", "#bf5329", "#9c390c", "#611f02"],
  ["#f2c4b4", "#e89d83", "#d06238", "#af4517", "#883008"],
);
const CATEGORICO = [
  { claro: "#2a78d6", escuro: "#3987e5" },
  { claro: "#eb6834", escuro: "#d95926" },
  { claro: "#1baf7a", escuro: "#199e70" },
  { claro: "#eda100", escuro: "#c98500" },
];
/** Cinza de "sem informação" (ignorado, não determinado, não se aplica, sem declaração). */
const NEUTRO = { claro: "#c3c2b7", escuro: "#52514e" };
/** Segundo cinza, mais escuro no tema claro e mais claro no escuro, só para o residual
 *  "Outros ou suprimido" (categoria `outros`: células abaixo do limiar de divulgação somadas à
 *  categoria residual da dimensão). Fica distinto de NEUTRO para que as duas categorias possam
 *  aparecer na MESMA barra sem se confundir -- antes `nao_determinado`/`nao_aplicavel` e
 *  `outros` dividiam o mesmo cinza. Um token, um significado: toda categoria `outros` de
 *  DIMENSOES e DIMENSOES_PENDULAR usa este. */
const SUPRIMIDO = { claro: "#8f8e85", escuro: "#7c7b75" };

/** Categoria residual genérica, para barras cuja paleta não declara `outros` (BarraPerfil a
 *  acrescenta quando uma série traz valores fora da paleta, p.ex. uma categoria nova que o
 *  pipeline publicou e a paleta ainda não conhece) -- assim o denominador nunca perde massa. */
export const CATEGORIA_OUTROS: Categoria = { chave: "outros", rotulo: pt.comum.categoriaOutros, cor: SUPRIMIDO };

/** Paleta categórica de 8 slots (módulo metropolitano), validada aos pares adjacentes
 *  com o validador da skill dataviz. Usada quando uma dimensão nominal precisa de mais
 *  de 4 categorias (setor, ocupação agrupada) -- nunca mais de 8, por regra da skill. */
const CLARO_8 = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];
const ESCURO_8 = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"];
export const CATEGORICO_8 = CLARO_8.map((claro, i) => ({ claro, escuro: ESCURO_8[i] }));

/** Dimensões do perfil, na ordem em que aparecem no painel. */
export const DIMENSOES = {
  status: {
    titulo: pt.comum.dimensoes.status.titulo,
    nota: pt.comum.dimensoes.status.nota,
    categorias: [
      { chave: "retorno_natal", rotulo: rot("status", "retorno_natal"), cor: CATEGORICO[0] },
      { chave: "primeira_saida", rotulo: rot("status", "primeira_saida"), cor: CATEGORICO[1] },
      { chave: "etapas_multiplas", rotulo: rot("status", "etapas_multiplas"), cor: CATEGORICO[2] },
      { chave: "nascido_exterior", rotulo: rot("status", "nascido_exterior"), cor: CATEGORICO[3] },
      // só na edição 2010: sem código de município de nascimento, primeira_saida e
      // etapas_multiplas são indistinguíveis e colapsam nesta categoria (nunca aparece junto
      // com as duas acima -- reaproveita a cor de "primeira_saida", o mais próximo semântico --
      // fica depois de nascido_exterior de propósito, para não entrar nos 4 primeiros slots
      // categóricos que o teste de contraste valida como simultaneamente distintos)
      { chave: "nao_natural", rotulo: rot("status", "nao_natural"), cor: CATEGORICO[1] },
      { chave: "outros", rotulo: rot("status", "outros"), cor: SUPRIMIDO },
    ],
  },
  edu: {
    titulo: pt.comum.dimensoes.edu.titulo,
    nota: pt.comum.dimensoes.edu.nota,
    categorias: [
      { chave: "sem_instr_fund_incompleto", rotulo: rot("edu", "sem_instr_fund_incompleto"), cor: AZUL(0) },
      { chave: "fund_completo_medio_incompleto", rotulo: rot("edu", "fund_completo_medio_incompleto"), cor: AZUL(1) },
      { chave: "medio_completo_superior_incompleto", rotulo: rot("edu", "medio_completo_superior_incompleto"), cor: AZUL(2) },
      { chave: "superior_completo", rotulo: rot("edu", "superior_completo"), cor: AZUL(4) },
      { chave: "nao_determinado", rotulo: rot("edu", "nao_determinado"), cor: NEUTRO },
      { chave: "outros", rotulo: rot("edu", "outros"), cor: SUPRIMIDO },
    ],
  },
  renda: {
    titulo: pt.comum.dimensoes.renda.titulo,
    nota: pt.comum.dimensoes.renda.nota,
    categorias: [
      { chave: "ate_1_4_sm", rotulo: rot("renda", "ate_1_4_sm"), cor: LARANJA(0) },
      { chave: "de_1_4_a_1_2_sm", rotulo: rot("renda", "de_1_4_a_1_2_sm"), cor: LARANJA(1) },
      { chave: "de_1_2_a_1_sm", rotulo: rot("renda", "de_1_2_a_1_sm"), cor: LARANJA(2) },
      { chave: "de_1_a_2_sm", rotulo: rot("renda", "de_1_a_2_sm"), cor: LARANJA(3) },
      { chave: "mais_de_2_sm", rotulo: rot("renda", "mais_de_2_sm"), cor: LARANJA(4) },
      { chave: "nao_aplicavel", rotulo: rot("renda", "nao_aplicavel"), cor: NEUTRO },
      { chave: "outros", rotulo: rot("renda", "outros"), cor: SUPRIMIDO },
    ],
  },
} as const;

export type NomeDimensao = keyof typeof DIMENSOES;

/** Categorias residuais, que não fazem sentido como RECORTE analítico (o seletor Filtro não as
 *  oferece e `lerUrl` rejeita `?f=` com elas). Única definição: seletor e URL concordam. */
export const CATEGORIAS_OCULTAS_NO_RECORTE: ReadonlySet<string> =
  new Set(["outros", "nao_determinado", "nao_aplicavel"]);

/** Separa a chave de um recorte, "dimensao__categoria", na dimensão e na categoria (ex.:
 *  "edu__superior_completo" -> { dim: "edu", cat: "superior_completo" }). Divide só no PRIMEIRO
 *  "__", então categorias com sublinhado duplo não se perdem. Sem "__", `cat` vem vazio. */
export function separarRecorte(chave: string): { dim: string; cat: string } {
  const i = chave.indexOf("__");
  return i < 0 ? { dim: chave, cat: "" } : { dim: chave.slice(0, i), cat: chave.slice(i + 2) };
}

/** Nome legível de um recorte, a partir da chave "dimensao__categoria", no idioma de `d`. */
export function rotuloRecorte(chave: string, d: Dicionario = pt): string {
  const [dim, cat] = chave.split("__") as [NomeDimensao, string];
  return DIMENSOES[dim]?.categorias.some((c) => c.chave === cat) ? rotuloCategoria(dim, cat, d) : chave;
}

/** Faixas etárias como rampa ordinal; o sexo vira linha separada. */
export const FAIXAS_IDADE = [
  { chave: "05_14", rotulo: rot("faixasIdade", "05_14"), cor: AZUL(0) },
  { chave: "15_24", rotulo: rot("faixasIdade", "15_24"), cor: AZUL(1) },
  { chave: "25_39", rotulo: rot("faixasIdade", "25_39"), cor: AZUL(2) },
  { chave: "40_59", rotulo: rot("faixasIdade", "40_59"), cor: AZUL(3) },
  { chave: "60_mais", rotulo: rot("faixasIdade", "60_mais"), cor: AZUL(4) },
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
  titulo: pt.comum.dimensoes.tipologia.titulo,
  nota: pt.comum.dimensoes.tipologia.nota,
  categorias: [
    { chave: "nucleo_periferia", rotulo: rot("tipologia", "nucleo_periferia"), cor: CATEGORICO[0] },
    { chave: "periferia_nucleo", rotulo: rot("tipologia", "periferia_nucleo"), cor: CATEGORICO[1] },
    { chave: "periferia_periferia", rotulo: rot("tipologia", "periferia_periferia"), cor: CATEGORICO[2] },
  ],
} as const;

/** Classe do local de trabalho dos migrantes intra-RM (sub-painel "Migrantes e trabalho"). */
export const CLASSE_TRAB = {
  origem: { rotulo: rot("classeTrab", "origem"), cor: CATEGORICO[0] },
  nucleo: { rotulo: rot("classeTrab", "nucleo"), cor: CATEGORICO[1] },
  outro: { rotulo: rot("classeTrab", "outro"), cor: CATEGORICO[2] },
  proprio: { rotulo: rot("classeTrab", "proprio"), cor: NEUTRO },
  varios: { rotulo: rot("classeTrab", "varios"), cor: NEUTRO },
  nao_informado: { rotulo: rot("classeTrab", "nao_informado"), cor: NEUTRO },
  exterior: { rotulo: rot("classeTrab", "exterior"), cor: NEUTRO },
  outros: { rotulo: rot("classeTrab", "outros"), cor: NEUTRO },
} as const;

/** Classe do local de estudo dos migrantes intra-RM (mesmas cores de CLASSE_TRAB,
 *  rótulos próprios para não confundir "trabalho" com "estudo" na aba de estudo). */
export const CLASSE_ESTUDO = {
  origem: { rotulo: rot("classeEstudo", "origem"), cor: CATEGORICO[0] },
  nucleo: { rotulo: rot("classeEstudo", "nucleo"), cor: CATEGORICO[1] },
  outro: { rotulo: rot("classeEstudo", "outro"), cor: CATEGORICO[2] },
  proprio: { rotulo: rot("classeEstudo", "proprio"), cor: NEUTRO },
  varios: { rotulo: rot("classeEstudo", "varios"), cor: NEUTRO },
  nao_informado: { rotulo: rot("classeEstudo", "nao_informado"), cor: NEUTRO },
} as const;

const FREQUENCIA_8 = (i: number) => CATEGORICO_8[i];

/** Dimensões do perfil pendular (forma igual a DIMENSOES, para reutilizar BarraPerfil). */
export const DIMENSOES_PENDULAR = {
  frequencia: {
    titulo: pt.comum.dimensoes.frequencia.titulo,
    nota: pt.comum.dimensoes.frequencia.nota,
    categorias: [
      { chave: "retorno_diario", rotulo: rot("frequencia", "retorno_diario"), cor: FREQUENCIA_8(0) },
      { chave: "semanal_longa", rotulo: rot("frequencia", "semanal_longa"), cor: FREQUENCIA_8(1) },
      { chave: "ignorado", rotulo: rot("frequencia", "ignorado"), cor: NEUTRO },
      { chave: "outros", rotulo: rot("frequencia", "outros"), cor: SUPRIMIDO },
    ],
  },
  /** só na edição 2010: V0661 pergunta "retorna DIARIAMENTE" (sim/não), não "3+ dias por
   *  semana" -- definição diferente da de 2022, mesmo par de chaves (ver docs/METODOLOGIA.md) */
  frequencia2010: {
    titulo: pt.comum.dimensoes.frequencia2010.titulo,
    nota: pt.comum.dimensoes.frequencia2010.nota,
    categorias: [
      { chave: "retorno_diario", rotulo: rot("frequencia2010", "retorno_diario"), cor: FREQUENCIA_8(0) },
      { chave: "semanal_longa", rotulo: rot("frequencia2010", "semanal_longa"), cor: FREQUENCIA_8(1) },
      { chave: "ignorado", rotulo: rot("frequencia2010", "ignorado"), cor: NEUTRO },
      { chave: "outros", rotulo: rot("frequencia2010", "outros"), cor: SUPRIMIDO },
    ],
  },
  modo: {
    titulo: pt.comum.dimensoes.modo.titulo,
    nota: pt.comum.dimensoes.modo.nota,
    categorias: [
      { chave: "a_pe_bicicleta", rotulo: rot("modo", "a_pe_bicicleta"), cor: FREQUENCIA_8(0) },
      { chave: "motocicleta", rotulo: rot("modo", "motocicleta"), cor: FREQUENCIA_8(1) },
      { chave: "automovel_taxi", rotulo: rot("modo", "automovel_taxi"), cor: FREQUENCIA_8(2) },
      { chave: "onibus_van_brt", rotulo: rot("modo", "onibus_van_brt"), cor: FREQUENCIA_8(3) },
      { chave: "trem_metro", rotulo: rot("modo", "trem_metro"), cor: FREQUENCIA_8(4) },
      // `outros` aqui mistura duas coisas que o dado publicado NÃO distingue: a categoria
      // "outros meios de transporte" do questionário (02_classify.sql: códigos 11-14 e 99) e o
      // residual de supressão (células com poucas observações, somadas a `outros` em
      // publish.py). As duas saem na mesma linha de `pendular_*_dim` (GROUP BY categoria), então
      // o rótulo diz as duas e a cor é a do residual, não a de um meio de transporte.
      { chave: "outros", rotulo: rot("modo", "outros"), cor: SUPRIMIDO },
      { chave: "ignorado", rotulo: rot("modo", "ignorado"), cor: NEUTRO },
    ],
  },
  /** tempo agrupado em 5 classes ordinais, a partir das 9 categorias publicadas */
  tempo: {
    titulo: pt.comum.dimensoes.tempo.titulo,
    nota: pt.comum.dimensoes.tempo.nota,
    categorias: [
      { chave: "ate_15min", rotulo: rot("tempo", "ate_15min"), cor: AZUL(0) },
      { chave: "de_16_a_30min", rotulo: rot("tempo", "de_16_a_30min"), cor: AZUL(1) },
      { chave: "de_31min_a_1h", rotulo: rot("tempo", "de_31min_a_1h"), cor: AZUL(2) },
      { chave: "de_1_a_2h", rotulo: rot("tempo", "de_1_a_2h"), cor: AZUL(3) },
      { chave: "mais_de_2h", rotulo: rot("tempo", "mais_de_2h"), cor: AZUL(4) },
      // `outros` = "não se desloca" + "ignorado" (agruparTempo, lib/rm.ts) + o residual de
      // supressão, que o dado publicado também chama de `outros`
      { chave: "outros", rotulo: rot("tempo", "outros"), cor: SUPRIMIDO },
    ],
  },
  /** só na edição 2010: V0662 tem 5 faixas próprias (ver 02_classify.sql), não aninhadas nas
   *  8 de 2022 -- por isso é um vocabulário à parte, não um reagrupamento de "tempo" acima. */
  tempo2010: {
    titulo: pt.comum.dimensoes.tempo2010.titulo,
    nota: pt.comum.dimensoes.tempo2010.nota,
    categorias: [
      { chave: "ate_5min", rotulo: rot("tempo2010", "ate_5min"), cor: AZUL(0) },
      { chave: "de_6_a_30min", rotulo: rot("tempo2010", "de_6_a_30min"), cor: AZUL(1) },
      { chave: "de_31min_a_1h", rotulo: rot("tempo2010", "de_31min_a_1h"), cor: AZUL(2) },
      { chave: "de_1_a_2h", rotulo: rot("tempo2010", "de_1_a_2h"), cor: AZUL(3) },
      { chave: "mais_de_2h", rotulo: rot("tempo2010", "mais_de_2h"), cor: AZUL(4) },
      { chave: "nao_se_aplica", rotulo: rot("tempo2010", "nao_se_aplica"), cor: NEUTRO },
      { chave: "outros", rotulo: rot("tempo2010", "outros"), cor: SUPRIMIDO },
    ],
  },
  posicao: {
    titulo: pt.comum.dimensoes.posicao.titulo,
    nota: pt.comum.dimensoes.posicao.nota,
    categorias: [
      { chave: "empregado_com_carteira", rotulo: rot("posicao", "empregado_com_carteira"), cor: FREQUENCIA_8(0) },
      { chave: "empregado_sem_carteira", rotulo: rot("posicao", "empregado_sem_carteira"), cor: FREQUENCIA_8(1) },
      { chave: "militar_estatutario", rotulo: rot("posicao", "militar_estatutario"), cor: FREQUENCIA_8(2) },
      { chave: "empregador", rotulo: rot("posicao", "empregador"), cor: FREQUENCIA_8(3) },
      { chave: "conta_propria_familiar", rotulo: rot("posicao", "conta_propria_familiar"), cor: FREQUENCIA_8(4) },
      { chave: "ignorado", rotulo: rot("posicao", "ignorado"), cor: NEUTRO },
      { chave: "outros", rotulo: rot("posicao", "outros"), cor: SUPRIMIDO },
    ],
  },
  setor: {
    titulo: pt.comum.dimensoes.setor.titulo,
    nota: pt.comum.dimensoes.setor.nota,
    categorias: [
      { chave: "agropecuaria", rotulo: rot("setor", "agropecuaria"), cor: FREQUENCIA_8(0) },
      { chave: "industria", rotulo: rot("setor", "industria"), cor: FREQUENCIA_8(1) },
      { chave: "construcao", rotulo: rot("setor", "construcao"), cor: FREQUENCIA_8(2) },
      { chave: "comercio", rotulo: rot("setor", "comercio"), cor: FREQUENCIA_8(3) },
      { chave: "transporte_logistica", rotulo: rot("setor", "transporte_logistica"), cor: FREQUENCIA_8(4) },
      { chave: "servicos_empresariais", rotulo: rot("setor", "servicos_empresariais"), cor: FREQUENCIA_8(5) },
      { chave: "admin_educacao_saude", rotulo: rot("setor", "admin_educacao_saude"), cor: FREQUENCIA_8(6) },
      { chave: "outros_servicos", rotulo: rot("setor", "outros_servicos"), cor: FREQUENCIA_8(7) },
      { chave: "ignorado", rotulo: rot("setor", "ignorado"), cor: NEUTRO },
      { chave: "outros", rotulo: rot("setor", "outros"), cor: SUPRIMIDO },
    ],
  },
  /** grandes grupos ocupacionais (01..11), agrupados em 8 classes por semelhança de conteúdo */
  ocupacao: {
    titulo: pt.comum.dimensoes.ocupacao.titulo,
    nota: pt.comum.dimensoes.ocupacao.nota,
    categorias: [
      { chave: "dirigentes_profissionais", rotulo: rot("ocupacao", "dirigentes_profissionais"), cor: FREQUENCIA_8(0) },
      { chave: "tecnicos_administrativo", rotulo: rot("ocupacao", "tecnicos_administrativo"), cor: FREQUENCIA_8(1) },
      { chave: "servicos_vendedores", rotulo: rot("ocupacao", "servicos_vendedores"), cor: FREQUENCIA_8(2) },
      { chave: "agropecuaria", rotulo: rot("ocupacao", "agropecuaria"), cor: FREQUENCIA_8(3) },
      { chave: "industria_operadores", rotulo: rot("ocupacao", "industria_operadores"), cor: FREQUENCIA_8(4) },
      { chave: "elementares", rotulo: rot("ocupacao", "elementares"), cor: FREQUENCIA_8(5) },
      { chave: "forcas_seguranca", rotulo: rot("ocupacao", "forcas_seguranca"), cor: FREQUENCIA_8(6) },
      // `agruparOcupacao` (lib/rm.ts) joga em `mal_definidas` tudo o que não é um dos códigos
      // 01-11, inclusive o residual `outros` de supressão -- por isso não há `outros` aqui.
      { chave: "mal_definidas", rotulo: rot("ocupacao", "mal_definidas"), cor: NEUTRO },
    ],
  },
  renda_trab: {
    titulo: pt.comum.dimensoes.renda_trab.titulo,
    nota: pt.comum.dimensoes.renda_trab.nota,
    categorias: [
      { chave: "ate_1_sm", rotulo: rot("renda_trab", "ate_1_sm"), cor: LARANJA(0) },
      { chave: "de_1_a_2_sm", rotulo: rot("renda_trab", "de_1_a_2_sm"), cor: LARANJA(1) },
      { chave: "de_2_a_3_sm", rotulo: rot("renda_trab", "de_2_a_3_sm"), cor: LARANJA(2) },
      { chave: "de_3_a_5_sm", rotulo: rot("renda_trab", "de_3_a_5_sm"), cor: LARANJA(3) },
      { chave: "mais_de_5_sm", rotulo: rot("renda_trab", "mais_de_5_sm"), cor: LARANJA(4) },
      { chave: "sem_declaracao", rotulo: rot("renda_trab", "sem_declaracao"), cor: NEUTRO },
      { chave: "outros", rotulo: rot("renda_trab", "outros"), cor: SUPRIMIDO },
    ],
  },
  edu: DIMENSOES.edu,
  /** nível de estudo pendular: 4 categorias, rampa azul pulando o índice 3 (vazio aqui) */
  nivel: {
    titulo: pt.comum.dimensoes.nivel.titulo,
    nota: pt.comum.dimensoes.nivel.nota,
    categorias: [
      { chave: "infantil_fundamental", rotulo: rot("nivel", "infantil_fundamental"), cor: AZUL(0) },
      { chave: "medio", rotulo: rot("nivel", "medio"), cor: AZUL(1) },
      // exclusiva da edição Censo 2000 (V0430 = 11): o pré-vestibular conta como frequência
      // à escola em 2000 e não em 2010/2022 -- ver pipeline/sql/2000/MAPEAMENTO_02_classify.md
      // §9 e docs/METODOLOGIA.md. Cor reaproveitada de AZUL(3), não usada por nenhuma outra
      // categoria desta dimensão.
      { chave: "pre_vestibular", rotulo: rot("nivel", "pre_vestibular"), cor: AZUL(3) },
      { chave: "graduacao", rotulo: rot("nivel", "graduacao"), cor: AZUL(2) },
      { chave: "pos_graduacao", rotulo: rot("nivel", "pos_graduacao"), cor: AZUL(4) },
      { chave: "ignorado", rotulo: rot("nivel", "ignorado"), cor: NEUTRO },
      { chave: "outros", rotulo: rot("nivel", "outros"), cor: SUPRIMIDO },
    ],
  },
} as const;

export type NomeDimensaoPendular = keyof typeof DIMENSOES_PENDULAR;

// ================= Textos no idioma ativo =================

type GrupoDimensao = keyof typeof pt.comum.dimensoes;

/** Rótulo de uma categoria (grupo = dimensão, ou classeTrab/classeEstudo/faixasIdade) no idioma
 *  de `d`; chave desconhecida volta como veio. */
export function rotuloCategoria(grupo: Grupo, chave: string, d: Dicionario = pt): string {
  return (d.comum.categorias[grupo] as Record<string, string>)[chave] ?? chave;
}

export const rotuloClasseTrab = (classe: string, d: Dicionario = pt) => rotuloCategoria("classeTrab", classe, d);
export const rotuloClasseEstudo = (classe: string, d: Dicionario = pt) => rotuloCategoria("classeEstudo", classe, d);
export const rotuloFaixaIdade = (chave: string, d: Dicionario = pt) => rotuloCategoria("faixasIdade", chave, d);

/** Residual genérico ("Outros ou suprimido") no idioma de `d`. */
export function categoriaOutros(d: Dicionario = pt): Categoria {
  return { ...CATEGORIA_OUTROS, rotulo: d.comum.categoriaOutros };
}

/** Uma dimensão de perfil pronta para `BarraPerfil`: título, nota e categorias já no idioma. */
export interface DimensaoPerfil {
  titulo: string;
  nota: string | null;
  categorias: Categoria[];
}

function localizar(grupo: GrupoDimensao, categorias: readonly Categoria[], d: Dicionario): DimensaoPerfil {
  return {
    titulo: d.comum.dimensoes[grupo].titulo,
    nota: d.comum.dimensoes[grupo].nota,
    categorias: categorias.map((c) => ({ ...c, rotulo: rotuloCategoria(grupo, c.chave, d) })),
  };
}

/** Dimensão de `DIMENSOES` (status, edu, renda) no idioma de `d`. */
export const dimensao = (dim: NomeDimensao, d: Dicionario = pt): DimensaoPerfil =>
  localizar(dim, DIMENSOES[dim].categorias, d);

/** Dimensão de `DIMENSOES_PENDULAR` no idioma de `d`. */
export const dimensaoPendular = (dim: NomeDimensaoPendular, d: Dicionario = pt): DimensaoPerfil =>
  localizar(dim, DIMENSOES_PENDULAR[dim].categorias, d);

/** Tipologia dos fluxos intra-RM no idioma de `d`. */
export const tipologiaIntraRM = (d: Dicionario = pt): DimensaoPerfil =>
  localizar("tipologia", TIPOLOGIA_INTRA_RM.categorias, d);
