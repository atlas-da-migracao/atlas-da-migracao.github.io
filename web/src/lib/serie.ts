/** Fonte única do front-end para a seção "Ao longo dos censos" (F12.5).
 *
 *  Porte fiel de `pipeline/comparabilidade_regras.py` para o que o front precisa decidir
 *  sem reimplementar regra metodológica: mesmos limiares, mesma guarda estatística, mesma
 *  harmonização de vocabulário. Ver docs/design_serie_censos.md (especificação de interface)
 *  e docs/METODOLOGIA.md, "Comparação entre censos (F12)".
 *
 *  Convenção herdada do Python: `iem` sempre no ÍNDICE [-1, 1], NUNCA em percentual. Isso
 *  diverge de App.tsx/Legenda.tsx (que multiplicam por 100 para o mapa principal) -- ver
 *  docs/design_serie_censos.md, 4.5, item 1. Não corrigido aqui de propósito: é decisão da
 *  F12.6-aud (fora de escopo desta fase). `lib/serie.ts` e `PainelMunicipio.tsx` usam o
 *  índice, como a fonte única.
 *
 *  Unidades de `unidades_serie.parquet` que NÃO são o que o nome sugere: `pct_interestadual` é
 *  FRAÇÃO (0-1), não percentual -- a conversão ×100 acontece uma vez, na leitura da série
 *  (`normalizarLinhaUnidade`), e o resto do front (tabela, `tipoFluxoPredominante`) só vê
 *  percentual. A capa nacional (`queries.ts`) já calcula em percentual por conta própria.
 */

// --------------------------------------------------------------------------------------
// Eixos
// --------------------------------------------------------------------------------------

/** Ordem cronológica fixa de exibição (1980 -> 2022) -- o INVERSO da ordem operacional de
 *  `pipeline/comparabilidade_regras.py` (mais nova -> mais antiga), porque o front sempre
 *  lê a série da esquerda (passado) para a direita (presente). */
export const EDICOES_SERIE = ["1980", "1991", "2000", "2010", "2022"] as const;
export type EdicaoSerie = (typeof EDICOES_SERIE)[number];

export const NIVEIS_SERIE = ["mun", "rgi", "rgint", "uf", "rm"] as const;
export type NivelSerie = (typeof NIVEIS_SERIE)[number];

export const rotuloEdicao = (e: EdicaoSerie): string => (e === "1980" ? "1980 (proxy)" : e);

/** Plural dos rótulos de nível -- "regiões imediatas", nunca "região imediatas" (concatenar "s"
 *  ao singular quebra todo rótulo composto). O singular (`ROTULO_NIVEL`) mora em `SerieCensos.tsx`. */
export const ROTULO_NIVEL_PLURAL: Record<NivelSerie, string> = {
  mun: "municípios", rgi: "regiões imediatas", rgint: "regiões intermediárias", uf: "UFs",
  rm: "regiões metropolitanas",
};

/** Número mínimo de edições marcadas na seção "Ao longo dos censos": abaixo disso não há
 *  o que comparar (F13). */
export const MIN_EDICOES_SERIE = 2;

const isEdicaoSerie = (e: string): e is EdicaoSerie =>
  (EDICOES_SERIE as readonly string[]).includes(e);

/** Ordena cronologicamente (índice em `EDICOES_SERIE`) e remove duplicatas e valores que não
 *  são `EdicaoSerie` -- usada para sanear o que vem da URL antes de guardar no estado. */
export function ordenarEdicoes(eds: Iterable<string>): EdicaoSerie[] {
  const unicas = new Set<EdicaoSerie>();
  for (const e of eds) if (isEdicaoSerie(e)) unicas.add(e);
  return EDICOES_SERIE.filter((e) => unicas.has(e));
}

/** Marca/desmarca uma edição do subconjunto ativo. Se desmarcar deixaria menos de
 *  `MIN_EDICOES_SERIE` edições marcadas, devolve `atuais` INALTERADO (mesma referência) --
 *  a seção nunca fica com uma comparação impossível. O resultado é sempre cronológico. */
export function alternarEdicao(atuais: readonly EdicaoSerie[], e: EdicaoSerie): EdicaoSerie[] {
  const marcada = atuais.includes(e);
  if (marcada && atuais.length <= MIN_EDICOES_SERIE) return atuais as EdicaoSerie[];
  const proximas = marcada ? atuais.filter((a) => a !== e) : [...atuais, e];
  return ordenarEdicoes(proximas);
}

/** Filtra as linhas de qualquer consulta da série ao subconjunto de edições marcado,
 *  preservando a ordem de entrada das linhas. */
export function filtrarEdicoes<T extends { edicao: string }>(
  linhas: T[], edicoes: readonly EdicaoSerie[],
): T[] {
  const marcadas = new Set<string>(edicoes);
  return linhas.filter((l) => marcadas.has(l.edicao));
}

/** Edição imediatamente anterior na série COMPLETA (1991 -> 1980; 1980 -> null) --
 *  independente do subconjunto marcado, usada para localizar o ponto de comparação anterior
 *  na cronologia real. */
export function edicaoAnterior(e: EdicaoSerie): EdicaoSerie | null {
  const i = EDICOES_SERIE.indexOf(e);
  return i > 0 ? EDICOES_SERIE[i - 1] : null;
}

/** Slot de cor de uma edição: seu índice na constante COMPLETA `EDICOES_SERIE`, nunca no
 *  subconjunto marcado -- garante que a cor de cada edição não muda quando outras são
 *  marcadas/desmarcadas. */
export const slotEdicao = (e: EdicaoSerie): number => EDICOES_SERIE.indexOf(e);

/** Rótulo do intervalo marcado: "1991→2022" (primeira -> última edição marcada). Uma só
 *  edição marcada devolve só ela: "2022". */
export function rotuloIntervalo(edicoes: readonly EdicaoSerie[]): string {
  if (edicoes.length === 0) return "";
  const primeira = edicoes[0];
  const ultima = edicoes[edicoes.length - 1];
  return primeira === ultima ? primeira : `${primeira}→${ultima}`;
}

// --------------------------------------------------------------------------------------
// Tipologia de Baeninger sobre o IEM (porte de comparabilidade_regras.py)
// --------------------------------------------------------------------------------------

export const IEM_LIMIAR_ROTATIVIDADE = 0.15;
export const IEM_LIMIAR_FORTE = 1 / 3;

export type TipoIEM =
  | "rotatividade" | "absorcao" | "absorcao_forte" | "evasao" | "evasao_forte" | "indefinido";

