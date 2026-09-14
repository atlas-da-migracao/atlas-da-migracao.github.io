#!/usr/bin/env python3
"""Gera páginas HTML estáticas e indexáveis do Atlas da Migração Interna (SEO orgânico).

Lê exclusivamente as tabelas já publicadas em data/processed (aprovadas pelo gate de
revelação R1-R9: supressão, arredondamento a múltiplos de 5, contagens amostrais só em
faixas). Não recalcula nenhuma estatística que não esteja diretamente nessas tabelas --
no máximo formata, soma ou tira intervalo de confiança (valor +/- 1.96*se) a partir de
colunas já publicadas, exatamente como o app interativo faz (ver web/src/lib/format.ts).

Uso:
    python pipeline/build_paginas.py --producao      # exige SITE_URL no ambiente
    python pipeline/build_paginas.py                 # rascunho local, usa https://EXEMPLO.invalid

Escreve em web/dist/ (precisa rodar depois de `npm run build`, ver web/package.json
"build:site"). Nunca escreve em web/public/ para não inflar o repositório com HTML gerado.
"""
from __future__ import annotations

import argparse
import io
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

ROOT = pathlib.Path(__file__).resolve().parent.parent
PROCESSED = ROOT / "data/processed"
DIST = ROOT / "web/dist"

NOME_SITE = "Atlas da migração interna no Brasil"
DESCRICAO_SITE = ("Saldos e fluxos migratórios entre os municípios brasileiros no "
                   "quinquênio 2017-2022, a partir dos microdados da amostra do Censo "
                   "Demográfico 2022 do IBGE.")

# ============================== autoria e licenças (F7) ==============================
# Decisões do titular do projeto (ver plano F7): autoria, repositório GitHub, e as duas
# licenças do projeto -- dados/conteúdo em CC BY 4.0 (com atribuição obrigatória ao IBGE
# como fonte primária) e código em MIT. O DOI é um placeholder explícito até a publicação
# no Zenodo (não inventar um número).
AUTOR_NOME = "Daniel Pessini"
AUTOR_GITHUB_USER = "Damnielps"
AUTOR_GITHUB_URL = f"https://github.com/{AUTOR_GITHUB_USER}"
AUTOR_EMAIL_PUBLICO = "129672935+Damnielps@users.noreply.github.com"
AUTOR_VINCULO_INSTITUCIONAL = ""  # campo opcional, deixado vazio de propósito -- preencher se houver
REPO_URL = "https://github.com/atlas-da-migracao/atlas-da-migracao.github.io"
LICENCA_DADOS_NOME = "CC BY 4.0"
LICENCA_DADOS_URL = "https://creativecommons.org/licenses/by/4.0/deed.pt-br"
LICENCA_CODIGO_NOME = "MIT"
DOI_CONCEITO = "10.5281/zenodo.22469791"  # resolve sempre para a versão mais recente
DOI_VERSAO = "10.5281/zenodo.22469792"      # esta versão (v1.0.0)
DOI_PLACEHOLDER = f"https://doi.org/{DOI_CONCEITO}"  # usado no texto de "como citar"
AUTOR_ORCID = "https://orcid.org/0000-0002-6632-3991"
ATRIBUICAO_PADRAO = (
    "Fonte primária: IBGE, Censo Demográfico 2022, microdados da amostra (acesso "
    "controlado). Estimativas: Daniel Pessini, Atlas da migração interna no Brasil."
)

# ============================== metadados públicos ==============================
META = json.loads((PROCESSED / "meta.json").read_text(encoding="utf-8"))
ROTULOS = META["rotulos"]
CV_BOA = META["revelacao"]["cv_boa"]
CV_CAUTELA = META["revelacao"]["cv_cautela"]
AVISO = META["aviso"]
FONTE = META["fonte"]
VERSAO_DADOS = META["versao_dados"]
SALARIO_MINIMO = META["salario_minimo_referencia"]

ROTULO_PRECISAO = {
    "boa": "boa", "cautela": "usar com cautela", "baixa": "baixa precisão",
    "sem_estimativa": "sem estimativa",
}


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


def ic95(valor: float | None, se: float | None) -> str | None:
    if valor is None or se is None:
        return None
    m = 1.96 * se
    return f"{fmt_int(valor - m)} a {fmt_int(valor + m)}"


def fmt_int(x: Any) -> str:
    if x is None:
        return "sem estimativa"
    try:
        v = int(round(float(x)))
    except (TypeError, ValueError):
        return "sem estimativa"
    return f"{v:,}".replace(",", ".")


def fmt_sinal(x: Any) -> str:
    if x is None:
        return "sem estimativa"
    v = float(x)
    sinal = "+" if v > 0 else ("−" if v < 0 else "")
    return f"{sinal}{fmt_int(abs(v))}"


def fmt_dec(x: Any, casas: int = 1) -> str:
    if x is None:
        return "sem estimativa"
    s = f"{float(x):,.{casas}f}"
    s = s.replace(",", "§").replace(".", ",").replace("§", ".")
    return s


def fmt_pct100(x: Any, casas: int = 1) -> str:
    """Formata um valor já expresso em pontos percentuais (0-100)."""
    if x is None:
        return "sem estimativa"
    return f"{fmt_dec(x, casas)}%"


def rotulo(dim: str, cat: str) -> str:
    """Rótulo público de uma categoria (meta.json); usa a chave crua se não houver rótulo
    (ex.: variantes residuais de sexo não binário/ignorado, publicadas mas sem rótulo
    dedicado em meta.json -- tratadas como 'não determinado')."""
    d = ROTULOS.get(dim, {})
    if cat in d:
        return d[cat]
    if dim == "idade_sexo" and cat.endswith("_I"):
        faixa = cat[:-2].replace("_", " a ")
        return f"{faixa} anos, sexo não determinado"
    return d.get("outros", cat)


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
_BASE = """<!doctype html>
<html lang="{{ lang|default('pt-BR') }}">
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
<meta property="og:image" content="{{ site_url }}/og.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{{ title }}">
<meta name="twitter:description" content="{{ description }}">
<meta name="twitter:image" content="{{ site_url }}/og.png">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="stylesheet" href="/static.css">
{% for o in jsonld_objs|default([]) -%}
<script type="application/ld+json">{{ o|jsonld }}</script>
{% endfor -%}
</head>
<body>
<a class="pular" href="#conteudo">Pular para o conteúdo</a>
<header class="cab">
  <div class="marca"><a href="/">{{ nome_site }}</a> <span class="sub">Censo 2022 &middot; 2017-2022</span></div>
  <nav aria-label="Navegação principal" class="nav-topo">
    <a href="/municipios/">Municípios</a>
    <a href="/regioes-metropolitanas/">RMs</a>
    <a href="/ufs/">UFs</a>
    <a href="/regioes/">Regiões</a>
    <a href="/achados/">Achados</a>
    <a href="/metodologia/">Metodologia</a>
    <a href="/glossario/">Glossário</a>
    <a href="/dados/">Dados</a>
    <a href="/en/">EN</a>
    <a class="app" href="{{ app_link|default('/') }}">Abrir no atlas interativo &rarr;</a>
  </nav>
</header>
{% if breadcrumbs %}
<nav aria-label="Caminho de navegação" class="migalhas">
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
  <p>Fonte: {{ fonte }}. Dados de {{ versao_dados }}. <a href="/metodologia/">Metodologia</a> &middot; <a href="/dados/">Dados</a> &middot; <a href="/sobre/">Sobre</a></p>
</footer>
</body>
</html>
"""

_MACROS = """
{% macro tabela_perfil(titulo, nota, linhas) %}
{% if linhas %}
<table class="perfil">
  <caption>{{ titulo }}{% if nota %} <span class="nota-caption">({{ nota }})</span>{% endif %}</caption>
  <thead><tr><th scope="col">Categoria</th><th scope="col" class="num">Estimativa</th><th scope="col" class="num">Participação</th><th scope="col">Amostra</th></tr></thead>
  <tbody>
  {% for l in linhas %}
    <tr><th scope="row">{{ l.rotulo }}</th><td class="num tabular">{{ l.valor|fmtint }}</td><td class="num tabular">{{ l.pct }}</td><td>{{ l.n_faixa }}</td></tr>
  {% endfor %}
  </tbody>
</table>
{% else %}
<p class="muted">{{ titulo }}: sem estimativa publicada para este recorte.</p>
{% endif %}
{% endmacro %}
"""

