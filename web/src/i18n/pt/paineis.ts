/** Textos do namespace `paineis` (fonte: português). Os dicionários en/fr/es têm o mesmo formato.
 *  Cobre os painéis laterais (município, unidade agregada, fluxo, fluxo entre unidades, pendular)
 *  e os gráficos de perfil (`BarraPerfil`, `PiramideIdadeSexo`).
 *
 *  Convenções deste arquivo:
 *  - Fragmentos que ficam dentro de um `<Termo>` (link do glossário) ou de um `<strong>` são chaves
 *    separadas; frases que embrulham um elemento no meio chegam como `{ antes, depois }` (o
 *    componente escreve `antes`, o elemento, `depois`), para cada idioma poder reordenar.
 *  - `dp` é o sinal de dois pontos de cada idioma (em francês leva espaço antes).
 *  - Valores numéricos chegam já formatados; o `n` cru que acompanha algumas frases serve só para
 *    o plural nos outros idiomas (o português mantém a frase, como no texto original).
 *  - Textos compartilhados já existentes ficam em `comum` (níveis, precisão, `ui.*`). */

/** primeira letra maiúscula (início de frase) -- decidida aqui, não no componente */
const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const paineis = {
  dp: ":",
  /** valor percentual já formatado (`num1(...)`) + sinal de porcentagem */
  pct: (valor: string) => `${valor}%`,
  tituloAtlas: "Atlas da migração interna",
  preparandoDados: "preparando os dados…",
  limparSelecao: "Limpar seleção",
  /** "Este município não existe na edição <strong>Censo 2022</strong> selecionada — ...";
   *  `demonstrativo` = `d.comum.niveis[n].demonstrativo` ("este município", "esta UF") */
  naoExisteNaEdicao: (demonstrativo: string) => ({
    antes: `${maiuscula(demonstrativo)} não existe na edição `,
    depois: " selecionada — edições antigas podem cobrir um território menor ou ter divisão "
      + "administrativa diferente.",
  }),

  /** rótulos de KPI / termos do glossário que aparecem nos painéis (conteúdo de `<Termo>`) */
  termos: {
    saldoMigratorio: "Saldo migratório",
    taxaLiquida: "Taxa líquida",
    imigrantes: "Imigrantes",
    emigrantes: "Emigrantes",
    ic95: "IC 95%",
    precisao: "Precisão",
    coefVariacao: "coeficiente de variação",
    indiceEficacia: "Índice de eficácia migratória",
    idadeSexo: "Idade e sexo",
  },

  /** tabelas de fluxo (município e unidade agregada) */
  principaisOrigens: "Principais origens",
  principaisDestinos: "Principais destinos",
  nenhumFluxo: "Nenhum fluxo acima do limiar de divulgação.",

  /** gráficos de perfil (barras 100% e pirâmide) */
  perfilMigrantes: "Perfil dos migrantes",
  nesteFluxo: "Neste fluxo",
  fluxoInverso: "Fluxo inverso",

  /** frase de plural: observações na amostra (nFaixa é a faixa publicada: "<5", "5-9", "20+"...;
   *  qualquer faixa publicada é plural) */
  observacoes: (nFaixa: string) => `${nFaixa === "<5" ? "menos de 5" : nFaixa} observações`,
  naAmostra: " na amostra",

  /** saldo de um par: quem ganha na troca; `n` cru só para o plural */
  ganhaNaTroca: (quem: string, valor: string, n: number, outro: string) =>
    `${quem} ganha ${valor} ${n === 1 ? "pessoa" : "pessoas"} na troca com ${outro}`,
  trocaEquilibrada: (par: string) => `troca equilibrada entre ${par}`,

  /** painel de um município */
  municipio: {
    intro: (de: string, ate: string, censo: string, proxy: boolean) =>
      `Fluxos migratórios entre municípios brasileiros no quinquênio ${de}–${ate},`
      + (proxy
        ? ` a partir de um proxy de data fixa do Censo Demográfico ${censo} (ver aviso abaixo).`
        : ` a partir do quesito de data fixa do Censo Demográfico ${censo}.`),
    clique: "Clique em um município no mapa para ver seu saldo, os principais fluxos de entrada "
      + "e de saída, e o perfil dos migrantes. Clique em um arco para detalhar um fluxo.",
    municipiosAgregados: (n: number) => (n === 1 ? "1 município agregado" : `${n} municípios agregados`),
    habitantes: (valor: string) => `${valor} habitantes`,
    aplicandoRecorte: "Aplicando o recorte…",
    semDadoRecorte: "Sem dado publicado para este recorte neste município.",
    taxaDetalhe: "por mil habitantes de 5+ anos",
    avisoRecorte: {
      antes: "Todos os números acima se referem apenas ao recorte ativo ",
      depois: ". Sem o recorte, o painel mostra o total de migrantes.",
    },
    precisaoImigracao: { termo: "Precisão", depois: " da estimativa de imigração" },
    imigNaoInformados: (valor: string, n: number) =>
      `${valor} ${n === 1 ? "imigrante" : "imigrantes"} com origem não informada`,
    imigExterior: (valor: string, n: number) => `${valor} ${n === 1 ? "vindo" : "vindos"} do exterior`,
    perfilRecorte: {
      antes: "Composição de ",
      forte: "todos",
      depois: " os migrantes do município: as barras não seguem o recorte ativo, que se aplica "
        + "aos indicadores e aos fluxos acima.",
    },
    chegaramA: (nome: string) => `Chegaram a ${nome}`,
    sairamDe: (nome: string) => `Saíram de ${nome}`,
    residentesDe: (nome: string) => `Residentes de ${nome}`,
  },

  /** painel de uma unidade agregada (RGI, RGInt, UF) */
  unidade: {
    /** "Nível: <strong>região imediata</strong>. Clique ..."; `singular` = `niveis[n].singular` */
    nivel: { antes: "Nível: ", depois: ". Clique numa unidade no mapa, ou busque pelo nome, para ver seus indicadores e principais fluxos." },
    notaVazio: "Migração entre municípios da mesma unidade não é contabilizada; pares abaixo do "
      + "limiar de revelação ficam de fora da soma. Não há erro-padrão publicado neste nível "
      + "(ver a página de Metodologia).",
    acordesTitulo: "Fluxos migratórios entre UFs",
    taxaPorMil: " (por mil)",
    explicacao: "Indicadores agregados: soma dos pares publicados neste nível (após o limiar de "
      + "revelação); podem diferir da soma dos municípios; sem erro-padrão próprio.",
  },

  /** painel de um fluxo entre dois municípios */
  fluxo: {
    naoPublicado: "Fluxo não publicado",
    naoPublicadoMotivo: (min: number) =>
      `Este par origem–destino ficou abaixo do limiar de divulgação (menos de ${min} pessoas `
      + "na amostra) e por isso não é publicado individualmente.",
    /** `de`/`ate` = anos do quinquênio */
    titulo: (de: string, ate: string) => `Fluxo migratório ${de}–${ate}`,
    migrantesNoFluxo: "Migrantes no fluxo",
    abaixoLimiar: "abaixo do limiar de divulgação",
    saldoPar: "Saldo do par",
    /** as duas pontas não são ambas municípios (unidade agregada da edição) */
    parUnidades: "as duas unidades",
    perfilNaoPublicado: (min: number) =>
      `O perfil dos migrantes deste fluxo não é publicado: com menos de ${min} observações na `
      + "amostra, o detalhamento por característica individualizaria os informantes.",
    explicacaoPerfil: "As barras comparam quem fez este percurso com três referências: todos os "
      + "que chegaram ao destino, todos os que saíram da origem e a população residente no destino.",
    imigrantesDe: (nome: string) => `Imigrantes de ${nome}`,
    emigrantesDe: (nome: string) => `Emigrantes de ${nome}`,
    residentesDe: (nome: string) => `Residentes de ${nome}`,
    ondeTrabalham: "Onde trabalham os que fizeram este percurso",
    ondeTrabalhamNota: (origem: string, destino: string, ano: string) =>
      `Dos migrantes intra-RM que saíram de ${origem} e passaram a morar em ${destino}, `
      + `local de trabalho declarado em ${ano}.`,
  },

  /** painel de um fluxo entre duas unidades agregadas */
  fluxoUnidade: {
    naoPublicadoMotivo: "Este par ficou abaixo do limiar de divulgação e não é publicado individualmente.",
    migrantesNesteFluxo: "Migrantes neste fluxo",
    abaixoLimiar: "abaixo do limiar",
    saldoPar: "Saldo do par",
    /** sufixo depois do `<Termo>` de observações */
    naAmostraAgregado: " na amostra. Nível agregado: sem erro-padrão publicado.",
  },

  /** painel de um par pendular */
  pendular: {
    carregando: "Carregando o fluxo pendular…",
    naoPublicado: "Fluxo pendular não publicado",
    naoPublicadoMotivo: "Este par ficou abaixo do limiar de divulgação e não é publicado individualmente.",
    /** `<Termo>Deslocamento pendular</Termo> de trabalho|estudo` */
    deslocamento: { termo: "Deslocamento pendular", deTrabalho: " de trabalho", deEstudo: " de estudo" },
    universoEdicao: "Universo desta edição.",
    pessoasNesteFluxo: "Pessoas neste fluxo",
    abaixoLimiar: "abaixo do limiar",
    saldoPendular: "Saldo pendular do par",
    tempoMediano: "Tempo mediano",
    minutos: (valor: string) => `${valor} min`,
    retornoDiario: "Retorno diário",
    transporteColetivo: "Transporte coletivo",
    caracterizacaoNaoPublicada: (min: number) =>
      `A caracterização deste fluxo não é publicada: com menos de ${min} observações na amostra, `
      + "o detalhamento individualizaria os informantes.",
    semReferencia: "Não há referência publicada para deslocamento pendular: a única linha é a "
      + "deste fluxo, comparada ao fluxo inverso quando ele também for publicável.",
  },

  /** barras 100% empilhadas (`BarraPerfil`) */
  barra: {
    semDado: "sem dado publicável",
    /** descrição de cada segmento no aria-label da barra: "Superior completo 31,2%" */
    segmento: (rotulo: string, pct: string) => `${rotulo} ${pct}%`,
    aria: (serie: string, segmentos: string[]) => `${serie}: ${segmentos.join(", ")}`,
    titulo: (rotulo: string, pct: string) => `${rotulo}: ${pct}%`,
  },

  /** pirâmide etária (`PiramideIdadeSexo`); percentuais já chegam formatados com o sinal */
  piramide: {
    menosDe: (valor: string) => `menos de ${valor}%`,
    ariaGrupo: (titulo: string, grupo: string) => `${titulo}. ${grupo}:`,
    ariaFaixa: (faixa: string, homens: string, mulheres: string) =>
      `${faixa} anos, homens ${homens}%, mulheres ${mulheres}%`,
    ariaOutros: (pct: string) => `Outros ou suprimido: ${pct}.`,
    ariaReferencia: (rotulo: string) => `Referência (${rotulo}):`,
    ariaReferenciaOutros: (pct: string) => `Referência, outros ou suprimido: ${pct}.`,
    homens: (grupo: string) => `Homens (${grupo})`,
    mulheres: (grupo: string) => `Mulheres (${grupo})`,
    /** nota do residual; `pctRef`/`rotuloRef` são null quando não há referência */
    residuo: (pctGrupo: string, grupo: string, pctRef: string | null, rotuloRef: string | null) =>
      `Outros ou suprimido (fora das barras): ${pctGrupo} de ${grupo}`
      + (pctRef != null && rotuloRef ? `; ${pctRef} de ${rotuloRef}` : "")
      + ". São as células de idade e sexo com poucas observações, que o atlas não divulga (limiar "
      + "de revelação), mais o sexo ignorado; por isso as barras não somam 100%.",
  },
};
