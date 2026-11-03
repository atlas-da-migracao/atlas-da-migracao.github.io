"""Catálogo em português (texto de referência) das páginas estáticas de SEO.

Reproduz o texto histórico de pipeline/build_paginas.py. Ver o cabeçalho de `__init__.py` para as
convenções (funções que recebem o contexto `x` e devolvem `Markup`)."""
from __future__ import annotations

from . import H

LANG = "pt-BR"

# ============================== identidade do site ==============================
NOME_SITE = "Atlas da migração interna no Brasil"
TITULO_ORIGINAL = NOME_SITE  # título original, conservado nas citações dos outros idiomas
DESCRICAO_SITE = ("Saldos e fluxos migratórios entre os municípios brasileiros no "
                  "quinquênio 2017-2022, a partir dos microdados da amostra do Censo "
                  "Demográfico 2022 do IBGE.")
ATRIBUICAO_PADRAO = (
    "Fonte primária: IBGE, Censo Demográfico 2022, microdados da amostra (acesso "
    "controlado). Estimativas: Daniel Pessini Sobreira, Atlas da migração interna no Brasil."
)
PAIS = "Brasil"
# aviso de tradução (rodapé e topo da metodologia dos idiomas traduzidos); o PT é o original
AVISO_TRADUCAO = None

SEM_ESTIMATIVA = "sem estimativa"
SEP_INTERVALO = "a"
NAO_INFORMADO = "não informado"

# imagem Open Graph (duas linhas de título e um subtítulo)
OG_LINHAS = ("Atlas da migração", "interna no Brasil")
OG_SUB = "Censo Demográfico 2022 · IBGE · quinquênio 2017-2022"

ROTULO_PRECISAO = {
    "boa": "boa", "cautela": "usar com cautela", "baixa": "baixa precisão",
    "sem_estimativa": "sem estimativa",
}
# chave de rm_fluxos_intra.tipologia (mesmos rótulos de TIPOLOGIA_INTRA_RM em web/src/lib/paletas.ts)
TIPOLOGIA_ROTULO = {
    "nucleo_periferia": "Núcleo → periferia",
    "periferia_nucleo": "Periferia → núcleo",
    "periferia_periferia": "Periferia → periferia",
}
CLASSIFICACAO = {"equilibrio": "equilíbrio", "atracao": "atração", "evasao": "evasão"}

# Rótulos das categorias (meta.json -> rotulos). Em português vale o próprio meta.json.
ROTULOS: dict[str, dict[str, str]] = {}

# faixa de idade da categoria "<faixa>_I" (sexo não determinado), que não tem rótulo em meta.json
FAIXAS_IDADE = {"05_14": "5 a 14 anos", "15_24": "15 a 24 anos", "25_39": "25 a 39 anos",
                "40_59": "40 a 59 anos", "60_mais": "60 anos ou mais"}


def idade_indeterminado(faixa: str) -> str:
    return f"{FAIXAS_IDADE[faixa]}, sexo não determinado"


# ============================== cromo (_BASE) ==============================
PULAR = "Pular para o conteúdo"
SUB_MARCA = "Censo 2022 · 2017-2022"
ARIA_NAV = "Navegação principal"
ARIA_MIGALHAS = "Caminho de navegação"
ARIA_IDIOMA = "Idioma"
NAV = {
    "municipios": "Municípios", "rms": "RMs", "ufs": "UFs", "regioes": "Regiões",
    "achados": "Achados", "metodologia": "Metodologia", "glossario": "Glossário",
    "dados": "Dados", "abrir": "Abrir no atlas interativo →",
    "rms_extenso": "Regiões metropolitanas",  # migalha das páginas de RM
}


def rodape(x, fonte: str, versao: str):
    return H('Fonte: {fonte}. Dados de {versao}. <a href="{m}">Metodologia</a> &middot; '
             '<a href="{d}">Dados</a> &middot; <a href="{s}">Sobre</a>').format(
        fonte=fonte, versao=versao, m=x.u("/metodologia/"), d=x.u("/dados/"), s=x.u("/sobre/"))


# ============================== página de município ==============================
def titulo_mun(nome_uf: str) -> str:
    return f"Migração em {nome_uf} (2017-2022)"


def titulo_mun_curto(nome_uf: str) -> str:
    return f"Migração em {nome_uf}"


def descricao_mun(nome_uf: str) -> str:
    return (f"Saldo migratório, imigrantes, emigrantes e perfil dos migrantes de "
            f"{nome_uf} entre 2017 e 2022, a partir do Censo 2022 do IBGE.")


