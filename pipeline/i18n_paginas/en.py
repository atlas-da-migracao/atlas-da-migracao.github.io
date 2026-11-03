"""English catalog of the static SEO pages (American English, `en-US` numbers).

Translation of the Portuguese reference (`pt.py`), following `web/src/i18n/TERMINOLOGIA.md`:
in-migrants / out-migrants, net migration, "depletion" for "evasão", "RM" never "metropolitan
area", sentence case in titles, acronyms of the atlas (TLM, IEM, UF, RM, RIDE, RGI, RGInt)
unchanged and expanded at first mention."""
from __future__ import annotations

from . import H

LANG = "en"

# ============================== site identity ==============================
NOME_SITE = "Atlas of internal migration in Brazil"
TITULO_ORIGINAL = "Atlas da migração interna no Brasil"  # title kept in the original in citations
DESCRICAO_SITE = ("Net migration and flows between Brazilian municipalities in the 2017–2022 "
                  "five-year period, from the sample microdata of IBGE's 2022 Demographic Census.")
ATRIBUICAO_PADRAO = (
    "Primary source: IBGE, 2022 Demographic Census, sample microdata (controlled access). "
    "Estimates: Daniel Pessini Sobreira, Atlas da migração interna no Brasil."
)
PAIS = "Brazil"
AVISO_TRADUCAO = (
    "This is a translation of the Portuguese original, which is the reference version. In case of "
    "any discrepancy, the Portuguese text prevails; estimates, caveats and IBGE notices apply as "
    "worded in the original."
)

SEM_ESTIMATIVA = "no estimate"
SEP_INTERVALO = "to"
NAO_INFORMADO = "not reported"

OG_LINHAS = ("Atlas of internal", "migration in Brazil")
OG_SUB = "2022 Census · IBGE · 2017–2022"

ROTULO_PRECISAO = {
    "boa": "good", "cautela": "use with caution", "baixa": "low precision",
    "sem_estimativa": "no estimate",
}
TIPOLOGIA_ROTULO = {
    "nucleo_periferia": "Core → periphery",
    "periferia_nucleo": "Periphery → core",
    "periferia_periferia": "Periphery → periphery",
}
CLASSIFICACAO = {"equilibrio": "balance", "atracao": "attraction", "evasao": "depletion"}

# Category labels (keys = those of meta.json -> rotulos)
ROTULOS = {
    "status": {
        "retorno_natal": "Return to municipality of birth",
        "primeira_saida": "First move from municipality of birth",
        "etapas_multiplas": "Multi-step migration",
        "nao_natural": "Born neither in the municipality nor abroad",
        "nascido_exterior": "Born abroad, internal migrant",
        "internacional_brasileiro": "Return from abroad (Brazilian)",
        "internacional_estrangeiro": "International immigration (foreign national)",
        "origem_nao_informada": "Origin not reported",
        "outros": "Other / suppressed",
    },
    "edu": {
        "sem_instr_fund_incompleto": "No schooling or incomplete elementary",
        "fund_completo_medio_incompleto": "Completed elementary, incomplete high school",
        "medio_completo_superior_incompleto": "Completed high school, incomplete higher education",
        "superior_completo": "Completed higher education",
        "nao_determinado": "Undetermined",
        "outros": "Other / suppressed",
    },
    "renda": {
        "ate_1_4_sm": "Up to ¼ of a minimum wage",
        "de_1_4_a_1_2_sm": "¼ to ½ minimum wage",
        "de_1_2_a_1_sm": "½ to 1 minimum wage",
        "de_1_a_2_sm": "1 to 2 minimum wages",
        "mais_de_2_sm": "More than 2 minimum wages",
        "nao_aplicavel": "Not applicable (collective dwelling)",
        "outros": "Other / suppressed",
    },
    "idade_sexo": {
        "05_14_M": "Ages 5–14, male", "05_14_F": "Ages 5–14, female",
        "15_24_M": "Ages 15–24, male", "15_24_F": "Ages 15–24, female",
        "25_39_M": "Ages 25–39, male", "25_39_F": "Ages 25–39, female",
        "40_59_M": "Ages 40–59, male", "40_59_F": "Ages 40–59, female",
        "60_mais_M": "Ages 60 and over, male", "60_mais_F": "Ages 60 and over, female",
        "outros": "Other / suppressed",
    },
}
FAIXAS_IDADE = {"05_14": "Ages 5–14", "15_24": "Ages 15–24", "25_39": "Ages 25–39",
                "40_59": "Ages 40–59", "60_mais": "Ages 60 and over"}


def idade_indeterminado(faixa: str) -> str:
    return f"{FAIXAS_IDADE[faixa]}, sex undetermined"


