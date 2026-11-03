"""Catálogo en español de las páginas estáticas de SEO (español neutro, números `es-ES`).

Traducción de la referencia en portugués (`pt.py`), según `web/src/i18n/TERMINOLOGIA.md`:
*inmigrantes / emigrantes* (uso de la CELADE también para la migración interna), *saldo
migratorio*, *expulsión* para «evasão», *movilidad pendular* (nunca *migración pendular*),
*suprimido*. Agrupación de miles también con 4 dígitos (1.234); espacio duro antes de «%»."""
from __future__ import annotations

from . import H

LANG = "es"

# ============================== identidad del sitio ==============================
NOME_SITE = "Atlas de la migración interna en Brasil"
TITULO_ORIGINAL = "Atlas da migração interna no Brasil"  # título conservado en el original en las citas
DESCRICAO_SITE = ("Saldos y flujos migratorios entre los municipios brasileños en el quinquenio "
                  "2017–2022, a partir de los microdatos de la muestra del Censo Demográfico 2022 "
                  "del IBGE.")
ATRIBUICAO_PADRAO = (
    "Fuente primaria: IBGE, Censo Demográfico 2022, microdatos de la muestra (acceso controlado). "
    "Estimaciones: Daniel Pessini Sobreira, Atlas da migração interna no Brasil."
)
PAIS = "Brasil"
AVISO_TRADUCAO = (
    "Esta es una traducción del original en portugués, que es la versión de referencia. En caso de "
    "discrepancia, prevalece el texto en portugués; las estimaciones, las salvedades y los avisos "
    "del IBGE rigen en su redacción original."
)

SEM_ESTIMATIVA = "sin estimación"
SEP_INTERVALO = "a"
NAO_INFORMADO = "no informado"

OG_LINHAS = ("Atlas de la migración", "interna en Brasil")
OG_SUB = "Censo 2022 · IBGE · 2017–2022"

ROTULO_PRECISAO = {
    "boa": "buena", "cautela": "usar con cautela", "baixa": "baja precisión",
    "sem_estimativa": "sin estimación",
}
TIPOLOGIA_ROTULO = {
    "nucleo_periferia": "Núcleo → periferia",
    "periferia_nucleo": "Periferia → núcleo",
    "periferia_periferia": "Periferia → periferia",
}
CLASSIFICACAO = {"equilibrio": "equilibrio", "atracao": "atracción", "evasao": "expulsión"}

ROTULOS = {
    "status": {
        "retorno_natal": "Retorno al municipio natal",
        "primeira_saida": "Primera salida del municipio natal",
        "etapas_multiplas": "Migración por etapas múltiples",
        "nao_natural": "No nació en el municipio ni en el exterior",
        "nascido_exterior": "Nacido en el exterior, migrante interno",
        "internacional_brasileiro": "Retorno del exterior (brasileño)",
        "internacional_estrangeiro": "Inmigración internacional (extranjero)",
        "origem_nao_informada": "Origen no declarado",
        "outros": "Otros / suprimido",
    },
    "edu": {
        "sem_instr_fund_incompleto": "Sin instrucción o básica incompleta",
        "fund_completo_medio_incompleto": "Básica completa, media incompleta",
        "medio_completo_superior_incompleto": "Media completa, superior incompleta",
        "superior_completo": "Superior completa",
        "nao_determinado": "No determinado",
        "outros": "Otros / suprimido",
    },
    "renda": {
        "ate_1_4_sm": "Hasta ¼ de salario mínimo",
        "de_1_4_a_1_2_sm": "De ¼ a ½ salario mínimo",
        "de_1_2_a_1_sm": "De ½ a 1 salario mínimo",
        "de_1_a_2_sm": "De 1 a 2 salarios mínimos",
        "mais_de_2_sm": "Más de 2 salarios mínimos",
        "nao_aplicavel": "No aplica (vivienda colectiva)",
        "outros": "Otros / suprimido",
    },
    "idade_sexo": {
        "05_14_M": "5 a 14 años, hombres", "05_14_F": "5 a 14 años, mujeres",
        "15_24_M": "15 a 24 años, hombres", "15_24_F": "15 a 24 años, mujeres",
        "25_39_M": "25 a 39 años, hombres", "25_39_F": "25 a 39 años, mujeres",
        "40_59_M": "40 a 59 años, hombres", "40_59_F": "40 a 59 años, mujeres",
        "60_mais_M": "60 años o más, hombres", "60_mais_F": "60 años o más, mujeres",
        "outros": "Otros / suprimido",
    },
}
FAIXAS_IDADE = {"05_14": "5 a 14 años", "15_24": "15 a 24 años", "25_39": "25 a 39 años",
                "40_59": "40 a 59 años", "60_mais": "60 años o más"}


def idade_indeterminado(faixa: str) -> str:
    return f"{FAIXAS_IDADE[faixa]}, sexo no determinado"


