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

# Descrição em prosa de Edicao.acesso, usada por build_meta.py (fonte/aviso de meta.json) e
# disclosure_check.py (linha "Fonte" do relatório de revelação) -- fonte única para as duas.
ACESSO_DESCRICAO = {"controlado": "acesso controlado", "publico": "dados públicos"}


@dataclass(frozen=True)
class Edicao:
    nome: str
    raw: str
    interim: str
    processed: str
    geo_raw: str
    salario_minimo: float
    periodo_referencia: dict[str, str]
    # "controlado" (microdados de acesso controlado do IBGE, ex.: Censo 2022) ou "publico"
    # (microdados públicos, ex.: Censo 2010/2000) -- ver CLAUDE.md, regras de sigilo, e
    # build_meta.py, que usa este campo para redigir "fonte"/"aviso" em meta.json.
    acesso: str
    # rótulos das dimensões do módulo pendular (F2b) que variam por edição: até as chaves
    # "frequencia", "modo", "tempo", cada uma para o dict de rótulos publicado por esta
    # edição, ou None quando a edição não publica aquela dimensão (build_meta.py usa isso
    # para sobrescrever/remover a chave correspondente em ROTULOS).
    rotulos_pendular: dict[str, dict[str, str] | None]
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
        acesso="controlado",
        rotulos_pendular={
            "frequencia": {
                "retorno_diario": "Retorna 3+ dias/semana",
                "semanal_longa": "Retorno semanal ou mais longo",
            },
            "modo": {
                "a_pe_bicicleta": "A pé ou bicicleta", "motocicleta": "Motocicleta ou mototáxi",
                "automovel_taxi": "Automóvel ou táxi", "onibus_van_brt": "Ônibus, van ou BRT",
                "trem_metro": "Trem ou metrô", "outros": "Outros",
            },
        },
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
        acesso="publico",
        rotulos_pendular={
            "frequencia": {
                "retorno_diario": "Retorna diariamente",
                "semanal_longa": "Não retorna diariamente",
            },
            "modo": None,  # não existe em 2010 -- remove a chave herdada de ROTULOS
            "tempo": {
                "ate_5min": "Até 5 min",
                "de_6_a_30min": "6 a 30 min",
                "de_31min_a_1h": "31 min a 1 h",
                "de_1_a_2h": "1 a 2 h",
                "mais_de_2h": "Mais de 2 h",
                "nao_se_aplica": "Não retorna diariamente",
            },
        },
        pula_scripts=[],
        sql_override_dir="pipeline/sql/2010",
    ),
    "2000": Edicao(
        nome="2000",
        raw="data/raw2000",
        interim="data/interim/2000",
        processed="data/processed/2000",
        geo_raw="data/geo/raw/2000",
        salario_minimo=151.00,
        periodo_referencia={"de": "1995-07-31", "ate": "2000-07-31"},
        acesso="publico",
        rotulos_pendular={
            "frequencia": None,  # não existe em 2000 -- nenhum quesito de frequência de retorno
            "modo": None,        # não existe em 2000 -- nenhum quesito de meio de transporte
            "tempo": None,       # não existe em 2000 -- nem faixas nem minutos
        },
        pula_scripts=[],
        sql_override_dir="pipeline/sql/2000",
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
