/**
 * Dicionário central de termos do atlas — fonte única dos tooltips explicativos.
 *
 * Cada entrada tem três (opcionalmente quatro) campos: `termo` (título curto/sigla exibido),
 * `definicao` (o que é, com a fórmula quando ela ajuda), `interpretacao` (como ler o número:
 * domínio de valores, o que significa alto/baixo/positivo/negativo) e `limitacoes` (ressalva
 * real e documentada — quando NÃO comparar, o que a medida não captura, qual aproximação foi
 * assumida). `limitacoes` é opcional de propósito: termo sem ressalva documentada não recebe
 * uma limitação genérica só para preencher o campo.
 *
 * As definições são as de `docs/METODOLOGIA.md` (fonte de verdade metodológica), reescritas em
 * linguagem de leitor, e os limiares numéricos vêm de `pipeline/disclosure_rules.py`
 * (`CV_BOA = 15`, `CV_CAUTELA = 30`, `FAIXAS_N`) e de `pipeline/comparabilidade_regras.py`
 * (`IEM_LIMIAR_ROTATIVIDADE = 0,15`, `IEM_LIMIAR_FORTE = 1/3`, `MIN_UNIDADES_MEI = 20`).
 * Ao alterar qualquer limiar em Python, alterar o texto aqui — não há geração automática.
 *
 * Regra de redação: nenhuma sigla é usada dentro de uma explicação sem ser expandida na própria
 * explicação (ou na entrada correspondente, quando o texto remete a ela).
 */

export interface TermoGlossario {
  /** Nome curto/sigla exibido como título do tooltip. */
  termo: string;
  /** O que é, 1-3 frases, com a fórmula quando fizer sentido. */
  definicao: string;
  /** Como ler o número: domínio de valores e o que significa alto/baixo/positivo/negativo. */
  interpretacao: string;
  /** Ressalvas documentadas. Ausente quando não há uma ressalva real. */
  limitacoes?: string;
}

