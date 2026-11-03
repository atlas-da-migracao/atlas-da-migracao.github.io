/** Metodologia em inglês -- tradução fiel de pt.tsx (a versão de referência), seção por seção e
 *  com a mesma estrutura condicional por edição. Termos e siglas: i18n/TERMINOLOGIA.md (inglês
 *  americano; siglas do atlas iguais, expandidas na primeira menção; datas por extenso).
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
      "the migration block of the long-form (sample) questionnaire (Internal and International "
      + "Migration) records the municipality of residence 5 years earlier, asked only of people "
      + "who have lived in their current municipality for less than 6 years.",
    fonteNota: null,
    origemNaoInformada:
      "About 1.2% (150.4 thousand out of 13.0 million) of internal migrants have their origin not "
      + "reported.",
    limitacoes: [],
  },
  "2010": {
    universo:
      "the question on the municipality of residence 5 years earlier has the same filter as in "
      + "2022: it was asked only of people who had lived in their current municipality for less "
      + "than 6 years.",
    fonteNota: null,
    origemNaoInformada: "A share of internal migrants have their origin not reported.",
    limitacoes: [
      "In this edition, the commuting frequency question asks whether the person returns home "
      + "from work daily; in 2022 the question is whether they return three or more days a week. "
      + "The codes match, the definitions do not — the two editions do not form a series.",
    ],
  },
  "2000": {
    universo:
      "the question on the municipality of residence 5 years earlier was asked of everyone who "
      + "reported not having lived in the municipality since birth — a broader universe than in "
      + "2010 and 2022, with no duration-of-residence filter.",
    fonteNota: null,
    origemNaoInformada: "A share of internal migrants have their origin not reported.",
    limitacoes: [
      "The occupational dimension of this edition is not comparable in level with those of 2010 "
      + "and 2022: the 2000 classification has no major group for “elementary occupations”, and "
      + "the corresponding mass reappears spread across services, agriculture and industry.",
    ],
  },
  "1991": {
    universo:
      "the question on the municipality of residence 5 years earlier was asked only of people who "
      + "did not report having always lived in the municipality — a blank answer to this question "
      + "is the questionnaire's skip pattern, not a non-response.",
    fonteNota: null,
    origemNaoInformada: "A share of internal migrants have their origin not reported.",
    limitacoes: [
      "The territorial anachronism is much stronger than in the recent editions: 1,082 municipal "
      + "codes from 2022 do not exist in the 1991 municipal boundary map, 66 of the 81 "
      + "metropolitan regions appear with fewer municipalities than they have today, and three of "
      + "them are left with a single municipality (Porto Velho, Santarém and Central), which "
      + "zeroes out by construction — not by measurement — the intra-metropolitan indicators of "
      + "those three.",
    ],
  },
  "1980": {
    universo:
      "in place of the question on residence 5 years earlier, which this edition does not have, "
      + "there are two others: how many years the person has lived in the current municipality, "
      + "and which municipality they lived in before — the latter collected from people who have "
      + "lived in the municipality for less than ten years, including those born there.",
    fonteNota:
      "The 1980 sample microdata are public, but IBGE's current copy omits the variable for the "
      + "municipality of previous residence, which is what this edition's migration rests on. The "
      + "atlas uses the Parquet file from censobr/IPEA (Institute for Applied Economic Research) "
      + "(v1.0.0), derived from the same microdata, which includes that variable and the "
      + "municipality of residence of every record; up to the previous version, the edition came "
      + "from the Base dos Dados copy (BigQuery), which lacked the municipality for 178,636 "
      + "records. The two copies were checked against each other cell by cell and, state by "
      + "state, against IBGE's DBF copy. It is the only edition of the atlas fed by a secondary "
      + "source.",
    origemNaoInformada:
      "About 7.5% of internal migrants have their origin not reported — the largest share in the "
      + "atlas. These are the sentinel codes of the 1980 questionnaire itself: people who reported "
      + "the state of origin but not the municipality, and the answers “Brazil, not specified” and "
      + "“unknown”.",
    limitacoes: [
      "This edition's migration is estimated through a proxy, not measured by a fixed-date "
      + "question: volumes, net figures and distances carry the bias described in the proxy badge, "
      + "at the end of this page. Comparisons between editions hold for the composition, direction "
      + "and hierarchy of flows, not for their level.",
      "There is no income variable at all in this edition, and no sampling error is published: "
      + "the estimates are point estimates, without a confidence interval.",
      "Northern Goiás (present-day Tocantins). The 52 municipalities that formed Tocantins in 1988 "
      + "are included with their 2022 code (17xxxxx), from the censobr/IPEA Parquet file — Base "
      + "dos Dados, the source up to the previous version, did not include their municipality of "
      + "residence. The published UF is today's: exchanges with the rest of Goiás appear as "
      + "interstate, and people born in the territory who live elsewhere reported “Goiás” as their "
      + "state of birth (return to the state of birth is underestimated in Tocantins). Of the 2022 "
      + "immediate regions, 10 still have no municipality at all in 1980 (agricultural frontier "
      + "created later), none of them in Tocantins.",
    ],
  },
};

/** Glosa da moeda na primeira menção (TERMINOLOGIA.md, §3). */
const GLOSA_MOEDA: Record<Moeda, string> = {
  "R$": "Brazilian reais, BRL",
  "Cr$": "Brazilian cruzeiros",
};