def abertura_mun(x, m):
    extra = ""
    if m["imig_ni"] or m["imig_int"]:
        extra = H("\n  Além disso, {ni} chegaram com origem não informada e {inte} vieram do "
                  "exterior.").format(ni=x.i(m["imig_ni"]), inte=x.i(m["imig_int"]))
    return H("{nome}/{uf} tinha uma população de referência (5 anos ou mais em 2022) de "
             "{pop5} pessoas. No quinquênio 2017-2022, o município recebeu "
             "{imig} imigrantes e perdeu {emig} emigrantes para outros "
             "municípios do Brasil, resultando em saldo migratório de {saldo} pessoas "
             "({tlm} por mil habitantes) e índice de eficácia migratória de "
             "{iem}. Isso classifica o "
             "município, no período, como de <strong>{cls}</strong> migratória.{extra}").format(
        nome=m["nome"], uf=m["uf_sigla"], pop5=x.i(m["pop5"]), imig=x.i(m["imig"]),
        emig=x.i(m["emig"]), saldo=x.s(m["saldo"]), tlm=x.d(m["tlm"], 2),
        iem=x.d(m["iem"], 3) if m["iem"] is not None else SEM_ESTIMATIVA,
        cls=CLASSIFICACAO[m["classificacao"]], extra=extra)


def h1_mun(m) -> str:
    return f"Migração em {m['nome']}/{m['uf_sigla']} (2017-2022)"


H_INDICADORES = "Indicadores"
TH_INDICADOR, TH_ESTIMATIVA, TH_IC, TH_PRECISAO = "Indicador", "Estimativa", "IC 95%", "Precisão"
L_IMIGRANTES, L_EMIGRANTES, L_SALDO = "Imigrantes", "Emigrantes", "Saldo migratório"
L_TLM = "Taxa líquida de migração (por mil hab.)"
L_IEM = "Índice de eficácia migratória"
SEM_CLASSIFICACAO = "sem classificação"


def cap_indicadores(m) -> str:
    return f"Indicadores migratórios de {m['nome']}/{m['uf_sigla']}, 2017-2022"


def nota_amostra(m):
    return H("Amostra de imigrantes: {a} observações. Amostra de emigrantes: {b} observações. "
             "Intervalo de confiança de 95% calculado como estimativa &plusmn; 1,96 &times; "
             "erro-padrão.").format(a=m["n_imig_faixa"], b=m["n_emig_faixa"])


H_ORIGENS_DESTINOS = "Principais origens e destinos"
TH_ORIGEM, TH_DESTINO, TH_PESSOAS = "Origem", "Destino", "Pessoas"
VER_PAR = "ver par no atlas"


def cap_origens(m) -> str:
    return f"10 principais origens dos imigrantes de {m['nome']}/{m['uf_sigla']}"


def cap_destinos(m) -> str:
    return f"10 principais destinos dos emigrantes de {m['nome']}/{m['uf_sigla']}"


SEM_FLUXO_ENTRADA = "Sem fluxos de entrada publicados individualmente (abaixo do limiar de revelação)."
SEM_FLUXO_SAIDA = "Sem fluxos de saída publicados individualmente (abaixo do limiar de revelação)."

H_PERFIL = "Perfil dos migrantes e dos residentes"
TH_CATEGORIA, TH_PARTICIPACAO, TH_AMOSTRA = "Categoria", "Participação", "Amostra"
DIRECOES = [("imig", "Imigrantes (quem chegou)"), ("emig", "Emigrantes (quem saiu)"),
            ("residente", "Residentes não migrantes")]
PERFIL_TITULOS = {
    "status": ("Status migratório", None),
    "edu": ("Escolaridade", "pessoas de 25 anos ou mais"),
    "renda": ("Renda domiciliar per capita", "salários mínimos de 2022"),
    "idade_sexo": ("Idade e sexo", None),
}


def sem_perfil(titulo: str) -> str:
    return f"{titulo}: sem estimativa publicada para este recorte."


H_PENDULAR_MUN = "Deslocamento pendular (trabalho e estudo)"


def cap_pendular(m) -> str:
    return f"Indicadores pendulares de {m['nome']}/{m['uf_sigla']}"


PEND = {
    "ocupados": "Pessoas ocupadas (10 anos ou mais)",
    "saida_trab": "Saem para trabalhar em outro município",
    "entrada_trab": "Vêm de outro município para trabalhar aqui",
    "saldo": "Saldo pendular",
    "taxa_saida": "Taxa de saída pendular (%)",
    "atracao": "Índice de atração pendular",
    "tempo_mediano": "Tempo mediano de deslocamento",
}
MIN = "min"
SEM_PEND = "Sem estimativa pendular publicada para este município."


def link_rm(x, m, href: str):
    return H('<a href="{h}">Este município integra a {rm} &rarr; ver a página da região '
             'metropolitana</a>').format(h=href, rm=m["nm_rm"])


def cta_mun(m) -> str:
    return f"Abrir {m['nome']}/{m['uf_sigla']} no atlas interativo →"


H_NOTA_MET = "Nota metodológica"


