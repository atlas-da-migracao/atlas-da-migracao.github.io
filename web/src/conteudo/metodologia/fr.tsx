/** Metodologia em francês -- tradução fiel de pt.tsx (a versão de referência), seção por seção e
 *  com a mesma estrutura condicional por edição. Termos e siglas: i18n/TERMINOLOGIA.md (francês
 *  da França, convenções do INSEE/INED; "municipalité (*município*)" na primeira menção, nunca
 *  *commune*; *masqué* para suprimido).
 *
 *  Tipografia (TERMINOLOGIA.md, §3): espaço inseparável antes de : ; ! ? e dentro de « » --
 *  `&nbsp;` no texto JSX, `\u00a0` nas strings; espaço fino inseparável (`\u202f`, o mesmo que o
 *  `Intl` gera) como separador de milhar e antes de %.
 *  Mudou o pt.tsx? Repita a mudança aqui. */
import type { ReactNode } from "react";
import type { Censo } from "../../lib/edicoes";
import { rotuloCategoria } from "../../lib/paletas";
import { useT } from "../../i18n";
import {
  MOEDA_SALARIO, VERSAO_ATLAS, dataEdicao, salarioMinimo, useContextoMetodologia,
  type Moeda, type PropsMetodologia, type TextoEdicao,
} from "./comum";

/** glosa de *município* na primeira menção de cada edição (sempre no `universo`) */
const MUN = <>municipalité (<em>município</em>)</>;

