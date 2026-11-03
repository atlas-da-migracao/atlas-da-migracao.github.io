"""Testes do gerador de páginas estáticas de SEO (pipeline/build_paginas.py).

Roda o gerador uma única vez por sessão (`--out` para um diretório temporário, sem
depender de `vite build`), e verifica: contagem de páginas por tipo, presença de
title/description/canonical/aviso/atribuição IBGE/JSON-LD válido em cada página,
ausência de contagens amostrais exatas (só faixas), ausência de links internos
quebrados, cobertura do sitemap e tamanho médio de página.
"""
from __future__ import annotations

import inspect
import json
import pathlib
import re
import sys
import time
from collections.abc import Mapping

import pytest

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / "pipeline"))

import build_paginas as bp  # noqa: E402
from i18n_paginas import LANGS, LANG_SPA, PREFIXO, catalogo  # noqa: E402

SITE_URL_TESTE = "https://exemplo-teste.invalid"
PT = "pt-BR"
OUTROS = ("en", "fr", "es")

pytestmark = pytest.mark.skipif(
    not (ROOT / "data/processed/meta.json").exists(),
    reason="data/processed ainda não publicado (rode o pipeline até publish.py)",
)


def lang_do_caminho(caminho: str) -> str:
    """Idioma de uma página pelo prefixo do caminho (`/fr/municipio/...` -> fr)."""
    for l in OUTROS:
        if caminho == f"/{l}/" or caminho.startswith(f"/{l}/"):
            return l
    return PT


def chave_do_caminho(caminho: str) -> str:
    """Caminho no idioma -> chave independente de idioma (o caminho em português)."""
    l = lang_do_caminho(caminho)
    return caminho[len(PREFIXO[l]):] if PREFIXO[l] else caminho


# ============================== fixture: gera o site uma vez por sessão ==============================
@pytest.fixture(scope="session")
def site(tmp_path_factory):
    saida = tmp_path_factory.mktemp("dist_seo")
    t0 = time.time()
    dados = bp.carregar_dados()
    bp.DIST = saida  # o Gerador.escrever() lê a global DIST do módulo
    geradores = bp.gerar_site(SITE_URL_TESTE, dados, LANGS)
    dt = time.time() - t0

    n = sum(len(g.paginas) for g in geradores)
    print(f"\n[test_paginas] {n} páginas geradas em {dt:.1f}s ({saida})")
    return {"dir": saida, "geradores": geradores, "tempo": dt, "dados": dados,
            "por_lang": {g.lang: g for g in geradores}}


@pytest.fixture(scope="session")
def dist(site):
    return site["dir"]


class PaginasEmDisco(Mapping):
    """{caminho_url: html} lido do disco sob demanda (25 mil páginas não cabem em memória
    com folga; cada teste que varre tudo relê os arquivos)."""

    def __init__(self, dist: pathlib.Path, caminhos: list[str]):
        self.dist, self.caminhos = dist, caminhos

    def __iter__(self):
        return iter(self.caminhos)

    def __len__(self):
        return len(self.caminhos)

    def __getitem__(self, caminho):
        return (self.dist / caminho.lstrip("/") / "index.html").read_text(encoding="utf-8")


@pytest.fixture(scope="session")
def paginas(site):
    """Todas as páginas HTML geradas, dos quatro idiomas: {caminho_url: texto_html}."""
    caminhos = [c for g in site["geradores"] for c in g.paginas]
    return PaginasEmDisco(site["dir"], caminhos)


def paginas_de(paginas, lang: str):
    return {c: paginas[c] for c in paginas if lang_do_caminho(c) == lang}


# ============================== contagens por tipo ==============================
@pytest.mark.parametrize("lang", LANGS)
def test_contagem_municipios(dist, lang):
    assert len(list((dist / PREFIXO[lang].lstrip("/") / "municipio").iterdir())) == 5570


@pytest.mark.parametrize("lang", LANGS)
def test_contagem_ufs(dist, lang):
    assert len(list((dist / PREFIXO[lang].lstrip("/") / "uf").iterdir())) == 27


@pytest.mark.parametrize("lang", LANGS)
def test_contagem_rgi(dist, lang):
    assert len(list((dist / PREFIXO[lang].lstrip("/") / "regiao-imediata").iterdir())) == 510


@pytest.mark.parametrize("lang", LANGS)
def test_contagem_rgint(dist, lang):
    assert len(list((dist / PREFIXO[lang].lstrip("/") / "regiao-intermediaria").iterdir())) == 133