_MUNICIPIO = """{% extends "_base.html" %}
{% from "_macros.html" import tabela_perfil %}
{% block content %}
<article>
<h1>Migração em {{ m.nome }}/{{ m.uf_sigla }} (2017-2022)</h1>

<p class="abertura">
  {{ m.nome }}/{{ m.uf_sigla }} tinha uma população de referência (5 anos ou mais em 2022) de
  {{ m.pop5|fmtint }} pessoas. No quinquênio 2017-2022, o município recebeu
  {{ m.imig|fmtint }} imigrantes e perdeu {{ m.emig|fmtint }} emigrantes para outros
  municípios do Brasil, resultando em saldo migratório de {{ m.saldo|fmtsinal }} pessoas
  ({{ m.tlm|fmtdec(2) }} por mil habitantes) e índice de eficácia migratória de
  {{ m.iem|fmtdec(3) if m.iem is not none else "sem estimativa" }}. Isso classifica o
  município, no período, como de <strong>{{ m.classificacao }}</strong> migratória.
  {% if m.imig_ni or m.imig_int %}Além disso, {{ m.imig_ni|fmtint }} chegaram com origem não
  informada e {{ m.imig_int|fmtint }} vieram do exterior.{% endif %}
</p>

<section class="secao">
<h2>Indicadores</h2>
<table class="indicadores">
  <caption>Indicadores migratórios de {{ m.nome }}/{{ m.uf_sigla }}, 2017-2022</caption>
  <thead><tr><th scope="col">Indicador</th><th scope="col" class="num">Estimativa</th><th scope="col" class="num">IC 95%</th><th scope="col">Precisão</th></tr></thead>
  <tbody>
    <tr><th scope="row">Imigrantes</th><td class="num tabular">{{ m.imig|fmtint }}</td><td class="num tabular">{{ m.ic_imig or "sem estimativa" }}</td><td>{{ m.precisao_imig_rotulo }}</td></tr>
    <tr><th scope="row">Emigrantes</th><td class="num tabular">{{ m.emig|fmtint }}</td><td class="num tabular">{{ m.ic_emig or "sem estimativa" }}</td><td>{{ m.precisao_emig_rotulo }}</td></tr>
    <tr><th scope="row">Saldo migratório</th><td class="num tabular">{{ m.saldo|fmtsinal }}</td><td class="num tabular">{{ m.ic_saldo or "sem estimativa" }}</td><td>sem classificação própria (ver imigrantes/emigrantes)</td></tr>
    <tr><th scope="row">Taxa líquida de migração (por mil hab.)</th><td class="num tabular">{{ m.tlm|fmtdec(2) if m.tlm is not none else "sem estimativa" }}</td><td class="num">-</td><td>-</td></tr>
    <tr><th scope="row">Índice de eficácia migratória</th><td class="num tabular">{{ m.iem|fmtdec(3) if m.iem is not none else "sem estimativa" }}</td><td class="num">-</td><td>-</td></tr>
  </tbody>
</table>
<p class="nota">Amostra de imigrantes: {{ m.n_imig_faixa }} observações. Amostra de emigrantes: {{ m.n_emig_faixa }} observações. Intervalo de confiança de 95% calculado como estimativa &plusmn; 1,96 &times; erro-padrão.</p>
</section>

<section class="secao">
<h2>Principais origens e destinos</h2>
<div class="colunas-2">
<table>
  <caption>10 principais origens dos imigrantes de {{ m.nome }}/{{ m.uf_sigla }}</caption>
  <thead><tr><th scope="col">Origem</th><th scope="col" class="num">Pessoas</th><th scope="col">Precisão</th></tr></thead>
  <tbody>
  {% for f in top_origens %}
    <tr><td><a href="/municipio/{{ f.slug }}/">{{ f.nome }}/{{ f.uf }}</a> &middot; <a href="{{ app_link_par(f.cd, m.cd) }}">ver par no atlas</a></td><td class="num tabular">{{ f.total|fmtint }}</td><td>{{ rotulo_precisao(f.precisao) }}</td></tr>
  {% else %}
    <tr><td colspan="3">Sem fluxos de entrada publicados individualmente (abaixo do limiar de revelação).</td></tr>
  {% endfor %}
  </tbody>
</table>
<table>
  <caption>10 principais destinos dos emigrantes de {{ m.nome }}/{{ m.uf_sigla }}</caption>
  <thead><tr><th scope="col">Destino</th><th scope="col" class="num">Pessoas</th><th scope="col">Precisão</th></tr></thead>
  <tbody>
  {% for f in top_destinos %}
    <tr><td><a href="/municipio/{{ f.slug }}/">{{ f.nome }}/{{ f.uf }}</a> &middot; <a href="{{ app_link_par(m.cd, f.cd) }}">ver par no atlas</a></td><td class="num tabular">{{ f.total|fmtint }}</td><td>{{ rotulo_precisao(f.precisao) }}</td></tr>
  {% else %}
    <tr><td colspan="3">Sem fluxos de saída publicados individualmente (abaixo do limiar de revelação).</td></tr>
  {% endfor %}
  </tbody>
</table>
</div>
</section>

<section class="secao">
<h2>Perfil dos migrantes e dos residentes</h2>
{% for direcao, titulo_dir in [("imig","Imigrantes (quem chegou)"), ("emig","Emigrantes (quem saiu)"), ("residente","Residentes não migrantes")] %}
<h3>{{ titulo_dir }}</h3>
{{ tabela_perfil("Status migratório", None, perfil_linhas(direcao, "status")) if direcao != "residente" else "" }}
{{ tabela_perfil("Escolaridade", "pessoas de 25 anos ou mais", perfil_linhas(direcao, "edu")) }}
{{ tabela_perfil("Renda domiciliar per capita", "salários mínimos de 2022", perfil_linhas(direcao, "renda")) }}
{{ tabela_perfil("Idade e sexo", None, perfil_linhas(direcao, "idade_sexo")) }}
{% endfor %}
</section>

<section class="secao">
<h2>Deslocamento pendular (trabalho e estudo)</h2>
{% if pend %}
<table class="indicadores">
  <caption>Indicadores pendulares de {{ m.nome }}/{{ m.uf_sigla }}</caption>
  <tbody>
    <tr><th scope="row">Pessoas ocupadas (10 anos ou mais)</th><td class="num tabular">{{ pend.ocupados|fmtint }}</td></tr>
    <tr><th scope="row">Saem para trabalhar em outro município</th><td class="num tabular">{{ pend.saida_trab|fmtint }}</td></tr>
    <tr><th scope="row">Vêm de outro município para trabalhar aqui</th><td class="num tabular">{{ pend.entrada_trab|fmtint }}</td></tr>
    <tr><th scope="row">Saldo pendular</th><td class="num tabular">{{ pend.saldo_pendular|fmtsinal }}</td></tr>
    <tr><th scope="row">Taxa de saída pendular (%)</th><td class="num tabular">{{ pend.taxa_saida_pendular|fmtdec(2) if pend.taxa_saida_pendular is not none else "sem estimativa" }}</td></tr>
    <tr><th scope="row">Índice de atração pendular</th><td class="num tabular">{{ pend.indice_atracao|fmtdec(3) if pend.indice_atracao is not none else "sem estimativa" }}</td></tr>
    <tr><th scope="row">Tempo mediano de deslocamento</th><td class="num tabular">{{ pend.tempo_mediano|fmtdec(0) ~ " min" if pend.tempo_mediano is not none else "sem estimativa" }}</td></tr>
  </tbody>
</table>
{% else %}
<p class="muted">Sem estimativa pendular publicada para este município.</p>
{% endif %}
{% if m.nm_rm %}<p><a href="/regiao-metropolitana/{{ rm_slug }}/">Este município integra a {{ m.nm_rm }} &rarr; ver a página da região metropolitana</a></p>{% endif %}
</section>

<p class="cta"><a href="/?mun={{ m.cd }}">Abrir {{ m.nome }}/{{ m.uf_sigla }} no atlas interativo &rarr;</a></p>

<section class="secao nota-metodologica">
<h2>Nota metodológica</h2>
<p>
  Estimativas a partir dos microdados da amostra do Censo Demográfico 2022 (IBGE, acesso
  controlado), quesito de migração de data fixa (residência em 31/07/2017 comparada à de
  31/07/2022). Toda estimativa é arredondada a múltiplos de 5 e passou pelo controle
  estatístico de revelação (nenhuma célula com menos de 5 pessoas ou 3 domicílios amostrais).
  Ver <a href="/metodologia/">metodologia completa</a> e <a href="/glossario/">glossário</a>.
</p>
</section>

<section class="secao">
<h2>Como citar esta página</h2>
<p class="citacao">{{ autor_placeholder }}. <em>{{ nome_site }}</em>: {{ m.nome }}/{{ m.uf_sigla }}.
Dados do Censo Demográfico 2022 (IBGE). Versão dos dados: {{ versao_dados }}. Disponível em: {{ canonical }}.
DOI do conjunto de dados: <a href="{{ doi_url }}">{{ doi_url }}</a>.</p>
</section>
</article>
{% endblock %}
"""

