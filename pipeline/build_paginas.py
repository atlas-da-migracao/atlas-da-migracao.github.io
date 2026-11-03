#!/usr/bin/env python3
"""Gera páginas HTML estáticas e indexáveis do Atlas da Migração Interna (SEO orgânico), em
quatro idiomas (pt-BR na raiz; en, fr e es sob /en/, /fr/ e /es/).

Lê exclusivamente as tabelas já publicadas em data/processed (aprovadas pelo gate de
revelação R1-R9: supressão, arredondamento a múltiplos de 5, contagens amostrais só em
faixas). Não recalcula nenhuma estatística que não esteja diretamente nessas tabelas --
no máximo formata, soma ou tira intervalo de confiança (valor +/- 1.96*se) a partir de
colunas já publicadas, exatamente como o app interativo faz (ver web/src/lib/format.ts).

Os textos de cada idioma ficam em pipeline/i18n_paginas/{pt,en,fr,es}.py (terminologia em
web/src/i18n/TERMINOLOGIA.md); o glossário vem de web/src/i18n/glossario/<lang>.json e a prosa
de meta.json (aviso, fonte) de web/src/i18n/dados.json. As URLs mantêm os slugs em português
(`/fr/municipio/<slug>/`); a chave de uma página é o seu caminho em português, e o hreflang
recíproco é montado a partir dela.

Uso:
    python pipeline/build_paginas.py --producao      # exige SITE_URL no ambiente
    python pipeline/build_paginas.py                 # rascunho local, usa https://EXEMPLO.invalid

Escreve em web/dist/ (precisa rodar depois de `npm run build`, ver web/package.json
"build:site"). Nunca escreve em web/public/ para não inflar o repositório com HTML gerado.
"""
from __future__ import annotations

import argparse
import html as _html
import json
import os
import pathlib
import re
import sys
import time
import unicodedata
from typing import Any

import duckdb
import jinja2
from markupsafe import Markup

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from i18n_paginas import (  # noqa: E402
    LANGS, LANG_PADRAO, LANG_SPA, OG_LOCALE, SELETOR, SEPARADORES, agrupar, catalogo, decimal, url_lang,
)

ROOT = pathlib.Path(__file__).resolve().parent.parent
PROCESSED = ROOT / "data/processed"
DIST = ROOT / "web/dist"
ASSETS = ROOT / "pipeline/assets"  # fontes da imagem OG (ver pipeline/assets/README.md)
I18N_WEB = ROOT / "web/src/i18n"   # glossário e dados.json compartilhados com o SPA

_PT = catalogo(LANG_PADRAO)
NOME_SITE = _PT.NOME_SITE
DESCRICAO_SITE = _PT.DESCRICAO_SITE

# ============================== autoria e licenças (F7) ==============================
# Decisões do titular do projeto (ver plano F7): autoria, repositório GitHub, e as duas
# licenças do projeto -- dados/conteúdo em CC BY 4.0 (com atribuição obrigatória ao IBGE
# como fonte primária) e código em MIT. O DOI é um placeholder explícito até a publicação
# no Zenodo (não inventar um número).
AUTOR_NOME = "Daniel Pessini Sobreira"
AUTOR_GITHUB_USER = "Damnielps"
AUTOR_GITHUB_URL = f"https://github.com/{AUTOR_GITHUB_USER}"
AUTOR_EMAIL_PUBLICO = "129672935+Damnielps@users.noreply.github.com"
AUTOR_VINCULO_INSTITUCIONAL = ""  # campo opcional, deixado vazio de propósito -- preencher se houver
REPO_URL = "https://github.com/atlas-da-migracao/atlas-da-migracao.github.io"
LICENCA_DADOS_NOME = "CC BY 4.0"
LICENCA_DADOS_URL = "https://creativecommons.org/licenses/by/4.0/deed.pt-br"
LICENCA_CODIGO_NOME = "MIT"
DOI_CONCEITO = "10.5281/zenodo.22469791"  # resolve sempre para a versão mais recente
DOI_VERSAO = "10.5281/zenodo.23074215"      # esta versão (v2.1.0)
DOI_PLACEHOLDER = f"https://doi.org/{DOI_CONCEITO}"  # usado no texto de "como citar"
AUTOR_ORCID = "https://orcid.org/0000-0002-6632-3991"
ATRIBUICAO_PADRAO = _PT.ATRIBUICAO_PADRAO

# ============================== metadados públicos ==============================
META = json.loads((PROCESSED / "meta.json").read_text(encoding="utf-8"))
ROTULOS = META["rotulos"]
CV_BOA = META["revelacao"]["cv_boa"]
CV_CAUTELA = META["revelacao"]["cv_cautela"]
AVISO = META["aviso"]
FONTE = META["fonte"]
VERSAO_DADOS = META["versao_dados"]
SALARIO_MINIMO = META["salario_minimo_referencia"]
EDICAO = str(META.get("edicao", "2022"))

ROTULO_PRECISAO = _PT.ROTULO_PRECISAO
TIPOLOGIA_ROTULO = _PT.TIPOLOGIA_ROTULO

_DADOS_I18N: dict[str, dict[str, str]] | None = None


def texto_dado(chave: str, origem: str, lang: str) -> str:
    """Tradução da prosa de meta.json (web/src/i18n/dados.json). Só vale se o texto atual do dado
    for IDÊNTICO a `origem` (o texto PT em que a tradução se baseia); se o pipeline mudou o texto e
    a tradução não acompanhou, publica-se o português em vez de uma tradução velha."""
    global _DADOS_I18N
    if lang == LANG_PADRAO or origem is None:
        return origem
    if _DADOS_I18N is None:
        _DADOS_I18N = json.loads((I18N_WEB / "dados.json").read_text(encoding="utf-8"))
    e = _DADOS_I18N.get(chave)
    return e[LANG_SPA[lang]] if e and e.get("origem") == origem else origem


def aviso_de(lang: str) -> str:
    return texto_dado(f"aviso.{EDICAO}", AVISO, lang)


def fonte_de(lang: str) -> str:
    return texto_dado(f"fonte.{EDICAO}", FONTE, lang)


# ============================== utilidades ==============================
def slugify(s: str) -> str:
    s = unicodedata.normalize("NFKD", s or "")
    s = s.encode("ascii", "ignore").decode("ascii")
    s = s.lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s or "x"


def slug_municipio(nm_mun: str, uf_sigla: str, cd_mun: str) -> str:
    return f"{slugify(nm_mun)}-{uf_sigla.lower()}-{cd_mun}"


def slug_unidade(nome: str, codigo: str) -> str:
    return f"{slugify(nome)}-{codigo}"


def precisao_de(cv: float | None) -> str:
    if cv is None:
        return "sem_estimativa"
    if cv <= CV_BOA:
        return "boa"
    if cv <= CV_CAUTELA:
        return "cautela"
    return "baixa"


def cortar(s: str, n: int = 160) -> str:
    """Corta uma descrição em `n` caracteres no limite de uma palavra (com reticências)."""
    if len(s) <= n:
        return s
    corte = s[: n - 1].rsplit(" ", 1)[0].rstrip(",;:.-")
    return corte + "…"


def _limite_ic(x: float, piso_zero: bool, lang: str = LANG_PADRAO) -> str:
    """Um limite do IC em inteiro no formato do idioma. Com `piso_zero` (contagens) o limite
    inferior nunca passa de 0 -- uma contagem de pessoas não é negativa, e "-120 a 340" imigrantes
    não significa nada; sem ele (saldo, que pode ser negativo) o sinal sai com o "−" tipográfico,
    como em `fmt_sinal`."""
    v = int(round(x))
    if piso_zero:
        v = max(v, 0)
    return f"−{fmt_int(-v, lang)}" if v < 0 else fmt_int(v, lang)


def ic95(valor: float | None, se: float | None, piso_zero: bool = True, lang: str = LANG_PADRAO) -> str | None:
    """IC 95% = valor ± 1,96 × erro-padrão. `piso_zero=False` só para grandezas com sinal (saldo)."""
    if valor is None or se is None:
        return None
    m = 1.96 * se
    sep = catalogo(lang).SEP_INTERVALO
    return f"{_limite_ic(valor - m, piso_zero, lang)} {sep} {_limite_ic(valor + m, piso_zero, lang)}"


_RE_TABELA = re.compile(r"<table\b.*?</table>", re.S)


def envolver_tabelas(html: str) -> str:
    """Põe cada <table> dentro de <div class="rolagem">. Tabelas com colunas largas (nomes de
    município + "ver par no atlas") estouravam a largura da tela no celular e arrastavam a página
    inteira para o lado; o contêiner rola sozinho (`overflow-x: auto`, ver STATIC_CSS). Feito na
    hora de escrever, e não em cada template, para que uma tabela nova não possa esquecê-lo.
    `tabindex="0"` deixa a área rolável acessível ao teclado."""
    return _RE_TABELA.sub(lambda m: f'<div class="rolagem" tabindex="0">{m.group(0)}</div>', html)


# ---- formatação numérica por idioma (en 1,234.5; fr 1 234,5 com U+202F; es 1.234,5; pt 1.234,5) ----
def fmt_int(x: Any, lang: str = LANG_PADRAO) -> str:
    sem = catalogo(lang).SEM_ESTIMATIVA
    if x is None:
        return sem
    try:
        v = int(round(float(x)))
    except (TypeError, ValueError):
        return sem
    return agrupar(v, lang)


def fmt_sinal(x: Any, lang: str = LANG_PADRAO) -> str:
    if x is None:
        return catalogo(lang).SEM_ESTIMATIVA
    v = float(x)
    sinal = "+" if v > 0 else ("−" if v < 0 else "")
    return f"{sinal}{fmt_int(abs(v), lang)}"


def fmt_dec(x: Any, casas: int = 1, lang: str = LANG_PADRAO) -> str:
    if x is None:
        return catalogo(lang).SEM_ESTIMATIVA
    return decimal(float(x), casas, lang)


def fmt_pct100(x: Any, casas: int = 1, lang: str = LANG_PADRAO) -> str:
    """Formata um valor já expresso em pontos percentuais (0-100)."""
    if x is None:
        return catalogo(lang).SEM_ESTIMATIVA
    return f"{fmt_dec(x, casas, lang)}{SEPARADORES[lang][2]}"


