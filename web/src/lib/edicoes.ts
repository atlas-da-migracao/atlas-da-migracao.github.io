/** Configuração por edição do Censo no front-end -- equivalente a pipeline/edicoes.py, mas
 *  para os recursos que o app precisa saber (caminho dos dados publicados, recursos
 *  disponíveis, vocabulário de status). Cada edição publicada tem sua própria pasta em
 *  data/processed (2022 na raiz, por compatibilidade; as demais em subpasta própria) e pode
 *  não ter certos recursos -- ver docs/METODOLOGIA.md, "Edição Censo 2010 e comparabilidade".
 */
export type Censo = "2022" | "2010" | "2000" | "1991" | "1980";
export const CENSOS: Censo[] = ["2022", "2010", "2000", "1991", "1980"];
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
    /** deslocamento pendular (07_pendular.sql roda para esta edição); false quando a edição
     *  não tem nenhum quesito de deslocamento (ex.: Censo 1991, ver pipeline/edicoes.py
     *  `pula_scripts`). */
    pendular: boolean;
    /** dimensão "meio de transporte" do deslocamento pendular */
    modo: boolean;
    /** tempo de deslocamento em minutos (mediana); só faixas categóricas quando false */
    tempoMinutos: boolean;
    /** dimensão de renda (pessoal e do trabalho principal, ver lib/paletas DIMENSOES.renda e
     *  DIMENSOES_PENDULAR.renda_trab); false só no Censo 1980, cuja fonte (Base dos Dados) só
     *  tem as variáveis de rendimento preenchidas no Ceará (0,0% nas outras 26 UFs) -- por isso
     *  a edição não publica nenhuma coluna de renda, nem pessoal nem do trabalho. Ver
     *  docs/METODOLOGIA.md, "Edição Censo 1980 e comparabilidade", item 7. Componentes que
     *  mostram filtro/dimensão de renda devem esconder/desabilitar quando `false`, no mesmo
     *  padrão usado para `modo`/`tempoMinutos`. */
    renda: boolean;
    /** dimensão "posição na ocupação" do deslocamento pendular de trabalho (coluna de dados
     *  `pos_grupo`, ver lib/rm.ts NomeDimensaoDados "posicao" e paletas.ts DIMENSOES_PENDULAR
     *  posicao); false só no Censo 1980, cujo questionário não distingue "empregado com
     *  carteira"/"sem carteira"/"militar estatutário" -- os únicos valores que o vocabulário
     *  do atlas usa para essa dimensão --, então `pos_grupo` fica NULL em 100% das linhas
     *  publicadas (ver pipeline/sql/1980/MAPEAMENTO_02_classify.md §6.6). Componentes que
     *  mostram a dimensão "posição" devem esconder/desabilitar quando `false`, no mesmo
     *  padrão usado para `renda`. */
    posicao: boolean;
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
  /** true só para o Censo 1980: a migração publicada não é data fixa real (o questionário não
   *  tem esse quesito) e sim um PROXY (tempo de residência + última etapa), calibrado contra a
   *  data fixa verdadeira de 1991 -- ver pipeline/edicoes.py `proxy_data_fixa` e
   *  docs/METODOLOGIA.md. O front usa este campo para mostrar um selo/aviso "proxy" na capa e
   *  nos painéis de município/unidade/fluxo desta edição. */
  proxyDataFixa: boolean;
  /** true para 2000 e 1980: o pendular vem de um único quesito de trabalho/estudo, com
   *  precedência do trabalho (quem trabalha no próprio município e estuda em outro só aparece
   *  no fluxo de trabalho), o que faz do fluxo de estudo um PISO, não uma estimativa do total
   *  -- ver docs/METODOLOGIA.md, "Edição Censo 2000 e comparabilidade" e "Edição Censo 1980 e
   *  comparabilidade", e docs/EDICOES.md, aviso 3. O front usa este campo para mostrar a nota de
   *  piso na aba de pendular-estudo do painel de RM, em vez de checar o nome da edição direto no
   *  componente. false nas edições com quesitos separados de trabalho e estudo (2022, 2010) e
   *  nas que não têm pendular nenhum (1991, onde o campo não é lido). */
  pendularCampoUnico: boolean;
}