# ============================== chrome (_BASE) ==============================
PULAR = "Skip to content"
SUB_MARCA = "2022 Census · 2017–2022"
ARIA_NAV = "Main navigation"
ARIA_MIGALHAS = "Breadcrumb"
ARIA_IDIOMA = "Language"
NAV = {
    "municipios": "Municipalities", "rms": "RMs", "ufs": "UFs", "regioes": "Regions",
    "achados": "Findings", "metodologia": "Methodology", "glossario": "Glossary",
    "dados": "Data", "abrir": "Open the interactive atlas →",
    "rms_extenso": "Metropolitan regions",
}


def rodape(x, fonte: str, versao: str):
    return H('Source: {fonte}. Data version: {versao}. <a href="{m}">Methodology</a> &middot; '
             '<a href="{d}">Data</a> &middot; <a href="{s}">About</a>').format(
        fonte=fonte, versao=versao, m=x.u("/metodologia/"), d=x.u("/dados/"), s=x.u("/sobre/"))


# ============================== municipality page ==============================
def titulo_mun(nome_uf: str) -> str:
    return f"Migration in {nome_uf} (2017–2022)"


def titulo_mun_curto(nome_uf: str) -> str:
    return f"Migration in {nome_uf}"


def descricao_mun(nome_uf: str) -> str:
    return (f"Net migration, in-migrants, out-migrants and migrant profile of {nome_uf} "
            f"between 2017 and 2022, from IBGE's 2022 Census.")


def abertura_mun(x, m):
    extra = ""
    if m["imig_ni"] or m["imig_int"]:
        extra = H(" In addition, {ni} arrived with an unreported origin and {inte} came from "
                  "abroad.").format(ni=x.i(m["imig_ni"]), inte=x.i(m["imig_int"]))
    return H("{nome}/{uf} had a reference population (aged 5 or over in 2022) of {pop5} people. "
             "In the 2017–2022 five-year period, the municipality received {imig} in-migrants and "
             "lost {emig} out-migrants to other municipalities in Brazil, resulting in a net "
             "migration of {saldo} people ({tlm} per 1,000 population) and a migration "
             "effectiveness index (IEM) of {iem}. This classifies the municipality, for the "
             "period, as one of migratory <strong>{cls}</strong>.{extra}").format(
        nome=m["nome"], uf=m["uf_sigla"], pop5=x.i(m["pop5"]), imig=x.i(m["imig"]),
        emig=x.i(m["emig"]), saldo=x.s(m["saldo"]), tlm=x.d(m["tlm"], 2),
        iem=x.d(m["iem"], 3) if m["iem"] is not None else SEM_ESTIMATIVA,
        cls=CLASSIFICACAO[m["classificacao"]], extra=extra)


def h1_mun(m) -> str:
    return f"Migration in {m['nome']}/{m['uf_sigla']} (2017–2022)"


H_INDICADORES = "Indicators"
TH_INDICADOR, TH_ESTIMATIVA, TH_IC, TH_PRECISAO = "Indicator", "Estimate", "95% CI", "Precision"
L_IMIGRANTES, L_EMIGRANTES, L_SALDO = "In-migrants", "Out-migrants", "Net migration"
L_TLM = "Net migration rate, TLM (per 1,000 pop.)"
L_IEM = "Migration effectiveness index (IEM)"
SEM_CLASSIFICACAO = "not classified"


def cap_indicadores(m) -> str:
    return f"Migration indicators for {m['nome']}/{m['uf_sigla']}, 2017–2022"


def nota_amostra(m):
    return H("Sample of in-migrants: {a} observations. Sample of out-migrants: {b} observations. "
             "95% confidence interval computed as estimate &plusmn; 1.96 &times; "
             "standard error.").format(a=m["n_imig_faixa"], b=m["n_emig_faixa"])


H_ORIGENS_DESTINOS = "Top origins and destinations"
TH_ORIGEM, TH_DESTINO, TH_PESSOAS = "Origin", "Destination", "People"
VER_PAR = "view pair in the atlas"


def cap_origens(m) -> str:
    return f"Top 10 origins of in-migrants to {m['nome']}/{m['uf_sigla']}"


def cap_destinos(m) -> str:
    return f"Top 10 destinations of out-migrants from {m['nome']}/{m['uf_sigla']}"


SEM_FLUXO_ENTRADA = "No inflows published individually (below the disclosure threshold)."
SEM_FLUXO_SAIDA = "No outflows published individually (below the disclosure threshold)."

H_PERFIL = "Profile of migrants and residents"
TH_CATEGORIA, TH_PARTICIPACAO, TH_AMOSTRA = "Category", "Share", "Sample"
DIRECOES = [("imig", "In-migrants (arrivals)"), ("emig", "Out-migrants (departures)"),
            ("residente", "Non-migrant residents")]