@pytest.mark.parametrize("lang", LANGS)
def test_contagem_rm(dist, lang):
    assert len(list((dist / PREFIXO[lang].lstrip("/") / "regiao-metropolitana").iterdir())) == 81


def test_total_de_paginas_por_idioma(site):
    por_lang = {g.lang: len(g.paginas) for g in site["geradores"]}
    # pt: sem a home (é o SPA); en/fr/es: com a home estática do idioma
    assert por_lang[PT] == 6330
    assert por_lang["en"] == por_lang["fr"] == por_lang["es"] == 6331


@pytest.mark.parametrize("lang", LANGS)
def test_paginas_de_conteudo_fixo_existem(dist, lang):
    base = dist / PREFIXO[lang].lstrip("/")
    for caminho in ["municipios", "regioes-metropolitanas", "ufs", "regioes",
                     "achados", "metodologia", "glossario", "dados", "sobre"]:
        assert (base / caminho / "index.html").exists(), f"faltando {PREFIXO[lang]}/{caminho}/"
    assert (base / "404.html").exists()
    if lang != PT:
        assert (base / "index.html").exists(), f"falta a home estática de {lang}"


def test_arquivos_tecnicos_existem(dist):
    assert (dist / "robots.txt").exists()
    assert (dist / "sitemap.xml").exists()
    assert (dist / "static.css").exists()
    for l in LANGS:
        assert (dist / f"sitemap-{LANG_SPA[l]}.xml").exists()
    assert (dist / "og.png").exists()
    for l in OUTROS:
        assert (dist / f"og-{l}.png").exists()


# ============================== título / description / canonical / aviso / IBGE / JSON-LD ============
_RE_TITLE = re.compile(r"<title>(.*?)</title>", re.S)
_RE_DESC = re.compile(r'<meta name="description" content="(.*?)"', re.S)
_RE_CANON = re.compile(r'<link rel="canonical" href="(.*?)"', re.S)
_RE_JSONLD = re.compile(r'<script type="application/ld\+json">(.*?)</script>', re.S)
_RE_HTML_LANG = re.compile(r'<html lang="([^"]+)"')
_RE_ALTERNATE = re.compile(r'<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">')


def _amostra_paginas(paginas, n: int = 400):
    """Amostra determinística, estratificada: 1 em cada 5 páginas que não são de município (cobre
    UFs, RGI, RGInt, RMs, índices e páginas fixas) e 1 em cada 70 municípios, em cada idioma."""
    out = []
    for lang in LANGS:
        pref = PREFIXO[lang]
        caminhos = [c for c in paginas if lang_do_caminho(c) == lang]
        muns = [c for c in caminhos if c.startswith(f"{pref}/municipio/")]
        resto = [c for c in caminhos if not c.startswith(f"{pref}/municipio/")]
        for c in muns[::70] + resto[::5] + [c for c in resto if c.count("/") <= 3]:
            out.append((c, paginas[c]))
    return list({c: h for c, h in out}.items())


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


_MARCA_AVISO = {  # texto do aviso padrão / da linha de fonte em cada idioma
    PT: ("controle estatístico de revelação", "acesso controlado"),
    "en": ("disclosure control", "controlled access"),
    "fr": ("contrôle de la divulgation statistique", "accès contrôlé"),
    "es": ("control de divulgación estadística", "acceso controlado"),
}


def test_aviso_e_atribuicao_ibge_presentes(paginas):
    for caminho, html in _amostra_paginas(paginas):
        assert "IBGE" in html, f"{caminho}: sem atribuição ao IBGE"
        marcas = _MARCA_AVISO[lang_do_caminho(caminho)]
        assert any(m in html for m in marcas), f"{caminho}: aviso padrão ausente"


def test_jsonld_valido_em_todas_as_paginas(paginas):
    for caminho, html in _amostra_paginas(paginas):
        blocos = _RE_JSONLD.findall(html)
        assert blocos, f"{caminho}: nenhum bloco JSON-LD"
        for b in blocos:
            obj = json.loads(b)  # levanta se inválido
            assert obj.get("@context") == "https://schema.org"
        tipos = {json.loads(b)["@type"] for b in blocos}
        assert "WebPage" in tipos or "Dataset" in tipos, f"{caminho}: sem WebPage/Dataset"


def test_jsonld_inlanguage_acompanha_o_idioma_da_pagina(paginas):
    for caminho, html in _amostra_paginas(paginas):
        esperado = lang_do_caminho(caminho)
        for b in _RE_JSONLD.findall(html):
            obj = json.loads(b)
            if obj["@type"] in ("WebPage", "Dataset"):
                assert obj.get("inLanguage") == esperado, f"{caminho}: inLanguage={obj.get('inLanguage')}"


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