const data = (iso: string) => dataEdicao(iso, "en");

export function MetodologiaEn({ meta }: PropsMetodologia) {
  const d = useT();
  const { censo, ed, est, metaDeOutraEdicao, r, sm, anoDe, anoAte, textos } =
    useContextoMetodologia(meta, "en");
  const t = TEXTO[censo];
  if (metaDeOutraEdicao) {
    return (
      <div className="metodologia-conteudo">
        <p className="muted" role="status">Loading the methodology for the {ed.nome} Census…</p>
      </div>
    );
  }

  const fonte = textos.fonte ?? `IBGE, ${ed.nome} Demographic Census, sample microdata`;
  const dimensoesDetalhe = [
    "educational attainment",
    ...(ed.recursos.renda ? ["income"] : []),
    "age/sex",
    ...(ed.recursos.pendular ? ["commuting dimensions"] : []),
  ].join(", ");
  const salario: ReactNode = sm
    ? ` (${salarioMinimo(sm, censo)}; ${GLOSA_MOEDA[MOEDA_SALARIO[censo]]})`
    : "";

  return (
    <div className="metodologia-conteudo">
      <p className="muted-pequeno">
        This is a translation of the Portuguese original, which is the reference version. In case
        of any discrepancy, the Portuguese text prevails; estimates, caveats and IBGE notices apply
        as worded in the original.
      </p>

      <section>
        <h3>Source and universe</h3>
        <p>
          <strong>Source:</strong> {fonte}. IBGE is the Brazilian Institute of Geography and
          Statistics. The universe is the resident population aged 5 and over
          in {anoAte}; {t.universo}
        </p>
        {t.fonteNota && <p>{t.fonteNota}</p>}
      </section>

      <section>
        <h3>{ed.proxyDataFixa ? "Migration estimated by proxy" : "Fixed-date migrant"}</h3>
        {ed.proxyDataFixa ? (
          <>
            <p>
              This edition's questionnaire does not ask where the person lived five years earlier,
              so there is no fixed-date migration to measure. The atlas combines the two questions
              that do exist — how many years the person has lived in the current municipality and
              which was the municipality of immediately previous residence (the so-called{" "}
              <em>last previous residence</em>, or last move) — and classifies as a{" "}
              <strong>migrant</strong> anyone who has lived in the municipality for less than five
              years and reports a previous municipality; the <strong>origin</strong> is that
              municipality. The published window, {data(ed.periodo.de)} to {data(ed.periodo.ate)},
              aligns the edition with the five-year periods of the others, but it is not a
              reference date of the questionnaire.
            </p>
            <p>
              Last previous residence is not a fixed date: someone who migrated in two steps within
              the period appears with the origin of the last step, and someone who left and came
              back appears as a migrant without having changed municipality between the two dates.
              The proxy was calibrated against the true fixed-date question of the 1991 Census, and
              the cost of this substitution — in volume, net migration and distance of flows — is
              measured in the proxy badge, at the end of this page.
            </p>
          </>
        ) : (
          <p>
            The municipality of residence on {data(ed.periodo.de)} is compared with that
            on {data(ed.periodo.ate)} — a single pair of points in time, not the history of moves
            within the five-year period. An <strong>internal migrant</strong> is someone who lived
            in another Brazilian municipality in {anoDe}; an <strong>international migrant</strong>,
            someone who lived in another country; a <strong>non-migrant</strong>, someone who
            already lived in the same municipality.
          </p>
        )}
        <p>
          {t.origemNaoInformada} These records count in the destination's total in-migration, but
          they are left out of the origin–destination matrix and of the out-migration count — which
          is why the sum of the rows of a destination column may slightly exceed the total of
          migrants with known origin in that municipality. Each municipality's panel shows how many
          in-migrants arrived with their origin not reported.
        </p>
      </section>

      <section>
        <h3>Indicators</h3>
        <p>For any municipality (or aggregate unit), with reference population P (people aged 5+ in {anoAte}):</p>
        <dl className="formulas">
          <dt>In-migrants (I)</dt>
          <dd>total number of people with known origin whose destination is that unit.</dd>
          <dt>Out-migrants (E)</dt>
          <dd>total number of people with known origin whose origin is that unit.</dd>
          <dt>Net migration</dt>
          <dd><code>Net = I − E</code></dd>
          <dt>Net migration rate (TLM)</dt>
          <dd><code>TLM = (Net / P) × 1000</code> — per 1,000 population.</dd>
          <dt>Migration effectiveness index (IEM)</dt>
          <dd><code>IEM = Net / (I + E)</code>, between −1 and 1: close to 0 indicates balanced
            exchanges (high volume in both directions); close to ±1, a predominantly one-way flow.</dd>
        </dl>
      </section>

      <section>
        <h3>Typology of migrant types</h3>
        {ed.statusCategorias.includes("primeira_saida") ? (
          <p>
            Each internal migrant is classified by their trajectory: <strong>return to
            municipality of birth</strong> (the destination in {anoAte} is where they were
            born), <strong>first move from municipality of birth</strong>,{" "}
            <strong>multi-step migration</strong> (neither born in nor returning to the
            destination), in addition to the international migration categories (born abroad and
            migrating internally, return from abroad, or international immigration of a foreign
            national) and origin not reported.
          </p>
        ) : (
          <>
            <p>
              Each internal migrant is classified by their trajectory: <strong>return to
              municipality of birth</strong> (the destination in {anoAte} is where they were born)
              or <strong>migrant not born in the destination</strong> — born neither in the
              destination municipality nor abroad —, in addition to the international migration
              categories (born abroad and migrating internally, return from abroad, or
              international immigration of a foreign national) and origin not reported.
            </p>
            <p className="muted-pequeno">
              This edition's set of categories is shorter than 2022's: the questionnaire does not
              collect the <em>municipality</em> of birth — only whether the person was born in the
              municipality where they live and, if not, the state or country. Without the
              municipality of birth, first moves from the municipality of birth cannot be told apart
              from multi-step migration, and the two are grouped in the category that the charts
              call “{rotuloCategoria("status", "nao_natural", d)}”.
            </p>
          </>
        )}
      </section>

      <section>
        <h3>{ed.recursos.renda ? "Educational attainment and income" : "Educational attainment"}</h3>
        <p>
          Educational attainment is summarized in four bands (no schooling/incomplete elementary,
          completed elementary/incomplete high school, completed high school/incomplete higher
          education, completed higher education), always restricted to the population aged 25 and
          over — the age by which most people have completed (or not) their schooling.
          {ed.recursos.renda
            ? <> Household income per capita is expressed in multiples of the reference minimum
                wage of each Census{salario}, so that it does not lose its meaning with
                inflation.</>
            : null}
        </p>
        {!ed.recursos.renda && (
          <p>
            <strong>This edition does not publish income.</strong> In the source used, the income
            variables are filled in for a single state and empty in the other 26 — publishing a
            national breakdown built on less than 5% of the sample would be worse than declaring
            its absence. All income columns are null, and there is no income filter nor income
            dimension in the commuting module.
          </p>
        )}
      </section>

      <section>
        <h3>Precision of the estimates</h3>
        {est.precisao === "ausente" ? (
          <>
            <p>
              <strong>This edition does not publish sampling error.</strong> The source has no
              household identifier, and without the primary sampling unit the cluster estimator
              used in the other editions would treat each person as an independent observation —
              underestimating the variance, which is the error that misleads on the optimistic
              side. That is why the standard error and the coefficient of variation are null in
              all tables, and precision appears as <strong>no estimate</strong>.
            </p>
            <p>
              In practice: the numbers in this edition are point estimates, without a confidence
              interval, and no test is available for the difference between two small cells. This
              is also why this edition's disclosure thresholds are higher than those of the others
              (see the next section).
            </p>
          </>
        ) : (
          <>
            <p>
              The microdata come from a sample, not from the full count — every count is an
              estimate subject to sampling error. The standard error is computed with a
              conservative cluster estimator (the household as the primary sampling unit, or PSU
              {est.precisao === "area_ponderacao"
                ? ", and the weighting area as the stratum), in the absence of formal strata/PSUs "
                  + "in the sample microdata; the estimator was compared with IBGE's Generalized "
                  + "Variance Function and was of the same order of magnitude."
                : "), in the absence of formal strata/PSUs in the sample microdata."}
            </p>
            {est.precisao === "estrato_aproximado" && (
              <p>
                This edition, however, has no weighting area: the stratum used is a substitute —
                municipality × urban/rural status —, more heterogeneous than the actual area. The
                precision published here is therefore <strong>approximate and
                conservative</strong>: for flows of the same sample size, the median coefficient of
                variation is 5% to 20% higher than in an edition with weighting areas, and it
                should not be compared point by point with that of the other editions.
              </p>
            )}
            <p>Each published estimate receives a precision band based on the coefficient of variation (CV):</p>
            <ul>
              <li><strong>good</strong>: CV up to {r ? `${r.cv_boa}%` : "15%"}</li>
              <li><strong>fair, use with caution</strong>: CV between {r ? `${r.cv_boa}% and ${r.cv_cautela}%` : "15% and 30%"}</li>
              <li><strong>low precision</strong>: CV above {r ? `${r.cv_cautela}%` : "30%"}</li>
            </ul>
          </>
        )}
      </section>

      <section>
        <h3>Disclosure control</h3>
        <p>
          Before any data goes live, an automated <em>gate</em> (rules R1–R9) checks whether the
          release could identify anyone:
        </p>
        <ul>
          <li>no flow or category is published with fewer than {r?.min_pessoas ?? 5} people
            {r && r.min_domicilios == null
              ? " in the sample — in this edition the census does not identify the household, so"
                + " the usual floor of sampled households was replaced by this floor of people,"
                + " which is higher than in the other editions"
              : ` in the sample or fewer than ${r?.min_domicilios ?? 3} sampled households`};</li>
          <li>the breakdown by characteristic ({dimensoesDetalhe}) only appears for flows with
            at least {r?.min_pessoas_detalhe ?? 20} sample observations;</li>
          <li>every weighted count is rounded to multiples of {r?.arredondamento ?? 5};</li>
          <li>no exact sample count is published — only bands;</li>
          <li>{est.acesso === "controlado"
            ? "household and weighting-area columns never leave the controlled-access microdata."
            : "household-identifier and weighting-area columns are never published, even though the source microdata are public."}</li>
        </ul>
        <p>
          When in doubt about whether a cell could identify someone, the project's rule is to treat
          it as identifying and not publish it — which is why many municipality pairs appear as
          “below the disclosure threshold” instead of showing a small number.
        </p>
      </section>

      <section>
        <h3>Metropolitan module</h3>
        <p>
          The delineation of metropolitan regions (RMs) and RIDEs (Integrated Economic Development
          Regions) follows IBGE's institutional division; the <strong>core</strong> of each one is
          the municipality that gives the region its name (for example, Vitória in Grande
          Vitória); when there is none, it is the most populous one.
          {ed.nome !== "2022" && (
            <> The delineation is the 2022 one applied retroactively by municipality code — the
              atlas's convention for all editions —, so a region may appear here with fewer
              municipalities than it has today: those that did not yet exist on the census date
              are simply not there.</>
          )}
        </p>
        {ed.recursos.pendular ? (
          <>
            <p>
              The RM mode combines three pieces: <strong>intra-RM</strong> migration (flows between
              municipalities of the same RM, including the core×periphery matrix),{" "}
              <strong>commuting</strong> to work and to school (people who live in one RM
              municipality and work/study in another), and the <strong>cross-tabulation</strong> of
              the two: for each employed intra-metropolitan migrant, where they work — in the
              origin they left, in the core, in the destination itself, or elsewhere.
            </p>
            {ed.pendularCampoUnico && (
              <p>
                In this edition, work and study come from a <strong>single question</strong>, with
                work taking precedence: people who work and study in different municipalities only
                appear in the work flow. Commuting to <strong>school</strong> is therefore
                a <strong>lower bound</strong>, not an estimate of the total — comparable with
                other editions in composition and direction, never in level.
              </p>
            )}
          </>
        ) : (
          <p>
            In this edition the RM mode has a single piece: <strong>intra-RM</strong> migration
            (flows between municipalities of the same RM, including the core×periphery matrix). The
            questionnaire does not ask in which municipality the person works or studies, so there
            is no <strong>commuting</strong> and no cross-tabulation between migration and commuting
            such as the other editions publish.
          </p>
        )}
      </section>

      <section>
        <h3>Aggregation levels</h3>
        <p>
          Besides the municipality, the atlas aggregates into immediate geographic region (RGI),
          intermediate geographic region (RGInt) and Federation Unit (UF; Brazil's 27 UFs are its 26
          states and the Federal District) — the same territorial hierarchy as IBGE's. At these
          levels, migration between municipalities of the same unit is not counted (only migration
          that crosses the unit's boundary), municipality pairs suppressed by the disclosure gate
          are left out of the aggregate sum, and no standard error is published — the aggregate
          indicators are direct sums of the published municipal flows, not a new estimate with its
          own variance.
        </p>
      </section>

      <section>
        <h3>Limitations</h3>
        <ul>
          {!ed.proxyDataFixa && (
            <li>Fixed-date migration does not capture multiple moves within the five-year period,
              only the pair (residence in {anoDe}, residence in {anoAte}).</li>
          )}
          <li>Results may differ from IBGE's official tabulations (SIDRA, the IBGE Automatic
            Retrieval System)
            {est.acesso === "controlado"
              ? " because of the subsampling, suppression and recalibration applied to the controlled-access microdata."
              : " because of differences in sample expansion and the suppression applied here for confidentiality."}</li>
          {est.precisao !== "ausente" && (
            <li>At the aggregate levels (RGI, RGInt, UF), the absence of a published standard error
              means that comparisons between small units should be read with extra caution.</li>
          )}
          {t.limitacoes.map((texto) => <li key={texto}>{texto}</li>)}
        </ul>
      </section>

      {meta?.citacao && (
        <section>
          <h3>How to cite</h3>
          <p>
            {meta.citacao.autor} (<a href={meta.citacao.autor_orcid}>ORCID</a>). <em>Atlas
            da migração interna no Brasil</em> [Atlas of internal migration in Brazil]. Data from
            the {ed.nome} Demographic Census (IBGE).
            DOI: <a href={`https://doi.org/${meta.citacao.doi_conceito}`}>{meta.citacao.doi_conceito}</a>
            {" "}(all versions) /{" "}
            <a href={`https://doi.org/${meta.citacao.doi_versao}`}>{meta.citacao.doi_versao}</a> ({VERSAO_ATLAS}).
          </p>
          <p className="muted-pequeno">
            Data and content under{" "}
            <a href={meta.citacao.licenca_url}>{meta.citacao.licenca}</a>, with attribution to
            IBGE as the primary source. Structured metadata in{" "}
            <a href="https://github.com/atlas-da-migracao/atlas-da-migracao.github.io/blob/main/CITATION.cff">CITATION.cff</a>.
          </p>
        </section>
      )}

      {textos.aviso && (
        <section>
          <h3>Standard notice</h3>
          <p className="aviso">{textos.aviso}</p>
        </section>
      )}

      {textos.avisoProxy && (
        <section>
          <h3>Proxy badge (current edition)</h3>
          <p className="aviso aviso-proxy">{textos.avisoProxy}</p>
        </section>
      )}
    </div>
  );
}