/** Nomes em português da tipologia (R3 do documento de desenho) -- os MESMOS nomes usados
 *  no mapa (seção 4.2) e na frase-síntese: painel, mapa e frase nunca podem divergir. */
export const NOME_TIPO_IEM: Record<TipoIEM, string> = {
  rotatividade: "rotatividade",
  absorcao: "absorção",
  absorcao_forte: "absorção forte",
  evasao: "evasão",
  evasao_forte: "evasão forte",
  indefinido: "situação indefinida (amostra pequena)",
};

/** Erro-padrão do IEM pelo método delta (porte de `se_iem` em comparabilidade_regras.py). */
export function seIem(
  imig: number, emig: number, seImig: number | null, seEmig: number | null,
): number | null {
  if (seImig == null || seEmig == null) return null;
  const t = imig + emig;
  if (t <= 0) return null;
  return (2 * Math.sqrt((emig * seImig) ** 2 + (imig * seEmig) ** 2)) / (t * t);
}

/** Tipologia de Baeninger com guarda estatística (porte de `classificar_iem`). Em 1980, `se`
 *  é sempre null (a edição não publica erro amostral): a tipologia sai sem guarda, com a nota
 *  `iem_sem_guarda_1980`. */
export function classificarIem(
  iem: number | null | undefined, se: number | null | undefined = null, z = 1.96,
): TipoIEM | null {
  if (iem == null) return null;
  const a = Math.abs(iem);
  if (a < IEM_LIMIAR_ROTATIVIDADE) return "rotatividade";
  if (se != null && a < z * se) return "indefinido";
  const forte = a >= IEM_LIMIAR_FORTE;
  if (iem > 0) return forte ? "absorcao_forte" : "absorcao";
  return forte ? "evasao_forte" : "evasao";
}

/** Tipo de fluxo migratório predominante: leitura simplificada e legível que combina as duas
 *  medidas de alcance já publicadas no Bloco 1 -- distância média (`distancia_media`, em METROS)
 *  e % que cruza a UF (`pct_interestadual`) -- num único rótulo categórico, em vez de dois
 *  números lidos separadamente. Não é uma nova estimativa a partir de microdados: é só uma
 *  classificação de exibição sobre valores já calculados e já auditados.
 *
 *  Limiares fixos, editoriais (não calibrados estatisticamente contra a distribuição dos
 *  municípios) -- documentados no glossário (`tipo_fluxo_predominante`):
 *  - `LIMIAR_DISTANCIA_LONGA_KM = 200`: acima disso, "longa distância"; abaixo, "curta distância".
 *  - `LIMIAR_INTERESTADUAL_PCT = 50`: maioria simples do volume cruzando UF = "interestadual"
 *    predominante; do contrário, "intraestadual" predominante. Esta parte não é arbitrária --
 *    é maioria de um total que já soma 100%. */
export const LIMIAR_DISTANCIA_LONGA_KM = 200;
export const LIMIAR_INTERESTADUAL_PCT = 50;

export type TipoFluxoPredominante = "curta_intra" | "curta_inter" | "longa_intra" | "longa_inter";

export const ROTULO_TIPO_FLUXO: Record<TipoFluxoPredominante, string> = {
  curta_intra: "Curta distância, intraestadual",
  curta_inter: "Curta distância, interestadual",
  longa_intra: "Longa distância, intraestadual",
  longa_inter: "Longa distância, interestadual",
};

export function tipoFluxoPredominante(
  distanciaMediaMetros: number | null | undefined,
  pctInterestadual: number | null | undefined,
): { chave: TipoFluxoPredominante; rotulo: string } | null {
  if (distanciaMediaMetros == null || pctInterestadual == null) return null;
  const longa = distanciaMediaMetros / 1000 >= LIMIAR_DISTANCIA_LONGA_KM;
  const interestadual = pctInterestadual >= LIMIAR_INTERESTADUAL_PCT;
  const chave: TipoFluxoPredominante = longa
    ? (interestadual ? "longa_inter" : "longa_intra")
    : (interestadual ? "curta_inter" : "curta_intra");
  return { chave, rotulo: ROTULO_TIPO_FLUXO[chave] };
}

/** `pct_interestadual` chega de `unidades_serie.parquet` como FRAÇÃO (0-1); o front trabalha em
 *  percentual (0-100), como a tabela e `LIMIAR_INTERESTADUAL_PCT`. Converte uma vez, na leitura. */
export const fracaoParaPct = (v: number | null | undefined): number | null =>
  v == null ? null : v * 100;

/** Linha de `unidades_serie` já com `pct_interestadual` em percentual. Chamar UMA vez por linha
 *  lida (nunca em cima de uma linha já normalizada: multiplicaria de novo por 100). */
export function normalizarLinhaUnidade<T extends { pct_interestadual?: number | null }>(l: T): T {
  return { ...l, pct_interestadual: fracaoParaPct(l.pct_interestadual) };
}

// --------------------------------------------------------------------------------------
// Harmonização de vocabulário (porte parcial: só `status`, o único usado hoje pelo front)
// --------------------------------------------------------------------------------------

const PARCELAS_STATUS_2022 = ["primeira_saida", "etapas_multiplas"] as const;
const ALVO_STATUS = "nao_natural";

/** Reduz o vocabulário de `status` de 2022 ao vocabulário comum às cinco edições:
 *  `primeira_saida` + `etapas_multiplas` -> `nao_natural`. Se qualquer parcela for `null`
 *  (suprimida), o resultado é `null` -- nunca a soma parcial. Edições != "2022" são
 *  devolvidas sem alteração (porte de `harmonizar_status`). */
export function harmonizarStatus(
  valores: Record<string, number | null>, edicaoAlvo: EdicaoSerie,
): Record<string, number | null> {
  if (edicaoAlvo !== "2022") return { ...valores };
  const out: Record<string, number | null> = {};
  for (const [k, v] of Object.entries(valores)) {
    if (!(PARCELAS_STATUS_2022 as readonly string[]).includes(k)) out[k] = v;
  }
  const parcelas = PARCELAS_STATUS_2022.map((p) => valores[p]);
  const algumaPresente = PARCELAS_STATUS_2022.some((p) => p in valores);
  if (algumaPresente) {
    out[ALVO_STATUS] = parcelas.some((p) => p == null)
      ? null
      : parcelas.reduce((acc: number, p) => acc + (p ?? 0), 0);
  }
  return out;
}