PERFIL_TITULOS = {
    "status": ("Migrant type", None),
    "edu": ("Educational attainment", "people aged 25 and over"),
    "renda": ("Household income per capita", "in 2022 minimum wages"),
    "idade_sexo": ("Age and sex", None),
}


def sem_perfil(titulo: str) -> str:
    return f"{titulo}: no estimate published for this breakdown."


H_PENDULAR_MUN = "Commuting (work and study)"


def cap_pendular(m) -> str:
    return f"Commuting indicators for {m['nome']}/{m['uf_sigla']}"


PEND = {
    "ocupados": "Employed persons (aged 10 and over)",
    "saida_trab": "Commute out to work in another municipality",
    "entrada_trab": "Commute in from another municipality to work here",
    "saldo": "Net commuting",
    "taxa_saida": "Out-commuting rate (%)",
    "atracao": "Commuting attraction index",
    "tempo_mediano": "Median commuting time",
}
MIN = "min"
SEM_PEND = "No commuting estimate published for this municipality."


def link_rm(x, m, href: str):
    return H('<a href="{h}">This municipality is part of {rm} &rarr; see the metropolitan region '
             'page</a>').format(h=href, rm=m["nm_rm"])


def cta_mun(m) -> str:
    return f"Open {m['nome']}/{m['uf_sigla']} in the interactive atlas →"


H_NOTA_MET = "Methodological note"


def nota_metodologica(x):
    return H("Estimates from the sample microdata of the 2022 Demographic Census (IBGE, controlled "
             "access), fixed-date migration question (residence on July 31, 2017 compared with "
             "residence on July 31, 2022). Every estimate is rounded to multiples of 5 and has "
             "passed statistical disclosure control (no cell with fewer than 5 people or 3 sampled "
             "households). See the <a href=\"{m}\">full methodology</a> and the "
             "<a href=\"{g}\">glossary</a>.").format(m=x.u("/metodologia/"), g=x.u("/glossario/"))


H_CITAR = "How to cite this page"


def citacao_mun(m, v):
    return H('{autor}. <em>{orig}</em> [{site}]: {nome}/{uf}. Data from the 2022 Demographic '
             'Census (IBGE). Data version: {versao}. Available at: {url}. Dataset DOI: '
             '<a href="{doi}">{doi}</a>.').format(
        autor=v["autor"], orig=TITULO_ORIGINAL, site=NOME_SITE, nome=m["nome"], uf=m["uf_sigla"],
        versao=v["versao"], url=v["canonical"], doi=v["doi_url"])


# ============================== unit pages (UF / RGI / RGInt) ==============================
NIVEL = {
    "uf": {"rot": "State (UF)", "mesma": "of the same state", "pai": "UFs"},
    "rgi": {"rot": "Immediate region", "mesma": "of the same immediate region",
            "pai": "Immediate regions"},
    "rgint": {"rot": "Intermediate region", "mesma": "of the same intermediate region",
              "pai": "Intermediate regions"},
}


def titulo_unidade(nome: str) -> str:
    return f"Migration in {nome} (2017–2022)"


def titulo_unidade_curto(nome: str) -> str:
    return f"Migration in {nome}"


def descricao_unidade(nome: str) -> str:
    return (f"Net migration and main flows of {nome} between 2017 and 2022, from IBGE's 2022 "
            f"Demographic Census.")


def abertura_unidade(x, u):
    return H("{rot} with {n} municipalities and a reference population of {pop5} people. In the "
             "2017–2022 five-year period, the unit received {imig} in-migrants and lost {emig} "
             "out-migrants coming from or going to places outside its borders, a net migration of "
             "{saldo} ({tlm} per 1,000 population).").format(
        rot=NIVEL[u["nivel"]]["rot"], n=u["n_municipios"], pop5=x.i(u["pop5"]), imig=x.i(u["imig"]),
        emig=x.i(u["emig"]), saldo=x.s(u["saldo"]),
        tlm=x.d(u["tlm"], 2) if u["tlm"] is not None else SEM_ESTIMATIVA)


def nota_unidade(u):
    return ("Migration between municipalities " + NIVEL[u["nivel"]]["mesma"] + " is not counted "
            "here; only the flows that cross the unit's border are. The indicators on this page "
            "are direct sums of the published municipal flows (excluding the pairs suppressed by "
            "disclosure control), not a new sample estimate: that is why there is no standard "
            "error or confidence interval at this aggregation level.")


CAP_ORIGENS_UNID = "Top 10 origins of in-migrants"
CAP_DESTINOS_UNID = "Top 10 destinations of out-migrants"
SEM_FLUXO_UNID = "No flows published individually."
TH_MUNICIPIO, TH_SALDO = "Municipality", "Net migration"