# ============================== marco (_BASE) ==============================
PULAR = "Saltar al contenido"
SUB_MARCA = "Censo 2022 · 2017–2022"
ARIA_NAV = "Navegación principal"
ARIA_MIGALHAS = "Ruta de navegación"
ARIA_IDIOMA = "Idioma"
NAV = {
    "municipios": "Municipios", "rms": "RM", "ufs": "UF", "regioes": "Regiones",
    "achados": "Hallazgos", "metodologia": "Metodología", "glossario": "Glosario",
    "dados": "Datos", "abrir": "Abrir el atlas interactivo →",
    "rms_extenso": "Regiones metropolitanas",
}


def rodape(x, fonte: str, versao: str):
    return H('Fuente: {fonte}. Versión de los datos: {versao}. <a href="{m}">Metodología</a> '
             '&middot; <a href="{d}">Datos</a> &middot; <a href="{s}">Acerca de</a>').format(
        fonte=fonte, versao=versao, m=x.u("/metodologia/"), d=x.u("/dados/"), s=x.u("/sobre/"))


# ============================== página de municipio ==============================
def titulo_mun(nome_uf: str) -> str:
    return f"Migración en {nome_uf} (2017–2022)"


def titulo_mun_curto(nome_uf: str) -> str:
    return f"Migración en {nome_uf}"


def descricao_mun(nome_uf: str) -> str:
    return (f"Saldo migratorio, inmigrantes, emigrantes y perfil de los migrantes de {nome_uf} "
            f"entre 2017 y 2022, a partir del Censo 2022 del IBGE.")


def abertura_mun(x, m):
    extra = ""
    if m["imig_ni"] or m["imig_int"]:
        extra = H(" Además, {ni} llegaron con origen no declarado y {inte} vinieron del "
                  "exterior.").format(ni=x.i(m["imig_ni"]), inte=x.i(m["imig_int"]))
    return H("{nome}/{uf} tenía una población de referencia (5 años o más en 2022) de {pop5} "
             "personas. En el quinquenio 2017–2022, el municipio recibió {imig} inmigrantes y "
             "perdió {emig} emigrantes hacia otros municipios de Brasil, con un saldo migratorio de "
             "{saldo} personas ({tlm} por cada 1.000 habitantes) y un índice de eficacia migratoria "
             "(IEM) de {iem}. Esto clasifica al municipio, en el período, como de "
             "<strong>{cls}</strong> migratoria.{extra}").format(
        nome=m["nome"], uf=m["uf_sigla"], pop5=x.i(m["pop5"]), imig=x.i(m["imig"]),
        emig=x.i(m["emig"]), saldo=x.s(m["saldo"]), tlm=x.d(m["tlm"], 2),
        iem=x.d(m["iem"], 3) if m["iem"] is not None else SEM_ESTIMATIVA,
        cls=CLASSIFICACAO[m["classificacao"]], extra=extra)


def h1_mun(m) -> str:
    return f"Migración en {m['nome']}/{m['uf_sigla']} (2017–2022)"


H_INDICADORES = "Indicadores"
TH_INDICADOR, TH_ESTIMATIVA, TH_IC, TH_PRECISAO = "Indicador", "Estimación", "IC 95 %", "Precisión"
L_IMIGRANTES, L_EMIGRANTES, L_SALDO = "Inmigrantes", "Emigrantes", "Saldo migratorio"
L_TLM = "Tasa neta de migración, TLM (por 1.000 hab.)"
L_IEM = "Índice de eficacia migratoria (IEM)"
SEM_CLASSIFICACAO = "sin clasificación"


def cap_indicadores(m) -> str:
    return f"Indicadores migratorios de {m['nome']}/{m['uf_sigla']}, 2017–2022"


def nota_amostra(m):
    return H("Muestra de inmigrantes: {a} observaciones. Muestra de emigrantes: {b} observaciones. "
             "Intervalo de confianza del 95 % calculado como estimación &plusmn; 1,96 &times; "
             "error estándar.").format(a=m["n_imig_faixa"], b=m["n_emig_faixa"])


H_ORIGENS_DESTINOS = "Principales orígenes y destinos"
TH_ORIGEM, TH_DESTINO, TH_PESSOAS = "Origen", "Destino", "Personas"
VER_PAR = "ver el par en el atlas"


def cap_origens(m) -> str:
    return f"10 principales orígenes de los inmigrantes de {m['nome']}/{m['uf_sigla']}"


def cap_destinos(m) -> str:
    return f"10 principales destinos de los emigrantes de {m['nome']}/{m['uf_sigla']}"


SEM_FLUXO_ENTRADA = "Sin flujos de entrada publicados individualmente (por debajo del umbral de divulgación)."
SEM_FLUXO_SAIDA = "Sin flujos de salida publicados individualmente (por debajo del umbral de divulgación)."

H_PERFIL = "Perfil de los migrantes y de los residentes"
TH_CATEGORIA, TH_PARTICIPACAO, TH_AMOSTRA = "Categoría", "Participación", "Muestra"
DIRECOES = [("imig", "Inmigrantes (llegadas)"), ("emig", "Emigrantes (salidas)"),
            ("residente", "Residentes no migrantes")]
PERFIL_TITULOS = {
    "status": ("Tipo de migrante", None),
    "edu": ("Nivel educativo", "personas de 25 años o más"),
    "renda": ("Ingreso del hogar per cápita", "en salarios mínimos de 2022"),
    "idade_sexo": ("Edad y sexo", None),
}


