"""Regras de controle estatístico de revelação (R1-R9) do projeto.

Ver docs/METODOLOGIA.md e o plano aprovado. Estas constantes são a única fonte de
verdade: `publish.py` as aplica e `disclosure_check.py` as verifica de forma independente.
"""

# R1 -- limiar mínimo por célula publicada
MIN_PESSOAS = 5          # observações amostrais (pessoas) por célula
MIN_DOMICILIOS = 3       # domicílios distintos por célula

# R2 -- detalhamento por características só para fluxos com massa amostral suficiente
MIN_PESSOAS_DETALHE = 20

# R4 -- arredondamento das estimativas ponderadas publicadas
ARREDONDAMENTO = 5

# R5 -- faixas de n divulgadas (nunca o valor exato abaixo de 50)
FAIXAS_N = [(5, 19, "5-19"), (20, 49, "20-49"), (50, 99, "50-99"),
            (100, 499, "100-499"), (500, None, ">=500")]

# Classes de precisão (Guia IBGE 2021)
CV_BOA, CV_CAUTELA = 15.0, 30.0

# R6 -- colunas jamais publicadas (identificam domicílio ou área de ponderação)
COLUNAS_PROIBIDAS = {"controle", "cd_apond", "apond", "d0100", "p0100", "d0090", "p0090"}

# Dimensões e categorias publicadas (R6: nenhum cruzamento de 3+ dimensões temáticas).
# Vocabulário-padrão (edição 2022, ver pipeline/edicoes.py); DIMENSOES continua sendo a
# constante usada quando nenhuma edição é passada, para não quebrar chamadores existentes.
DIMENSOES = {
    "status": ["retorno_natal", "primeira_saida", "etapas_multiplas", "nascido_exterior"],
    "edu": ["sem_instr_fund_incompleto", "fund_completo_medio_incompleto",
            "medio_completo_superior_incompleto", "superior_completo", "nao_determinado"],
    "renda": ["ate_1_4_sm", "de_1_4_a_1_2_sm", "de_1_2_a_1_sm", "de_1_a_2_sm",
              "mais_de_2_sm", "nao_aplicavel"],
    "idade_sexo": ["05_14_M", "05_14_F", "15_24_M", "15_24_F", "25_39_M", "25_39_F",
                   "40_59_M", "40_59_F", "60_mais_M", "60_mais_F"],
}

# Vocabulário de `status` por edição: só essa dimensão varia entre 2022 e 2010 (edu/renda/
# idade_sexo usam o mesmo vocabulário nas duas). O Censo 2010 não coleta o município de
# nascimento, então `primeira_saida`/`etapas_multiplas` (que dependem de comparar o município
# natal ao de residência 5 anos antes) são indistinguíveis e colapsam em `nao_natural` -- ver
# pipeline/sql/2010/02_classify.sql e docs/METODOLOGIA.md, "Edição Censo 2010 e comparabilidade".
STATUS_POR_EDICAO = {
    "2022": DIMENSOES["status"],
    "2010": ["retorno_natal", "nao_natural", "nascido_exterior"],
    # Censo 2000 não coleta o município de nascimento (só UF/país, V4210), mesma ausência de
    # 2010 -- ver pipeline/sql/2000/02_classify.sql e docs/METODOLOGIA.md.
    "2000": ["retorno_natal", "nao_natural", "nascido_exterior"],
    # Censo 1991: mesmo vocabulário reduzido de 2010/2000 (sem distinguir primeira_saida/
    # etapas_multiplas) -- ver pipeline/sql/1991/02_classify.sql e docs/METODOLOGIA.md.
    "1991": ["retorno_natal", "nao_natural", "nascido_exterior"],
}


def dimensoes(edicao: str = "2022") -> dict[str, list[str]]:
    """DIMENSOES publicáveis para `edicao`. Usada por publish.py/disclosure_check.py em vez da
    constante DIMENSOES sempre que a edição não é necessariamente 2022.

    Falha alto (ValueError) se `edicao` não tiver vocabulário de `status` registrado em
    STATUS_POR_EDICAO, em vez de cair silenciosamente no vocabulário de 2022: uma edição
    nova precisa declarar explicitamente como suas categorias de status se comparam às de
    2022 (ver docs/METODOLOGIA.md) antes de publicar dados.
    """
    if edicao not in STATUS_POR_EDICAO:
        raise ValueError(
            f"Edição {edicao!r} sem vocabulário de status registrado em STATUS_POR_EDICAO"
        )
    d = dict(DIMENSOES)
    d["status"] = STATUS_POR_EDICAO[edicao]
    return d


def faixa_n(n: int) -> str:
    """R5: converte a contagem amostral na faixa divulgável."""
    for lo, hi, rot in FAIXAS_N:
        if n >= lo and (hi is None or n <= hi):
            return rot
    return "<5"


def sql_faixa_n(col: str) -> str:
    """Mesma regra de `faixa_n`, em SQL."""
    return (
        f"CASE WHEN {col} < 5 THEN '<5' WHEN {col} <= 19 THEN '5-19' "
        f"WHEN {col} <= 49 THEN '20-49' WHEN {col} <= 99 THEN '50-99' "
        f"WHEN {col} <= 499 THEN '100-499' ELSE '>=500' END"
    )


def sql_arredonda(col: str) -> str:
    """R4: arredonda para múltiplo de ARREDONDAMENTO."""
    return f"ROUND({col} / {ARREDONDAMENTO}.0) * {ARREDONDAMENTO}"


def classe_precisao(cv: float | None) -> str:
    if cv is None:
        return "sem_estimativa"
    if cv <= CV_BOA:
        return "boa"
    if cv <= CV_CAUTELA:
        return "cautela"
    return "baixa"