/** O que uma barra de status migratório de UMA edição pode mostrar (Bloco 4).
 *
 *  `valores` vazio + `motivo` = a barra NÃO é desenhada e o motivo aparece no lugar. Regras:
 *  - a unidade não existia / não tem cobertura / cobertura insuficiente na edição (`estadoUnidade`,
 *    vindo de `unidades_serie`): sem barra, mesmo que existam linhas de perfil -- o número não é
 *    comparável. O motivo vem da unidade, nunca do rótulo da edição;
 *  - categoria DOMINANTE ausente (`nao_natural`, depois da harmonização -- em 2022 a soma
 *    `primeira_saida + etapas_multiplas` é `null` se qualquer parcela foi suprimida): sem barra,
 *    "suprimido". Renormalizar só com o que sobrou (retorno, exterior, outros) desenharia uma barra
 *    de 100% que não existe. */
export function perfilStatusDaEdicao(
  brutos: Record<string, number | null>, edicao: EdicaoSerie, estadoUnidade: EstadoCelula,
): { valores: Record<string, number>; motivo: EstadoCelula | null } {
  if (estadoUnidade === "nao_existia" || estadoUnidade === "sem_cobertura"
      || estadoUnidade === "cobertura_insuficiente") {
    return { valores: {}, motivo: estadoUnidade };
  }
  const harmonizado = harmonizarStatus(brutos, edicao);
  const valores: Record<string, number> = {};
  for (const [k, v] of Object.entries(harmonizado)) if (v != null) valores[k] = v;
  if (Object.keys(valores).length === 0) return { valores: {}, motivo: "suprimido" };
  if (harmonizado[ALVO_STATUS] == null) return { valores: {}, motivo: "suprimido" };
  return { valores, motivo: null };
}

// --------------------------------------------------------------------------------------
// Helpers de variação
// --------------------------------------------------------------------------------------

export const variacaoPP = (a: number | null, b: number | null): number | null =>
  a == null || b == null ? null : b - a;

export const variacaoPorMil = (a: number | null, b: number | null): number | null =>
  a == null || b == null ? null : b - a;

export const razao = (a: number | null, b: number | null): number | null =>
  a == null || b == null || a === 0 ? null : b / a;

// --------------------------------------------------------------------------------------
// Quebras fixas de cartografia (seção 4.2 do documento de desenho)
// --------------------------------------------------------------------------------------

/** As mesmas quebras valem para a escala de cor do mapa comparativo E para a classificação
 *  textual (iem reaproveita IEM_LIMIAR_ROTATIVIDADE/IEM_LIMIAR_FORTE, mais o corte superior
 *  de 0,60 que só o mapa usa). `corDivergente()`/`escalas.ts` já aceita um array de 3
 *  quebras crescentes; tbi/tbe usam 4 quebras (5 classes sequenciais). */
export const QUEBRAS_FIXAS = {
  iem: [IEM_LIMIAR_ROTATIVIDADE, IEM_LIMIAR_FORTE, 0.6] as const,
  tlm: [10, 30, 80] as const,
  tbi: [25, 50, 80, 130] as const,
  tbe: [25, 50, 80, 130] as const,
};

/** Índice de classe (0..4) para uma escala sequencial de 5 classes com 4 quebras -- usada
 *  por tbi/tbe com as rampas AZUL/LARANJA de `paletas.ts` (seção 4.3: nenhuma cor nova). */
export function classeSequencial(v: number | null, quebras: readonly number[]): number {
  if (v == null || !isFinite(v)) return 0;
  let i = 0;
  while (i < quebras.length && v >= quebras[i]) i++;
  return i;
}

// --------------------------------------------------------------------------------------
// As três tramas de ausência (seção 4.4)
// --------------------------------------------------------------------------------------

export type EstadoCelula =
  | "numero" | "nao_existia" | "sem_cobertura" | "cobertura_insuficiente"
  | "suprimido" | "nao_medido" | "nao_comparavel";

export type Trama = "diagonal" | "cruzada" | "pontilhada" | null;

/** Mapeia o estado de uma célula para a trama que a representa (seção 4.4): diagonal = "o
 *  território não é comparável"; cruzada = "há dado, mas não pode ser publicado" (sigilo);
 *  pontilhada = "o censo não mediu" (questionário). `nao_comparavel` (ausência da MEDIDA,
 *  não do dado) e `numero` não têm trama. */
export function tramaDoEstado(estado: EstadoCelula): Trama {
  switch (estado) {
    case "nao_existia":
    case "sem_cobertura":
    case "cobertura_insuficiente":
      return "diagonal";
    case "suprimido":
      return "cruzada";
    case "nao_medido":
      return "pontilhada";
    default:
      return null;
  }
}

/** No mapa comparativo há um estado a mais que na tabela: `indefinido` -- há número de IEM, mas a
 *  margem de erro (z·se) é maior que o valor (`classificarIem`), então pintá-lo como absorção ou
 *  evasão seria afirmar o que a amostra não sustenta. Trama própria (horizontal), sem cor de valor:
 *  um cinza sólido colidiria com a classe "rotatividade" (seção 4.4). */
export type EstadoMapa = EstadoCelula | "indefinido";
export type TramaMapa = NonNullable<Trama> | "horizontal";

export function tramaDoEstadoMapa(estado: EstadoMapa): TramaMapa | null {
  return estado === "indefinido" ? "horizontal" : tramaDoEstado(estado);
}

export interface LinhaEstadoMapa {
  existia?: boolean | null; estado_cobertura?: string | null; rm_unitaria?: boolean | null;
  se_iem?: number | null;
}

/** Estado de uma unidade num painel do mapa comparativo. `linha` ausente = a unidade não tem
 *  linha na série desta edição ("não medido"). `valor` = valor da medida pintada (null =
 *  suprimido). `se_iem` só entra quando a medida é o IEM e o campo veio na consulta. */
export function estadoNoMapa(
  linha: LinhaEstadoMapa | undefined, medida: string, valor: number | null,
): EstadoMapa {
  if (!linha) return "nao_medido";
  if (linha.existia === false) return "nao_existia";
  if (linha.estado_cobertura === "sem_cobertura") return "sem_cobertura";
  if (linha.estado_cobertura === "insuficiente") return "cobertura_insuficiente";
  if (linha.rm_unitaria) return "cobertura_insuficiente";
  if (valor == null) return "suprimido";
  if (medida === "iem" && classificarIem(valor, linha.se_iem ?? null) === "indefinido") return "indefinido";
  return "numero";
}

const nf0q = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

/** Quebra fixa em texto pt-BR: IEM com duas casas (0,15 · 0,33 · 0,60 -- nunca 0.3333333333333333),
 *  demais medidas (‰) inteiras. */