const TEXTO: Record<Censo, TextoEdicao> = {
  "2022": {
    universo: (
      <>
        le bloc migration du questionnaire de l'échantillon (Migration interne et internationale)
        indique la {MUN} de résidence 5 ans auparavant, question posée seulement aux personnes qui
        habitent leur municipalité actuelle depuis moins de 6 ans.
      </>
    ),
    fonteNota: null,
    origemNaoInformada:
      "Environ 1,2\u202f% (150,4 milliers sur 13,0 millions) des migrants internes ont une "
      + "origine non déclarée.",
    limitacoes: [],
  },
  "2010": {
    universo: (
      <>
        la question sur la {MUN} de résidence 5 ans auparavant a le même filtre qu'en
        2022&nbsp;: elle n'a été posée qu'aux personnes qui habitaient leur municipalité actuelle
        depuis moins de 6 ans.
      </>
    ),
    fonteNota: null,
    origemNaoInformada: "Une partie des migrants internes a une origine non déclarée.",
    limitacoes: [
      "Dans cette édition, la question sur la fréquence de la mobilité pendulaire demande si la "
      + "personne rentre chez elle du travail tous les jours\u00a0; en 2022, elle demande si elle "
      + "rentre trois jours ou plus par semaine. Les codes coïncident, les définitions non — les "
      + "deux éditions ne forment pas une série.",
    ],
  },
  "2000": {
    universo: (
      <>
        la question sur la {MUN} de résidence 5 ans auparavant a été posée à toutes les personnes
        ayant déclaré ne pas habiter la municipalité depuis leur naissance — un champ plus large
        qu'en 2010 et 2022, sans le filtre de durée de résidence.
      </>
    ),
    fonteNota: null,
    origemNaoInformada: "Une partie des migrants internes a une origine non déclarée.",
    limitacoes: [
      "La dimension professionnelle de cette édition n'est pas comparable en niveau avec celles "
      + "de 2010 et 2022\u00a0: la classification de 2000 n'a pas de grand groupe "
      + "«\u00a0professions élémentaires\u00a0», et la masse correspondante réapparaît répartie "
      + "entre les services, l'agriculture et l'industrie.",
    ],
  },
  "1991": {
    universo: (
      <>
        la question sur la {MUN} de résidence 5 ans auparavant n'a été posée qu'aux personnes qui
        n'ont pas déclaré avoir toujours habité la municipalité — l'absence de réponse à cette
        question correspond au saut du questionnaire, et non à une non-réponse.
      </>
    ),
    fonteNota: null,
    origemNaoInformada: "Une partie des migrants internes a une origine non déclarée.",
    limitacoes: [
      "L'anachronisme territorial est bien plus marqué que dans les éditions récentes\u00a0: "
      + "1\u202f082 codes municipaux de 2022 n'existent pas dans le maillage municipal de 1991, 66 "
      + "des 81 régions métropolitaines apparaissent avec moins de municipalités qu'aujourd'hui et "
      + "trois d'entre elles se réduisent à une seule municipalité (Porto Velho, Santarém et "
      + "Central), ce qui annule par construction — et non par mesure — les indicateurs "
      + "intramétropolitains de ces trois régions.",
    ],
  },
  "1980": {
    universo: (
      <>
        à la place de la question sur la résidence 5 ans auparavant, que cette édition ne comporte
        pas, il y en a deux autres&nbsp;: depuis combien d'années la personne habite sa {MUN}{" "}
        actuelle, et dans quelle municipalité elle habitait auparavant — cette dernière recueillie
        auprès des personnes qui habitent la municipalité depuis moins de dix ans, y compris celles
        qui y sont nées.
      </>
    ),
    fonteNota:
      "Les microdonnées de l'échantillon de 1980 sont publiques, mais la copie actuelle de l'IBGE "
      + "omet la variable de municipalité de résidence antérieure, sur laquelle repose la migration "
      + "de cette édition. L'atlas utilise le fichier Parquet de censobr/IPEA (Institut de "
      + "recherche économique appliquée) (v1.0.0), dérivé des mêmes microdonnées, qui contient "
      + "cette variable et la municipalité de résidence de tous les enregistrements\u00a0; jusqu'à "
      + "la version précédente, l'édition provenait de la copie de la Base dos Dados (BigQuery), "
      + "qui perdait la municipalité de 178\u202f636 enregistrements. Les deux copies ont été "
      + "vérifiées cellule par cellule l'une par rapport à l'autre et, État par État, par rapport "
      + "à la copie DBF de l'IBGE. C'est la seule édition de l'atlas alimentée par une source "
      + "secondaire.",
    origemNaoInformada:
      "Environ 7,5\u202f% des migrants internes ont une origine non déclarée — la plus forte "
      + "proportion de l'atlas. Ce sont les codes sentinelles du questionnaire de 1980 "
      + "lui-même\u00a0: les personnes qui ont déclaré l'État d'origine mais pas la municipalité, "
      + "et les réponses «\u00a0Brésil sans précision\u00a0» et «\u00a0inconnu\u00a0».",
    limitacoes: [
      "La migration de cette édition est estimée par un proxy (estimation approchée), et non "
      + "mesurée par une question à date fixe\u00a0: volumes, soldes et distances portent l'écart "
      + "décrit dans la mention «\u00a0proxy\u00a0», à la fin de cette page. Les comparaisons "
      + "entre éditions valent pour la composition, la direction et la hiérarchie des flux, pas "
      + "pour le niveau.",
      "Cette édition ne comporte aucune variable de revenu, et aucune erreur d'échantillonnage "
      + "n'est publiée\u00a0: les estimations sont ponctuelles, sans intervalle de confiance.",
      "Nord de Goiás (actuel Tocantins). Les 52 municipalités qui ont formé le Tocantins en 1988 "
      + "figurent avec leur code de 2022 (17xxxxx), à partir du fichier Parquet de censobr/IPEA — "
      + "la Base dos Dados, source jusqu'à la version précédente, ne contenait pas leur "
      + "municipalité de résidence. L'UF publiée est celle d'aujourd'hui\u00a0: les échanges avec "
      + "le reste de Goiás apparaissent comme interétatiques, et les personnes nées sur ce "
      + "territoire qui vivent ailleurs ont déclaré «\u00a0Goiás\u00a0» comme État de naissance "
      + "(le retour dans l'État de naissance est sous-estimé dans le Tocantins). Parmi les régions "
      + "immédiates de 2022, 10 n'ont toujours aucune municipalité en 1980 (front pionnier "
      + "agricole créé ensuite), aucune d'elles dans le Tocantins.",
    ],
  },
};

