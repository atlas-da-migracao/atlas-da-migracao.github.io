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
  coberturaPop: number | null;
}

export interface EntradaFrase {
  nome: string;
  nivel: NivelSerie;
  pontos: PontoFrase[];
  mae?: { nome: string; edicoes: string[]; agregada: boolean };
  filhos?: { nomes: string[]; ultimaEdicaoJunto: string };
  rmUnitaria?: EdicaoSerie[];
}

const fmtIem = (v: number | null): string => {
  if (v == null) return "—";
  const s = v > 0 ? "+" : v < 0 ? "−" : "";
  return `${s}${Math.abs(v).toFixed(2).replace(".", ",")}`;
};

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

/** Tabela de complemento por direção de imig/emig (R4). */
function complemento(ini: PontoFrase, fim: PontoFrase, porTaxa = false): string {
  const imigIni = porTaxa ? ini.tlm : ini.imig; // aproximação: tbi não está em PontoFrase; ver nota abaixo
  const dImig = direcao(imigIni, porTaxa ? fim.tlm : fim.imig);
  const dEmig = direcao(ini.emig, fim.emig);
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
  return porTaxa ? `${texto} — descontada a mudança de fronteira` : texto;
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
  // `entrada.pontos` está em ordem cronológica ascendente (EDICOES_SERIE: 1980..2022). O
  // município foi criado DEPOIS da ÚLTIMA edição em que ainda não existia -- não da primeira
  // (bug encontrado na auditoria F12.6-aud: `.find` pegava a primeira ocorrência de
  // `nao_existia`, dizendo "criado depois de 1980" para ~1.070 municípios cuja criação real foi
  // em 1991, 2000 ou 2010). Percorrer de trás para frente dá a última.
  const semExistir = entrada.pontos.filter((p) => p.estado === "nao_existia");
  const ultimaSemExistir = semExistir.length > 0 ? semExistir[semExistir.length - 1].edicao : undefined;
  const agregada = entrada.mae.agregada ? ", unidade agregada" : "";
  return `${entrada.nome} foi criado depois de ${ultimaSemExistir ?? entrada.mae.edicoes[entrada.mae.edicoes.length - 1]}; ` +
    `até então seu território fazia parte de ${entrada.mae.nome}${agregada}.`;
}

function prefixoMae(entrada: EntradaFrase): string | null {
  if (!entrada.filhos) return null;
  const nomes = entrada.filhos.nomes.length > 3
    ? `${entrada.filhos.nomes.slice(0, 3).join(", ")} e outros`
    : entrada.filhos.nomes.join(" e ");
  return `Até ${entrada.filhos.ultimaEdicaoJunto}, ${entrada.nome} incluía o território que hoje ` +
    `é ${nomes}; parte da variação de volume desde então é fronteira, não migração.`;
}

/** Gera a frase-síntese determinística (T1-T8), seguindo docs/design_serie_censos.md, seção 2. */
export function fraseSintese(entrada: EntradaFrase): string {
  const comNumero = entrada.pontos.filter((p) => p.estado === "numero" && p.tipo != null);

  // T6 -- nenhuma edição com número
  if (comNumero.length === 0) {
    const motivoDominante = motivoDominanteTexto(entrada.pontos);
    const abraMae = entrada.mae
      ? ` Abra a série de ${entrada.mae.nome}, de que o território fazia parte.`
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
  const texto = motivos.has("nao_existia") ? "não existia"
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