def sem_perfil(titulo: str) -> str:
    return f"{titulo}: sin estimación publicada para esta desagregación."


H_PENDULAR_MUN = "Movilidad pendular (trabajo y estudio)"


def cap_pendular(m) -> str:
    return f"Indicadores de movilidad pendular de {m['nome']}/{m['uf_sigla']}"


PEND = {
    "ocupados": "Personas ocupadas (10 años o más)",
    "saida_trab": "Salen a trabajar a otro municipio",
    "entrada_trab": "Vienen de otro municipio a trabajar aquí",
    "saldo": "Saldo pendular",
    "taxa_saida": "Tasa de salida pendular (%)",
    "atracao": "Índice de atracción pendular",
    "tempo_mediano": "Tiempo mediano de desplazamiento",
}
MIN = "min"
SEM_PEND = "Sin estimación pendular publicada para este municipio."


def link_rm(x, m, href: str):
    return H('<a href="{h}">Este municipio forma parte de {rm} &rarr; ver la página de la región '
             'metropolitana</a>').format(h=href, rm=m["nm_rm"])


def cta_mun(m) -> str:
    return f"Abrir {m['nome']}/{m['uf_sigla']} en el atlas interactivo →"


H_NOTA_MET = "Nota metodológica"


def nota_metodologica(x):
    return H("Estimaciones a partir de los microdatos de la muestra del Censo Demográfico 2022 "
             "(IBGE, acceso controlado), pregunta de migración de fecha fija (residencia el 31 de "
             "julio de 2017 comparada con la del 31 de julio de 2022). Toda estimación está "
             "redondeada a múltiplos de 5 y pasó por el control de divulgación estadística (ninguna "
             "celda con menos de 5 personas o 3 hogares muestreados). Ver la "
             "<a href=\"{m}\">metodología completa</a> y el <a href=\"{g}\">glosario</a>.").format(
        m=x.u("/metodologia/"), g=x.u("/glossario/"))


H_CITAR = "Cómo citar esta página"


def citacao_mun(m, v):
    return H('{autor}. <em>{orig}</em> [{site}]: {nome}/{uf}. Datos del Censo Demográfico 2022 '
             '(IBGE). Versión de los datos: {versao}. Disponible en: {url}. DOI del conjunto de '
             'datos: <a href="{doi}">{doi}</a>.').format(
        autor=v["autor"], orig=TITULO_ORIGINAL, site=NOME_SITE, nome=m["nome"], uf=m["uf_sigla"],
        versao=v["versao"], url=v["canonical"], doi=v["doi_url"])


# ============================== páginas de unidad (UF / RGI / RGInt) ==============================
NIVEL = {
    "uf": {"rot": "Estado (UF)", "mesma": "del mismo estado", "pai": "UF"},
    "rgi": {"rot": "Región inmediata", "mesma": "de la misma región inmediata",
            "pai": "Regiones inmediatas"},
    "rgint": {"rot": "Región intermedia", "mesma": "de la misma región intermedia",
              "pai": "Regiones intermedias"},
}


def titulo_unidade(nome: str) -> str:
    return f"Migración en {nome} (2017–2022)"


def titulo_unidade_curto(nome: str) -> str:
    return f"Migración en {nome}"


def descricao_unidade(nome: str) -> str:
    return (f"Saldo migratorio y principales flujos de {nome} entre 2017 y 2022, a partir del "
            f"Censo Demográfico 2022 del IBGE.")


def abertura_unidade(x, u):
    return H("{rot} con {n} municipios y una población de referencia de {pop5} personas. En el "
             "quinquenio 2017–2022, la unidad recibió {imig} inmigrantes y perdió {emig} emigrantes "
             "provenientes de o con destino a fuera de sus límites, un saldo de {saldo} "
             "({tlm} por cada 1.000 habitantes).").format(
        rot=NIVEL[u["nivel"]]["rot"], n=u["n_municipios"], pop5=x.i(u["pop5"]), imig=x.i(u["imig"]),
        emig=x.i(u["emig"]), saldo=x.s(u["saldo"]),
        tlm=x.d(u["tlm"], 2) if u["tlm"] is not None else SEM_ESTIMATIVA)


def nota_unidade(u):
    return ("La migración entre municipios " + NIVEL[u["nivel"]]["mesma"] + " no se contabiliza "
            "aquí: solo se cuentan los flujos que cruzan el límite de la unidad. Los indicadores de "
            "esta página son sumas directas de los flujos municipales publicados (excluidos los "
            "pares suprimidos por el control de divulgación), no una nueva estimación muestral: por "
            "eso no hay error estándar ni intervalo de confianza en este nivel de agregación.")


CAP_ORIGENS_UNID = "10 principales orígenes de los inmigrantes"
CAP_DESTINOS_UNID = "10 principales destinos de los emigrantes"
SEM_FLUXO_UNID = "Sin flujos publicados individualmente."
TH_MUNICIPIO, TH_SALDO = "Municipio", "Saldo"


def h_municipios_de(nome: str) -> str:
    return f"Municipios de {nome}"


def cap_municipios_unid(n: int) -> str:
    return f"{n} municipios, con saldo migratorio 2017–2022"