def nota_metodologica(x):
    return H("\n  Estimativas a partir dos microdados da amostra do Censo Demográfico 2022 (IBGE, "
             "acesso\n  controlado), quesito de migração de data fixa (residência em 31/07/2017 "
             "comparada à de\n  31/07/2022). Toda estimativa é arredondada a múltiplos de 5 e "
             "passou pelo controle\n  estatístico de revelação (nenhuma célula com menos de 5 "
             "pessoas ou 3 domicílios amostrais).\n  Ver <a href=\"{m}\">metodologia completa</a> "
             "e <a href=\"{g}\">glossário</a>.\n").format(m=x.u("/metodologia/"), g=x.u("/glossario/"))


H_CITAR = "Como citar esta página"


def citacao_mun(m, v):
    return H('{autor}. <em>{site}</em>: {nome}/{uf}.\nDados do Censo Demográfico 2022 (IBGE). '
             'Versão dos dados: {versao}. Disponível em: {url}.\nDOI do conjunto de dados: '
             '<a href="{doi}">{doi}</a>.').format(
        autor=v["autor"], site=NOME_SITE, nome=m["nome"], uf=m["uf_sigla"], versao=v["versao"],
        url=v["canonical"], doi=v["doi_url"])


# ============================== páginas de unidade (UF / RGI / RGInt) ==============================
# `rot`: rótulo (início de frase); `mesma`: "da mesma ..." (frase da nota); `pai`: rótulo do índice
NIVEL = {
    "uf": {"rot": "Unidade da Federação", "mesma": "da mesma unidade da federação", "pai": "UFs"},
    "rgi": {"rot": "Região imediata", "mesma": "da mesma região imediata", "pai": "Regiões imediatas"},
    "rgint": {"rot": "Região intermediária", "mesma": "da mesma região intermediária",
              "pai": "Regiões intermediárias"},
}


def titulo_unidade(nome: str) -> str:
    return f"Migração em {nome} (2017-2022)"


def titulo_unidade_curto(nome: str) -> str:
    return f"Migração em {nome}"


def descricao_unidade(nome: str) -> str:
    return (f"Saldo migratório e principais fluxos de {nome} entre 2017 e "
            f"2022, a partir do Censo Demográfico 2022 do IBGE.")


def abertura_unidade(x, u):
    return H("\n  {rot} com {n} municípios e população de referência de\n  {pop5} pessoas. No "
             "quinquênio 2017-2022, a unidade recebeu\n  {imig} imigrantes e perdeu {emig} "
             "emigrantes vindos de/para fora\n  de suas fronteiras, saldo de {saldo} ({tlm}\n  por "
             "mil habitantes).\n").format(
        rot=NIVEL[u["nivel"]]["rot"], n=u["n_municipios"], pop5=x.i(u["pop5"]), imig=x.i(u["imig"]),
        emig=x.i(u["emig"]), saldo=x.s(u["saldo"]),
        tlm=x.d(u["tlm"], 2) if u["tlm"] is not None else SEM_ESTIMATIVA)


def nota_unidade(u):
    return ("Migração entre municípios " + NIVEL[u["nivel"]]["mesma"] + " não é contabilizada "
            "aqui -- só os fluxos que cruzam a fronteira da unidade. Os indicadores desta página "
            "são somas diretas dos fluxos municipais publicados (excluídos os pares suprimidos "
            "pelo controle de revelação), não uma nova estimativa amostral: por isso não há "
            "erro-padrão nem intervalo de confiança neste nível de agregação.")


CAP_ORIGENS_UNID = "10 principais origens dos imigrantes"
CAP_DESTINOS_UNID = "10 principais destinos dos emigrantes"
SEM_FLUXO_UNID = "Sem fluxos publicados individualmente."
TH_MUNICIPIO, TH_SALDO = "Município", "Saldo"


def h_municipios_de(nome: str) -> str:
    return f"Municípios de {nome}"


def cap_municipios_unid(n: int) -> str:
    return f"{n} municípios, com saldo migratório 2017-2022"


def cta_unidade(nome: str) -> str:
    return f"Abrir {nome} no atlas interativo →"


# ============================== páginas de região metropolitana ==============================
TIPO_RM = {"RIDE": "Região Integrada de Desenvolvimento (RIDE)", "RM": "Região Metropolitana"}


def titulo_rm(nome: str) -> str:
    return f"Migração na {nome} (2017-2022)"


def titulo_rm_curto(nome: str) -> str:
    return f"Migração na {nome}"


def descricao_rm(nome: str) -> str:
    return (f"Migração intrametropolitana, deslocamento pendular e núcleo x "
            f"periferia da {nome} entre 2017 e 2022, Censo 2022 (IBGE).")