# ============================== metadados de idioma: <html lang>, og:locale, hreflang ==============
_OG_LOCALE = {PT: "pt_BR", "en": "en_US", "fr": "fr_FR", "es": "es_ES"}


def test_html_lang_e_og_locale_corretos_por_prefixo(paginas):
    for caminho, html in _amostra_paginas(paginas):
        lang = lang_do_caminho(caminho)
        assert _RE_HTML_LANG.search(html).group(1) == lang, f"{caminho}: <html lang> incorreto"
        assert f'<meta property="og:locale" content="{_OG_LOCALE[lang]}">' in html, f"{caminho}: og:locale"
        for outro in LANGS:
            if outro != lang:
                assert f'<meta property="og:locale:alternate" content="{_OG_LOCALE[outro]}">' in html


def _alternates(html: str) -> dict[str, str]:
    return dict(_RE_ALTERNATE.findall(html))


def test_hreflang_completo_e_reciproco_em_todas_as_paginas(dist, paginas):
    """Cada página lista os quatro idiomas + x-default (a si mesma incluída); cada alternate
    existe; e a página alternate lista o mesmo conjunto de volta (reciprocidade)."""
    esperado = {"pt-BR", "en", "fr", "es", "x-default"}
    cache: dict[str, dict[str, str]] = {}
    existentes = set(paginas)
    for caminho in paginas:
        html = paginas[caminho]
        alt = _alternates(html)
        assert set(alt) == esperado, f"{caminho}: hreflang {sorted(alt)}"
        assert alt[lang_do_caminho(caminho)] == f"{SITE_URL_TESTE}{caminho}", f"{caminho}: falta o auto-alternate"
        chave = chave_do_caminho(caminho)
        for hl, href in alt.items():
            assert href.startswith(SITE_URL_TESTE)
            destino = href[len(SITE_URL_TESTE):]
            if hl == "x-default":
                assert destino == chave, f"{caminho}: x-default deve apontar para o português"
            else:
                assert destino == PREFIXO[hl] + chave if PREFIXO[hl] else destino == chave
            if destino == "/":
                continue  # a home em português é o SPA (web/index.html), conferido em outro teste
            assert destino in existentes, f"{caminho}: alternate {hl} inexistente: {destino}"
        cache[caminho] = alt
        if len(cache) == 1 or caminho.count("/") <= 3:
            # reciprocidade: o alternate de cada idioma devolve o mesmo conjunto
            for hl, href in alt.items():
                destino = href[len(SITE_URL_TESTE):]
                if destino in existentes and hl != "x-default":
                    assert _alternates(paginas[destino]) == alt, f"{caminho}: {destino} não é recíproco"


def test_hreflang_reciproco_numa_amostra_de_municipios_e_unidades(paginas):
    for caminho, html in _amostra_paginas(paginas):
        alt = _alternates(html)
        for hl, href in alt.items():
            destino = href[len(SITE_URL_TESTE):]
            if hl == "x-default" or destino == "/":
                continue
            assert _alternates(paginas[destino]) == alt, f"{caminho}: {destino} não é recíproco"


def test_seletor_de_idioma_aponta_para_a_mesma_pagina(paginas):
    for caminho, html in _amostra_paginas(paginas):
        chave = chave_do_caminho(caminho)
        for l in LANGS:
            alvo = PREFIXO[l] + chave if PREFIXO[l] else chave
            if l == lang_do_caminho(caminho):
                assert f'<span aria-current="true" lang="{l}"' in html
            else:
                assert f'<a href="{alvo}" hreflang="{l}" lang="{l}"' in html, f"{caminho}: seletor {l}"


def test_web_index_html_tem_hreflang_dos_quatro_idiomas():
    html = (ROOT / "web/index.html").read_text(encoding="utf-8")
    alt = dict(re.findall(r'<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"', html))
    assert alt == {"pt-BR": "__SITE_URL__/", "en": "__SITE_URL__/en/", "fr": "__SITE_URL__/fr/",
                    "es": "__SITE_URL__/es/", "x-default": "__SITE_URL__/"}


# ============================== nenhuma contagem amostral exata ==============================
_RE_N_EXATO = re.compile(
    r"\b(n\s*=\s*\d+|(?:observaç(?:ão|ões)|observations?|observaciones)\s*:?\s*\d+)\b", re.IGNORECASE)


def test_sem_contagem_amostral_exata(paginas):
    for caminho, html in paginas.items():
        m = _RE_N_EXATO.search(html)
        assert not m, f"{caminho}: padrão de n exato encontrado: {m.group(0)!r}"