/** Glosa da moeda na primeira menção (TERMINOLOGIA.md, §3). */
const GLOSA_MOEDA: Record<Moeda, string> = {
  "R$": "réaux brésiliens, BRL",
  "Cr$": "cruzeiros brésiliens",
};

const data = (iso: string) => dataEdicao(iso, "fr");
const pct = (v: number | string) => `${v}\u202f%`;

export function MetodologiaFr({ meta }: PropsMetodologia) {
  const d = useT();
  const { censo, ed, est, metaDeOutraEdicao, r, sm, anoDe, anoAte, textos } =
    useContextoMetodologia(meta, "fr");
  const t = TEXTO[censo];
  if (metaDeOutraEdicao) {
    return (
      <div className="metodologia-conteudo">
        <p className="muted" role="status">Chargement de la méthodologie du Recensement {ed.nome}…</p>
      </div>
    );
  }

  const fonte = textos.fonte ?? `IBGE, Recensement démographique ${ed.nome}, microdonnées de l'échantillon`;
  const dimensoesDetalhe = [
    "niveau d'instruction",
    ...(ed.recursos.renda ? ["revenu"] : []),
    "âge/sexe",
    ...(ed.recursos.pendular ? ["dimensions de la mobilité pendulaire"] : []),
  ].join(", ");
  const salario: ReactNode = sm
    ? ` (${salarioMinimo(sm, censo)}\u00a0; ${GLOSA_MOEDA[MOEDA_SALARIO[censo]]})`
    : "";

  return (
    <div className="metodologia-conteudo">
      <p className="muted-pequeno">
        Ceci est une traduction de l'original en portugais, qui est la version de référence. En cas
        de divergence, le texte portugais fait foi&nbsp;; les estimations, les réserves et les
        avertissements de l'IBGE s'appliquent dans leur rédaction originale.
      </p>

      <section>
        <h3>Source et champ</h3>
        <p>
          <strong>Source&nbsp;:</strong> {fonte}. L'IBGE est l'Institut brésilien de géographie et
          de statistique. Le champ est la population résidente de 5 ans ou plus
          en {anoAte}&nbsp;; {t.universo}
        </p>
        {t.fonteNota && <p>{t.fonteNota}</p>}
      </section>

      <section>
        <h3>{ed.proxyDataFixa ? "Migration estimée par proxy" : "Migrant à date fixe"}</h3>
        {ed.proxyDataFixa ? (
          <>
            <p>
              Le questionnaire de cette édition ne demande pas où la personne habitait cinq ans
              auparavant&nbsp;: il n'y a donc pas de migration à date fixe à mesurer. L'atlas
              combine les deux questions qui existent — depuis combien d'années la personne habite
              la municipalité actuelle et quelle était la municipalité de résidence immédiatement
              antérieure (la <em>dernière résidence antérieure</em>) — et classe
              comme <strong>migrant</strong> toute personne qui habite la municipalité depuis moins
              de cinq ans et déclare une municipalité antérieure&nbsp;; l'<strong>origine</strong>{" "}
              est cette municipalité. La fenêtre publiée, du {data(ed.periodo.de)}{" "}
              au {data(ed.periodo.ate)}, aligne l'édition sur les périodes quinquennales des autres,
              mais ce n'est pas une date de référence du questionnaire.
            </p>
            <p>
              La dernière résidence antérieure n'est pas une date fixe&nbsp;: une personne qui a
              migré en deux étapes au cours de la période apparaît avec l'origine de la dernière, et
              une personne partie puis revenue apparaît comme migrante sans avoir changé de
              municipalité entre les deux dates. Le <em>proxy</em> a été calibré sur la véritable
              question à date fixe du Recensement 1991, et le coût de cette substitution — en
              volume, en solde et en distance des flux — est mesuré dans la mention
              «&nbsp;proxy&nbsp;», à la fin de cette page.
            </p>
          </>
        ) : (
          <p>
            On compare la municipalité de résidence au {data(ed.periodo.de)} avec celle
            du {data(ed.periodo.ate)} — un seul couple de points dans le temps, et non l'historique
            des déménagements au cours de la période quinquennale. Est <strong>migrant
            interne</strong> toute personne qui habitait une autre municipalité du Brésil
            en {anoDe}&nbsp;; <strong>migrant international</strong>, toute personne qui habitait un
            autre pays&nbsp;; <strong>non-migrant</strong>, toute personne qui habitait déjà la même
            municipalité.
          </p>
        )}
        <p>
          {t.origemNaoInformada} Ces enregistrements sont comptés dans le total des entrées de la
          destination, mais restent en dehors de la matrice origine–destination et du calcul des
          sorties — c'est pourquoi la somme des lignes d'une colonne de destination peut dépasser
          légèrement le total des migrants d'origine connue de cette municipalité. Le panneau de
          chaque municipalité indique combien d'entrants sont arrivés avec une origine non
          déclarée.
        </p>
      </section>

      <section>
        <h3>Indicateurs</h3>
        <p>Pour une municipalité (ou une unité agrégée) quelconque, de population de référence P (personnes de 5 ans ou plus en {anoAte})&nbsp;:</p>
        <dl className="formulas">
          <dt>Entrants (I)</dt>
          <dd>total des personnes d'origine connue dont la destination est cette unité.</dd>
          <dt>Sortants (E)</dt>
          <dd>total des personnes d'origine connue dont l'origine est cette unité.</dd>
          <dt>Solde migratoire</dt>
          <dd><code>Solde = I − E</code></dd>
          <dt>Taux net de migration (TLM)</dt>
          <dd><code>TLM = (Solde / P) × 1000</code> — pour 1&#8239;000 habitants.</dd>
          <dt>Indice d'efficacité migratoire (IEM)</dt>
          <dd><code>IEM = Solde / (I + E)</code>, entre −1 et 1&nbsp;: proche de 0, il indique des
            échanges équilibrés (volume élevé dans les deux sens)&nbsp;; proche de ±1, un flux
            essentiellement unidirectionnel.</dd>
        </dl>
      </section>

      <section>
        <h3>Typologie des types de migrant</h3>
        {ed.statusCategorias.includes("primeira_saida") ? (
          <p>
            Chaque migrant interne est classé selon sa trajectoire&nbsp;: <strong>retour dans la
            municipalité de naissance</strong> (la destination en {anoAte} est son lieu de
            naissance), <strong>premier départ de la municipalité de naissance</strong>,{" "}
            <strong>migration par étapes multiples</strong> (ni né dans la destination, ni de
            retour), en plus des catégories de migration internationale (né à l'étranger et migrant
            interne, retour de l'étranger, ou immigration internationale d'un étranger) et de
            l'origine non déclarée.
          </p>
        ) : (
          <>
            <p>
              Chaque migrant interne est classé selon sa trajectoire&nbsp;: <strong>retour dans la
              municipalité de naissance</strong> (la destination en {anoAte} est son lieu de
              naissance) ou <strong>migrant non natif de la destination</strong> — né ni dans la
              municipalité de destination ni à l'étranger —, en plus des catégories de migration
              internationale (né à l'étranger et migrant interne, retour de l'étranger, ou
              immigration internationale d'un étranger) et de l'origine non déclarée.
            </p>
            <p className="muted-pequeno">
              Les catégories de cette édition sont moins nombreuses qu'en 2022&nbsp;: le
              questionnaire ne recueille pas la <em>municipalité</em> de naissance — seulement si la
              personne est née dans la municipalité où elle habite et, sinon, l'État ou le pays.
              Sans la municipalité de naissance, il est impossible de distinguer le premier départ de
              la municipalité de naissance de la migration par étapes multiples, et les deux sont
              regroupés dans la catégorie que les graphiques
              appellent «&nbsp;{rotuloCategoria("status", "nao_natural", d)}&nbsp;».
            </p>
          </>
        )}
      </section>

      <section>
        <h3>{ed.recursos.renda ? "Niveau d'instruction et revenu" : "Niveau d'instruction"}</h3>
        <p>
          Le niveau d'instruction est résumé en quatre tranches (sans instruction/fondamental
          incomplet, fondamental achevé/secondaire incomplet, secondaire achevé/supérieur incomplet,
          supérieur achevé), toujours limité à la population de 25 ans ou plus — âge auquel la
          plupart des personnes ont achevé (ou non) leur parcours scolaire.
          {ed.recursos.renda
            ? <> Le revenu du ménage par personne est exprimé en multiples du salaire minimum de
                référence de chaque recensement{salario}, pour ne pas perdre son sens avec
                l'inflation.</>
            : null}
        </p>
        {!ed.recursos.renda && (
          <p>
            <strong>Cette édition ne publie pas de revenu.</strong> Dans la source utilisée, les
            variables de revenu sont renseignées pour un seul État et vides dans les 26 autres —
            publier une ventilation nationale construite sur moins de 5&#8239;% de l'échantillon
            serait pire que de déclarer l'absence. Toutes les colonnes de revenu sont nulles, et il
            n'y a ni filtre de revenu ni dimension de revenu dans le module de mobilité pendulaire.
          </p>
        )}
      </section>

      <section>
        <h3>Précision des estimations</h3>
        {est.precisao === "ausente" ? (
          <>
            <p>
              <strong>Cette édition ne publie pas d'erreur d'échantillonnage.</strong> La source ne
              contient pas d'identifiant de ménage, et sans unité primaire d'échantillonnage,
              l'estimateur par grappes utilisé dans les autres éditions traiterait chaque personne
              comme une observation indépendante — en sous-estimant la variance, ce qui est l'erreur
              qui trompe du côté optimiste. C'est pourquoi l'erreur type et le coefficient de
              variation sont nuls dans tous les tableaux, et la précision apparaît
              comme <strong>sans estimation</strong>.
            </p>
            <p>
              En pratique&nbsp;: les chiffres de cette édition sont des estimations ponctuelles,
              sans intervalle de confiance, et aucun test n'est disponible pour la différence entre
              deux petites cellules. C'est aussi pourquoi les seuils de diffusion de cette édition
              sont plus élevés que ceux des autres (voir la section suivante).
            </p>
          </>
        ) : (
          <>
            <p>
              Les microdonnées proviennent d'un échantillon, et non d'un recensement exhaustif —
              tout comptage est une estimation soumise à l'erreur d'échantillonnage. L'erreur type
              est calculée par un estimateur prudent par grappes (le ménage comme unité primaire
              d'échantillonnage, ou UP
              {est.precisao === "area_ponderacao"
                ? ", et la zone de pondération comme strate), en l'absence de strates/UP formelles "
                  + "dans les microdonnées de l'échantillon\u00a0; l'estimateur a été comparé à la "
                  + "fonction de variance généralisée de l'IBGE et s'est révélé du même ordre de "
                  + "grandeur."
                : "), en l'absence de strates/UP formelles dans les microdonnées de l'échantillon."}
            </p>
            {est.precisao === "estrato_aproximado" && (
              <p>
                Cette édition, cependant, n'a pas de zone de pondération&nbsp;: la strate utilisée
                est un substitut — municipalité × milieu urbain/rural —, plus hétérogène que la zone
                réelle. La précision publiée ici est donc <strong>approximative et
                prudente</strong>&nbsp;: pour des flux de même taille d'échantillon, le coefficient
                de variation médian est de 5&#8239;% à 20&#8239;% plus élevé que dans une édition
                avec zones de pondération, et il ne doit pas être comparé point par point avec celui
                des autres éditions.
              </p>
            )}
            <p>Chaque estimation publiée reçoit une tranche de précision selon le coefficient de variation (CV)&nbsp;:</p>
            <ul>
              <li><strong>bonne</strong>&nbsp;: CV jusqu'à {pct(r ? r.cv_boa : 15)}</li>
              <li><strong>acceptable, à utiliser avec prudence</strong>&nbsp;: CV entre {pct(r ? r.cv_boa : 15)} et {pct(r ? r.cv_cautela : 30)}</li>
              <li><strong>faible précision</strong>&nbsp;: CV supérieur à {pct(r ? r.cv_cautela : 30)}</li>
            </ul>
          </>
        )}
      </section>

      <section>
        <h3>Contrôle de la divulgation statistique</h3>
        <p>
          Avant toute mise en ligne, un <em>gate</em> automatique (règles R1–R9) vérifie si la
          publication pourrait permettre d'identifier quelqu'un&nbsp;:
        </p>
        <ul>
          <li>aucun flux ni aucune catégorie n'est publié avec moins de {r?.min_pessoas ?? 5} personnes
            {r && r.min_domicilios == null
              ? " de l'échantillon — dans cette édition, le recensement n'identifie pas le ménage,"
                + " et le seuil habituel de ménages échantillonnés a donc été remplacé par ce seuil"
                + " de personnes, plus élevé que celui des autres éditions"
              : ` de l'échantillon ou moins de ${r?.min_domicilios ?? 3} ménages échantillonnés`}&nbsp;;</li>
          <li>la ventilation par caractéristique ({dimensoesDetalhe}) n'apparaît que pour les flux
            comptant au moins {r?.min_pessoas_detalhe ?? 20} observations de l'échantillon&nbsp;;</li>
          <li>tout comptage pondéré est arrondi au multiple de {r?.arredondamento ?? 5}&nbsp;;</li>
          <li>aucun effectif exact de l'échantillon n'est publié — seulement des tranches&nbsp;;</li>
          <li>{est.acesso === "controlado"
            ? "les colonnes de ménage et de zone de pondération ne sortent jamais des microdonnées à accès contrôlé."
            : "les colonnes d'identification du ménage et de zone de pondération ne sont jamais publiées, même si les microdonnées d'origine sont publiques."}</li>
        </ul>
        <p>
          En cas de doute sur la possibilité qu'une cellule permette d'identifier quelqu'un, la
          règle du projet est de la traiter comme identifiante et de ne pas la publier — c'est
          pourquoi de nombreux couples de municipalités apparaissent «&nbsp;sous le seuil de
          diffusion&nbsp;» au lieu d'afficher un petit nombre.
        </p>
      </section>

      <section>
        <h3>Module métropolitain</h3>
        <p>
          Le découpage des régions métropolitaines (RM) et des RIDE (régions intégrées de
          développement économique) suit la division institutionnelle de l'IBGE&nbsp;; le{" "}
          <strong>centre</strong> de chacune est la municipalité qui donne son nom à la région (par
          exemple, Vitória dans la Grande Vitória)&nbsp;; à défaut, c'est la plus peuplée.
          {ed.nome !== "2022" && (
            <> Le découpage est celui de 2022 appliqué rétroactivement par code de municipalité —
              convention de l'atlas pour toutes les éditions —, de sorte qu'une région peut
              apparaître ici avec moins de municipalités qu'aujourd'hui&nbsp;: celles qui
              n'existaient pas encore à la date du recensement n'y figurent tout simplement pas.</>
          )}
        </p>
        {ed.recursos.pendular ? (
          <>
            <p>
              Le mode RM réunit trois éléments&nbsp;: la migration <strong>intra-RM</strong> (flux
              entre municipalités d'une même RM, y compris la matrice centre×périphérie), la{" "}
              <strong>mobilité pendulaire</strong> domicile-travail et domicile-études (personnes
              qui habitent une municipalité de la RM et travaillent/étudient dans une autre), et
              le <strong>croisement</strong> des deux&nbsp;: pour chaque migrant intramétropolitain
              en emploi, le lieu où il travaille — dans l'origine qu'il a quittée, dans le centre,
              dans la destination elle-même ou ailleurs.
            </p>
            {ed.pendularCampoUnico && (
              <p>
                Dans cette édition, travail et études proviennent d'une <strong>question
                unique</strong>, le travail primant&nbsp;: les personnes qui travaillent et étudient
                dans des municipalités différentes n'apparaissent que dans le flux de travail. La
                mobilité pendulaire pour <strong>études</strong> est donc un{" "}
                <strong>plancher</strong> (borne inférieure), et non une estimation du total —
                comparable aux autres éditions en composition et en direction, jamais en niveau.
              </p>
            )}
          </>
        ) : (
          <p>
            Dans cette édition, le mode RM ne comporte qu'un élément&nbsp;: la
            migration <strong>intra-RM</strong> (flux entre municipalités d'une même RM, y compris
            la matrice centre×périphérie). Le questionnaire ne demande pas dans quelle municipalité
            la personne travaille ou étudie&nbsp;: il n'y a donc ni <strong>mobilité
            pendulaire</strong> ni le croisement entre migration et mobilité pendulaire que
            publient les autres éditions.
          </p>
        )}
      </section>

      <section>
        <h3>Niveaux d'agrégation</h3>
        <p>
          Outre la municipalité, l'atlas agrège les données en région géographique immédiate (RGI),
          région géographique intermédiaire (RGInt) et unité fédérative (UF&nbsp;; les 27 UF du
          Brésil sont ses 26 États et le District fédéral) — la même hiérarchie territoriale que
          celle de l'IBGE. À ces niveaux, la migration entre municipalités d'une même unité n'est
          pas comptée (seule compte celle qui franchit la limite de l'unité), les couples de
          municipalités masqués par le <em>gate</em> de divulgation sont exclus de la somme
          agrégée, et aucune erreur type n'est publiée — les indicateurs agrégés sont des sommes
          directes des flux municipaux publiés, et non une nouvelle estimation avec sa propre
          variance.
        </p>
      </section>

      <section>
        <h3>Limites</h3>
        <ul>
          {!ed.proxyDataFixa && (
            <li>La migration à date fixe ne saisit pas les déplacements multiples au cours de la
              période quinquennale, seulement le couple (résidence en {anoDe}, résidence
              en {anoAte}).</li>
          )}
          <li>Les résultats peuvent différer des tableaux officiels de l'IBGE (SIDRA)
            {est.acesso === "controlado"
              ? " en raison du sous-échantillonnage, du masquage et du recalage appliqués aux microdonnées à accès contrôlé."
              : " en raison de différences dans l'extrapolation de l'échantillon et du masquage appliqué ici au titre du secret statistique."}</li>
          {est.precisao !== "ausente" && (
            <li>Aux niveaux agrégés (RGI, RGInt, UF), l'absence d'erreur type publiée signifie que
              les comparaisons entre petites unités doivent être lues avec une prudence accrue.</li>
          )}
          {t.limitacoes.map((texto) => <li key={texto}>{texto}</li>)}
        </ul>
      </section>

      {meta?.citacao && (
        <section>
          <h3>Comment citer</h3>
          <p>
            {meta.citacao.autor} (<a href={meta.citacao.autor_orcid}>ORCID</a>). <em>Atlas
            da migração interna no Brasil</em> [Atlas des migrations internes au Brésil]. Données
            du Recensement démographique {ed.nome} (IBGE).
            DOI&nbsp;: <a href={`https://doi.org/${meta.citacao.doi_conceito}`}>{meta.citacao.doi_conceito}</a>
            {" "}(toutes les versions) /{" "}
            <a href={`https://doi.org/${meta.citacao.doi_versao}`}>{meta.citacao.doi_versao}</a> ({VERSAO_ATLAS}).
          </p>
          <p className="muted-pequeno">
            Données et contenu sous licence{" "}
            <a href={meta.citacao.licenca_url}>{meta.citacao.licenca}</a>, avec attribution à
            l'IBGE comme source primaire. Métadonnées structurées dans{" "}
            <a href="https://github.com/atlas-da-migracao/atlas-da-migracao.github.io/blob/main/CITATION.cff">CITATION.cff</a>.
          </p>
        </section>
      )}

      {textos.aviso && (
        <section>
          <h3>Avertissement standard</h3>
          <p className="aviso">{textos.aviso}</p>
        </section>
      )}

      {textos.avisoProxy && (
        <section>
          <h3>Mention «&nbsp;proxy&nbsp;» (édition en cours)</h3>
          <p className="aviso aviso-proxy">{textos.avisoProxy}</p>
        </section>
      )}
    </div>
  );
}