export const formatarQuebra = (medida: string, v: number): string =>
  medida === "iem" ? nf2.format(v) : nf0q.format(v);

/** Palavra curta exibida na célula/ponto quando não há número (regra: nunca "0" nem "—"
 *  sozinho). */
export const PALAVRA_ESTADO: Record<EstadoCelula, string> = {
  numero: "",
  nao_existia: "não existia",
  sem_cobertura: "sem cobertura",
  cobertura_insuficiente: "cobertura insuficiente",
  suprimido: "suprimido",
  nao_medido: "não medido",
  nao_comparavel: "não comparável",
};

// --------------------------------------------------------------------------------------
// comparabilidade.json (matriz medida x edição x nível) -- espelha
// pipeline/comparabilidade_regras.py `payload()`
// --------------------------------------------------------------------------------------

export interface RegraComparabilidade {
  medida: string;
  edicao: EdicaoSerie;
  nivel: NivelSerie;
  estado: "comparavel" | "comparavel_com_ressalva" | "nao_comparavel";
  nota: string | null;
}

export interface MedidaComparabilidade {
  chave: string;
  rotulo: string;
  bloco: number;
  formula: string;
  referencia: string;
  niveis: string[];
  entre_niveis: boolean;
  requer: string[];
  calibracao_1980: string | null;
}

export interface Comparabilidade {
  edicoes: string[];
  niveis: string[];
  medidas: MedidaComparabilidade[];
  matriz: RegraComparabilidade[];
  entre_niveis: { livres: string[]; presas_ao_nivel: string[]; nota: string; min_unidades_mei: number };
  cobertura: { limiar: number; min_municipios_rm_intra: number; estados: string[]; niveis_agregados: string[] };
  calibracao_1980: Record<string, { fator: number; por_nivel: Record<string, number>; tipo: string;
    aplicar: boolean; origem: string; sentido: string }>;
  calibracao_1980_e_piso: boolean;
  harmonizacao: Record<string, unknown>;
  tipologia_iem: { limiar_rotatividade: number; limiar_forte: number; guarda_z: number;
    classes: string[]; referencia: string };
  notas: Record<string, string>;
}

let comparabilidadeCache: Promise<Comparabilidade> | null = null;

/** Carrega `data/series/comparabilidade.json` uma única vez (memoizado). */
export function carregarComparabilidade(basePath = "data/series/"): Promise<Comparabilidade> {
  if (!comparabilidadeCache) {
    comparabilidadeCache = fetch(`${basePath}comparabilidade.json`).then((r) => {
      if (!r.ok) throw new Error(`comparabilidade.json: ${r.status}`);
      return r.json() as Promise<Comparabilidade>;
    }).catch((e: unknown) => {
      comparabilidadeCache = null; // uma falha de rede não pode ficar memoizada para sempre
      throw e;
    });
  }
  return comparabilidadeCache;
}

/** Estado de comparabilidade de uma célula (medida x edição x nível), lido da matriz. */
export function estadoDaCelula(
  comp: Comparabilidade, medida: string, edicao: EdicaoSerie, nivel: NivelSerie,
): RegraComparabilidade | null {
  return comp.matriz.find((r) => r.medida === medida && r.edicao === edicao && r.nivel === nivel) ?? null;
}

/** Ressalvas de comparabilidade de um conjunto de medidas de uma unidade: junta, por nota
 *  (`comparabilidade.json -> notas`), as medidas e as edições em que ela vale. Só conta as
 *  edições em que a unidade tem número (`edicoesComNumero`) -- uma ressalva sobre uma célula que
 *  aparece como "não existia" não diz nada ao leitor. Ordem das notas = ordem das medidas. */
export function ressalvasDoBloco(
  comp: Comparabilidade, nivel: NivelSerie,
  medidas: readonly { medidaComp: string; rotulo: string }[],
  edicoes: readonly EdicaoSerie[], edicoesComNumero: ReadonlySet<EdicaoSerie>,
): { nota: string; texto: string; medidas: string[]; edicoes: EdicaoSerie[] }[] {
  const porNota = new Map<string, { medidas: Set<string>; edicoes: Set<EdicaoSerie> }>();
  for (const m of medidas) {
    for (const e of edicoes) {
      if (!edicoesComNumero.has(e)) continue;
      const regra = estadoDaCelula(comp, m.medidaComp, e, nivel);
      if (!regra?.nota || regra.estado === "comparavel") continue;
      const g = porNota.get(regra.nota) ?? { medidas: new Set<string>(), edicoes: new Set<EdicaoSerie>() };
      g.medidas.add(m.rotulo);
      g.edicoes.add(e);
      porNota.set(regra.nota, g);
    }
  }
  return [...porNota.entries()].map(([nota, g]) => ({
    nota, texto: comp.notas[nota] ?? nota, medidas: [...g.medidas],
    edicoes: EDICOES_SERIE.filter((e) => g.edicoes.has(e)),
  }));
}

// --------------------------------------------------------------------------------------
// Bloco 3: ordem dos parceiros
// --------------------------------------------------------------------------------------

/** Ordena parceiros pelo posto na edição mais recente MARCADA, desempatando pelas anteriores
 *  (seção 3.3-a do desenho: "ordenadas pelo posto na edição mais recente com número"). Posto
 *  ausente (não existia, suprimido) vale +infinito: quem não tem número na edição mais recente
 *  vem depois de todo mundo que tem, e é ordenado entre si pela edição anterior. Último desempate:
 *  nome. Ordenar ANTES de cortar a lista -- cortar pela ordem de chegada da consulta (edição mais
 *  antiga primeiro) descartava o principal parceiro de 2022. */
export function ordenarPorPostoRecente<T extends { nome: string }>(
  itens: readonly T[], edicoes: readonly EdicaoSerie[],
  postoEm: (item: T, edicao: EdicaoSerie) => number | null | undefined,
): T[] {
  const maisRecentePrimeiro = [...edicoes].reverse();
  return [...itens].sort((a, b) => {
    for (const e of maisRecentePrimeiro) {
      const pa = postoEm(a, e) ?? Infinity;
      const pb = postoEm(b, e) ?? Infinity;
      if (pa !== pb) return pa < pb ? -1 : 1;
    }
    return a.nome.localeCompare(b.nome, "pt-BR");
  });
}

// --------------------------------------------------------------------------------------
// Sparkline: geometria compartilhada por `SerieCensos` (coluna "tend.") e `ResumoSerie` (cards)
// --------------------------------------------------------------------------------------

