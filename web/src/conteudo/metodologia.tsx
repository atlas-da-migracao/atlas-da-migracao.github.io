/** Conteúdo da página de metodologia (F6): texto para um leitor técnico não especialista,
 *  baseado em docs/METODOLOGIA.md e no plano aprovado. Nenhum dado individual aparece aqui --
 *  só definições, fórmulas e os limiares de revelação (lidos de meta.json, não fixados no
 *  código, para nunca divergir do que o gate realmente aplicou).
 *
 *  A página é *por edição* (F9.7-b): até a edição 1980 ela estava fixada no texto de 2022 e
 *  contradizia o rodapé em 2010/2000/1991/1980 ("acesso controlado" e "31/07/2017" ao lado de
 *  "Censo Demográfico 1980 (IBGE, dados públicos)"). Três fontes alimentam o texto, nesta ordem
 *  de preferência:
 *    1. `meta` (pipeline/build_meta.py), para tudo que o gate/pipeline já carimba -- fonte,
 *       limiares efetivos, salário mínimo, avisos;
 *    2. `edicao(censo)` (lib/edicoes.ts), para os fatos estruturais já declarados -- período,
 *       proxy de data fixa, recursos ausentes, vocabulário de status;
 *    3. o mapa TEXTO abaixo, só para a prosa que depende do questionário de cada censo e que
 *       não existe em nenhum dos dois.
 *  TEXTO é um `Record<Censo, ...>` de propósito: uma edição nova quebra o build até que alguém
 *  escreva a metodologia dela -- foi exatamente a falta desse travamento que deixou quatro
 *  edições publicadas com o texto de 2022. */
import { edicao } from "../lib/edicoes";
import type { Censo } from "../lib/edicoes";
import type { Meta } from "../lib/types";
import { useStore } from "../state/store";

/** Base do erro-padrão publicado pela edição. "area_ponderacao" é o caso das edições com o
 *  desenho amostral completo (domicílio como UPA, área de ponderação como estrato);
 *  "estrato_aproximado", o das que não têm área de ponderação e usam um substituto mais
 *  heterogêneo (Censo 1991, ver docs/METODOLOGIA.md, item 9 daquela seção); "ausente", o das
 *  que não publicam `se`/`cv` nenhum porque a fonte não tem chave de domicílio (Censo 1980,
 *  item 8.1). O pipeline declara o mesmo fato em `pipeline/edicoes.py` (`chave_domicilio`), e
 *  ele chega ao front também em `meta.revelacao.min_domicilios` (null <=> sem chave). */
type BasePrecisao = "area_ponderacao" | "estrato_aproximado" | "ausente";

interface TextoEdicao {
  /** espelha `Edicao.acesso` de pipeline/edicoes.py; a mesma informação aparece em prosa
   *  dentro de `meta.fonte` ("acesso controlado" / "dados públicos"). */
  acesso: "controlado" | "publico";
  /** quem respondeu o quesito que sustenta a migração desta edição (seção "Fonte e universo"). */
  universo: string;
  /** procedência, quando ela não é a cópia distribuída pelo IBGE (só 1980). */
  fonteNota: string | null;
  /** primeira frase sobre origem não informada: com o número quando ele está documentado em
   *  docs/METODOLOGIA.md, genérica quando não (o painel de cada município mostra o valor). */
  origemNaoInformada: string;
  precisao: BasePrecisao;
  /** limitações próprias da edição, somadas às gerais; vazio quando não há nenhuma além das
   *  que as outras seções já explicam. Resumos de docs/METODOLOGIA.md, "Limitações conhecidas". */
  limitacoes: string[];
}

