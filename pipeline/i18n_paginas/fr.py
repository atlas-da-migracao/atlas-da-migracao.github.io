"""Catalogue français des pages statiques de SEO (français de France, nombres `fr-FR`).

Traduction de la référence portugaise (`pt.py`), selon `web/src/i18n/TERMINOLOGIA.md` :
*municipalité* (jamais *commune*), *entrants / sortants*, *solde migratoire*, *répulsion* pour
« evasão », *mobilité pendulaire* (jamais *migration alternante*), *masqué* pour « suprimido ».
Typographie : espace insécable (U+00A0) avant « : ; ? ! » et à l'intérieur des guillemets ; espace
fine insécable (U+202F) pour les milliers et avant « % »."""
from __future__ import annotations

from . import H

LANG = "fr"

# ============================== identité du site ==============================
NOME_SITE = "Atlas des migrations internes au Brésil"
TITULO_ORIGINAL = "Atlas da migração interna no Brasil"  # titre conservé dans l'original pour les citations
DESCRICAO_SITE = ("Soldes et flux migratoires entre les municipalités brésiliennes au cours de la "
                  "période quinquennale 2017–2022, à partir des microdonnées de l'échantillon du "
                  "Recensement démographique 2022 de l'IBGE.")
ATRIBUICAO_PADRAO = (
    "Source primaire : IBGE, Recensement démographique 2022, microdonnées de l'échantillon "
    "(accès contrôlé). Estimations : Daniel Pessini Sobreira, Atlas da migração interna no Brasil."
)
PAIS = "Brésil"
AVISO_TRADUCAO = (
    "Ceci est une traduction de l'original en portugais, qui est la version de référence. En cas "
    "de divergence, le texte portugais fait foi ; les estimations, les réserves et les "
    "avertissements de l'IBGE s'appliquent dans leur rédaction originale."
)

SEM_ESTIMATIVA = "sans estimation"
SEP_INTERVALO = "à"
NAO_INFORMADO = "non renseigné"

OG_LINHAS = ("Atlas des migrations", "internes au Brésil")
OG_SUB = "Recensement 2022 · IBGE · 2017–2022"

ROTULO_PRECISAO = {
    "boa": "bonne", "cautela": "à utiliser avec prudence", "baixa": "faible précision",
    "sem_estimativa": "sans estimation",
}
TIPOLOGIA_ROTULO = {
    "nucleo_periferia": "Centre → périphérie",
    "periferia_nucleo": "Périphérie → centre",
    "periferia_periferia": "Périphérie → périphérie",
}
CLASSIFICACAO = {"equilibrio": "équilibre", "atracao": "attraction", "evasao": "répulsion"}
_DE = {"equilibrio": "d'", "atracao": "d'", "evasao": "de "}

ROTULOS = {
    "status": {
        "retorno_natal": "Retour dans la municipalité de naissance",
        "primeira_saida": "Premier départ de la municipalité de naissance",
        "etapas_multiplas": "Migration par étapes multiples",
        "nao_natural": "Né ni dans la municipalité ni à l'étranger",
        "nascido_exterior": "Né à l'étranger, migrant interne",
        "internacional_brasileiro": "Retour de l'étranger (Brésilien)",
        "internacional_estrangeiro": "Immigration internationale (étranger)",
        "origem_nao_informada": "Origine non déclarée",
        "outros": "Autres / masqué",
    },
    "edu": {
        "sem_instr_fund_incompleto": "Sans instruction ou fondamental incomplet",
        "fund_completo_medio_incompleto": "Fondamental achevé, secondaire incomplet",
        "medio_completo_superior_incompleto": "Secondaire achevé, supérieur incomplet",
        "superior_completo": "Supérieur achevé",
        "nao_determinado": "Indéterminé",
        "outros": "Autres / masqué",
    },
    "renda": {
        "ate_1_4_sm": "Jusqu'à ¼ de salaire minimum",
        "de_1_4_a_1_2_sm": "De ¼ à ½ salaire minimum",
        "de_1_2_a_1_sm": "De ½ à 1 salaire minimum",
        "de_1_a_2_sm": "De 1 à 2 salaires minimums",
        "mais_de_2_sm": "Plus de 2 salaires minimums",
        "nao_aplicavel": "Sans objet (résidence collective)",
        "outros": "Autres / masqué",
    },
    "idade_sexo": {
        "05_14_M": "5–14 ans, hommes", "05_14_F": "5–14 ans, femmes",
        "15_24_M": "15–24 ans, hommes", "15_24_F": "15–24 ans, femmes",
        "25_39_M": "25–39 ans, hommes", "25_39_F": "25–39 ans, femmes",
        "40_59_M": "40–59 ans, hommes", "40_59_F": "40–59 ans, femmes",
        "60_mais_M": "60 ans et plus, hommes", "60_mais_F": "60 ans et plus, femmes",
        "outros": "Autres / masqué",
    },
}
FAIXAS_IDADE = {"05_14": "5–14 ans", "15_24": "15–24 ans", "25_39": "25–39 ans",
                "40_59": "40–59 ans", "60_mais": "60 ans et plus"}


def idade_indeterminado(faixa: str) -> str:
    return f"{FAIXAS_IDADE[faixa]}, sexe indéterminé"