def rotulo(dim: str, cat: str, lang: str = LANG_PADRAO) -> str:
    """Rótulo público de uma categoria. Em português vale o de meta.json; nos outros idiomas, o do
    catálogo (i18n_paginas/<lang>.py, chaves = as de meta.json). Sem rótulo, usa-se a chave
    "outros" (variantes residuais de sexo não binário/ignorado, publicadas mas sem rótulo dedicado,
    tratadas como 'não determinado') e, na falta dela, a chave crua."""
    cat_t = catalogo(lang)
    if dim == "idade_sexo" and cat.endswith("_I"):
        faixa = cat[:-2]
        if faixa in cat_t.FAIXAS_IDADE:
            return cat_t.idade_indeterminado(faixa)
    d_lang = cat_t.ROTULOS.get(dim, {})
    if cat in d_lang:
        return d_lang[cat]
    d = ROTULOS.get(dim, {})
    if cat in d:
        return d[cat]  # português (meta.json): referência e fallback
    return d_lang.get("outros") or d.get("outros", cat)


# ============================== carga de dados (DuckDB, tabelas já publicadas) =========
def carregar_dados() -> dict[str, Any]:
    con = duckdb.connect()
    con.execute("PRAGMA threads=4;")

    def df(nome: str):
        return con.execute(f"SELECT * FROM read_parquet('{PROCESSED / nome}.parquet')").df()

    municipios = df("municipios")
    municipios_ref = df("municipios_ref")
    municipios_dim = df("municipios_dim")
    municipios_pendular = df("municipios_pendular")
    fluxos = df("fluxos")
    rm = df("rm")
    rm_resumo = df("rm_resumo")
    rm_fluxos_intra = df("rm_fluxos_intra")
    rm_mig_pendular_resumo = df("rm_mig_pendular_resumo")
    fluxos_nivel = {n: df(f"fluxos_{n}") for n in ("uf", "rgi", "rgint")}

    def registros(frame):
        """`.to_dict('records')` com NaN -> None (colunas numéricas nulas do parquet viram
        float('nan') na conversão DuckDB -> pandas, e float('nan') é *truthy* em Python --
        um `if m.get('cd_rm')` deixaria passar linhas sem RM. Normaliza uma vez aqui."""
        out = []
        for r in frame.to_dict("records"):
            out.append({k: (None if isinstance(v, float) and v != v else v) for k, v in r.items()})
        return out

    mun_by_cd = {r["cd_mun"]: r for r in registros(municipios)}
    ref_by_cd = {r["cd_mun"]: r for r in registros(municipios_ref)}
    pend_by_cd = {r["cd_mun"]: r for r in registros(municipios_pendular)}

    # perfis municipais: cd_mun -> direcao -> dimensao -> [(categoria, valor, n_faixa), ...]
    perfis: dict[str, dict[str, dict[str, list[tuple[str, float, str]]]]] = {}
    for r in municipios_dim.itertuples(index=False):
        perfis.setdefault(r.cd_mun, {}).setdefault(r.direcao, {}).setdefault(r.dimensao, []) \
            .append((r.categoria, r.valor, r.n_faixa))

    # top 10 fluxos municipais por origem e por destino (uma única passada, sem N consultas)
    fluxos_ord = fluxos.sort_values("total", ascending=False)
    top_saida = {k: registros(v) for k, v in fluxos_ord.groupby("origem", sort=False).head(10).groupby("origem")}
    top_chegada = {k: registros(v) for k, v in fluxos_ord.groupby("destino", sort=False).head(10).groupby("destino")}

    # municípios por unidade agregada (rgi/rgint/uf), para as listas das páginas de unidade
    muns_por_uf: dict[str, list[dict]] = {}
    muns_por_rgi: dict[str, list[dict]] = {}
    muns_por_rgint: dict[str, list[dict]] = {}
    for r in registros(municipios):
        muns_por_uf.setdefault(r["uf"], []).append(r)
        muns_por_rgi.setdefault(r["cd_rgi"], []).append(r)
        muns_por_rgint.setdefault(r["cd_rgint"], []).append(r)

    # municípios por RM (rm.parquet tem uma linha por município-RM, com flag núcleo)
    muns_por_rm: dict[str, list[dict]] = {}
    for r in registros(rm):
        muns_por_rm.setdefault(r["cd_rm"], []).append(r)

    # top 10 fluxos intra-RM por cd_rm
    intra_ord = rm_fluxos_intra.sort_values("total", ascending=False)
    top_intra_rm = {k: registros(v) for k, v in intra_ord.groupby("cd_rm", sort=False).head(10).groupby("cd_rm")}

    # rm_mig_pendular_resumo somado por cd_rm (municípios da RM agregados)
    campos_soma = ["migrantes_intra", "mig_ocupados", "mig_pendulares", "pendular_para_origem",
                   "pendular_para_nucleo", "pendular_para_outro", "trabalha_onde_mora",
                   "mig_estudantes", "mig_estud_pendulares"]
    mig_pend_soma_por_rm = (rm_mig_pendular_resumo.groupby("cd_rm")[campos_soma].sum()
                             .to_dict("index"))

    rm_resumo_by_cd = {r["cd_rm"]: r for r in registros(rm_resumo)}

    # mapeamento uf (código) -> sigla/nome, a partir da referência territorial pública
    uf_info = {r["uf"]: {"sigla": r["uf_sigla"], "nome": r["uf_nome"]} for r in registros(municipios_ref)}
    # nome/uf de cada RGI e RGInt (um único UF por unidade, checado nos dados)
    rgi_info = {r["cd_rgi"]: {"nome": r["nm_rgi"], "uf": r["uf"]} for r in registros(municipios)}
    rgint_info = {r["cd_rgint"]: {"nome": r["nm_rgint"], "uf": r["uf"]} for r in registros(municipios)}

    return dict(
        municipios=municipios, mun_by_cd=mun_by_cd, ref_by_cd=ref_by_cd, pend_by_cd=pend_by_cd,
        perfis=perfis, top_saida=top_saida, top_chegada=top_chegada, fluxos=fluxos,
        muns_por_uf=muns_por_uf, muns_por_rgi=muns_por_rgi, muns_por_rgint=muns_por_rgint,
        muns_por_rm=muns_por_rm, rm=rm, rm_resumo=rm_resumo, rm_resumo_by_cd=rm_resumo_by_cd,
        top_intra_rm=top_intra_rm, mig_pend_soma_por_rm=mig_pend_soma_por_rm,
        fluxos_nivel=fluxos_nivel, uf_info=uf_info, rgi_info=rgi_info, rgint_info=rgint_info,
    )



# ============================== templates (Jinja2, autoescape ligado) ==============================
# Os cinco templates são comuns aos quatro idiomas: todo texto vem do catálogo (`t`, módulo de
# i18n_paginas) e todo caminho interno passa por `x.u()` (prefixo do idioma). `x` é o `Ctx`.
_BASE = """<!doctype html>
<html lang="{{ lang_html }}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{ title }}</title>
<meta name="description" content="{{ description }}">
<link rel="canonical" href="{{ canonical }}">
<meta name="robots" content="index,follow">
{% for hl, href in hreflang|default([]) %}<link rel="alternate" hreflang="{{ hl }}" href="{{ href }}">
{% endfor -%}
<meta property="og:type" content="website">
<meta property="og:site_name" content="{{ nome_site }}">
<meta property="og:title" content="{{ title }}">
<meta property="og:description" content="{{ description }}">
<meta property="og:url" content="{{ canonical }}">
<meta property="og:locale" content="{{ og_locale }}">
{% for l in og_alt %}<meta property="og:locale:alternate" content="{{ l }}">
{% endfor -%}
<meta property="og:image" content="{{ site_url }}{{ og_img }}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{{ title }}">
<meta name="twitter:description" content="{{ description }}">
<meta name="twitter:image" content="{{ site_url }}{{ og_img }}">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="stylesheet" href="/static.css">
{% for o in jsonld_objs|default([]) -%}
<script type="application/ld+json">{{ o|jsonld }}</script>
{% endfor -%}
</head>
<body>
<a class="pular" href="#conteudo">{{ t.PULAR }}</a>
<header class="cab">
  <div class="marca"><a href="{{ x.u('/') }}">{{ nome_site }}</a> <span class="sub">{{ t.SUB_MARCA }}</span></div>
  <nav aria-label="{{ t.ARIA_NAV }}" class="nav-topo">
    <a href="{{ x.u('/municipios/') }}">{{ t.NAV.municipios }}</a>
    <a href="{{ x.u('/regioes-metropolitanas/') }}">{{ t.NAV.rms }}</a>
    <a href="{{ x.u('/ufs/') }}">{{ t.NAV.ufs }}</a>
    <a href="{{ x.u('/regioes/') }}">{{ t.NAV.regioes }}</a>
    <a href="{{ x.u('/achados/') }}">{{ t.NAV.achados }}</a>
    <a href="{{ x.u('/metodologia/') }}">{{ t.NAV.metodologia }}</a>
    <a href="{{ x.u('/glossario/') }}">{{ t.NAV.glossario }}</a>
    <a href="{{ x.u('/dados/') }}">{{ t.NAV.dados }}</a>
    {{ seletor }}
    <a class="app" href="{{ app_link|default(x.app('')) }}">{{ t.NAV.abrir }}</a>
  </nav>
</header>
{% if breadcrumbs %}
<nav aria-label="{{ t.ARIA_MIGALHAS }}" class="migalhas">
  <ol>
  {% for label, href in breadcrumbs %}<li>{% if href %}<a href="{{ href }}">{{ label }}</a>{% else %}<span aria-current="page">{{ label }}</span>{% endif %}</li>
  {% endfor %}</ol>
</nav>
{% endif %}
<main id="conteudo">
{% block content %}{% endblock %}
</main>
<footer class="rod">
  <p class="aviso">{{ aviso }}</p>
  {% if t.AVISO_TRADUCAO %}<p class="traducao">{{ t.AVISO_TRADUCAO }}</p>
  {% endif %}<p>{{ t.rodape(x, fonte, versao_dados) }}</p>
</footer>
</body>
</html>
"""

_MACROS = """
{% macro tabela_perfil(titulo, nota, linhas) %}
{% if linhas %}
<table class="perfil">
  <caption>{{ titulo }}{% if nota %} <span class="nota-caption">({{ nota }})</span>{% endif %}</caption>
  <thead><tr><th scope="col">{{ t.TH_CATEGORIA }}</th><th scope="col" class="num">{{ t.TH_ESTIMATIVA }}</th><th scope="col" class="num">{{ t.TH_PARTICIPACAO }}</th><th scope="col">{{ t.TH_AMOSTRA }}</th></tr></thead>
  <tbody>
  {% for l in linhas %}
    <tr><th scope="row">{{ l.rotulo }}</th><td class="num tabular">{{ l.valor|fmtint }}</td><td class="num tabular">{{ l.pct }}</td><td>{{ l.n_faixa }}</td></tr>
  {% endfor %}
  </tbody>
</table>
{% else %}
<p class="muted">{{ t.sem_perfil(titulo) }}</p>
{% endif %}
{% endmacro %}
"""