const TEXTO: Record<Censo, TextoEdicao> = {
  "2022": {
    acesso: "controlado",
    universo:
      "o bloco de migração do questionário da amostra (Migração Interna e Internacional) traz o "
      + "município de residência há 5 anos, respondido só por quem mora há menos de 6 anos no "
      + "município atual.",
    fonteNota: null,
    origemNaoInformada:
      "Cerca de 1,2% (150,4 mil de 13,0 milhões) dos migrantes internos têm origem não informada.",
    precisao: "area_ponderacao",
    limitacoes: [],
  },
  "2010": {
    acesso: "publico",
    universo:
      "o quesito de município de residência há 5 anos tem o mesmo filtro de 2022: só foi "
      + "aplicado a quem morava há menos de 6 anos no município atual.",
    fonteNota: null,
    origemNaoInformada: "Uma parcela dos migrantes internos tem origem não informada.",
    precisao: "area_ponderacao",
    limitacoes: [
      "A frequência do deslocamento pendular pergunta, nesta edição, se a pessoa retorna do "
      + "trabalho para casa diariamente; em 2022 a pergunta é se retorna três ou mais dias por "
      + "semana. Os códigos coincidem, as definições não — as duas edições não formam uma série.",
    ],
  },
  "2000": {
    acesso: "publico",
    universo:
      "o quesito de município de residência há 5 anos foi aplicado a todos que declararam não "
      + "morar no município desde que nasceram — um universo mais largo que o de 2010 e 2022, "
      + "sem o filtro de tempo de residência.",
    fonteNota: null,
    origemNaoInformada: "Uma parcela dos migrantes internos tem origem não informada.",
    precisao: "area_ponderacao",
    limitacoes: [
      "A dimensão ocupacional desta edição não é comparável em nível com as de 2010 e 2022: a "
      + "classificação de 2000 não tem o grande grupo de “ocupações elementares”, e a massa "
      + "correspondente reaparece distribuída entre serviços, agropecuária e indústria.",
    ],
  },
  "1991": {
    acesso: "publico",
    universo:
      "o quesito de município de residência há 5 anos só foi feito a quem não declarou ter "
      + "sempre morado no município — o branco do quesito é o salto do questionário, e não uma "
      + "não-resposta.",
    fonteNota: null,
    origemNaoInformada: "Uma parcela dos migrantes internos tem origem não informada.",
    precisao: "estrato_aproximado",
    limitacoes: [
      "O anacronismo territorial é bem mais acentuado que nas edições recentes: 1.082 códigos "
      + "municipais de 2022 não existem na malha de 1991, 66 das 81 regiões metropolitanas "
      + "aparecem com menos municípios do que têm hoje e três delas ficam com um único município "
      + "(Porto Velho, Santarém e Central), o que zera por construção — não por medida — os "
      + "indicadores intrametropolitanos dessas três.",
    ],
  },
  "1980": {
    acesso: "publico",
    universo:
      "no lugar do quesito de residência há 5 anos, que esta edição não tem, ficam dois outros: "
      + "há quantos anos a pessoa mora no município atual e qual foi o município onde morava "
      + "antes — este último coletado de quem mora no município há menos de dez anos, inclusive "
      + "de quem nasceu nele.",
    fonteNota:
      "Os microdados da amostra de 1980 são públicos, mas as cópias em circulação omitem a "
      + "variável de município de residência anterior, que é o que sustenta a migração desta "
      + "edição. O atlas usa, por isso, a cópia publicada pela Base dos Dados (BigQuery), cujas "
      + "contagens por unidade da federação foram conferidas uma a uma contra a cópia em DBF do "
      + "IBGE. É a única edição do atlas alimentada por uma fonte secundária.",
    origemNaoInformada:
      "Cerca de 7,0% dos migrantes internos têm origem não informada — a maior parcela do atlas. "
      + "São as próprias sentinelas do questionário de 1980: quem declarou a unidade da federação "
      + "de origem mas não o município, e as respostas \u201cBrasil sem especificação\u201d e "
      + "\u201cignorado\u201d.",
    precisao: "ausente",
    limitacoes: [
      "A migração desta edição é estimada por um proxy, e não medida por um quesito de data "
      + "fixa: volumes, saldos e distâncias carregam o desvio descrito no selo proxy, no fim "
      + "desta página. Comparações entre edições valem para composição, direção e hierarquia dos "
      + "fluxos, não para o nível.",
      "Não há nenhuma variável de renda nesta edição, e não há erro amostral publicado: as "
      + "estimativas são pontuais, sem intervalo de confiança.",
      "O território do atual Tocantins aparece como UMA unidade, não município a município: os "
      + "52 municípios do norte de Goiás chegam sem código de município na fonte, e por isso são "
      + "publicados juntos, sob o nome \u201cNorte de Goiás (atual Tocantins)\u201d. Essa unidade "
      + "tem população, imigração, emigração, saldo e um polígono próprios, e aparece nos dois "
      + "lados dos fluxos — mas não é um município: mudanças entre os 52 não contam como "
      + "migração, e ela não pertence a nenhuma região imediata ou intermediária. Por isso, e "
      + "pelo recorte de 2022 aplicado a uma malha de 1980, 21 regiões imediatas e 3 "
      + "intermediárias aparecem sem nenhum município. Um recorte vazio não é um recorte sem "
      + "fluxo.",
    ],
  },
};