_UNIDADE = """{% extends "_base.html" %}
{% block content %}
<article>
<h1>Migração em {{ u.nome }} (2017-2022)</h1>
<p class="abertura">
  {{ u.rotulo_nivel }} com {{ u.n_municipios }} municípios e população de referência de
  {{ u.pop5|fmtint }} pessoas. No quinquênio 2017-2022, a unidade recebeu
  {{ u.imig|fmtint }} imigrantes e perdeu {{ u.emig|fmtint }} emigrantes vindos de/para fora
  de suas fronteiras, saldo de {{ u.saldo|fmtsinal }} ({{ u.tlm|fmtdec(2) if u.tlm is not none else "sem estimativa" }}
  por mil habitantes).
</p>
<p class="nota">
  Migração entre municípios da mesma {{ u.rotulo_nivel_min }} não é contabilizada aqui -- só
  os fluxos que cruzam a fronteira da unidade. Os indicadores desta página são somas diretas
  dos fluxos municipais publicados (excluídos os pares suprimidos pelo controle de revelação),
  não uma nova estimativa amostral: por isso não há erro-padrão nem intervalo de confiança
  neste nível de agregação.
</p>

<section class="secao">
<h2>Principais origens e destinos</h2>
<div class="colunas-2">
<table>
  <caption>10 principais origens dos imigrantes</caption>
  <thead><tr><th scope="col">Origem</th><th scope="col" class="num">Pessoas</th></tr></thead>
  <tbody>
  {% for f in u.top_origens %}<tr><td><a href="{{ f.href }}">{{ f.nome }}</a></td><td class="num tabular">{{ f.total|fmtint }}</td></tr>
  {% else %}<tr><td colspan="2">Sem fluxos publicados individualmente.</td></tr>{% endfor %}
  </tbody>
</table>
<table>
  <caption>10 principais destinos dos emigrantes</caption>
  <thead><tr><th scope="col">Destino</th><th scope="col" class="num">Pessoas</th></tr></thead>
  <tbody>
  {% for f in u.top_destinos %}<tr><td><a href="{{ f.href }}">{{ f.nome }}</a></td><td class="num tabular">{{ f.total|fmtint }}</td></tr>
  {% else %}<tr><td colspan="2">Sem fluxos publicados individualmente.</td></tr>{% endfor %}
  </tbody>
</table>
</div>
</section>

<section class="secao">
<h2>Municípios de {{ u.nome }}</h2>
<table>
  <caption>{{ u.n_municipios }} municípios, com saldo migratório 2017-2022</caption>
  <thead><tr><th scope="col">Município</th><th scope="col" class="num">Saldo</th></tr></thead>
  <tbody>
  {% for mu in u.municipios %}
    <tr><td><a href="/municipio/{{ mu.slug }}/">{{ mu.nm_mun }}/{{ mu.uf_sigla }}</a></td><td class="num tabular">{{ mu.saldo|fmtsinal }}</td></tr>
  {% endfor %}
  </tbody>
</table>
</section>

<p class="cta"><a href="{{ u.app_link }}">Abrir {{ u.nome }} no atlas interativo &rarr;</a></p>
</article>
{% endblock %}
"""

_RM = """{% extends "_base.html" %}
{% block content %}
<article>
<h1>Migração na {{ r.nome }} (2017-2022)</h1>
<p class="abertura">
  {{ r.tipo_extenso }} composta por {{ r.n_municipios }} municípios, núcleo em
  {{ r.nm_nucleo }}, população de referência de {{ r.pop_total|fmtint }} pessoas. No quinquênio
  2017-2022 houve {{ r.mig_intra|fmtint }} migrações internas à própria região (entre seus
  municípios) e saldo migratório externo (com o resto do país) de {{ r.saldo_externo|fmtsinal }}.
</p>

<section class="secao">
<h2>Matriz núcleo &times; periferia (migração intrametropolitana)</h2>
<table class="indicadores">
  <tbody>
    <tr><th scope="row">Núcleo &rarr; periferia</th><td class="num tabular">{{ r.nucleo_periferia|fmtint }}</td></tr>
    <tr><th scope="row">Periferia &rarr; núcleo</th><td class="num tabular">{{ r.periferia_nucleo|fmtint }}</td></tr>
    <tr><th scope="row">Periferia &rarr; periferia</th><td class="num tabular">{{ r.periferia_periferia|fmtint }}</td></tr>
    <tr><th scope="row">Entradas externas (resto do país)</th><td class="num tabular">{{ r.entradas_externas|fmtint }}</td></tr>
    <tr><th scope="row">Saídas externas (resto do país)</th><td class="num tabular">{{ r.saidas_externas|fmtint }}</td></tr>
  </tbody>
</table>

<h3>10 maiores fluxos migratórios intra-RM</h3>
<table>
  <thead><tr><th scope="col">Origem</th><th scope="col">Destino</th><th scope="col">Tipologia</th><th scope="col" class="num">Pessoas</th></tr></thead>
  <tbody>
  {% for f in r.top_intra %}
    <tr><td><a href="/municipio/{{ f.slug_o }}/">{{ f.nome_o }}</a></td><td><a href="/municipio/{{ f.slug_d }}/">{{ f.nome_d }}</a></td><td>{{ f.tipologia }}</td><td class="num tabular">{{ f.total|fmtint }}</td></tr>
  {% else %}<tr><td colspan="4">Sem fluxos intra-RM publicados individualmente.</td></tr>{% endfor %}
  </tbody>
</table>
</section>

<section class="secao">
<h2>Deslocamento pendular</h2>
<table class="indicadores">
  <tbody>
    <tr><th scope="row">Ocupados na região</th><td class="num tabular">{{ r.ocupados|fmtint }}</td></tr>
    <tr><th scope="row">Pendulares (trabalham fora do município de residência)</th><td class="num tabular">{{ r.pendulares|fmtint }}</td></tr>
    <tr><th scope="row">% de pendulares entre os ocupados</th><td class="num tabular">{{ r.pct_pendular|fmtdec(1) if r.pct_pendular is not none else "sem estimativa" }}</td></tr>
    <tr><th scope="row">Tempo mediano de deslocamento</th><td class="num tabular">{{ (r.tempo_mediano|fmtdec(0) ~ " min") if r.tempo_mediano is not none else "sem estimativa" }}</td></tr>
    <tr><th scope="row">% em transporte coletivo</th><td class="num tabular">{{ r.pct_coletivo|fmtdec(1) if r.pct_coletivo is not none else "sem estimativa" }}</td></tr>
  </tbody>
</table>
</section>

<section class="secao">
<h2>Migrantes e trabalho</h2>
<p class="nota">Soma dos municípios da região (rm_mig_pendular_resumo): entre quem migrou
dentro da própria região metropolitana e estava ocupado, para onde foi trabalhar.</p>
<table class="indicadores">
  <tbody>
    <tr><th scope="row">Migrantes intra-RM</th><td class="num tabular">{{ r.mp.migrantes_intra|fmtint }}</td></tr>
    <tr><th scope="row">... ocupados</th><td class="num tabular">{{ r.mp.mig_ocupados|fmtint }}</td></tr>
    <tr><th scope="row">... pendulares (trabalham fora de onde passaram a morar)</th><td class="num tabular">{{ r.mp.mig_pendulares|fmtint }}</td></tr>
    <tr><th scope="row">... voltam a trabalhar na origem de onde saíram</th><td class="num tabular">{{ r.mp.pendular_para_origem|fmtint }}</td></tr>
    <tr><th scope="row">... passam a trabalhar no núcleo</th><td class="num tabular">{{ r.mp.pendular_para_nucleo|fmtint }}</td></tr>
    <tr><th scope="row">... trabalham onde passaram a morar</th><td class="num tabular">{{ r.mp.trabalha_onde_mora|fmtint }}</td></tr>
  </tbody>
</table>
</section>

<section class="secao">
<h2>Municípios da {{ r.nome }}</h2>
<table>
  <thead><tr><th scope="col">Município</th><th scope="col">Núcleo</th><th scope="col" class="num">Saldo migratório</th></tr></thead>
  <tbody>
  {% for mu in r.municipios %}
    <tr><td><a href="/municipio/{{ mu.slug }}/">{{ mu.nm_mun }}/{{ mu.uf_sigla }}</a></td><td>{{ "Sim" if mu.nucleo else "" }}</td><td class="num tabular">{{ mu.saldo|fmtsinal }}</td></tr>
  {% endfor %}
  </tbody>
</table>
</section>

<p class="cta"><a href="/?rm={{ r.cd_rm }}">Abrir {{ r.nome }} no atlas interativo &rarr;</a></p>
</article>
{% endblock %}
"""