def cta_unidade(nome: str) -> str:
    return f"Abrir {nome} en el atlas interactivo →"


# ============================== páginas de región metropolitana ==============================
TIPO_RM = {"RIDE": "Región Integrada de Desarrollo Económico (RIDE)",
           "RM": "Región metropolitana (RM)"}


def titulo_rm(nome: str) -> str:
    return f"Migración en {nome} (2017–2022)"


def titulo_rm_curto(nome: str) -> str:
    return f"Migración en {nome}"


def descricao_rm(nome: str) -> str:
    return (f"Migración intrametropolitana, movilidad pendular y núcleo × periferia de {nome} "
            f"entre 2017 y 2022, Censo 2022 (IBGE).")


def abertura_rm(x, r):
    return H("{tipo} compuesta por {n} municipios, con núcleo en {nucleo} y una población de "
             "referencia de {pop} personas. En el quinquenio 2017–2022 hubo {intra} migraciones "
             "internas a la propia región (entre sus municipios) y un saldo migratorio externo "
             "(con el resto del país) de {saldo}.").format(
        tipo=r["tipo_extenso"], n=r["n_municipios"], nucleo=r["nm_nucleo"], pop=x.i(r["pop_total"]),
        intra=x.i(r["mig_intra"]), saldo=x.s(r["saldo_externo"]))


H_MATRIZ = "Matriz núcleo × periferia (migración intrametropolitana)"
RM_MATRIZ = {
    "np": "Núcleo → periferia", "pn": "Periferia → núcleo", "pp": "Periferia → periferia",
    "ent": "Entradas externas (resto del país)", "sai": "Salidas externas (resto del país)",
}
H_TOP_INTRA = "10 mayores flujos migratorios intra-RM"
TH_TIPOLOGIA = "Tipo de flujo"
SEM_FLUXO_INTRA = "Sin flujos intra-RM publicados individualmente."
H_PENDULAR_RM = "Movilidad pendular"
RM_PEND = {
    "ocupados": "Ocupados en la región",
    "pendulares": "Pendulares (trabajan fuera del municipio de residencia)",
    "pct_pendular": "% de pendulares entre los ocupados",
    "tempo_mediano": "Tiempo mediano de desplazamiento",
    "pct_coletivo": "% en transporte público",
}
H_MIGRANTES_TRABALHO = "Migrantes y trabajo"
NOTA_MIGRANTES_TRABALHO = ("Suma de los municipios de la región (rm_mig_pendular_resumo): entre quienes "
                           "migraron dentro de su propia región metropolitana y estaban ocupados, "
                           "adónde fueron a trabajar.")
RM_MP = {
    "migrantes_intra": "Migrantes intra-RM",
    "mig_ocupados": "... ocupados",
    "mig_pendulares": "... pendulares (trabajan fuera de donde pasaron a vivir)",
    "pendular_para_origem": "... vuelven a trabajar en el origen del que salieron",
    "pendular_para_nucleo": "... pasan a trabajar en el núcleo",
    "trabalha_onde_mora": "... trabajan donde pasaron a vivir",
}


def h_municipios_da_rm(nome: str) -> str:
    return f"Municipios de {nome}"


TH_NUCLEO, TH_SALDO_MIG, SIM = "Núcleo", "Saldo migratorio", "Sí"


def cta_rm(nome: str) -> str:
    return f"Abrir {nome} en el atlas interactivo →"


# ============================== índices ==============================
def indice_municipios(x, n_munic: int):
    return {
        "titulo": "Municipios del atlas por UF",
        "descricao": f"Lista de los {x.i(n_munic)} municipios brasileños con datos de migración "
                     f"interna publicados, agrupados por UF.",
        "intro": H('<p>Los {n} municipios brasileños publicados en el atlas, agrupados por UF (los 26 '
                   'estados y el Distrito Federal). Véase también la <a href="{u}">lista de UF</a> y '
                   'las <a href="{r}">regiones metropolitanas</a>.</p>').format(
            n=x.i(n_munic), u=x.u("/ufs/"), r=x.u("/regioes-metropolitanas/")),
    }


def pagina_da_uf(href: str):
    return H('<a href="{h}">página de la UF</a>').format(h=href)


def n_municipios(n: int) -> str:
    return f"{n} municipios"


def indice_ufs(x):
    return {
        "titulo": "Estados y Distrito Federal (UF)",
        "descricao": "Las 27 unidades federativas (UF) de Brasil con indicadores agregados de migración interna, Censo 2022.",
        "intro": H("<p>Las 27 unidades federativas (UF: los 26 estados y el Distrito Federal) con "
                   "indicadores agregados de migración interna.</p>"),
    }


def indice_rms(x):
    return {
        "titulo": "Regiones metropolitanas y RIDE",
        "descricao": "Las 81 regiones metropolitanas (RM) y Regiones Integradas de Desarrollo Económico (RIDE) de Brasil, con migración intrametropolitana y movilidad pendular, Censo 2022.",
        "intro": H("<p>Las 81 regiones metropolitanas (RM) y Regiones Integradas de Desarrollo "
                   "Económico (RIDE) de Brasil, con el módulo de migración intrametropolitana y "
                   "movilidad pendular.</p>"),
    }


