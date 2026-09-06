/** Conteúdo da página de metodologia (F6): texto para um leitor técnico não especialista,
 *  baseado em docs/METODOLOGIA.md e no plano aprovado. Nenhum dado individual aparece aqui --
 *  só definições, fórmulas e os limiares de revelação (lidos de meta.json, não fixados no
 *  código, para nunca divergir do que o gate realmente aplicou). */
import type { Meta } from "../lib/types";

export function Metodologia({ meta }: { meta: Meta | null }) {
  const r = meta?.revelacao;
  const sm = meta?.salario_minimo_referencia;

  return (
    <div className="metodologia-conteudo">
      <section>
        <h3>Fonte e universo</h3>
        <p>
          Os dados vêm do Censo Demográfico 2022 do IBGE, microdados da amostra (acesso controlado),
          quesito de migração (Migração Interna e Internacional). O universo é a população de 5 anos
          ou mais residente em 2022; o quesito de município de residência há 5 anos só é respondido
          por quem mora há menos de 6 anos no município atual.
        </p>
      </section>

      <section>
        <h3>Migrante de data fixa</h3>
        <p>
          Compara-se o município de residência em 31/07/2017 com o de 31/07/2022 -- um único par de
          pontos no tempo, e não o histórico de mudanças no quinquênio. É <strong>migrante interno</strong>{" "}
          quem morava em outro município do Brasil em 2017; <strong>migrante internacional</strong>, quem
          morava em outro país; <strong>não migrante</strong>, quem já morava no mesmo município (ou mora
          ali há 6 anos ou mais). Cerca de 1,8% dos migrantes internos têm origem não informada: contam
          na imigração total do destino, mas ficam fora da matriz origem→destino e do cômputo de emigração
          -- por isso a soma das linhas de uma coluna de destino pode superar ligeiramente o total de
          migrantes com origem conhecida daquele município.
        </p>
      </section>

      <section>
        <h3>Indicadores</h3>
        <p>Para um município (ou unidade agregada) qualquer, com população de referência P (pessoas de 5+ anos em 2022):</p>
        <dl className="formulas">
          <dt>Imigrantes (I)</dt>
          <dd>total de pessoas com origem conhecida cujo destino é essa unidade.</dd>
          <dt>Emigrantes (E)</dt>
          <dd>total de pessoas com origem conhecida cuja origem é essa unidade.</dd>
          <dt>Saldo migratório</dt>
          <dd><code>Saldo = I − E</code></dd>
          <dt>Taxa líquida de migração (TLM)</dt>
          <dd><code>TLM = (Saldo / P) × 1000</code> -- por mil habitantes.</dd>
          <dt>Índice de eficácia migratória (IEM)</dt>
          <dd><code>IEM = Saldo / (I + E)</code>, entre −1 e 1: perto de 0 indica trocas equilibradas
            (alto volume nos dois sentidos); perto de ±1, um fluxo predominantemente unidirecional.</dd>
        </dl>
      </section>

      <section>
        <h3>Tipologia de status migratório</h3>
        <p>
          Cada migrante interno é classificado por sua trajetória: <strong>retorno ao município natal</strong>{" "}
          (o destino em 2022 é onde nasceu), <strong>primeira saída do município natal</strong>,{" "}
          <strong>migração de etapas múltiplas</strong> (nem nasceu, nem retornou ao destino),
          além das categorias de migração internacional (nascido no exterior migrando internamente,
          retorno do exterior, ou imigração internacional de estrangeiro) e origem não informada.
        </p>
      </section>

      <section>
        <h3>Escolaridade e renda</h3>
        <p>
          A escolaridade é resumida em quatro faixas (sem instrução/fundamental incompleto,
          fundamental completo/médio incompleto, médio completo/superior incompleto, superior
          completo), sempre restrita à população de 25 anos ou mais -- idade em que a maior parte
          já concluiu (ou não) sua trajetória escolar. A renda domiciliar per capita é expressa em
          múltiplos do salário mínimo vigente na referência do Censo
          {sm ? ` (R$ ${sm.toLocaleString("pt-BR")})` : ""}, para não perder o sentido com a inflação.
        </p>
      </section>

      <section>
        <h3>Precisão das estimativas</h3>
        <p>
          Os microdados vêm de uma amostra, não do universo -- toda contagem é uma estimativa sujeita
          a erro amostral. O erro-padrão é calculado por um estimador conservador de conglomerados
          (o domicílio como unidade primária de amostragem, a área de ponderação como estrato), na
          ausência de estratos/UPAs formais nos microdados de acesso controlado; foi comparado à
          Função Generalizada de Variância do IBGE e ficou na mesma ordem de grandeza.
        </p>
        <p>Cada estimativa publicada recebe uma faixa de precisão pelo coeficiente de variação (CV):</p>
        <ul>
          <li><strong>boa</strong>: CV até {r ? `${r.cv_boa}%` : "15%"}</li>
          <li><strong>razoável, use com cautela</strong>: CV entre {r ? `${r.cv_boa}% e ${r.cv_cautela}%` : "15% e 30%"}</li>
          <li><strong>baixa precisão</strong>: CV acima de {r ? `${r.cv_cautela}%` : "30%"}</li>
        </ul>
      </section>

      <section>
        <h3>Controle de revelação</h3>
        <p>
          Antes de qualquer dado ir ao ar, um gate automático (regras R1–R9) verifica se a publicação
          poderia individualizar alguém:
        </p>
        <ul>
          <li>nenhum fluxo ou categoria é publicado com menos de {r?.min_pessoas ?? 5} pessoas
            (estimativa ponderada) ou menos de {r?.min_domicilios ?? 3} domicílios amostrados;</li>
          <li>o detalhamento por característica (escolaridade, renda, idade/sexo, dimensões pendulares)
            só aparece para fluxos com pelo menos {r?.min_pessoas_detalhe ?? 20} observações amostrais;</li>
          <li>toda contagem ponderada é arredondada a múltiplos de {r?.arredondamento ?? 5};</li>
          <li>nenhuma contagem amostral exata é publicada -- apenas faixas;</li>
          <li>colunas de domicílio e de área de ponderação nunca saem dos microdados de acesso controlado.</li>
        </ul>
        <p>
          Em caso de dúvida sobre se uma célula individualiza alguém, o critério do projeto é tratá-la
          como individualizante e não publicá-la -- por isso vários pares de município aparecem "abaixo
          do limiar de divulgação" em vez de mostrarem um número pequeno.
        </p>
      </section>

      <section>
        <h3>Módulo metropolitano</h3>
        <p>
          O recorte de regiões metropolitanas (RMs) e RIDEs segue a divisão institucional do IBGE; o
          <strong> núcleo</strong> de cada uma é seu município mais populoso. O modo RM soma três peças:
          migração <strong>intra-RM</strong> (fluxos entre municípios da mesma RM, incluindo a matriz
          núcleo×periferia), deslocamento <strong>pendular</strong> de trabalho e de estudo (quem mora
          num município da RM e trabalha/estuda em outro), e o <strong>cruzamento</strong> entre os dois:
          para cada migrante intrametropolitano ocupado, onde trabalha -- na origem de onde saiu, no
          núcleo, no próprio destino, ou em outro lugar.
        </p>
      </section>

      <section>
        <h3>Níveis de agregação</h3>
        <p>
          Além do município, o atlas agrega em região imediata (RGI), região intermediária (RGInt) e
          UF -- a mesma hierarquia territorial do IBGE. Nesses níveis, migração entre municípios da
          mesma unidade não é contada (só atravessa a fronteira da unidade), pares de municípios
          suprimidos pelo gate de revelação ficam de fora da soma agregada, e não há erro-padrão
          publicado -- os indicadores agregados são somas diretas dos fluxos municipais publicados,
          não uma nova estimativa com sua própria variância.
        </p>
      </section>

      <section>
        <h3>Limitações</h3>
        <ul>
          <li>Migração de data fixa não captura movimentos múltiplos dentro do quinquênio, só o par
            (residência em 2017, residência em 2022).</li>
          <li>Resultados podem divergir de tabulações oficiais do IBGE (SIDRA) por subamostragem,
            supressão e recalibração aplicadas aos microdados de acesso controlado.</li>
          <li>Nos níveis agregados (RGI, RGInt, UF), a ausência de erro-padrão publicado significa que
            comparações entre unidades pequenas devem ser lidas com cautela adicional.</li>
        </ul>
      </section>

      {meta?.aviso && (
        <section>
          <h3>Aviso padrão</h3>
          <p className="aviso">{meta.aviso}</p>
        </section>
      )}
    </div>
  );
}
