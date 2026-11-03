/** Textos do namespace `graficos` (fonte: português): diagrama de acordes entre UFs
 *  (`DiagramaAcordes.tsx`) e os três gráficos do Bloco 2 da série (`GraficosSistema.tsx`). Os
 *  dicionários en/fr/es têm o mesmo formato.
 *
 *  Frases com um trecho que o componente precisa enriquecer (glossário) são funções genéricas que
 *  devolvem uma lista de pedaços (`(string | T)[]`): o idioma decide a ordem, e o componente só
 *  envolve cada pedaço em um `<Fragment>`. Números e siglas chegam já formatados. */
export const graficos = {
  acordes: {
    semDados: "Sem dados suficientes para a matriz de acordes.",
    ariaDiagrama: "Diagrama de acordes com os fluxos migratórios entre as 27 unidades da federação; os mesmos dados estão na tabela abaixo do diagrama.",
    /** corda de um par de UFs: os dois sentidos, com o total (já formatado) de cada um */
    ariaCorda: (a: string, b: string, deAParaB: string, deBParaA: string) =>
      `${a} → ${b}: ${deAParaB} pessoas; ${b} → ${a}: ${deBParaA} pessoas`,
    ariaArco: (sigla: string, selecionada: boolean) =>
      `${sigla}: ${selecionada ? "desmarcar" : "selecionar"} no mapa`,
    /** dica do arco de uma UF */
    tituloArco: (sigla: string, emigrantes: string, imigrantes: string) =>
      `${sigla}: ${emigrantes} pessoas saíram para outras UFs; ${imigrantes} chegaram de outras UFs`,
    nota: "A largura do arco de cada UF é proporcional ao total de quem saiu dela para outras UFs; em cada ponta de uma corda, a largura é o fluxo que sai daquela UF para a outra.",
    /** `limite` = nº de pares listados (formatado) quando a tabela é truncada; null quando lista todos */
    tabelaResumo: (limite: string | null) =>
      `Ver a tabela dos ${limite == null ? "" : `${limite} maiores `}fluxos entre UFs`,
    colOrigem: "Origem",
    colDestino: "Destino",
    colTotal: "Total",
    rodapeParcial: (limite: string, total: string, pct: string, restantes: string) =>
      `Mostrando os ${limite} maiores de ${total} pares publicados (${pct}% do total de migrantes entre UFs); os outros ${restantes} não estão listados, mas estão no diagrama.`,
    rodapeCompleto: (total: string) => `Todos os ${total} pares publicados.`,
  },

  plano: {
    /** "Plano MEI×CMI, com trajetória entre censos" (mei e cmi = termos do glossário) */
    titulo: <T>(mei: T, cmi: T): (string | T)[] => ["Plano ", mei, "×", cmi, ", com trajetória entre censos"],
    eixoX: "CMI (%) →",
    eixoY: "↑ MEI agregado (%)",
    /** segunda linha do rótulo de cada ponto; `n` formatado */
    marcaN: (n: string) => `n = ${n}`,
    /** rótulo de cada contorno de ANMR constante; `k` formatado */
    marcaAnmr: (k: string) => `ANMR ${k}`,
    /** sentido da trajetória, lido dos dados: `cai` = o CMI do último ponto é menor que o do primeiro */
    trajetoria: (intervalo: string, cai: boolean, de: string, edDe: string, para: string, edPara: string) =>
      `Entre ${intervalo} a trajetória vai para a ${cai ? "esquerda" : "direita"}: o CMI ${cai ? "cai" : "sobe"} de ${de}% (${edDe}) para ${para}% (${edPara}).`,
    nota: "A intensidade (CMI) também depende do número de unidades do nível: uma malha mais fina eleva o CMI sem que o comportamento mude, então parte da diferença entre edições pode ser malha, não comportamento — ver figura de Courgeau.",
  },

  fielding: {
    /** "Dispersão de Fielding (β), por edição" (beta = termo do glossário) */
    titulo: <T>(beta: T): (string | T)[] => ["Dispersão de Fielding (", beta, "), por edição"],
    semDado: "sem dado",
    leitura: {
      equilibrio: "equilíbrio",
      concentracao: "concentração",
      desconcentracao: "desconcentração",
    },
    beta: (beta: string, ep: string) => `β = ${beta} ± ${ep}`,
    /** `proxy1980`: a edição 1980 está marcada (a taxa líquida dela é proxy) */
    nota: (proxy1980: boolean) =>
      "Reta ajustada por MQO ponderado por população sobre as unidades existentes em cada edição." +
      (proxy1980 ? " Em 1980 a taxa líquida é proxy." : ""),
  },

  courgeau: {
    /** "Figura de Courgeau — CMI × número de unidades do nível (UFs em destaque)" */
    titulo: <T>(cmi: T, nivelPlural: string): (string | T)[] => [
      "Figura de Courgeau — ", cmi, ` × número de unidades do nível (${nivelPlural} em destaque)`,
    ],
    eixoX: "log10(nº de unidades do nível) →",
    eixoY: "↑ CMI (%)",
    carregando: "Carregando a figura…",
    erro: "Não foi possível carregar os dados desta figura.",
    semDados: "Sem dados de CMI por nível para as edições marcadas.",
    nota: "Quanto mais unidades tem a malha, maior a intensidade medida. A inclinação de cada linha é o tamanho desse efeito na edição.",
  },
};