def h_municipios_de(nome: str) -> str:
    return f"Municipalities of {nome}"


def cap_municipios_unid(n: int) -> str:
    return f"{n} municipalities, with net migration 2017–2022"


def cta_unidade(nome: str) -> str:
    return f"Open {nome} in the interactive atlas →"


# ============================== metropolitan region pages ==============================
TIPO_RM = {"RIDE": "Integrated Economic Development Region (RIDE)", "RM": "Metropolitan region (RM)"}


def titulo_rm(nome: str) -> str:
    return f"Migration in {nome} (2017–2022)"


def titulo_rm_curto(nome: str) -> str:
    return f"Migration in {nome}"


def descricao_rm(nome: str) -> str:
    return (f"Intra-metropolitan migration, commuting and core × periphery of {nome} between "
            f"2017 and 2022, 2022 Census (IBGE).")


def abertura_rm(x, r):
    return H("{tipo} made up of {n} municipalities, with its core in {nucleo} and a reference "
             "population of {pop} people. In the 2017–2022 five-year period there were {intra} "
             "migrations within the region itself (among its municipalities) and an external net "
             "migration (with the rest of the country) of {saldo}.").format(
        tipo=r["tipo_extenso"], n=r["n_municipios"], nucleo=r["nm_nucleo"], pop=x.i(r["pop_total"]),
        intra=x.i(r["mig_intra"]), saldo=x.s(r["saldo_externo"]))


H_MATRIZ = "Core × periphery matrix (intra-metropolitan migration)"
RM_MATRIZ = {
    "np": "Core → periphery", "pn": "Periphery → core", "pp": "Periphery → periphery",
    "ent": "External inflows (rest of the country)", "sai": "External outflows (rest of the country)",
}
H_TOP_INTRA = "Top 10 intra-RM migration flows"
TH_TIPOLOGIA = "Flow type"
SEM_FLUXO_INTRA = "No intra-RM flows published individually."
H_PENDULAR_RM = "Commuting"
RM_PEND = {
    "ocupados": "Employed persons in the region",
    "pendulares": "Commuters (work outside their municipality of residence)",
    "pct_pendular": "% of commuters among employed persons",
    "tempo_mediano": "Median commuting time",
    "pct_coletivo": "% using public transport",
}
H_MIGRANTES_TRABALHO = "Migrants and work"
NOTA_MIGRANTES_TRABALHO = ("Sum over the region's municipalities (rm_mig_pendular_resumo): among those "
                           "who migrated within their own metropolitan region and were employed, "
                           "where they went to work.")
RM_MP = {
    "migrantes_intra": "Intra-RM migrants",
    "mig_ocupados": "... employed",
    "mig_pendulares": "... commuting (work outside where they moved to)",
    "pendular_para_origem": "... going back to work in the origin municipality they left",
    "pendular_para_nucleo": "... now working in the core",
    "trabalha_onde_mora": "... working where they now live",
}


def h_municipios_da_rm(nome: str) -> str:
    return f"Municipalities of {nome}"


TH_NUCLEO, TH_SALDO_MIG, SIM = "Core", "Net migration", "Yes"


def cta_rm(nome: str) -> str:
    return f"Open {nome} in the interactive atlas →"


# ============================== indexes ==============================
def indice_municipios(x, n_munic: int):
    return {
        "titulo": "Municipalities in the atlas, by state (UF)",
        "descricao": f"List of the {x.i(n_munic)} Brazilian municipalities with published "
                     f"internal-migration data, grouped by UF.",
        "intro": H('<p>The {n} Brazilian municipalities published in the atlas, grouped by UF (the 26 '
                   'states and the Federal District). See also the <a href="{u}">list of UFs</a> and '
                   'the <a href="{r}">metropolitan regions</a>.</p>').format(
            n=x.i(n_munic), u=x.u("/ufs/"), r=x.u("/regioes-metropolitanas/")),
    }


def pagina_da_uf(href: str):
    return H('<a href="{h}">UF page</a>').format(h=href)


def n_municipios(n: int) -> str:
    return f"{n} municipalities"


def indice_ufs(x):
    return {
        "titulo": "States and Federal District (UF)",
        "descricao": "The 27 Brazilian Federation Units (UF) with aggregate internal-migration indicators, 2022 Census.",
        "intro": H("<p>The 27 Federation Units (UF: the 26 states and the Federal District) with "
                   "aggregate internal-migration indicators.</p>"),
    }