# ============================== cadre (_BASE) ==============================
PULAR = "Aller au contenu"
SUB_MARCA = "Recensement 2022 · 2017–2022"
ARIA_NAV = "Navigation principale"
ARIA_MIGALHAS = "Fil d'Ariane"
ARIA_IDIOMA = "Langue"
NAV = {
    "municipios": "Municipalités", "rms": "RM", "ufs": "UF", "regioes": "Régions",
    "achados": "Résultats", "metodologia": "Méthodologie", "glossario": "Glossaire",
    "dados": "Données", "abrir": "Ouvrir l'atlas interactif →",
    "rms_extenso": "Régions métropolitaines",
}


def rodape(x, fonte: str, versao: str):
    return H('Source : {fonte}. Version des données : {versao}. <a href="{m}">Méthodologie</a> '
             '&middot; <a href="{d}">Données</a> &middot; <a href="{s}">À propos</a>').format(
        fonte=fonte, versao=versao, m=x.u("/metodologia/"), d=x.u("/dados/"), s=x.u("/sobre/"))


# ============================== page de municipalité ==============================
def titulo_mun(nome_uf: str) -> str:
    return f"Migrations à {nome_uf} (2017–2022)"


def titulo_mun_curto(nome_uf: str) -> str:
    return f"Migrations à {nome_uf}"


def descricao_mun(nome_uf: str) -> str:
    return (f"Solde migratoire, entrants, sortants et profil des migrants de {nome_uf} entre 2017 "
            f"et 2022, d'après le Recensement 2022 de l'IBGE.")


def abertura_mun(x, m):
    extra = ""
    if m["imig_ni"] or m["imig_int"]:
        extra = H(" En outre, {ni} sont arrivés d'une origine non déclarée et {inte} de "
                  "l'étranger.").format(ni=x.i(m["imig_ni"]), inte=x.i(m["imig_int"]))
    return H("{nome}/{uf} comptait une population de référence (5 ans ou plus en 2022) de {pop5} "
             "personnes. Au cours de la période quinquennale 2017–2022, la municipalité a accueilli "
             "{imig} entrants et perdu {emig} sortants vers d'autres municipalités du Brésil, soit "
             "un solde migratoire de {saldo} personnes ({tlm} pour 1 000 habitants) et un "
             "indice d'efficacité migratoire (IEM) de {iem}. La municipalité est ainsi classée, "
             "pour la période, comme un cas {de}<strong>{cls}</strong> migratoire.{extra}").format(
        nome=m["nome"], uf=m["uf_sigla"], pop5=x.i(m["pop5"]), imig=x.i(m["imig"]),
        emig=x.i(m["emig"]), saldo=x.s(m["saldo"]), tlm=x.d(m["tlm"], 2),
        iem=x.d(m["iem"], 3) if m["iem"] is not None else SEM_ESTIMATIVA,
        de=_DE[m["classificacao"]], cls=CLASSIFICACAO[m["classificacao"]], extra=extra)


def h1_mun(m) -> str:
    return f"Migrations à {m['nome']}/{m['uf_sigla']} (2017–2022)"


H_INDICADORES = "Indicateurs"
TH_INDICADOR, TH_ESTIMATIVA, TH_IC, TH_PRECISAO = "Indicateur", "Estimation", "IC à 95 %", "Précision"
L_IMIGRANTES, L_EMIGRANTES, L_SALDO = "Entrants", "Sortants", "Solde migratoire"
L_TLM = "Taux net de migration, TLM (pour 1 000 hab.)"
L_IEM = "Indice d'efficacité migratoire (IEM)"
SEM_CLASSIFICACAO = "non classé"


def cap_indicadores(m) -> str:
    return f"Indicateurs migratoires de {m['nome']}/{m['uf_sigla']}, 2017–2022"


def nota_amostra(m):
    return H("Échantillon d'entrants : {a} observations. Échantillon de sortants : {b} "
             "observations. Intervalle de confiance à 95 % calculé comme l'estimation "
             "&plusmn; 1,96 &times; erreur type.").format(a=m["n_imig_faixa"], b=m["n_emig_faixa"])


H_ORIGENS_DESTINOS = "Principales origines et destinations"
TH_ORIGEM, TH_DESTINO, TH_PESSOAS = "Origine", "Destination", "Personnes"
VER_PAR = "voir le couple dans l'atlas"


def cap_origens(m) -> str:
    return f"10 principales origines des entrants à {m['nome']}/{m['uf_sigla']}"


def cap_destinos(m) -> str:
    return f"10 principales destinations des sortants de {m['nome']}/{m['uf_sigla']}"


SEM_FLUXO_ENTRADA = "Aucun flux d'entrée publié individuellement (sous le seuil de diffusion)."
SEM_FLUXO_SAIDA = "Aucun flux de sortie publié individuellement (sous le seuil de diffusion)."

H_PERFIL = "Profil des migrants et des résidents"
TH_CATEGORIA, TH_PARTICIPACAO, TH_AMOSTRA = "Catégorie", "Part", "Échantillon"
DIRECOES = [("imig", "Entrants (arrivées)"), ("emig", "Sortants (départs)"),
            ("residente", "Résidents non migrants")]
PERFIL_TITULOS = {
    "status": ("Type de migrant", None),
    "edu": ("Niveau d'instruction", "personnes de 25 ans ou plus"),
    "renda": ("Revenu du ménage par personne", "en salaires minimums de 2022"),
    "idade_sexo": ("Âge et sexe", None),
}


