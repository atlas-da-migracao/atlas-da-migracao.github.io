"""Testes do gerador de páginas estáticas de SEO (pipeline/build_paginas.py).

Roda o gerador uma única vez por sessão (`--out` para um diretório temporário, sem
depender de `vite build`), e verifica: contagem de páginas por tipo, presença de
title/description/canonical/aviso/atribuição IBGE/JSON-LD válido em cada página,
ausência de contagens amostrais exatas (só faixas), ausência de links internos
quebrados, cobertura do sitemap e tamanho médio de página.
"""
from __future__ import annotations

import json
import pathlib
import re
import sys
import time

import pytest

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / "pipeline"))

import build_paginas as bp  # noqa: E402

SITE_URL_TESTE = "https://exemplo-teste.invalid"

pytestmark = pytest.mark.skipif(
    not (ROOT / "data/processed/meta.json").exists(),
    reason="data/processed ainda não publicado (rode o pipeline até publish.py)",
)


# ============================== fixture: gera o site uma vez por sessão ==============================
@pytest.fixture(scope="session")
def site(tmp_path_factory):
    saida = tmp_path_factory.mktemp("dist_seo")
    t0 = time.time()
    dados = bp.carregar_dados()
    gerador = bp.Gerador(SITE_URL_TESTE, dados)
    bp.DIST = saida  # o Gerador.escrever() lê a global DIST do módulo

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
    bp.gerar_css()
    gerador.gerar_404()
    gerador.gerar_sitemap_robots()
    dt = time.time() - t0

    print(f"\n[test_paginas] {len(gerador.paginas)} páginas geradas em {dt:.1f}s "
          f"({saida})")
    return {"dir": saida, "gerador": gerador, "tempo": dt}


@pytest.fixture(scope="session")
def dist(site):
    return site["dir"]


@pytest.fixture(scope="session")
def paginas(site):
    """Todas as páginas HTML geradas: {caminho_url: texto_html}."""
    out = {}
    for caminho in site["gerador"].paginas:
        p = site["dir"] / caminho.lstrip("/") / "index.html"
        out[caminho] = p.read_text(encoding="utf-8")
    return out


# ============================== contagens por tipo ==============================
def test_contagem_municipios(dist):
    assert len(list((dist / "municipio").iterdir())) == 5570


def test_contagem_ufs(dist):
    assert len(list((dist / "uf").iterdir())) == 27


def test_contagem_rgi(dist):
    assert len(list((dist / "regiao-imediata").iterdir())) == 510


def test_contagem_rgint(dist):
    assert len(list((dist / "regiao-intermediaria").iterdir())) == 133


def test_contagem_rm(dist):
    assert len(list((dist / "regiao-metropolitana").iterdir())) == 81


def test_paginas_de_conteudo_fixo_existem(dist):
    for caminho in ["municipios", "regioes-metropolitanas", "ufs", "regioes",
                     "achados", "metodologia", "glossario", "dados", "sobre", "en"]:
        assert (dist / caminho / "index.html").exists(), f"faltando /{caminho}/"
    assert (dist / "404.html").exists()
    assert (dist / "robots.txt").exists()
    assert (dist / "sitemap.xml").exists()
    assert (dist / "static.css").exists()


# ============================== título / description / canonical / aviso / IBGE / JSON-LD ============
_RE_TITLE = re.compile(r"<title>(.*?)</title>", re.S)
_RE_DESC = re.compile(r'<meta name="description" content="(.*?)"', re.S)
_RE_CANON = re.compile(r'<link rel="canonical" href="(.*?)"', re.S)
_RE_JSONLD = re.compile(r'<script type="application/ld\+json">(.*?)</script>', re.S)