def indice_rms(x):
    return {
        "titulo": "Metropolitan regions and RIDEs",
        "descricao": "The 81 metropolitan regions (RM) and Integrated Economic Development Regions (RIDE) of Brazil, with intra-metropolitan migration and commuting, 2022 Census.",
        "intro": H("<p>The 81 metropolitan regions (RM) and Integrated Economic Development Regions "
                   "(RIDE) of Brazil, with the intra-metropolitan migration and commuting module.</p>"),
    }


def rm_item_extra(tipo: str, n: int) -> str:
    return f"({tipo}, {n} municipalities)"


def indice_regioes(x):
    return {
        "titulo": "Immediate and intermediate regions",
        "descricao": "The 510 immediate regions (RGI) and 133 intermediate regions (RGInt) defined by IBGE, with aggregate internal-migration indicators, 2022 Census.",
        "intro": H("<p>510 immediate regions (RGI) and 133 intermediate regions (RGInt), the IBGE "
                   "territorial division, with aggregate internal-migration indicators.</p>"),
        "h_rgi": "Immediate regions", "h_rgint": "Intermediate regions",
    }


# ============================== findings ==============================
TH_FLUXO = "Flow"
VER_NO_ATLAS = "see in the atlas"


def corpo_achados(x, v):
    return H("""
<p>Three key findings of the research, already validated in the methodology (see the <a href="{met}">methodology</a>
and <code>docs/qa/F2b_relatorio.md</code>), and the largest published net migration figures and flows.</p>

<section class="secao achado">
<h2>Residential deconcentration without productive deconcentration</h2>
<p>Among employed people who moved from the metropolitan core to the periphery between 2017 and 2022,
<strong>{p1}</strong> still work in the core: housing moved, jobs did not.
In the Federal District RIDE, this share reaches <strong>{p2}</strong>.
<a href="{ride}">See the RIDE-DF &rarr;</a></p>
</section>

<section class="secao achado">
<h2>Educational selectivity in the Rio de Janeiro &rarr; São Paulo flow</h2>
<p>Among migrants aged 25 and over who left Rio de Janeiro for São Paulo,
<strong>{p3}</strong> have completed higher education, a marked educational selectivity.
<a href="{app_rj_sp}">See the flow in the atlas &rarr;</a></p>
</section>

<section class="secao achado">
<h2>The country's largest commuting pair</h2>
<p>Guarulhos &rarr; São Paulo is Brazil's largest work-commuting pair:
<strong>{n_pend} people</strong> live in Guarulhos and work in São Paulo.
<a href="{app_pend}">See the commuting pair &rarr;</a></p>
</section>

<section class="secao">
<h2>{milhoes} million people changed municipality</h2>
<p>In the 2017–2022 five-year period, {milhoes} million people migrated among the {n_mun} Brazilian
municipalities, resulting in {n_pares} published origin–destination pairs after disclosure control.</p>
</section>

<section class="secao">
<h2>10 largest positive net migration figures</h2>
{tbl_pos}
</section>

<section class="secao">
<h2>10 largest negative net migration figures</h2>
{tbl_neg}
</section>

<section class="secao">
<h2>10 largest migration flows in the country</h2>
{tbl_fluxos}
</section>
""").format(
        met=x.u("/metodologia/"), p1=x.pct(46.5), p2=x.pct(59.3), ride=v["link_ride"],
        app_rj_sp=x.app("o=3304557&d=3550308"), p3=x.pct(75.1), n_pend=x.i(77500),
        app_pend=x.app("rm=4901&aba=trab&o=3518800&d=3550308"), milhoes=x.d(12.9, 1),
        n_mun=x.i(5570), n_pares=x.i(53097), tbl_pos=v["tbl_pos"], tbl_neg=v["tbl_neg"],
        tbl_fluxos=v["tbl_fluxos"])


ACHADOS_TITULO = "Main findings of the atlas"
ACHADOS_DESCRICAO = ("The main internal-migration findings of the 2022 Census: metropolitan "
                     "deconcentration, educational selectivity, the largest commuting pair, and the "
                     "largest net migration figures and flows.")


# ============================== methodology ==============================
METODOLOGIA_TITULO = "Methodology of the atlas"
METODOLOGIA_DESCRICAO = ("Source, definitions, indicator formulas and disclosure-control rules of the "
                         "Atlas of internal migration in Brazil, 2022 Census.")