export interface GeometriaSpark {
  /** Trechos CONTÍGUOS de pelo menos 2 pontos: uma lacuna (valor nulo) sempre abre a linha. */
  segmentos: { x: number; y: number }[][];
  /** Um ponto por valor presente -- inclusive quando só há um, que não forma segmento. */
  pontos: { x: number; y: number; i: number }[];
  /** Posições nulas (não interpoladas): o componente desenha a marca de ausência. */
  ausentes: { x: number; i: number }[];
}

/** Posições fixas e equidistantes (uma por edição), zero sempre incluído na escala vertical. */
export function geometriaSpark(
  valores: readonly (number | null)[], largura: number, altura: number, margem = 3,
): GeometriaSpark {
  const validos = valores.filter((v): v is number => v != null && isFinite(v));
  const min = Math.min(0, ...validos), max = Math.max(0, ...validos);
  const span = max - min || 1;
  const n = valores.length;
  const x = (i: number) => (n <= 1 ? largura / 2 : margem + (i * (largura - 2 * margem)) / (n - 1));
  const y = (v: number) => margem + (1 - (v - min) / span) * (altura - 2 * margem);
  const segmentos: { x: number; y: number }[][] = [];
  const pontos: GeometriaSpark["pontos"] = [];
  const ausentes: GeometriaSpark["ausentes"] = [];
  let trecho: { x: number; y: number }[] = [];
  const fecha = () => { if (trecho.length >= 2) segmentos.push(trecho); trecho = []; };
  valores.forEach((v, i) => {
    if (v == null || !isFinite(v)) { ausentes.push({ x: x(i), i }); fecha(); return; }
    const p = { x: x(i), y: y(v) };
    pontos.push({ ...p, i });
    trecho.push(p);
  });
  fecha();
  return { segmentos, pontos, ausentes };
}

// --------------------------------------------------------------------------------------
// Frase-síntese (`fraseSintese()`, seção 2 do documento de desenho)
// --------------------------------------------------------------------------------------

export interface PontoFrase {
  edicao: EdicaoSerie;
  estado: "numero" | "nao_existia" | "sem_cobertura" | "cobertura_insuficiente" | "suprimido" | "nao_medido";
  iem: number | null;
  seIem: number | null;
  tipo: TipoIEM | null;
  imig: number | null;
  emig: number | null;
  saldo: number | null;
  tlm: number | null;
  /** Taxas brutas (‰): opcionais -- só o complemento por taxa (município-mãe) as usa. */
  tbi?: number | null;
  tbe?: number | null;
  coberturaPop: number | null;
}

export interface EntradaFrase {
  nome: string;
  nivel: NivelSerie;
  pontos: PontoFrase[];
  /** Município de origem quando esta unidade não existia em alguma edição marcada (ver
   *  `maeDaSerie`). `agregada`: o código da mãe não é numérico (unidade agregada da edição --
   *  mecanismo genérico, hoje inativo: nenhuma edição declara uma desde 1.1.0-1980) -- a frase
   *  diz "publicado agregado em", NÃO "foi criado depois de": a coluna segue sem número, mas
   *  não se afirma criação posterior. `ultimaEdicaoAusente` = edição mais recente (da série
   *  completa) em que a unidade ainda não existia. */
  mae?: {
    nome: string; edicoes: string[]; agregada: boolean; codigo?: string; ultimaEdicaoAusente?: string;
  };
  /** Municípios desmembrados DESTE (município-mãe). `ultimaEdicaoJunto` ausente = sem ano
   *  confiável na fonte: a frase omite o "Até {ano}" em vez de inventar um. */
  filhos?: { nomes: string[]; ultimaEdicaoJunto?: string };
  rmUnitaria?: EdicaoSerie[];
}

/** Campos de `unidades_serie` que a frase lê (tipos soltos: vêm do DuckDB como `unknown`). */
export interface LinhaSerieFrase {
  edicao: EdicaoSerie;
  imig: number | null; emig: number | null; saldo: number | null; tlm: number | null;
  tbi?: number | null; tbe?: number | null;
  iem: number | null; se_iem: number | null;
  existia: boolean | null; estado_cobertura: string | null;
  cobertura_pop?: number | null;
  cd_mun_mae?: string | null; nm_mun_mae?: string | null;
}

/** Estado de uma linha da série para a FRASE (não para uma medida qualquer da tabela): sem `iem`
 *  publicável a edição não entra como "numero" -- a frase nunca ancora em célula vazia. */
export function estadoDaLinha(l: LinhaSerieFrase): PontoFrase["estado"] {
  if (l.existia === false) return "nao_existia";
  if (l.estado_cobertura === "sem_cobertura") return "sem_cobertura";
  if (l.estado_cobertura === "insuficiente") return "cobertura_insuficiente";
  if (l.iem == null) return "suprimido";
  return "numero";
}

/** Pontos da frase, um por edição marcada, em ordem cronológica. Edição sem linha = "nao_medido". */
export function pontosDaSerie(
  linhas: readonly LinhaSerieFrase[], edicoes: readonly EdicaoSerie[],
): PontoFrase[] {
  const porEdicao = new Map(linhas.map((l) => [l.edicao, l]));
  return edicoes.map((edicao): PontoFrase => {
    const l = porEdicao.get(edicao);
    if (!l) {
      return { edicao, estado: "nao_medido", iem: null, seIem: null, tipo: null, imig: null,
               emig: null, saldo: null, tlm: null, tbi: null, tbe: null, coberturaPop: null };
    }
    const estado = estadoDaLinha(l);
    const num = estado === "numero";
    return {
      edicao, estado,
      iem: num ? l.iem : null,
      seIem: l.se_iem ?? null,
      tipo: num ? classificarIem(l.iem, l.se_iem) : null,
      imig: num ? l.imig : null, emig: num ? l.emig : null,
      saldo: num ? l.saldo : null, tlm: num ? l.tlm : null,
      tbi: num ? (l.tbi ?? null) : null, tbe: num ? (l.tbe ?? null) : null,
      coberturaPop: l.cobertura_pop ?? null,
    };
  });
}

const ehCodigoNumerico = (c: string): boolean => /^\d+$/.test(c);

/** Município de origem (mãe) da unidade, para o prefixo "foi criado depois de …".
 *
 *  Só existe se ALGUMA edição marcada é `existia = false` (senão a série marcada é completa e
 *  não há o que dizer). A mãe é a da edição MAIS RECENTE da série completa em que a unidade ainda
 *  não existia -- a que cedeu o território por último -- e não a da primeira edição com mãe: para
 *  ~137 municípios a mãe muda entre edições (a mãe de 1980 de um município criado em 2013 pode ser
 *  uma terceira, que já tinha perdido o território antes). `agregada`: o código da mãe não é
 *  numérico (unidade agregada da edição; caso genérico, hoje inativo). */
