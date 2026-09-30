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


# ============================== rótulo da tipologia nas páginas de RM ==============================
def test_tipologia_intra_rm_usa_rotulo_nao_chave_crua(paginas):
    """Regressão: a tabela "10 maiores fluxos intra-RM" mostrava a chave crua ("nucleo_periferia")."""
    rotulos = set(bp.TIPOLOGIA_ROTULO.values())
    assert rotulos == {"Núcleo → periferia", "Periferia → núcleo", "Periferia → periferia"}
    achados = set()
    for caminho, html in paginas.items():
        if not caminho.startswith("/regiao-metropolitana/"):
            continue
        assert not re.search(r"<td>(nucleo|periferia)_\w+</td>", html), f"{caminho}: chave crua da tipologia"
        achados.update(re.findall(r"<td>((?:Núcleo|Periferia) → (?:periferia|núcleo))</td>", html))
    assert achados & rotulos, "nenhuma página de RM mostra a tipologia com rótulo"
    assert achados <= rotulos


def test_todas_as_chaves_de_tipologia_publicadas_tem_rotulo():
    import duckdb
    con = duckdb.connect()
    chaves = {r[0] for r in con.execute(
        f"SELECT DISTINCT tipologia FROM read_parquet('{bp.PROCESSED / 'rm_fluxos_intra.parquet'}')").fetchall()}
    assert chaves <= set(bp.TIPOLOGIA_ROTULO), f"tipologia sem rótulo: {chaves - set(bp.TIPOLOGIA_ROTULO)}"


# ============================== IC 95% ==============================
def test_ic95_contagem_trunca_limite_inferior_em_zero():
    # 10 ± 1,96*20 = -29,2 a 49,2: uma contagem não é negativa
    assert bp.ic95(10, 20) == "0 a 49"
    assert bp.ic95(1000, 100) == "804 a 1.196"
    assert bp.ic95(None, 5) is None and bp.ic95(5, None) is None


def test_ic95_saldo_mantem_negativo_com_menos_tipografico():
    # saldo pode ser negativo: não se trunca, mas o sinal é o "−" (U+2212), como em fmt_sinal
    assert bp.ic95(5, 10, piso_zero=False) == "−15 a 25"
    assert bp.ic95(-100, 30, piso_zero=False) == "−159 a −41"
    assert "-" not in bp.ic95(-100, 30, piso_zero=False)


def test_ic_de_imigrantes_e_emigrantes_nunca_negativo_nas_paginas(paginas):
    re_linha = re.compile(
        r'<th scope="row">(?:Imigrantes|Emigrantes)</th><td class="num tabular">[^<]*</td>'
        r'<td class="num tabular">([^<]*)</td>')
    vistos = 0
    for caminho, html in paginas.items():
        if not caminho.startswith("/municipio/"):
            continue
        for ic in re_linha.findall(html):
            vistos += 1
            assert not ic.startswith(("-", "−")), f"{caminho}: IC de contagem com limite negativo: {ic}"
    assert vistos > 0


# ============================== tabelas com rolagem própria (celular) ==============================
def test_css_estatico_tem_rolagem_e_quebra_de_palavra():
    css = bp.STATIC_CSS.replace(" ", "")
    assert ".rolagem{overflow-x:auto" in css
    assert "overflow-wrap:anywhere" in css


def test_static_css_publicado_tem_rolagem(dist):
    css = (dist / "static.css").read_text(encoding="utf-8")
    assert ".rolagem" in css and "overflow-x:auto" in css


def test_toda_tabela_esta_dentro_de_rolagem(paginas):
    for caminho, html in _amostra_paginas(paginas):
        n_tabelas = len(re.findall(r"<table\b", html))
        n_rolagem = len(re.findall(r'<div class="rolagem" tabindex="0"><table\b', html))
        assert n_tabelas == n_rolagem, f"{caminho}: {n_tabelas} tabelas, {n_rolagem} dentro de .rolagem"


def test_envolver_tabelas_unitario():
    assert bp.envolver_tabelas("<p>x</p>") == "<p>x</p>"
    out = bp.envolver_tabelas("<table class=\"a\"><tr><td>1</td></tr></table><p>y</p><table></table>")
    assert out.count('<div class="rolagem" tabindex="0">') == 2
    assert out.count("</table></div>") == 2


def test_celula_de_precisao_do_saldo_e_curta(paginas):
    """A célula longa ("sem classificação própria (ver imigrantes/emigrantes)") alargava a tabela."""
    alguma = next(h for c, h in paginas.items() if c.startswith("/municipio/"))
    assert "ver imigrantes/emigrantes" not in alguma


# ============================== imagem OG: fonte versionada ==============================
def test_fontes_da_og_estao_versionadas_no_repositorio():
    for f in (bp.FONTE_OG_TITULO, bp.FONTE_OG_SUBTITULO):
        assert f.parent == ROOT / "pipeline/assets", f
        assert f.exists() and f.stat().st_size > 100_000, f"fonte ausente ou truncada: {f}"
    assert (ROOT / "pipeline/assets/README.md").exists()
    assert (ROOT / "pipeline/assets/LICENSE-DejaVu.txt").exists()


def test_fonte_og_e_truetype_e_o_fallback_mantem_o_tamanho(tmp_path):
    ImageFont = pytest.importorskip("PIL.ImageFont")
    assert isinstance(bp.fonte_og(bp.FONTE_OG_TITULO, 56), ImageFont.FreeTypeFont)
    # arquivo inexistente: fonte embutida do Pillow no MESMO tamanho, não o bitmap de ~10 px
    fallback = bp.fonte_og(tmp_path / "nao-existe.ttf", 56)
    caixa = fallback.getbbox("Atlas da migração")
    assert caixa[3] - caixa[1] >= 30, f"fallback pequeno demais: {caixa}"


def test_gerar_og_image_escreve_png_com_a_fonte_versionada(tmp_path, monkeypatch):
    pytest.importorskip("PIL.Image")
    monkeypatch.setattr(bp, "DIST", tmp_path)
    assert bp.gerar_og_image() is True
    from PIL import Image
    img = Image.open(tmp_path / "og.png")
    assert img.size == (1200, 630)
    # há texto claro sobre o fundo escuro na faixa do título (pixels próximos do branco)
    faixa = img.crop((80, 160, 1120, 300)).convert("L")
    assert faixa.getextrema()[1] > 240


# ============================== index.html: rodapé estático removido após montar ==============================
def test_main_tsx_remove_o_rodape_estatico_apos_montar():
    main = (ROOT / "web/src/main.tsx").read_text(encoding="utf-8")
    assert 'getElementById("rodape-estatico")?.remove()' in main
    # e o index.html continua com o rodapé, para quem não executa JS
    assert '<footer id="rodape-estatico">' in (ROOT / "web/index.html").read_text(encoding="utf-8")
