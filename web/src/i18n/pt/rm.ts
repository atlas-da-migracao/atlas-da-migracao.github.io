/** Textos do namespace `rm` (fonte: português): painel das regiões metropolitanas
 *  (`PainelRM.tsx`), comparativo entre RMs (`ComparativoRM.tsx`) e Sankey (`Sankey.tsx`). Os
 *  dicionários en/fr/es têm o mesmo formato.
 *
 *  Frases com um trecho que o componente precisa enriquecer (negrito, glossário) são funções
 *  genéricas que devolvem uma lista de pedaços (`(string | T)[]`): o idioma decide a ordem, e o
 *  componente só envolve cada pedaço em um `<Fragment>`. Percentuais e minutos passam por `pct`
 *  e `min`, porque o espaçamento do "%" e da unidade varia por idioma (francês: "12,3 %"). */
export const rm = {
  /** "12,3%" -- o argumento já vem formatado (`num1`) */
  pct: (v: string) => `${v}%`,
  /** "45 min" -- o argumento já vem formatado (`num`) */
  min: (v: string) => `${v} min`,
  semDados: "Sem dados suficientes.",

  painel: {
    /** título do estado "RM não existe nesta edição" */
    tituloVazio: "Atlas da migração interna",
    /** aviso com a edição em destaque (negrito) entre dois pedaços de texto */
    naoExisteNaEdicao: <T>(edicao: T): (string | T)[] => [
      "Esta região metropolitana não existe na edição ", edicao,
      " selecionada — edições antigas podem cobrir um território menor ou ter divisão administrativa diferente.",
    ],
    voltarBrasil: "Voltar para o Brasil",
    carregando: "Carregando a região metropolitana…",
    sairModoRM: "Sair do modo RM",
    /** "Núcleo: Salvador/BA · 13 municípios · 3.500.000 habitantes" (`nucleo` já com a "/UF", `pop` formatado) */
    linhaResumo: (nucleo: string, nMunicipios: number, pop: string) =>
      `Núcleo: ${nucleo} · ${nMunicipios} ${nMunicipios === 1 ? "município" : "municípios"} · ${pop} habitantes`,
    abasAria: "Aba do painel metropolitano",
    abas: {
      mig: "Migração intra-RM",
      trab: "Pendular trabalho",
      estudo: "Pendular estudo",
    },
    incluirCruzam: "Incluir fluxos que cruzam o limite da RM",
    cruzamLimite: "Fluxos que cruzam o limite da RM",
    comparativoTitulo: "Comparativo entre as 20 maiores regiões metropolitanas",
  },

  tabelaFluxos: {
    vazio: "Nenhum fluxo acima do limiar de divulgação.",
  },

  mig: {
    migrantesIntra: "Migrantes intra-RM",
    saldoExterno: "Saldo com o resto do país",
    /** detalhe do KPI de saldo; `entradas` e `saidas` já formatados */
    entradasSaidas: (entradas: string, saidas: string) => `entradas ${entradas} · saídas ${saidas}`,
    matrizTitulo: "Matriz núcleo × periferia",
    destinoNucleo: "Destino núcleo",
    destinoPeriferia: "Destino periferia",
    origemNucleo: "Origem núcleo",
    origemPeriferia: "Origem periferia",
    saldoPorMunicipio: "Saldo intra-RM por município",
    principaisFluxos: "Principais fluxos intra-RM",
    cliquePerfil: "Clique em uma linha para ver o perfil completo dos migrantes deste par.",
  },

  migTrab: {
    titulo: "Migrantes e trabalho",
    ocupados: "Migrantes ocupados",
    fazemPendular: "Fazem pendular",
    voltamOrigem: "Voltam a trabalhar na origem",
    trabalhamNucleo: "Trabalham no núcleo",
    trabalhamOndeMoram: "Trabalham onde moram",
    /** `top` = nº de caminhos mostrados; `residual` = rótulo do nó agregado (comum.sankeyResidual.municipios) */
    explicacao: (anoOrigem: string, anoDestino: string, top: number, residual: string) =>
      `Morava em (${anoOrigem}) → mora em (${anoDestino}) → trabalha em (${anoDestino}), para os ${top} maiores caminhos da RM com destino de trabalho conhecido; o restante aparece agregado em "${residual}".`,
    verTabela: "Ver como tabela",
    colOrigem: (ano: string) => `Origem (${ano})`,
    colResidencia: (ano: string) => `Residência (${ano})`,
    colTrabalho: (ano: string) => `Trabalho (${ano})`,
    colClasse: "Classe",
    colTotal: "Total",
    colFaixaN: "Faixa de n",
    carregandoDiagrama: "Carregando o diagrama…",
    caminhosInsuficientes: "Caminhos insuficientes para o diagrama nesta RM.",
  },

  trab: {
    ocupados: "Ocupados",
    pendulares: "Pendulares",
    pctDosOcupados: (v: string) => `${v}% dos ocupados`,
    tempoMediano: "Tempo mediano",
    retornoDiario: "Retorno diário",
    transporteColetivo: "Transporte coletivo",
    maiorTaxaSaida: "Maior taxa de saída pendular",
    maiorIndiceAtracao: "Maior índice de atração",
    principaisFluxos: "Principais fluxos pendulares",
    cliqueCaracterizacao: "Clique em uma linha para ver a caracterização do fluxo.",
  },

  estudo: {
    estudantesPendulares: "Estudantes pendulares da RM",
    entradasPorEstudo: "Entradas por estudo",
    piso: "Piso, não estimativa do total: esta edição tem um único quesito de trabalho/estudo, com precedência do trabalho, e por isso este fluxo cobre só estudantes não ocupados.",
    principaisFluxos: "Principais fluxos pendulares de estudo",
    migEstudamOutro: "Migrantes intra-RM que estudam em outro município",
    ondeEstudam: "Onde estudam",
    migrantesQueEstudam: "Migrantes que estudam",
  },

  comparativo: {
    colunas: {
      pop: "População",
      mig_intra: "Migração intra-RM",
      saldo_externo: "Saldo externo",
      pct_pendular: "% pendular",
      tempo_mediano: "Tempo mediano",
      pct_coletivo: "% coletivo",
    },
    ver: (nome: string) => `Ver ${nome}`,
    /** "· Salvador · 13 mun." -- só o trecho final ("13 mun.") */
    nMunicipios: (n: number) => `${n} mun.`,
  },

  sankey: {
    ariaDiagrama: (anoOrigem: string, anoDestino: string) =>
      `Diagrama de fluxo: onde os migrantes moravam em ${anoOrigem}, passaram a morar e trabalham em ${anoDestino}`,
    caminhosInsuficientes: "Caminhos insuficientes para o diagrama.",
  },
};
