/** Metodologia em espanhol -- tradução fiel de pt.tsx (a versão de referência), seção por seção e
 *  com a mesma estrutura condicional por edição. Termos e siglas: i18n/TERMINOLOGIA.md (espanhol
 *  neutro, léxico da CEPAL/CELADE; números no formato es-ES, com agrupamento também em 4 dígitos;
 *  aspas « »). Espaço inseparável antes de % (`\u00a0`, como o `Intl`).
 *  Mudou o pt.tsx? Repita a mudança aqui. */
import type { ReactNode } from "react";
import type { Censo } from "../../lib/edicoes";
import { rotuloCategoria } from "../../lib/paletas";
import { useT } from "../../i18n";
import {
  MOEDA_SALARIO, VERSAO_ATLAS, dataEdicao, salarioMinimo, useContextoMetodologia,
  type Moeda, type PropsMetodologia, type TextoEdicao,
} from "./comum";

const TEXTO: Record<Censo, TextoEdicao> = {
  "2022": {
    universo:
      "el bloque de migración del cuestionario ampliado de la muestra (Migración Interna e "
      + "Internacional) registra el municipio de residencia 5 años antes, respondido solo por "
      + "quienes viven hace menos de 6 años en el municipio actual.",
    fonteNota: null,
    origemNaoInformada:
      "Cerca del 1,2\u00a0% (150,4 mil de 13,0 millones) de los migrantes internos tiene origen "
      + "no declarado.",
    limitacoes: [],
  },
  "2010": {
    universo:
      "la pregunta sobre el municipio de residencia 5 años antes tiene el mismo filtro que en "
      + "2022: solo se aplicó a quienes vivían hace menos de 6 años en el municipio actual.",
    fonteNota: null,
    origemNaoInformada: "Una parte de los migrantes internos tiene origen no declarado.",
    limitacoes: [
      "En esta edición, la pregunta sobre la frecuencia de la movilidad pendular indaga si la "
      + "persona vuelve del trabajo a casa diariamente; en 2022, la pregunta es si vuelve tres o "
      + "más días por semana. Los códigos coinciden, las definiciones no — las dos ediciones no "
      + "forman una serie.",
    ],
  },
  "2000": {
    universo:
      "la pregunta sobre el municipio de residencia 5 años antes se aplicó a todas las personas "
      + "que declararon no vivir en el municipio desde su nacimiento — un universo más amplio que "
      + "el de 2010 y 2022, sin el filtro de tiempo de residencia.",
    fonteNota: null,
    origemNaoInformada: "Una parte de los migrantes internos tiene origen no declarado.",
    limitacoes: [
      "La dimensión ocupacional de esta edición no es comparable en nivel con las de 2010 y "
      + "2022: la clasificación de 2000 no tiene el gran grupo de «ocupaciones elementales», y la "
      + "masa correspondiente reaparece distribuida entre servicios, agropecuaria e industria.",
    ],
  },
  "1991": {
    universo:
      "la pregunta sobre el municipio de residencia 5 años antes solo se hizo a quienes no "
      + "declararon haber vivido siempre en el municipio — la respuesta en blanco corresponde al "
      + "salto del cuestionario, y no a una no respuesta.",
    fonteNota: null,
    origemNaoInformada: "Una parte de los migrantes internos tiene origen no declarado.",
    limitacoes: [
      "El anacronismo territorial es mucho más marcado que en las ediciones recientes: 1.082 "
      + "códigos municipales de 2022 no existen en la malla municipal de 1991, 66 de las 81 "
      + "regiones metropolitanas aparecen con menos municipios de los que tienen hoy y tres de "
      + "ellas quedan con un único municipio (Porto Velho, Santarém y Central), lo que anula por "
      + "construcción — no por medición — los indicadores intrametropolitanos de esas tres.",
    ],
  },
  "1980": {
    universo:
      "en lugar de la pregunta sobre la residencia 5 años antes, que esta edición no tiene, hay "
      + "otras dos: cuántos años hace que la persona vive en el municipio actual y cuál fue el "
      + "municipio donde vivía antes — esta última recogida de quienes viven en el municipio hace "
      + "menos de diez años, incluso de quienes nacieron en él.",
    fonteNota:
      "Los microdatos de la muestra de 1980 son públicos, pero la copia actual del IBGE omite la "
      + "variable de municipio de residencia anterior, que es en la que se basa la migración de "
      + "esta edición. El atlas usa el archivo Parquet de censobr/IPEA (Instituto de Investigación "
      + "Económica Aplicada) (v1.0.0), derivado de los mismos microdatos, que trae esa variable y "
      + "el municipio de residencia de todos los registros; hasta la versión anterior, la edición "
      + "provenía de la copia de la Base dos Dados (BigQuery), que perdía el municipio de 178.636 "
      + "registros. Las dos copias se cotejaron celda por celda entre sí y, estado por estado, con "
      + "la copia en DBF del IBGE. Es la única edición del atlas alimentada por una fuente "
      + "secundaria.",
    origemNaoInformada:
      "Cerca del 7,5\u00a0% de los migrantes internos tiene origen no declarado — la mayor "
      + "proporción del atlas. Son los propios códigos centinela del cuestionario de 1980: quienes "
      + "declararon el estado de origen pero no el municipio, y las respuestas «Brasil sin "
      + "especificación» e «ignorado».",
    limitacoes: [
      "La migración de esta edición se estima mediante un proxy, y no se mide con una pregunta de "
      + "fecha fija: volúmenes, saldos y distancias arrastran el desvío descrito en el distintivo "
      + "«proxy», al final de esta página. Las comparaciones entre ediciones valen para la "
      + "composición, la dirección y la jerarquía de los flujos, no para el nivel.",
      "Esta edición no tiene ninguna variable de ingreso, y no se publica error muestral: las "
      + "estimaciones son puntuales, sin intervalo de confianza.",
      "Norte de Goiás (actual Tocantins). Los 52 municipios que en 1988 formaron Tocantins entran "
      + "con el código de 2022 (17xxxxx), a partir del archivo Parquet de censobr/IPEA — la Base "
      + "dos Dados, fuente hasta la versión anterior, no traía su municipio de residencia. La UF "
      + "publicada es la actual: los intercambios con el resto de Goiás aparecen como "
      + "interestatales, y quienes nacieron en el territorio y viven fuera declararon «Goiás» como "
      + "estado de nacimiento (el retorno al estado natal queda subestimado en Tocantins). De las "
      + "regiones inmediatas de 2022, 10 siguen sin ningún municipio en 1980 (frontera agrícola "
      + "creada después), ninguna de ellas en Tocantins.",
    ],
  },
};

