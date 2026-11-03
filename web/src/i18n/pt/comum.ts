/** Textos compartilhados por várias áreas (níveis territoriais, precisão, categorias dos
 *  recortes, edições, faixas de legenda, regiões, glossário). Fonte: português; en/fr/es repetem
 *  o formato.
 *
 *  COMO USAR (as chaves e cores continuam em `lib/`; o texto mora aqui):
 *
 *  - Níveis territoriais: `d.comum.niveis[nivel].<forma>` (nivel: "mun" | "rgi" | "rgint" | "uf" | "rm").
 *      curto        rótulo do seletor de nível ("Município", "Reg. imediata", "UF")
 *      titulo       singular capitalizado ("Região imediata") -- cabeçalho de painel
 *      singular     singular em minúsculas no meio de frase ("região imediata"; "UF" fica "UF")
 *      plural       plural ("regiões imediatas")
 *      artigoDef    com artigo definido ("o município", "a UF")
 *      demonstrativo "este município" / "esta UF"
 *      par          "os dois municípios" / "as duas UFs" (troca equilibrada entre o par)
 *      ver          botão de reenquadrar o mapa na seleção ("Ver o município", "Ver a região", "Ver a UF")
 *    Gênero e artigo variam por idioma: use a forma pronta, não monte a frase no componente.
 *
 *  - Precisão da estimativa: `rotuloPrecisao(p, d)` em `lib/format.ts`
 *    (`d.comum.precisao`: boa / cautela / baixa / sem_estimativa).
 *
 *  - Categorias e títulos dos gráficos de perfil (`lib/paletas.ts`):
 *      d.comum.dimensoes[dim]   { titulo, nota }   (dim: status, edu, renda, tipologia,
 *                                                   frequencia, frequencia2010, modo, tempo, tempo2010,
 *                                                   posicao, setor, ocupacao, renda_trab, nivel)
 *      d.comum.categorias[grupo][chave]  grupo = as dimensões acima + classeTrab, classeEstudo,
 *                                                   faixasIdade
 *    Em componentes, não leia isso na mão: use os helpers de `lib/paletas.ts`, que devolvem o objeto
 *    já no idioma de `d`:
 *      dimensao(dim, d) / dimensaoPendular(dim, d) / tipologiaIntraRM(d)  -> { titulo, nota, categorias }
 *      rotuloCategoria(grupo, chave, d), rotuloRecorte(chave, d), categoriaOutros(d)
 *      rotuloClasseTrab(classe, d), rotuloClasseEstudo(classe, d), rotuloFaixaIdade(chave, d)
 *    ATENÇÃO: o campo `rotulo` das constantes DIMENSOES, DIMENSOES_PENDULAR, FAIXAS_IDADE,
 *    CLASSE_TRAB e CLASSE_ESTUDO é só a referência em português (os testes dependem dele): nunca o
 *    exiba direto na interface.
 *
 *  - Edições do censo: `rotuloCenso(censo, d)`, `subtituloCenso(censo, d)`,
 *    `rotuloRetornoCenso(censo, d)` em `lib/edicoes.ts` (`d.comum.edicoes[censo]`).
 *  - Faixas da legenda do mapa: `faixasLegenda(quebras, unidade, d)` e
 *    `legendaMedidaSerie(medida, d)` em `lib/escalas.ts` (`d.comum.faixasLegenda`, `d.comum.legendaMedidaSerie`).
 *  - Macrorregiões do IBGE: `rotuloRegiao(regiao, d)` em `lib/uf.ts` (`d.comum.regioes`).
 *  - Nós residuais do Sankey: `prepararSankey(..., d)` em `lib/rm.ts` (`d.comum.sankeyResidual`).
 *  - Glossário: `d.glossario[chave]` (JSON em `i18n/glossario/`) ou `termo(chave, d)` de
 *    `lib/glossario.ts`; os títulos do popover estão em `d.comum.glossarioUi`. */