def corpo_metodologia(x, v):
    r = v["r"]
    return H("""
<p>Static version of the interactive atlas's methodology page. See also the
<a href="{glos}">glossary</a> and the full document <code>docs/METODOLOGIA.md</code>
in the project repository (in Portuguese).</p>

<section class="secao"><h2>Source and universe</h2>
<p>The data come from IBGE's 2022 Demographic Census (IBGE is the Brazilian Institute of Geography
and Statistics), sample microdata (controlled access), migration question (internal and international
migration). The universe is the population aged 5 and over resident in 2022.</p></section>

<section class="secao"><h2>Fixed-date migrant</h2>
<p>The municipality of residence on July 31, 2017 is compared with that on July 31, 2022. An internal
migrant is someone who lived in another Brazilian municipality in 2017; an international migrant,
someone who lived in another country; a non-migrant, someone who already lived in the same
municipality (or has lived there for 6 years or more).</p></section>

<section class="secao"><h2>Indicators</h2>
<dl>
<dt>Net migration</dt><dd>In-migrants minus out-migrants.</dd>
<dt>Net migration rate (TLM)</dt><dd>(Net migration / reference population) &times; 1,000, per 1,000 population.</dd>
<dt>Migration effectiveness index (IEM)</dt><dd>Net migration / (in-migrants + out-migrants), between &minus;1 and 1.</dd>
</dl></section>

<section class="secao"><h2>Precision of the estimates</h2>
<p>Every count comes from a sample and carries sampling error. Each published estimate gets a
precision band based on the coefficient of variation (CV): <strong>good</strong> (CV up to {cv_boa}%),
<strong>use with caution</strong> (CV between {cv_boa}% and {cv_cautela}%), <strong>low
precision</strong> (CV above {cv_cautela}%).</p></section>

<section class="secao"><h2>Disclosure control</h2>
<p>Before publication, an automatic gate (rules R1–R9) prevents any cell from identifying
anyone: no flow or category with fewer than {min_pessoas} people (weighted estimate) or
{min_dom} sampled households; breakdowns by characteristic only for flows with at least
{min_det} sample observations; every weighted count rounded to multiples of {arred}; no exact
sample count published, only ranges.</p></section>

<section class="secao"><h2>Aggregation levels</h2>
<p>Besides the municipality, the atlas aggregates to immediate region, intermediate region and UF
(state). At these levels, migration between municipalities of the same unit is not counted,
suppressed pairs are left out of the sum, and no standard error is published.</p></section>

<section class="secao"><h2>Limitations</h2>
<ul>
<li>Fixed-date migration does not capture multiple moves within the five-year period.</li>
<li>Results may differ from IBGE's official tabulations (SIDRA).</li>
<li>Sampling error is estimated with a conservative cluster estimator (household as the primary
sampling unit, weighting area as the stratum).</li>
</ul></section>

<section class="secao"><h2>How to cite</h2>
<p>{autor}. <em>Atlas da migração interna no Brasil</em> [Atlas of internal migration in Brazil].
Data from the 2022 Demographic Census (IBGE). DOI: <a href="https://doi.org/{doi_c}">{doi_c}</a>
(all versions) / <a href="https://doi.org/{doi_v}">{doi_v}</a> (v2.1.0).</p>
<p>Data and content under <a href="{lic}">CC BY 4.0</a>, with attribution to IBGE
as the primary source. Structured metadata in
<a href="{repo}/blob/main/CITATION.cff">CITATION.cff</a>.</p>
</section>

<section class="secao"><h2>Standard notice</h2><p class="aviso">{aviso}</p></section>
""").format(
        glos=x.u("/glossario/"), cv_boa=x.num_cru(r["cv_boa"]), cv_cautela=x.num_cru(r["cv_cautela"]),
        min_pessoas=r["min_pessoas"], min_dom=r["min_domicilios"], min_det=r["min_pessoas_detalhe"],
        arred=r["arredondamento"], autor=v["autor"], doi_c=v["doi_conceito"], doi_v=v["doi_versao"],
        lic=v["licenca_url"], repo=v["repo"], aviso=v["aviso"])


# ============================== glossary ==============================
GLOSSARIO_TITULO = "Glossary of the atlas"
GLOSSARIO_DESCRICAO = ("Definitions of the terms used in the Atlas of internal migration: net migration, net "
                       "migration rate, IEM, return migration, commuting, precision and disclosure control.")
GLOS_UI = {"oQueE": "What it is", "comoInterpretar": "How to interpret", "limitacoes": "Limitations"}


def glossario_intro(x, n: int):
    return H('<p>{n} terms used in the atlas, each with its definition, how to interpret it and its '
             'limitations. See also the <a href="{m}">methodology</a>.</p>').format(
        n=n, m=x.u("/metodologia/"))


# ============================== data ==============================
DADOS_TITULO = "Published data of the atlas"
DADOS_DESCRICAO = ("Dictionary of the Parquet tables published by the Atlas of internal migration, with "
                   "license and how to cite the 2022 Census data.")