# ============================== links internos sem 404 ==============================
_RE_HREF = re.compile(r'href="(/[^"]*)"')
_RE_ANCORA = re.compile(r'<a\b([^>]*)>')
_ATIVOS = ("/data/", "/favicon.svg", "/static.css", "/og")


def test_sem_links_internos_quebrados(dist, paginas):
    faltando = set()
    for caminho, html in paginas.items():
        for href in _RE_HREF.findall(html):
            caminho_puro = href.split("?", 1)[0].split("#", 1)[0]
            if caminho_puro.startswith(_ATIVOS):
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


def test_links_internos_ficam_no_prefixo_do_idioma(paginas):
    """Em /fr/, todo link para outra página do atlas fica em /fr/ (nada de vazar para o português);
    a única exceção é o seletor de idioma (âncoras com hreflang). Links para o SPA (`/?...`) e ativos
    ficam de fora; os do SPA carregam `lang=`."""
    for caminho, html in _amostra_paginas(paginas):
        lang = lang_do_caminho(caminho)
        for attrs in _RE_ANCORA.findall(html):
            m = re.search(r'href="(/[^"]*)"', attrs)
            if not m or "hreflang=" in attrs:
                continue
            href = m.group(1)
            if href.startswith("/?") or href == "/":
                if lang != PT and href.startswith("/?"):
                    assert f"lang={LANG_SPA[lang]}" in href, f"{caminho}: link do SPA sem lang: {href}"
                if lang != PT:
                    assert href != "/", f"{caminho}: link para a raiz em português"
                continue
            if href.startswith(_ATIVOS):
                continue
            if lang == PT:
                assert lang_do_caminho(href) == PT, f"{caminho}: link com prefixo de idioma: {href}"
            else:
                assert href.startswith(f"/{lang}/"), f"{caminho}: link fora de /{lang}/: {href}"


# ============================== sitemap: um por idioma + índice ==============================
def test_sitemap_por_idioma_lista_todas_as_paginas(dist, site):
    for g in site["geradores"]:
        xml = (dist / f"sitemap-{LANG_SPA[g.lang]}.xml").read_text(encoding="utf-8")
        locs = set(re.findall(r"<loc>(.*?)</loc>", xml))
        esperado = {f"{SITE_URL_TESTE}{c}" for c in g.paginas}
        if g.lang == PT:
            esperado.add(f"{SITE_URL_TESTE}/")
        assert locs == esperado, f"{g.lang}: sitemap difere ({len(locs ^ esperado)} URLs)"
        # nenhum URL de outro idioma entra no sitemap do idioma
        assert all(lang_do_caminho(u[len(SITE_URL_TESTE):]) == g.lang for u in locs), g.lang


def test_sitemap_indice_aponta_para_os_sitemaps_dos_idiomas(dist):
    xml = (dist / "sitemap.xml").read_text(encoding="utf-8")
    assert "<sitemapindex" in xml
    locs = re.findall(r"<loc>(.*?)</loc>", xml)
    assert sorted(locs) == sorted(f"{SITE_URL_TESTE}/sitemap-{LANG_SPA[l]}.xml" for l in LANGS)


def test_robots_aponta_para_o_indice_do_sitemap(dist):
    robots = (dist / "robots.txt").read_text(encoding="utf-8")
    assert "Allow: /" in robots
    assert f"Sitemap: {SITE_URL_TESTE}/sitemap.xml" in robots


def test_sitemap_particiona_acima_do_limite(tmp_path, monkeypatch):
    class G:
        lang = PT
        paginas = [f"/municipio/x-{i}/" for i in range(7)]
    monkeypatch.setattr(bp, "DIST", tmp_path)
    monkeypatch.setattr(bp, "LIMITE_SITEMAP", 3)
    bp.gerar_sitemap_robots(SITE_URL_TESTE, [G()])
    assert (tmp_path / "sitemap-pt.xml").exists() and (tmp_path / "sitemap-pt-2.xml").exists()
    assert (tmp_path / "sitemap-pt-3.xml").exists()
    idx = (tmp_path / "sitemap.xml").read_text(encoding="utf-8")
    assert idx.count("<sitemap>") == 3


# ============================== tamanho e tempo ==============================
def test_tamanho_medio_pagina(site):
    total = sum(sum(g.tamanhos) for g in site["geradores"])
    n = sum(len(g.tamanhos) for g in site["geradores"])
    media_kb = total / n / 1024
    print(f"[test_paginas] tamanho médio por página: {media_kb:.1f} KB ({n} páginas)")
    assert media_kb <= 40, f"tamanho médio por página {media_kb:.1f} KB > 40 KB"
    for g in site["geradores"]:
        m = sum(g.tamanhos) / len(g.tamanhos) / 1024
        assert m <= 40, f"{g.lang}: {m:.1f} KB"