export function maeDaSerie(
  linhas: readonly Pick<LinhaSerieFrase, "edicao" | "existia" | "cd_mun_mae" | "nm_mun_mae">[],
  edicoesMarcadas: readonly EdicaoSerie[],
): NonNullable<EntradaFrase["mae"]> | undefined {
  const ausentes = linhas
    .filter((l) => l.existia === false && l.cd_mun_mae)
    .sort((a, b) => EDICOES_SERIE.indexOf(a.edicao) - EDICOES_SERIE.indexOf(b.edicao));
  if (!ausentes.some((l) => edicoesMarcadas.includes(l.edicao))) return undefined;
  const ultima = ausentes[ausentes.length - 1];
  const codigo = ultima.cd_mun_mae!;
  return {
    codigo,
    nome: ultima.nm_mun_mae ?? codigo,
    edicoes: ausentes
      .filter((l) => l.cd_mun_mae === codigo && edicoesMarcadas.includes(l.edicao))
      .map((l) => l.edicao),
    ultimaEdicaoAusente: ultima.edicao,
    agregada: !ehCodigoNumerico(codigo),
  };
}

export interface FilhoMunicipio {
  codigo: string; nome?: string | null; ultima_edicao_ausente?: string | null;
}

/** Filhos (municípios desmembrados deste) que entram na frase de município-mãe: só aqueles cuja
 *  separação cai DENTRO do intervalo das edições marcadas. O filho existe desde a edição seguinte
 *  a `ultima_edicao_ausente`; a separação fica dentro da janela [primeira, última] marcada quando
 *  `primeira <= ultima_edicao_ausente < última` -- antes disso aconteceu antes da janela (o
 *  primeiro ponto já vem sem o território), depois aconteceu depois dela. Sem
 *  `ultima_edicao_ausente` na fonte não dá para localizar: o filho entra (não some em silêncio).
 *  `ultimaEdicaoJunto` = a MENOR `ultima_edicao_ausente` do grupo: até essa edição a mãe incluía
 *  todos os territórios listados (valeria mais para alguns, mas nunca menos). */
export function filhosNoIntervalo(
  filhos: readonly FilhoMunicipio[], edicoesMarcadas: readonly EdicaoSerie[],
): NonNullable<EntradaFrase["filhos"]> | undefined {
  if (edicoesMarcadas.length === 0) return undefined;
  const primeira = EDICOES_SERIE.indexOf(edicoesMarcadas[0]);
  const ultima = EDICOES_SERIE.indexOf(edicoesMarcadas[edicoesMarcadas.length - 1]);
  const dentro = filhos.filter((f) => {
    if (!f.ultima_edicao_ausente) return true;
    const i = EDICOES_SERIE.indexOf(f.ultima_edicao_ausente as EdicaoSerie);
    return i >= primeira && i < ultima;
  });
  if (dentro.length === 0) return undefined;
  const nomes = dentro.map((f) => f.nome ?? f.codigo);
  const datadas = dentro
    .map((f) => f.ultima_edicao_ausente)
    .filter((e): e is string => Boolean(e))
    .sort((a, b) => EDICOES_SERIE.indexOf(a as EdicaoSerie) - EDICOES_SERIE.indexOf(b as EdicaoSerie));
  return { nomes, ultimaEdicaoJunto: datadas[0] };
}

const nf2 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** IEM em texto (R5): sinal tipográfico explícito e duas casas em pt-BR -- `+0,24`, `−0,08`,
 *  `0,00`. Único formatador do IEM da seção (frase, cards, tabela): nunca `toFixed` cru, que
 *  devolve ponto decimal e hífen. */
export const formatarIem = (v: number | null | undefined): string => {
  if (v == null) return "—";
  // sinal decidido sobre o valor ARREDONDADO: -0,001 vira "0,00", não "−0,00"
  const r = Math.round(v * 100);
  const s = r > 0 ? "+" : r < 0 ? "−" : "";
  return `${s}${nf2.format(Math.abs(v))}`;
};
const fmtIem = formatarIem;

const nf0 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const numFrase = (v: number | null): string => (v == null ? "—" : nf0.format(Math.abs(v)));

type Direcao = "up" | "down" | "flat";
function direcao(ini: number | null, fim: number | null): Direcao {
  if (ini == null || fim == null || ini === 0) return "flat";
  const delta = (fim - ini) / Math.abs(ini);
  if (delta > 0.1) return "up";
  if (delta < -0.1) return "down";
  return "flat";
}

/** Tabela de complemento por direção de imig/emig (R4).
 *
 *  Com `porTaxa` (município-mãe) compara as TAXAS brutas (tbi/tbe), que sofrem menos com o degrau
 *  de fronteira do que os volumes, e só então o complemento leva o sufixo sobre a fronteira --
 *  o texto descreve o que foi de fato calculado. Se faltar alguma das quatro taxas nas pontas,
 *  volta aos volumes e NÃO afirma desconto nenhum (o prefixo de município-mãe já avisa que parte
 *  da variação de volume é fronteira). Versão anterior comparava `tlm` no lugar de `tbi` e
 *  dizia "descontada a mudança de fronteira" sem ter calculado nada disso. */
function complemento(ini: PontoFrase, fim: PontoFrase, porTaxa = false): string {
  const temTaxas = porTaxa && ini.tbi != null && fim.tbi != null && ini.tbe != null && fim.tbe != null;
  const dImig = temTaxas ? direcao(ini.tbi!, fim.tbi!) : direcao(ini.imig, fim.imig);
  const dEmig = temTaxas ? direcao(ini.tbe!, fim.tbe!) : direcao(ini.emig, fim.emig);
  const chave = `${dImig}_${dEmig}`;
  const tabela: Record<string, string> = {
    up_up: "chega mais gente do que antes, e sai mais também",
    flat_up: "continua recebendo gente, mas agora perde quase o mesmo tanto",
    down_up: "chega menos gente e sai mais",
    up_flat: "chega mais gente e a saída não acompanhou",
    flat_flat: "entradas e saídas mudaram pouco",
    down_flat: "chega menos gente do que antes",
    up_down: "chega mais gente e sai menos",
    flat_down: "sai menos gente do que antes",
    down_down: "entram e saem menos pessoas do que antes",
  };
  const texto = tabela[chave] ?? "entradas e saídas mudaram pouco";
  return temTaxas ? `${texto} — pelas taxas, que descontam em parte a mudança de fronteira` : texto;
}