def sem_perfil(titulo: str) -> str:
    return f"{titulo} : aucune estimation publiée pour cette ventilation."


H_PENDULAR_MUN = "Mobilité pendulaire (travail et études)"


def cap_pendular(m) -> str:
    return f"Indicateurs de mobilité pendulaire de {m['nome']}/{m['uf_sigla']}"


PEND = {
    "ocupados": "Personnes en emploi (10 ans ou plus)",
    "saida_trab": "Sortent travailler dans une autre municipalité",
    "entrada_trab": "Viennent travailler ici depuis une autre municipalité",
    "saldo": "Solde des navettes",
    "taxa_saida": "Taux de navettes sortantes (%)",
    "atracao": "Indice d'attraction pendulaire",
    "tempo_mediano": "Durée médiane du trajet",
}
MIN = "min"
SEM_PEND = "Aucune estimation de mobilité pendulaire publiée pour cette municipalité."


def link_rm(x, m, href: str):
    return H('<a href="{h}">Cette municipalité fait partie de {rm} &rarr; voir la page de la région '
             'métropolitaine</a>').format(h=href, rm=m["nm_rm"])


def cta_mun(m) -> str:
    return f"Ouvrir {m['nome']}/{m['uf_sigla']} dans l'atlas interactif →"


H_NOTA_MET = "Note méthodologique"


def nota_metodologica(x):
    return H("Estimations établies à partir des microdonnées de l'échantillon du Recensement "
             "démographique 2022 (IBGE, accès contrôlé), question de migration à date fixe "
             "(résidence au 31 juillet 2017 comparée à celle du 31 juillet 2022). Toute estimation "
             "est arrondie au multiple de 5 et a été soumise au contrôle de la divulgation "
             "statistique (aucune cellule de moins de 5 personnes ou de 3 ménages échantillonnés). "
             "Voir la <a href=\"{m}\">méthodologie complète</a> et le "
             "<a href=\"{g}\">glossaire</a>.").format(m=x.u("/metodologia/"), g=x.u("/glossario/"))


H_CITAR = "Comment citer cette page"


def citacao_mun(m, v):
    return H('{autor}. <em>{orig}</em> [{site}] : {nome}/{uf}. Données du Recensement '
             'démographique 2022 (IBGE). Version des données : {versao}. Disponible à '
             'l\'adresse : {url}. DOI du jeu de données : <a href="{doi}">{doi}</a>.').format(
        autor=v["autor"], orig=TITULO_ORIGINAL, site=NOME_SITE, nome=m["nome"], uf=m["uf_sigla"],
        versao=v["versao"], url=v["canonical"], doi=v["doi_url"])


# ============================== pages d'unité (UF / RGI / RGInt) ==============================
NIVEL = {
    "uf": {"rot": "État (UF)", "mesma": "du même État", "pai": "UF"},
    "rgi": {"rot": "Région immédiate", "mesma": "de la même région immédiate",
            "pai": "Régions immédiates"},
    "rgint": {"rot": "Région intermédiaire", "mesma": "de la même région intermédiaire",
              "pai": "Régions intermédiaires"},
}


def titulo_unidade(nome: str) -> str:
    return f"Migrations : {nome} (2017–2022)"


def titulo_unidade_curto(nome: str) -> str:
    return f"Migrations : {nome}"


def descricao_unidade(nome: str) -> str:
    return (f"Solde migratoire et principaux flux de {nome} entre 2017 et 2022, d'après le "
            f"Recensement démographique 2022 de l'IBGE.")


def abertura_unidade(x, u):
    return H("{rot} comptant {n} municipalités et une population de référence de {pop5} personnes. "
             "Au cours de la période quinquennale 2017–2022, l'unité a accueilli {imig} entrants et "
             "perdu {emig} sortants en provenance ou à destination de l'extérieur de ses limites, "
             "soit un solde de {saldo} ({tlm} pour 1 000 habitants).").format(
        rot=NIVEL[u["nivel"]]["rot"], n=u["n_municipios"], pop5=x.i(u["pop5"]), imig=x.i(u["imig"]),
        emig=x.i(u["emig"]), saldo=x.s(u["saldo"]),
        tlm=x.d(u["tlm"], 2) if u["tlm"] is not None else SEM_ESTIMATIVA)


def nota_unidade(u):
    return ("La migration entre municipalités " + NIVEL[u["nivel"]]["mesma"] + " n'est pas "
            "comptabilisée ici : seuls les flux qui franchissent la limite de l'unité le "
            "sont. Les indicateurs de cette page sont des sommes directes des flux municipaux "
            "publiés (hors couples masqués par le contrôle de la divulgation), et non une nouvelle "
            "estimation d'échantillon : c'est pourquoi il n'y a ni erreur type ni intervalle "
            "de confiance à ce niveau d'agrégation.")


CAP_ORIGENS_UNID = "10 principales origines des entrants"
CAP_DESTINOS_UNID = "10 principales destinations des sortants"
SEM_FLUXO_UNID = "Aucun flux publié individuellement."
TH_MUNICIPIO, TH_SALDO = "Municipalité", "Solde"


def h_municipios_de(nome: str) -> str:
    return f"Municipalités : {nome}"


def cap_municipios_unid(n: int) -> str:
    return f"{n} municipalités, avec solde migratoire 2017–2022"