def test_tempo_de_geracao_reportado(site):
    print(f"[test_paginas] tempo total de geração: {site['tempo']:.1f} s")
    assert site["tempo"] > 0


# ============================== catálogos: mesma estrutura nos quatro idiomas ==============================
def _publicos(mod):
    return {n: v for n, v in vars(mod).items()
            if not n.startswith("_") and n not in ("annotations", "H")
            and not inspect.ismodule(v)}


def test_catalogos_tem_os_mesmos_nomes_e_assinaturas():
    pt = _publicos(catalogo(PT))
    for lang in OUTROS:
        outro = _publicos(catalogo(lang))
        assert set(outro) == set(pt), f"{lang}: nomes diferentes: {sorted(set(outro) ^ set(pt))}"
        for nome, v in pt.items():
            o = outro[nome]
            if inspect.isfunction(v):
                assert inspect.isfunction(o), f"{lang}.{nome} deve ser função"
                assert list(inspect.signature(o).parameters) == list(inspect.signature(v).parameters), (
                    f"{lang}.{nome}: assinatura diferente")
            elif isinstance(v, dict) and nome != "ROTULOS":
                assert set(o) == set(v), f"{lang}.{nome}: chaves diferentes"
            elif isinstance(v, (list, tuple)):
                assert len(o) == len(v), f"{lang}.{nome}: tamanho diferente"
            elif nome not in ("LANG", "AVISO_TRADUCAO"):
                assert type(o) is type(v), f"{lang}.{nome}: tipo diferente"


def test_aviso_de_traducao_so_existe_fora_do_portugues():
    assert catalogo(PT).AVISO_TRADUCAO is None
    assert all(isinstance(catalogo(l).AVISO_TRADUCAO, str) and catalogo(l).AVISO_TRADUCAO for l in OUTROS)


def test_catalogos_traduzem_todas_as_categorias_de_meta():
    for lang in OUTROS:
        rot = catalogo(lang).ROTULOS
        for dim in ("status", "edu", "renda", "idade_sexo"):
            faltam = set(bp.ROTULOS[dim]) - set(rot[dim])
            assert not faltam, f"{lang}: categorias de {dim} sem tradução: {faltam}"
        assert set(catalogo(lang).TIPOLOGIA_ROTULO) == set(bp.TIPOLOGIA_ROTULO)


def test_rotulo_das_variantes_de_sexo_indeterminado_por_idioma():
    assert bp.rotulo("idade_sexo", "05_14_I") == "5 a 14 anos, sexo não determinado"
    assert bp.rotulo("idade_sexo", "60_mais_I") == "60 anos ou mais, sexo não determinado"
    assert bp.rotulo("idade_sexo", "25_39_I", "en") == "Ages 25–39, sex undetermined"
    assert bp.rotulo("idade_sexo", "25_39_I", "fr") == "25–39 ans, sexe indéterminé"
    assert bp.rotulo("idade_sexo", "25_39_I", "es") == "25 a 39 años, sexo no determinado"
    assert bp.rotulo("status", "retorno_natal") == bp.ROTULOS["status"]["retorno_natal"]
    assert bp.rotulo("status", "retorno_natal", "fr") == "Retour dans la municipalité de naissance"


def test_descricoes_dos_catalogos_cabem_em_300_caracteres():
    for lang in LANGS:
        c = catalogo(lang)
        for nome in ("DESCRICAO_SITE", "ACHADOS_DESCRICAO", "METODOLOGIA_DESCRICAO", "GLOSSARIO_DESCRICAO",
                     "DADOS_DESCRICAO", "SOBRE_DESCRICAO", "HOME_DESCRICAO", "E404_DESCRICAO"):
            assert len(getattr(c, nome)) <= 300, f"{lang}.{nome}"


