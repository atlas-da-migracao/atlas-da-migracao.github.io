/** Configuração por edição do Censo no front-end -- equivalente a pipeline/edicoes.py, mas
 *  para os recursos que o app precisa saber (caminho dos dados publicados, recursos
 *  disponíveis, vocabulário de status). Cada edição publicada tem sua própria pasta em
 *  data/processed (2022 na raiz, por compatibilidade; as demais em subpasta própria) e pode
 *  não ter certos recursos -- ver docs/METODOLOGIA.md, "Edição Censo 2010 e comparabilidade".
 */
export type Censo = "2022" | "2010" | "2000";
export const CENSOS: Censo[] = ["2022", "2010", "2000"];
export const CENSO_PADRAO: Censo = "2022";

export interface Edicao {
  nome: Censo;
  /** rótulo curto (seletor do cabeçalho) */
  rotulo: string;
  /** subtítulo completo (cabeçalho principal) */
  subtitulo: string;
  periodo: { de: string; ate: string };
  /** recursos indisponíveis nesta edição (ver plano, decisão arquitetural 5) */
  recursos: {
    /** módulo metropolitano (08_metro.sql roda para esta edição e publica rm*.parquet) */
    rm: boolean;
    /** dimensão "meio de transporte" do deslocamento pendular */
    modo: boolean;
    /** tempo de deslocamento em minutos (mediana); só faixas categóricas quando false */
    tempoMinutos: boolean;
  };
  /** vocabulário (chaves de paletas.ts, NÃO chaves de dados -- `dimensao` nos dados
   *  publicados é sempre "tempo"/"frequencia" nas edições que os têm) usado para escolher
   *  qual entrada de DIMENSOES_PENDULAR exibir: 2022 usa a paleta padrão, 2010 usa a
   *  variante "*2010" (pergunta e faixas diferentes, ver docs/METODOLOGIA.md). Ausente
   *  (undefined) quando a edição não publica aquela dimensão pendular nenhuma -- 2000 não
   *  tem NENHUM quesito de tempo de deslocamento nem de frequência de retorno (diferente de
   *  2010, que tem as duas, só com vocabulário próprio; ver "Edição Censo 2000 e
   *  comparabilidade" em docs/METODOLOGIA.md). Quem lê este campo deve tratar a ausência
   *  filtrando a dimensão correspondente, nunca indexando DIMENSOES_PENDULAR com undefined. */
  vocabulario: { tempo?: "tempo" | "tempo2010"; frequencia?: "frequencia" | "frequencia2010" };
  /** rótulo da categoria "retorna" do KPI/dimensão de frequência, que muda de definição
   *  entre edições (2022: 3+ dias/semana; 2010: diariamente) -- ver DIMENSOES_PENDULAR.
   *  `null` quando a edição não tem quesito de retorno nenhum (2000). */
  rotuloRetorno: string | null;
  /** categorias de `status` publicadas nesta edição (mesma lista de
   *  pipeline/disclosure_rules.STATUS_POR_EDICAO) -- usada para restringir o seletor de
   *  recorte (Filtro) às categorias que realmente existem nos dados publicados. */
  statusCategorias: string[];
}

export const EDICOES: Record<Censo, Edicao> = {
  "2022": {
    nome: "2022",
    rotulo: "Censo 2022",
    subtitulo: "Censo 2022, data fixa 2017–2022",
    periodo: { de: "2017-07-31", ate: "2022-07-31" },
    recursos: { rm: true, modo: true, tempoMinutos: true },
    vocabulario: { tempo: "tempo", frequencia: "frequencia" },
    rotuloRetorno: "Retorna 3+ dias/semana",
    statusCategorias: ["retorno_natal", "primeira_saida", "etapas_multiplas", "nascido_exterior"],
  },
  "2010": {
    nome: "2010",
    rotulo: "Censo 2010",
    subtitulo: "Censo 2010, data fixa 2005–2010",
    periodo: { de: "2005-07-31", ate: "2010-07-31" },
    recursos: { rm: true, modo: false, tempoMinutos: false },
    vocabulario: { tempo: "tempo2010", frequencia: "frequencia2010" },
    rotuloRetorno: "Retorna diariamente",
    statusCategorias: ["retorno_natal", "nao_natural", "nascido_exterior"],
  },
  "2000": {
    nome: "2000",
    rotulo: "Censo 2000",
    subtitulo: "Censo 2000, data fixa 1995–2000",
    periodo: { de: "1995-07-31", ate: "2000-07-31" },
    // rm: o módulo metropolitano existe (08_metro.sql roda para 2000), só sem os
    // indicadores de deslocamento (pct_diario/pct_coletivo/tempo_mediano NULL, ver
    // pipeline/sql/2000/08_metro.sql). modo/tempoMinutos: inexistentes, como em 2010.
    recursos: { rm: true, modo: false, tempoMinutos: false },
    // nem tempo nem frequência existem em 2000 (um único quesito de deslocamento, sem
    // meio de transporte, sem tempo e sem frequência de retorno) -- ver
    // docs/METODOLOGIA.md, "Edição Censo 2000 e comparabilidade".
    vocabulario: {},
    rotuloRetorno: null,
    statusCategorias: ["retorno_natal", "nao_natural", "nascido_exterior"],
  },
};

export function edicao(censo: Censo): Edicao {
  return EDICOES[censo];
}

/** Caminho base (com barra final) dos dados publicados de uma edição, para fetch()/DuckDB.
 *  2022 continua servida da raiz de "data/" (compatibilidade com o deploy atual); as demais
 *  ficam em "data/<censo>/", espelhando pipeline/edicoes.py. */
export function basePath(censo: Censo): string {
  return censo === "2022" ? "data/" : `data/${censo}/`;
}