def cta_unidade(nome: str) -> str:
    return f"Ouvrir {nome} dans l'atlas interactif →"


# ============================== pages de région métropolitaine ==============================
TIPO_RM = {"RIDE": "Région intégrée de développement économique (RIDE)",
           "RM": "Région métropolitaine (RM)"}


def titulo_rm(nome: str) -> str:
    return f"Migrations : {nome} (2017–2022)"


def titulo_rm_curto(nome: str) -> str:
    return f"Migrations : {nome}"


def descricao_rm(nome: str) -> str:
    return (f"Migration intramétropolitaine, mobilité pendulaire et centre × périphérie de {nome} "
            f"entre 2017 et 2022, Recensement 2022 (IBGE).")


def abertura_rm(x, r):
    return H("{tipo} composée de {n} municipalités, dont le centre est {nucleo}, avec une "
             "population de référence de {pop} personnes. Au cours de la période quinquennale "
             "2017–2022, on a compté {intra} migrations internes à la région (entre ses "
             "municipalités) et un solde migratoire externe (avec le reste du pays) de "
             "{saldo}.").format(
        tipo=r["tipo_extenso"], n=r["n_municipios"], nucleo=r["nm_nucleo"], pop=x.i(r["pop_total"]),
        intra=x.i(r["mig_intra"]), saldo=x.s(r["saldo_externo"]))


H_MATRIZ = "Matrice centre × périphérie (migration intramétropolitaine)"
RM_MATRIZ = {
    "np": "Centre → périphérie", "pn": "Périphérie → centre", "pp": "Périphérie → périphérie",
    "ent": "Entrées externes (reste du pays)", "sai": "Sorties externes (reste du pays)",
}
H_TOP_INTRA = "10 principaux flux migratoires intra-RM"
TH_TIPOLOGIA = "Type de flux"
SEM_FLUXO_INTRA = "Aucun flux intra-RM publié individuellement."
H_PENDULAR_RM = "Mobilité pendulaire"
RM_PEND = {
    "ocupados": "Personnes en emploi dans la région",
    "pendulares": "Navetteurs (travaillent hors de leur municipalité de résidence)",
    "pct_pendular": "% de navetteurs parmi les personnes en emploi",
    "tempo_mediano": "Durée médiane du trajet",
    "pct_coletivo": "% en transports en commun",
}
H_MIGRANTES_TRABALHO = "Migrants et emploi"
NOTA_MIGRANTES_TRABALHO = ("Somme des municipalités de la région (rm_mig_pendular_resumo) : parmi "
                           "les personnes qui ont migré au sein de leur propre région métropolitaine "
                           "et étaient en emploi, lieu où elles sont allées travailler.")
RM_MP = {
    "migrantes_intra": "Migrants intra-RM",
    "mig_ocupados": "... en emploi",
    "mig_pendulares": "... navetteurs (travaillent hors de leur nouvelle municipalité de résidence)",
    "pendular_para_origem": "... retournent travailler dans la municipalité d'origine qu'ils ont quittée",
    "pendular_para_nucleo": "... travaillent désormais dans le centre",
    "trabalha_onde_mora": "... travaillent là où ils habitent désormais",
}


def h_municipios_da_rm(nome: str) -> str:
    return f"Municipalités : {nome}"


TH_NUCLEO, TH_SALDO_MIG, SIM = "Centre", "Solde migratoire", "Oui"


def cta_rm(nome: str) -> str:
    return f"Ouvrir {nome} dans l'atlas interactif →"


# ============================== index ==============================
def indice_municipios(x, n_munic: int):
    return {
        "titulo": "Municipalités de l'atlas par UF",
        "descricao": f"Liste des {x.i(n_munic)} municipalités brésiliennes dont les données de "
                     f"migration interne sont publiées, regroupées par UF.",
        "intro": H('<p>Les {n} municipalités brésiliennes publiées dans l\'atlas, regroupées par UF '
                   '(les 26 États et le District fédéral). Voir aussi la <a href="{u}">liste des '
                   'UF</a> et les <a href="{r}">régions métropolitaines</a>.</p>').format(
            n=x.i(n_munic), u=x.u("/ufs/"), r=x.u("/regioes-metropolitanas/")),
    }


def pagina_da_uf(href: str):
    return H('<a href="{h}">page de l\'UF</a>').format(h=href)


def n_municipios(n: int) -> str:
    return f"{n} municipalités"


def indice_ufs(x):
    return {
        "titulo": "États et District fédéral (UF)",
        "descricao": "Les 27 unités fédératives (UF) brésiliennes avec leurs indicateurs agrégés de migration interne, Recensement 2022.",
        "intro": H("<p>Les 27 unités fédératives (UF : les 26 États et le District fédéral) avec "
                   "leurs indicateurs agrégés de migration interne.</p>"),
    }


def indice_rms(x):
    return {
        "titulo": "Régions métropolitaines et RIDE",
        "descricao": "Les 81 régions métropolitaines (RM) et régions intégrées de développement économique (RIDE) du Brésil, avec migration intramétropolitaine et mobilité pendulaire, Recensement 2022.",
        "intro": H("<p>Les 81 régions métropolitaines (RM) et régions intégrées de développement "
                   "économique (RIDE) du Brésil, avec le module de migration intramétropolitaine et "
                   "de mobilité pendulaire.</p>"),
    }