# ============================== formatação numérica por idioma ==============================
def test_formatos_numericos_por_idioma():
    assert bp.fmt_int(1234567) == "1.234.567"
    assert bp.fmt_int(1234567, "en") == "1,234,567"
    assert bp.fmt_int(1234567, "fr") == "1 234 567"
    assert bp.fmt_int(1234567, "es") == "1.234.567"
    # 4 dígitos: o espanhol também agrupa (como `useGrouping: "always"` do SPA)
    assert bp.fmt_int(1234, "es") == "1.234" and bp.fmt_int(1234, "fr") == "1 234"
    assert bp.fmt_int(999, "es") == "999"
    assert bp.fmt_dec(1234.5, 1) == "1.234,5"
    assert bp.fmt_dec(1234.5, 1, "en") == "1,234.5"
    assert bp.fmt_dec(1234.5, 1, "fr") == "1 234,5"
    assert bp.fmt_dec(1234.5, 1, "es") == "1.234,5"
    assert bp.fmt_dec(0.172, 3, "en") == "0.172" and bp.fmt_dec(0.172, 3, "fr") == "0,172"
    assert bp.fmt_pct100(12.5) == "12,5%"
    assert bp.fmt_pct100(12.5, 1, "en") == "12.5%"
    assert bp.fmt_pct100(12.5, 1, "fr") == "12,5 %"
    assert bp.fmt_pct100(12.5, 1, "es") == "12,5 %"


def test_formatos_mantem_sinal_tipografico_e_regras_atuais():
    for lang in LANGS:
        assert bp.fmt_sinal(-1234, lang).startswith("−") and "-" not in bp.fmt_sinal(-1234, lang)
        assert bp.fmt_sinal(1234, lang).startswith("+")
        assert bp.fmt_sinal(0, lang) == "0"
        assert bp.fmt_sinal(None, lang) == catalogo(lang).SEM_ESTIMATIVA
        assert bp.fmt_int(None, lang) == bp.fmt_dec(None, 2, lang) == catalogo(lang).SEM_ESTIMATIVA
    assert bp.fmt_dec(-0.001, 2, "en") == "0.00"       # sem sinal quando arredonda para zero
    assert bp.fmt_dec(-16.35, 2, "fr") == "−16,35"
    assert bp.fmt_dec(-16.35, 2) == "-16,35"           # português: hífen histórico do gerador


def test_ic95_nos_quatro_idiomas():
    assert bp.ic95(1000, 100, lang="en") == "804 to 1,196"
    assert bp.ic95(1000, 100, lang="fr") == "804 à 1 196"
    assert bp.ic95(1000, 100, lang="es") == "804 a 1.196"
    assert bp.ic95(5, 10, piso_zero=False, lang="en") == "−15 to 25"


@pytest.mark.parametrize("lang", OUTROS)
def test_numeros_das_paginas_no_formato_do_idioma(site, paginas, lang):
    cd = "3550308"  # São Paulo
    m = site["dados"]["mun_by_cd"][cd]
    caminho = f"{PREFIXO[lang]}/municipio/{bp.slug_municipio(m['nm_mun'], m['uf_sigla'], cd)}/"
    html = paginas[caminho]
    pop5 = int(round(m["pop5"]))
    esperado = {"en": f"{pop5:,}", "fr": f"{pop5:,}".replace(",", " "),
                "es": f"{pop5:,}".replace(",", ".")}[lang]
    assert esperado in html, f"{caminho}: população no formato de {lang} ({esperado!r}) ausente"
    outros = {"en": f"{pop5:,}".replace(",", "."), "fr": f"{pop5:,}", "es": f"{pop5:,}"}[lang]
    if lang != "en":
        assert outros.replace(",", ".") not in html or lang == "es"
    # sem separador de milhar do português em en/fr; sem vírgula-milhar fora do en
    if lang == "en":
        assert not re.search(r"\b\d{1,3}(\.\d{3}){2,}\b", html)
    assert "5.570" not in html or lang == "es"


def test_es_agrupa_numeros_de_quatro_digitos(paginas):
    achou = False
    for caminho, html in _amostra_paginas(paginas):
        if lang_do_caminho(caminho) != "es" or "/municipio/" not in caminho:
            continue
        texto = re.sub(r"<[^>]+>", " ", html)
        assert not re.search(r"(?<![\d.,])\d{4,}(?![\d.,])", re.sub(r"\b(?:19|20)\d{2}\b|\b\d{7}\b", "", texto)), caminho
        achou = achou or bool(re.search(r"\b\d\.\d{3}\b", texto))
    assert achou


# ============================== nenhum texto em português nas páginas traduzidas ==============================
_PT_VAZADO = re.compile(
    r"\b(Imigrantes|Município|município|Municípios|municípios|Saldo migratório|Pular para|Perfil dos|"
    r"Principais|Estimativa|Participação|Precisão|Amostra|Metodologia|Glossário|Abrir o|no atlas interativo|"
    r"Deslocamento|Taxa líquida|eficácia|Como citar|Fonte:)\b")


