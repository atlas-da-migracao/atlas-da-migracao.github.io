"""Catálogo de textos das páginas estáticas de SEO (pipeline/build_paginas.py), em quatro idiomas.

Um módulo por idioma (`pt`, `en`, `fr`, `es`), todos com os MESMOS nomes públicos (um teste em
pipeline/tests/test_paginas.py confere nomes e assinaturas). O português é o texto de referência:
`pt.py` reproduz o texto histórico do gerador; en/fr/es seguem `web/src/i18n/TERMINOLOGIA.md`.

Convenções dos módulos:
- constantes simples (`str`, `dict`) para rótulos curtos;
- funções `f(x, ...)` para frases com valores, gênero, plural ou links. `x` é o contexto do
  gerador (`build_paginas.Ctx`): `x.u(caminho)` (URL no idioma), `x.app(query)` (link para o SPA),
  `x.i/s/d/pct` (números no formato do idioma). Devolvem `Markup` (HTML) com os argumentos já
  escapados (`H(...).format(...)` escapa o que entra em `{}`).
- nunca se concatenam pedaços presumindo a ordem das palavras do português: a ordem é decidida
  dentro de cada função.
"""
from __future__ import annotations

import importlib
from types import ModuleType

from markupsafe import Markup

LANGS = ("pt-BR", "en", "fr", "es")
LANG_PADRAO = "pt-BR"

# prefixo de URL de cada idioma: o português fica na raiz (as URLs históricas não mudam)
PREFIXO = {"pt-BR": "", "en": "/en", "fr": "/fr", "es": "/es"}
HTML_LANG = {l: l for l in LANGS}
OG_LOCALE = {"pt-BR": "pt_BR", "en": "en_US", "fr": "fr_FR", "es": "es_ES"}
# rótulo do seletor de idioma: sigla no link, nome no próprio idioma no `title`
SELETOR = {"pt-BR": ("PT", "Português"), "en": ("EN", "English"), "fr": ("FR", "Français"),
           "es": ("ES", "Español")}
# `?lang=` aceito pelo SPA (web/src/i18n/tipos.ts: lerLang)
LANG_SPA = {"pt-BR": "pt", "en": "en", "fr": "fr", "es": "es"}

# separadores numéricos: (milhar, decimal, sufixo do percentual). O milhar é sempre aplicado, inclusive
# com 4 dígitos (como `useGrouping: "always"` em web/src/lib/format.ts). No francês, o milhar é o
# espaço fino inseparável U+202F e o percentual leva espaço inseparável (como o `Intl` fr-FR); no
# espanhol, o percentual leva U+00A0.
SEPARADORES = {
    "pt-BR": (".", ",", "%"),
    "en": (",", ".", "%"),
    "fr": (" ", ",", " %"),
    "es": (".", ",", " %"),
}

H = Markup


_CATALOGOS: dict[str, ModuleType] = {}


def catalogo(lang: str) -> ModuleType:
    """Módulo do catálogo de `lang` (importado sob demanda)."""
    c = _CATALOGOS.get(lang)
    if c is None:
        if lang not in LANGS:
            raise ValueError(f"idioma não suportado: {lang!r}")
        nome = {"pt-BR": "pt"}.get(lang, lang)
        c = _CATALOGOS[lang] = importlib.import_module(f"{__name__}.{nome}")
    return c


def url_lang(caminho: str, lang: str) -> str:
    """Caminho de página (`/municipio/x/`, chave independente de idioma) -> caminho no idioma.
    Só para páginas HTML geradas: ativos (`/data/`, `/static.css`...) não passam por aqui."""
    return PREFIXO[lang] + caminho if PREFIXO[lang] else caminho


def agrupar(n: int, lang: str) -> str:
    return f"{n:,}".replace(",", SEPARADORES[lang][0])


def decimal(v: float, casas: int, lang: str) -> str:
    """`v` com `casas` decimais, milhar e decimal do idioma. Negativos: no português mantém-se o
    hífen histórico do gerador ("-1,23"); em en/fr/es sai o "−" tipográfico (U+2212), sem sinal
    quando o valor arredondado é zero (TERMINOLOGIA.md, seção 3)."""
    mil, dec, _ = SEPARADORES[lang]
    s = f"{abs(v):,.{casas}f}"
    inteiro, _, frac = s.partition(".")
    s = inteiro.replace(",", mil) + (dec + frac if frac else "")
    if v < 0:
        if lang == "pt-BR":
            return "-" + s
        if float(f"{abs(v):.{casas}f}") != 0:
            return "−" + s
    return s