def rm_item_extra(tipo: str, n: int) -> str:
    return f"({tipo}, {n} municipalités)"


def indice_regioes(x):
    return {
        "titulo": "Régions immédiates et intermédiaires",
        "descricao": "Les 510 régions immédiates (RGI) et 133 régions intermédiaires (RGInt) de l'IBGE, avec leurs indicateurs agrégés de migration interne, Recensement 2022.",
        "intro": H("<p>510 régions immédiates (RGI) et 133 régions intermédiaires (RGInt), découpage "
                   "territorial de l'IBGE, avec des indicateurs agrégés de migration interne.</p>"),
        "h_rgi": "Régions immédiates", "h_rgint": "Régions intermédiaires",
    }


# ============================== résultats ==============================
TH_FLUXO = "Flux"
VER_NO_ATLAS = "voir dans l'atlas"


def corpo_achados(x, v):
    return H("""
<p>Trois résultats clés de la recherche, déjà validés dans la méthodologie (voir la <a href="{met}">méthodologie</a>
et <code>docs/qa/F2b_relatorio.md</code>), ainsi que les plus grands soldes et flux publiés.</p>

<section class="secao achado">
<h2>Déconcentration résidentielle sans déconcentration productive</h2>
<p>Parmi les personnes en emploi qui ont quitté le centre métropolitain pour la périphérie entre 2017 et 2022,
<strong>{p1}</strong> continuent de travailler dans le centre : le logement s'est déplacé, l'emploi non.
Dans la RIDE du District fédéral, cette part atteint <strong>{p2}</strong>.
<a href="{ride}">Voir la RIDE-DF &rarr;</a></p>
</section>

<section class="secao achado">
<h2>Sélectivité éducative du flux Rio de Janeiro &rarr; São Paulo</h2>
<p>Parmi les migrants de 25 ans ou plus qui ont quitté Rio de Janeiro pour São Paulo,
<strong>{p3}</strong> ont un diplôme de l'enseignement supérieur, une sélectivité éducative marquée.
<a href="{app_rj_sp}">Voir le flux dans l'atlas &rarr;</a></p>
</section>

<section class="secao achado">
<h2>Le plus grand couple pendulaire du pays</h2>
<p>Guarulhos &rarr; São Paulo est le plus grand couple pendulaire de travail du Brésil :
<strong>{n_pend} personnes</strong> habitent à Guarulhos et travaillent à São Paulo.
<a href="{app_pend}">Voir le couple pendulaire &rarr;</a></p>
</section>

<section class="secao">
<h2>{milhoes} millions de personnes ont changé de municipalité</h2>
<p>Au cours de la période quinquennale 2017–2022, {milhoes} millions de personnes ont migré entre les {n_mun}
municipalités brésiliennes, ce qui donne {n_pares} couples origine–destination publiés après contrôle de la divulgation.</p>
</section>

<section class="secao">
<h2>10 plus forts soldes migratoires positifs</h2>
{tbl_pos}
</section>

<section class="secao">
<h2>10 plus forts soldes migratoires négatifs</h2>
{tbl_neg}
</section>

<section class="secao">
<h2>10 plus grands flux migratoires du pays</h2>
{tbl_fluxos}
</section>
""").format(
        met=x.u("/metodologia/"), p1=x.pct(46.5), p2=x.pct(59.3), ride=v["link_ride"],
        app_rj_sp=x.app("o=3304557&d=3550308"), p3=x.pct(75.1), n_pend=x.i(77500),
        app_pend=x.app("rm=4901&aba=trab&o=3518800&d=3550308"), milhoes=x.d(12.9, 1),
        n_mun=x.i(5570), n_pares=x.i(53097), tbl_pos=v["tbl_pos"], tbl_neg=v["tbl_neg"],
        tbl_fluxos=v["tbl_fluxos"])


ACHADOS_TITULO = "Principaux résultats de l'atlas"
ACHADOS_DESCRICAO = ("Les principaux résultats de migration interne du Recensement 2022 : "
                     "déconcentration métropolitaine, sélectivité éducative, plus grand couple "
                     "pendulaire, plus forts soldes et flux.")


# ============================== méthodologie ==============================
METODOLOGIA_TITULO = "Méthodologie de l'atlas"
METODOLOGIA_DESCRICAO = ("Source, définitions, formules des indicateurs et règles de contrôle de la "
                         "divulgation de l'Atlas des migrations internes au Brésil, Recensement 2022.")