def rm_item_extra(tipo: str, n: int) -> str:
    return f"({tipo}, {n} municipios)"


def indice_regioes(x):
    return {
        "titulo": "Regiones inmediatas e intermedias",
        "descricao": "Las 510 regiones inmediatas (RGI) y 133 regiones intermedias (RGInt) del IBGE, con indicadores agregados de migración interna, Censo 2022.",
        "intro": H("<p>510 regiones inmediatas (RGI) y 133 regiones intermedias (RGInt), división "
                   "territorial del IBGE, con indicadores agregados de migración interna.</p>"),
        "h_rgi": "Regiones inmediatas", "h_rgint": "Regiones intermedias",
    }


# ============================== hallazgos ==============================
TH_FLUXO = "Flujo"
VER_NO_ATLAS = "ver en el atlas"


def corpo_achados(x, v):
    return H("""
<p>Tres hallazgos clave de la investigación, ya validados en la metodología (véase la <a href="{met}">metodología</a>
y <code>docs/qa/F2b_relatorio.md</code>), y los mayores saldos y flujos publicados.</p>

<section class="secao achado">
<h2>Desconcentración residencial sin desconcentración productiva</h2>
<p>Entre los ocupados que se mudaron del núcleo metropolitano a la periferia entre 2017 y 2022,
<strong>{p1}</strong> siguen trabajando en el núcleo: la vivienda se desplazó, el empleo no.
En la RIDE del Distrito Federal, esa proporción llega a <strong>{p2}</strong>.
<a href="{ride}">Ver la RIDE-DF &rarr;</a></p>
</section>

<section class="secao achado">
<h2>Selectividad educativa en el flujo Rio de Janeiro &rarr; São Paulo</h2>
<p>Entre los migrantes de 25 años o más que salieron de Rio de Janeiro hacia São Paulo,
<strong>{p3}</strong> tienen educación superior completa, una selectividad educativa marcada.
<a href="{app_rj_sp}">Ver el flujo en el atlas &rarr;</a></p>
</section>

<section class="secao achado">
<h2>El mayor par pendular del país</h2>
<p>Guarulhos &rarr; São Paulo es el mayor par pendular de trabajo de Brasil:
<strong>{n_pend} personas</strong> viven en Guarulhos y trabajan en São Paulo.
<a href="{app_pend}">Ver el par pendular &rarr;</a></p>
</section>

<section class="secao">
<h2>{milhoes} millones de personas cambiaron de municipio</h2>
<p>En el quinquenio 2017–2022, {milhoes} millones de personas migraron entre los {n_mun} municipios
brasileños, lo que da {n_pares} pares origen–destino publicados tras el control de divulgación.</p>
</section>

<section class="secao">
<h2>10 mayores saldos migratorios positivos</h2>
{tbl_pos}
</section>

<section class="secao">
<h2>10 mayores saldos migratorios negativos</h2>
{tbl_neg}
</section>

<section class="secao">
<h2>10 mayores flujos migratorios del país</h2>
{tbl_fluxos}
</section>
""").format(
        met=x.u("/metodologia/"), p1=x.pct(46.5), p2=x.pct(59.3), ride=v["link_ride"],
        app_rj_sp=x.app("o=3304557&d=3550308"), p3=x.pct(75.1), n_pend=x.i(77500),
        app_pend=x.app("rm=4901&aba=trab&o=3518800&d=3550308"), milhoes=x.d(12.9, 1),
        n_mun=x.i(5570), n_pares=x.i(53097), tbl_pos=v["tbl_pos"], tbl_neg=v["tbl_neg"],
        tbl_fluxos=v["tbl_fluxos"])


ACHADOS_TITULO = "Principales hallazgos del atlas"
ACHADOS_DESCRICAO = ("Los principales hallazgos de migración interna del Censo 2022: desconcentración "
                     "metropolitana, selectividad educativa, mayor par pendular y mayores saldos y flujos.")


# ============================== metodología ==============================
METODOLOGIA_TITULO = "Metodología del atlas"
METODOLOGIA_DESCRICAO = ("Fuente, definiciones, fórmulas de los indicadores y reglas de control de "
                         "divulgación del Atlas de la migración interna en Brasil, Censo 2022.")