@pytest.mark.parametrize("lang", OUTROS)
def test_paginas_traduzidas_nao_tem_texto_em_portugues(paginas, lang):
    for caminho, html in _amostra_paginas(paginas):
        if lang_do_caminho(caminho) != lang:
            continue
        texto = re.sub(r"<script.*?</script>", " ", html, flags=re.S)
        texto = re.sub(r"<(?:a|link|meta)\b[^>]*>", lambda m: re.sub(r'(?:href|content)="[^"]*"', "", m.group(0)), texto)
        texto = re.sub(r"<[^>]+>", " ", texto)
        # o texto do glossário e dos nomes próprios (municípios, RMs) não conta; o cromo e a prosa sim
        for m in _PT_VAZADO.finditer(texto):
            if lang == "es" and m.group(0) in ("Emigrantes",):
                continue
            ctx = texto[max(0, m.start() - 40): m.end() + 40].replace("\n", " ")
            pytest.fail(f"{caminho}: texto em português em página {lang}: {m.group(0)!r} em ...{ctx}...")


def test_pt_continua_com_o_texto_historico(paginas):
    html = paginas["/municipio/guarulhos-sp-3518800/"]
    for trecho in ("<title>Migração em Guarulhos/SP (2017-2022)</title>",
                    "tinha uma população de referência (5 anos ou mais em 2022)",
                    "Taxa líquida de migração (por mil hab.)", "Pular para o conteúdo",
                    "Censo 2022 · 2017-2022", "ver par no atlas"):
        assert trecho in html, trecho
    assert 'href="/?mun=3518800"' in html and "lang=" not in re.search(r'class="app" href="([^"]*)"', html).group(1)


def test_aviso_de_traducao_no_rodape_dos_idiomas_traduzidos(paginas):
    for caminho, html in _amostra_paginas(paginas):
        lang = lang_do_caminho(caminho)
        if lang == PT:
            assert "traducao" not in html.split("<footer")[1]
        else:
            rodape = html.split("<footer")[1]
            assert catalogo(lang).AVISO_TRADUCAO[:40].replace("'", "&#39;") in rodape, caminho


def test_prosa_de_meta_vem_de_dados_json_quando_a_origem_confere(paginas):
    dados = json.loads((ROOT / "web/src/i18n/dados.json").read_text(encoding="utf-8"))
    ed = f"aviso.{bp.EDICAO}"
    for lang in OUTROS:
        esperado = dados[ed][LANG_SPA[lang]] if dados[ed]["origem"] == bp.AVISO else bp.AVISO
        html = paginas[f"{PREFIXO[lang]}/metodologia/"]
        assert f'<p class="aviso">{esperado}</p>'.replace("'", "&#39;") in html
    assert f'<p class="aviso">{bp.AVISO}</p>' in paginas["/metodologia/"]


def test_texto_dado_cai_no_portugues_quando_a_origem_mudou():
    dados = json.loads((ROOT / "web/src/i18n/dados.json").read_text(encoding="utf-8"))
    assert bp.texto_dado(f"aviso.{bp.EDICAO}", "texto novo do pipeline", "fr") == "texto novo do pipeline"
    assert bp.texto_dado("chave.inexistente", "x", "fr") == "x"
    e = dados["aviso.2022"]
    assert bp.texto_dado("aviso.2022", e["origem"], "fr") == e["fr"]
    assert bp.texto_dado("aviso.2022", e["origem"], PT) == e["origem"]


# ============================== glossário: os 37 termos do SPA, em cada idioma ==============================
@pytest.mark.parametrize("lang", LANGS)
def test_glossario_tem_os_37_termos_do_idioma(paginas, lang):
    termos = json.loads((ROOT / f"web/src/i18n/glossario/{LANG_SPA[lang]}.json").read_text(encoding="utf-8"))
    assert len(termos) == 37
    html = paginas[f"{PREFIXO[lang]}/glossario/"]
    assert html.count("<dt id=") == 37
    import html as _h
    for k, v in termos.items():
        assert f'<dt id="{k}">' in html
        assert _h.escape(v["definicao"], quote=False) in html, f"{lang}/{k}: definição ausente"


# ============================== home estática de en/fr/es ==============================
@pytest.mark.parametrize("lang", OUTROS)
def test_home_estatica_do_idioma(paginas, lang):
    html = paginas[f"/{lang}/"]
    assert f'<html lang="{lang}">' in html
    for fixa in ("municipios", "ufs", "regioes", "regioes-metropolitanas", "achados", "metodologia"):
        assert f'href="/{lang}/{fixa}/"' in html, f"/{lang}/: sem link para {fixa}"
    assert f'href="/?lang={lang}"' in html, "CTA para o atlas interativo no idioma"
    assert "(in Portuguese)" not in html
    assert "<h1>" in html and "5" in html