def corpo_metodologia(x, v):
    r = v["r"]
    return H("""
<p>Version statique de la page de méthodologie de l'atlas interactif. Voir aussi le
<a href="{glos}">glossaire</a> et le document complet <code>docs/METODOLOGIA.md</code>
du dépôt du projet (en portugais).</p>

<section class="secao"><h2>Source et champ</h2>
<p>Les données proviennent du Recensement démographique 2022 de l'IBGE (Institut brésilien de
géographie et de statistique), microdonnées de l'échantillon (accès contrôlé), question sur la
migration (migration interne et internationale). Le champ est la population de 5 ans ou plus
résidant au Brésil en 2022.</p></section>

<section class="secao"><h2>Migrant à date fixe</h2>
<p>On compare la municipalité de résidence au 31 juillet 2017 à celle du 31 juillet 2022. Est migrant
interne la personne qui habitait une autre municipalité du Brésil en 2017 ; migrant international,
celle qui habitait un autre pays ; non-migrant, celle qui habitait déjà la même municipalité (ou qui y
habite depuis 6 ans ou plus).</p></section>

<section class="secao"><h2>Indicateurs</h2>
<dl>
<dt>Solde migratoire</dt><dd>Entrants moins sortants.</dd>
<dt>Taux net de migration (TLM)</dt><dd>(Solde / population de référence) &times; 1 000, pour 1 000 habitants.</dd>
<dt>Indice d'efficacité migratoire (IEM)</dt><dd>Solde / (entrants + sortants), compris entre &minus;1 et 1.</dd>
</dl></section>

<section class="secao"><h2>Précision des estimations</h2>
<p>Tout effectif provient d'un échantillon et comporte une erreur d'échantillonnage. Chaque estimation
publiée reçoit une classe de précision selon le coefficient de variation (CV) : <strong>bonne</strong>
(CV jusqu'à {cv_boa} %), <strong>à utiliser avec prudence</strong> (CV entre {cv_boa} % et
{cv_cautela} %), <strong>faible précision</strong> (CV supérieur à {cv_cautela} %).</p></section>

<section class="secao"><h2>Contrôle de la divulgation</h2>
<p>Avant la publication, un <em>gate</em> automatique (règles R1–R9) empêche qu'une cellule permette
d'identifier quelqu'un : aucun flux ni aucune catégorie de moins de {min_pessoas} personnes
(estimation pondérée) ou de {min_dom} ménages échantillonnés ; ventilation par caractéristique
seulement pour les flux d'au moins {min_det} observations de l'échantillon ; tout effectif
pondéré arrondi au multiple de {arred} ; aucun effectif exact de l'échantillon publié, seulement
des tranches.</p></section>

<section class="secao"><h2>Niveaux d'agrégation</h2>
<p>Outre la municipalité, l'atlas agrège par région immédiate, région intermédiaire et UF (État).
À ces niveaux, la migration entre municipalités d'une même unité n'est pas comptée, les couples
masqués sont exclus de la somme et aucune erreur type n'est publiée.</p></section>

<section class="secao"><h2>Limites</h2>
<ul>
<li>La migration à date fixe ne capte pas les déplacements multiples au cours de la période quinquennale.</li>
<li>Les résultats peuvent différer des tableaux officiels de l'IBGE (SIDRA).</li>
<li>L'erreur d'échantillonnage est estimée par un estimateur prudent par grappes (le ménage comme
unité primaire, la zone de pondération comme strate).</li>
</ul></section>

<section class="secao"><h2>Comment citer</h2>
<p>{autor}. <em>Atlas da migração interna no Brasil</em> [Atlas des migrations internes au Brésil].
Données du Recensement démographique 2022 (IBGE). DOI : <a href="https://doi.org/{doi_c}">{doi_c}</a>
(toutes versions) / <a href="https://doi.org/{doi_v}">{doi_v}</a> (v2.1.0).</p>
<p>Données et contenu sous licence <a href="{lic}">CC BY 4.0</a>, avec attribution à l'IBGE
comme source primaire. Métadonnées structurées dans
<a href="{repo}/blob/main/CITATION.cff">CITATION.cff</a>.</p>
</section>

<section class="secao"><h2>Avertissement standard</h2><p class="aviso">{aviso}</p></section>
""").format(
        glos=x.u("/glossario/"), cv_boa=x.num_cru(r["cv_boa"]), cv_cautela=x.num_cru(r["cv_cautela"]),
        min_pessoas=r["min_pessoas"], min_dom=r["min_domicilios"], min_det=r["min_pessoas_detalhe"],
        arred=r["arredondamento"], autor=v["autor"], doi_c=v["doi_conceito"], doi_v=v["doi_versao"],
        lic=v["licenca_url"], repo=v["repo"], aviso=v["aviso"])


# ============================== glossaire ==============================
GLOSSARIO_TITULO = "Glossaire de l'atlas"
GLOSSARIO_DESCRICAO = ("Définitions des termes de l'Atlas des migrations internes : solde migratoire, "
                       "taux net, IEM, migration de retour, mobilité pendulaire, précision et contrôle "
                       "de la divulgation.")
GLOS_UI = {"oQueE": "Définition", "comoInterpretar": "Comment interpréter", "limitacoes": "Limites"}


def glossario_intro(x, n: int):
    return H('<p>{n} termes utilisés dans l\'atlas, avec pour chacun la définition, la manière de '
             'l\'interpréter et ses limites. Voir aussi la <a href="{m}">méthodologie</a>.</p>').format(
        n=n, m=x.u("/metodologia/"))


# ============================== données ==============================
DADOS_TITULO = "Données publiées de l'atlas"
DADOS_DESCRICAO = ("Dictionnaire des tables Parquet publiées par l'Atlas des migrations internes, avec "
                   "la licence et la manière de citer les données du Recensement 2022.")