def corpo_metodologia(x, v):
    r = v["r"]
    return H("""
<p>Versión estática de la página de metodología del atlas interactivo. Véanse también el
<a href="{glos}">glosario</a> y el documento completo <code>docs/METODOLOGIA.md</code>
del repositorio del proyecto (en portugués).</p>

<section class="secao"><h2>Fuente y universo</h2>
<p>Los datos provienen del Censo Demográfico 2022 del IBGE (Instituto Brasileño de Geografía y
Estadística), microdatos de la muestra (acceso controlado), pregunta de migración (migración interna
e internacional). El universo es la población de 5 años o más residente en 2022.</p></section>

<section class="secao"><h2>Migrante de fecha fija</h2>
<p>Se compara el municipio de residencia el 31 de julio de 2017 con el del 31 de julio de 2022. Es
migrante interno quien vivía en otro municipio de Brasil en 2017; migrante internacional, quien vivía en
otro país; no migrante, quien ya vivía en el mismo municipio (o vive allí desde hace 6 años o más).</p></section>

<section class="secao"><h2>Indicadores</h2>
<dl>
<dt>Saldo migratorio</dt><dd>Inmigrantes menos emigrantes.</dd>
<dt>Tasa neta de migración (TLM)</dt><dd>(Saldo / población de referencia) &times; 1.000, por cada 1.000 habitantes.</dd>
<dt>Índice de eficacia migratoria (IEM)</dt><dd>Saldo / (inmigrantes + emigrantes), entre &minus;1 y 1.</dd>
</dl></section>

<section class="secao"><h2>Precisión de las estimaciones</h2>
<p>Todo conteo proviene de una muestra y tiene error muestral. Cada estimación publicada recibe un
rango de precisión según el coeficiente de variación (CV): <strong>buena</strong> (CV hasta {cv_boa} %),
<strong>usar con cautela</strong> (CV entre {cv_boa} % y {cv_cautela} %),
<strong>baja precisión</strong> (CV superior a {cv_cautela} %).</p></section>

<section class="secao"><h2>Control de divulgación</h2>
<p>Antes de la publicación, un <em>gate</em> automático (reglas R1–R9) impide que cualquier celda
permita identificar a alguien: ningún flujo ni categoría con menos de {min_pessoas} personas
(estimación ponderada) o {min_dom} hogares muestreados; desagregación por
característica solo para flujos con al menos {min_det} observaciones muestrales;
todo conteo ponderado redondeado a múltiplos de {arred}; ningún conteo
muestral exacto publicado, solo rangos.</p></section>

<section class="secao"><h2>Niveles de agregación</h2>
<p>Además del municipio, el atlas agrega por región inmediata, región intermedia y UF (estado). En
esos niveles no se cuenta la migración entre municipios de la misma unidad, los pares suprimidos
quedan fuera de la suma y no se publica error estándar.</p></section>

<section class="secao"><h2>Limitaciones</h2>
<ul>
<li>La migración de fecha fija no capta los movimientos múltiples dentro del quinquenio.</li>
<li>Los resultados pueden diferir de los tabulados oficiales del IBGE (SIDRA).</li>
<li>El error muestral se estima con un estimador conservador de conglomerados (el hogar como
unidad primaria, el área de ponderación como estrato).</li>
</ul></section>

<section class="secao"><h2>Cómo citar</h2>
<p>{autor}. <em>Atlas da migração interna no Brasil</em> [Atlas de la migración interna en Brasil].
Datos del Censo Demográfico 2022 (IBGE). DOI: <a href="https://doi.org/{doi_c}">{doi_c}</a>
(todas las versiones) / <a href="https://doi.org/{doi_v}">{doi_v}</a> (v2.1.0).</p>
<p>Datos y contenido bajo <a href="{lic}">CC BY 4.0</a>, con atribución al IBGE
como fuente primaria. Metadatos estructurados en
<a href="{repo}/blob/main/CITATION.cff">CITATION.cff</a>.</p>
</section>

<section class="secao"><h2>Aviso estándar</h2><p class="aviso">{aviso}</p></section>
""").format(
        glos=x.u("/glossario/"), cv_boa=x.num_cru(r["cv_boa"]), cv_cautela=x.num_cru(r["cv_cautela"]),
        min_pessoas=r["min_pessoas"], min_dom=r["min_domicilios"], min_det=r["min_pessoas_detalhe"],
        arred=r["arredondamento"], autor=v["autor"], doi_c=v["doi_conceito"], doi_v=v["doi_versao"],
        lic=v["licenca_url"], repo=v["repo"], aviso=v["aviso"])


# ============================== glosario ==============================
GLOSSARIO_TITULO = "Glosario del atlas"
GLOSSARIO_DESCRICAO = ("Definiciones de los términos del Atlas de la migración interna: saldo migratorio, "
                       "tasa neta, IEM, migración de retorno, movilidad pendular, precisión y control de "
                       "divulgación.")
GLOS_UI = {"oQueE": "Qué es", "comoInterpretar": "Cómo interpretar", "limitacoes": "Limitaciones"}


def glossario_intro(x, n: int):
    return H('<p>{n} términos usados en el atlas, cada uno con su definición, cómo interpretarlo y sus '
             'limitaciones. Véase también la <a href="{m}">metodología</a>.</p>').format(
        n=n, m=x.u("/metodologia/"))


# ============================== datos ==============================
DADOS_TITULO = "Datos publicados del atlas"
DADOS_DESCRICAO = ("Diccionario de las tablas Parquet publicadas por el Atlas de la migración interna, con "
                   "la licencia y cómo citar los datos del Censo 2022.")