# ============================== páginas 404 ==============================
@pytest.mark.parametrize("lang", LANGS)
def test_404_no_idioma(dist, lang):
    html = (dist / PREFIXO[lang].lstrip("/") / "404.html").read_text(encoding="utf-8")
    assert f'<html lang="{lang}">' in html and 'content="noindex,follow"' in html
    assert catalogo(lang).E404_TITULO in html


# ============================== url_lang ==============================
def test_url_lang():
    from i18n_paginas import url_lang
    assert url_lang("/municipio/x/", PT) == "/municipio/x/"
    assert url_lang("/municipio/x/", "fr") == "/fr/municipio/x/"
    assert url_lang("/", "en") == "/en/" and url_lang("/", PT) == "/"
    g = bp.Gerador(SITE_URL_TESTE, {}, "es")
    assert g.url_lang("/ufs/") == "/es/ufs/" and g.x.app("mun=1") == "/?mun=1&lang=es"
    assert g.x.app("") == "/?lang=es" and bp.Ctx(PT).app("mun=1") == "/?mun=1"
    assert bp.Ctx("fr").app("o=1&d=2", html=True) == "/?o=1&amp;d=2&amp;lang=fr"


def test_gerador_recusa_idioma_desconhecido():
    with pytest.raises(ValueError):
        bp.Gerador(SITE_URL_TESTE, {}, "de")


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
@pytest.mark.parametrize("lang", LANGS)
def test_tipologia_intra_rm_usa_rotulo_nao_chave_crua(paginas, lang):
    """Regressão: a tabela "10 maiores fluxos intra-RM" mostrava a chave crua ("nucleo_periferia")."""
    rotulos = set(catalogo(lang).TIPOLOGIA_ROTULO.values())
    if lang == PT:
        assert rotulos == {"Núcleo → periferia", "Periferia → núcleo", "Periferia → periferia"}
        assert rotulos == set(bp.TIPOLOGIA_ROTULO.values())
    pref = f"{PREFIXO[lang]}/regiao-metropolitana/"
    achados = set()
    for caminho in paginas:
        if not caminho.startswith(pref):
            continue
        html = paginas[caminho]
        assert not re.search(r"<td>(nucleo|periferia)_\w+</td>", html), f"{caminho}: chave crua da tipologia"
        achados.update(r for r in re.findall(r"<td>([^<>]+ → [^<>]+)</td>", html))
    assert achados & rotulos, f"nenhuma página de RM em {lang} mostra a tipologia com rótulo"
    assert achados <= rotulos, f"rótulos inesperados em {lang}: {achados - rotulos}"


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


@pytest.mark.parametrize("lang", LANGS)
def test_ic_de_imigrantes_e_emigrantes_nunca_negativo_nas_paginas(paginas, lang):
    c = catalogo(lang)
    re_linha = re.compile(
        rf'<th scope="row">(?:{re.escape(c.L_IMIGRANTES)}|{re.escape(c.L_EMIGRANTES)})</th>'
        r'<td class="num tabular">[^<]*</td><td class="num tabular">([^<]*)</td>')
    vistos = 0
    pref = f"{PREFIXO[lang]}/municipio/"
    for caminho in paginas:
        if not caminho.startswith(pref):
            continue
        for ic in re_linha.findall(paginas[caminho]):
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


@pytest.mark.parametrize("lang", LANGS)
def test_celula_de_precisao_do_saldo_e_curta(paginas, lang):
    """A célula longa ("sem classificação própria (ver imigrantes/emigrantes)") alargava a tabela."""
    c = catalogo(lang)
    alguma = next(paginas[k] for k in paginas if k.startswith(f"{PREFIXO[lang]}/municipio/"))
    assert "ver imigrantes/emigrantes" not in alguma
    assert f"<td>{c.SEM_CLASSIFICACAO}</td>" in alguma
    assert len(c.SEM_CLASSIFICACAO) <= 20


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


@pytest.mark.parametrize("lang", LANGS)
def test_gerar_og_image_escreve_png_com_a_fonte_versionada(tmp_path, monkeypatch, lang):
    pytest.importorskip("PIL.Image")
    monkeypatch.setattr(bp, "DIST", tmp_path)
    assert bp.gerar_og_image(lang) is True
    from PIL import Image
    img = Image.open(tmp_path / ("og.png" if lang == PT else f"og-{lang}.png"))
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