DADOS_TABELAS = [
    ("municipios.parquet", "Indicateurs municipaux : population, entrants, sortants, solde, taux, IEM, précision."),
    ("municipios_dim.parquet", "Profil des migrants et des résidents par municipalité : type de migrant, niveau d'instruction, revenu, âge et sexe."),
    ("municipios_pendular.parquet", "Indicateurs de mobilité pendulaire par municipalité."),
    ("fluxos.parquet", "Matrice des flux migratoires de municipalité à municipalité, avec détail par profil."),
    ("fluxos_uf.parquet", "Flux migratoires entre UF."),
    ("fluxos_rgi.parquet", "Flux migratoires entre régions immédiates."),
    ("fluxos_rgint.parquet", "Flux migratoires entre régions intermédiaires."),
    ("pendular_trab.parquet", "Flux de navettes domicile-travail, de municipalité à municipalité."),
    ("pendular_estudo.parquet", "Flux de navettes domicile-études, de municipalité à municipalité."),
    ("rm.parquet", "Composition municipale des régions métropolitaines et des RIDE."),
    ("rm_resumo.parquet", "Indicateurs agrégés par région métropolitaine / RIDE."),
    ("rm_fluxos_intra.parquet", "Flux migratoires internes à chaque région métropolitaine."),
    ("rm_mig_pendular_resumo.parquet", "Croisement migration intramétropolitaine × emploi, par municipalité."),
    ("municipios_ref.parquet", "Référentiel territorial public (méso/microrégion, RGI, RGInt, RM, concentration urbaine)."),
]
DADOS_BC = "Données publiées"
DATASET = {
    "name_suffix": "données publiées",
    "isBasedOn": "Recensement démographique 2022 -- IBGE",
    "orgIBGE": "Institut brésilien de géographie et de statistique (IBGE)",
    "keywords": ["migration interne", "Recensement 2022", "IBGE", "démographie", "municipalités du Brésil"],
    "variableMeasured": ["entrants", "sortants", "solde migratoire", "taux net de migration",
                         "indice d'efficacité migratoire", "mobilité pendulaire"],
}


def corpo_dados(x, v):
    return H("""
<p>Toutes les tables ci-dessous ont été soumises au contrôle statistique de la divulgation (R1–R9) :
petites cellules masquées, valeurs arrondies au multiple de {arred}, effectifs de l'échantillon
seulement en tranches. Format : Apache Parquet.</p>

<section class="secao"><h2>Dictionnaire résumé</h2>
<table><thead><tr><th scope="col">Fichier</th><th scope="col">Contenu</th></tr></thead>
<tbody>{linhas}</tbody></table></section>

<section class="secao"><h2>Licence</h2>
<p>Les données agrégées publiées ici (tables Parquet, pages statiques et contenu textuel de l'atlas)
sont sous licence <a href="{lic_url}">{lic_nome}</a>, avec attribution obligatoire à l'IBGE
comme source primaire. Le code source du projet est sous licence {lic_cod}
(dépôt GitHub). Les microdonnées originales du Recensement 2022 sont des données à accès contrôlé de
l'IBGE et NE sont PAS incluses dans ce site ni dans le dépôt : elles restent soumises aux
conditions d'utilisation de l'IBGE. Les tables agrégées et arrondies publiées ici ont été soumises
au contrôle statistique de la divulgation et ne permettent pas la réidentification individuelle.</p></section>

<section class="secao"><h2>Comment citer</h2>
<p class="citacao">{autor}. <em>{orig}</em> [{site}]. Données du Recensement démographique 2022
(IBGE). Version des données : {versao}. DOI : {doi}. Disponible à l'adresse : {url_home}.</p>
<p class="nota">{atrib}</p></section>

<section class="secao"><h2>Source et avertissement</h2>
<p>Source : {fonte}.</p>
<p class="aviso">{aviso}</p></section>
""").format(
        arred=v["arred"], linhas=v["linhas"], lic_url=v["licenca_url"], lic_nome=v["licenca_nome"],
        lic_cod=v["licenca_codigo"], autor=v["autor"], orig=TITULO_ORIGINAL, site=NOME_SITE,
        versao=v["versao"], doi=v["doi"], url_home=v["url_home"], atrib=ATRIBUICAO_PADRAO,
        fonte=v["fonte"], aviso=v["aviso"])


# ============================== à propos ==============================
SOBRE_TITULO = "À propos du projet"
SOBRE_DESCRICAO = ("Ce qu'est l'Atlas des migrations internes au Brésil, qui l'a réalisé, et la "
                   "politique d'utilisation des microdonnées du Recensement 2022.")


def corpo_sobre(x, v):
    return H("""
<p>L'Atlas des migrations internes au Brésil réunit, dans un seul tableau de bord navigable, les
flux de migration interne, la mobilité pendulaire et le module métropolitain du Recensement
démographique 2022 de l'IBGE, aux niveaux de la municipalité, de la région immédiate, de la région
intermédiaire et de l'UF.</p>

<section class="secao"><h2>Qui l'a réalisé</h2>
<p>{autor} (GitHub : <a href="{gh_url}">@{gh_user}</a>).
Rattachement institutionnel : {vinculo}.</p></section>

<section class="secao"><h2>Politique d'utilisation des microdonnées</h2>
<p>Les microdonnées de l'échantillon du Recensement démographique 2022 utilisées dans ce projet sont
des données à accès contrôlé de l'IBGE. Aucun enregistrement individuel n'est publié : toutes les
tables disponibles à la page <a href="{dados}">/dados/</a> ont franchi un <em>gate</em> automatique de
contrôle statistique de la divulgation (masquage des petites cellules, arrondi, tranches d'effectifs
de l'échantillon) avant de quitter l'environnement contrôlé.</p></section>

<section class="secao"><h2>Licences</h2>
<p>Données agrégées et contenu textuel sous <a href="{lic_url}">{lic_nome}</a>,
avec attribution obligatoire à l'IBGE comme source primaire ; code source sous licence
{lic_cod}. Voir <a href="{dados}">/dados/</a> pour les détails.</p></section>

<section class="secao"><h2>Contact</h2>
<p>Pour toute question, correction ou signalement d'erreur, ouvrez une <em>issue</em> dans le
<a href="{repo}">dépôt GitHub du projet</a> ou écrivez à l'adresse e-mail publique de
contact de l'auteur, {email}.</p></section>
""").format(
        autor=v["autor"], gh_url=v["github_url"], gh_user=v["github_user"], vinculo=v["vinculo"],
        dados=x.u("/dados/"), lic_url=v["licenca_url"], lic_nome=v["licenca_nome"],
        lic_cod=v["licenca_codigo"], repo=v["repo"], email=v["email"])


