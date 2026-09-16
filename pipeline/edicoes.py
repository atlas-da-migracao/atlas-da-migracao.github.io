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
    # False quando o questionário da edição não tem quesito de deslocamento pendular (ex.:
    # Censo 1991) -- nesse caso a edição não publica nenhuma tabela/coluna de pendular nem o
    # módulo RM pendular (pipeline/publish.py, F2b, e o submódulo pendular de RM). Distinto de
    # `rotulos_pendular`, que só cobre as dimensões frequencia/modo/tempo *dentro* do módulo
    # pendular quando ele existe -- `pendular=False` remove o módulo inteiro (inclusive
    # posicao/setor/renda_trab/nivel).
    pendular: bool = True
    # False quando a FONTE não publica identificador de domicílio e ele não é reconstruível
    # (hoje, só o Censo 1980: `numero_ordem` é a ordem da pessoa no domicílio, não um
    # identificador, e a extração veio do BigQuery sem ordem física garantida). Consequências,
    # todas declaradas: `controle` é NULL em toda a edição, `domicilios_apond.parquet` não é
    # gerado, `se`/`cv` são NULL e `precisao` é 'sem_estimativa' -- e, no gate, o piso de
    # domicílios de R1 (`ndom >= MIN_DOMICILIOS`) não é computável e cede lugar aos limiares
    # elevados de `disclosure_rules.limiares(chave_domicilio=False)`. Ver docs/METODOLOGIA.md,
    # seção do Censo 1980, item 8.
    chave_domicilio: bool = True
    # True só para o Censo 1980: a edição não tem quesito de data fixa (5 anos) -- a migração
    # publicada é um PROXY construído a partir de "tempo de residência no município" (v517) +
    # "município de residência anterior / última etapa" (v518), calibrado contra a data fixa
    # verdadeira de 1991 (MIMO86UF/MIMO86MU) em F9.2. Usado por build_meta.py, docs/EDICOES.md
    # e pelo front (selo "proxy" na capa/painéis) para nunca apresentar 1980 como data fixa.
    proxy_data_fixa: bool = False


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
        pendular=True,
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
        pendular=True,
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
        pendular=True,
    ),
    "1991": Edicao(
        nome="1991",
        raw="data/raw1991",
        interim="data/interim/1991",
        processed="data/processed/1991",
        geo_raw="data/geo/raw/1991",
        # Cr$ 36.161,60 -- NÃO é o salário mínimo legal vigente em 01/09/1991 (data de referência
        # do Censo): o Ipeadata confirma que o mínimo legal era Cr$ 17.000 até 31/08/1991 e
        # Cr$ 42.000 a partir de 01/09/1991. É, em vez disso, um valor de REFERÊNCIA IMPLÍCITO nas
        # próprias faixas de rendimento do questionário do Censo 1991 (RPRINCIF, 13 faixas de
        # rendimento da ocupação principal, e RDONOMIF, 11 faixas de rendimento domiciliar): o
        # valor foi recuperado por reconciliação, testando candidatos contra os limites dessas
        # faixas. Placar: 36.161,60 reproduz 13/13 e 11/11 faixas; 17.000 e 42.000 reproduzem 1/13
        # cada. 1991 é a primeira edição em que a renda NÃO vem pronta em SM -- ver explicação
        # completa em docs/METODOLOGIA.md, seção "Edição Censo 1991 e comparabilidade", item 7, e
        # em pipeline/sql/1991/MAPEAMENTO_02_classify.md §7.
        salario_minimo=36161.60,
        periodo_referencia={"de": "1986-09-01", "ate": "1991-09-01"},
        acesso="publico",
        rotulos_pendular={"frequencia": None, "modo": None, "tempo": None},
        pula_scripts=["07"],
        sql_override_dir="pipeline/sql/1991",
        pendular=False,  # ver docstring do campo em Edicao -- sem deslocamento pendular nesta edição
    ),
    "1980": Edicao(
        nome="1980",
        raw="data/raw1980",
        interim="data/interim/1980",
        processed="data/processed/1980",
        geo_raw="data/geo/raw/1980",
        # Cr$ 4.149,60 -- CONFIRMADO em F9.2 por reconciliação empírica (mesma técnica de 1991),
        # e não mais provisório. As faixas de rendimento em salários mínimos calculadas pelo
        # próprio IBGE (v680/v681/v682, 13 faixas) foram cruzadas com os valores em cruzeiros
        # (v607+v608+v609): Cr$ 4.149,60 reproduz 13/13 faixas; os mínimos regionais menores de
        # 1980 (3.939,60 / 3.734,64 / 3.458,00), o de novembro/1979 (3.300,00) e o de
        # novembro/1980 (5.788,80) reproduzem 2/13 cada. Diferente de 1991 -- onde o SM implícito
        # nas faixas NÃO era o legal --, aqui o valor reconciliado coincide com o mínimo legal da
        # região I vigente em maio/1980. RESSALVA: a reconciliação só pôde ser feita no Ceará, a
        # única partição da Base dos Dados em que as variáveis de renda estão preenchidas (0,0%
        # nas outras 26 UFs) -- e é por isso que a edição 1980 NÃO PUBLICA NENHUMA COLUNA DE
        # RENDA (renda_trab, renda_pc, renda_classe, renda_trab_classe são NULL/'nao_aplicavel').
        # Este valor fica declarado em meta.json para documentar a unidade monetária da época e
        # para uma eventual reextração que traga a renda das demais UFs. Ver
        # pipeline/sql/1980/MAPEAMENTO_02_classify.md §7 e docs/METODOLOGIA.md, seção
        # "Edição Censo 1980 e comparabilidade", item 7.
        salario_minimo=4149.60,
        # Período do proxy quinquenal (ver `proxy_data_fixa`): não é uma data fixa real do
        # questionário -- é a janela adotada para a migração publicada (v517 ∈ 0..4, chegada
        # entre 1975 e 1980); o universo decenal do quesito (v517 ∈ 0..6) fica só na calibração.
        periodo_referencia={"de": "1975-09-01", "ate": "1980-09-01"},
        acesso="publico",
        rotulos_pendular={"frequencia": None, "modo": None, "tempo": None},
        pula_scripts=[],
        sql_override_dir="pipeline/sql/1980",
        pendular=True,
        chave_domicilio=False,  # ver docstring do campo -- única edição sem identificador de domicílio
        proxy_data_fixa=True,
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