def _tpl_indice(titulo: str, corpo: str) -> str:
    return '{% extends "_base.html" %}\n{% block content %}\n<article>\n<h1>' + titulo + \
        '</h1>\n' + corpo + '\n</article>\n{% endblock %}\n'


TEMPLATES = {
    "_base.html": _BASE,
    "_macros.html": _MACROS,
    "municipio.html": _MUNICIPIO,
    "unidade.html": _UNIDADE,
    "rm.html": _RM,
}


def registrar_env() -> jinja2.Environment:
    env = jinja2.Environment(
        loader=jinja2.DictLoader(TEMPLATES),
        autoescape=jinja2.select_autoescape(["html"]),
        trim_blocks=True, lstrip_blocks=True,
    )

    def jsonld_filter(obj):
        s = json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
        return Markup(s.replace("</", "<\\/"))

    env.filters["jsonld"] = jsonld_filter
    env.filters["fmtint"] = fmt_int
    env.filters["fmtsinal"] = fmt_sinal
    env.filters["fmtdec"] = fmt_dec
    env.filters["fmtpct"] = fmt_pct100
    return env


# ============================== geração ==============================
class Gerador:
    def __init__(self, site_url: str, dados: dict[str, Any]):
        self.site_url = site_url.rstrip("/")
        self.d = dados
        self.env = registrar_env()
        self.paginas: list[str] = []  # caminhos relativos (para o sitemap)
        self.tamanhos: list[int] = []

    def url(self, caminho: str) -> str:
        return f"{self.site_url}{caminho}"

    def escrever(self, caminho: str, html: str) -> None:
        """`caminho` sempre termina com '/'; escreve <caminho>/index.html."""
        destino = DIST / caminho.lstrip("/") / "index.html"
        destino.parent.mkdir(parents=True, exist_ok=True)
        destino.write_text(html, encoding="utf-8")
        self.paginas.append(caminho)
        self.tamanhos.append(len(html.encode("utf-8")))

    def base_ctx(self, **extra) -> dict:
        ctx = dict(
            nome_site=NOME_SITE, site_url=self.site_url, aviso=AVISO, fonte=FONTE,
            versao_dados=VERSAO_DADOS, autor_placeholder=AUTOR_NOME,
            doi_url=f"https://doi.org/{DOI_CONCEITO}",
        )
        ctx.update(extra)
        return ctx

    def render(self, template_nome: str, caminho: str, **ctx) -> None:
        tpl = self.env.get_template(template_nome)
        html = tpl.render(**self.base_ctx(canonical=self.url(caminho), **ctx))
        self.escrever(caminho, html)

    def breadcrumbs_urls(self, itens: list[tuple[str, str | None]], canonical_path: str) -> list[dict]:
        out = []
        for i, (label, href) in enumerate(itens, start=1):
            out.append({"@type": "ListItem", "position": i, "name": label,
                        "item": self.url(href or canonical_path)})
        return out

    def jsonld_pagina(self, titulo: str, descricao: str, canonical_path: str,
                       about: dict | None = None, breadcrumbs=None, extra: list[dict] | None = None) -> list[dict]:
        objs = []
        if breadcrumbs:
            objs.append({"@context": "https://schema.org", "@type": "BreadcrumbList",
                         "itemListElement": self.breadcrumbs_urls(breadcrumbs, canonical_path)})
        webpage = {
            "@context": "https://schema.org", "@type": "WebPage", "name": titulo,
            "description": descricao, "url": self.url(canonical_path), "inLanguage": "pt-BR",
            "isPartOf": {"@type": "WebSite", "name": NOME_SITE, "url": self.url("/")},
        }
        if about:
            webpage["about"] = about
        objs.append(webpage)
        if extra:
            objs.extend(extra)
        return objs

    # ---------------------------- municípios ----------------------------
    def gerar_municipios(self) -> None:
        d = self.d
        for cd, m in d["mun_by_cd"].items():
            slug = slug_municipio(m["nm_mun"], m["uf_sigla"], cd)
            caminho = f"/municipio/{slug}/"

            saldo = m["saldo"]
            classificacao = "equilíbrio" if not saldo else ("atração" if saldo > 0 else "evasão")
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
                for cat, valor, n_faixa in sorted(itens, key=lambda x: -x[1]):
                    linhas.append({
                        "rotulo": rotulo(dimensao, cat), "valor": valor,
                        "pct": fmt_pct100(100 * valor / total), "n_faixa": n_faixa,
                    })
                return linhas

            pend = d["pend_by_cd"].get(cd)
            rm_slug_val = None
            if m.get("cd_rm") and m.get("nm_rm"):
                rm_slug_val = slug_unidade(m["nm_rm"], m["cd_rm"])

            precisao_emig = precisao_de(m.get("cv_emig"))

            ctx_m = dict(
                cd=cd, nome=m["nm_mun"], uf_sigla=m["uf_sigla"], pop=m["pop"], pop5=m["pop5"],
                imig=m["imig"], imig_ni=m["imig_ni"], imig_int=m["imig_int"], emig=m["emig"],
                saldo=saldo, tlm=m["tlm"], iem=m["iem"], classificacao=classificacao,
                nm_rm=m.get("nm_rm"),
                n_imig_faixa=m["n_imig_faixa"], n_emig_faixa=m["n_emig_faixa"],
                precisao_imig_rotulo=ROTULO_PRECISAO.get(m["precisao_imig"], m["precisao_imig"]),
                precisao_emig_rotulo=ROTULO_PRECISAO.get(precisao_emig, precisao_emig),
                ic_imig=ic95(m["imig"], m.get("se_imig")), ic_emig=ic95(m["emig"], m.get("se_emig")),
                ic_saldo=ic95(saldo, m.get("se_saldo")),
            )

            titulo = f"Migração em {m['nm_mun']}/{m['uf_sigla']} (2017-2022)"
            if len(titulo) > 60:
                titulo = f"Migração em {m['nm_mun']}/{m['uf_sigla']}"
            descricao = (f"Saldo migratório, imigrantes, emigrantes e perfil dos migrantes de "
                         f"{m['nm_mun']}/{m['uf_sigla']} entre 2017 e 2022, a partir do Censo 2022 do IBGE.")[:160]

            breadcrumbs = [(NOME_SITE, "/"), ("Municípios", "/municipios/"),
                           (m["uf_sigla"], f"/uf/{m['uf_sigla'].lower()}/"), (m["nm_mun"], None)]
            about = {
                "@type": "AdministrativeArea", "name": f"{m['nm_mun']}/{m['uf_sigla']}",
                "identifier": cd,
                "containedInPlace": {"@type": "AdministrativeArea", "name": ref.get("uf_nome", m["uf_sigla"]),
                                      "identifier": m["uf"]},
            }
            jsonld_objs = self.jsonld_pagina(titulo, descricao, caminho, about, breadcrumbs)

            def app_link_par(o, dd):
                return f"/?o={o}&d={dd}"

            self.render(
                "municipio.html", caminho, title=titulo, description=descricao,
                breadcrumbs=breadcrumbs, jsonld_objs=jsonld_objs, app_link=f"/?mun={cd}",
                m=ctx_m, top_origens=top_origens, top_destinos=top_destinos,
                perfil_linhas=perfil_linhas, pend=pend, rm_slug=rm_slug_val,
                app_link_par=app_link_par, rotulo_precisao=lambda p: ROTULO_PRECISAO.get(p, p),
            )

    # ---------------------------- unidades agregadas (uf/rgi/rgint) ----------------------------
    def gerar_unidades(self, nivel: str) -> None:
        d = self.d
        info = {"uf": d["uf_info"], "rgi": d["rgi_info"], "rgint": d["rgint_info"]}[nivel]
        muns_por = {"uf": d["muns_por_uf"], "rgi": d["muns_por_rgi"], "rgint": d["muns_por_rgint"]}[nivel]
        rotulo_nivel = {"uf": "Unidade da Federação", "rgi": "Região imediata", "rgint": "Região intermediária"}[nivel]
        prefixo_url = {"uf": "/uf/", "rgi": "/regiao-imediata/", "rgint": "/regiao-intermediaria/"}[nivel]
        fluxos_df = d["fluxos_nivel"][nivel]

        imig_por_codigo = fluxos_df.groupby("destino")["total"].sum().to_dict()
        emig_por_codigo = fluxos_df.groupby("origem")["total"].sum().to_dict()
        fluxos_ord = fluxos_df.sort_values("total", ascending=False)
        top_dest = {k: v.to_dict("records") for k, v in fluxos_ord.groupby("origem", sort=False).head(10).groupby("origem")}
        top_orig = {k: v.to_dict("records") for k, v in fluxos_ord.groupby("destino", sort=False).head(10).groupby("destino")}

        for codigo, meta_u in info.items():
            nome = meta_u["nome"] if nivel != "uf" else meta_u["nome"]
            if nivel == "uf":
                nome_completo = meta_u["nome"]
                slug = meta_u["sigla"].lower()
                caminho = f"{prefixo_url}{slug}/"
                app_link = f"/?n=uf&sel={codigo}"
            else:
                nome_completo = nome
                slug = slug_unidade(nome, codigo)
                caminho = f"{prefixo_url}{slug}/"
                app_link = f"/?n={nivel}&sel={codigo}"

            municipios_da_unidade = sorted(muns_por.get(codigo, []), key=lambda r: -(r["saldo"] or 0))
            pop5_total = sum(r["pop5"] or 0 for r in municipios_da_unidade)
            imig_t = imig_por_codigo.get(codigo, 0.0)
            emig_t = emig_por_codigo.get(codigo, 0.0)
            saldo_t = imig_t - emig_t
            tlm_t = (saldo_t / pop5_total * 1000) if pop5_total else None

            uf_sigla_da_unidade = d["uf_info"].get(meta_u.get("uf", codigo), {}).get("sigla") if nivel != "uf" else meta_u["sigla"]

            def enriquecer_unidade(rows, campo):
                out = []
                for r in rows:
                    outro = r[campo]
                    if nivel == "uf":
                        oi = d["uf_info"].get(outro)
                        if not oi:
                            continue
                        href = f"/uf/{oi['sigla'].lower()}/"
                        nome_o = f"{oi['nome']} ({oi['sigla']})"
                    else:
                        oi = info.get(outro)
                        if not oi:
                            continue
                        href = f"{prefixo_url}{slug_unidade(oi['nome'], outro)}/"
                        nome_o = oi["nome"]
                    out.append({"href": href, "nome": nome_o, "total": r["total"]})
                return out

            u = dict(
                nome=nome_completo, rotulo_nivel=rotulo_nivel, rotulo_nivel_min=rotulo_nivel.lower(),
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

            titulo = f"Migração em {nome_completo} (2017-2022)"
            if len(titulo) > 60:
                titulo = f"Migração em {nome_completo}"[:60]
            descricao = (f"Saldo migratório e principais fluxos de {nome_completo} entre 2017 e "
                         f"2022, a partir do Censo Demográfico 2022 do IBGE.")[:160]
            rotulo_pai = "UFs" if nivel == "uf" else ("Regiões imediatas" if nivel == "rgi" else "Regiões intermediárias")
            href_pai = "/ufs/" if nivel == "uf" else "/regioes/"
            breadcrumbs = [(NOME_SITE, "/"), (rotulo_pai, href_pai), (nome_completo, None)]
            uf_nome_pai = d["uf_info"].get(meta_u.get("uf", codigo), {}).get("nome", "Brasil") if nivel != "uf" else "Brasil"
            about = {"@type": "AdministrativeArea", "name": nome_completo, "identifier": codigo,
                     "containedInPlace": {"@type": ("Country" if nivel == "uf" else "AdministrativeArea"), "name": uf_nome_pai}}
            jsonld_objs = self.jsonld_pagina(titulo, descricao, caminho, about, breadcrumbs)

            self.render("unidade.html", caminho, title=titulo, description=descricao,
                        breadcrumbs=breadcrumbs, jsonld_objs=jsonld_objs, app_link=app_link, u=u)

    # ---------------------------- regiões metropolitanas ----------------------------
    def gerar_rms(self) -> None:
        d = self.d
        for cd_rm, resumo in d["rm_resumo_by_cd"].items():
            nome = resumo["nm_rm"]
            slug = slug_unidade(nome, cd_rm)
            caminho = f"/regiao-metropolitana/{slug}/"
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
                    "tipologia": f["tipologia"], "total": f["total"],
                })

            mp = d["mig_pend_soma_por_rm"].get(cd_rm, {})
            tipo_extenso = "Região Integrada de Desenvolvimento (RIDE)" if resumo["tipo"] == "RIDE" else "Região Metropolitana"

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

            titulo = f"Migração na {nome} (2017-2022)"
            if len(titulo) > 60:
                titulo = f"Migração na {nome}"[:60]
            descricao = (f"Migração intrametropolitana, deslocamento pendular e núcleo x "
                         f"periferia da {nome} entre 2017 e 2022, Censo 2022 (IBGE).")[:160]
            breadcrumbs = [(NOME_SITE, "/"), ("Regiões metropolitanas", "/regioes-metropolitanas/"), (nome, None)]
            about = {"@type": "AdministrativeArea", "name": nome, "identifier": cd_rm,
                     "containedInPlace": {"@type": "Country", "name": "Brasil"}}
            jsonld_objs = self.jsonld_pagina(titulo, descricao, caminho, about, breadcrumbs)

            self.render("rm.html", caminho, title=titulo, description=descricao,
                        breadcrumbs=breadcrumbs, jsonld_objs=jsonld_objs, app_link=f"/?rm={cd_rm}", r=r_ctx)

    # ---------------------------- índices ----------------------------
    def gerar_indices(self) -> None:
        d = self.d

        # /municipios/ -- lista por UF
        ufs_ordenadas = sorted(d["uf_info"].items(), key=lambda kv: kv[1]["nome"])
        blocos = []
        for cd_uf, info in ufs_ordenadas:
            muns = sorted(d["muns_por_uf"].get(cd_uf, []), key=lambda r: r["nm_mun"])
            itens = "".join(
                f'<li><a href="/municipio/{slug_municipio(m["nm_mun"], m["uf_sigla"], m["cd_mun"])}/">{m["nm_mun"]}</a></li>'
                for m in muns
            )
            blocos.append(
                f'<section class="secao"><h2 id="uf-{info["sigla"].lower()}">{info["nome"]} ({info["sigla"]}) '
                f'&middot; <a href="/uf/{info["sigla"].lower()}/">página da UF</a></h2>'
                f'<details><summary>{len(muns)} municípios</summary><ul class="lista-municipios">{itens}</ul></details></section>'
            )
        corpo = ('<p>Os 5.570 municípios brasileiros publicados no atlas, agrupados por UF. '
                 'Veja também a <a href="/ufs/">lista de UFs</a> e as '
                 '<a href="/regioes-metropolitanas/">regiões metropolitanas</a>.</p>' + "".join(blocos))
        self._pagina_indice("/municipios/", "Municípios do atlas por UF",
                             "Lista dos 5.570 municípios brasileiros com dados de migração interna publicados, agrupados por UF.",
                             corpo)

        # /ufs/
        itens = "".join(
            f'<li><a href="/uf/{info["sigla"].lower()}/">{info["nome"]} ({info["sigla"]})</a></li>'
            for _, info in ufs_ordenadas
        )
        corpo = f'<p>As 27 Unidades da Federação com indicadores agregados de migração interna.</p><ul class="lista-uf">{itens}</ul>'
        self._pagina_indice("/ufs/", "Unidades da Federação",
                             "As 27 Unidades da Federação brasileiras com indicadores agregados de migração interna, Censo 2022.", corpo)

        # /regioes-metropolitanas/
        rms_ordenadas = sorted(d["rm_resumo_by_cd"].items(), key=lambda kv: kv[1]["nm_rm"])
        itens = "".join(
            f'<li><a href="/regiao-metropolitana/{slug_unidade(r["nm_rm"], cd)}/">{r["nm_rm"]}</a> '
            f'<span class="muted">({r["tipo"]}, {r["n_municipios"]} municípios)</span></li>'
            for cd, r in rms_ordenadas
        )
        corpo = f'<p>As 81 regiões metropolitanas e RIDEs do Brasil, com o módulo de migração intrametropolitana e pendular.</p><ul>{itens}</ul>'
        self._pagina_indice("/regioes-metropolitanas/", "Regiões metropolitanas e RIDEs",
                             "As 81 regiões metropolitanas e RIDEs do Brasil com migração intrametropolitana e deslocamento pendular, Censo 2022.", corpo)

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
                lst = sorted(mapa.get(cd_uf, []), key=lambda x: x[1])
                if not lst:
                    continue
                itens = "".join(f'<li><a href="{prefixo}{slug_unidade(nome, cd)}/">{nome}</a></li>' for cd, nome in lst)
                partes.append(f'<details><summary>{info["nome"]} ({info["sigla"]}) &middot; {len(lst)}</summary><ul>{itens}</ul></details>')
            return "".join(partes)

        corpo = ('<p>510 regiões imediatas e 133 regiões intermediárias (divisão territorial do '
                 'IBGE), com indicadores agregados de migração interna.</p>'
                 + bloco_regiao(rgi_por_uf, "/regiao-imediata/", "Regiões imediatas")
                 + bloco_regiao(rgint_por_uf, "/regiao-intermediaria/", "Regiões intermediárias"))
        self._pagina_indice("/regioes/", "Regiões imediatas e intermediárias",
                             "As 510 regiões imediatas e 133 regiões intermediárias do IBGE, com indicadores agregados de migração interna, Censo 2022.", corpo)

    def _pagina_indice(self, caminho: str, titulo: str, descricao: str, corpo_html: str) -> None:
        breadcrumbs = [(NOME_SITE, "/"), (titulo, None)]
        jsonld_objs = self.jsonld_pagina(titulo, descricao, caminho, None, breadcrumbs)
        tpl = self.env.from_string(_tpl_indice(titulo, corpo_html))
        html = tpl.render(**self.base_ctx(canonical=self.url(caminho), title=titulo, description=descricao,
                                           breadcrumbs=breadcrumbs, jsonld_objs=jsonld_objs, app_link="/"))
        self.escrever(caminho, html)

    # ---------------------------- páginas de conteúdo fixo ----------------------------
    def gerar_achados(self) -> None:
        d = self.d
        municipios = list(d["mun_by_cd"].values())
        top_saldo_pos = sorted(municipios, key=lambda r: -(r["saldo"] or 0))[:10]
        top_saldo_neg = sorted(municipios, key=lambda r: (r["saldo"] or 0))[:10]
        top_fluxos = d["fluxos"].sort_values("total", ascending=False).head(10).to_dict("records")

        def linha_mun(m):
            return (f'<tr><td><a href="/municipio/{slug_municipio(m["nm_mun"], m["uf_sigla"], m["cd_mun"])}/">'
                    f'{m["nm_mun"]}/{m["uf_sigla"]}</a></td><td class="num tabular">{fmt_sinal(m["saldo"])}</td></tr>')

        def linha_fluxo(f):
            mo, md = d["mun_by_cd"].get(f["origem"]), d["mun_by_cd"].get(f["destino"])
            if not mo or not md:
                return ""
            so, sd = slug_municipio(mo["nm_mun"], mo["uf_sigla"], f["origem"]), slug_municipio(md["nm_mun"], md["uf_sigla"], f["destino"])
            return (f'<tr><td><a href="/municipio/{so}/">{mo["nm_mun"]}/{mo["uf_sigla"]}</a> &rarr; '
                    f'<a href="/municipio/{sd}/">{md["nm_mun"]}/{md["uf_sigla"]}</a> &middot; '
                    f'<a href="/?o={f["origem"]}&amp;d={f["destino"]}">ver no atlas</a></td>'
                    f'<td class="num tabular">{fmt_int(f["total"])}</td></tr>')

        corpo = f"""
<p>Três achados-chave da pesquisa, já validados na metodologia (ver <a href="/metodologia/">metodologia</a>
e <code>docs/qa/F2b_relatorio.md</code>), e os maiores saldos e fluxos publicados.</p>

<section class="secao achado">
<h2>Desconcentração residencial sem desconcentração produtiva</h2>
<p>Entre os ocupados que saíram do núcleo metropolitano para a periferia entre 2017 e 2022,
<strong>46,5%</strong> continuam trabalhando no núcleo -- a moradia se deslocou, o emprego não.
Na RIDE do Distrito Federal, essa taxa chega a <strong>59,3%</strong>.
<a href="/regiao-metropolitana/{slug_unidade("Região Integrada de Desenvolvimento do Distrito Federal e Entorno", "7801")}/">Ver a RIDE-DF &rarr;</a></p>
</section>

<section class="secao achado">
<h2>Seletividade educacional no fluxo Rio de Janeiro &rarr; São Paulo</h2>
<p>Entre os migrantes de 25 anos ou mais que saíram do Rio de Janeiro para São Paulo,
<strong>75,1%</strong> têm superior completo -- uma seletividade educacional acentuada.
<a href="/?o=3304557&amp;d=3550308">Ver o fluxo no atlas &rarr;</a></p>
</section>

<section class="secao achado">
<h2>O maior par pendular do país</h2>
<p>Guarulhos &rarr; São Paulo é o maior par pendular de trabalho do Brasil:
<strong>77.500 pessoas</strong> moram em Guarulhos e trabalham em São Paulo.
<a href="/?rm=4901&amp;aba=trab&amp;o=3518800&amp;d=3550308">Ver o par pendular &rarr;</a></p>
</section>

<section class="secao">
<h2>12,9 milhões de pessoas mudaram de município</h2>
<p>No quinquênio 2017-2022, 12,9 milhões de pessoas migraram entre os 5.570 municípios
brasileiros, resultando em 53.097 pares origem-destino publicados após o controle de revelação.</p>
</section>

<section class="secao">
<h2>10 maiores saldos migratórios positivos</h2>
<table><thead><tr><th scope="col">Município</th><th scope="col" class="num">Saldo</th></tr></thead>
<tbody>{"".join(linha_mun(m) for m in top_saldo_pos)}</tbody></table>
</section>

<section class="secao">
<h2>10 maiores saldos migratórios negativos</h2>
<table><thead><tr><th scope="col">Município</th><th scope="col" class="num">Saldo</th></tr></thead>
<tbody>{"".join(linha_mun(m) for m in top_saldo_neg)}</tbody></table>
</section>

<section class="secao">
<h2>10 maiores fluxos migratórios do país</h2>
<table><thead><tr><th scope="col">Fluxo</th><th scope="col" class="num">Pessoas</th></tr></thead>
<tbody>{"".join(linha_fluxo(f) for f in top_fluxos)}</tbody></table>
</section>
"""
        self._pagina_indice("/achados/", "Principais achados do atlas",
                             "Os principais achados de migração interna do Censo 2022: desconcentração metropolitana, seletividade educacional, maior par pendular e maiores saldos e fluxos.",
                             corpo)

    def gerar_metodologia(self) -> None:
        r = META["revelacao"]
        corpo = f"""
<p>Versão estática da página de metodologia do atlas interativo. Ver também
<a href="/glossario/">glossário</a> e o documento completo <code>docs/METODOLOGIA.md</code>
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
faixa de precisão pelo coeficiente de variação (CV): <strong>boa</strong> (CV até {r['cv_boa']}%),
<strong>usar com cautela</strong> (CV entre {r['cv_boa']}% e {r['cv_cautela']}%), <strong>baixa
precisão</strong> (CV acima de {r['cv_cautela']}%).</p></section>

<section class="secao"><h2>Controle de revelação</h2>
<p>Antes da publicação, um gate automático (regras R1-R9) impede que qualquer célula
individualize alguém: nenhum fluxo ou categoria com menos de {r['min_pessoas']} pessoas
(estimativa ponderada) ou {r['min_domicilios']} domicílios amostrais; detalhamento por
característica só para fluxos com pelo menos {r['min_pessoas_detalhe']} observações amostrais;
toda contagem ponderada arredondada a múltiplos de {r['arredondamento']}; nenhuma contagem
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
<p>{AUTOR_NOME}. <em>Atlas da migração interna no Brasil</em>. Dados do Censo Demográfico 2022
(IBGE). DOI: <a href="https://doi.org/{DOI_CONCEITO}">{DOI_CONCEITO}</a> (todas as versões) /
<a href="https://doi.org/{DOI_VERSAO}">{DOI_VERSAO}</a> (v1.0.0).</p>
<p>Dados e conteúdo sob <a href="{LICENCA_DADOS_URL}">CC BY 4.0</a>, com atribuição ao IBGE
como fonte primária. Metadados estruturados em
<a href="https://github.com/atlas-da-migracao/atlas-da-migracao.github.io/blob/main/CITATION.cff">CITATION.cff</a>.</p>
</section>

<section class="secao"><h2>Aviso padrão</h2><p class="aviso">{AVISO}</p></section>
"""
        self._pagina_indice("/metodologia/", "Metodologia do atlas",
                             "Fonte, definições, fórmulas dos indicadores e regras de controle de revelação do Atlas da migração interna, Censo 2022.",
                             corpo)

    def gerar_glossario(self) -> None:
        itens = [
            ("Data fixa", "Método de medir migração comparando o município de residência em duas datas "
             "fixas (31/07/2017 e 31/07/2022), em vez do histórico completo de mudanças no período."),
            ("Saldo migratório", "Diferença entre imigrantes e emigrantes de uma unidade territorial "
             "num período. Positivo indica ganho populacional líquido por migração; negativo, perda."),
            ("Taxa líquida de migração (TLM)", "Saldo migratório dividido pela população de referência, "
             "multiplicado por 1.000 -- expressa o saldo por mil habitantes, para comparar unidades de tamanhos diferentes."),
            ("Índice de eficácia migratória (IEM)", "Saldo dividido pela soma de imigrantes e emigrantes, "
             "entre -1 e 1. Perto de zero indica trocas equilibradas (alto volume nos dois sentidos); "
             "perto de ±1, um fluxo predominantemente unidirecional."),
            ("Migração de retorno", "Migração em que o destino coincide com o município de nascimento "
             "da pessoa -- ela está voltando a morar onde nasceu."),
            ("Migração de etapas múltiplas", "Migração em que o destino não é nem o município de "
             "nascimento nem o de retorno direto -- a pessoa já havia migrado antes."),
            ("Deslocamento pendular", "Trabalhar ou estudar em um município diferente do de residência, "
             "sem mudar de domicílio -- captado à parte da migração propriamente dita."),
            ("Região metropolitana", "Agrupamento institucional de municípios em torno de um núcleo "
             "(o homônimo da região; sem homônimo, o mais populoso), definido por lei estadual ou federal (RIDE); usado para estudar migração e pendularidade intrametropolitanas."),
            ("Área de ponderação", "Unidade geográfica mínima de disseminação dos microdados do "
             "Censo, usada aqui como estrato no cálculo do erro amostral."),
            ("Coeficiente de variação (CV)", "Erro-padrão dividido pela estimativa, em percentual -- "
             "mede a precisão relativa de uma estimativa amostral. Quanto menor, mais precisa."),
            ("Controle de revelação", "Conjunto de regras estatísticas (supressão de células pequenas, "
             "arredondamento, faixas de contagem) aplicado antes da publicação para impedir que os "
             "dados agregados permitam identificar uma pessoa ou domicílio individual."),
        ]
        corpo = "<dl class='glossario'>" + "".join(f"<dt>{t}</dt><dd>{d}</dd>" for t, d in itens) + "</dl>"
        self._pagina_indice("/glossario/", "Glossário do atlas",
                             "Definições dos principais termos do Atlas da migração interna: saldo migratório, taxa líquida, IEM, migração de retorno, pendularidade e controle de revelação.",
                             corpo)

    def gerar_dados(self) -> None:
        tabelas = [
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
        linhas = "".join(
            f'<tr><td><a href="/data/{nome}">{nome}</a></td><td>{desc}</td></tr>' for nome, desc in tabelas
        )
        corpo = f"""
<p>Todas as tabelas abaixo já passaram pelo controle estatístico de revelação (R1-R9): células
pequenas suprimidas, valores arredondados a múltiplos de {META['revelacao']['arredondamento']},
contagens amostrais apenas em faixas. Formato: Apache Parquet.</p>

<section class="secao"><h2>Dicionário resumido</h2>
<table><thead><tr><th scope="col">Arquivo</th><th scope="col">Conteúdo</th></tr></thead>
<tbody>{linhas}</tbody></table></section>

<section class="secao"><h2>Licença</h2>
<p>Os dados agregados publicados aqui (tabelas Parquet, páginas estáticas e conteúdo
textual do atlas) estão sob a licença
<a href="{LICENCA_DADOS_URL}">{LICENCA_DADOS_NOME}</a>, com atribuição obrigatória ao IBGE
como fonte primária. O código-fonte do projeto está sob licença {LICENCA_CODIGO_NOME}
(repositório no GitHub). Os microdados originais do Censo 2022 são de acesso controlado do
IBGE e NÃO estão incluídos neste site nem no repositório: permanecem sujeitos aos termos de
uso do IBGE. As tabelas agregadas e arredondadas aqui publicadas passaram pelo controle
estatístico de revelação e não permitem reidentificação individual.</p></section>

<section class="secao"><h2>Como citar</h2>
<p class="citacao">{AUTOR_NOME}. <em>{NOME_SITE}</em>. Dados do Censo Demográfico 2022
(IBGE). Versão dos dados: {VERSAO_DADOS}. DOI: {DOI_PLACEHOLDER}. Disponível em: {self.url('/')}.</p>
<p class="nota">{ATRIBUICAO_PADRAO}</p></section>

<section class="secao"><h2>Fonte e aviso</h2>
<p>Fonte: {FONTE}.</p>
<p class="aviso">{AVISO}</p></section>
"""
        breadcrumbs = [(NOME_SITE, "/"), ("Dados publicados", None)]
        titulo = "Dados publicados do atlas"
        descricao = "Dicionário das tabelas Parquet publicadas pelo Atlas da migração interna, com licença e como citar os dados do Censo 2022."
        dataset = {
            "@context": "https://schema.org", "@type": "Dataset",
            "name": f"{NOME_SITE} -- dados publicados", "description": descricao,
            "creator": {"@type": "Person", "name": AUTOR_NOME, "url": AUTOR_GITHUB_URL, "sameAs": AUTOR_ORCID},
            "identifier": f"https://doi.org/{DOI_CONCEITO}",
            "license": LICENCA_DADOS_URL,
            "temporalCoverage": "2017-07-31/2022-07-31",
            "spatialCoverage": {"@type": "Place", "name": "Brasil"},
            "isBasedOn": {"@type": "Dataset", "name": "Censo Demográfico 2022 -- IBGE",
                          "creator": {"@type": "Organization", "name": "Instituto Brasileiro de Geografia e Estatística (IBGE)"}},
            "distribution": [
                {"@type": "DataDownload", "contentUrl": self.url(f"/data/{nome}"), "encodingFormat": "application/vnd.apache.parquet"}
                for nome, _ in tabelas
            ],
            "keywords": ["migração interna", "Censo 2022", "IBGE", "demografia", "municípios do Brasil"],
            "variableMeasured": ["imigrantes", "emigrantes", "saldo migratório", "taxa líquida de migração",
                                  "índice de eficácia migratória", "deslocamento pendular"],
        }
        jsonld_objs = self.jsonld_pagina(titulo, descricao, "/dados/", None, breadcrumbs, extra=[dataset])
        tpl = self.env.from_string(_tpl_indice(titulo, corpo))
        html = tpl.render(**self.base_ctx(canonical=self.url("/dados/"), title=titulo, description=descricao,
                                           breadcrumbs=breadcrumbs, jsonld_objs=jsonld_objs, app_link="/"))
        self.escrever("/dados/", html)

    def gerar_sobre(self) -> None:
        vinculo = AUTOR_VINCULO_INSTITUCIONAL or "não informado"
        corpo = f"""
<p>O Atlas da migração interna no Brasil reúne, num único painel navegável, os fluxos de
migração interna, o deslocamento pendular e o módulo metropolitano do Censo Demográfico 2022
do IBGE, no nível de município, região imediata, região intermediária e UF.</p>

<section class="secao"><h2>Quem fez</h2>
<p>{AUTOR_NOME} (GitHub: <a href="{AUTOR_GITHUB_URL}">@{AUTOR_GITHUB_USER}</a>).
Vínculo institucional: {vinculo}.</p></section>

<section class="secao"><h2>Política de uso dos microdados</h2>
<p>Os microdados da amostra do Censo Demográfico 2022 usados neste projeto são de acesso
controlado do IBGE. Nenhum registro individual é publicado: todas as tabelas disponíveis em
<a href="/dados/">/dados/</a> passaram por um gate automático de controle estatístico de
revelação (supressão de células pequenas, arredondamento, faixas de contagem amostral) antes
de sair do ambiente controlado.</p></section>

<section class="secao"><h2>Licenças</h2>
<p>Dados agregados e conteúdo textual sob <a href="{LICENCA_DADOS_URL}">{LICENCA_DADOS_NOME}</a>,
com atribuição obrigatória ao IBGE como fonte primária; código-fonte sob licença
{LICENCA_CODIGO_NOME}. Ver <a href="/dados/">/dados/</a> para os detalhes.</p></section>

<section class="secao"><h2>Contato</h2>
<p>Para dúvidas, correções ou relatos de erro, abra uma <em>issue</em> no
<a href="{REPO_URL}">repositório do projeto no GitHub</a> ou escreva para o e-mail público
de contato do autor, {AUTOR_EMAIL_PUBLICO}.</p></section>
"""
        self._pagina_indice("/sobre/", "Sobre o projeto",
                             "O que é o Atlas da migração interna no Brasil, quem fez, e a política de uso dos microdados do Censo 2022.",
                             corpo)

    def gerar_en(self) -> None:
        corpo = """
<p>The Atlas of Internal Migration in Brazil maps where people moved between July 31, 2017
and July 31, 2022, using the internal-migration question from the sample microdata of
Brazil's 2022 Demographic Census (restricted-access data from IBGE, the Brazilian Institute
of Geography and Statistics).</p>

<h2>Source</h2>
<p>IBGE, 2022 Demographic Census, sample microdata (controlled access), fixed-date migration
question (residence on 2017-07-31 compared with residence on 2022-07-31).</p>

<h2>Key findings</h2>
<ul>
<li>12.9 million people changed municipality of residence in the five-year period, across
5,570 Brazilian municipalities, yielding 53,097 published origin-destination pairs.</li>
<li>Among people who left a metropolitan core for its periphery, 46.5% still work in the
core -- residential deconcentration without a matching shift in jobs; in the Federal District
integrated region (RIDE-DF) that share reaches 59.3%.</li>
<li>Among migrants aged 25+ from Rio de Janeiro to São Paulo, 75.1% have a completed
university degree -- a marked educational selectivity.</li>
<li>Guarulhos&#8594;São Paulo is the country's largest commuting pair: 77,500 people live in
Guarulhos and work in São Paulo.</li>
</ul>

<p>Every published figure was rounded and passed through a statistical disclosure-control
gate (small-cell suppression, rounding, sample-size ranges) before leaving the restricted
data environment -- no individual record is ever published.</p>

<p><a href="/">Open the interactive atlas (in Portuguese) &rarr;</a></p>
"""
        breadcrumbs = [(NOME_SITE, "/"), ("English summary", None)]
        titulo = "Atlas of Internal Migration in Brazil"
        descricao = ("One-page English summary: internal migration flows between Brazilian "
                     "municipalities, 2017-2022, from the 2022 Demographic Census (IBGE).")
        jsonld_objs = self.jsonld_pagina(titulo, descricao, "/en/", None, breadcrumbs)
        tpl = self.env.from_string(_tpl_indice(titulo, corpo))
        html = tpl.render(**self.base_ctx(
            canonical=self.url("/en/"), title=titulo, description=descricao, lang="en",
            hreflang=[("pt-BR", self.url("/")), ("en", self.url("/en/")), ("x-default", self.url("/"))],
            breadcrumbs=breadcrumbs, jsonld_objs=jsonld_objs, app_link="/"))
        self.escrever("/en/", html)
        # também grava o alternate recíproco na home, ver ajustar_home_dist()

    # ---------------------------- técnicas: sitemap, robots, 404, css, og ----------------------------
    def gerar_sitemap_robots(self) -> None:
        urls = sorted(set(self.paginas))
        # abaixo do limite de 50.000 URLs por sitemap; ainda assim, particiona defensivamente
        LIMITE = 45000
        partes = [urls[i:i + LIMITE] for i in range(0, len(urls), LIMITE)] or [[]]
        nomes_sitemap = []
        for i, bloco in enumerate(partes):
            nome = "sitemap.xml" if len(partes) == 1 else f"sitemap-{i + 1}.xml"
            nomes_sitemap.append(nome)
            corpo = ['<?xml version="1.0" encoding="UTF-8"?>',
                     '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
            for u in bloco:
                corpo.append(f"<url><loc>{self.url(u)}</loc></url>")
            corpo.append("</urlset>")
            (DIST / nome).write_text("\n".join(corpo), encoding="utf-8")
        if len(partes) > 1:
            idx = ['<?xml version="1.0" encoding="UTF-8"?>',
                   '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
            for nome in nomes_sitemap:
                idx.append(f"<sitemap><loc>{self.url('/' + nome)}</loc></sitemap>")
            idx.append("</sitemapindex>")
            (DIST / "sitemap.xml").write_text("\n".join(idx), encoding="utf-8")

        robots = f"User-agent: *\nAllow: /\nSitemap: {self.url('/sitemap.xml')}\n"
        (DIST / "robots.txt").write_text(robots, encoding="utf-8")
        (DIST / "humans.txt").write_text(
            f"/* TEAM */\nProject: {NOME_SITE}\nSource: {FONTE}\nData version: {VERSAO_DADOS}\n",
            encoding="utf-8")

    def gerar_404(self) -> None:
        corpo = ('<p>Página não encontrada. Use a busca do atlas interativo ou um dos índices abaixo:</p>'
                  '<ul><li><a href="/municipios/">Municípios</a></li>'
                  '<li><a href="/regioes-metropolitanas/">Regiões metropolitanas</a></li>'
                  '<li><a href="/ufs/">UFs</a></li><li><a href="/regioes/">Regiões</a></li>'
                  '<li><a href="/">Voltar à página inicial</a></li></ul>')
        breadcrumbs = [(NOME_SITE, "/"), ("Página não encontrada", None)]
        titulo = "Página não encontrada"
        descricao = "A página buscada não existe no Atlas da migração interna. Veja os índices de municípios, UFs e regiões."
        tpl = self.env.from_string(_tpl_indice(titulo, corpo))
        html = tpl.render(**self.base_ctx(canonical=self.url("/404.html"), title=titulo, description=descricao,
                                           breadcrumbs=breadcrumbs, jsonld_objs=[], app_link="/"))
        # robots: noindex para a 404 (não faz sentido indexá-la)
        html = html.replace('content="index,follow"', 'content="noindex,follow"')
        (DIST / "404.html").write_text(html, encoding="utf-8")


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
th, td { text-align:left; padding:5px 8px; border-bottom:1px solid var(--hairline); }
th[scope="col"] { border-bottom:2px solid var(--hairline); }
.num { text-align:right; }
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
"""


def gerar_css() -> None:
    (DIST / "static.css").write_text(STATIC_CSS, encoding="utf-8")


# ============================== imagem OG (Pillow, com fallback) ==============================
def gerar_og_image() -> bool:
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        return False
    largura, altura = 1200, 630
    img = Image.new("RGB", (largura, altura), (13, 13, 13))
    draw = ImageDraw.Draw(img)
    try:
        fonte_titulo = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 56)
        fonte_sub = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 32)
    except OSError:
        fonte_titulo = ImageFont.load_default()
        fonte_sub = ImageFont.load_default()

    draw.rectangle([0, altura - 12, largura, altura], fill=(28, 92, 171))
    linhas = ["Atlas da migração", "interna no Brasil"]
    y = 160
    for linha in linhas:
        draw.text((80, y), linha, font=fonte_titulo, fill=(255, 255, 255))
        y += 72
    draw.text((80, y + 24), "Censo Demográfico 2022 · IBGE · quinquênio 2017-2022",
               font=fonte_sub, fill=(200, 200, 195))
    img.save(DIST / "og.png", "PNG")
    return True


# ============================== main ==============================
def main() -> None:
    global DIST
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--producao", action="store_true", help="Exige SITE_URL no ambiente; falha sem ele.")
    ap.add_argument("--out", default=str(DIST), help="Diretório de saída (padrão: web/dist).")
    args = ap.parse_args()

    DIST = pathlib.Path(args.out)

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
    gerador = Gerador(site_url, dados)

    gerador.gerar_municipios()
    for nivel in ("uf", "rgi", "rgint"):
        gerador.gerar_unidades(nivel)
    gerador.gerar_rms()
    gerador.gerar_indices()
    gerador.gerar_achados()
    gerador.gerar_metodologia()
    gerador.gerar_glossario()
    gerador.gerar_dados()
    gerador.gerar_sobre()
    gerador.gerar_en()

    gerar_css()
    tem_og = gerar_og_image()
    gerador.gerar_404()
    gerador.gerar_sitemap_robots()

    dt = time.time() - t0
    total_bytes = sum(gerador.tamanhos)
    n = len(gerador.paginas)
    print(f"Páginas geradas: {n}")
    print(f"Tamanho médio por página: {total_bytes / n / 1024:.1f} KB" if n else "Nenhuma página gerada")
    print(f"Imagem OG gerada: {'sim' if tem_og else 'não (Pillow indisponível -- OG sem imagem)'}")
    print(f"Tempo de geração: {dt:.1f} s")
    print(f"SITE_URL usado: {site_url}")


if __name__ == "__main__":
    main()