DADOS_TABELAS = [
    ("municipios.parquet", "Indicadores municipales: población, inmigrantes, emigrantes, saldo, tasas, IEM, precisión."),
    ("municipios_dim.parquet", "Perfil de los migrantes y residentes por municipio: tipo de migrante, nivel educativo, ingreso, edad y sexo."),
    ("municipios_pendular.parquet", "Indicadores de movilidad pendular por municipio."),
    ("fluxos.parquet", "Matriz de flujos migratorios de municipio a municipio, con desglose por perfil."),
    ("fluxos_uf.parquet", "Flujos migratorios entre UF."),
    ("fluxos_rgi.parquet", "Flujos migratorios entre regiones inmediatas."),
    ("fluxos_rgint.parquet", "Flujos migratorios entre regiones intermedias."),
    ("pendular_trab.parquet", "Flujos de movilidad pendular por trabajo, de municipio a municipio."),
    ("pendular_estudo.parquet", "Flujos de movilidad pendular por estudio, de municipio a municipio."),
    ("rm.parquet", "Composición municipal de las regiones metropolitanas y RIDE."),
    ("rm_resumo.parquet", "Indicadores agregados por región metropolitana/RIDE."),
    ("rm_fluxos_intra.parquet", "Flujos migratorios internos de cada región metropolitana."),
    ("rm_mig_pendular_resumo.parquet", "Cruce de migración intrametropolitana × trabajo, por municipio."),
    ("municipios_ref.parquet", "Referencia territorial pública (meso/microrregión, RGI, RGInt, RM, concentración urbana)."),
]
DADOS_BC = "Datos publicados"
DATASET = {
    "name_suffix": "datos publicados",
    "isBasedOn": "Censo Demográfico 2022 -- IBGE",
    "orgIBGE": "Instituto Brasileño de Geografía y Estadística (IBGE)",
    "keywords": ["migración interna", "Censo 2022", "IBGE", "demografía", "municipios de Brasil"],
    "variableMeasured": ["inmigrantes", "emigrantes", "saldo migratorio", "tasa neta de migración",
                         "índice de eficacia migratoria", "movilidad pendular"],
}


def corpo_dados(x, v):
    return H("""
<p>Todas las tablas siguientes pasaron por el control estadístico de divulgación (R1–R9): celdas
pequeñas suprimidas, valores redondeados a múltiplos de {arred}, conteos muestrales solo en rangos.
Formato: Apache Parquet.</p>

<section class="secao"><h2>Diccionario resumido</h2>
<table><thead><tr><th scope="col">Archivo</th><th scope="col">Contenido</th></tr></thead>
<tbody>{linhas}</tbody></table></section>

<section class="secao"><h2>Licencia</h2>
<p>Los datos agregados publicados aquí (tablas Parquet, páginas estáticas y contenido textual del
atlas) están bajo la licencia <a href="{lic_url}">{lic_nome}</a>, con atribución obligatoria al IBGE
como fuente primaria. El código fuente del proyecto está bajo la licencia {lic_cod}
(repositorio en GitHub). Los microdatos originales del Censo 2022 son de acceso controlado del
IBGE y NO están incluidos en este sitio ni en el repositorio: siguen sujetos a los términos de
uso del IBGE. Las tablas agregadas y redondeadas aquí publicadas pasaron por el control estadístico
de divulgación y no permiten la reidentificación individual.</p></section>

<section class="secao"><h2>Cómo citar</h2>
<p class="citacao">{autor}. <em>{orig}</em> [{site}]. Datos del Censo Demográfico 2022
(IBGE). Versión de los datos: {versao}. DOI: {doi}. Disponible en: {url_home}.</p>
<p class="nota">{atrib}</p></section>

<section class="secao"><h2>Fuente y aviso</h2>
<p>Fuente: {fonte}.</p>
<p class="aviso">{aviso}</p></section>
""").format(
        arred=v["arred"], linhas=v["linhas"], lic_url=v["licenca_url"], lic_nome=v["licenca_nome"],
        lic_cod=v["licenca_codigo"], autor=v["autor"], orig=TITULO_ORIGINAL, site=NOME_SITE,
        versao=v["versao"], doi=v["doi"], url_home=v["url_home"], atrib=ATRIBUICAO_PADRAO,
        fonte=v["fonte"], aviso=v["aviso"])


# ============================== acerca de ==============================
SOBRE_TITULO = "Acerca del proyecto"
SOBRE_DESCRICAO = ("Qué es el Atlas de la migración interna en Brasil, quién lo hizo y la política de "
                   "uso de los microdatos del Censo 2022.")


def corpo_sobre(x, v):
    return H("""
<p>El Atlas de la migración interna en Brasil reúne, en un único panel navegable, los flujos de
migración interna, la movilidad pendular y el módulo metropolitano del Censo Demográfico 2022
del IBGE, a nivel de municipio, región inmediata, región intermedia y UF.</p>

<section class="secao"><h2>Quién lo hizo</h2>
<p>{autor} (GitHub: <a href="{gh_url}">@{gh_user}</a>).
Vínculo institucional: {vinculo}.</p></section>

<section class="secao"><h2>Política de uso de los microdatos</h2>
<p>Los microdatos de la muestra del Censo Demográfico 2022 usados en este proyecto son de acceso
controlado del IBGE. No se publica ningún registro individual: todas las tablas disponibles en
<a href="{dados}">/dados/</a> pasaron por un <em>gate</em> automático de control estadístico de
divulgación (supresión de celdas pequeñas, redondeo, rangos de conteo muestral) antes
de salir del entorno controlado.</p></section>

<section class="secao"><h2>Licencias</h2>
<p>Datos agregados y contenido textual bajo <a href="{lic_url}">{lic_nome}</a>,
con atribución obligatoria al IBGE como fuente primaria; código fuente bajo la licencia
{lic_cod}. Véase <a href="{dados}">/dados/</a> para los detalles.</p></section>

<section class="secao"><h2>Contacto</h2>
<p>Para dudas, correcciones o reportes de error, abra un <em>issue</em> en el
<a href="{repo}">repositorio del proyecto en GitHub</a> o escriba al correo electrónico público
de contacto del autor, {email}.</p></section>
""").format(
        autor=v["autor"], gh_url=v["github_url"], gh_user=v["github_user"], vinculo=v["vinculo"],
        dados=x.u("/dados/"), lic_url=v["licenca_url"], lic_nome=v["licenca_nome"],
        lic_cod=v["licenca_codigo"], repo=v["repo"], email=v["email"])