def abertura_rm(x, r):
    return H("\n  {tipo} composta por {n} municípios, núcleo em\n  {nucleo}, população de "
             "referência de {pop} pessoas. No quinquênio\n  2017-2022 houve {intra} migrações "
             "internas à própria região (entre seus\n  municípios) e saldo migratório externo "
             "(com o resto do país) de {saldo}.\n").format(
        tipo=r["tipo_extenso"], n=r["n_municipios"], nucleo=r["nm_nucleo"], pop=x.i(r["pop_total"]),
        intra=x.i(r["mig_intra"]), saldo=x.s(r["saldo_externo"]))


H_MATRIZ = "Matriz núcleo × periferia (migração intrametropolitana)"
RM_MATRIZ = {
    "np": "Núcleo → periferia", "pn": "Periferia → núcleo", "pp": "Periferia → periferia",
    "ent": "Entradas externas (resto do país)", "sai": "Saídas externas (resto do país)",
}
H_TOP_INTRA = "10 maiores fluxos migratórios intra-RM"
TH_TIPOLOGIA = "Tipologia"
SEM_FLUXO_INTRA = "Sem fluxos intra-RM publicados individualmente."
H_PENDULAR_RM = "Deslocamento pendular"
RM_PEND = {
    "ocupados": "Ocupados na região",
    "pendulares": "Pendulares (trabalham fora do município de residência)",
    "pct_pendular": "% de pendulares entre os ocupados",
    "tempo_mediano": "Tempo mediano de deslocamento",
    "pct_coletivo": "% em transporte coletivo",
}
H_MIGRANTES_TRABALHO = "Migrantes e trabalho"
NOTA_MIGRANTES_TRABALHO = ("Soma dos municípios da região (rm_mig_pendular_resumo): entre quem migrou\n"
                           "dentro da própria região metropolitana e estava ocupado, para onde foi trabalhar.")
RM_MP = {
    "migrantes_intra": "Migrantes intra-RM",
    "mig_ocupados": "... ocupados",
    "mig_pendulares": "... pendulares (trabalham fora de onde passaram a morar)",
    "pendular_para_origem": "... voltam a trabalhar na origem de onde saíram",
    "pendular_para_nucleo": "... passam a trabalhar no núcleo",
    "trabalha_onde_mora": "... trabalham onde passaram a morar",
}


def h_municipios_da_rm(nome: str) -> str:
    return f"Municípios da {nome}"


TH_NUCLEO, TH_SALDO_MIG, SIM = "Núcleo", "Saldo migratório", "Sim"


def cta_rm(nome: str) -> str:
    return f"Abrir {nome} no atlas interativo →"


# ============================== índices ==============================
def indice_municipios(x, n_munic: int):
    return {
        "titulo": "Municípios do atlas por UF",
        "descricao": f"Lista dos {x.i(n_munic)} municípios brasileiros com dados de migração interna "
                     f"publicados, agrupados por UF.",
        "intro": H('<p>Os {n} municípios brasileiros publicados no atlas, agrupados por UF. '
                   'Veja também a <a href="{u}">lista de UFs</a> e as '
                   '<a href="{r}">regiões metropolitanas</a>.</p>').format(
            n=x.i(n_munic), u=x.u("/ufs/"), r=x.u("/regioes-metropolitanas/")),
    }


def pagina_da_uf(href: str):
    return H('<a href="{h}">página da UF</a>').format(h=href)


def n_municipios(n: int) -> str:
    return f"{n} municípios"


def indice_ufs(x):
    return {
        "titulo": "Unidades da Federação",
        "descricao": "As 27 Unidades da Federação brasileiras com indicadores agregados de migração interna, Censo 2022.",
        "intro": H("<p>As 27 Unidades da Federação com indicadores agregados de migração interna.</p>"),
    }


def indice_rms(x):
    return {
        "titulo": "Regiões metropolitanas e RIDEs",
        "descricao": "As 81 regiões metropolitanas e RIDEs do Brasil com migração intrametropolitana e deslocamento pendular, Censo 2022.",
        "intro": H("<p>As 81 regiões metropolitanas e RIDEs do Brasil, com o módulo de migração "
                   "intrametropolitana e pendular.</p>"),
    }


def rm_item_extra(tipo: str, n: int) -> str:
    return f"({tipo}, {n} municípios)"


def indice_regioes(x):
    return {
        "titulo": "Regiões imediatas e intermediárias",
        "descricao": "As 510 regiões imediatas e 133 regiões intermediárias do IBGE, com indicadores agregados de migração interna, Censo 2022.",
        "intro": H("<p>510 regiões imediatas e 133 regiões intermediárias (divisão territorial do "
                   "IBGE), com indicadores agregados de migração interna.</p>"),
        "h_rgi": "Regiões imediatas", "h_rgint": "Regiões intermediárias",
    }


# ============================== achados ==============================
TH_FLUXO = "Fluxo"
VER_NO_ATLAS = "ver no atlas"