def _amostra_paginas(paginas: dict[str, str], n: int = 400):
    """Amostra determinística (cada k-ésima página) para manter os testes rápidos
    mesmo com 6.000+ páginas -- ainda cobre todos os tipos de página."""
    itens = list(paginas.items())
    passo = max(1, len(itens) // n)
    return itens[::passo]


def test_titulo_description_canonical_presentes(paginas):
    for caminho, html in _amostra_paginas(paginas):
        titulos = _RE_TITLE.findall(html)
        assert len(titulos) == 1 and titulos[0].strip(), f"{caminho}: title ausente/vazio"
        descs = _RE_DESC.findall(html)
        assert len(descs) == 1 and descs[0].strip(), f"{caminho}: description ausente/vazia"
        assert len(descs[0]) <= 300, f"{caminho}: description longa demais ({len(descs[0])} chars)"
        canon = _RE_CANON.findall(html)
        assert len(canon) == 1, f"{caminho}: canonical ausente/duplicado"
        assert canon[0] == f"{SITE_URL_TESTE}{caminho}", f"{caminho}: canonical incorreto: {canon[0]}"


def test_aviso_e_atribuicao_ibge_presentes(paginas):
    for caminho, html in _amostra_paginas(paginas):
        assert "IBGE" in html, f"{caminho}: sem atribuição ao IBGE"
        assert "controle estatístico de revelação" in html or "acesso controlado" in html, (
            f"{caminho}: aviso padrão ausente")


def test_jsonld_valido_em_todas_as_paginas(paginas):
    for caminho, html in _amostra_paginas(paginas):
        blocos = _RE_JSONLD.findall(html)
        assert blocos, f"{caminho}: nenhum bloco JSON-LD"
        for b in blocos:
            obj = json.loads(b)  # levanta se inválido
            assert obj.get("@context") == "https://schema.org"
        tipos = {json.loads(b)["@type"] for b in blocos}
        assert "WebPage" in tipos or "Dataset" in tipos, f"{caminho}: sem WebPage/Dataset"


def test_jsonld_breadcrumblist_tem_item_na_pagina_atual(paginas):
    """Regressão: o último item de um BreadcrumbList referenciava a home em vez da
    própria página quando a URL do item era None (bug corrigido em build_paginas.py)."""
    for caminho, html in _amostra_paginas(paginas):
        for b in _RE_JSONLD.findall(html):
            obj = json.loads(b)
            if obj.get("@type") != "BreadcrumbList":
                continue
            ultimo = obj["itemListElement"][-1]
            assert ultimo["item"] == f"{SITE_URL_TESTE}{caminho}", (
                f"{caminho}: último item do breadcrumb aponta para {ultimo['item']}")


# ============================== nenhuma contagem amostral exata ==============================
_RE_N_EXATO = re.compile(r"\b(n\s*=\s*\d+|observaç(?:ão|ões)\s*:?\s*\d+)\b", re.IGNORECASE)


def test_sem_contagem_amostral_exata(paginas):
    for caminho, html in paginas.items():
        m = _RE_N_EXATO.search(html)
        assert not m, f"{caminho}: padrão de n exato encontrado: {m.group(0)!r}"


# ============================== links internos sem 404 ==============================
_RE_HREF = re.compile(r'href="(/[^"]*)"')


def test_sem_links_internos_quebrados(dist, paginas):
    faltando = set()
    for caminho, html in paginas.items():
        for href in _RE_HREF.findall(html):
            caminho_puro = href.split("?", 1)[0].split("#", 1)[0]
            if caminho_puro.startswith("/data/") or caminho_puro in ("/favicon.svg",):
                continue  # copiado de web/public pelo `vite build`, fora do escopo deste gerador
            if caminho_puro in ("", "/"):
                continue
            if caminho_puro.endswith("/"):
                alvo = dist / caminho_puro.lstrip("/") / "index.html"
            else:
                alvo = dist / caminho_puro.lstrip("/")
            if not alvo.exists():
                faltando.add(caminho_puro)
    assert not faltando, f"{len(faltando)} links internos quebrados, ex.: {sorted(faltando)[:10]}"


# ============================== sitemap cobre todas as páginas ==============================
def test_sitemap_lista_todas_as_paginas(dist, site):
    xml = (dist / "sitemap.xml").read_text(encoding="utf-8")
    locs = set(re.findall(r"<loc>(.*?)</loc>", xml))
    esperado = {f"{SITE_URL_TESTE}{c}" for c in site["gerador"].paginas}
    faltando = esperado - locs
    assert not faltando, f"{len(faltando)} páginas fora do sitemap, ex.: {sorted(faltando)[:5]}"


def test_robots_aponta_para_sitemap(dist):
    robots = (dist / "robots.txt").read_text(encoding="utf-8")
    assert "Allow: /" in robots
    assert f"Sitemap: {SITE_URL_TESTE}/sitemap.xml" in robots


# ============================== tamanho e tempo ==============================
def test_tamanho_medio_pagina(site):
    total = sum(site["gerador"].tamanhos)
    n = len(site["gerador"].tamanhos)
    media_kb = total / n / 1024
    print(f"[test_paginas] tamanho médio por página: {media_kb:.1f} KB")
    assert media_kb <= 40, f"tamanho médio por página {media_kb:.1f} KB > 40 KB"


def test_tempo_de_geracao_reportado(site):
    print(f"[test_paginas] tempo total de geração: {site['tempo']:.1f} s")
    assert site["tempo"] > 0


# ============================== conteúdo indexável estático em web/index.html ==============================
def test_web_index_html_tem_conteudo_estatico_e_jsonld():
    html = (ROOT / "web/index.html").read_text(encoding="utf-8")
    assert "<h1>" in html
    assert "5.570 municípios" in html
    assert "12,9 milhões" in html
    assert '<footer id="rodape-estatico">' in html
    html_resolvido = html.replace("__SITE_URL__", SITE_URL_TESTE)
    blocos = _RE_JSONLD.findall(html_resolvido)
    assert len(blocos) >= 2
    tipos = set()
    for b in blocos:
        obj = json.loads(b)
        assert obj["@context"] == "https://schema.org"
        tipos.add(obj["@type"])
    assert "WebSite" in tipos
    assert "Dataset" in tipos