/** Glosa da moeda na primeira menção (TERMINOLOGIA.md, §3). */
const GLOSA_MOEDA: Record<Moeda, string> = {
  "R$": "reales brasileños, BRL",
  "Cr$": "cruceiros brasileños",
};

const data = (iso: string) => dataEdicao(iso, "es");
const pct = (v: number | string) => `${v}\u00a0%`;

export function MetodologiaEs({ meta }: PropsMetodologia) {
  const d = useT();
  const { censo, ed, est, metaDeOutraEdicao, r, sm, anoDe, anoAte, textos } =
    useContextoMetodologia(meta, "es");
  const t = TEXTO[censo];
  if (metaDeOutraEdicao) {
    return (
      <div className="metodologia-conteudo">
        <p className="muted" role="status">Cargando la metodología del Censo {ed.nome}…</p>
      </div>
    );
  }

  const fonte = textos.fonte ?? `IBGE, Censo Demográfico ${ed.nome}, microdatos de la muestra`;
  const dimensoesDetalhe = [
    "nivel educativo",
    ...(ed.recursos.renda ? ["ingreso"] : []),
    "edad/sexo",
    ...(ed.recursos.pendular ? ["dimensiones de movilidad pendular"] : []),
  ].join(", ");
  const salario: ReactNode = sm
    ? ` (${salarioMinimo(sm, censo)}; ${GLOSA_MOEDA[MOEDA_SALARIO[censo]]})`
    : "";

  return (
    <div className="metodologia-conteudo">
      <p className="muted-pequeno">
        Esta es una traducción del original en portugués, que es la versión de referencia. En caso
        de discrepancia, prevalece el texto en portugués; las estimaciones, las salvedades y los
        avisos del IBGE rigen en su redacción original.
      </p>

      <section>
        <h3>Fuente y universo</h3>
        <p>
          <strong>Fuente:</strong> {fonte}. El IBGE es el Instituto Brasileño de Geografía y
          Estadística. El universo es la población residente de 5 años o más en {anoAte};{" "}
          {t.universo}
        </p>
        {t.fonteNota && <p>{t.fonteNota}</p>}
      </section>

      <section>
        <h3>{ed.proxyDataFixa ? "Migración estimada por proxy" : "Migrante de fecha fija"}</h3>
        {ed.proxyDataFixa ? (
          <>
            <p>
              El cuestionario de esta edición no pregunta dónde vivía la persona cinco años antes,
              por lo que no hay migración de fecha fija que medir. El atlas combina las dos
              preguntas que sí existen — cuántos años hace que la persona vive en el municipio
              actual y cuál fue el municipio de residencia inmediatamente anterior (la llamada{" "}
              <em>última residencia anterior</em>, o última etapa) — y clasifica
              como <strong>migrante</strong> a quien vive en el municipio hace menos de cinco años y
              declara un municipio anterior; el <strong>origen</strong> es ese municipio. La ventana
              publicada, del {data(ed.periodo.de)} al {data(ed.periodo.ate)}, alinea la edición con
              los quinquenios de las demás, pero no es una fecha de referencia del cuestionario.
            </p>
            <p>
              La última etapa no es fecha fija: quien migró en dos etapas dentro del período aparece
              con el origen de la última, y quien salió y volvió aparece como migrante sin haber
              cambiado de municipio entre las dos fechas. El <em>proxy</em> se calibró con la fecha
              fija verdadera del Censo 1991, y el precio de este reemplazo — en volumen, saldo y
              distancia de los flujos — está medido en el distintivo «proxy», al final de esta
              página.
            </p>
          </>
        ) : (
          <p>
            Se compara el municipio de residencia el {data(ed.periodo.de)} con el
            del {data(ed.periodo.ate)} — un único par de puntos en el tiempo, y no el historial de
            cambios de residencia en el quinquenio. Es <strong>migrante interno</strong> quien
            vivía en otro municipio de Brasil en {anoDe}; <strong>migrante internacional</strong>,
            quien vivía en otro país; <strong>no migrante</strong>, quien ya vivía en el mismo
            municipio.
          </p>
        )}
        <p>
          {t.origemNaoInformada} Estos registros cuentan en la inmigración total del destino, pero
          quedan fuera de la matriz origen–destino y del cómputo de la emigración — por eso la suma
          de las filas de una columna de destino puede superar ligeramente el total de migrantes
          con origen conocido de ese municipio. El panel de cada municipio informa cuántos
          inmigrantes llegaron con origen no declarado.
        </p>
      </section>

      <section>
        <h3>Indicadores</h3>
        <p>Para un municipio (o unidad agregada) cualquiera, con población de referencia P (personas de 5 años o más en {anoAte}):</p>
        <dl className="formulas">
          <dt>Inmigrantes (I)</dt>
          <dd>total de personas con origen conocido cuyo destino es esa unidad.</dd>
          <dt>Emigrantes (E)</dt>
          <dd>total de personas con origen conocido cuyo origen es esa unidad.</dd>
          <dt>Saldo migratorio</dt>
          <dd><code>Saldo = I − E</code></dd>
          <dt>Tasa neta de migración (TLM)</dt>
          <dd><code>TLM = (Saldo / P) × 1000</code> — por cada 1.000 habitantes.</dd>
          <dt>Índice de eficacia migratoria (IEM)</dt>
          <dd><code>IEM = Saldo / (I + E)</code>, entre −1 y 1: cerca de 0 indica intercambios
            equilibrados (alto volumen en ambos sentidos); cerca de ±1, un flujo
            predominantemente unidireccional.</dd>
        </dl>
      </section>

      <section>
        <h3>Tipología de los tipos de migrante</h3>
        {ed.statusCategorias.includes("primeira_saida") ? (
          <p>
            Cada migrante interno se clasifica según su trayectoria: <strong>retorno al municipio
            natal</strong> (el destino en {anoAte} es donde nació), <strong>primera salida del
            municipio natal</strong>, <strong>migración por etapas múltiples</strong> (ni nació en
            el destino ni retornó a él), además de las categorías de migración internacional
            (nacido en el exterior que migra internamente, retorno del exterior o inmigración
            internacional de extranjero) y origen no declarado.
          </p>
        ) : (
          <>
            <p>
              Cada migrante interno se clasifica según su trayectoria: <strong>retorno al municipio
              natal</strong> (el destino en {anoAte} es donde nació) o <strong>migrante no natural
              del destino</strong> — no nació en el municipio de destino ni en el exterior —,
              además de las categorías de migración internacional (nacido en el exterior que migra
              internamente, retorno del exterior o inmigración internacional de extranjero) y
              origen no declarado.
            </p>
            <p className="muted-pequeno">
              Las categorías de esta edición son menos que las de 2022: el cuestionario no recoge
              el <em>municipio</em> de nacimiento — solo si la persona nació en el municipio donde
              vive y, en caso contrario, el estado o el país. Sin el municipio natal es imposible
              separar la primera salida del municipio natal de la migración por etapas múltiples, y
              ambas quedan juntas en la categoría que los gráficos
              llaman «{rotuloCategoria("status", "nao_natural", d)}».
            </p>
          </>
        )}
      </section>

      <section>
        <h3>{ed.recursos.renda ? "Nivel educativo e ingreso" : "Nivel educativo"}</h3>
        <p>
          El nivel educativo se resume en cuatro rangos (sin instrucción/básica incompleta, básica
          completa/media incompleta, media completa/superior incompleta, superior completa),
          siempre restringido a la población de 25 años o más — edad en la que la mayoría ya
          concluyó (o no) su trayectoria escolar.
          {ed.recursos.renda
            ? <> El ingreso del hogar per cápita se expresa en múltiplos del salario mínimo de
                referencia de cada censo{salario}, para no perder sentido con la inflación.</>
            : null}
        </p>
        {!ed.recursos.renda && (
          <p>
            <strong>Esta edición no publica ingresos.</strong> En la fuente utilizada, las
            variables de ingreso vienen completas en un solo estado y vacías en los otros 26 —
            publicar una desagregación nacional construida sobre menos del 5&nbsp;% de la muestra
            sería peor que declarar su ausencia. Todas las columnas de ingreso son nulas, y no hay
            filtro de ingreso ni dimensión de ingreso en el módulo de movilidad pendular.
          </p>
        )}
      </section>

      <section>
        <h3>Precisión de las estimaciones</h3>
        {est.precisao === "ausente" ? (
          <>
            <p>
              <strong>Esta edición no publica error muestral.</strong> La fuente no trae
              identificador de hogar, y sin la unidad primaria de muestreo el estimador por
              conglomerados usado en las demás ediciones trataría a cada persona como una
              observación independiente — subestimando la varianza, que es el error que engaña
              hacia el lado optimista. Por eso el error estándar y el coeficiente de variación son
              nulos en todas las tablas, y la precisión aparece como <strong>sin estimación</strong>.
            </p>
            <p>
              En la práctica: los números de esta edición son estimaciones puntuales, sin intervalo
              de confianza, y no hay prueba disponible para la diferencia entre dos celdas
              pequeñas. Es también por eso que los umbrales de divulgación de esta edición son más
              altos que los de las otras (ver la sección siguiente).
            </p>
          </>
        ) : (
          <>
            <p>
              Los microdatos provienen de una muestra, no del universo — todo conteo es una
              estimación sujeta a error muestral. El error estándar se calcula con un estimador
              conservador por conglomerados (el hogar como unidad primaria de muestreo, o UPM
              {est.precisao === "area_ponderacao"
                ? ", y el área de ponderación como estrato), en ausencia de estratos/UPM formales en "
                  + "los microdatos de la muestra; el estimador se comparó con la Función "
                  + "Generalizada de Varianza del IBGE y resultó del mismo orden de magnitud."
                : "), en ausencia de estratos/UPM formales en los microdatos de la muestra."}
            </p>
            {est.precisao === "estrato_aproximado" && (
              <p>
                Esta edición, sin embargo, no tiene área de ponderación: el estrato usado es un
                sustituto — municipio × situación urbana/rural —, más heterogéneo que el área real.
                La precisión publicada aquí es, por lo tanto, <strong>aproximada y
                conservadora</strong>: en flujos del mismo tamaño muestral, el coeficiente de
                variación mediano queda entre un 5&nbsp;% y un 20&nbsp;% por encima del de una
                edición con área de ponderación, y no debe compararse punto por punto con el de las
                otras ediciones.
              </p>
            )}
            <p>Cada estimación publicada recibe un rango de precisión según el coeficiente de variación (CV):</p>
            <ul>
              <li><strong>buena</strong>: CV hasta {pct(r ? r.cv_boa : 15)}</li>
              <li><strong>aceptable, usar con cautela</strong>: CV entre {pct(r ? r.cv_boa : 15)} y {pct(r ? r.cv_cautela : 30)}</li>
              <li><strong>baja precisión</strong>: CV superior al {pct(r ? r.cv_cautela : 30)}</li>
            </ul>
          </>
        )}
      </section>

      <section>
        <h3>Control de divulgación estadística</h3>
        <p>
          Antes de que cualquier dato se publique, un <em>gate</em> automático (reglas R1–R9)
          verifica si la publicación podría identificar a alguien:
        </p>
        <ul>
          <li>ningún flujo o categoría se publica con menos de {r?.min_pessoas ?? 5} personas
            {r && r.min_domicilios == null
              ? " muestreadas — en esta edición el censo no identifica el hogar, por lo que el piso"
                + " usual de hogares muestreados se sustituyó por este piso de personas, más alto"
                + " que el de las demás ediciones"
              : ` muestreadas o menos de ${r?.min_domicilios ?? 3} hogares muestreados`};</li>
          <li>la desagregación por característica ({dimensoesDetalhe}) solo aparece para flujos
            con al menos {r?.min_pessoas_detalhe ?? 20} observaciones muestrales;</li>
          <li>todo conteo ponderado se redondea a múltiplos de {r?.arredondamento ?? 5};</li>
          <li>no se publica ningún conteo muestral exacto — solo rangos;</li>
          <li>{est.acesso === "controlado"
            ? "las columnas de hogar y de área de ponderación nunca salen de los microdatos de acceso controlado."
            : "las columnas de identificación del hogar y de área de ponderación nunca se publican, aunque los microdatos de origen sean públicos."}</li>
        </ul>
        <p>
          En caso de duda sobre si una celda identifica a alguien, el criterio del proyecto es
          tratarla como identificadora y no publicarla — por eso varios pares de municipios
          aparecen «por debajo del umbral de divulgación» en lugar de mostrar un número pequeño.
        </p>
      </section>

      <section>
        <h3>Módulo metropolitano</h3>
        <p>
          La delimitación de las regiones metropolitanas (RM) y las RIDE (Regiones Integradas de
          Desarrollo Económico) sigue la división institucional del IBGE; el{" "}
          <strong>núcleo</strong> de cada una es el municipio homónimo de la región (por ejemplo,
          Vitória en la Grande Vitória); cuando no hay homónimo, es el más poblado.
          {ed.nome !== "2022" && (
            <> La delimitación es la de 2022 aplicada retroactivamente por código de municipio —
              convención del atlas para todas las ediciones —, de modo que una región puede
              aparecer aquí con menos municipios de los que tiene hoy: los que todavía no existían
              en la fecha del censo simplemente no están.</>
          )}
        </p>
        {ed.recursos.pendular ? (
          <>
            <p>
              El modo RM suma tres piezas: la migración <strong>intra-RM</strong> (flujos entre
              municipios de la misma RM, incluida la matriz núcleo×periferia), la{" "}
              <strong>movilidad pendular</strong> por trabajo y por estudio (quien vive en un
              municipio de la RM y trabaja/estudia en otro), y el <strong>cruce</strong> entre
              ambas: para cada migrante intrametropolitano ocupado, dónde trabaja — en el origen
              del que salió, en el núcleo, en el propio destino o en otro lugar.
            </p>
            {ed.pendularCampoUnico && (
              <p>
                En esta edición, trabajo y estudio provienen de una <strong>pregunta
                única</strong>, con precedencia del trabajo: quien trabaja y estudia en municipios
                distintos solo aparece en el flujo de trabajo. La movilidad pendular
                por <strong>estudio</strong> es, por eso, un <strong>piso</strong> (cota inferior),
                y no una estimación del total — comparable con otras ediciones en composición y
                dirección, nunca en nivel.
              </p>
            )}
          </>
        ) : (
          <p>
            En esta edición el modo RM tiene una sola pieza: la migración <strong>intra-RM</strong>{" "}
            (flujos entre municipios de la misma RM, incluida la matriz núcleo×periferia). El
            cuestionario no pregunta en qué municipio trabaja o estudia la persona, de modo que no
            hay <strong>movilidad pendular</strong> ni el cruce entre migración y movilidad
            pendular que publican las otras ediciones.
          </p>
        )}
      </section>

      <section>
        <h3>Niveles de agregación</h3>
        <p>
          Además del municipio, el atlas agrega en región geográfica inmediata (RGI), región
          geográfica intermedia (RGInt) y unidad federativa (UF; las 27 UF de Brasil son sus 26
          estados y el Distrito Federal) — la misma jerarquía territorial del IBGE. En estos
          niveles, la migración entre municipios de la misma unidad no se cuenta (solo la que
          cruza el límite de la unidad), los pares de municipios suprimidos por el <em>gate</em>{" "}
          de divulgación quedan fuera de la suma agregada, y no se publica error estándar — los
          indicadores agregados son sumas directas de los flujos municipales publicados, no una
          nueva estimación con su propia varianza.
        </p>
      </section>

      <section>
        <h3>Limitaciones</h3>
        <ul>
          {!ed.proxyDataFixa && (
            <li>La migración de fecha fija no capta los movimientos múltiples dentro del
              quinquenio, solo el par (residencia en {anoDe}, residencia en {anoAte}).</li>
          )}
          <li>Los resultados pueden diferir de los tabulados oficiales del IBGE (SIDRA, Sistema
            IBGE de Recuperación Automática)
            {est.acesso === "controlado"
              ? " por el submuestreo, la supresión y la recalibración aplicados a los microdatos de acceso controlado."
              : " por diferencias en la expansión de la muestra y por la supresión aplicada aquí por confidencialidad."}</li>
          {est.precisao !== "ausente" && (
            <li>En los niveles agregados (RGI, RGInt, UF), la ausencia de error estándar publicado
              significa que las comparaciones entre unidades pequeñas deben leerse con cautela
              adicional.</li>
          )}
          {t.limitacoes.map((texto) => <li key={texto}>{texto}</li>)}
        </ul>
      </section>

      {meta?.citacao && (
        <section>
          <h3>Cómo citar</h3>
          <p>
            {meta.citacao.autor} (<a href={meta.citacao.autor_orcid}>ORCID</a>). <em>Atlas
            da migração interna no Brasil</em> [Atlas de la migración interna en Brasil]. Datos del
            Censo Demográfico {ed.nome} (IBGE).
            DOI: <a href={`https://doi.org/${meta.citacao.doi_conceito}`}>{meta.citacao.doi_conceito}</a>
            {" "}(todas las versiones) /{" "}
            <a href={`https://doi.org/${meta.citacao.doi_versao}`}>{meta.citacao.doi_versao}</a> ({VERSAO_ATLAS}).
          </p>
          <p className="muted-pequeno">
            Datos y contenido bajo{" "}
            <a href={meta.citacao.licenca_url}>{meta.citacao.licenca}</a>, con atribución al
            IBGE como fuente primaria. Metadatos estructurados en{" "}
            <a href="https://github.com/atlas-da-migracao/atlas-da-migracao.github.io/blob/main/CITATION.cff">CITATION.cff</a>.
          </p>
        </section>
      )}

      {textos.aviso && (
        <section>
          <h3>Aviso estándar</h3>
          <p className="aviso">{textos.aviso}</p>
        </section>
      )}

      {textos.avisoProxy && (
        <section>
          <h3>Distintivo «proxy» (edición vigente)</h3>
          <p className="aviso aviso-proxy">{textos.avisoProxy}</p>
        </section>
      )}
    </div>
  );
}