def corpo_achados(x, v):
    """`v`: link_ride, tbl_pos, tbl_neg, tbl_fluxos (HTML de tabelas já montadas)."""
    return H("""
<p>Três achados-chave da pesquisa, já validados na metodologia (ver <a href="{met}">metodologia</a>
e <code>docs/qa/F2b_relatorio.md</code>), e os maiores saldos e fluxos publicados.</p>

<section class="secao achado">
<h2>Desconcentração residencial sem desconcentração produtiva</h2>
<p>Entre os ocupados que saíram do núcleo metropolitano para a periferia entre 2017 e 2022,
<strong>{p1}</strong> continuam trabalhando no núcleo -- a moradia se deslocou, o emprego não.
Na RIDE do Distrito Federal, essa taxa chega a <strong>{p2}</strong>.
<a href="{ride}">Ver a RIDE-DF &rarr;</a></p>
</section>

<section class="secao achado">
<h2>Seletividade educacional no fluxo Rio de Janeiro &rarr; São Paulo</h2>
<p>Entre os migrantes de 25 anos ou mais que saíram do Rio de Janeiro para São Paulo,
<strong>{p3}</strong> têm superior completo -- uma seletividade educacional acentuada.
<a href="{app_rj_sp}">Ver o fluxo no atlas &rarr;</a></p>
</section>

<section class="secao achado">
<h2>O maior par pendular do país</h2>
<p>Guarulhos &rarr; São Paulo é o maior par pendular de trabalho do Brasil:
<strong>{n_pend} pessoas</strong> moram em Guarulhos e trabalham em São Paulo.
<a href="{app_pend}">Ver o par pendular &rarr;</a></p>
</section>

<section class="secao">
<h2>{milhoes} milhões de pessoas mudaram de município</h2>
<p>No quinquênio 2017-2022, {milhoes} milhões de pessoas migraram entre os {n_mun} municípios
brasileiros, resultando em {n_pares} pares origem-destino publicados após o controle de revelação.</p>
</section>

<section class="secao">
<h2>10 maiores saldos migratórios positivos</h2>
{tbl_pos}
</section>

<section class="secao">
<h2>10 maiores saldos migratórios negativos</h2>
{tbl_neg}
</section>

<section class="secao">
<h2>10 maiores fluxos migratórios do país</h2>
{tbl_fluxos}
</section>
""").format(
        met=x.u("/metodologia/"), p1=x.pct(46.5), p2=x.pct(59.3), ride=v["link_ride"],
        app_rj_sp=x.app("o=3304557&d=3550308"), p3=x.pct(75.1), n_pend=x.i(77500),
        app_pend=x.app("rm=4901&aba=trab&o=3518800&d=3550308"), milhoes=x.d(12.9, 1),
        n_mun=x.i(5570), n_pares=x.i(53097), tbl_pos=v["tbl_pos"], tbl_neg=v["tbl_neg"],
        tbl_fluxos=v["tbl_fluxos"])


ACHADOS_TITULO = "Principais achados do atlas"
ACHADOS_DESCRICAO = ("Os principais achados de migração interna do Censo 2022: desconcentração "
                     "metropolitana, seletividade educacional, maior par pendular e maiores saldos e fluxos.")


# ============================== metodologia ==============================
METODOLOGIA_TITULO = "Metodologia do atlas"
METODOLOGIA_DESCRICAO = ("Fonte, definições, fórmulas dos indicadores e regras de controle de "
                         "revelação do Atlas da migração interna, Censo 2022.")