DADOS_TABELAS = [
    ("municipios.parquet", "Municipal indicators: population, in-migrants, out-migrants, net migration, rates, IEM, precision."),
    ("municipios_dim.parquet", "Profile of migrants and residents by municipality: migrant type, educational attainment, income, age and sex."),
    ("municipios_pendular.parquet", "Commuting indicators by municipality."),
    ("fluxos.parquet", "Municipality-to-municipality migration flow matrix, with breakdowns by profile."),
    ("fluxos_uf.parquet", "Migration flows between UFs."),
    ("fluxos_rgi.parquet", "Migration flows between immediate regions."),
    ("fluxos_rgint.parquet", "Migration flows between intermediate regions."),
    ("pendular_trab.parquet", "Commuting flows to work, municipality to municipality."),
    ("pendular_estudo.parquet", "Commuting flows to school, municipality to municipality."),
    ("rm.parquet", "Municipal composition of the metropolitan regions and RIDEs."),
    ("rm_resumo.parquet", "Aggregate indicators by metropolitan region/RIDE."),
    ("rm_fluxos_intra.parquet", "Migration flows internal to each metropolitan region."),
    ("rm_mig_pendular_resumo.parquet", "Intra-metropolitan migration × work cross-tabulation, by municipality."),
    ("municipios_ref.parquet", "Public territorial reference (meso/microregion, RGI, RGInt, RM, urban concentration)."),
]
DADOS_BC = "Published data"
DATASET = {
    "name_suffix": "published data",
    "isBasedOn": "2022 Demographic Census -- IBGE",
    "orgIBGE": "Brazilian Institute of Geography and Statistics (IBGE)",
    "keywords": ["internal migration", "2022 Census", "IBGE", "demography", "Brazilian municipalities"],
    "variableMeasured": ["in-migrants", "out-migrants", "net migration", "net migration rate",
                         "migration effectiveness index", "commuting"],
}


def corpo_dados(x, v):
    return H("""
<p>All the tables below have passed statistical disclosure control (R1–R9): small cells
suppressed, values rounded to multiples of {arred}, sample counts only in ranges. Format: Apache Parquet.</p>

<section class="secao"><h2>Summary dictionary</h2>
<table><thead><tr><th scope="col">File</th><th scope="col">Content</th></tr></thead>
<tbody>{linhas}</tbody></table></section>

<section class="secao"><h2>License</h2>
<p>The aggregate data published here (Parquet tables, static pages and text content of the atlas)
are under the <a href="{lic_url}">{lic_nome}</a> license, with mandatory attribution to IBGE
as the primary source. The project's source code is under the {lic_cod} license
(GitHub repository). The original 2022 Census microdata are controlled-access IBGE data and are
NOT included in this site or in the repository: they remain subject to IBGE's terms of
use. The aggregate, rounded tables published here have passed statistical disclosure
control and do not allow individual re-identification.</p></section>

<section class="secao"><h2>How to cite</h2>
<p class="citacao">{autor}. <em>{orig}</em> [{site}]. Data from the 2022 Demographic Census
(IBGE). Data version: {versao}. DOI: {doi}. Available at: {url_home}.</p>
<p class="nota">{atrib}</p></section>

<section class="secao"><h2>Source and notice</h2>
<p>Source: {fonte}.</p>
<p class="aviso">{aviso}</p></section>
""").format(
        arred=v["arred"], linhas=v["linhas"], lic_url=v["licenca_url"], lic_nome=v["licenca_nome"],
        lic_cod=v["licenca_codigo"], autor=v["autor"], orig=TITULO_ORIGINAL, site=NOME_SITE,
        versao=v["versao"], doi=v["doi"], url_home=v["url_home"], atrib=ATRIBUICAO_PADRAO,
        fonte=v["fonte"], aviso=v["aviso"])


# ============================== about ==============================
SOBRE_TITULO = "About the project"
SOBRE_DESCRICAO = ("What the Atlas of internal migration in Brazil is, who made it, and the policy on "
                   "the use of the 2022 Census microdata.")


def corpo_sobre(x, v):
    return H("""
<p>The Atlas of internal migration in Brazil brings together, in a single navigable panel, the
internal migration flows, commuting and the metropolitan module of IBGE's 2022 Demographic Census,
at the level of municipality, immediate region, intermediate region and UF.</p>

<section class="secao"><h2>Who made it</h2>
<p>{autor} (GitHub: <a href="{gh_url}">@{gh_user}</a>).
Institutional affiliation: {vinculo}.</p></section>

<section class="secao"><h2>Microdata use policy</h2>
<p>The sample microdata of the 2022 Demographic Census used in this project are controlled-access
IBGE data. No individual record is published: every table available at
<a href="{dados}">/dados/</a> passed an automatic statistical disclosure control gate
(suppression of small cells, rounding, sample-count ranges) before leaving the
controlled environment.</p></section>

<section class="secao"><h2>Licenses</h2>
<p>Aggregate data and text content under <a href="{lic_url}">{lic_nome}</a>,
with mandatory attribution to IBGE as the primary source; source code under the
{lic_cod} license. See <a href="{dados}">/dados/</a> for details.</p></section>

<section class="secao"><h2>Contact</h2>
<p>For questions, corrections or error reports, open an <em>issue</em> in the
<a href="{repo}">project's GitHub repository</a> or write to the author's public
contact e-mail, {email}.</p></section>
""").format(
        autor=v["autor"], gh_url=v["github_url"], gh_user=v["github_user"], vinculo=v["vinculo"],
        dados=x.u("/dados/"), lic_url=v["licenca_url"], lic_nome=v["licenca_nome"],
        lic_cod=v["licenca_codigo"], repo=v["repo"], email=v["email"])


