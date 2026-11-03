/** Textos do namespace `serie` (fonte: português) -- a seção "Ao longo dos censos": `lib/serie.ts`
 *  (frase-síntese, rótulos de tipologia e de estado), `SerieCensos`, `MapaSerieCensos`,
 *  `ModoCensos`, `ResumoSerie` e `SeletorEdicoes`. Os dicionários en/fr/es têm o mesmo formato.
 *
 *  Convenções deste namespace:
 *  - A frase-síntese (`fraseSintese`) é montada por FUNÇÕES de bloco inteiro (`frase.mudou`,
 *    `frase.manteveEstavel`, ...): cada idioma decide a sintaxe, a concordância e a ordem das
 *    palavras. `lib/serie.ts` só escolhe QUAL bloco usar (T1-T8) e formata os valores.
 *  - Texto com um termo do glossário (`<Termo>`) no meio devolve `{ antes, termo, depois }`; o
 *    componente põe o `<Termo>` entre `antes` e `depois`.
 *  - Os argumentos chegam já formatados (`num`, `formatarIem` etc. de `lib/`), exceto onde a
 *    função precisa do número cru para decidir plural. */
/** "1980", "1980 e 1991", "1980, 1991 e 2000" */
const lista = (xs: string[]) =>
  xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} e ${xs[xs.length - 1]}`;

export const serie = {
  /** rótulo de uma edição nos eixos e cabeçalhos da série; 1980 leva o selo de proxy */
  edicaoProxy: (ano: string) => `${ano} (proxy)`,

  /** nomes da tipologia de Baeninger sobre o IEM (mesmos no mapa, no painel e na frase) */
  tipoIem: {
    rotatividade: "rotatividade",
    absorcao: "absorção",
    absorcao_forte: "absorção forte",
    evasao: "evasão",
    evasao_forte: "evasão forte",
    indefinido: "situação indefinida (amostra pequena)",
  },

  /** tipo de fluxo predominante (distância média x % que cruza a UF) */
  tipoFluxo: {
    curta_intra: "Curta distância, intraestadual",
    curta_inter: "Curta distância, interestadual",
    longa_intra: "Longa distância, intraestadual",
    longa_inter: "Longa distância, interestadual",
  },

  /** palavra curta exibida onde não há número (nunca "0" nem "—" sozinho) */
  palavraEstado: {
    numero: "",
    nao_existia: "não existia",
    sem_cobertura: "sem cobertura",
    cobertura_insuficiente: "cobertura insuficiente",
    suprimido: "suprimido",
    nao_medido: "não medido",
    nao_comparavel: "não comparável",
  },

  /** nome de cada medida (colunas do Bloco 1 e seletor do mapa comparativo) */
  medidas: {
    tlm: "Taxa líquida de migração",
    iem: "Índice de eficácia migratória",
    tbi: "Taxa bruta de imigração",
    tbe: "Taxa bruta de emigração",
    imig: "Imigrantes",
    emig: "Emigrantes",
    saldo: "Saldo",
    turnover: "Rotatividade (entr.+saíd.)",
    distancia_media: "Distância média (km)",
    pct_interestadual: "% que cruza a UF",
    gini_linha: "Concentração destinos (Gini)",
  },

  /** frase-síntese determinística (T1-T8, docs/design_serie_censos.md, seção 2) */
  frase: {
    /** T6: nenhuma edição com número. `mae` presente = a unidade tem município de origem. */
    semSerie: (nome: string, motivo: string, mae: { nome: string; agregada: boolean } | null) =>
      `Não há série para ${nome}: ${motivo}.` +
      (mae
        ? ` Abra a série de ${mae.nome}, ${mae.agregada
            ? "em que o território está agregado" : "de que o território fazia parte"}.`
        : ""),
    /** motivo dominante da ausência de série (complemento de `semSerie`) */
    motivoDominante: {
      nao_existia: "o território não existia como unidade em nenhuma edição com dado suficiente",
      sem_cobertura: "nenhuma edição tem cobertura territorial suficiente",
      cobertura_insuficiente: "a cobertura territorial é insuficiente em todas as edições",
      suprimido: "os fluxos foram suprimidos pelo limiar de revelação em todas as edições",
      nao_medido: "a medida não é publicada em nenhuma edição",
      outro: "não há dado suficiente",
    },
    /** T5: só uma edição com número */
    soUmaEdicao: (p: { nome: string; edicao: string; tipo: string; iem: string; imig: string; emig: string }) =>
      `Só há dado para ${p.nome} em ${p.edicao}: ${p.tipo} (IEM ${p.iem}), com ${p.imig} pessoas chegando e ${p.emig} saindo.`,
    /** o que aconteceu nas outras edições (acompanha T5); `maeNome` só vale para "agregado" */
    nasDemaisEdicoes: (
      motivo: "nao_existia" | "agregado" | "cobertura" | "suprimido" | "nao_medido", maeNome: string,
    ) => {
      const texto = motivo === "agregado" ? `o território é publicado agregado em ${maeNome}`
        : motivo === "nao_existia" ? "não existia"
        : motivo === "cobertura" ? "a cobertura é insuficiente"
        : motivo === "suprimido" ? "o dado foi suprimido"
        : "o dado não foi medido";
      return `Nas demais edições, ${texto}.`;
    },
    /** T4: as duas pontas indefinidas; `indices` = IEM de cada edição com número */
    indefinidoAmbos: (nome: string, indices: { edicao: string; iem: string }[]) =>
      `Em nenhum censo a amostra de ${nome} é grande o bastante para classificar ` +
      `a migração: os índices (${indices.map((p) => `${p.edicao}: ${p.iem}`).join(", ")}) têm margem maior que o próprio valor.`,
    /** T4: uma ponta indefinida; `margem` já vem como "±0,29" (ou "±—") */
    indefinidoUmaPonta: (p: {
      nome: string; edicaoFim: string; tipoFim: string; edicaoIni: string; iemIni: string; margem: string;
    }) =>
      `Em ${p.edicaoFim}, ${p.nome} tem ${p.tipoFim}. Em ${p.edicaoIni} a ` +
      `amostra é pequena demais para dizer se havia ganho ou perda (IEM ${p.iemIni}, com ` +
      `margem de ${p.margem}). A comparação entre as duas pontas não é conclusiva.`,
    /** T8: variação menor que a incerteza do proxy de 1980, mesma classe nas duas pontas */
    incertezaProxyMesmaClasse: (p: { nome: string; tipo: string; min: string; max: string }) =>
      `${p.nome} aparece em ${p.tipo} em todos os censos com dado ` +
      `(IEM entre ${p.min} e ${p.max}). A diferença em relação a 1980 é menor que a incerteza do proxy daquele ano; ` +
      "não é seguro afirmar tendência.",
    /** T8: idem, mas a diferença atravessa um limiar da classificação */
    incertezaProxyMudaClasse: (p: {
      nome: string; tipoIni: string; tipoFim: string; edicaoFim: string; iemIni: string; iemFim: string;
    }) =>
      `${p.nome} vai de ${p.tipoIni} (1980) a ${p.tipoFim} ` +
      `(${p.edicaoFim}), mas o IEM quase não se move (${p.iemIni} para ${p.iemFim}) — ` +
      "a diferença atravessa um limiar da classificação sem ser, de fato, uma mudança grande. " +
      "A diferença em relação a 1980 é menor que a incerteza do proxy daquele ano; não é seguro afirmar tendência.",
    /** T2: manteve a classe e a variação do IEM é grande (>= 0,10) */
    manteveGrande: (p: {
      nome: string; tipo: string; maisPerto: boolean; iemIni: string; iemFim: string; complemento: string;
    }) =>
      `${p.nome} continua em ${p.tipo}, mas ` +
      `${p.maisPerto ? "mais perto" : "mais longe"} do equilíbrio (IEM de ${p.iemIni} ` +
      `para ${p.iemFim}): ${p.complemento}.`,
    /** T2: manteve a classe e a variação é pequena */
    manteveEstavel: (p: {
      nome: string; tipo: string; edicaoIni: string; iemIni: string; iemFim: string; complemento: string;
    }) =>
      `${p.nome} está em ${p.tipo} desde ${p.edicaoIni} (IEM de ` +
      `${p.iemIni} para ${p.iemFim}): ${p.complemento}.`,
    /** T1: mudou de classe */
    mudou: (p: {
      nome: string; edicaoIni: string; edicaoFim: string; tipoIni: string; iemIni: string;
      tipoFim: string; iemFim: string; complemento: string;
    }) =>
      `Entre ${p.edicaoIni} e ${p.edicaoFim}, ${p.nome} passou de ` +
      `${p.tipoIni} (IEM ${p.iemIni}) para ${p.tipoFim} ` +
      `(IEM ${p.iemFim}): ${p.complemento}.`,
    /** complemento por direção de imigração/emigração (R4): chave = `<imig>_<emig>` */
    complemento: {
      up_up: "chega mais gente do que antes, e sai mais também",
      flat_up: "continua recebendo gente, mas agora perde quase o mesmo tanto",
      down_up: "chega menos gente e sai mais",
      up_flat: "chega mais gente e a saída não acompanhou",
      flat_flat: "entradas e saídas mudaram pouco",
      down_flat: "chega menos gente do que antes",
      up_down: "chega mais gente e sai menos",
      flat_down: "sai menos gente do que antes",
      down_down: "entram e saem menos pessoas do que antes",
    },
    /** o complemento por TAXAS (município-mãe) leva este sufixo sobre a fronteira */
    complementoPorTaxas: (texto: string) =>
      `${texto} — pelas taxas, que descontam em parte a mudança de fronteira`,
    /** R7: ressalva de proxy quando a série começa e termina em 1980 */
    proxyEstimativa: "Este número é uma estimativa por proxy, não uma medida direta.",
    /** R7: ressalva de proxy quando a série começa em 1980 */
    proxyPontoInicial: "O ponto de 1980 é uma estimativa por proxy, que tende a aproximar o índice de zero " +
      "— a mudança real pode ser maior.",
    /** R8: edições sem cobertura territorial suficiente (limiar de 90%) */
    coberturaInsuficiente: (edicoes: string[]) =>
      `Em ${lista(edicoes)}, menos de 90% da população de hoje estava coberta pelos municípios da ` +
      `época; não há número para ${edicoes.length > 1 ? "esses anos" : "esse ano"}.`,
    /** R8: RM de um só município nessas edições */
    rmUnitaria: (edicoes: string[]) =>
      `Em ${lista(edicoes)}, a região tinha um só município: os indicadores ` +
      "internos não existem, não são zero.",
    /** prefixo: município de origem com código não numérico (unidade agregada da edição); `edicoes`
     *  vazio = "em edições anteriores". NÃO afirma criação posterior. */
    maeAgregada: (nome: string, edicoes: string[], maeNome: string) =>
      `${edicoes.length > 0 ? `Em ${lista(edicoes)}` : "Em edições anteriores"}, ${nome} não tem número próprio: ` +
      `o território é publicado agregado em ${maeNome}.`,
    /** prefixo: município criado depois da última edição em que não existia */
    criadoDepois: (nome: string, edicao: string, maeNome: string) =>
      `${nome} foi criado depois de ${edicao}; até então seu território fazia parte de ${maeNome}.`,
    /** prefixo de município-mãe: `ateEdicao` ausente = sem ano confiável na fonte (não se inventa) */
    maeIncluia: (nome: string, filhos: string[], ateEdicao: string | null) => {
      const nomes = filhos.length > 3
        ? `${filhos.slice(0, 3).join(", ")} e outros`
        : lista(filhos);
      const ate = ateEdicao ? `Até ${ateEdicao}, ` : "Antes, ";
      return `${ate}${nome} incluía o território que hoje ` +
        `é ${nomes}; parte da variação de volume desde então é fronteira, não migração.`;
    },
  },

  /** `SeletorEdicoes`: chips de marcar/desmarcar edições */
  seletor: {
    aria: "Censos comparados (marque de 2 a 5)",
    minimoDuas: "Marque pelo menos duas edições",
  },

  /** `ModoCensos`: aba "Ao longo dos censos" */
  modo: {
    aria: "Território e censos comparados",
    placeholderBusca: "Buscar município, região, UF ou RM…",
    falhaUnidades: (erro: string) => `Falha ao carregar as unidades: ${erro}`,
    vazioTitulo: "Compare um território ao longo dos censos",
    vazioTexto: "Escolha um município, uma região imediata ou intermediária, uma UF ou uma região " +
      "metropolitana para ver como a migração mudou entre 1980 e 2022.",
    naoEncontradaTitulo: "Esta unidade não existe na base territorial de 2022",
    /** o código (em destaque) fica entre `antes` e `depois` */
    naoEncontradaTexto: {
      antes: "O código ",
      depois: " não corresponde a nenhuma unidade da malha de 2022, que é a base territorial comparada " +
        "nos cinco censos. O link pode ser antigo ou estar incompleto.",
    },
    voltarBusca: "Voltar à busca",
  },

  /** `ResumoSerie`: camada 1 embutida nos painéis */
  resumo: {
    titulo: "Ao longo dos censos",
    verSerieCompleta: "Ver a série completa ↗",
    abrirSerieDe: (nome: string) => `Abrir a série de ${nome} ↗`,
    saldo: "Saldo",
    ariaSaldo: (valor: string) => `Saldo, ${valor}`,
    eficacia: "Eficácia",
    ariaEficacia: (tipo: string) => `Eficácia, ${tipo}`,
    semClassificacao: "sem classificação",
    movimento: "Movimento total",
    ariaMovimento: "Movimento total (entradas + saídas)",
    entraramSairam: (entraram: string, sairam: string) => `entraram ${entraram}, saíram ${sairam}`,
  },

  /** células das tabelas da seção completa */
  celula: {
    ariaRessalva: (texto: string) => `Ressalva: ${texto}`,
    naoCalculavel: "Não foi possível calcular esta medida para esta unidade/edição.",
    naoPublicado: "não publicado",
    ressalvaPadrao: "Comparabilidade limitada nesta edição.",
  },

  /** `SerieCensos`: índice, avisos e rodapé */
  secao: {
    indiceAria: "Blocos da série",
    bloco: (n: number) => `Bloco ${n}`,
    semSerie: "Não há série publicada para esta unidade.",
    selo1980: "Selo proxy (1980).",
    aviso1980Padrao: "O Censo 1980 não tem quesito de data fixa: a migração publicada é estimada por um proxy calibrado, não medida diretamente.",
    glossario: "Glossário",
    metodologia: { antes: "Metodologia completa: ", botao: "metodologia completa", depois: "." },
  },

  bloco1: {
    /** `nivel` = o nível em minúsculas ("município", "região imediata", "UF") */
    /** `demonstrativo` = `comum.niveis[n].demonstrativo` ("este município", "esta UF") */
    titulo: (demonstrativo: string) => `Bloco 1 · A migração n${demonstrativo}, censo a censo`,
    colMedida: "Medida",
    colTendencia: "tend.",
    tipoFluxo: "Tipo de fluxo predominante",
    notaTendencia: (intervalo: string) =>
      `Coluna "tend." = sparkline ${intervalo}; posição tracejada = sem número naquela edição.`,
    nota1980: "1980 leva o selo de proxy (ver aviso no topo da seção).",
    notaRessalva: "ⓘ = ressalva de comparabilidade (passe o mouse; o texto completo está abaixo).",
    ressalvasResumo: (n: number) => `Ressalvas de comparabilidade (${n})`,
    /** "Imigrantes, Emigrantes (1980 (proxy)):" -- `medidas` e `edicoes` já rotuladas */
    ressalvaItem: (medidas: string[], edicoes: string[]) => `${medidas.join(", ")} (${edicoes.join(", ")}):`,
  },

  bloco2: {
    /** `plural` = o nível no plural ("municípios", "regiões imediatas") */
    titulo: (plural: string) => `Bloco 2 · O sistema de ${plural} em que esta unidade está`,
    tituloRM: "Bloco 2 · O sistema de regiões metropolitanas",
    naoCalculadoRM: "Não calculado para regiões metropolitanas: a série publicada traz o sistema (CMI, MEI, ANMR, " +
      "β de Fielding, Duncan D) só para municípios, regiões imediatas, regiões intermediárias e UFs.",
    carregando: "Carregando o sistema…",
    nota: "Estes números descrevem o conjunto de unidades do nível, não a unidade selecionada. Eles " +
      "mudam com o número de unidades e só podem ser comparados dentro do mesmo nível.",
    /** o termo do glossário (D de Duncan) fica entre `antes` e `depois`; `lista` = "1991 0,12 · 2000 0,10" */
    duncanFrase: (lista: string) => ({
      antes: "Quanto a estrutura dos fluxos mudou entre censos (",
      termo: "Duncan D",
      depois: `, comparado à edição anterior): ${lista}.`,
    }),
    colEdicao: "Edição",
    colNUnidades: "n unidades",
    colDuncan: { termo: "Duncan D", depois: " (ant.)" },
    anteriorNaoMarcada: (edicao: string) => `A edição anterior (${edicao}) não está marcada.`,
  },

  bloco3: {
    titulo: "Bloco 3 · De onde vieram e para onde foram",
    naoCalculadoRM: "Não calculado para regiões metropolitanas: os fluxos entre pares de unidades são publicados " +
      "na série só para municípios, regiões imediatas, regiões intermediárias e UFs.",
    origens: "Principais origens",
    destinos: "Principais destinos",
    nenhumPar: (titulo: string) => `${titulo}: nenhum par publicado.`,
    motivoSuprimido: "▒ supr.",
    motivoNaoExistia: "░ não exist.",
    motivoNaoMedido: "não medido",
    motivoOutro: "—",
    /** posto na edição e total de migrantes do par: "3º · 1.234" */
    postoTotal: (posto: string, total: string) => `${posto}º · ${total}`,
    /** parceiros que já estiveram entre os 10 primeiros mas não aparecem; `nFmt` = `n` formatado */
    foraDaLista: (n: number, nFmt: string) =>
      `Mais ${nFmt} parceiro${n > 1 ? "s" : ""} que já ${n > 1 ? "estiveram" : "esteve"} entre os 10 primeiros em alguma edição não aparece${n > 1 ? "m" : ""} aqui.`,
    mostrarPrimeiros: (n: number) => `Mostrar só os ${n} primeiros`,
    mostrarTodos: "Mostrar todos",
    /** o termo (Posto) fica entre `antes` e `depois`; `edicao` = rótulo da edição marcada mais recente */
    notaPosto: (edicao: string) => ({
      antes: "",
      termo: "Posto",
      depois: ` e volume por edição, ordenado pelo posto em ${edicao} ` +
        "(a edição marcada mais recente), desempatando pelas anteriores.",
    }),
  },

  bloco4: {
    titulo: "Bloco 4 · Quem migra (chegaram)",
    carregando: "Carregando perfil…",
    /** depois do termo "Status migratório" */
    tituloBarraDepois: ", por edição",
    semDado: "sem dado publicável",
    /** no lugar da barra, por estado da unidade na edição (o resto cai em `palavraEstado`) */
    motivoVazio: {
      nao_existia: "não existia nesta edição",
      sem_cobertura: "sem cobertura nesta edição",
      cobertura_insuficiente: "cobertura insuficiente nesta edição",
      suprimido: "suprimido (abaixo do limiar de divulgação)",
    },
  },

  /** `MapaSerieCensos`: small multiples do Bloco 1 */
  mapa: {
    aria: "Mapa comparativo",
    naoPublicadoRM: "Mapa comparativo não publicado para região metropolitana nesta fase.",
    titulo: "Mapa comparativo, censo a censo",
    medida: "Medida:",
    carregarMunicipais: (n: number) => `Carregar os mapas municipais das ${n} edições marcadas`,
    erro: (erro: string) => `Não foi possível carregar o mapa comparativo: ${erro}`,
    erroDesconhecido: "erro desconhecido",
    /** `lista` = quebras já formatadas e separadas ("0,15 · 0,33 · 0,60"); `iem` = a medida é o IEM */
    quebrasFixas: (lista: string, iem: boolean) =>
      `Quebras fixas (mesmas em todas as edições): ${lista}${iem ? " (índice, não %)" : " ‰"}.`,
    carregandoPainel: "carregando…",
    ariaPainel: (medida: string, edicao: string) => `Mapa de ${medida} em ${edicao}`,
    legendaAria: "Legenda do mapa comparativo",
    tramasAria: "Diagonal: território não comparável. Cruzada: suprimido por sigilo. Pontilhada: não medido. Horizontal: indefinido, amostra pequena demais para classificar.",
    tramaDiagonal: "não comparável (não existia / cobertura insuficiente)",
    tramaCruzada: "suprimido (sigilo)",
    tramaPontilhada: "não medido (o censo não perguntou)",
    tramaIndefinida: "indefinido (amostra pequena demais para classificar)",
  },
};