def corpo_metodologia(x, v):
    """`v`: r (meta.revelacao), autor, doi_conceito, doi_versao, licenca_url, repo, aviso."""
    r = v["r"]
    return H("""
<p>Versão estática da página de metodologia do atlas interativo. Ver também
<a href="{glos}">glossário</a> e o documento completo <code>docs/METODOLOGIA.md</code>
do repositório do projeto.</p>

<section class="secao"><h2>Fonte e universo</h2>
<p>Os dados vêm do Censo Demográfico 2022 do IBGE, microdados da amostra (acesso controlado),
quesito de migração (Migração Interna e Internacional). O universo é a população de 5 anos ou
mais residente em 2022.</p></section>

<section class="secao"><h2>Migrante de data fixa</h2>
<p>Compara-se o município de residência em 31/07/2017 com o de 31/07/2022. É migrante interno
quem morava em outro município do Brasil em 2017; migrante internacional, quem morava em outro
país; não migrante, quem já morava no mesmo município (ou mora ali há 6 anos ou mais).</p></section>

<section class="secao"><h2>Indicadores</h2>
<dl>
<dt>Saldo migratório</dt><dd>Imigrantes menos emigrantes.</dd>
<dt>Taxa líquida de migração (TLM)</dt><dd>(Saldo / população de referência) &times; 1000, por mil habitantes.</dd>
<dt>Índice de eficácia migratória (IEM)</dt><dd>Saldo / (imigrantes + emigrantes), entre -1 e 1.</dd>
</dl></section>

<section class="secao"><h2>Precisão das estimativas</h2>
<p>Toda contagem vem de uma amostra e tem erro amostral. Cada estimativa publicada recebe uma
faixa de precisão pelo coeficiente de variação (CV): <strong>boa</strong> (CV até {cv_boa}%),
<strong>usar com cautela</strong> (CV entre {cv_boa}% e {cv_cautela}%), <strong>baixa
precisão</strong> (CV acima de {cv_cautela}%).</p></section>

<section class="secao"><h2>Controle de revelação</h2>
<p>Antes da publicação, um gate automático (regras R1-R9) impede que qualquer célula
individualize alguém: nenhum fluxo ou categoria com menos de {min_pessoas} pessoas
(estimativa ponderada) ou {min_dom} domicílios amostrais; detalhamento por
característica só para fluxos com pelo menos {min_det} observações amostrais;
toda contagem ponderada arredondada a múltiplos de {arred}; nenhuma contagem
amostral exata publicada, apenas faixas.</p></section>

<section class="secao"><h2>Níveis de agregação</h2>
<p>Além do município, o atlas agrega em região imediata, região intermediária e UF. Nesses
níveis, migração entre municípios da mesma unidade não é contada, pares suprimidos ficam de
fora da soma, e não há erro-padrão publicado.</p></section>

<section class="secao"><h2>Limitações</h2>
<ul>
<li>Migração de data fixa não captura movimentos múltiplos dentro do quinquênio.</li>
<li>Resultados podem divergir de tabulações oficiais do IBGE (SIDRA).</li>
<li>Erro amostral estimado por um estimador conservador de conglomerados (domicílio como
unidade primária, área de ponderação como estrato).</li>
</ul></section>

<section class="secao"><h2>Como citar</h2>
<p>{autor}. <em>Atlas da migração interna no Brasil</em>. Dados do Censo Demográfico 2022
(IBGE). DOI: <a href="https://doi.org/{doi_c}">{doi_c}</a> (todas as versões) /
<a href="https://doi.org/{doi_v}">{doi_v}</a> (v2.1.0).</p>
<p>Dados e conteúdo sob <a href="{lic}">CC BY 4.0</a>, com atribuição ao IBGE
como fonte primária. Metadados estruturados em
<a href="{repo}/blob/main/CITATION.cff">CITATION.cff</a>.</p>
</section>

<section class="secao"><h2>Aviso padrão</h2><p class="aviso">{aviso}</p></section>
""").format(
        glos=x.u("/glossario/"), cv_boa=x.num_cru(r["cv_boa"]), cv_cautela=x.num_cru(r["cv_cautela"]),
        min_pessoas=r["min_pessoas"], min_dom=r["min_domicilios"], min_det=r["min_pessoas_detalhe"],
        arred=r["arredondamento"], autor=v["autor"], doi_c=v["doi_conceito"], doi_v=v["doi_versao"],
        lic=v["licenca_url"], repo=v["repo"], aviso=v["aviso"])


# ============================== glossário ==============================
GLOSSARIO_TITULO = "Glossário do atlas"
GLOSSARIO_DESCRICAO = ("Definições dos termos do Atlas da migração interna: saldo migratório, taxa "
                       "líquida, IEM, migração de retorno, pendularidade, precisão e controle de revelação.")
GLOS_UI = {"oQueE": "O que é", "comoInterpretar": "Como interpretar", "limitacoes": "Limitações"}


def glossario_intro(x, n: int):
    return H("<p>{n} termos usados no atlas, com a definição, como interpretar e as limitações de "
             "cada um. Ver também a <a href=\"{m}\">metodologia</a>.</p>").format(
        n=n, m=x.u("/metodologia/"))


# ============================== dados ==============================
DADOS_TITULO = "Dados publicados do atlas"
DADOS_DESCRICAO = ("Dicionário das tabelas Parquet publicadas pelo Atlas da migração interna, com "
                   "licença e como citar os dados do Censo 2022.")