export const GLOSSARIO: Record<string, TermoGlossario> = {
  // -------------------------------------------------------------------------------------
  // Bloco 1 — medidas de uma unidade (município, região, UF, região metropolitana)
  // -------------------------------------------------------------------------------------
  saldo: {
    termo: "Saldo migratório",
    definicao:
      "Diferença entre quem chegou e quem saiu da unidade no período do censo: saldo = imigrantes − emigrantes.",
    interpretacao:
      "Saldo positivo significa que a unidade ganhou mais gente do que perdeu no período; negativo, que perdeu mais do que ganhou. Saldo próximo de zero não quer dizer pouca migração — pode ser muita entrada compensada por muita saída (ver rotatividade).",
    limitacoes:
      "Nos níveis agregados (região imediata, região intermediária, unidade da federação e região metropolitana) o saldo publicado é calculado sobre os fluxos que cruzam a fronteira da unidade, e não é a soma dos saldos dos municípios que a compõem: a migração entre municípios de dentro da mesma unidade não entra na conta.",
  },

  taxa_liquida: {
    termo: "Taxa líquida de migração (TLM)",
    definicao:
      "O saldo migratório expresso por mil habitantes: TLM = (saldo ÷ população de 5 anos ou mais) × 1.000. É a versão do saldo que não depende do tamanho da unidade.",
    interpretacao:
      "Zero é o equilíbrio. Valores positivos indicam ganho populacional por migração, negativos indicam perda, e a magnitude é lida como “tantas pessoas a mais (ou a menos) por mil habitantes”. Por ser relativa à população, permite comparar um município pequeno com uma capital.",
    limitacoes:
      "Herda a ressalva do saldo nos níveis agregados: mede apenas trocas que atravessam a fronteira da unidade. O denominador é a população de 5 anos ou mais, que é o universo do quesito de migração, e não a população total.",
  },

  imigrantes: {
    termo: "Imigrantes (chegadas)",
    definicao:
      "Pessoas que moravam em outro município do Brasil no início do período de referência do censo e moravam nesta unidade no fim dele. O período é o quinquênio de cada edição (por exemplo, 31/07/2017 a 31/07/2022 no Censo 2022).",
    interpretacao:
      "É uma contagem de pessoas (estimativa ponderada da amostra do censo): quanto maior, mais gente chegou à unidade no período. Compare sempre com a emigração e com o tamanho da população antes de concluir que a unidade “atrai”.",
    limitacoes:
      "Uma fração dos migrantes que chegaram não informou o município de origem. Esses casos são publicados à parte: contam na imigração total do destino, mas ficam fora da matriz origem→destino e, por consequência, fora da emigração computada nos municípios de origem.",
  },

  emigrantes: {
    termo: "Emigrantes (saídas)",
    definicao:
      "Pessoas que moravam nesta unidade no início do período de referência do censo e moravam em outro município do Brasil no fim dele.",
    interpretacao:
      "É uma contagem de pessoas (estimativa ponderada da amostra): quanto maior, mais gente saiu da unidade no período.",
    limitacoes:
      "A emigração é reconstruída a partir da origem declarada por quem chegou a outro município. Quem migrou mas não soube informar o município de origem não é atribuído a nenhuma origem, de modo que a emigração é ligeiramente subestimada.",
  },

  eficacia_iem: {
    termo: "IEM — índice de eficácia migratória (também MEI)",
    definicao:
      "Compara o saldo ao movimento total da unidade: IEM = (imigrantes − emigrantes) ÷ (imigrantes + emigrantes). O resultado fica sempre entre −1 e +1.",
    interpretacao:
      "Perto de zero, as trocas são equilibradas — muita gente entra e sai, com pouco efeito líquido (rotatividade). Perto de +1, o fluxo é quase todo de entrada (absorção); perto de −1, quase todo de saída (evasão). A tipologia de Baeninger usada no atlas classifica |IEM| abaixo de 0,15 como rotatividade, de 0,15 a 0,33 como absorção ou evasão, e 0,33 ou mais como absorção ou evasão forte (0,15 corresponde ao fluxo maior superar o menor em um terço; 1/3 corresponde ao fluxo maior ser o dobro do menor). Quando a diferença entre entradas e saídas cabe dentro da margem de erro da amostra, a unidade sai como “indefinido” em vez de receber uma classe — incerteza não é evidência de equilíbrio.",
    limitacoes:
      "Diferente da intensidade migratória (CMI) e da migração líquida agregada (ANMR), o IEM é livre de escala: é uma razão entre saldo e volume, e por isso pode ser comparado entre níveis territoriais diferentes (município, região, unidade da federação) e entre censos. É por isso que o atlas trata essa medida de forma distinta das medidas de intensidade. Na edição 1980 a classificação é publicada sem a guarda estatística, porque aquela edição não estima erro amostral.",
  },

  rotatividade: {
    termo: "Rotatividade (turnover)",
    definicao:
      "Total de movimento da unidade, somando os dois sentidos: rotatividade = imigrantes + emigrantes. Mede quanta gente se moveu, independentemente de para onde.",
    interpretacao:
      "Cresce mesmo quando o saldo é zero. Lida junto com o saldo, dá o quadro completo: rotatividade alta com saldo próximo de zero indica troca intensa e equilibrada de população; rotatividade baixa com saldo próximo de zero indica pouca migração em qualquer sentido.",
  },

  distancia_media: {
    termo: "Distância média da migração",
    definicao:
      "Distância média dos fluxos de entrada e de saída da unidade, ponderada pelo volume de cada fluxo, medida em linha reta entre os centros geográficos dos municípios na projeção cônica equivalente de Albers.",
    interpretacao:
      "Quanto maior, mais longe estão os lugares de onde vêm e para onde vão os migrantes da unidade: distâncias altas indicam migração de longo alcance, distâncias baixas indicam troca com a vizinhança imediata.",
    limitacoes:
      "A projeção de Albers preserva área, não forma, e a distância medida nela tem uma distorção geométrica pequena em relação à distância real (até cerca de 6,6% no extremo sul do país) — aceitável para uma medida-resumo comparativa, não para uso métrico de precisão. Só conta os pares de origem e destino efetivamente publicados (pares muito pequenos são suprimidos por sigilo). Não é calculada no nível de região metropolitana, porque não há matriz publicada da região metropolitana contra o resto do país.",
  },

  pct_interestadual: {
    termo: "% da migração que cruza a unidade da federação",
    definicao:
      "Fração do volume de migração da unidade em que o estado de origem é diferente do estado de destino.",
    interpretacao:
      "É uma medida de alcance geográfico: quanto mais alto o percentual, maior o peso da migração de longa distância entre estados; quanto mais baixo, mais a migração da unidade é um fenômeno de dentro do próprio estado.",
    limitacoes:
      "Calculada sobre os pares de origem e destino publicados; a cauda de pares pequenos suprimida por sigilo não entra na conta. Na edição 1980 a migração é medida por aproximação (última etapa da trajetória), que desloca fluxo longo para fluxo curto e subestima o percentual interestadual em cerca de 2 pontos percentuais.",
  },

  gini: {
    termo: "Concentração dos fluxos (índice de Gini)",
    definicao:
      "Mede o quanto o volume de migração da unidade se concentra em poucos parceiros. O atlas publica duas versões: uma sobre os municípios de onde vêm os que chegam e outra sobre os municípios para onde vão os que saem. Vale de 0 (todos os parceiros com volume igual) a 1 (todo o volume num único parceiro).",
    interpretacao:
      "Valores altos indicam dependência de poucos parceiros — um município que troca população quase só com a capital vizinha. Valores baixos indicam um leque disperso de origens ou destinos.",
    limitacoes:
      "É uma aplicação simplificada de Plane e Mulligan (1997): o índice é calculado com a fórmula de Gini sobre o vetor de volumes por parceiro da unidade, e não na forma matricial completa do artigo original, que mede o foco espacial do sistema inteiro. Além disso, entra na conta apenas o que é publicado: a cauda de pares pequenos suprimida por sigilo (cerca de 30% do volume, em todas as edições) fica de fora.",
  },

  tipo_fluxo_predominante: {
    termo: "Tipo de fluxo migratório predominante",
    definicao:
      "Leitura simplificada que combina as duas medidas de alcance geográfico acima -- distância média e % que cruza a UF -- num único rótulo: curta ou longa distância, cruzada com intraestadual ou interestadual (ex.: “longa distância, intraestadual”, típico de um estado de território extenso).",
    interpretacao:
      "Não é uma medida nova: é uma forma de ler as duas de uma vez, sem abrir os dois números separadamente. “Longa distância” é distância média igual ou maior que 200 km; “interestadual” é quando pelo menos metade do volume de migração cruza a fronteira do estado (maioria simples). As quatro combinações aparecem na prática: “curta distância, interestadual” é comum perto de divisas estaduais; “longa distância, intraestadual” é comum em estados de grande extensão territorial.",
    limitacoes:
      "Os dois cortes (200 km e 50%) são editoriais, escolhidos pela legibilidade do rótulo, não calibrados estatisticamente contra a distribuição dos municípios -- uma unidade com distância média de 199 km e outra com 201 km caem em classes diferentes por uma margem pequena. Herda todas as ressalvas de distância média e de % que cruza a UF, incluindo a supressão da cauda de pares pequenos e a aproximação de 1980.",
  },

  // -------------------------------------------------------------------------------------
  // Bloco 2 — medidas do sistema (o conjunto de unidades de um nível)
  // -------------------------------------------------------------------------------------
  cmi: {
    termo: "CMI — intensidade migratória",
    definicao:
      "Medida do SISTEMA, não de uma unidade: CMI = 100 × migrantes ÷ população, ou seja, o percentual da população do nível inteiro que mudou de unidade no período.",
    interpretacao:
      "Quanto maior, mais intensa a migração no conjunto do território naquele censo. Responde “quanta gente se moveu”, nunca “para onde” — para isso existe a eficácia migratória do sistema (MEI agregado).",
    limitacoes:
      "Atenção, esta é a ressalva mais importante da medida: a intensidade migratória cresce com o número de unidades da malha territorial (efeito Courgeau, um caso do problema da unidade de área modificável). Mudar de município é mais provável do que mudar de estado apenas porque há mais municípios. Por isso o CMI NÃO pode ser comparado entre níveis diferentes — o valor municipal e o valor por unidade da federação não são a mesma grandeza —, e mesmo entre censos do mesmo nível deve ser lido ao lado do número de unidades daquela edição. É esse corte que separa, na interface, as medidas da unidade (Bloco 1) das medidas do sistema (Bloco 2).",
  },

  smi: {
    termo: "SMI — intensidade migratória padronizada por idade",
    definicao:
      "A intensidade migratória (CMI) recalculada como se todas as edições tivessem a mesma composição etária, usando uma população de referência comum. Migrar é muito mais frequente entre 20 e 35 anos, então parte da variação bruta entre censos é só envelhecimento da população.",
    interpretacao:
      "Lida como a intensidade migratória, mas livre do efeito da estrutura etária: se o CMI cai entre dois censos e a SMI não cai, a queda era composição etária e não mudança de comportamento migratório.",
    limitacoes:
      "Só é calculada no nível municipal, porque depende do perfil de migrantes por faixa etária, publicado apenas nesse nível. Nos níveis agregados aparece vazia em vez de uma soma aproximada. Herda do CMI a dependência do número de unidades: não comparar entre níveis territoriais diferentes.",
  },

  mei_agregado: {
    termo: "MEI agregado — eficácia migratória do sistema",
    definicao:
      "A mesma ideia do índice de eficácia migratória de uma unidade, mas para todo o sistema: MEI agregado = 100 × 0,5 × (soma dos saldos em valor absoluto) ÷ total de migrantes. Mede quanto do movimento resulta em redistribuição de população, e não em troca equilibrada.",
    interpretacao:
      "Perto de zero, a migração do sistema é troca cruzada — muita gente se move e o mapa populacional quase não muda. Valores altos indicam que o movimento é desequilibrado e efetivamente redistribui população entre as unidades.",
    limitacoes:
      "Por ser uma razão entre saldo e volume, é livre de escala e estável em recortes com 20 unidades ou mais: pode ser lida entre níveis territoriais diferentes, ao contrário da intensidade migratória (CMI) e da migração líquida agregada (ANMR).",
  },

  anmr: {
    termo: "ANMR — migração líquida agregada",
    definicao:
      "Decompõe a redistribuição de população em duas partes: ANMR = intensidade migratória (CMI) × eficácia do sistema (MEI agregado) ÷ 100. É quanta gente se move multiplicado por quão desequilibrado é esse movimento.",
    interpretacao:
      "Mede o efeito líquido da migração sobre a distribuição da população no período. Pode ser baixa por dois motivos opostos: pouca gente se movendo, ou muita gente se movendo em trocas equilibradas — só olhando os dois componentes separados se distingue um caso do outro.",
    limitacoes:
      "Como contém a intensidade migratória, herda a dependência do número de unidades da malha (efeito Courgeau): não comparar entre níveis territoriais diferentes, e ler a série de um mesmo nível ao lado do número de unidades de cada edição.",
  },

  beta_fielding: {
    termo: "β de Fielding — concentração ou desconcentração",
    definicao:
      "Coeficiente da reta que relaciona a taxa líquida de migração de cada unidade ao logaritmo da densidade populacional dela, estimada por mínimos quadrados ordinários com peso proporcional à população.",
    interpretacao:
      "β positivo indica um sistema em concentração: as unidades mais densas são as que ganham população por migração (metropolitanização). β negativo indica desconcentração: quem ganha são as unidades menos densas (contraurbanização). Valores dentro de mais ou menos dois erros-padrão de zero devem ser lidos como ausência de padrão, não como desconcentração fraca.",
    limitacoes:
      "É calculado sobre as unidades que EXISTIAM em cada edição, e a base territorial muda entre censos (municípios criados depois não entram na edição antiga). Parte da variação da série é, portanto, mudança de recorte territorial.",
  },

  duncan_d: {
    termo: "D de Duncan — mudança na estrutura dos fluxos",
    definicao:
      "Índice de dissimilaridade entre as matrizes de origem e destino de dois censos consecutivos: a fração do volume que teria de trocar de par origem→destino para a estrutura de um censo ficar igual à do outro. Vai de 0 a 1.",
    interpretacao:
      "Zero significa que o desenho dos fluxos não mudou entre os dois censos (mesmo que o volume total tenha mudado, porque as duas matrizes são normalizadas antes da comparação). Perto de 1 significa reorganização completa das rotas migratórias.",
    limitacoes:
      "Calculado sobre a matriz comum às duas edições comparadas, renormalizada nesse conjunto — sem isso, criar um município novo apareceria como mudança de padrão migratório. Ainda assim, a medida é melhor lida junto com o número de unidades e a malha territorial de cada edição: entre 1980 e 1991 a interseção é a menor da série, e o índice mede mudança de estrutura apenas dentro dela.",
  },

  n_unidades: {
    termo: "Número de unidades da edição",
    definicao:
      "Quantas unidades do nível escolhido (municípios, regiões imediatas, regiões intermediárias ou unidades da federação) existiam naquele censo, e sobre as quais as medidas do sistema foram calculadas.",
    interpretacao:
      "Serve de contexto obrigatório para as medidas do sistema. Municípios são criados ao longo do tempo: em 2022 há mais de 5.570, contra 5.507 em 2000, e por isso uma mesma população pode produzir mais “migração entre municípios” simplesmente porque as fronteiras internas aumentaram.",
    limitacoes:
      "É por causa dessa variação que a intensidade migratória (CMI), a intensidade padronizada (SMI) e a migração líquida agregada (ANMR) não são diretamente comparáveis entre edições sem olhar este número ao lado — é o efeito Courgeau, exibido explicitamente na figura que acompanha o bloco do sistema.",
  },

  // -------------------------------------------------------------------------------------
  // Precisão e sigilo estatístico
  // -------------------------------------------------------------------------------------
  ic95: {
    termo: "IC 95% — intervalo de confiança de 95%",
    definicao:
      "Faixa de valores dentro da qual o número real provavelmente está. Os números do atlas vêm da amostra do censo, não da contagem completa da população: cada estimativa tem uma margem de erro, e o intervalo é a estimativa mais ou menos 1,96 erro-padrão.",
    interpretacao:
      "Leia o intervalo, não só o ponto central: quanto mais estreita a faixa, mais precisa a estimativa. Se os intervalos de duas unidades (ou de dois censos) se sobrepõem largamente, a diferença entre elas pode ser apenas efeito da amostra.",
    limitacoes:
      "Não existe intervalo publicado onde não há erro amostral estimado: a edição 1980 não tem chave de domicílio na fonte e por isso não estima erro amostral, e nos níveis agregados de algumas edições o erro-padrão não é publicado. Na edição 1991 o erro-padrão é aproximado e conservador (o estrato usado no cálculo é um substituto da área de ponderação, que aquele censo não tem).",
  },

  cv: {
    termo: "CV — coeficiente de variação",
    definicao:
      "Erro-padrão da estimativa dividido pela própria estimativa, em percentual. Mede a precisão relativa: é o tamanho da margem de erro comparado ao tamanho do número estimado.",
    interpretacao:
      "Quanto menor, melhor. Seguindo o guia do IBGE, o atlas considera precisão boa até 15%, pede cautela entre 15% e 30%, e classifica como baixa precisão acima de 30%. Coeficiente de variação alto quase sempre significa que poucos casos da amostra sustentam aquele par ou aquela unidade — o valor indica ordem de grandeza, não dígito.",
    limitacoes:
      "Não é comparável ponto a ponto entre todas as edições: em 1991 o coeficiente de variação é calculado com um estrato substituto e fica de 5% a 20% acima do de 2000 em pares de mesmo tamanho amostral (leia-o como conservador), e em 1980 ele simplesmente não existe.",
  },

  precisao: {
    termo: "Precisão da estimativa",
    definicao:
      "Rótulo que resume o coeficiente de variação de cada estimativa publicada em quatro classes: boa (coeficiente de variação até 15%), usar com cautela (de 15% a 30%), baixa precisão (acima de 30%) e sem estimativa (quando a edição não publica erro amostral).",
    interpretacao:
      "“Boa” autoriza ler o número como valor; “usar com cautela” autoriza ler o sentido e a ordem de grandeza; “baixa precisão” significa que a estimativa é frágil e pode mudar bastante em outra amostra; “sem estimativa” não quer dizer imprecisa — quer dizer que não há como medir a precisão naquela edição.",
    limitacoes:
      "“Sem estimativa” é a classe de toda a edição 1980 (a fonte não traz chave de domicílio, logo não há unidade de amostragem para o cálculo de variância) e dos níveis agregados que não publicam erro-padrão.",
  },

  n_faixa: {
    termo: "Faixa do tamanho da amostra",
    definicao:
      "Quantos registros da amostra do censo sustentam aquela estimativa, divulgado em faixa (5-19, 20-49, 50-99, 100-499, 500 ou mais) e nunca como valor exato.",
    interpretacao:
      "É uma medida de robustez, não de população: “20-49” significa que entre 20 e 49 pessoas da amostra foram observadas naquela célula, cujo peso amostral as expande para um número muito maior de pessoas na população. Faixas baixas pedem a mesma cautela que um coeficiente de variação alto.",
    limitacoes:
      "A faixa em vez do valor exato é uma exigência das regras de controle de revelação do atlas (sigilo estatístico dos microdados de acesso controlado do IBGE), e não uma perda de informação do cálculo. Células abaixo do piso de revelação da edição não são publicadas de forma alguma — o piso é de 5 registros e 3 domicílios distintos nas edições com chave de domicílio, e de 20 registros na edição 1980, que não tem essa chave.",
  },

  // -------------------------------------------------------------------------------------
  // Bloco 3 — fluxos e parceiros
  // -------------------------------------------------------------------------------------
  posto: {
    termo: "Posto no ranking",
    definicao:
      "Posição de um parceiro (município de origem ou de destino) na lista de fluxos da unidade ordenada do maior volume para o menor: posto 1 é o principal parceiro.",
    interpretacao:
      "Comparar postos entre censos mostra se um parceiro subiu, caiu ou manteve importância relativa. Como é uma medida de ordem, e não de quantidade, é livre de escala: funciona mesmo quando o volume total de migração muda muito entre edições.",
    limitacoes:
      "O ranking só enxerga os pares publicados. Um parceiro pequeno pode estar ausente do ranking por supressão de sigilo, e não por não existir — efeito mais forte na edição 1980, cujo piso de publicação é mais alto (20 registros da amostra em vez de 5).",
  },

  // -------------------------------------------------------------------------------------
  // Módulo metropolitano
  // -------------------------------------------------------------------------------------
  rm_migracao_intra: {
    termo: "Migração intrametropolitana",
    definicao:
      "Migração entre municípios de uma MESMA região metropolitana: quem mudou de endereço sem sair da região.",
    interpretacao:
      "Mede o rearranjo interno da região — tipicamente o espalhamento da população do município central para os municípios vizinhos. É um número grande em regiões metropolitanas consolidadas mesmo quando o saldo da região com o resto do país é pequeno.",
    limitacoes:
      "Não inclui quem entrou na região vindo de fora nem quem saiu dela para fora — isso é o saldo da região com o resto do país, medido à parte. Depende de os municípios da região existirem individualmente na edição: quando parte do território metropolitano ainda não estava subdividida como hoje, o indicador não é comparável e o atlas o deixa vazio em vez de publicar um valor incompleto.",
  },

  rm_saldo_externo: {
    termo: "Saldo da região metropolitana com o resto do país",
    definicao:
      "Saldo migratório da região metropolitana tomada como uma única unidade: todas as entradas vindas de fora dela menos todas as saídas para fora dela. A migração entre municípios da própria região não entra.",
    interpretacao:
      "Positivo indica que a região, como um todo, ganhou população por migração; negativo, que perdeu. É a leitura correta para responder “esta metrópole está atraindo ou perdendo gente?”, enquanto a migração intrametropolitana responde “como a população está se redistribuindo dentro dela?”.",
    limitacoes:
      "O recorte metropolitano usado é o de 2022, aplicado retroativamente às edições anteriores. Municípios da região criados depois de uma edição antiga não existem nela (aparecem dentro do município de origem do desmembramento), então a cobertura territorial varia e o número não é diretamente comparável entre censos sem checar essa cobertura — que a interface declara em cada célula.",
  },

  rm_nucleo_periferia: {
    termo: "Núcleo e periferia",
    definicao:
      "Classificação de cada fluxo de migração interno à região metropolitana conforme a posição dos dois municípios: núcleo→periferia (saindo do centro), periferia→núcleo (indo para o centro) e periferia→periferia (entre municípios periféricos). O núcleo é o município membro cujo nome aparece no nome da região; sem homônimo entre os membros, é o mais populoso.",
    interpretacao:
      "O predomínio de núcleo→periferia indica desconcentração residencial — a população do centro se muda para os municípios vizinhos, frequentemente sem trocar de emprego. O predomínio de periferia→núcleo indica o movimento clássico de adensamento do centro. Periferia→periferia alto sugere uma região com vários polos, e não um centro único.",
    limitacoes:
      "Depende da partição municipal interna da região existir na edição: regiões reduzidas a um único município na edição, ou com cobertura municipal incompleta, ficam sem este indicador por construção, não por medida.",
  },

  // -------------------------------------------------------------------------------------
  // Deslocamento pendular
  // -------------------------------------------------------------------------------------
  pendular_conceito: {
    termo: "Deslocamento pendular",
    definicao:
      "Situação de quem MORA em um município e TRABALHA ou ESTUDA em outro, indo e voltando em rotina diária ou quase diária. É diferente de migração: na migração a pessoa muda de residência; no deslocamento pendular, não.",
    interpretacao:
      "Volumes pendulares altos indicam integração funcional entre municípios — mercados de trabalho e redes de ensino que atravessam a fronteira municipal, típico de regiões metropolitanas. Migração e deslocamento pendular são módulos distintos do atlas e não se somam: são pessoas contadas por critérios diferentes.",
    limitacoes:
      "O censo de 1991 não pergunta onde a pessoa trabalha ou estuda, então essa edição não tem módulo pendular — a ausência é do questionário, e a célula é “não medida”, não zero. Em 2000 há um quesito único de trabalho ou estudo com precedência do trabalho, de modo que o fluxo de estudo daquela edição é um piso: comparável em composição e direção, nunca em nível.",
  },

  pendular_taxa_saida: {
    termo: "Taxa de saída pendular",
    definicao:
      "Percentual dos moradores ocupados do município que trabalham em outro município. Há o indicador análogo para estudo, sobre quem frequenta escola ou creche.",
    interpretacao:
      "Quanto mais alto, mais o município funciona como área residencial de um mercado de trabalho que fica fora dele — padrão de município-dormitório. Valores baixos indicam um mercado de trabalho contido nas próprias fronteiras.",
    limitacoes:
      "O universo do indicador de trabalho é a população ocupada de 10 anos ou mais; quem trabalha em mais de um município ou no exterior é contado como categoria própria e não entra na matriz de fluxos pendulares.",
  },

  pendular_indice_atracao: {
    termo: "Índice de atração pendular",
    definicao:
      "Razão entre as pessoas que trabalham no município (os residentes que trabalham nele mais quem vem de fora trabalhar nele) e o total de residentes ocupados do município.",
    interpretacao:
      "Acima de 1, o município concentra mais postos de trabalho do que trabalhadores residentes: é um polo que atrai força de trabalho dos vizinhos. Abaixo de 1, exporta trabalhadores — mais gente sai para trabalhar fora do que vem trabalhar dentro.",
  },

  pendular_tempo_mediano: {
    termo: "Tempo mediano de deslocamento",
    definicao:
      "Tempo, em minutos, que divide em duas metades quem se desloca: metade gasta menos que esse valor no trajeto habitual entre a casa e o trabalho ou estudo, metade gasta mais.",
    interpretacao:
      "Mede o custo cotidiano da separação entre moradia e emprego. Por ser mediana, não é puxada pelos trajetos extremos, como uma média seria.",
    limitacoes:
      "Só existe na edição 2022, a única que registra o tempo em minutos. O Censo 2010 pergunta o tempo apenas em cinco faixas categóricas que não se encaixam nas de 2022 (a segunda faixa de 2010 atravessa duas de 2022), então ali o atlas publica a distribuição por faixas próprias e deixa a mediana vazia; 2000, 1991 e 1980 não têm o quesito.",
  },

  pendular_pct_coletivo: {
    termo: "% que usa transporte coletivo",
    definicao:
      "Fração de quem faz deslocamento pendular usando transporte coletivo (ônibus, van, trem ou metrô), entre os modos de transporte declarados.",
    interpretacao:
      "Indica a dependência do transporte público na ligação entre os municípios: percentuais altos revelam um eixo pendular servido por rede coletiva; baixos, deslocamento predominantemente individual.",
    limitacoes:
      "Só a edição 2022 pergunta o meio de transporte. Nas demais edições a dimensão não existe e a célula é publicada vazia — “esta edição não mede isso” não é o mesmo que “o valor é zero”.",
  },

  pendular_retorno_diario: {
    termo: "% com retorno diário",
    definicao:
      "Fração de quem faz o deslocamento pendular retornando para casa com frequência diária, ou quase.",
    interpretacao:
      "Separa o deslocamento cotidiano do arranjo de passar a semana fora e voltar no fim de semana. Percentuais altos indicam um par de municípios de fato integrado no dia a dia.",
    limitacoes:
      "A definição do quesito muda entre edições: 2022 pergunta se a pessoa retorna três ou mais dias por semana, e 2010 pergunta se retorna diariamente. Os códigos coincidem, as definições não — os valores são comparáveis em ordem de grandeza, nunca como série. As edições 2000, 1991 e 1980 não têm quesito de frequência de retorno.",
  },

  // -------------------------------------------------------------------------------------
  // Recortes territoriais e fontes
  // -------------------------------------------------------------------------------------
  ride: {
    termo: "RIDE — Região Integrada de Desenvolvimento Econômico",
    definicao:
      "Arranjo institucional parecido com uma região metropolitana, mas criado por lei federal em vez de lei estadual, justamente porque reúne municípios de mais de uma unidade da federação — o caso mais conhecido é a RIDE do Distrito Federal e Entorno.",
    interpretacao:
      "No atlas, RIDEs e regiões metropolitanas recebem exatamente as mesmas medidas e aparecem no mesmo seletor: núcleo e periferia, migração interna à região, saldo com o resto do país e deslocamento pendular.",
    limitacoes:
      "Numa RIDE, boa parte da migração “interna à região” é ao mesmo tempo interestadual, porque os municípios estão em estados diferentes: os dois indicadores não são independentes e não devem ser lidos como dimensões separadas do mesmo fenômeno.",
  },

  sidra: {
    termo: "SIDRA — Sistema IBGE de Recuperação Automática",
    definicao:
      "Banco de tabulações oficiais do IBGE, onde estão publicados os resultados dos censos. É a referência oficial; o atlas é uma elaboração própria a partir dos microdados da amostra.",
    interpretacao:
      "Use o SIDRA como referência quando precisar do número oficial. Os valores do atlas podem divergir dos publicados lá, e a divergência é esperada: o atlas trabalha com a amostra (não com o universo), arredonda as estimativas, suprime células pequenas por sigilo e aplica classificações próprias de migração e de deslocamento pendular.",
    limitacoes:
      "A própria expansão da amostra pode divergir do universo em alguns municípios, ressalva que o IBGE registra na documentação de cada censo. Onde o atlas e o SIDRA discordam, o atlas não corrige nem calibra: publica a sua estimativa e declara a diferença.",
  },

  // -------------------------------------------------------------------------------------
  // Bloco 4 — perfil dos migrantes
  // -------------------------------------------------------------------------------------
  status_migratorio: {
    termo: "Status migratório",
    definicao:
      "Classifica cada migrante pela relação com o município onde nasceu: “retorno ao município natal” (voltou para onde nasceu), “não natural do destino” (migrou para um município que não é o seu natal) e “nascido no exterior”. Na edição 2022, que é a única a coletar o município de nascimento, a categoria de não natural se abre em “primeira saída do município natal” e “etapas múltiplas” (já havia morado em outro município antes deste).",
    interpretacao:
      "Muita gente em “retorno ao município natal” indica migração de volta — típica de regiões que exportaram população décadas antes. Predomínio de “não natural” indica migração de ida, para destinos novos. “Etapas múltiplas”, onde existe, revela trajetórias migratórias encadeadas, e não um único deslocamento.",
    limitacoes:
      "O vocabulário muda entre edições: só 2022 separa “primeira saída” de “etapas múltiplas”, porque as demais não perguntam o município de nascimento. Na comparação entre censos, as duas categorias de 2022 são somadas em “não natural do destino”, para que todas as edições usem a mesma base; o detalhe fino continua disponível no painel da edição de 2022. Na edição 1980, o retorno ao município natal é subestimado no território do atual Tocantins, que era o norte de Goiás.",
  },

  escolaridade: {
    termo: "Escolaridade (nível de instrução)",
    definicao:
      "Nível de instrução alcançado, apurado apenas entre pessoas de 25 anos ou mais — idade em que a maioria já concluiu a trajetória escolar típica, o que evita confundir “ainda estudando” com “não estudou”. Quatro classes: sem instrução ou fundamental incompleto; fundamental completo; médio completo; superior completo.",
    interpretacao:
      "Comparar a composição dos migrantes com a dos residentes não migrantes mostra a seletividade da migração: quando os migrantes têm mais escolaridade que quem ficou, a migração está selecionando a população mais escolarizada.",
    limitacoes:
      "A característica é medida no FIM do período migratório, de modo que não se sabe se a escolaridade é causa ou consequência da migração. Nas edições 2000 e 1991 o nível de instrução é derivado de “anos de estudo”, o que subestima ligeiramente “superior completo” (uma graduação de três anos soma 14 anos de estudo e cai na classe anterior). Na edição 1980 a escolaridade é reconstruída de “última série concluída” cruzada com “grau”, uma aproximação declarada que subestima o nível de quem ainda estudava. A categoria “sem declaração” fica fora do cálculo das participações, em todas as edições.",
  },

  renda_domiciliar: {
    termo: "Renda domiciliar per capita",
    definicao:
      "Renda total do domicílio dividida pelo número de moradores, apresentada em faixas de salário mínimo (até 1/4, de 1/4 a 1/2, de 1/2 a 1, de 1 a 2, e mais de 2 salários mínimos). O salário mínimo é o vigente na data de referência de cada censo, o que torna as faixas comparáveis entre edições apesar da mudança de moeda e da inflação. Quem mora em domicílio coletivo aparece na categoria “domicílio coletivo”, porque para esses casos a renda domiciliar per capita não é definida.",
    interpretacao:
      "Como na escolaridade, o interesse está na comparação entre migrantes e residentes não migrantes: é isso que revela se a migração seleciona por renda, e em qual direção.",
    limitacoes:
      "Não é publicada na edição 1980 — na fonte utilizada, os rendimentos estão preenchidos em apenas uma unidade da federação e vazios nas demais. Em 1991 o divisor é o salário mínimo implícito nas faixas de rendimento do próprio IBGE, e não o mínimo legal da época, o que é o que faz os cortes coincidirem com as tabulações oficiais daquele censo. Como a escolaridade, a renda é medida no fim do período: não se sabe se é causa ou consequência da migração.",
  },

  idade_sexo: {
    termo: "Perfil por idade e sexo",
    definicao:
      "Composição cruzada de faixa etária (5 a 14, 15 a 24, 25 a 39, 40 a 59, e 60 anos ou mais) e sexo, tanto dos migrantes quanto dos residentes, o que permite montar a pirâmide de cada grupo.",
    interpretacao:
      "A migração é fortemente concentrada entre 15 e 39 anos; um perfil migrante mais velho que o padrão sugere migração de retorno ou de aposentadoria, e a presença da faixa de 5 a 14 anos indica deslocamento de famílias com filhos, não de pessoas sozinhas. A razão entre homens e mulheres revela seletividade por sexo, comum em fluxos ligados a ocupações específicas.",
    limitacoes:
      "As cinco faixas são largas: não permitem localizar a idade de pico da migração com precisão melhor que a largura da faixa, nem ajustar um perfil etário detalhado. O sexo “indeterminado” só existe como categoria na edição 2022 e pesa menos de 0,03% do total; ele entra no total da faixa etária, mas fica fora do denominador da razão entre os sexos, em todas as edições, para que a comparação use a mesma base.",
  },
};

/** Termo do glossário, ou `undefined` quando a chave não existe. */
export function termo(chave: string): TermoGlossario | undefined {
  return GLOSSARIO[chave];
}

/** Chaves do glossário, em ordem de declaração. */
export const CHAVES_GLOSSARIO = Object.keys(GLOSSARIO);