_MUNICIPIO = """{% extends "_base.html" %}
{% from "_macros.html" import tabela_perfil with context %}
{% block content %}
<article>
<h1>{{ t.h1_mun(m) }}</h1>

<p class="abertura">
  {{ t.abertura_mun(x, m) }}
</p>

<section class="secao">
<h2>{{ t.H_INDICADORES }}</h2>
<table class="indicadores">
  <caption>{{ t.cap_indicadores(m) }}</caption>
  <thead><tr><th scope="col">{{ t.TH_INDICADOR }}</th><th scope="col" class="num">{{ t.TH_ESTIMATIVA }}</th><th scope="col" class="num">{{ t.TH_IC }}</th><th scope="col">{{ t.TH_PRECISAO }}</th></tr></thead>
  <tbody>
    <tr><th scope="row">{{ t.L_IMIGRANTES }}</th><td class="num tabular">{{ m.imig|fmtint }}</td><td class="num tabular">{{ m.ic_imig or t.SEM_ESTIMATIVA }}</td><td>{{ m.precisao_imig_rotulo }}</td></tr>
    <tr><th scope="row">{{ t.L_EMIGRANTES }}</th><td class="num tabular">{{ m.emig|fmtint }}</td><td class="num tabular">{{ m.ic_emig or t.SEM_ESTIMATIVA }}</td><td>{{ m.precisao_emig_rotulo }}</td></tr>
    <tr><th scope="row">{{ t.L_SALDO }}</th><td class="num tabular">{{ m.saldo|fmtsinal }}</td><td class="num tabular">{{ m.ic_saldo or t.SEM_ESTIMATIVA }}</td><td>{{ t.SEM_CLASSIFICACAO }}</td></tr>
    <tr><th scope="row">{{ t.L_TLM }}</th><td class="num tabular">{{ m.tlm|fmtdec(2) if m.tlm is not none else t.SEM_ESTIMATIVA }}</td><td class="num">-</td><td>-</td></tr>
    <tr><th scope="row">{{ t.L_IEM }}</th><td class="num tabular">{{ m.iem|fmtdec(3) if m.iem is not none else t.SEM_ESTIMATIVA }}</td><td class="num">-</td><td>-</td></tr>
  </tbody>
</table>
<p class="nota">{{ t.nota_amostra(m) }}</p>
</section>

<section class="secao">
<h2>{{ t.H_ORIGENS_DESTINOS }}</h2>
<div class="colunas-2">
<table>
  <caption>{{ t.cap_origens(m) }}</caption>
  <thead><tr><th scope="col">{{ t.TH_ORIGEM }}</th><th scope="col" class="num">{{ t.TH_PESSOAS }}</th><th scope="col">{{ t.TH_PRECISAO }}</th></tr></thead>
  <tbody>
  {% for f in top_origens %}
    <tr><td><a href="{{ x.u('/municipio/' ~ f.slug ~ '/') }}">{{ f.nome }}/{{ f.uf }}</a> &middot; <a href="{{ app_link_par(f.cd, m.cd) }}">{{ t.VER_PAR }}</a></td><td class="num tabular">{{ f.total|fmtint }}</td><td>{{ rotulo_precisao(f.precisao) }}</td></tr>
  {% else %}
    <tr><td colspan="3">{{ t.SEM_FLUXO_ENTRADA }}</td></tr>
  {% endfor %}
  </tbody>
</table>
<table>
  <caption>{{ t.cap_destinos(m) }}</caption>
  <thead><tr><th scope="col">{{ t.TH_DESTINO }}</th><th scope="col" class="num">{{ t.TH_PESSOAS }}</th><th scope="col">{{ t.TH_PRECISAO }}</th></tr></thead>
  <tbody>
  {% for f in top_destinos %}
    <tr><td><a href="{{ x.u('/municipio/' ~ f.slug ~ '/') }}">{{ f.nome }}/{{ f.uf }}</a> &middot; <a href="{{ app_link_par(m.cd, f.cd) }}">{{ t.VER_PAR }}</a></td><td class="num tabular">{{ f.total|fmtint }}</td><td>{{ rotulo_precisao(f.precisao) }}</td></tr>
  {% else %}
    <tr><td colspan="3">{{ t.SEM_FLUXO_SAIDA }}</td></tr>
  {% endfor %}
  </tbody>
</table>
</div>
</section>

<section class="secao">
<h2>{{ t.H_PERFIL }}</h2>
{% for direcao, titulo_dir in t.DIRECOES %}
<h3>{{ titulo_dir }}</h3>
{% set pt_ = t.PERFIL_TITULOS %}
{{ tabela_perfil(pt_.status[0], pt_.status[1], perfil_linhas(direcao, "status")) if direcao != "residente" else "" }}
{{ tabela_perfil(pt_.edu[0], pt_.edu[1], perfil_linhas(direcao, "edu")) }}
{{ tabela_perfil(pt_.renda[0], pt_.renda[1], perfil_linhas(direcao, "renda")) }}
{{ tabela_perfil(pt_.idade_sexo[0], pt_.idade_sexo[1], perfil_linhas(direcao, "idade_sexo")) }}
{% endfor %}
</section>

<section class="secao">
<h2>{{ t.H_PENDULAR_MUN }}</h2>
{% if pend %}
<table class="indicadores">
  <caption>{{ t.cap_pendular(m) }}</caption>
  <tbody>
    <tr><th scope="row">{{ t.PEND.ocupados }}</th><td class="num tabular">{{ pend.ocupados|fmtint }}</td></tr>
    <tr><th scope="row">{{ t.PEND.saida_trab }}</th><td class="num tabular">{{ pend.saida_trab|fmtint }}</td></tr>
    <tr><th scope="row">{{ t.PEND.entrada_trab }}</th><td class="num tabular">{{ pend.entrada_trab|fmtint }}</td></tr>
    <tr><th scope="row">{{ t.PEND.saldo }}</th><td class="num tabular">{{ pend.saldo_pendular|fmtsinal }}</td></tr>
    <tr><th scope="row">{{ t.PEND.taxa_saida }}</th><td class="num tabular">{{ pend.taxa_saida_pendular|fmtdec(2) if pend.taxa_saida_pendular is not none else t.SEM_ESTIMATIVA }}</td></tr>
    <tr><th scope="row">{{ t.PEND.atracao }}</th><td class="num tabular">{{ pend.indice_atracao|fmtdec(3) if pend.indice_atracao is not none else t.SEM_ESTIMATIVA }}</td></tr>
    <tr><th scope="row">{{ t.PEND.tempo_mediano }}</th><td class="num tabular">{{ pend.tempo_mediano|fmtdec(0) ~ " " ~ t.MIN if pend.tempo_mediano is not none else t.SEM_ESTIMATIVA }}</td></tr>
  </tbody>
</table>
{% else %}
<p class="muted">{{ t.SEM_PEND }}</p>
{% endif %}
{% if m.nm_rm %}<p>{{ t.link_rm(x, m, x.u('/regiao-metropolitana/' ~ rm_slug ~ '/')) }}</p>{% endif %}
</section>

<p class="cta"><a href="{{ x.app('mun=' ~ m.cd) }}">{{ t.cta_mun(m) }}</a></p>

<section class="secao nota-metodologica">
<h2>{{ t.H_NOTA_MET }}</h2>
<p>
  {{ t.nota_metodologica(x) }}
</p>
</section>

<section class="secao">
<h2>{{ t.H_CITAR }}</h2>
<p class="citacao">{{ t.citacao_mun(m, cit) }}</p>
</section>
</article>
{% endblock %}
"""

_UNIDADE = """{% extends "_base.html" %}
{% block content %}
<article>
<h1>{{ t.titulo_unidade(u.nome) }}</h1>
<p class="abertura">
  {{ t.abertura_unidade(x, u) }}
</p>
<p class="nota">
  {{ t.nota_unidade(u) }}
</p>

<section class="secao">
<h2>{{ t.H_ORIGENS_DESTINOS }}</h2>
<div class="colunas-2">
<table>
  <caption>{{ t.CAP_ORIGENS_UNID }}</caption>
  <thead><tr><th scope="col">{{ t.TH_ORIGEM }}</th><th scope="col" class="num">{{ t.TH_PESSOAS }}</th></tr></thead>
  <tbody>
  {% for f in u.top_origens %}<tr><td><a href="{{ f.href }}">{{ f.nome }}</a></td><td class="num tabular">{{ f.total|fmtint }}</td></tr>
  {% else %}<tr><td colspan="2">{{ t.SEM_FLUXO_UNID }}</td></tr>{% endfor %}
  </tbody>
</table>
<table>
  <caption>{{ t.CAP_DESTINOS_UNID }}</caption>
  <thead><tr><th scope="col">{{ t.TH_DESTINO }}</th><th scope="col" class="num">{{ t.TH_PESSOAS }}</th></tr></thead>
  <tbody>
  {% for f in u.top_destinos %}<tr><td><a href="{{ f.href }}">{{ f.nome }}</a></td><td class="num tabular">{{ f.total|fmtint }}</td></tr>
  {% else %}<tr><td colspan="2">{{ t.SEM_FLUXO_UNID }}</td></tr>{% endfor %}
  </tbody>
</table>
</div>
</section>

<section class="secao">
<h2>{{ t.h_municipios_de(u.nome) }}</h2>
<table>
  <caption>{{ t.cap_municipios_unid(u.n_municipios) }}</caption>
  <thead><tr><th scope="col">{{ t.TH_MUNICIPIO }}</th><th scope="col" class="num">{{ t.TH_SALDO }}</th></tr></thead>
  <tbody>
  {% for mu in u.municipios %}
    <tr><td><a href="{{ x.u('/municipio/' ~ mu.slug ~ '/') }}">{{ mu.nm_mun }}/{{ mu.uf_sigla }}</a></td><td class="num tabular">{{ mu.saldo|fmtsinal }}</td></tr>
  {% endfor %}
  </tbody>
</table>
</section>

<p class="cta"><a href="{{ u.app_link }}">{{ t.cta_unidade(u.nome) }}</a></p>
</article>
{% endblock %}
"""

