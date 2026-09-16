"""Regras de controle estatístico de revelação (R1-R9) do projeto.

Ver docs/METODOLOGIA.md e o plano aprovado. Estas constantes são a única fonte de
verdade: `publish.py` as aplica e `disclosure_check.py` as verifica de forma independente.
"""
from __future__ import annotations

from dataclasses import dataclass

# R1 -- limiar mínimo por célula publicada
MIN_PESSOAS = 5          # observações amostrais (pessoas) por célula
MIN_DOMICILIOS = 3       # domicílios distintos por célula

# R2 -- detalhamento por características só para fluxos com massa amostral suficiente
MIN_PESSOAS_DETALHE = 20

# R1/R2 em edições SEM chave de domicílio (`Edicao.chave_domicilio = False`; hoje, só o Censo
# 1980). O piso de domicílios de R1 não protege contra célula pequena -- disso já cuida
# MIN_PESSOAS --, e sim contra célula sustentada por POUCAS UNIDADES CORRELACIONADAS: cinco
# pessoas podem ser uma família só que migrou junto. Quando a fonte não publica identificador de
# domicílio, `COUNT(DISTINCT controle)` é 0 para todo grupo e o piso não é computável; deixá-lo
# cair calado transformaria `n >= 5` no único guarda-chuva -- e a calibração mostra que ele não
# basta: em 1991, 80,3% dos pares com n = 5 têm menos de 3 domicílios.
#
# Substituto adotado: cada patamar sobe UM DEGRAU na própria escada de limiares do projeto
# (5 -> 20 para publicar a linha; 20 -> 50 para publicar o detalhe). Calibração contra as quatro
# edições que têm a chave (ver docs/METODOLOGIA.md, seção do Censo 1980, item 8.2):
#   - n >= 20: a fração de células que o piso de domicílios rejeitaria cai a 0,029% em 1991 e a
#     0,000% em 2000 (era 39,9% e 33,8% com n >= 5), e a cobertura de volume migratório publicada
#     em 1980 fica em 70,7%, dentro da faixa de 67,6%-71,6% das edições que aplicam a regra real;
#   - n >= 50: acima da MAIOR célula observada, em qualquer tabela de qualquer edição, que o piso
#     de domicílios rejeitaria (n = 36, perfis municipais de 2022; n = 23 nos fluxos de 1991) --
#     o detalhe por características, que é o conteúdo identificante, nunca sai de uma célula que
#     pudesse ser uma ou duas famílias.
MIN_PESSOAS_SEM_DOMICILIO = 20
MIN_PESSOAS_DETALHE_SEM_DOMICILIO = 50


@dataclass(frozen=True)
class Limiares:
    """Limiares de R1/R2 efetivos para uma edição. Use `limiares(ed.chave_domicilio)`.

    `min_domicilios is None` significa "esta edição não tem chave de domicílio": o piso de
    domicílios sai do predicado e `min_pessoas`/`min_pessoas_detalhe` já vêm elevados.
    """
    min_pessoas: int
    min_domicilios: int | None
    min_pessoas_detalhe: int

    @property
    def sem_chave_domicilio(self) -> bool:
        return self.min_domicilios is None

    def sql_r1(self, n: str = "n", ndom: str = "ndom") -> str:
        """Predicado SQL de R1 (linha publicável)."""
        if self.min_domicilios is None:
            return f"{n} >= {self.min_pessoas}"
        return f"{n} >= {self.min_pessoas} AND {ndom} >= {self.min_domicilios}"

    def sql_viola_r1(self, n: str = "n", ndom: str = "ndom") -> str:
        """Negação de `sql_r1`, incluindo o caso de a célula não existir na amostra (NULL).

        É o predicado que `disclosure_check.py` usa para caçar violação; fica aqui para que a
        regra e a verificação independente não possam divergir por edição de um só lado.
        """
        cond = f"{n} IS NULL OR {n} < {self.min_pessoas}"
        if self.min_domicilios is not None:
            cond += f" OR {ndom} < {self.min_domicilios}"
        return cond

    def sql_r2(self, n: str = "n", ndom: str = "ndom") -> str:
        """Predicado do piso de DETALHE (R2) somado ao piso de domicílios de R1, onde ele existe.

        Usado onde a publicação exige as duas coisas ao mesmo tempo (a caracterização pendular,
        que só sai para par com detalhe). Numa edição sem chave de domicílio sobra só o piso de
        pessoas -- que já vem elevado -- e o termo de domicílio some do SQL.
        """
        cond = f"{n} >= {self.min_pessoas_detalhe}"
        if self.min_domicilios is not None:
            cond += f" AND {ndom} >= {self.min_domicilios}"
        return cond

    def faixas_abaixo_r1(self) -> list[str]:
        """Rótulos de R5 inteiramente abaixo do piso de pessoas de R1.

        Nenhuma célula publicada com categoria nominal (isto é, fora do residual `outros`) pode
        cair num deles. Com o piso padrão de 5 é só `<5`; com o piso de 20 das edições sem chave
        de domicílio, também `5-19`.
        """
        return ["<5"] + [rot for _, hi, rot in FAIXAS_N if hi is not None and hi < self.min_pessoas]

    def descricao_r1(self) -> str:
        if self.min_domicilios is None:
            return (f"≥ {self.min_pessoas} pessoas (edição sem chave de domicílio: o piso de "
                    f"domicílios é substituído pelo piso elevado de pessoas)")
        return f"≥ {self.min_pessoas} pessoas e ≥ {self.min_domicilios} domicílios"

    def descricao_r2(self) -> str:
        sufixo = " (elevado por ausência de chave de domicílio)" if self.sem_chave_domicilio else ""
        return f"só em fluxos com ≥ {self.min_pessoas_detalhe} observações{sufixo}"


def limiares(chave_domicilio: bool = True) -> Limiares:
    """Limiares efetivos de R1/R2 conforme a edição tenha ou não chave de domicílio."""
    if chave_domicilio:
        return Limiares(MIN_PESSOAS, MIN_DOMICILIOS, MIN_PESSOAS_DETALHE)
    return Limiares(MIN_PESSOAS_SEM_DOMICILIO, None, MIN_PESSOAS_DETALHE_SEM_DOMICILIO)

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
    # Censo 1980: mesmo vocabulário reduzido de 1991/2010/2000 -- a migração é um proxy
    # (v517 + v518, ver pipeline/edicoes.py `proxy_data_fixa`), mas a distinção
    # primeira_saida/etapas_multiplas depende só do município natal vs. de residência, que o
    # proxy também não sustenta (só última etapa) -- ver pipeline/sql/1980/02_classify.sql e
    # docs/METODOLOGIA.md.
    "1980": ["retorno_natal", "nao_natural", "nascido_exterior"],
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