# ============================== accueil statique de la langue ==============================
HOME_TITULO = "Atlas des migrations internes au Brésil"
HOME_DESCRICAO = ("Flux de migration interne entre les municipalités brésiliennes, 2017–2022, d'après "
                  "le Recensement démographique 2022 (IBGE).")


def corpo_home(x, v):
    return H("""
<p>L'Atlas des migrations internes au Brésil montre où les personnes ont déménagé entre le 31 juillet
2017 et le 31 juillet 2022, à partir de la question sur la migration interne des microdonnées de
l'échantillon du Recensement démographique 2022 du Brésil (données à accès contrôlé de l'IBGE,
l'Institut brésilien de géographie et de statistique).</p>

<p class="cta"><a href="{app}">Ouvrir l'atlas interactif &rarr;</a></p>

<section class="secao"><h2>Explorer par territoire</h2>
<ul>
<li><a href="{mun}">Municipalités</a> : {n_mun} pages, une par municipalité.</li>
<li><a href="{uf}">États et District fédéral (UF)</a>.</li>
<li><a href="{reg}">Régions immédiates et intermédiaires</a>.</li>
<li><a href="{rm}">Régions métropolitaines et RIDE</a>.</li>
</ul></section>

<section class="secao"><h2>Source</h2>
<p>IBGE, Recensement démographique 2022, microdonnées de l'échantillon (accès contrôlé), question de
migration à date fixe (résidence au 31 juillet 2017 comparée à celle du 31 juillet 2022).</p></section>

<section class="secao"><h2>Principaux résultats</h2>
<ul>
<li>{milhoes} millions de personnes ont changé de municipalité de résidence au cours de la période
quinquennale, parmi les {n_mun} municipalités brésiliennes, ce qui donne {n_pares} couples
origine–destination publiés.</li>
<li>Parmi les personnes qui ont quitté le centre d'une métropole pour sa périphérie, {p1} continuent
de travailler dans le centre : déconcentration résidentielle sans déconcentration de l'emploi ;
dans la région intégrée du District fédéral (RIDE-DF), cette part atteint {p2}.</li>
<li>Parmi les migrants de 25 ans ou plus allant de Rio de Janeiro à São Paulo, {p3} ont un diplôme
de l'enseignement supérieur, une sélectivité éducative marquée.</li>
<li>Guarulhos &rarr; São Paulo est le plus grand couple pendulaire du pays : {n_pend} personnes.</li>
</ul>
<p><a href="{ach}">Voir tous les résultats</a> &middot; <a href="{met}">Méthodologie</a> &middot;
<a href="{glos}">Glossaire</a> &middot; <a href="{dados}">Données</a></p></section>

<p>Toute estimation publiée a été arrondie et soumise à un contrôle statistique de la divulgation
(masquage des petites cellules, arrondi, tranches d'effectifs de l'échantillon) avant de quitter
l'environnement à accès contrôlé : aucun enregistrement individuel n'est publié.</p>
""").format(
        app=x.app(""), mun=x.u("/municipios/"), uf=x.u("/ufs/"), reg=x.u("/regioes/"),
        rm=x.u("/regioes-metropolitanas/"), n_mun=x.i(5570), milhoes=x.d(12.9, 1),
        n_pares=x.i(53097), p1=x.pct(46.5), p2=x.pct(59.3), p3=x.pct(75.1), n_pend=x.i(77500),
        ach=x.u("/achados/"), met=x.u("/metodologia/"), glos=x.u("/glossario/"), dados=x.u("/dados/"))


# ============================== 404 ==============================
E404_TITULO = "Page introuvable"
E404_DESCRICAO = "La page demandée n'existe pas dans l'Atlas des migrations internes. Consultez les index des municipalités, des UF et des régions."


def corpo_404(x):
    return H("<p>Page introuvable. Utilisez la recherche de l'atlas interactif ou l'un des index "
             "ci-dessous :</p>"
             '<ul><li><a href="{mun}">Municipalités</a></li>'
             '<li><a href="{rm}">Régions métropolitaines</a></li>'
             '<li><a href="{uf}">UF</a></li><li><a href="{reg}">Régions</a></li>'
             "<li><a href=\"{home}\">Retour à la page d'accueil</a></li></ul>").format(
        mun=x.u("/municipios/"), rm=x.u("/regioes-metropolitanas/"), uf=x.u("/ufs/"),
        reg=x.u("/regioes/"), home=x.u("/"))