_RM = """{% extends "_base.html" %}
{% block content %}
<article>
<h1>{{ t.titulo_rm(r.nome) }}</h1>
<p class="abertura">
  {{ t.abertura_rm(x, r) }}
</p>

<section class="secao">
<h2>{{ t.H_MATRIZ }}</h2>
<table class="indicadores">
  <tbody>
    <tr><th scope="row">{{ t.RM_MATRIZ.np }}</th><td class="num tabular">{{ r.nucleo_periferia|fmtint }}</td></tr>
    <tr><th scope="row">{{ t.RM_MATRIZ.pn }}</th><td class="num tabular">{{ r.periferia_nucleo|fmtint }}</td></tr>
    <tr><th scope="row">{{ t.RM_MATRIZ.pp }}</th><td class="num tabular">{{ r.periferia_periferia|fmtint }}</td></tr>
    <tr><th scope="row">{{ t.RM_MATRIZ.ent }}</th><td class="num tabular">{{ r.entradas_externas|fmtint }}</td></tr>
    <tr><th scope="row">{{ t.RM_MATRIZ.sai }}</th><td class="num tabular">{{ r.saidas_externas|fmtint }}</td></tr>
  </tbody>
</table>

<h3>{{ t.H_TOP_INTRA }}</h3>
<table>
  <thead><tr><th scope="col">{{ t.TH_ORIGEM }}</th><th scope="col">{{ t.TH_DESTINO }}</th><th scope="col">{{ t.TH_TIPOLOGIA }}</th><th scope="col" class="num">{{ t.TH_PESSOAS }}</th></tr></thead>
  <tbody>
  {% for f in r.top_intra %}
    <tr><td><a href="{{ x.u('/municipio/' ~ f.slug_o ~ '/') }}">{{ f.nome_o }}</a></td><td><a href="{{ x.u('/municipio/' ~ f.slug_d ~ '/') }}">{{ f.nome_d }}</a></td><td>{{ f.tipologia }}</td><td class="num tabular">{{ f.total|fmtint }}</td></tr>
  {% else %}<tr><td colspan="4">{{ t.SEM_FLUXO_INTRA }}</td></tr>{% endfor %}
  </tbody>
</table>
</section>

<section class="secao">
<h2>{{ t.H_PENDULAR_RM }}</h2>
<table class="indicadores">
  <tbody>
    <tr><th scope="row">{{ t.RM_PEND.ocupados }}</th><td class="num tabular">{{ r.ocupados|fmtint }}</td></tr>
    <tr><th scope="row">{{ t.RM_PEND.pendulares }}</th><td class="num tabular">{{ r.pendulares|fmtint }}</td></tr>
    <tr><th scope="row">{{ t.RM_PEND.pct_pendular }}</th><td class="num tabular">{{ r.pct_pendular|fmtdec(1) if r.pct_pendular is not none else t.SEM_ESTIMATIVA }}</td></tr>
    <tr><th scope="row">{{ t.RM_PEND.tempo_mediano }}</th><td class="num tabular">{{ (r.tempo_mediano|fmtdec(0) ~ " " ~ t.MIN) if r.tempo_mediano is not none else t.SEM_ESTIMATIVA }}</td></tr>
    <tr><th scope="row">{{ t.RM_PEND.pct_coletivo }}</th><td class="num tabular">{{ r.pct_coletivo|fmtdec(1) if r.pct_coletivo is not none else t.SEM_ESTIMATIVA }}</td></tr>
  </tbody>
</table>
</section>

<section class="secao">
<h2>{{ t.H_MIGRANTES_TRABALHO }}</h2>
<p class="nota">{{ t.NOTA_MIGRANTES_TRABALHO }}</p>
<table class="indicadores">
  <tbody>
    <tr><th scope="row">{{ t.RM_MP.migrantes_intra }}</th><td class="num tabular">{{ r.mp.migrantes_intra|fmtint }}</td></tr>
    <tr><th scope="row">{{ t.RM_MP.mig_ocupados }}</th><td class="num tabular">{{ r.mp.mig_ocupados|fmtint }}</td></tr>
    <tr><th scope="row">{{ t.RM_MP.mig_pendulares }}</th><td class="num tabular">{{ r.mp.mig_pendulares|fmtint }}</td></tr>
    <tr><th scope="row">{{ t.RM_MP.pendular_para_origem }}</th><td class="num tabular">{{ r.mp.pendular_para_origem|fmtint }}</td></tr>
    <tr><th scope="row">{{ t.RM_MP.pendular_para_nucleo }}</th><td class="num tabular">{{ r.mp.pendular_para_nucleo|fmtint }}</td></tr>
    <tr><th scope="row">{{ t.RM_MP.trabalha_onde_mora }}</th><td class="num tabular">{{ r.mp.trabalha_onde_mora|fmtint }}</td></tr>
  </tbody>
</table>
</section>

<section class="secao">
<h2>{{ t.h_municipios_da_rm(r.nome) }}</h2>
<table>
  <thead><tr><th scope="col">{{ t.TH_MUNICIPIO }}</th><th scope="col">{{ t.TH_NUCLEO }}</th><th scope="col" class="num">{{ t.TH_SALDO_MIG }}</th></tr></thead>
  <tbody>
  {% for mu in r.municipios %}
    <tr><td><a href="{{ x.u('/municipio/' ~ mu.slug ~ '/') }}">{{ mu.nm_mun }}/{{ mu.uf_sigla }}</a></td><td>{{ t.SIM if mu.nucleo else "" }}</td><td class="num tabular">{{ mu.saldo|fmtsinal }}</td></tr>
  {% endfor %}
  </tbody>
</table>
</section>

<p class="cta"><a href="{{ x.app('rm=' ~ r.cd_rm) }}">{{ t.cta_rm(r.nome) }}</a></p>
</article>
{% endblock %}
"""

# páginas de conteúdo (índices, achados, metodologia...): título + corpo HTML já montado
_INDICE = """{% extends "_base.html" %}
{% block content %}
<article>
<h1>{{ h1 }}</h1>
{{ corpo }}
</article>
{% endblock %}
"""

TEMPLATES = {
    "_base.html": _BASE,
    "_macros.html": _MACROS,
    "municipio.html": _MUNICIPIO,
    "unidade.html": _UNIDADE,
    "rm.html": _RM,
    "indice.html": _INDICE,
}


def registrar_env(lang: str = LANG_PADRAO) -> jinja2.Environment:
    env = jinja2.Environment(
        loader=jinja2.DictLoader(TEMPLATES),
        autoescape=jinja2.select_autoescape(["html"]),
        trim_blocks=True, lstrip_blocks=True,
    )

    def jsonld_filter(obj):
        s = json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
        return Markup(s.replace("</", "<\\/"))

    env.filters["jsonld"] = jsonld_filter
    env.filters["fmtint"] = lambda v: fmt_int(v, lang)
    env.filters["fmtsinal"] = lambda v: fmt_sinal(v, lang)
    env.filters["fmtdec"] = lambda v, casas=1: fmt_dec(v, casas, lang)
    env.filters["fmtpct"] = lambda v, casas=1: fmt_pct100(v, casas, lang)
    return env


def esc(s: Any) -> str:
    return _html.escape(str(s), quote=False)


def juntar(*partes: Any) -> Markup:
    """Concatena HTML já montado (str ou Markup) sem reescapar -- `str + Markup` escaparia o str."""
    return Markup("".join(str(p) for p in partes))


class Ctx:
    """Contexto de idioma que os catálogos (i18n_paginas/*.py) e os templates recebem como `x`:
    URLs no idioma e números no formato do idioma."""

    def __init__(self, lang: str):
        self.lang = lang

    def u(self, caminho: str) -> str:
        """Caminho de página -> caminho no idioma (`/fr/municipio/...`; o português fica na raiz)."""
        return url_lang(caminho, self.lang)

    def app(self, query: str = "", html: bool = False) -> str:
        """Link para o SPA. Fora do português acrescenta `lang=xx`. Com `html=True` o `&` sai como
        `&amp;` (para f-strings de HTML escritas à mão; nos templates o autoescape já o faz)."""
        partes = [p for p in query.split("&") if p]
        if self.lang != LANG_PADRAO:
            partes.append(f"lang={LANG_SPA[self.lang]}")
        url = "/?" + "&".join(partes) if partes else "/"
        return url.replace("&", "&amp;") if html else url

    def i(self, v: Any) -> str:
        return fmt_int(v, self.lang)

    def s(self, v: Any) -> str:
        return fmt_sinal(v, self.lang)

    def d(self, v: Any, casas: int = 1) -> str:
        return fmt_dec(v, casas, self.lang)

    def pct(self, v: Any, casas: int = 1) -> str:
        return fmt_pct100(v, casas, self.lang)

    def num_cru(self, v: float) -> str:
        """Número sem zeros à direita ("15", "7,5") no formato do idioma (limiares do meta.json)."""
        return decimal(float(v), 0 if float(v).is_integer() else 1, self.lang)