DADOS_TABELAS = [
    ("municipios.parquet", "Indicadores municipais: população, imigrantes, emigrantes, saldo, taxas, IEM, precisão."),
    ("municipios_dim.parquet", "Perfil dos migrantes e residentes por município: status, escolaridade, renda, idade e sexo."),
    ("municipios_pendular.parquet", "Indicadores de deslocamento pendular por município."),
    ("fluxos.parquet", "Matriz de fluxos migratórios município a município, com detalhamento por perfil."),
    ("fluxos_uf.parquet", "Fluxos migratórios entre UFs."),
    ("fluxos_rgi.parquet", "Fluxos migratórios entre regiões imediatas."),
    ("fluxos_rgint.parquet", "Fluxos migratórios entre regiões intermediárias."),
    ("pendular_trab.parquet", "Fluxos de deslocamento pendular para trabalho, município a município."),
    ("pendular_estudo.parquet", "Fluxos de deslocamento pendular para estudo, município a município."),
    ("rm.parquet", "Composição municipal das regiões metropolitanas e RIDEs."),
    ("rm_resumo.parquet", "Indicadores agregados por região metropolitana/RIDE."),
    ("rm_fluxos_intra.parquet", "Fluxos migratórios internos a cada região metropolitana."),
    ("rm_mig_pendular_resumo.parquet", "Cruzamento migração intrametropolitana x trabalho, por município."),
    ("municipios_ref.parquet", "Referência territorial pública (meso/microrregião, RGI, RGInt, RM, concentração urbana)."),
]
DADOS_BC = "Dados publicados"
DATASET = {
    "name_suffix": "dados publicados",
    "isBasedOn": "Censo Demográfico 2022 -- IBGE",
    "orgIBGE": "Instituto Brasileiro de Geografia e Estatística (IBGE)",
    "keywords": ["migração interna", "Censo 2022", "IBGE", "demografia", "municípios do Brasil"],
    "variableMeasured": ["imigrantes", "emigrantes", "saldo migratório", "taxa líquida de migração",
                         "índice de eficácia migratória", "deslocamento pendular"],
}


def corpo_dados(x, v):
    """`v`: linhas (HTML <tr>), arred, licenca_url, licenca_nome, licenca_codigo, autor,
    versao, doi, url_home, fonte, aviso."""
    return H("""
<p>Todas as tabelas abaixo já passaram pelo controle estatístico de revelação (R1-R9): células
pequenas suprimidas, valores arredondados a múltiplos de {arred},
contagens amostrais apenas em faixas. Formato: Apache Parquet.</p>

<section class="secao"><h2>Dicionário resumido</h2>
<table><thead><tr><th scope="col">Arquivo</th><th scope="col">Conteúdo</th></tr></thead>
<tbody>{linhas}</tbody></table></section>

<section class="secao"><h2>Licença</h2>
<p>Os dados agregados publicados aqui (tabelas Parquet, páginas estáticas e conteúdo
textual do atlas) estão sob a licença
<a href="{lic_url}">{lic_nome}</a>, com atribuição obrigatória ao IBGE
como fonte primária. O código-fonte do projeto está sob licença {lic_cod}
(repositório no GitHub). Os microdados originais do Censo 2022 são de acesso controlado do
IBGE e NÃO estão incluídos neste site nem no repositório: permanecem sujeitos aos termos de
uso do IBGE. As tabelas agregadas e arredondadas aqui publicadas passaram pelo controle
estatístico de revelação e não permitem reidentificação individual.</p></section>

<section class="secao"><h2>Como citar</h2>
<p class="citacao">{autor}. <em>{site}</em>. Dados do Censo Demográfico 2022
(IBGE). Versão dos dados: {versao}. DOI: {doi}. Disponível em: {url_home}.</p>
<p class="nota">{atrib}</p></section>

<section class="secao"><h2>Fonte e aviso</h2>
<p>Fonte: {fonte}.</p>
<p class="aviso">{aviso}</p></section>
""").format(
        arred=v["arred"], linhas=v["linhas"], lic_url=v["licenca_url"], lic_nome=v["licenca_nome"],
        lic_cod=v["licenca_codigo"], autor=v["autor"], site=NOME_SITE, versao=v["versao"],
        doi=v["doi"], url_home=v["url_home"], atrib=ATRIBUICAO_PADRAO, fonte=v["fonte"], aviso=v["aviso"])


# ============================== sobre ==============================
SOBRE_TITULO = "Sobre o projeto"
SOBRE_DESCRICAO = ("O que é o Atlas da migração interna no Brasil, quem fez, e a política de uso "
                   "dos microdados do Censo 2022.")


def corpo_sobre(x, v):
    """`v`: autor, github_user, github_url, vinculo, licenca_url, licenca_nome, licenca_codigo,
    repo, email."""
    return H("""
<p>O Atlas da migração interna no Brasil reúne, num único painel navegável, os fluxos de
migração interna, o deslocamento pendular e o módulo metropolitano do Censo Demográfico 2022
do IBGE, no nível de município, região imediata, região intermediária e UF.</p>

<section class="secao"><h2>Quem fez</h2>
<p>{autor} (GitHub: <a href="{gh_url}">@{gh_user}</a>).
Vínculo institucional: {vinculo}.</p></section>

<section class="secao"><h2>Política de uso dos microdados</h2>
<p>Os microdados da amostra do Censo Demográfico 2022 usados neste projeto são de acesso
controlado do IBGE. Nenhum registro individual é publicado: todas as tabelas disponíveis em
<a href="{dados}">/dados/</a> passaram por um gate automático de controle estatístico de
revelação (supressão de células pequenas, arredondamento, faixas de contagem amostral) antes
de sair do ambiente controlado.</p></section>

<section class="secao"><h2>Licenças</h2>
<p>Dados agregados e conteúdo textual sob <a href="{lic_url}">{lic_nome}</a>,
com atribuição obrigatória ao IBGE como fonte primária; código-fonte sob licença
{lic_cod}. Ver <a href="{dados}">/dados/</a> para os detalhes.</p></section>

<section class="secao"><h2>Contato</h2>
<p>Para dúvidas, correções ou relatos de erro, abra uma <em>issue</em> no
<a href="{repo}">repositório do projeto no GitHub</a> ou escreva para o e-mail público
de contato do autor, {email}.</p></section>
""").format(
        autor=v["autor"], gh_url=v["github_url"], gh_user=v["github_user"], vinculo=v["vinculo"],
        dados=x.u("/dados/"), lic_url=v["licenca_url"], lic_nome=v["licenca_nome"],
        lic_cod=v["licenca_codigo"], repo=v["repo"], email=v["email"])