/** R7: ressalva de proxy, obrigatória quando `ini.edicao === "1980"`. */
function ressalvaProxy(ini: PontoFrase, fim: PontoFrase): string | null {
  if (ini.edicao !== "1980") return null;
  if (fim.edicao === "1980") {
    return "Este número é uma estimativa por proxy, não uma medida direta.";
  }
  return "O ponto de 1980 é uma estimativa por proxy, que tende a aproximar o índice de zero " +
    "— a mudança real pode ser maior.";
}

/** R8: ressalva de cobertura, uma frase por conjunto de edições insuficientes/sem cobertura
 *  entre 1980 e `fim`, mais o caso de RM unitária. */
function ressalvaCobertura(entrada: EntradaFrase, fim: PontoFrase): string | null {
  const anos = entrada.pontos
    .filter((p) => EDICOES_SERIE.indexOf(p.edicao) <= EDICOES_SERIE.indexOf(fim.edicao))
    .filter((p) => p.estado === "cobertura_insuficiente" || p.estado === "sem_cobertura")
    .map((p) => p.edicao);
  const partes: string[] = [];
  if (anos.length > 0) {
    const lista = anos.join(", ");
    const plural = anos.length > 1;
    partes.push(
      `Em ${lista} menos de 90% da população de hoje estava coberta pelos municípios da ` +
      `época; não há número para ${plural ? "esses anos" : "esse ano"}.`,
    );
  }
  if (entrada.rmUnitaria && entrada.rmUnitaria.length > 0) {
    partes.push(
      `Em ${entrada.rmUnitaria.join(", ")} a região tinha um só município: os indicadores ` +
      "internos não existem, não são zero.",
    );
  }
  return partes.length > 0 ? partes.join(" ") : null;
}

function prefixoTruncamento(entrada: EntradaFrase): string | null {
  if (!entrada.mae) return null;
  // Mãe de código não numérico = unidade agregada da edição (caso genérico, hoje inativo): o
  // território É publicado, só que junto com outros. A coluna da edição fica sem número, mas a
  // frase NÃO afirma "foi criado depois de" -- não se sabe (nem se diz) quando a separação
  // aconteceu.
  if (entrada.mae.agregada) {
    const anos = entrada.mae.edicoes.length > 0 ? `Em ${entrada.mae.edicoes.join(", ")}` : "Em edições anteriores";
    return `${anos}, ${entrada.nome} não tem número próprio: o território é publicado agregado em ` +
      `${entrada.mae.nome}.`;
  }
  // O município foi criado DEPOIS da ÚLTIMA edição em que ainda não existia -- não da primeira
  // (bug da auditoria F12.6-aud: `.find` pegava a primeira ocorrência de `nao_existia`, dizendo
  // "criado depois de 1980" para ~1.070 municípios criados em 1991, 2000 ou 2010). A mãe certa é
  // a da MESMA edição (`maeDaSerie` já a escolhe assim): a mãe de 1980 de um município criado em
  // 2013 pode ser uma terceira, que já tinha cedido o território antes. `ultimaEdicaoAusente`
  // vem da série completa; sem ela, cai no último ponto `nao_existia` das edições marcadas.
  const semExistir = entrada.pontos.filter((p) => p.estado === "nao_existia");
  const ultimaSemExistir = entrada.mae.ultimaEdicaoAusente
    ?? (semExistir.length > 0 ? semExistir[semExistir.length - 1].edicao : undefined);
  return `${entrada.nome} foi criado depois de ${ultimaSemExistir ?? entrada.mae.edicoes[entrada.mae.edicoes.length - 1]}; ` +
    `até então seu território fazia parte de ${entrada.mae.nome}.`;
}

function prefixoMae(entrada: EntradaFrase): string | null {
  if (!entrada.filhos) return null;
  const nomes = entrada.filhos.nomes.length > 3
    ? `${entrada.filhos.nomes.slice(0, 3).join(", ")} e outros`
    : entrada.filhos.nomes.join(" e ");
  const ate = entrada.filhos.ultimaEdicaoJunto ? `Até ${entrada.filhos.ultimaEdicaoJunto}, ` : "Antes, ";
  return `${ate}${entrada.nome} incluía o território que hoje ` +
    `é ${nomes}; parte da variação de volume desde então é fronteira, não migração.`;
}

