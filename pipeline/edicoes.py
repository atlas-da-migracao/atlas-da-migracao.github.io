"""Configuração por edição do Censo (2022, 2010): fonte única dos paths e das constantes
que variam entre edições, para que `pipeline/run.py` e os demais scripts não precisem
hardcodar "data/interim/2010", "data/processed/2010" etc. espalhados pelo código.

Convenção de layout (ver plano, decisão arquitetural 1): a edição 2022 continua "flat" na
raiz de `data/interim`/`data/processed` (comportamento inalterado); as demais edições ganham
subpasta própria (`data/interim/<edicao>`, `data/processed/<edicao>`, `data/geo/raw/<edicao>`).

Regra de sigilo: este módulo só declara caminhos como string -- nunca lê nem referencia
conteúdo de `data/raw*`/`data/interim`.
"""
from __future__ import annotations

from dataclasses import dataclass, field

DEFAULT = "2022"


@dataclass(frozen=True)
class Edicao:
    nome: str
    raw: str
    interim: str
    processed: str
    geo_raw: str
    salario_minimo: float
    periodo_referencia: dict[str, str]
    # prefixos (NN) de pipeline/sql/*.sql a NÃO rodar nesta edição (ex.: edição sem algum
    # módulo).
    pula_scripts: list[str] = field(default_factory=list)
    # diretório com overrides de pipeline/sql/NN_nome.sql específicos da edição; None quando
    # a edição reaproveita 100% dos scripts de pipeline/sql/.
    sql_override_dir: str | None = None


EDICOES: dict[str, Edicao] = {
    "2022": Edicao(
        nome="2022",
        raw="data/raw",
        interim="data/interim",
        processed="data/processed",
        geo_raw="data/geo/raw",
        salario_minimo=1212.00,
        periodo_referencia={"de": "2017-07-31", "ate": "2022-07-31"},
        pula_scripts=[],
        sql_override_dir=None,
    ),
    "2010": Edicao(
        nome="2010",
        raw="data/raw2010",
        interim="data/interim/2010",
        processed="data/processed/2010",
        geo_raw="data/geo/raw/2010",
        salario_minimo=510.00,
        periodo_referencia={"de": "2005-07-31", "ate": "2010-07-31"},
        pula_scripts=[],
        sql_override_dir="pipeline/sql/2010",
    ),
}


def edicao(nome: str = DEFAULT) -> Edicao:
    """Devolve a configuração da edição `nome`; erro claro se ela não existir em EDICOES."""
    try:
        return EDICOES[nome]
    except KeyError:
        disponiveis = ", ".join(sorted(EDICOES))
        raise ValueError(
            f"Edição {nome!r} desconhecida. Edições disponíveis: {disponiveis}."
        ) from None