# ============================== home estática do idioma ==============================
HOME_TITULO = "Atlas da migração interna no Brasil"
HOME_DESCRICAO = ("Fluxos de migração interna entre os municípios brasileiros, 2017-2022, a partir "
                  "do Censo Demográfico 2022 (IBGE).")


def corpo_home(x, v):
    """`v`: links dos índices já resolvidos não são necessários: usa `x.u`."""
    return H("""
<p>O Atlas da migração interna no Brasil mostra para onde as pessoas se mudaram entre 31 de julho
de 2017 e 31 de julho de 2022, a partir do quesito de migração interna dos microdados da amostra
do Censo Demográfico 2022 (dados de acesso controlado do IBGE, Instituto Brasileiro de Geografia
e Estatística).</p>

<p class="cta"><a href="{app}">Abrir o atlas interativo &rarr;</a></p>

<section class="secao"><h2>Explore por território</h2>
<ul>
<li><a href="{mun}">Municípios</a>: {n_mun} páginas, uma por município.</li>
<li><a href="{uf}">Unidades da Federação</a>.</li>
<li><a href="{reg}">Regiões imediatas e intermediárias</a>.</li>
<li><a href="{rm}">Regiões metropolitanas e RIDEs</a>.</li>
</ul></section>

<section class="secao"><h2>Fonte</h2>
<p>IBGE, Censo Demográfico 2022, microdados da amostra (acesso controlado), quesito de migração
de data fixa (residência em 31/07/2017 comparada à de 31/07/2022).</p></section>

<section class="secao"><h2>Principais achados</h2>
<ul>
<li>{milhoes} milhões de pessoas mudaram de município de residência no quinquênio, entre os
{n_mun} municípios brasileiros, resultando em {n_pares} pares origem-destino publicados.</li>
<li>Entre quem saiu do núcleo metropolitano para a periferia, {p1} continuam trabalhando no
núcleo; na RIDE do Distrito Federal, {p2}.</li>
<li>Entre os migrantes de 25 anos ou mais do Rio de Janeiro para São Paulo, {p3} têm superior
completo.</li>
<li>Guarulhos &rarr; São Paulo é o maior par pendular do país: {n_pend} pessoas.</li>
</ul>
<p><a href="{ach}">Ver todos os achados</a> &middot; <a href="{met}">Metodologia</a> &middot;
<a href="{glos}">Glossário</a> &middot; <a href="{dados}">Dados</a></p></section>

<p>Toda estimativa publicada foi arredondada e passou por um controle estatístico de revelação
(supressão de células pequenas, arredondamento, faixas de tamanho amostral) antes de sair do
ambiente de acesso controlado: nenhum registro individual é publicado.</p>
""").format(
        app=x.app(""), mun=x.u("/municipios/"), uf=x.u("/ufs/"), reg=x.u("/regioes/"),
        rm=x.u("/regioes-metropolitanas/"), n_mun=x.i(5570), milhoes=x.d(12.9, 1),
        n_pares=x.i(53097), p1=x.pct(46.5), p2=x.pct(59.3), p3=x.pct(75.1), n_pend=x.i(77500),
        ach=x.u("/achados/"), met=x.u("/metodologia/"), glos=x.u("/glossario/"), dados=x.u("/dados/"))


# ============================== 404 ==============================
E404_TITULO = "Página não encontrada"
E404_DESCRICAO = "A página buscada não existe no Atlas da migração interna. Veja os índices de municípios, UFs e regiões."


def corpo_404(x):
    return H('<p>Página não encontrada. Use a busca do atlas interativo ou um dos índices abaixo:</p>'
             '<ul><li><a href="{mun}">Municípios</a></li>'
             '<li><a href="{rm}">Regiões metropolitanas</a></li>'
             '<li><a href="{uf}">UFs</a></li><li><a href="{reg}">Regiões</a></li>'
             '<li><a href="{home}">Voltar à página inicial</a></li></ul>').format(
        mun=x.u("/municipios/"), rm=x.u("/regioes-metropolitanas/"), uf=x.u("/ufs/"),
        reg=x.u("/regioes/"), home=x.u("/"))