# ============================== portada estática del idioma ==============================
HOME_TITULO = "Atlas de la migración interna en Brasil"
HOME_DESCRICAO = ("Flujos de migración interna entre los municipios brasileños, 2017–2022, a partir del "
                  "Censo Demográfico 2022 (IBGE).")


def corpo_home(x, v):
    return H("""
<p>El Atlas de la migración interna en Brasil muestra adónde se mudaron las personas entre el 31 de
julio de 2017 y el 31 de julio de 2022, a partir de la pregunta de migración interna de los microdatos
de la muestra del Censo Demográfico 2022 de Brasil (datos de acceso controlado del IBGE, el Instituto
Brasileño de Geografía y Estadística).</p>

<p class="cta"><a href="{app}">Abrir el atlas interactivo &rarr;</a></p>

<section class="secao"><h2>Explorar por territorio</h2>
<ul>
<li><a href="{mun}">Municipios</a>: {n_mun} páginas, una por municipio.</li>
<li><a href="{uf}">Estados y Distrito Federal (UF)</a>.</li>
<li><a href="{reg}">Regiones inmediatas e intermedias</a>.</li>
<li><a href="{rm}">Regiones metropolitanas y RIDE</a>.</li>
</ul></section>

<section class="secao"><h2>Fuente</h2>
<p>IBGE, Censo Demográfico 2022, microdatos de la muestra (acceso controlado), pregunta de migración
de fecha fija (residencia el 31 de julio de 2017 comparada con la del 31 de julio de 2022).</p></section>

<section class="secao"><h2>Principales hallazgos</h2>
<ul>
<li>{milhoes} millones de personas cambiaron de municipio de residencia en el quinquenio, entre los
{n_mun} municipios brasileños, lo que da {n_pares} pares origen–destino publicados.</li>
<li>Entre quienes dejaron el núcleo metropolitano por la periferia, {p1} siguen trabajando en el
núcleo: desconcentración residencial sin desconcentración del empleo; en la región integrada del
Distrito Federal (RIDE-DF), esa proporción llega a {p2}.</li>
<li>Entre los migrantes de 25 años o más de Rio de Janeiro a São Paulo, {p3} tienen educación
superior completa, una selectividad educativa marcada.</li>
<li>Guarulhos &rarr; São Paulo es el mayor par pendular del país: {n_pend} personas.</li>
</ul>
<p><a href="{ach}">Ver todos los hallazgos</a> &middot; <a href="{met}">Metodología</a> &middot;
<a href="{glos}">Glosario</a> &middot; <a href="{dados}">Datos</a></p></section>

<p>Toda estimación publicada fue redondeada y pasó por un control estadístico de divulgación
(supresión de celdas pequeñas, redondeo, rangos de tamaño muestral) antes de salir del entorno de
acceso controlado: no se publica ningún registro individual.</p>
""").format(
        app=x.app(""), mun=x.u("/municipios/"), uf=x.u("/ufs/"), reg=x.u("/regioes/"),
        rm=x.u("/regioes-metropolitanas/"), n_mun=x.i(5570), milhoes=x.d(12.9, 1),
        n_pares=x.i(53097), p1=x.pct(46.5), p2=x.pct(59.3), p3=x.pct(75.1), n_pend=x.i(77500),
        ach=x.u("/achados/"), met=x.u("/metodologia/"), glos=x.u("/glossario/"), dados=x.u("/dados/"))


# ============================== 404 ==============================
E404_TITULO = "Página no encontrada"
E404_DESCRICAO = "La página buscada no existe en el Atlas de la migración interna. Vea los índices de municipios, UF y regiones."


def corpo_404(x):
    return H('<p>Página no encontrada. Use la búsqueda del atlas interactivo o uno de los índices '
             'siguientes:</p>'
             '<ul><li><a href="{mun}">Municipios</a></li>'
             '<li><a href="{rm}">Regiones metropolitanas</a></li>'
             '<li><a href="{uf}">UF</a></li><li><a href="{reg}">Regiones</a></li>'
             '<li><a href="{home}">Volver a la página de inicio</a></li></ul>').format(
        mun=x.u("/municipios/"), rm=x.u("/regioes-metropolitanas/"), uf=x.u("/ufs/"),
        reg=x.u("/regioes/"), home=x.u("/"))
