/** Textos do namespace `app` (fonte: português): cabeçalho, barra de ferramentas, mapa, rodapé,
 *  títulos da aba, erros de carga e legenda do modo metropolitano (src/App.tsx).
 *  Os dicionários en/fr/es têm o mesmo formato. */
const BASE = "Atlas da migração interna";

export const app = {
  titulo: "Atlas da migração interna no Brasil",
  pularConteudo: "Pular para o conteúdo",

  /** `document.title` */
  tituloAba: {
    base: BASE,
    censos: "Ao longo dos censos — Atlas da migração interna no Brasil",
    comNome: (nome: string) => `${nome} — ${BASE}`,
    fluxo: (origem: string, destino: string) => `${origem} → ${destino} — ${BASE}`,
  },

  cabecalho: {
    subtituloCensos: "Ao longo dos censos, 1980–2022",
    edicaoCenso: "Edição do Censo",
    metodologia: "Metodologia",
    comoUsar: "Como usar",
    mudarParaClaro: "Mudar para tema claro",
    mudarParaEscuro: "Mudar para tema escuro",
  },

  barra: {
    modoENivel: "Modo e nível do mapa",
    modoAtlas: "Modo do atlas",
    brasil: "Brasil",
    regioesMetropolitanas: "Regiões metropolitanas",
    aoLongoDosCensos: "Ao longo dos censos",
    nivelAgregacao: "Nível de agregação",
    filtros: (ativo: boolean) => `Filtros${ativo ? " •" : ""}`,
    filtrosDoMapa: "Filtros do mapa",
    fechar: "Fechar",
    metricaDoMapa: "Métrica do mapa",
  },

  placeholderBusca: {
    mun: "Buscar município…",
    rgi: "Buscar região imediata…",
    rgint: "Buscar região intermediária…",
    uf: "Buscar UF…",
  },

  /** rótulo curto de cada métrica do seletor */
  metricas: {
    saldo: "Saldo",
    tlm: "Taxa líquida",
    imig: "Imigrantes",
    emig: "Emigrantes",
    iem: "Eficácia",
  },

  avisoNivelRecorte: "O recorte por característica só existe no nível município; foi limpo ao trocar de nível.",

  /** botão de reenquadrar o mapa (os casos "seleção"/"RM" vêm de `comum.niveis[...].ver`) */
  verFluxo: "Ver o fluxo",
  verBrasil: "Ver o Brasil",

  /** descrição textual do mapa para leitores de tela; `nivel` = rótulo curto do nível ("Município") */
  descricaoMapa: {
    rm: "Mapa da região metropolitana selecionada, com destaque para o núcleo e a periferia.",
    nacional: (nivel: string, metrica: string) =>
      `Mapa coroplético do Brasil por ${nivel.toLowerCase()}, colorido pela métrica "${metrica}", com arcos indicando os principais fluxos migratórios.`,
  },

  /** legenda do modo metropolitano (a legenda da métrica está em `legenda`) */
  legendaRM: {
    migTitulo: "Migração dentro da região metropolitana",
    migNota: "A cor identifica a posição das duas pontas na RM (núcleo ou periferia); a direção é lida pela forma.",
    pendularTitulo: (trabalho: boolean) => `Deslocamento pendular para ${trabalho ? "trabalho" : "estudo"}`,
    pendularCategoria: (trabalho: boolean) => `Residência → ${trabalho ? "trabalho" : "estudo"}`,
    pendularNota: (cruzar: boolean) => cruzar
      ? "Cor única: todo fluxo vai da residência ao destino. Os fluxos esmaecidos atravessam o limite da RM."
      : "Cor única: todo fluxo vai da residência ao destino.",
  },

  semDado: "sem dado",
  semDadoRecorte: "sem dado publicado para o recorte",

  mapa: {
    fluxos: (ligado: boolean) => (ligado ? "Fluxos: ligados" : "Fluxos: desligados"),
    satelite: (ligado: boolean) => (ligado ? "Satélite: ligado" : "Satélite: desligado"),
    tamanhoMinimoFluxo: "Tamanho mínimo do fluxo",
    /** texto lido pelo leitor de tela no controle deslizante; valores já formatados */
    corteAria: (corte: string, visiveis: string, total: string) =>
      `a partir de ${corte} pessoas, ${visiveis} de ${total} fluxos`,
    /** texto visível; o valor entre ** vai em negrito (ver components/TextoRico.tsx) */
    corteVisivel: (corte: string, visiveis: string, total: string) =>
      `a partir de **${corte}** pessoas · ${visiveis} de ${total} fluxos`,
    atribuicaoSatelite: "Imagem de satélite: NASA Visible Earth, Blue Marble.",
  },

  /** mensagens de erro de carga; `detalhe` é a mensagem técnica do navegador/DuckDB */
  erros: {
    malha: (detalhe: string) => `Falha ao carregar a malha: ${detalhe}`,
    malhaNivel: (nivel: string, detalhe: string) => `Falha ao carregar a malha (${nivel}): ${detalhe}`,
    unidades: (nivel: string, detalhe: string) => `Falha ao consultar as unidades (${nivel}): ${detalhe}`,
    meta: (detalhe: string) => `Falha ao carregar os metadados: ${detalhe}`,
    municipios: (detalhe: string) => `Falha ao consultar os dados: ${detalhe}`,
    rm: (detalhe: string) => `Falha ao carregar a RM: ${detalhe}`,
    fluxosRM: (detalhe: string) => `Falha ao consultar fluxos da RM: ${detalhe}`,
    fluxosNivel: (nivel: string, detalhe: string) => `Falha ao consultar fluxos (${nivel}): ${detalhe}`,
    maioresFluxos: (detalhe: string) => `Falha ao consultar os maiores fluxos: ${detalhe}`,
    fluxos: (detalhe: string) => `Falha ao consultar fluxos: ${detalhe}`,
    recorte: (detalhe: string) => `Falha ao aplicar o recorte: ${detalhe}`,
    tentarDeNovo: "tentar de novo",
  },

  rodape: {
    /** "Dados de <versão>." -- `versao` é o identificador publicado (ex.: "1.0.0-2022") */
    dadosDe: (versao: string) => `Dados de ${versao}.`,
    dadosCensos: "Dados dos Censos Demográficos 1980–2022.",
    metodologia: "Metodologia",
    comoCitar: "Como citar:",
    orcid: "ORCID",
    citacaoAtlas: (censo: string) =>
      `Atlas da migração interna no Brasil. Dados do Censo Demográfico ${censo} (IBGE).`,
    doi: "DOI:",
  },
};