/** "2017-07-31" -> "31/07/2017". */
function dataBR(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

export function Metodologia({ meta }: { meta: Meta | null }) {
  const censo = useStore((s) => s.censo);
  const ed = edicao(censo);
  const t = TEXTO[censo];
  const r = meta?.revelacao;
  const sm = meta?.salario_minimo_referencia;

  const anoDe = ed.periodo.de.slice(0, 4);
  const anoAte = ed.periodo.ate.slice(0, 4);
  const fonte = meta?.fonte ?? `IBGE, Censo Demográfico ${ed.nome}, microdados da amostra`;
  const rotuloNaoNatural = meta?.rotulos?.status?.nao_natural
    ?? "não nasceu no município nem no exterior";
  // R2 só pode prometer detalhe nas dimensões que a edição publica (1980 não tem renda, 1991
  // não tem módulo pendular) -- mesmo padrão de recursos.* usado em Filtro/PainelPendular.
  const dimensoesDetalhe = [
    "escolaridade",
    ...(ed.recursos.renda ? ["renda"] : []),
    "idade/sexo",
    ...(ed.recursos.pendular ? ["dimensões pendulares"] : []),
  ].join(", ");

  return (
    <div className="metodologia-conteudo">
      <section>
        <h3>Fonte e universo</h3>
        <p>
          <strong>Fonte:</strong> {fonte}. O universo é a população de 5 anos ou mais residente
          em {anoAte}; {t.universo}
        </p>
        {t.fonteNota && <p>{t.fonteNota}</p>}
      </section>

      <section>
        <h3>{ed.proxyDataFixa ? "Migração estimada por proxy" : "Migrante de data fixa"}</h3>
        {ed.proxyDataFixa ? (
          <>
            <p>
              O questionário desta edição não pergunta onde a pessoa morava cinco anos antes, então
              não há migração de data fixa a medir. O atlas combina os dois quesitos que existem —
              há quantos anos a pessoa mora no município atual e qual foi o município de residência
              imediatamente anterior (a chamada <em>última etapa</em>) — e classifica como{" "}
              <strong>migrante</strong> quem mora no município há menos de cinco anos e declara um
              município anterior; a <strong>origem</strong> é esse município. A janela
              publicada, {dataBR(ed.periodo.de)} a {dataBR(ed.periodo.ate)}, alinha a edição aos
              quinquênios das demais, mas não é uma data de referência do questionário.
            </p>
            <p>
              Última etapa não é data fixa: quem migrou em duas etapas dentro do período aparece
              com a origem da última, e quem saiu e voltou aparece como migrante sem ter mudado de
              município entre as duas datas. O proxy foi calibrado contra a data fixa verdadeira do
              Censo 1991, e o preço dessa troca — em volume, saldo e distância dos fluxos — está
              medido no selo proxy, no fim desta página.
            </p>
          </>
        ) : (
          <p>
            Compara-se o município de residência em {dataBR(ed.periodo.de)} com o
            de {dataBR(ed.periodo.ate)} — um único par de pontos no tempo, e não o histórico de
            mudanças no quinquênio. É <strong>migrante interno</strong> quem morava em outro
            município do Brasil em {anoDe}; <strong>migrante internacional</strong>, quem morava em
            outro país; <strong>não migrante</strong>, quem já morava no mesmo município.
          </p>
        )}
        <p>
          {t.origemNaoInformada} Esses registros contam na imigração total do destino, mas ficam
          fora da matriz origem→destino e do cômputo de emigração — por isso a soma das linhas de
          uma coluna de destino pode superar ligeiramente o total de migrantes com origem conhecida
          daquele município. O painel de cada município informa quantos imigrantes chegaram com
          origem não informada.
        </p>
      </section>

      <section>
        <h3>Indicadores</h3>
        <p>Para um município (ou unidade agregada) qualquer, com população de referência P (pessoas de 5+ anos em {anoAte}):</p>
        <dl className="formulas">
          <dt>Imigrantes (I)</dt>
          <dd>total de pessoas com origem conhecida cujo destino é essa unidade.</dd>
          <dt>Emigrantes (E)</dt>
          <dd>total de pessoas com origem conhecida cuja origem é essa unidade.</dd>
          <dt>Saldo migratório</dt>
          <dd><code>Saldo = I − E</code></dd>
          <dt>Taxa líquida de migração (TLM)</dt>
          <dd><code>TLM = (Saldo / P) × 1000</code> — por mil habitantes.</dd>
          <dt>Índice de eficácia migratória (IEM)</dt>
          <dd><code>IEM = Saldo / (I + E)</code>, entre −1 e 1: perto de 0 indica trocas equilibradas
            (alto volume nos dois sentidos); perto de ±1, um fluxo predominantemente unidirecional.</dd>
        </dl>
      </section>

      <section>
        <h3>Tipologia de status migratório</h3>
        {/* O vocabulário de status varia por edição (mesma lista de
            pipeline/disclosure_rules.STATUS_POR_EDICAO): só 2022 coleta o município de
            nascimento e consegue separar primeira saída de etapas múltiplas. */}
        {ed.statusCategorias.includes("primeira_saida") ? (
          <p>
            Cada migrante interno é classificado por sua trajetória: <strong>retorno ao município natal</strong>{" "}
            (o destino em {anoAte} é onde nasceu), <strong>primeira saída do município natal</strong>,{" "}
            <strong>migração de etapas múltiplas</strong> (nem nasceu, nem retornou ao destino),
            além das categorias de migração internacional (nascido no exterior migrando internamente,
            retorno do exterior, ou imigração internacional de estrangeiro) e origem não informada.
          </p>
        ) : (
          <>
            <p>
              Cada migrante interno é classificado por sua trajetória: <strong>retorno ao município
              natal</strong> (o destino em {anoAte} é onde nasceu) ou <strong>migrante não
              natural</strong> — nem nasceu no município de destino, nem no exterior —, além das
              categorias de migração internacional (nascido no exterior migrando internamente,
              retorno do exterior, ou imigração internacional de estrangeiro) e origem não informada.
            </p>
            <p className="muted-pequeno">
              O vocabulário desta edição é mais curto que o de 2022: o questionário não coleta o{" "}
              <em>município</em> de nascimento — apenas se a pessoa nasceu no município onde mora e,
              em caso negativo, a unidade da federação ou o país. Sem o município natal é impossível
              separar a primeira saída do município natal da migração de etapas múltiplas, e as duas
              ficam juntas na categoria que os gráficos chamam de “{rotuloNaoNatural}”.
            </p>
          </>
        )}
      </section>

      <section>
        <h3>{ed.recursos.renda ? "Escolaridade e renda" : "Escolaridade"}</h3>
        <p>
          A escolaridade é resumida em quatro faixas (sem instrução/fundamental incompleto,
          fundamental completo/médio incompleto, médio completo/superior incompleto, superior
          completo), sempre restrita à população de 25 anos ou mais — idade em que a maior parte
          já concluiu (ou não) sua trajetória escolar.
          {ed.recursos.renda
            ? <> A renda domiciliar per capita é expressa em múltiplos do salário mínimo de
                referência de cada Censo{sm ? ` (${sm.toLocaleString("pt-BR")})` : ""}, para não
                perder o sentido com a inflação.</>
            : null}
        </p>
        {/* recursos.renda === false: a fonte desta edição traz os rendimentos preenchidos em uma
            única UF (ver docs/METODOLOGIA.md, "Edição Censo 1980 e comparabilidade", item 7), e o
            atlas não publica renda nenhuma -- nem o filtro, nem a dimensão do módulo pendular. */}
        {!ed.recursos.renda && (
          <p>
            <strong>Esta edição não publica renda.</strong> Na fonte usada, as variáveis de
            rendimento vêm preenchidas em uma única unidade da federação e vazias nas outras 26 —
            publicar um recorte nacional construído sobre menos de 5% da amostra seria pior do que
            declarar a ausência. Todas as colunas de renda são nulas, e não há filtro de renda nem
            dimensão de renda no módulo de deslocamento pendular.
          </p>
        )}
      </section>

      <section>
        <h3>Precisão das estimativas</h3>
        {t.precisao === "ausente" ? (
          <>
            {/* Sem chave de domicílio não há unidade primária de amostragem, e o estimador de
                conglomerados subestimaria a variância -- ver docs/METODOLOGIA.md, item 8.1 da
                seção de 1980. O mesmo fato chega em meta.revelacao.min_domicilios === null e
                governa os limiares da seção seguinte. */}
            <p>
              <strong>Esta edição não publica erro amostral.</strong> A fonte não traz identificador
              de domicílio, e sem a unidade primária de amostragem o estimador de conglomerados
              usado nas demais edições trataria cada pessoa como uma observação independente —
              subestimando a variância, que é o erro que engana para o lado otimista. Por isso o
              erro-padrão e o coeficiente de variação são nulos em todas as tabelas, e a precisão
              aparece como <strong>sem estimativa</strong>.
            </p>
            <p>
              Na prática: os números desta edição são estimativas pontuais, sem intervalo de
              confiança, e a diferença entre duas células pequenas não tem teste disponível. É
              também por isso que os limiares de divulgação desta edição são mais altos que os das
              outras (ver a seção seguinte).
            </p>
          </>
        ) : (
          <>
            <p>
              Os microdados vêm de uma amostra, não do universo — toda contagem é uma estimativa sujeita
              a erro amostral. O erro-padrão é calculado por um estimador conservador de conglomerados
              (o domicílio como unidade primária de amostragem
              {t.precisao === "area_ponderacao"
                ? ", a área de ponderação como estrato), na ausência de estratos/UPAs formais nos "
                  + "microdados da amostra; o estimador foi comparado à Função Generalizada de "
                  + "Variância do IBGE e ficou na mesma ordem de grandeza."
                : "), na ausência de estratos/UPAs formais nos microdados da amostra."}
            </p>
            {t.precisao === "estrato_aproximado" && (
              <p>
                Esta edição, porém, não tem área de ponderação: o estrato usado é um substituto —
                município × situação urbano/rural —, mais heterogêneo que a área real. A precisão
                publicada aqui é, portanto, <strong>aproximada e conservadora</strong>: em fluxos de
                mesmo tamanho amostral, o coeficiente de variação mediano fica de 5% a 20% acima do
                de uma edição com área de ponderação, e não deve ser comparado ponto a ponto com o
                das outras edições.
              </p>
            )}
            <p>Cada estimativa publicada recebe uma faixa de precisão pelo coeficiente de variação (CV):</p>
            <ul>
              <li><strong>boa</strong>: CV até {r ? `${r.cv_boa}%` : "15%"}</li>
              <li><strong>razoável, use com cautela</strong>: CV entre {r ? `${r.cv_boa}% e ${r.cv_cautela}%` : "15% e 30%"}</li>
              <li><strong>baixa precisão</strong>: CV acima de {r ? `${r.cv_cautela}%` : "30%"}</li>
            </ul>
          </>
        )}
      </section>

      <section>
        <h3>Controle de revelação</h3>
        <p>
          Antes de qualquer dado ir ao ar, um gate automático (regras R1–R9) verifica se a publicação
          poderia individualizar alguém:
        </p>
        <ul>
          {/* min_domicilios vem null quando a fonte do censo não publica identificador de
              domicílio (Censo 1980): lá o piso de domicílios não é calculável e foi substituído
              por um piso de pessoas mais alto — ver docs/METODOLOGIA.md, seção de 1980, item 8. */}
          <li>nenhum fluxo ou categoria é publicado com menos de {r?.min_pessoas ?? 5} pessoas
            {r && r.min_domicilios == null
              ? " amostradas — nesta edição o censo não identifica o domicílio, então o piso"
                + " usual de domicílios amostrados foi substituído por esse piso de pessoas,"
                + " mais alto que o das demais edições"
              : ` (estimativa ponderada) ou menos de ${r?.min_domicilios ?? 3} domicílios amostrados`};</li>
          <li>o detalhamento por característica ({dimensoesDetalhe})
            só aparece para fluxos com pelo menos {r?.min_pessoas_detalhe ?? 20} observações amostrais;</li>
          <li>toda contagem ponderada é arredondada a múltiplos de {r?.arredondamento ?? 5};</li>
          <li>nenhuma contagem amostral exata é publicada — apenas faixas;</li>
          <li>{t.acesso === "controlado"
            ? "colunas de domicílio e de área de ponderação nunca saem dos microdados de acesso controlado."
            : "colunas de identificação de domicílio e de área de ponderação nunca são publicadas, ainda que os microdados de origem sejam públicos."}</li>
        </ul>
        <p>
          Em caso de dúvida sobre se uma célula individualiza alguém, o critério do projeto é tratá-la
          como individualizante e não publicá-la — por isso vários pares de município aparecem "abaixo
          do limiar de divulgação" em vez de mostrarem um número pequeno.
        </p>
      </section>

      <section>
        <h3>Módulo metropolitano</h3>
        <p>
          O recorte de regiões metropolitanas (RMs) e RIDEs segue a divisão institucional do IBGE; o
          <strong> núcleo</strong> de cada uma é o município homônimo da região (por exemplo, Vitória na
          Grande Vitória); quando não há homônimo, é o mais populoso.
          {/* Todas as edições usam o recorte de 2022 aplicado retroativamente por código de
              município (convenção do atlas, ver docs/EDICOES.md); só em 2022 ele é
              contemporâneo dos dados. */}
          {ed.nome !== "2022" && (
            <> O recorte é o de 2022 aplicado retroativamente por código de município — convenção do
              atlas para todas as edições —, de modo que uma região pode aparecer aqui com menos
              municípios do que tem hoje: os que ainda não existiam na data do censo simplesmente
              não estão lá.</>
          )}
        </p>
        {ed.recursos.pendular ? (
          <>
            <p>
              O modo RM soma três peças: migração <strong>intra-RM</strong> (fluxos entre municípios
              da mesma RM, incluindo a matriz núcleo×periferia), deslocamento <strong>pendular</strong>{" "}
              de trabalho e de estudo (quem mora num município da RM e trabalha/estuda em outro), e o{" "}
              <strong>cruzamento</strong> entre os dois: para cada migrante intrametropolitano ocupado,
              onde trabalha — na origem de onde saiu, no núcleo, no próprio destino, ou em outro lugar.
            </p>
            {/* pendularCampoUnico: um só quesito de trabalho/estudo, com precedência do trabalho
                (2000 e 1980) -- ver docs/METODOLOGIA.md e docs/EDICOES.md, aviso 3. */}
            {ed.pendularCampoUnico && (
              <p>
                Nesta edição, trabalho e estudo vêm de um <strong>único quesito</strong>, com
                precedência do trabalho: quem trabalha e estuda em municípios diferentes só aparece no
                fluxo de trabalho. O deslocamento pendular para <strong>estudo</strong> é, por isso, um{" "}
                <strong>piso</strong>, e não uma estimativa do total — comparável a outras edições em
                composição e direção, nunca em nível.
              </p>
            )}
          </>
        ) : (
          /* recursos.pendular === false (Censo 1991): o questionário não pergunta o município de
             trabalho/estudo, e o módulo pendular inteiro não é publicado. */
          <p>
            Nesta edição o modo RM tem uma peça só: a migração <strong>intra-RM</strong> (fluxos entre
            municípios da mesma RM, incluindo a matriz núcleo×periferia). O questionário não pergunta
            em que município a pessoa trabalha ou estuda, de modo que não há deslocamento{" "}
            <strong>pendular</strong> nem o cruzamento entre migração e pendularidade que as outras
            edições publicam.
          </p>
        )}
      </section>

      <section>
        <h3>Níveis de agregação</h3>
        <p>
          Além do município, o atlas agrega em região imediata (RGI), região intermediária (RGInt) e
          UF — a mesma hierarquia territorial do IBGE. Nesses níveis, migração entre municípios da
          mesma unidade não é contada (só atravessa a fronteira da unidade), pares de municípios
          suprimidos pelo gate de revelação ficam de fora da soma agregada, e não há erro-padrão
          publicado — os indicadores agregados são somas diretas dos fluxos municipais publicados,
          não uma nova estimativa com sua própria variância.
        </p>
      </section>

      <section>
        <h3>Limitações</h3>
        <ul>
          {!ed.proxyDataFixa && (
            <li>Migração de data fixa não captura movimentos múltiplos dentro do quinquênio, só o par
              (residência em {anoDe}, residência em {anoAte}).</li>
          )}
          <li>Resultados podem divergir de tabulações oficiais do IBGE (SIDRA)
            {t.acesso === "controlado"
              ? " por subamostragem, supressão e recalibração aplicadas aos microdados de acesso controlado."
              : " por diferenças de expansão da amostra e pela supressão aplicada aqui por sigilo."}</li>
          {t.precisao !== "ausente" && (
            <li>Nos níveis agregados (RGI, RGInt, UF), a ausência de erro-padrão publicado significa que
              comparações entre unidades pequenas devem ser lidas com cautela adicional.</li>
          )}
          {t.limitacoes.map((texto) => <li key={texto}>{texto}</li>)}
        </ul>
      </section>

      {meta?.citacao && (
        <section>
          <h3>Como citar</h3>
          <p>
            {meta.citacao.autor} (<a href={meta.citacao.autor_orcid}>ORCID</a>). <em>Atlas
            da migração interna no Brasil</em>. Dados do Censo Demográfico {ed.nome} (IBGE).
            DOI: <a href={`https://doi.org/${meta.citacao.doi_conceito}`}>{meta.citacao.doi_conceito}</a>
            {" "}(todas as versões) /{" "}
            <a href={`https://doi.org/${meta.citacao.doi_versao}`}>{meta.citacao.doi_versao}</a> (v1.0.0).
          </p>
          <p className="muted-pequeno">
            Dados e conteúdo sob{" "}
            <a href={meta.citacao.licenca_url}>{meta.citacao.licenca}</a>, com atribuição ao
            IBGE como fonte primária. Metadados estruturados em{" "}
            <a href="https://github.com/atlas-da-migracao/atlas-da-migracao.github.io/blob/main/CITATION.cff">CITATION.cff</a>.
          </p>
        </section>
      )}

      {meta?.aviso && (
        <section>
          <h3>Aviso padrão</h3>
          <p className="aviso">{meta.aviso}</p>
        </section>
      )}

      {meta?.aviso_proxy && (
        <section>
          <h3>Selo proxy (edição em vigor)</h3>
          <p className="aviso aviso-proxy">{meta.aviso_proxy}</p>
        </section>
      )}
    </div>
  );
}