export const comum = {
  /** entre os limites de um intervalo de confiança: "804 a 1.196" (ver `ic95` em lib/format.ts) */
  separadorIntervalo: "a",

  /** rótulo da precisão da estimativa (campo `precisao` dos dados publicados) */
  precisao: {
    boa: "boa",
    cautela: "usar com cautela",
    baixa: "baixa precisão",
    sem_estimativa: "sem estimativa",
  },

  niveis: {
    mun: {
      curto: "Município", titulo: "Município", singular: "município", plural: "municípios",
      artigoDef: "o município", demonstrativo: "este município", par: "os dois municípios",
      ver: "Ver o município",
    },
    rgi: {
      curto: "Reg. imediata", titulo: "Região imediata", singular: "região imediata",
      plural: "regiões imediatas", artigoDef: "a região imediata", demonstrativo: "esta região imediata",
      par: "as duas regiões imediatas", ver: "Ver a região",
    },
    rgint: {
      curto: "Reg. intermediária", titulo: "Região intermediária", singular: "região intermediária",
      plural: "regiões intermediárias", artigoDef: "a região intermediária",
      demonstrativo: "esta região intermediária", par: "as duas regiões intermediárias", ver: "Ver a região",
    },
    uf: {
      curto: "UF", titulo: "UF", singular: "UF", plural: "UFs", artigoDef: "a UF",
      demonstrativo: "esta UF", par: "as duas UFs", ver: "Ver a UF",
    },
    rm: {
      curto: "RM", titulo: "Região metropolitana", singular: "região metropolitana",
      plural: "regiões metropolitanas", artigoDef: "a região metropolitana",
      demonstrativo: "esta região metropolitana", par: "as duas regiões metropolitanas", ver: "Ver a RM",
    },
  },

  /** título e nota (subtítulo) de cada dimensão dos gráficos de perfil */
  dimensoes: {
    status: { titulo: "Status migratório", nota: null as string | null },
    edu: { titulo: "Escolaridade", nota: "pessoas de 25 anos ou mais" as string | null },
    renda: { titulo: "Renda domiciliar per capita", nota: "em salários mínimos" as string | null },
    tipologia: { titulo: "Tipologia do fluxo", nota: null as string | null },
    frequencia: { titulo: "Frequência de retorno", nota: null as string | null },
    frequencia2010: { titulo: "Frequência de retorno", nota: null as string | null },
    modo: { titulo: "Modo de transporte", nota: null as string | null },
    tempo: { titulo: "Tempo de deslocamento", nota: null as string | null },
    tempo2010: { titulo: "Tempo de deslocamento", nota: "só quem retorna para casa diariamente" as string | null },
    posicao: { titulo: "Posição na ocupação", nota: null as string | null },
    setor: { titulo: "Setor de atividade", nota: null as string | null },
    ocupacao: { titulo: "Grupo ocupacional", nota: null as string | null },
    renda_trab: { titulo: "Rendimento do trabalho", nota: "em salários mínimos" as string | null },
    nivel: { titulo: "Nível de estudo", nota: null as string | null },
  },

  /** residual genérico acrescentado pelas barras de perfil a uma série com valores fora da paleta */
  categoriaOutros: "Outros ou suprimido",

  /** rótulo de cada categoria, por dimensão e chave (as chaves são as de `lib/paletas.ts`) */
  categorias: {
    status: {
      retorno_natal: "Retorno ao município natal",
      primeira_saida: "Primeira saída do natal",
      etapas_multiplas: "Etapas múltiplas",
      nascido_exterior: "Nascido no exterior",
      nao_natural: "Não natural do destino",
      outros: "Outros ou suprimido",
    },
    edu: {
      sem_instr_fund_incompleto: "Sem instrução ou fundamental incompleto",
      fund_completo_medio_incompleto: "Fundamental completo",
      medio_completo_superior_incompleto: "Médio completo",
      superior_completo: "Superior completo",
      nao_determinado: "Não determinado",
      outros: "Outros ou suprimido",
    },
    renda: {
      ate_1_4_sm: "Até ¼",
      de_1_4_a_1_2_sm: "De ¼ a ½",
      de_1_2_a_1_sm: "De ½ a 1",
      de_1_a_2_sm: "De 1 a 2",
      mais_de_2_sm: "Mais de 2",
      nao_aplicavel: "Domicílio coletivo",
      outros: "Outros ou suprimido",
    },
    tipologia: {
      nucleo_periferia: "Núcleo → periferia",
      periferia_nucleo: "Periferia → núcleo",
      periferia_periferia: "Periferia → periferia",
    },
    classeTrab: {
      origem: "Voltou a trabalhar na origem",
      nucleo: "Passou a trabalhar no núcleo",
      outro: "Trabalha em outro município da RM",
      proprio: "Trabalha no próprio município",
      varios: "Vários municípios",
      nao_informado: "Não informado",
      exterior: "Exterior",
      outros: "Outros",
    },
    classeEstudo: {
      origem: "Voltou a estudar na origem",
      nucleo: "Passou a estudar no núcleo",
      outro: "Estuda em outro município da RM",
      proprio: "Estuda no próprio município",
      varios: "Vários municípios",
      nao_informado: "Não informado",
    },
    faixasIdade: {
      "05_14": "5 a 14",
      "15_24": "15 a 24",
      "25_39": "25 a 39",
      "40_59": "40 a 59",
      "60_mais": "60 ou mais",
    },
    frequencia: {
      retorno_diario: "Retorna 3+ dias/semana",
      semanal_longa: "Retorno semanal ou mais longo",
      ignorado: "Ignorado",
      outros: "Outros ou suprimido",
    },
    frequencia2010: {
      retorno_diario: "Retorna diariamente",
      semanal_longa: "Não retorna diariamente",
      ignorado: "Ignorado",
      outros: "Outros ou suprimido",
    },
    modo: {
      a_pe_bicicleta: "A pé ou bicicleta",
      motocicleta: "Motocicleta ou mototáxi",
      automovel_taxi: "Automóvel ou táxi",
      onibus_van_brt: "Ônibus, van ou BRT",
      trem_metro: "Trem ou metrô",
      outros: "Outros meios ou suprimido",
      ignorado: "Ignorado",
    },
    tempo: {
      ate_15min: "Até 15 min",
      de_16_a_30min: "16 a 30 min",
      de_31min_a_1h: "31 min a 1 h",
      de_1_a_2h: "1 a 2 h",
      mais_de_2h: "Mais de 2 h",
      outros: "Não se desloca, ignorado ou suprimido",
    },
    tempo2010: {
      ate_5min: "Até 5 min",
      de_6_a_30min: "6 a 30 min",
      de_31min_a_1h: "31 min a 1 h",
      de_1_a_2h: "1 a 2 h",
      mais_de_2h: "Mais de 2 h",
      nao_se_aplica: "Não retorna diariamente",
      outros: "Outros ou suprimido",
    },
    posicao: {
      empregado_com_carteira: "Empregado com carteira",
      empregado_sem_carteira: "Empregado sem carteira",
      militar_estatutario: "Militar ou estatutário",
      empregador: "Empregador",
      conta_propria_familiar: "Conta própria ou familiar",
      ignorado: "Ignorado",
      outros: "Outros ou suprimido",
    },
    setor: {
      agropecuaria: "Agropecuária",
      industria: "Indústria",
      construcao: "Construção",
      comercio: "Comércio",
      transporte_logistica: "Transporte e logística",
      servicos_empresariais: "Serviços empresariais",
      admin_educacao_saude: "Administração, educação e saúde",
      outros_servicos: "Outros serviços",
      ignorado: "Ignorado",
      outros: "Outros ou suprimido",
    },
    ocupacao: {
      dirigentes_profissionais: "Dirigentes e profissionais",
      tecnicos_administrativo: "Técnicos e apoio administrativo",
      servicos_vendedores: "Serviços e vendedores",
      agropecuaria: "Agropecuária",
      industria_operadores: "Indústria, construção e operadores",
      elementares: "Ocupações elementares",
      forcas_seguranca: "Forças armadas, polícia e bombeiros",
      mal_definidas: "Mal definidas, ignorado ou suprimido",
    },
    renda_trab: {
      ate_1_sm: "Até 1 salário mínimo",
      de_1_a_2_sm: "De 1 a 2 salários mínimos",
      de_2_a_3_sm: "De 2 a 3 salários mínimos",
      de_3_a_5_sm: "De 3 a 5 salários mínimos",
      mais_de_5_sm: "Mais de 5 salários mínimos",
      sem_declaracao: "Sem declaração",
      outros: "Outros ou suprimido",
    },
    nivel: {
      infantil_fundamental: "Infantil ou fundamental",
      medio: "Médio",
      pre_vestibular: "Pré-vestibular",
      graduacao: "Graduação",
      pos_graduacao: "Pós-graduação",
      ignorado: "Ignorado",
      outros: "Outros ou suprimido",
    },
  },

  /** rótulo curto, subtítulo e rótulo da categoria "retorna" de cada edição (lib/edicoes.ts) */
  edicoes: {
    "2022": { rotulo: "Censo 2022", subtitulo: "Censo 2022, data fixa 2017–2022", rotuloRetorno: "Retorna 3+ dias/semana" as string | null },
    "2010": { rotulo: "Censo 2010", subtitulo: "Censo 2010, data fixa 2005–2010", rotuloRetorno: "Retorna diariamente" as string | null },
    "2000": { rotulo: "Censo 2000", subtitulo: "Censo 2000, data fixa 1995–2000", rotuloRetorno: null as string | null },
    "1991": { rotulo: "Censo 1991", subtitulo: "Censo 1991, data fixa 1986–1991", rotuloRetorno: null as string | null },
    "1980": { rotulo: "Censo 1980", subtitulo: "Censo 1980, proxy de data fixa 1975–1980", rotuloRetorno: null as string | null },
  },

  /** rótulos das faixas da legenda divergente do mapa; `v`, `a`, `b` já formatados, `u` = unidade ("‰", "%" ou "") */
  faixasLegenda: {
    ganhoAcima: (v: string, u: string) => `ganho acima de ${v}${u}`,
    faixa: (a: string, b: string, u: string) => `${a} a ${b}${u}`,
    // "perto de zero" seria falso quando o primeiro corte é grande (ex.: ±92,2‰ no Censo 1980 --
    // a inflação de volume do proxy e o ruído de municípios pequenos alargam o 60º percentil).
    // "baixa variação" descreve a mesma faixa (os 60% de menor |valor| da edição) sem prometer
    // proximidade de zero que o número ao lado pode desmentir.
    baixaVariacao: (v: string, u: string) => `baixa variação (±${v}${u})`,
    perdaAcima: (v: string, u: string) => `perda acima de ${v}${u}`,
  },

  /** legenda de quebras FIXAS do mapa comparativo "Ao longo dos censos", na ordem dos slots de
   *  cor de `lib/escalas.ts` (iem/tlm: pos2..neg2, 7 entradas; tbi/tbe: seq0..seq4, 5 entradas).
   *  Os limiares são constantes de `QUEBRAS_FIXAS` (lib/serie.ts): se mudarem, mudam aqui. */
  legendaMedidaSerie: {
    iem: [
      "absorção muito forte (acima de +0,60)",
      "absorção forte (+0,33 a +0,60)",
      "absorção (+0,15 a +0,33)",
      "rotatividade (−0,15 a +0,15)",
      "evasão (−0,33 a −0,15)",
      "evasão forte (−0,60 a −0,33)",
      "evasão muito forte (abaixo de −0,60)",
    ],
    tlm: [
      "ganho acima de 80‰",
      "ganho de 30 a 80‰",
      "ganho de 10 a 30‰",
      "quase equilíbrio (±10‰)",
      "perda de 10 a 30‰",
      "perda de 30 a 80‰",
      "perda acima de 80‰",
    ],
    tbi: ["até 25‰", "25 a 50‰", "50 a 80‰", "80 a 130‰", "130‰ ou mais"],
    tbe: ["até 25‰", "25 a 50‰", "50 a 80‰", "80 a 130‰", "130‰ ou mais"],
  },

  /** macrorregiões do IBGE (chaves em português: são identificadores de `lib/uf.ts`) */
  regioes: {
    Norte: "Norte",
    Nordeste: "Nordeste",
    Sudeste: "Sudeste",
    Sul: "Sul",
    "Centro-Oeste": "Centro-Oeste",
  },

  /** nós residuais do Sankey de migrantes e trabalho (origem / residência / local de trabalho) */
  sankeyResidual: {
    origens: "Outras origens",
    residencias: "Outras residências",
    municipios: "Outros municípios",
  },

  /** popover do glossário (components/Termo.tsx) */
  glossarioUi: {
    oQueE: "O que é",
    comoInterpretar: "Como interpretar",
    limitacoes: "Limitações",
    ariaOQueE: (termo: string) => `O que é ${termo}`,
  },
  /** fragmentos de interface repetidos em vários painéis -- use daqui, não duplique no namespace */
  ui: {
    painelDetalhes: "Painel de detalhes",
    fecharPainel: "Fechar painel",
    carregando: "Carregando…",
    carregandoFluxos: "Carregando fluxos…",
    carregandoFluxo: "Carregando o fluxo…",
    carregandoMapa: "Carregando o mapa…",
    carregandoSerie: "Carregando a série…",
  },
};