/** Gera a frase-síntese determinística (T1-T8), seguindo docs/design_serie_censos.md, seção 2. */
export function fraseSintese(entrada: EntradaFrase): string {
  const comNumero = entrada.pontos.filter((p) => p.estado === "numero" && p.tipo != null);

  // T6 -- nenhuma edição com número
  if (comNumero.length === 0) {
    const motivoDominante = motivoDominanteTexto(entrada.pontos);
    const abraMae = entrada.mae
      ? ` Abra a série de ${entrada.mae.nome}, ${entrada.mae.agregada
          ? "em que o território está agregado" : "de que o território fazia parte"}.`
      : "";
    return `Não há série para ${entrada.nome}: ${motivoDominante}.${abraMae}`;
  }

  let ini = comNumero[0];
  let fim = comNumero[comNumero.length - 1];

  // R2 -- guarda de "indefinido": anda para dentro do intervalo até achar tipo definido
  const indefinidoIni = () => ini.tipo === "indefinido";
  const indefinidoFim = () => fim.tipo === "indefinido";
  const candidatosDefinidos = comNumero.filter((p) => p.tipo !== "indefinido");
  if ((indefinidoIni() || indefinidoFim()) && candidatosDefinidos.length >= 2) {
    ini = candidatosDefinidos[0];
    fim = candidatosDefinidos[candidatosDefinidos.length - 1];
  }

  const porTaxa = Boolean(entrada.filhos);
  const prefixo = prefixoTruncamento(entrada) ?? prefixoMae(entrada);

  // T5 -- só uma edição com número
  if (ini === fim) {
    const outrasNota = motivoDasOutras(entrada, fim.edicao);
    const nucleo = `Só há dado para ${entrada.nome} em ${fim.edicao}: ${NOME_TIPO_IEM[fim.tipo!]} ` +
      `(IEM ${fmtIem(fim.iem)}), com ${numFrase(fim.imig)} pessoas chegando e ${numFrase(fim.emig)} ` +
      `saindo.${outrasNota ? ` ${outrasNota}` : ""}`;
    return juntar([prefixo, nucleo, ressalvaProxy(fim, fim), ressalvaCobertura(entrada, fim)]);
  }

  // T4 -- uma (ou ambas) âncoras indefinidas, sem como corrigir andando para dentro
  if (ini.tipo === "indefinido" || fim.tipo === "indefinido") {
    if (ini.tipo === "indefinido" && fim.tipo === "indefinido") {
      const lista = comNumero.map((p) => `${p.edicao}: ${fmtIem(p.iem)}`).join(", ");
      return `Em nenhum censo a amostra de ${entrada.nome} é grande o bastante para classificar ` +
        `a migração: os índices (${lista}) têm margem maior que o próprio valor.`;
    }
    const margem = ini.tipo === "indefinido"
      ? (ini.seIem != null ? `±${(1.96 * ini.seIem).toFixed(2).replace(".", ",")}` : "±—")
      : (fim.seIem != null ? `±${(1.96 * fim.seIem).toFixed(2).replace(".", ",")}` : "±—");
    return `Em ${fim.edicao}, ${entrada.nome} tem ${NOME_TIPO_IEM[fim.tipo!]}. Em ${ini.edicao} a ` +
      `amostra é pequena demais para dizer se havia ganho ou perda (IEM ${fmtIem(ini.iem)}, com ` +
      `margem de ${margem}). A comparação entre as duas pontas não é conclusiva.`;
  }

  // T8 -- 1980 é a única âncora inicial possível e a variação é menor que a incerteza do
  // proxy daquele ano. A trava é sobre a DIFERENÇA (|Δ IEM| < 0,10), não sobre "mesma classe":
  // uma variação pequena pode atravessar um limiar da tipologia (ex.: 0,14 -> 0,16, cruzando
  // 0,15) e ainda assim não ser uma tendência real -- é exatamente o caso em que afirmar
  // "passou de rotatividade para absorção" (T1) seria mais enganoso, não menos, porque soa
  // categórico sobre uma diferença ínfima. Encontrado na auditoria F12.6-aud: a versão
  // anterior só disparava quando `ini.tipo === fim.tipo`, deixando ~108 municípios (e RGIs/
  // RGInts/RMs/UF) que cruzam um limiar com Δ pequeno caírem em T1, afirmando tendência que o
  // proxy sozinho explica.
  if (ini.edicao === "1980" && Math.abs(fim.iem! - ini.iem!) < 0.1) {
    const valores = comNumero.map((p) => p.iem!).filter((v) => v != null);
    const min = Math.min(...valores);
    const max = Math.max(...valores);
    const mesmaClasse = ini.tipo === fim.tipo;
    const nucleo = mesmaClasse
      ? `${entrada.nome} aparece em ${NOME_TIPO_IEM[fim.tipo!]} em todos os censos com dado ` +
        `(IEM entre ${fmtIem(min)} e ${fmtIem(max)})`
      : `${entrada.nome} vai de ${NOME_TIPO_IEM[ini.tipo!]} (1980) a ${NOME_TIPO_IEM[fim.tipo!]} ` +
        `(${fim.edicao}), mas o IEM quase não se move (${fmtIem(ini.iem)} para ${fmtIem(fim.iem)}) -- ` +
        "a diferença atravessa um limiar da classificação sem ser, de fato, uma mudança grande";
    return juntar([
      prefixo,
      `${nucleo}. A diferença em relação a 1980 é menor que a incerteza do proxy daquele ano; ` +
      "não é seguro afirmar tendência.",
      ressalvaCobertura(entrada, fim),
    ]);
  }

  const comp = complemento(ini, fim, porTaxa);

  // T2 -- manteve a classe
  if (ini.tipo === fim.tipo) {
    const grande = Math.abs(fim.iem! - ini.iem!) >= 0.1;
    const nucleo = grande
      ? `${entrada.nome} continua em ${NOME_TIPO_IEM[fim.tipo!]}, mas ` +
        `${Math.abs(fim.iem!) < Math.abs(ini.iem!) ? "mais perto" : "mais longe"} do equilíbrio (IEM de ${fmtIem(ini.iem)} ` +
        `para ${fmtIem(fim.iem)}): ${comp}.`
      : `${entrada.nome} está em ${NOME_TIPO_IEM[fim.tipo!]} desde ${ini.edicao} (IEM de ` +
        `${fmtIem(ini.iem)} para ${fmtIem(fim.iem)}): ${comp}.`;
    return juntar([prefixo, nucleo, ressalvaProxy(ini, fim), ressalvaCobertura(entrada, fim)]);
  }

  // T1 -- mudou de classe
  const nucleo = `Entre ${ini.edicao} e ${fim.edicao}, ${entrada.nome} passou de ` +
    `${NOME_TIPO_IEM[ini.tipo!]} (IEM ${fmtIem(ini.iem)}) para ${NOME_TIPO_IEM[fim.tipo!]} ` +
    `(IEM ${fmtIem(fim.iem)}): ${comp}.`;
  return juntar([prefixo, nucleo, ressalvaProxy(ini, fim), ressalvaCobertura(entrada, fim)]);
}

function juntar(partes: (string | null)[]): string {
  return partes.filter((p): p is string => Boolean(p)).join(" ");
}

function motivoDasOutras(entrada: EntradaFrase, fimEdicao: EdicaoSerie): string | null {
  const outras = entrada.pontos.filter((p) => p.edicao !== fimEdicao);
  if (outras.length === 0) return null;
  const motivos = new Set(outras.map((p) => p.estado));
  const texto = motivos.has("nao_existia")
    ? (entrada.mae?.agregada ? `o território é publicado agregado em ${entrada.mae.nome}` : "não existia")
    : motivos.has("cobertura_insuficiente") || motivos.has("sem_cobertura") ? "a cobertura é insuficiente"
    : motivos.has("suprimido") ? "o dado foi suprimido"
    : "o dado não foi medido";
  return `Nas demais edições, ${texto}.`;
}

function motivoDominanteTexto(pontos: PontoFrase[]): string {
  const contagem = new Map<string, number>();
  for (const p of pontos) contagem.set(p.estado, (contagem.get(p.estado) ?? 0) + 1);
  const [motivo] = [...contagem.entries()].sort((a, b) => b[1] - a[1])[0] ?? ["nao_medido", 0];
  const textos: Record<string, string> = {
    nao_existia: "o território não existia como unidade em nenhuma edição com dado suficiente",
    sem_cobertura: "nenhuma edição tem cobertura territorial suficiente",
    cobertura_insuficiente: "a cobertura territorial é insuficiente em todas as edições",
    suprimido: "os fluxos foram suprimidos pelo limiar de revelação em todas as edições",
    nao_medido: "a medida não é publicada em nenhuma edição",
  };
  return textos[motivo] ?? "não há dado suficiente";
}