# ============================== geração ==============================
class Gerador:
    """Gera as páginas de UM idioma. A chave de cada página (`chave`) é o caminho em português
    (`/municipio/<slug>/`), igual nos quatro idiomas; `url_lang` a leva para o caminho do idioma
    (`/fr/municipio/<slug>/`)."""

    def __init__(self, site_url: str, dados: dict[str, Any], lang: str = LANG_PADRAO):
        if lang not in LANGS:
            raise ValueError(f"idioma não suportado: {lang!r}")
        self.site_url = site_url.rstrip("/")
        self.d = dados
        self.lang = lang
        self.t = catalogo(lang)
        self.x = Ctx(lang)
        self.env = registrar_env(lang)
        self.aviso = aviso_de(lang)
        self.fonte = fonte_de(lang)
        self.paginas: list[str] = []   # caminhos finais, com o prefixo do idioma (para o sitemap)
        self.chaves: list[str] = []    # chaves independentes de idioma, na mesma ordem
        self.tamanhos: list[int] = []

    # ---- URLs ----
    def url_lang(self, chave: str) -> str:
        return url_lang(chave, self.lang)

    u = url_lang

    def url(self, caminho: str) -> str:
        return f"{self.site_url}{caminho}"

    def og_img(self) -> str:
        return "/og.png" if self.lang == LANG_PADRAO else f"/og-{LANG_SPA[self.lang]}.png"

    def hreflang(self, chave: str) -> list[tuple[str, str]]:
        """Alternates recíprocos (os quatro idiomas, a própria página inclusive) + x-default (pt)."""
        out = [(l, self.url(url_lang(chave, l))) for l in LANGS]
        out.append(("x-default", self.url(url_lang(chave, LANG_PADRAO))))
        return out

    def seletor(self, chave: str) -> Markup:
        """Seletor PT · EN · FR · ES: a mesma página nos outros idiomas."""
        itens = []
        for l in LANGS:
            sigla, nome = SELETOR[l]
            if l == self.lang:
                itens.append(Markup('<span aria-current="true" lang="{lg}" title="{n}">{s}</span>').format(
                    lg=l, n=nome, s=sigla))
            else:
                itens.append(Markup('<a href="{h}" hreflang="{lg}" lang="{lg}" title="{n}">{s}</a>').format(
                    h=url_lang(chave, l), lg=l, n=nome, s=sigla))
        return Markup('<span class="idiomas" role="group" aria-label="{a}">{i}</span>').format(
            a=self.t.ARIA_IDIOMA, i=Markup(" &middot; ").join(itens))

    # ---- escrita ----
    def escrever(self, caminho: str, html: str, chave: str | None = None) -> None:
        """`caminho` (já com o prefixo do idioma) sempre termina com '/'; escreve <caminho>/index.html."""
        destino = DIST / caminho.lstrip("/") / "index.html"
        destino.parent.mkdir(parents=True, exist_ok=True)
        html = envolver_tabelas(html)
        destino.write_text(html, encoding="utf-8")
        self.paginas.append(caminho)
        self.chaves.append(chave or caminho)
        self.tamanhos.append(len(html.encode("utf-8")))

    def base_ctx(self, chave: str, **extra) -> dict:
        outros = [OG_LOCALE[l] for l in LANGS if l != self.lang]
        ctx = dict(
            t=self.t, x=self.x, lang_html=self.lang, og_locale=OG_LOCALE[self.lang], og_alt=outros,
            og_img=self.og_img(), nome_site=self.t.NOME_SITE, site_url=self.site_url,
            aviso=self.aviso, fonte=self.fonte, versao_dados=VERSAO_DADOS,
            seletor=self.seletor(chave), hreflang=self.hreflang(chave),
            autor_placeholder=AUTOR_NOME, doi_url=f"https://doi.org/{DOI_CONCEITO}",
        )
        ctx.update(extra)
        return ctx

    def render(self, template_nome: str, chave: str, **ctx) -> None:
        caminho = self.u(chave)
        tpl = self.env.get_template(template_nome)
        html = tpl.render(**self.base_ctx(chave, canonical=self.url(caminho), **ctx))
        self.escrever(caminho, html, chave)

    def breadcrumbs_urls(self, itens: list[tuple[str, str | None]], canonical_path: str) -> list[dict]:
        out = []
        for i, (label, href) in enumerate(itens, start=1):
            out.append({"@type": "ListItem", "position": i, "name": label,
                        "item": self.url(href or canonical_path)})
        return out

    def jsonld_pagina(self, titulo: str, descricao: str, canonical_path: str,
                       about: dict | None = None, breadcrumbs=None, extra: list[dict] | None = None) -> list[dict]:
        """`canonical_path` e os `href` dos breadcrumbs já vêm com o prefixo do idioma."""
        objs = []
        if breadcrumbs:
            objs.append({"@context": "https://schema.org", "@type": "BreadcrumbList",
                         "itemListElement": self.breadcrumbs_urls(breadcrumbs, canonical_path)})
        webpage = {
            "@context": "https://schema.org", "@type": "WebPage", "name": titulo,
            "description": descricao, "url": self.url(canonical_path), "inLanguage": self.lang,
            "isPartOf": {"@type": "WebSite", "name": self.t.NOME_SITE, "url": self.url(self.u("/"))},
        }
        if about:
            webpage["about"] = about
        objs.append(webpage)
        if extra:
            objs.extend(extra)
        return objs

    def home_bc(self) -> tuple[str, str]:
        return (self.t.NOME_SITE, self.u("/"))

    # ---------------------------- municípios ----------------------------
    def gerar_municipios(self) -> None:
        d, t, x, lang = self.d, self.t, self.x, self.lang
        for cd, m in d["mun_by_cd"].items():
            slug = slug_municipio(m["nm_mun"], m["uf_sigla"], cd)
            chave = f"/municipio/{slug}/"
            caminho = self.u(chave)

            saldo = m["saldo"]
            classificacao = "equilibrio" if not saldo else ("atracao" if saldo > 0 else "evasao")
            ref = d["ref_by_cd"].get(cd, {})

            def enriquecer(rows, campo_cd):
                out = []
                for r in rows:
                    outro_cd = r[campo_cd]
                    om = d["mun_by_cd"].get(outro_cd)
                    if not om:
                        continue
                    out.append({
                        "cd": outro_cd, "nome": om["nm_mun"], "uf": om["uf_sigla"],
                        "slug": slug_municipio(om["nm_mun"], om["uf_sigla"], outro_cd),
                        "total": r["total"], "precisao": r["precisao"],
                    })
                return out

            top_origens = enriquecer(d["top_chegada"].get(cd, []), "origem")  # quem chegou -> origem deles
            top_destinos = enriquecer(d["top_saida"].get(cd, []), "destino")  # quem saiu -> destino deles

            def perfil_linhas(direcao: str, dimensao: str):
                itens = d["perfis"].get(cd, {}).get(direcao, {}).get(dimensao, [])
                if not itens:
                    return []
                total = sum(v for _, v, _ in itens) or 1
                linhas = []
                for cat, valor, n_faixa in sorted(itens, key=lambda x_: -x_[1]):
                    linhas.append({
                        "rotulo": rotulo(dimensao, cat, lang), "valor": valor,
                        "pct": fmt_pct100(100 * valor / total, 1, lang), "n_faixa": n_faixa,
                    })
                return linhas

            pend = d["pend_by_cd"].get(cd)
            rm_slug_val = None
            if m.get("cd_rm") and m.get("nm_rm"):
                rm_slug_val = slug_unidade(m["nm_rm"], m["cd_rm"])

            precisao_emig = precisao_de(m.get("cv_emig"))
            rp = t.ROTULO_PRECISAO

            ctx_m = dict(
                cd=cd, nome=m["nm_mun"], uf_sigla=m["uf_sigla"], pop=m["pop"], pop5=m["pop5"],
                imig=m["imig"], imig_ni=m["imig_ni"], imig_int=m["imig_int"], emig=m["emig"],
                saldo=saldo, tlm=m["tlm"], iem=m["iem"], classificacao=classificacao,
                nm_rm=m.get("nm_rm"),
                n_imig_faixa=m["n_imig_faixa"], n_emig_faixa=m["n_emig_faixa"],
                precisao_imig_rotulo=rp.get(m["precisao_imig"], m["precisao_imig"]),
                precisao_emig_rotulo=rp.get(precisao_emig, precisao_emig),
                ic_imig=ic95(m["imig"], m.get("se_imig"), lang=lang),
                ic_emig=ic95(m["emig"], m.get("se_emig"), lang=lang),
                ic_saldo=ic95(saldo, m.get("se_saldo"), piso_zero=False, lang=lang),  # saldo pode ser negativo
            )

            nome_uf = f"{m['nm_mun']}/{m['uf_sigla']}"
            titulo = t.titulo_mun(nome_uf)
            if len(titulo) > 60:
                titulo = t.titulo_mun_curto(nome_uf)
            descricao = cortar(t.descricao_mun(nome_uf))

            breadcrumbs = [self.home_bc(), (t.NAV["municipios"], self.u("/municipios/")),
                           (m["uf_sigla"], self.u(f"/uf/{m['uf_sigla'].lower()}/")), (m["nm_mun"], None)]
            about = {
                "@type": "AdministrativeArea", "name": nome_uf,
                "identifier": cd,
                "containedInPlace": {"@type": "AdministrativeArea", "name": ref.get("uf_nome", m["uf_sigla"]),
                                      "identifier": m["uf"]},
            }
            jsonld_objs = self.jsonld_pagina(titulo, descricao, caminho, about, breadcrumbs)

            def app_link_par(o, dd):
                return x.app(f"o={o}&d={dd}")

            self.render(
                "municipio.html", chave, title=titulo, description=descricao,
                breadcrumbs=breadcrumbs, jsonld_objs=jsonld_objs, app_link=x.app(f"mun={cd}"),
                m=ctx_m, top_origens=top_origens, top_destinos=top_destinos,
                perfil_linhas=perfil_linhas, pend=pend, rm_slug=rm_slug_val,
                app_link_par=app_link_par, rotulo_precisao=lambda p: rp.get(p, p),
                cit=dict(autor=AUTOR_NOME, versao=VERSAO_DADOS, canonical=self.url(caminho),
                         doi_url=f"https://doi.org/{DOI_CONCEITO}"),
            )

    # ---------------------------- unidades agregadas (uf/rgi/rgint) ----------------------------
    def gerar_unidades(self, nivel: str) -> None:
        d, t, x = self.d, self.t, self.x
        info = {"uf": d["uf_info"], "rgi": d["rgi_info"], "rgint": d["rgint_info"]}[nivel]
        muns_por = {"uf": d["muns_por_uf"], "rgi": d["muns_por_rgi"], "rgint": d["muns_por_rgint"]}[nivel]
        prefixo_url = {"uf": "/uf/", "rgi": "/regiao-imediata/", "rgint": "/regiao-intermediaria/"}[nivel]
        fluxos_df = d["fluxos_nivel"][nivel]

        imig_por_codigo = fluxos_df.groupby("destino")["total"].sum().to_dict()
        emig_por_codigo = fluxos_df.groupby("origem")["total"].sum().to_dict()
        fluxos_ord = fluxos_df.sort_values("total", ascending=False)
        top_dest = {k: v.to_dict("records") for k, v in fluxos_ord.groupby("origem", sort=False).head(10).groupby("origem")}
        top_orig = {k: v.to_dict("records") for k, v in fluxos_ord.groupby("destino", sort=False).head(10).groupby("destino")}

        for codigo, meta_u in info.items():
            nome_completo = meta_u["nome"]
            if nivel == "uf":
                slug = meta_u["sigla"].lower()
                chave = f"{prefixo_url}{slug}/"
                app_link = x.app(f"n=uf&sel={codigo}")
            else:
                slug = slug_unidade(nome_completo, codigo)
                chave = f"{prefixo_url}{slug}/"
                app_link = x.app(f"n={nivel}&sel={codigo}")
            caminho = self.u(chave)

            municipios_da_unidade = sorted(muns_por.get(codigo, []), key=lambda r: -(r["saldo"] or 0))
            pop5_total = sum(r["pop5"] or 0 for r in municipios_da_unidade)
            imig_t = imig_por_codigo.get(codigo, 0.0)
            emig_t = emig_por_codigo.get(codigo, 0.0)
            saldo_t = imig_t - emig_t
            tlm_t = (saldo_t / pop5_total * 1000) if pop5_total else None

            def enriquecer_unidade(rows, campo):
                out = []
                for r in rows:
                    outro = r[campo]
                    if nivel == "uf":
                        oi = d["uf_info"].get(outro)
                        if not oi:
                            continue
                        href = self.u(f"/uf/{oi['sigla'].lower()}/")
                        nome_o = f"{oi['nome']} ({oi['sigla']})"
                    else:
                        oi = info.get(outro)
                        if not oi:
                            continue
                        href = self.u(f"{prefixo_url}{slug_unidade(oi['nome'], outro)}/")
                        nome_o = oi["nome"]
                    out.append({"href": href, "nome": nome_o, "total": r["total"]})
                return out

            u = dict(
                nome=nome_completo, nivel=nivel,
                n_municipios=len(municipios_da_unidade), pop5=pop5_total, imig=imig_t, emig=emig_t,
                saldo=saldo_t, tlm=tlm_t,
                top_origens=enriquecer_unidade(top_orig.get(codigo, []), "origem"),
                top_destinos=enriquecer_unidade(top_dest.get(codigo, []), "destino"),
                municipios=[{
                    "slug": slug_municipio(r["nm_mun"], r["uf_sigla"], r["cd_mun"]),
                    "nm_mun": r["nm_mun"], "uf_sigla": r["uf_sigla"], "saldo": r["saldo"],
                } for r in municipios_da_unidade],
                app_link=app_link,
            )

            titulo = t.titulo_unidade(nome_completo)
            if len(titulo) > 60:
                titulo = t.titulo_unidade_curto(nome_completo)[:60]
            descricao = cortar(t.descricao_unidade(nome_completo))
            rotulo_pai = t.NIVEL[nivel]["pai"]
            href_pai = self.u("/ufs/" if nivel == "uf" else "/regioes/")
            breadcrumbs = [self.home_bc(), (rotulo_pai, href_pai), (nome_completo, None)]
            uf_nome_pai = d["uf_info"].get(meta_u.get("uf", codigo), {}).get("nome", t.PAIS) if nivel != "uf" else t.PAIS
            about = {"@type": "AdministrativeArea", "name": nome_completo, "identifier": codigo,
                     "containedInPlace": {"@type": ("Country" if nivel == "uf" else "AdministrativeArea"), "name": uf_nome_pai}}
            jsonld_objs = self.jsonld_pagina(titulo, descricao, caminho, about, breadcrumbs)

            self.render("unidade.html", chave, title=titulo, description=descricao,
                        breadcrumbs=breadcrumbs, jsonld_objs=jsonld_objs, app_link=app_link, u=u)

    # ---------------------------- regiões metropolitanas ----------------------------
    def gerar_rms(self) -> None:
        d, t, x = self.d, self.t, self.x
        for cd_rm, resumo in d["rm_resumo_by_cd"].items():
            nome = resumo["nm_rm"]
            slug = slug_unidade(nome, cd_rm)
            chave = f"/regiao-metropolitana/{slug}/"
            caminho = self.u(chave)
            municipios_rm = sorted(d["muns_por_rm"].get(cd_rm, []), key=lambda r: (not r["nucleo"], r["nm_mun"]))
            for r in municipios_rm:
                r["slug"] = slug_municipio(r["nm_mun"], r["uf_sigla"], r["cd_mun"])
                r["saldo"] = d["mun_by_cd"].get(r["cd_mun"], {}).get("saldo")

            top_intra = []
            for f in d["top_intra_rm"].get(cd_rm, []):
                mo, md = d["mun_by_cd"].get(f["origem"]), d["mun_by_cd"].get(f["destino"])
                if not mo or not md:
                    continue
                top_intra.append({
                    "slug_o": slug_municipio(mo["nm_mun"], mo["uf_sigla"], f["origem"]), "nome_o": f"{mo['nm_mun']}/{mo['uf_sigla']}",
                    "slug_d": slug_municipio(md["nm_mun"], md["uf_sigla"], f["destino"]), "nome_d": f"{md['nm_mun']}/{md['uf_sigla']}",
                    "tipologia": t.TIPOLOGIA_ROTULO.get(f["tipologia"], f["tipologia"]), "total": f["total"],
                })

            mp = d["mig_pend_soma_por_rm"].get(cd_rm, {})
            tipo_extenso = t.TIPO_RM["RIDE" if resumo["tipo"] == "RIDE" else "RM"]

            r_ctx = dict(
                cd_rm=cd_rm, nome=nome, tipo_extenso=tipo_extenso, n_municipios=resumo["n_municipios"],
                nm_nucleo=resumo["nm_nucleo"], pop_total=resumo["pop"], mig_intra=resumo["mig_intra"],
                saldo_externo=resumo["saldo_externo"], nucleo_periferia=resumo["nucleo_periferia"],
                periferia_nucleo=resumo["periferia_nucleo"], periferia_periferia=resumo["periferia_periferia"],
                entradas_externas=resumo["entradas_externas"], saidas_externas=resumo["saidas_externas"],
                ocupados=resumo["ocupados"], pendulares=resumo["pendulares"], pct_pendular=resumo["pct_pendular"],
                tempo_mediano=resumo["tempo_mediano"], pct_coletivo=resumo["pct_coletivo"],
                top_intra=top_intra, mp=mp, municipios=municipios_rm,
            )

            titulo = t.titulo_rm(nome)
            if len(titulo) > 60:
                titulo = t.titulo_rm_curto(nome)[:60]
            descricao = cortar(t.descricao_rm(nome))
            breadcrumbs = [self.home_bc(), (t.NAV["rms_extenso"], self.u("/regioes-metropolitanas/")), (nome, None)]
            about = {"@type": "AdministrativeArea", "name": nome, "identifier": cd_rm,
                     "containedInPlace": {"@type": "Country", "name": t.PAIS}}
            jsonld_objs = self.jsonld_pagina(titulo, descricao, caminho, about, breadcrumbs)

            self.render("rm.html", chave, title=titulo, description=descricao,
                        breadcrumbs=breadcrumbs, jsonld_objs=jsonld_objs, app_link=x.app(f"rm={cd_rm}"), r=r_ctx)

    # ---------------------------- páginas de conteúdo (índices e fixas) ----------------------------
    def _pagina(self, chave: str, titulo: str, descricao: str, corpo: str, extra_jsonld=None,
                breadcrumbs=None, bc_titulo: str | None = None, h1: str | None = None) -> None:
        caminho = self.u(chave)
        if breadcrumbs is None:
            breadcrumbs = [self.home_bc(), (bc_titulo or titulo, None)]
        jsonld_objs = self.jsonld_pagina(titulo, descricao, caminho, None, breadcrumbs, extra=extra_jsonld)
        tpl = self.env.get_template("indice.html")
        html = tpl.render(**self.base_ctx(chave, canonical=self.url(caminho), title=titulo, description=descricao,
                                           breadcrumbs=breadcrumbs, jsonld_objs=jsonld_objs, h1=h1 or titulo,
                                           corpo=Markup(corpo)))
        self.escrever(caminho, html, chave)

    def gerar_indices(self) -> None:
        d, t, x = self.d, self.t, self.x
        u = self.u

        # /municipios/ -- lista por UF
        ufs_ordenadas = sorted(d["uf_info"].items(), key=lambda kv: kv[1]["nome"])
        blocos = []
        for cd_uf, info in ufs_ordenadas:
            muns = sorted(d["muns_por_uf"].get(cd_uf, []), key=lambda r: r["nm_mun"])
            itens = "".join(
                f'<li><a href="{u("/municipio/" + slug_municipio(m["nm_mun"], m["uf_sigla"], m["cd_mun"]) + "/")}">{esc(m["nm_mun"])}</a></li>'
                for m in muns
            )
            blocos.append(
                f'<section class="secao"><h2 id="uf-{info["sigla"].lower()}">{esc(info["nome"])} ({info["sigla"]}) '
                f'&middot; {t.pagina_da_uf(u("/uf/" + info["sigla"].lower() + "/"))}</h2>'
                f'<details><summary>{t.n_municipios(len(muns))}</summary><ul class="lista-municipios">{itens}</ul></details></section>'
            )
        idx = t.indice_municipios(x, len(d["mun_by_cd"]))
        self._pagina("/municipios/", idx["titulo"], idx["descricao"], juntar(idx["intro"], *blocos))

        # /ufs/
        itens = "".join(
            f'<li><a href="{u("/uf/" + info["sigla"].lower() + "/")}">{esc(info["nome"])} ({info["sigla"]})</a></li>'
            for _, info in ufs_ordenadas
        )
        idx = t.indice_ufs(x)
        self._pagina("/ufs/", idx["titulo"], idx["descricao"], juntar(idx["intro"], f'<ul class="lista-uf">{itens}</ul>'))

        # /regioes-metropolitanas/
        rms_ordenadas = sorted(d["rm_resumo_by_cd"].items(), key=lambda kv: kv[1]["nm_rm"])
        itens = "".join(
            f'<li><a href="{u("/regiao-metropolitana/" + slug_unidade(r["nm_rm"], cd) + "/")}">{esc(r["nm_rm"])}</a> '
            f'<span class="muted">{t.rm_item_extra(r["tipo"], r["n_municipios"])}</span></li>'
            for cd, r in rms_ordenadas
        )
        idx = t.indice_rms(x)
        self._pagina("/regioes-metropolitanas/", idx["titulo"], idx["descricao"], juntar(idx["intro"], f"<ul>{itens}</ul>"))

        # /regioes/ -- RGI e RGInt agrupadas por UF
        rgi_por_uf: dict[str, list] = {}
        for cd, info in d["rgi_info"].items():
            rgi_por_uf.setdefault(info["uf"], []).append((cd, info["nome"]))
        rgint_por_uf: dict[str, list] = {}
        for cd, info in d["rgint_info"].items():
            rgint_por_uf.setdefault(info["uf"], []).append((cd, info["nome"]))

        def bloco_regiao(mapa, prefixo, titulo_secao):
            partes = [f"<h2>{titulo_secao}</h2>"]
            for cd_uf, info in ufs_ordenadas:
                lst = sorted(mapa.get(cd_uf, []), key=lambda x_: x_[1])
                if not lst:
                    continue
                itens = "".join(f'<li><a href="{u(prefixo + slug_unidade(nome, cd) + "/")}">{esc(nome)}</a></li>' for cd, nome in lst)
                partes.append(f'<details><summary>{esc(info["nome"])} ({info["sigla"]}) &middot; {len(lst)}</summary><ul>{itens}</ul></details>')
            return "".join(partes)

        idx = t.indice_regioes(x)
        corpo = juntar(idx["intro"], bloco_regiao(rgi_por_uf, "/regiao-imediata/", idx["h_rgi"]),
                       bloco_regiao(rgint_por_uf, "/regiao-intermediaria/", idx["h_rgint"]))
        self._pagina("/regioes/", idx["titulo"], idx["descricao"], corpo)

    def gerar_achados(self) -> None:
        d, t, x = self.d, self.t, self.x
        u = self.u
        municipios = list(d["mun_by_cd"].values())
        top_saldo_pos = sorted(municipios, key=lambda r: -(r["saldo"] or 0))[:10]
        top_saldo_neg = sorted(municipios, key=lambda r: (r["saldo"] or 0))[:10]
        top_fluxos = d["fluxos"].sort_values("total", ascending=False).head(10).to_dict("records")

        def linha_mun(m):
            return (f'<tr><td><a href="{u("/municipio/" + slug_municipio(m["nm_mun"], m["uf_sigla"], m["cd_mun"]) + "/")}">'
                    f'{esc(m["nm_mun"])}/{m["uf_sigla"]}</a></td><td class="num tabular">{x.s(m["saldo"])}</td></tr>')

        def linha_fluxo(f):
            mo, md = d["mun_by_cd"].get(f["origem"]), d["mun_by_cd"].get(f["destino"])
            if not mo or not md:
                return ""
            so, sd = slug_municipio(mo["nm_mun"], mo["uf_sigla"], f["origem"]), slug_municipio(md["nm_mun"], md["uf_sigla"], f["destino"])
            return (f'<tr><td><a href="{u("/municipio/" + so + "/")}">{esc(mo["nm_mun"])}/{mo["uf_sigla"]}</a> &rarr; '
                    f'<a href="{u("/municipio/" + sd + "/")}">{esc(md["nm_mun"])}/{md["uf_sigla"]}</a> &middot; '
                    f'<a href="{x.app("o=" + f["origem"] + "&d=" + f["destino"], html=True)}">{t.VER_NO_ATLAS}</a></td>'
                    f'<td class="num tabular">{x.i(f["total"])}</td></tr>')

        def tabela_mun(linhas):
            return (f'<table><thead><tr><th scope="col">{t.TH_MUNICIPIO}</th><th scope="col" class="num">{t.TH_SALDO}</th></tr></thead>'
                    f'<tbody>{"".join(linha_mun(m) for m in linhas)}</tbody></table>')

        v = dict(
            link_ride=u("/regiao-metropolitana/" + slug_unidade("Região Integrada de Desenvolvimento do Distrito Federal e Entorno", "7801") + "/"),
            tbl_pos=Markup(tabela_mun(top_saldo_pos)), tbl_neg=Markup(tabela_mun(top_saldo_neg)),
            tbl_fluxos=Markup(f'<table><thead><tr><th scope="col">{t.TH_FLUXO}</th><th scope="col" class="num">{t.TH_PESSOAS}</th></tr></thead>'
                        f'<tbody>{"".join(linha_fluxo(f) for f in top_fluxos)}</tbody></table>'),
        )
        self._pagina("/achados/", t.ACHADOS_TITULO, t.ACHADOS_DESCRICAO, t.corpo_achados(x, v))

    def _aviso_traducao_topo(self) -> Markup:
        if not self.t.AVISO_TRADUCAO:
            return Markup("")
        return Markup('<p class="traducao">{}</p>').format(self.t.AVISO_TRADUCAO)

    def gerar_metodologia(self) -> None:
        t, x = self.t, self.x
        v = dict(r=META["revelacao"], autor=AUTOR_NOME, doi_conceito=DOI_CONCEITO, doi_versao=DOI_VERSAO,
                 licenca_url=LICENCA_DADOS_URL, repo=REPO_URL, aviso=self.aviso)
        self._pagina("/metodologia/", t.METODOLOGIA_TITULO, t.METODOLOGIA_DESCRICAO,
                     juntar(self._aviso_traducao_topo(), t.corpo_metodologia(x, v)))

    def gerar_glossario(self) -> None:
        """O glossário é o mesmo do SPA: web/src/i18n/glossario/<lang>.json (37 termos)."""
        t, x = self.t, self.x
        termos = json.loads((I18N_WEB / "glossario" / f"{LANG_SPA[self.lang]}.json").read_text(encoding="utf-8"))
        ui = t.GLOS_UI
        indice = "".join(f'<li><a href="#{k}">{esc(v["termo"])}</a></li>' for k, v in termos.items())
        itens = []
        for k, v in termos.items():
            partes = [f'<p>{esc(v["definicao"])}</p>']
            if v.get("interpretacao"):
                partes.append(f'<p><strong>{ui["comoInterpretar"]}.</strong> {esc(v["interpretacao"])}</p>')
            if v.get("limitacoes"):
                partes.append(f'<p><strong>{ui["limitacoes"]}.</strong> {esc(v["limitacoes"])}</p>')
            itens.append(f'<dt id="{k}">{esc(v["termo"])}</dt><dd>{"".join(partes)}</dd>')
        corpo = juntar(self._aviso_traducao_topo(), t.glossario_intro(x, len(termos)),
                       f'<ul class="lista-termos">{indice}</ul>',
                       "<dl class='glossario'>", *itens, "</dl>")
        self._pagina("/glossario/", t.GLOSSARIO_TITULO, t.GLOSSARIO_DESCRICAO, corpo)

    def gerar_dados(self) -> None:
        t, x = self.t, self.x
        tabelas = t.DADOS_TABELAS
        linhas = "".join(
            f'<tr><td><a href="/data/{nome}">{nome}</a></td><td>{esc(desc)}</td></tr>' for nome, desc in tabelas
        )
        corpo = t.corpo_dados(x, dict(
            arred=META["revelacao"]["arredondamento"], linhas=Markup(linhas), licenca_url=LICENCA_DADOS_URL,
            licenca_nome=LICENCA_DADOS_NOME, licenca_codigo=LICENCA_CODIGO_NOME,
            autor=AUTOR_NOME, versao=VERSAO_DADOS, doi=DOI_PLACEHOLDER,
            url_home=self.url(self.u("/")), fonte=self.fonte, aviso=self.aviso))
        caminho = self.u("/dados/")
        breadcrumbs = [self.home_bc(), (t.DADOS_BC, None)]
        ds = t.DATASET
        dataset = {
            "@context": "https://schema.org", "@type": "Dataset",
            "name": f"{t.NOME_SITE} -- {ds['name_suffix']}", "description": t.DADOS_DESCRICAO,
            "inLanguage": self.lang,
            "creator": {"@type": "Person", "name": AUTOR_NOME, "url": AUTOR_GITHUB_URL, "sameAs": AUTOR_ORCID},
            "identifier": f"https://doi.org/{DOI_CONCEITO}",
            "license": LICENCA_DADOS_URL,
            "temporalCoverage": "2017-07-31/2022-07-31",
            "spatialCoverage": {"@type": "Place", "name": t.PAIS},
            "isBasedOn": {"@type": "Dataset", "name": ds["isBasedOn"],
                          "creator": {"@type": "Organization", "name": ds["orgIBGE"]}},
            "distribution": [
                {"@type": "DataDownload", "contentUrl": self.url(f"/data/{nome}"), "encodingFormat": "application/vnd.apache.parquet"}
                for nome, _ in tabelas
            ],
            "keywords": ds["keywords"], "variableMeasured": ds["variableMeasured"],
        }
        self._pagina("/dados/", t.DADOS_TITULO, t.DADOS_DESCRICAO, juntar(self._aviso_traducao_topo(), corpo),
                     extra_jsonld=[dataset], breadcrumbs=breadcrumbs)

    def gerar_sobre(self) -> None:
        t, x = self.t, self.x
        corpo = t.corpo_sobre(x, dict(
            autor=AUTOR_NOME, github_user=AUTOR_GITHUB_USER, github_url=AUTOR_GITHUB_URL,
            vinculo=AUTOR_VINCULO_INSTITUCIONAL or t.NAO_INFORMADO, licenca_url=LICENCA_DADOS_URL,
            licenca_nome=LICENCA_DADOS_NOME, licenca_codigo=LICENCA_CODIGO_NOME, repo=REPO_URL,
            email=AUTOR_EMAIL_PUBLICO))
        self._pagina("/sobre/", t.SOBRE_TITULO, t.SOBRE_DESCRICAO, juntar(self._aviso_traducao_topo(), corpo))

    def gerar_home(self) -> None:
        """Home estática de en/fr/es (`/en/`...). A home em português é o próprio SPA (`/`)."""
        if self.lang == LANG_PADRAO:
            return
        t, x = self.t, self.x
        self._pagina("/", t.HOME_TITULO, t.HOME_DESCRICAO, t.corpo_home(x, {}), breadcrumbs=[])

    def gerar_404(self) -> None:
        t, x = self.t, self.x
        chave = "/404.html"
        caminho = self.u(chave)
        tpl = self.env.get_template("indice.html")
        ctx = self.base_ctx(chave, canonical=self.url(caminho), title=t.E404_TITULO, description=t.E404_DESCRICAO,
                            breadcrumbs=[self.home_bc(), (t.E404_TITULO, None)], jsonld_objs=[],
                            h1=t.E404_TITULO, corpo=t.corpo_404(x), hreflang=[])
        html = tpl.render(**ctx)
        # robots: noindex para a 404 (não faz sentido indexá-la)
        html = html.replace('content="index,follow"', 'content="noindex,follow"')
        destino = DIST / caminho.lstrip("/")
        destino.parent.mkdir(parents=True, exist_ok=True)
        destino.write_text(html, encoding="utf-8")

    def gerar_tudo(self) -> None:
        self.gerar_municipios()
        for nivel in ("uf", "rgi", "rgint"):
            self.gerar_unidades(nivel)
        self.gerar_rms()
        self.gerar_indices()
        self.gerar_achados()
        self.gerar_metodologia()
        self.gerar_glossario()
        self.gerar_dados()
        self.gerar_sobre()
        self.gerar_home()
        self.gerar_404()