# ============================== static home of the language ==============================
HOME_TITULO = "Atlas of internal migration in Brazil"
HOME_DESCRICAO = ("Internal migration flows between Brazilian municipalities, 2017–2022, from the "
                  "2022 Demographic Census (IBGE).")


def corpo_home(x, v):
    return H("""
<p>The Atlas of internal migration in Brazil maps where people moved between July 31, 2017 and
July 31, 2022, using the internal-migration question from the sample microdata of Brazil's 2022
Demographic Census (controlled-access data from IBGE, the Brazilian Institute of Geography and
Statistics).</p>

<p class="cta"><a href="{app}">Open the interactive atlas &rarr;</a></p>

<section class="secao"><h2>Explore by territory</h2>
<ul>
<li><a href="{mun}">Municipalities</a>: {n_mun} pages, one per municipality.</li>
<li><a href="{uf}">States and Federal District (UF)</a>.</li>
<li><a href="{reg}">Immediate and intermediate regions</a>.</li>
<li><a href="{rm}">Metropolitan regions and RIDEs</a>.</li>
</ul></section>

<section class="secao"><h2>Source</h2>
<p>IBGE, 2022 Demographic Census, sample microdata (controlled access), fixed-date migration
question (residence on July 31, 2017 compared with residence on July 31, 2022).</p></section>

<section class="secao"><h2>Key findings</h2>
<ul>
<li>{milhoes} million people changed municipality of residence in the five-year period, across
{n_mun} Brazilian municipalities, yielding {n_pares} published origin–destination pairs.</li>
<li>Among people who left a metropolitan core for its periphery, {p1} still work in the
core: residential deconcentration without a matching shift in jobs; in the Federal District
integrated region (RIDE-DF) that share reaches {p2}.</li>
<li>Among migrants aged 25 and over from Rio de Janeiro to São Paulo, {p3} have completed higher
education, a marked educational selectivity.</li>
<li>Guarulhos &rarr; São Paulo is the country's largest commuting pair: {n_pend} people live in
Guarulhos and work in São Paulo.</li>
</ul>
<p><a href="{ach}">See all findings</a> &middot; <a href="{met}">Methodology</a> &middot;
<a href="{glos}">Glossary</a> &middot; <a href="{dados}">Data</a></p></section>

<p>Every published figure was rounded and passed through a statistical disclosure-control gate
(small-cell suppression, rounding, sample-size ranges) before leaving the controlled-access
environment: no individual record is ever published.</p>
""").format(
        app=x.app(""), mun=x.u("/municipios/"), uf=x.u("/ufs/"), reg=x.u("/regioes/"),
        rm=x.u("/regioes-metropolitanas/"), n_mun=x.i(5570), milhoes=x.d(12.9, 1),
        n_pares=x.i(53097), p1=x.pct(46.5), p2=x.pct(59.3), p3=x.pct(75.1), n_pend=x.i(77500),
        ach=x.u("/achados/"), met=x.u("/metodologia/"), glos=x.u("/glossario/"), dados=x.u("/dados/"))


# ============================== 404 ==============================
E404_TITULO = "Page not found"
E404_DESCRICAO = "The page you are looking for does not exist in the Atlas of internal migration. See the indexes of municipalities, UFs and regions."


def corpo_404(x):
    return H('<p>Page not found. Use the interactive atlas search or one of the indexes below:</p>'
             '<ul><li><a href="{mun}">Municipalities</a></li>'
             '<li><a href="{rm}">Metropolitan regions</a></li>'
             '<li><a href="{uf}">UFs</a></li><li><a href="{reg}">Regions</a></li>'
             '<li><a href="{home}">Back to the home page</a></li></ul>').format(
        mun=x.u("/municipios/"), rm=x.u("/regioes-metropolitanas/"), uf=x.u("/ufs/"),
        reg=x.u("/regioes/"), home=x.u("/"))