export const EDICOES: Record<Censo, Edicao> = {
  "2022": {
    nome: "2022",
    rotulo: "Censo 2022",
    subtitulo: "Censo 2022, data fixa 2017–2022",
    periodo: { de: "2017-07-31", ate: "2022-07-31" },
    recursos: { rm: true, pendular: true, modo: true, tempoMinutos: true, renda: true, posicao: true },
    vocabulario: { tempo: "tempo", frequencia: "frequencia" },
    rotuloRetorno: "Retorna 3+ dias/semana",
    statusCategorias: ["retorno_natal", "primeira_saida", "etapas_multiplas", "nascido_exterior"],
    proxyDataFixa: false,
    pendularCampoUnico: false,
  },
  "2010": {
    nome: "2010",
    rotulo: "Censo 2010",
    subtitulo: "Censo 2010, data fixa 2005–2010",
    periodo: { de: "2005-07-31", ate: "2010-07-31" },
    recursos: { rm: true, pendular: true, modo: false, tempoMinutos: false, renda: true, posicao: true },
    vocabulario: { tempo: "tempo2010", frequencia: "frequencia2010" },
    rotuloRetorno: "Retorna diariamente",
    statusCategorias: ["retorno_natal", "nao_natural", "nascido_exterior"],
    proxyDataFixa: false,
    pendularCampoUnico: false,
  },
  "2000": {
    nome: "2000",
    rotulo: "Censo 2000",
    subtitulo: "Censo 2000, data fixa 1995–2000",
    periodo: { de: "1995-07-31", ate: "2000-07-31" },
    // rm: o módulo metropolitano existe (08_metro.sql roda para 2000), só sem os
    // indicadores de deslocamento (pct_diario/pct_coletivo/tempo_mediano NULL, ver
    // pipeline/sql/2000/08_metro.sql). modo/tempoMinutos: inexistentes, como em 2010.
    recursos: { rm: true, pendular: true, modo: false, tempoMinutos: false, renda: true, posicao: true },
    // nem tempo nem frequência existem em 2000 (um único quesito de deslocamento, sem
    // meio de transporte, sem tempo e sem frequência de retorno) -- ver
    // docs/METODOLOGIA.md, "Edição Censo 2000 e comparabilidade".
    vocabulario: {},
    rotuloRetorno: null,
    statusCategorias: ["retorno_natal", "nao_natural", "nascido_exterior"],
    proxyDataFixa: false,
    // único quesito de trabalho/estudo, com precedência do trabalho -- ver
    // docs/METODOLOGIA.md, "Edição Censo 2000 e comparabilidade".
    pendularCampoUnico: true,
  },
  "1991": {
    nome: "1991",
    rotulo: "Censo 1991",
    subtitulo: "Censo 1991, data fixa 1986–1991",
    periodo: { de: "1986-09-01", ate: "1991-09-01" },
    // sem deslocamento pendular nesta edição (LOCTRAB é tipo de local, não município) -- ver
    // pipeline/edicoes.py `pendular=False` e `pula_scripts=["07"]`.
    recursos: { rm: true, pendular: false, modo: false, tempoMinutos: false, renda: true, posicao: true },
    vocabulario: {},
    rotuloRetorno: null,
    // vocabulário reduzido igual ao de 2010/2000 (sem distinguir primeira_saida/
    // etapas_multiplas) -- ver docs/METODOLOGIA.md.
    statusCategorias: ["retorno_natal", "nao_natural", "nascido_exterior"],
    proxyDataFixa: false,
    // sem pendular nesta edição (recursos.pendular = false): campo nunca lido, mas precisa de
    // um valor -- segue o padrão de "sem o quesito" (false).
    pendularCampoUnico: false,
  },
  "1980": {
    nome: "1980",
    rotulo: "Censo 1980",
    subtitulo: "Censo 1980, proxy de data fixa 1975–1980",
    // janela do proxy quinquenal (ver proxyDataFixa) -- não é uma data fixa real do
    // questionário de 1980, que não tem esse quesito.
    periodo: { de: "1975-09-01", ate: "1980-09-01" },
    // pendular completo a partir de v527 (município que trabalha/estuda); sem meio de
    // transporte nem tempo/frequência (quesitos que só existem a partir de 2010); sem renda
    // (fonte só tem as variáveis de rendimento preenchidas no Ceará -- ver `renda` acima);
    // sem posição na ocupação (o questionário não distingue com/sem carteira/estatutário --
    // ver `posicao` acima).
    recursos: { rm: true, pendular: true, modo: false, tempoMinutos: false, renda: false, posicao: false },
    vocabulario: {},
    rotuloRetorno: null,
    // vocabulário reduzido igual ao de 2010/2000/1991 -- ver docs/METODOLOGIA.md.
    statusCategorias: ["retorno_natal", "nao_natural", "nascido_exterior"],
    proxyDataFixa: true,
    // mesma regra de 2000, sem alteração: único quesito de trabalho/estudo (v527), com
    // precedência do trabalho -- ver docs/EDICOES.md, aviso 3, e docs/METODOLOGIA.md, "Edição
    // Censo 1980 e comparabilidade".
    pendularCampoUnico: true,
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