def gerar_site(site_url: str, dados: dict[str, Any], langs=LANGS) -> list[Gerador]:
    """Gera as páginas de todos os idiomas, o CSS, as imagens OG, o sitemap e o robots."""
    geradores = []
    for lang in langs:
        g = Gerador(site_url, dados, lang)
        g.gerar_tudo()
        geradores.append(g)
    gerar_css()
    for lang in langs:
        gerar_og_image(lang)
    gerar_sitemap_robots(site_url, geradores)
    return geradores


# ---------------------------- técnicas: sitemap, robots ----------------------------
LIMITE_SITEMAP = 45000  # abaixo do limite de 50.000 URLs por arquivo


def gerar_sitemap_robots(site_url: str, geradores: list[Gerador]) -> None:
    """Um sitemap por idioma (`sitemap-pt.xml`, `sitemap-en.xml`...) e `sitemap.xml` como índice.
    O robots.txt aponta o índice. Idioma com mais de LIMITE_SITEMAP URLs é particionado
    (`sitemap-pt-2.xml`...)."""
    site_url = site_url.rstrip("/")
    nomes: list[str] = []
    for g in geradores:
        urls = sorted(set(g.paginas))
        if g.lang == LANG_PADRAO:
            urls = ["/"] + urls  # a home em português é o SPA, que não passa pelo gerador
        sigla = LANG_SPA[g.lang]
        partes = [urls[i:i + LIMITE_SITEMAP] for i in range(0, len(urls), LIMITE_SITEMAP)] or [[]]
        for i, bloco in enumerate(partes):
            nome = f"sitemap-{sigla}.xml" if i == 0 else f"sitemap-{sigla}-{i + 1}.xml"
            nomes.append(nome)
            corpo = ['<?xml version="1.0" encoding="UTF-8"?>',
                     '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
            for u in bloco:
                corpo.append(f"<url><loc>{site_url}{u}</loc></url>")
            corpo.append("</urlset>")
            (DIST / nome).write_text("\n".join(corpo), encoding="utf-8")
    idx = ['<?xml version="1.0" encoding="UTF-8"?>',
           '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for nome in nomes:
        idx.append(f"<sitemap><loc>{site_url}/{nome}</loc></sitemap>")
    idx.append("</sitemapindex>")
    (DIST / "sitemap.xml").write_text("\n".join(idx), encoding="utf-8")

    (DIST / "robots.txt").write_text(f"User-agent: *\nAllow: /\nSitemap: {site_url}/sitemap.xml\n", encoding="utf-8")
    (DIST / "humans.txt").write_text(
        f"/* TEAM */\nProject: {NOME_SITE}\nSource: {FONTE}\nData version: {VERSAO_DADOS}\n",
        encoding="utf-8")


# ============================== CSS estático (derivado de tokens.css) ==============================
STATIC_CSS = """
:root {
  --plane:#f9f9f7; --surface:#fcfcfb; --ink:#0b0b0b; --ink-secondary:#52514e; --ink-muted-texto:#6f6e68;
  --hairline:#e1e0d9; --acento-ativo:#1c5cab; --div-pos-3:#184f95; --div-neg-3:#8c2828; --font: system-ui,-apple-system,"Segoe UI",sans-serif;
}
@media (prefers-color-scheme: dark) {
  :root { --plane:#0d0d0d; --surface:#1a1a19; --ink:#ffffff; --ink-secondary:#c3c2b7; --ink-muted-texto:#9c9a93;
          --hairline:#2c2c2a; --acento-ativo:#3987e5; --div-pos-3:#256abf; --div-neg-3:#b43b3a; }
}
* { box-sizing: border-box; }
html { background: var(--plane); }
body { font-family: var(--font); background: var(--plane); color: var(--ink); margin:0; line-height:1.5; font-size:15px; }
.pular { position:absolute; left:-9999px; top:0; background:var(--surface); color:var(--ink); padding:8px 12px; z-index:10; }
.pular:focus { left:8px; top:8px; }
a { color: var(--acento-ativo); }
.cab { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:8px 16px;
       padding:12px 20px; border-bottom:1px solid var(--hairline); background:var(--surface); }
.cab .marca a { font-weight:700; text-decoration:none; color:var(--ink); font-size:1.05em; }
.cab .sub { color:var(--ink-muted-texto); font-size:0.85em; }
.nav-topo { display:flex; flex-wrap:wrap; gap:4px 14px; font-size:0.92em; }
.nav-topo a.app { font-weight:600; }
.migalhas { padding:8px 20px; font-size:0.85em; color:var(--ink-muted-texto); }
.migalhas ol { list-style:none; display:flex; flex-wrap:wrap; gap:4px; padding:0; margin:0; }
.migalhas li:not(:last-child)::after { content:"›"; margin-left:6px; }
main { max-width: 920px; margin: 0 auto; padding: 20px; }
h1 { font-size:1.6em; margin-top:0; }
h2 { font-size:1.25em; border-top:1px solid var(--hairline); padding-top:16px; margin-top:28px; }
h3 { font-size:1.05em; }
.abertura { font-size:1.05em; }
.nota, .muted, .nota-caption { color: var(--ink-muted-texto); font-size:0.9em; }
table { border-collapse:collapse; width:100%; margin:12px 0 20px; font-size:0.93em; }
caption { text-align:left; font-weight:600; margin-bottom:6px; }
th, td { text-align:left; padding:5px 8px; border-bottom:1px solid var(--hairline); overflow-wrap:anywhere; }
th[scope="col"] { border-bottom:2px solid var(--hairline); }
/* números nunca quebram no meio (overflow-wrap: anywhere nas células acima faria "1.234.567" virar
   uma coluna de dígitos no celular) */
.num { text-align:right; white-space:nowrap; }
/* cada <table> vem dentro de .rolagem (envolver_tabelas): se mesmo com a quebra de linha a tabela
   ainda for mais larga que a tela, ela rola dentro do contêiner em vez de alargar a página */
.rolagem { overflow-x:auto; margin:12px 0 20px; }
.rolagem > table { margin:0; }
.tabular { font-variant-numeric: tabular-nums; }
.colunas-2 { display:grid; grid-template-columns:1fr; gap:0 24px; }
@media (min-width:760px) { .colunas-2 { grid-template-columns:1fr 1fr; } }
.lista-municipios { columns: 2; column-gap: 24px; font-size:0.92em; }
@media (min-width:640px) { .lista-municipios { columns: 3; } }
.cta { margin: 20px 0; }
.cta a { display:inline-block; padding:8px 14px; border:1px solid var(--acento-ativo); border-radius:6px; text-decoration:none; }
.citacao { font-family: Georgia, serif; font-size:0.95em; }
.achado { border-left:3px solid var(--acento-ativo); padding-left:14px; margin-bottom:16px; }
.rod { padding: 16px 20px 32px; font-size:0.82em; color: var(--ink-muted-texto); border-top:1px solid var(--hairline); }
.rod a { color: inherit; }
.glossario dt { font-weight:700; margin-top:14px; }
.glossario dd { margin-left:0; color: var(--ink-secondary); }
details summary { cursor:pointer; font-weight:600; margin:8px 0; }
.idiomas { display:inline-flex; flex-wrap:wrap; gap:0 4px; align-items:center; }
.idiomas [aria-current] { font-weight:700; color:var(--ink); }
.lista-termos { columns: 2; column-gap: 24px; font-size:0.92em; }
.traducao { font-style:italic; }
"""


def gerar_css() -> None:
    (DIST / "static.css").write_text(STATIC_CSS, encoding="utf-8")


# ============================== imagem OG (Pillow, com fallback) ==============================
# DejaVu Sans versionada em pipeline/assets/ (origem, licença e SHA-256 no README da pasta). O
# caminho antigo apontava para fontes do macOS (/System/Library/Fonts/Supplemental/Arial*.ttf),
# que não existem no runner Linux do CI: caía em `load_default()` (bitmap de ~10 px, sem acentos)
# e a imagem publicada saía com o texto minúsculo e incompleto.
FONTE_OG_TITULO = ASSETS / "DejaVuSans-Bold.ttf"
FONTE_OG_SUBTITULO = ASSETS / "DejaVuSans.ttf"


def fonte_og(caminho: pathlib.Path, tamanho: int):
    """TTF versionada no tamanho pedido; se faltar, a fonte embutida do Pillow **no mesmo
    tamanho** (`load_default(size=...)`, Pillow >= 10.1) -- nunca o bitmap fixo de ~10 px."""
    from PIL import ImageFont
    try:
        return ImageFont.truetype(str(caminho), tamanho)
    except OSError:
        try:
            return ImageFont.load_default(size=tamanho)
        except TypeError:  # Pillow < 10.1 não aceita `size`
            return ImageFont.load_default()


def gerar_og_image(lang: str = LANG_PADRAO) -> bool:
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        return False
    largura, altura = 1200, 630
    img = Image.new("RGB", (largura, altura), (13, 13, 13))
    draw = ImageDraw.Draw(img)
    fonte_titulo = fonte_og(FONTE_OG_TITULO, 56)
    fonte_sub = fonte_og(FONTE_OG_SUBTITULO, 32)

    draw.rectangle([0, altura - 12, largura, altura], fill=(28, 92, 171))
    t = catalogo(lang)
    linhas = list(t.OG_LINHAS)
    y = 160
    for linha in linhas:
        draw.text((80, y), linha, font=fonte_titulo, fill=(255, 255, 255))
        y += 72
    draw.text((80, y + 24), t.OG_SUB,
               font=fonte_sub, fill=(200, 200, 195))
    img.save(DIST / ("og.png" if lang == LANG_PADRAO else f"og-{LANG_SPA[lang]}.png"), "PNG")
    return True




# ============================== main ==============================
def main() -> None:
    global DIST
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--producao", action="store_true", help="Exige SITE_URL no ambiente; falha sem ele.")
    ap.add_argument("--out", default=str(DIST), help="Diretório de saída (padrão: web/dist).")
    ap.add_argument("--langs", default=",".join(LANGS),
                    help="Idiomas a gerar, separados por vírgula (padrão: todos; ex.: pt-BR,en).")
    args = ap.parse_args()

    DIST = pathlib.Path(args.out)
    langs = tuple(l.strip() for l in args.langs.split(",") if l.strip())
    invalidos = [l for l in langs if l not in LANGS]
    if invalidos:
        print(f"ERRO: idioma(s) inválido(s): {invalidos}; use {list(LANGS)}.", file=sys.stderr)
        sys.exit(1)

    if args.producao:
        site_url = os.environ.get("SITE_URL", "").strip()
        if not site_url:
            print("ERRO: --producao exige a variável de ambiente SITE_URL definida "
                  "(ex.: SITE_URL=https://meudominio.org). Abortando.", file=sys.stderr)
            sys.exit(1)
    else:
        site_url = os.environ.get("SITE_URL", "https://EXEMPLO.invalid").strip()
        if site_url == "https://EXEMPLO.invalid":
            print("AVISO: gerando com domínio placeholder https://EXEMPLO.invalid "
                  "(rascunho local; use --producao com SITE_URL definido para publicar).", file=sys.stderr)

    if not DIST.exists():
        if DIST == pathlib.Path(ROOT / "web/dist"):
            print(f"ERRO: {DIST} não existe -- rode 'npm run build' (vite build) em web/ antes.", file=sys.stderr)
            sys.exit(1)
        # --out para um diretório diferente do padrão (ex.: testes automatizados): cria o
        # diretório em vez de falhar, já que os assets do vite não são exigidos para gerar
        # as páginas de conteúdo (só para servi-las lado a lado com o bundle React).
        DIST.mkdir(parents=True, exist_ok=True)

    t0 = time.time()
    dados = carregar_dados()
    geradores = gerar_site(site_url, dados, langs)

    dt = time.time() - t0
    total_bytes = sum(sum(g.tamanhos) for g in geradores)
    n = sum(len(g.paginas) for g in geradores)
    for g in geradores:
        print(f"  {g.lang}: {len(g.paginas)} páginas")
    print(f"Páginas geradas: {n}")
    print(f"Tamanho médio por página: {total_bytes / n / 1024:.1f} KB" if n else "Nenhuma página gerada")
    print("Imagens OG geradas: " + ("sim" if (DIST / "og.png").exists() else "não (Pillow indisponível -- OG sem imagem)"))
    print(f"Tempo de geração: {dt:.1f} s")
    print(f"SITE_URL usado: {site_url}")


if __name__ == "__main__":
    main()
