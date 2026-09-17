"""Medidas comparativas de migração interna, ancoradas na literatura demográfica (F12.3).

Módulo de **funções puras**: recebe DataFrames/arrays/dicts já carregados de
`data/processed[/<edicao>]/` (por quem chama), nunca abre arquivo, nunca imprime microdados e
nunca toca em `data/raw*`/`data/interim*`. Isso é deliberado: o objetivo é ser testável com dados
sintéticos pequenos, sem depender de DuckDB nem de acesso aos microdados controlados do IBGE (ver
`CLAUDE.md`, regras de sigilo).

`pipeline/build_series.py` (F12.4, implementado por outro agente) importa estas funções para montar
a série comparativa publicada em `data/processed/series/`.

Duas famílias de medidas, conforme o plano (`~/.claude/plans/vamos-retomar-o-plano-expressive-
lobster.md`, seção "Conjunto de análises (ancorado na literatura)"):

- **Bloco 1** (medidas de uma unidade): turnover, taxa de rotatividade, distância média
  ponderada, % interestadual, conectividade, índices de Gini de linha/coluna.
- **Bloco 2** (medidas de sistema/nível): CMI, SMI, MEI agregado, ANMR, beta de Fielding,
  índice de dissimilaridade de Duncan, decomposição log-linear (IPF).

Convenção de erro: entradas estruturalmente inválidas (DataFrame vazio quando um valor é exigido,
colunas ausentes) levantam `ValueError` com mensagem clara. Dados insuficientes mas estruturalmente
válidos (ex.: uma unidade sem nenhum fluxo publicado, uma faixa de idade sem população) retornam
`None`/`NaN` em vez de lançar exceção -- o pipeline deve poder seguir adiante com um buraco na
série, não quebrar por completo.
"""
from __future__ import annotations

import math
from typing import Any

import numpy as np
import pandas as pd

__all__ = [
    "turnover",
    "taxa_rotatividade",
    "distancia_media_ponderada",
    "pct_interestadual",
    "conectividade",
    "gini_linha",
    "gini_coluna",
    "cmi",
    "smi",
    "mei_agregado",
    "anmr",
    "beta_fielding",
    "duncan_d",
    "decomposicao_loglinear",
]


# ---------------------------------------------------------------------------
# Bloco 1 -- medidas de uma unidade
# ---------------------------------------------------------------------------


def turnover(imig: float, emig: float) -> float:
    """Turnover migratório de uma unidade: T = imigrantes + emigrantes.

    Fórmula: T = I + E.

    Domínio de validade: `imig` e `emig` devem ser não negativos (contagens/estimativas
    ponderadas de fluxo). Não há mínimo de unidades -- é uma medida escalar de uma unidade só.

    Dados insuficientes: se `imig` ou `emig` forem `None`/`NaN`, retorna `float('nan')`.
    """
    if imig is None or emig is None:
        return float("nan")
    if math.isnan(imig) or math.isnan(emig):
        return float("nan")
    return float(imig) + float(emig)


def taxa_rotatividade(turnover: float, pop5: float) -> float:
    """Taxa de rotatividade migratória por mil habitantes: 1000 * T / pop5.

    Fórmula: taxa = 1000 * T / P5, onde P5 é a população de referência (idade 5+ nos censos que
    perguntam migração para essa faixa; ver `docs/METODOLOGIA.md`).

    Domínio de validade: `pop5 > 0`.

    Dados insuficientes: se `pop5` for `None`/`NaN`/`<= 0`, ou `turnover` for `None`/`NaN`,
    retorna `float('nan')` (nunca lança `ZeroDivisionError`).
    """
    if turnover is None or pop5 is None:
        return float("nan")
    if math.isnan(turnover) or math.isnan(pop5) or pop5 <= 0:
        return float("nan")
    return 1000.0 * turnover / pop5


def _distancia_euclidiana(x0: float, y0: float, x1: float, y1: float) -> float:
    return math.hypot(x1 - x0, y1 - y0)


def _mediana_ponderada(valores: np.ndarray, pesos: np.ndarray) -> float:
    """Mediana ponderada de uma distribuição de frequência acumulada.

    Ordena `valores` e acumula `pesos` normalizados; retorna o primeiro valor cujo peso
    acumulado atinge 0.5 (definição padrão de mediana ponderada por percentil, equivalente à
    leitura da distribuição de frequência acumulada num histograma).
    """
    ordem = np.argsort(valores)
    v = valores[ordem]
    p = pesos[ordem]
    total = p.sum()
    if total <= 0:
        return float("nan")
    acumulado = np.cumsum(p) / total
    idx = int(np.searchsorted(acumulado, 0.5))
    idx = min(idx, len(v) - 1)
    return float(v[idx])


def distancia_media_ponderada(
    fluxos_df: pd.DataFrame,
    centroides_df: pd.DataFrame,
    unidade: str | None = None,
    origem_col: str = "origem",
    destino_col: str = "destino",
    valor_col: str = "total",
    id_col: str = "cd_mun",
    x_col: str = "x_albers",
    y_col: str = "y_albers",
) -> tuple[float, float]:
    """Distância média e mediana ponderadas pelo volume dos fluxos de uma unidade.

    MMD (mean migration distance): MMD = Σ M_ij·d_ij / Σ M_ij.
    MedMD (median migration distance): mediana ponderada da distribuição de frequência acumulada
    dos pares ordenados por distância -- não a mediana simples do vetor de distâncias.

    `d_ij` é a distância euclidiana entre os centroides publicados em `geo/centroides*.parquet`
    (colunas `x_albers`/`y_albers`, projeção cônica equivalente de Albers, em METROS -- ver
    `docs/METODOLOGIA.md`, "Cartografia: projeção cônica equivalente de Albers (F10)"). Como a
    projeção é equivalente de área e não conforme, a distância medida em Albers tem uma leve
    distorção de forma (até ~6,6% no extremo sul do país) em relação à distância geodésica real;
    aceitável para uma medida-resumo comparativa entre censos, não para uso métrico de precisão.

    Se `unidade` for informado, filtra `fluxos_df` a pares onde `origem_col == unidade` OU
    `destino_col == unidade` (fluxos de e para a unidade, ambos contam para o perfil de distância
    dela). Se `unidade` for `None`, assume que `fluxos_df` já vem filtrado para uma única unidade
    (uso mais comum ao iterar por unidade a partir de uma tabela `fluxos*` inteira).

    Domínio de validade: requer ao menos 1 par origem-destino com `valor_col > 0` e ambos os
    centroides presentes em `centroides_df`.

    Dados insuficientes: se não houver nenhum par válido após o filtro e o join com os
    centroides, retorna `(float('nan'), float('nan'))`. Nunca lança exceção nesse caso -- só
    levanta `ValueError` se `fluxos_df` ou `centroides_df` estiverem vazios (estruturalmente
    inválido) ou faltar alguma coluna esperada.
    """
    if fluxos_df is None or fluxos_df.empty:
        raise ValueError("fluxos_df vazio ou None")
    if centroides_df is None or centroides_df.empty:
        raise ValueError("centroides_df vazio ou None")
    for col in (origem_col, destino_col, valor_col):
        if col not in fluxos_df.columns:
            raise ValueError(f"coluna ausente em fluxos_df: {col}")
    for col in (id_col, x_col, y_col):
        if col not in centroides_df.columns:
            raise ValueError(f"coluna ausente em centroides_df: {col}")

    df = fluxos_df
    if unidade is not None:
        df = df[(df[origem_col] == unidade) | (df[destino_col] == unidade)]
    if df.empty:
        return (float("nan"), float("nan"))

    cent = centroides_df.set_index(id_col)[[x_col, y_col]]
    df = df.merge(
        cent.rename(columns={x_col: "_x_o", y_col: "_y_o"}),
        left_on=origem_col, right_index=True, how="inner",
    ).merge(
        cent.rename(columns={x_col: "_x_d", y_col: "_y_d"}),
        left_on=destino_col, right_index=True, how="inner",
    )
    df = df[df[valor_col] > 0]
    if df.empty:
        return (float("nan"), float("nan"))

    dist = np.hypot(df["_x_d"].to_numpy() - df["_x_o"].to_numpy(),
                     df["_y_d"].to_numpy() - df["_y_o"].to_numpy())
    peso = df[valor_col].to_numpy(dtype=float)
    total_peso = peso.sum()
    if total_peso <= 0:
        return (float("nan"), float("nan"))

    mmd = float((peso * dist).sum() / total_peso)
    medmd = _mediana_ponderada(dist, peso)
    return (mmd, medmd)


def pct_interestadual(
    fluxos_df: pd.DataFrame,
    uf_origem_col: str,
    uf_destino_col: str,
    valor_col: str = "total",
) -> float:
    """Fração do volume total de fluxo cuja UF de origem difere da UF de destino.

    Fórmula: pct = Σ M_ij [UF_i ≠ UF_j] / Σ M_ij.

    `uf_origem_col`/`uf_destino_col` devem já estar resolvidas em `fluxos_df` (ex.: via join
    prévio de `municipios.parquet` para trazer a UF de origem e destino a partir dos códigos de
    município/RGI/RGInt) -- este módulo não faz esse join sozinho.

    Domínio de validade: requer `Σ M_ij > 0`.

    Dados insuficientes: se `fluxos_df` não tiver nenhum volume positivo, retorna `float('nan')`.
    Levanta `ValueError` se `fluxos_df` for vazio/None ou faltar alguma coluna.
    """
    if fluxos_df is None or fluxos_df.empty:
        raise ValueError("fluxos_df vazio ou None")
    for col in (uf_origem_col, uf_destino_col, valor_col):
        if col not in fluxos_df.columns:
            raise ValueError(f"coluna ausente em fluxos_df: {col}")

    total = fluxos_df[valor_col].sum()
    if not total or total <= 0:
        return float("nan")
    interestadual = fluxos_df.loc[
        fluxos_df[uf_origem_col] != fluxos_df[uf_destino_col], valor_col
    ].sum()
    return float(interestadual / total)


def conectividade(
    fluxos_df: pd.DataFrame,
    unidade: str | None = None,
    origem_col: str = "origem",
    destino_col: str = "destino",
    valor_col: str = "total",
) -> int:
    """Número de pares origem-destino distintos publicados envolvendo a unidade.

    Conta pares (origem, destino) com `valor_col > 0` -- independente de `tem_detalhe` (que só
    indica se o par tem perfil detalhado por status/edu/renda/idade_sexo publicado, não se o par
    em si existe). Se `unidade` for `None`, conta todos os pares de `fluxos_df` (uso: já veio
    filtrado para uma unidade).

    Domínio de validade: nenhum mínimo -- pode ser 0 (unidade isolada, sem fluxo publicado acima
    do limiar de revelação).

    Dados insuficientes: nunca retorna `None`; 0 é uma resposta válida. Levanta `ValueError` se
    `fluxos_df` for `None` (mas não se for vazio -- vazio é 0 pares, resposta válida).
    """
    if fluxos_df is None:
        raise ValueError("fluxos_df é None")
    if fluxos_df.empty:
        return 0
    for col in (origem_col, destino_col, valor_col):
        if col not in fluxos_df.columns:
            raise ValueError(f"coluna ausente em fluxos_df: {col}")

    df = fluxos_df
    if unidade is not None:
        df = df[(df[origem_col] == unidade) | (df[destino_col] == unidade)]
    df = df[df[valor_col] > 0]
    return int(df[[origem_col, destino_col]].drop_duplicates().shape[0])


def _gini(valores: np.ndarray) -> float:
    """Índice de Gini univariado de um vetor de volumes não negativos.

    Fórmula (forma de diferenças médias absolutas normalizada, equivalente à definição por área
    de Lorenz para vetores discretos):

        G = Σ_i Σ_j |x_i - x_j| / (2 * n * Σ_i x_i)

    G = 0 quando o vetor é uniforme (dispersão total); G -> (n-1)/n quando todo o volume se
    concentra num único elemento (foco total).
    """
    x = np.asarray(valores, dtype=float)
    n = x.size
    total = x.sum()
    if n == 0 or total <= 0:
        return float("nan")
    if n == 1:
        return 0.0
    diffs = np.abs(x[:, None] - x[None, :]).sum()
    return float(diffs / (2 * n * total))


def gini_linha(
    fluxos_df: pd.DataFrame,
    unidade: str | None = None,
    origem_col: str = "origem",
    destino_col: str = "destino",
    valor_col: str = "total",
) -> float:
    """Índice de Gini da distribuição dos fluxos de ORIGEM de uma unidade (linha da matriz O-D).

    Mede a concentração/dispersão dos destinos de quem sai da unidade: um valor por destino
    (agregando, se houver duplicatas). G alto = poucos destinos concentram quase todo o fluxo de
    saída; G baixo = fluxo de saída disperso por muitos destinos.

    Simplificação em relação a Plane, D.A. & Mulligan, G.F. (1997), "Measuring spatial focusing
    in a migration system", *Demography* 34(2):251-262: o artigo original define o índice sobre a
    matriz completa do sistema (foco espacial do sistema inteiro). Aqui aplica-se a fórmula de
    Gini univariada (ver `_gini`) ao vetor de volumes de uma única linha (ou coluna, em
    `gini_coluna`) da matriz O-D de uma unidade -- suficiente para medir concentração/dispersão
    da distribuição de parceiros dessa unidade, mas não reproduz o índice de foco do sistema
    inteiro do artigo original.

    Domínio de validade: requer ao menos 1 destino com `valor_col > 0`. Com 1 único destino,
    retorna 0.0 (nenhuma dispersão possível, concentração trivial).

    Dados insuficientes: se não houver nenhum fluxo de saída da unidade, retorna `float('nan')`.
    """
    if fluxos_df is None or fluxos_df.empty:
        raise ValueError("fluxos_df vazio ou None")
    for col in (origem_col, destino_col, valor_col):
        if col not in fluxos_df.columns:
            raise ValueError(f"coluna ausente em fluxos_df: {col}")

    df = fluxos_df
    if unidade is not None:
        df = df[df[origem_col] == unidade]
    df = df[df[valor_col] > 0]
    if df.empty:
        return float("nan")
    por_destino = df.groupby(destino_col)[valor_col].sum()
    return _gini(por_destino.to_numpy())


def gini_coluna(
    fluxos_df: pd.DataFrame,
    unidade: str | None = None,
    origem_col: str = "origem",
    destino_col: str = "destino",
    valor_col: str = "total",
) -> float:
    """Índice de Gini da distribuição dos fluxos de DESTINO de uma unidade (coluna da matriz O-D).

    Simétrico a `gini_linha`, mas sobre quem chega na unidade: um valor por origem. Mesma
    simplificação em relação a Plane & Mulligan (1997) documentada em `gini_linha` -- ver ali a
    referência completa e a ressalva metodológica.

    Domínio de validade e comportamento em caso de dados insuficientes: idênticos a `gini_linha`,
    trocando "destino" por "origem" como eixo agregado.
    """
    if fluxos_df is None or fluxos_df.empty:
        raise ValueError("fluxos_df vazio ou None")
    for col in (origem_col, destino_col, valor_col):
        if col not in fluxos_df.columns:
            raise ValueError(f"coluna ausente em fluxos_df: {col}")

    df = fluxos_df
    if unidade is not None:
        df = df[df[destino_col] == unidade]
    df = df[df[valor_col] > 0]
    if df.empty:
        return float("nan")
    por_origem = df.groupby(origem_col)[valor_col].sum()
    return _gini(por_origem.to_numpy())


# ---------------------------------------------------------------------------
# Bloco 2 -- medidas de sistema/nível
# ---------------------------------------------------------------------------


def cmi(matriz_fluxos_total: pd.DataFrame | float, pop_total: float, valor_col: str = "total") -> float:
    """Crude Migration Intensity (CMI): CMI = 100 * M / P.

    `M` é a soma de todos os fluxos inter-unidades do nível (a matriz O-D completa publicada não
    tem diagonal -- migração intra-unidade não é observável nessas tabelas, então não há dupla
    contagem a excluir). `P` é a população total do nível na mesma edição.

    `matriz_fluxos_total` pode ser um DataFrame com a coluna `valor_col` (soma-se aqui) ou já um
    escalar (soma pronta de `M`, calculada por quem chama).

    Referência: Bell, M. et al. (2002), "Cross-National Comparison of Internal Migration:
    Issues and Measures", *Journal of the Royal Statistical Society A* 165(3), que define CMI
    como medida-resumo comparável de intensidade migratória entre sistemas/países.

    Domínio de validade: `pop_total > 0`.

    Dados insuficientes: se `pop_total` for `None`/`NaN`/`<=0`, retorna `float('nan')`.
    """
    if isinstance(matriz_fluxos_total, pd.DataFrame):
        if matriz_fluxos_total.empty:
            raise ValueError("matriz_fluxos_total vazia")
        if valor_col not in matriz_fluxos_total.columns:
            raise ValueError(f"coluna ausente em matriz_fluxos_total: {valor_col}")
        m = float(matriz_fluxos_total[valor_col].sum())
    else:
        m = float(matriz_fluxos_total)

    if pop_total is None or math.isnan(pop_total) or pop_total <= 0:
        return float("nan")
    return 100.0 * m / pop_total


FAIXAS_IDADE = ("05_14", "15_24", "25_39", "40_59", "60_mais")


def smi(
    matriz_fluxos_por_idade: dict[str, float] | pd.Series,
    pop_por_idade_padrao: dict[str, float] | pd.Series,
    faixas: tuple[str, ...] = FAIXAS_IDADE,
) -> float:
    """Standardized Migration Intensity (SMI): CMI padronizado por idade (padronização direta).

    Fórmula (padronização direta clássica de demografia, aplicada por Bell et al. 2002 ao CMI):

        SMI = 100 * Σ_a (m_a / P_a) * Pstd_a  /  Σ_a Pstd_a

    onde, para cada faixa etária `a` em `faixas`:
    - `m_a` = soma dos fluxos inter-unidades do nível cujos migrantes estão na faixa `a`
      (`matriz_fluxos_por_idade[a]`);
    - `P_a` = população da faixa `a` NA EDIÇÃO OBSERVADA (é preciso informar via
      `pop_por_idade_padrao` só a população-padrão; a população observada por faixa deve já
      estar embutida na taxa -- ver nota de uso abaixo);
    - `Pstd_a` = população-padrão de referência da faixa `a` (`pop_por_idade_padrao[a]`), a
      MESMA para todas as edições comparadas (permite comparar intensidade sem o efeito da
      estrutura etária mudar entre censos).

    Nota de uso: para simplificar a assinatura e deixar o chamador (F12.4) explícito sobre qual
    é a taxa específica por faixa, esta função espera que `matriz_fluxos_por_idade[a]` já seja a
    TAXA específica de migração da faixa (m_a / P_a), não o fluxo bruto -- é assim que o
    `build_series.py` deve montá-la, dividindo o fluxo por idade pela população por idade
    observada em cada edição antes de chamar `smi`. Rebatize-se localmente como
    `taxas_por_idade` ao chamar, se preferir mais clareza no call-site.

    Referência: Bell, M., Charles-Edwards, E., Ueffing, P., Stillwell, J., Kupiszewski, M. &
    Kupiszewska, D. (2015), "Internal Migration and Development: Comparing Migration Intensities
    Around the World", *Population and Development Review* 41(1):33-58 (padronização por idade do
    CMI, aplicando Bell et al. 2002).

    Domínio de validade: requer ao menos uma faixa em comum entre `matriz_fluxos_por_idade` e
    `pop_por_idade_padrao`, com `Σ Pstd_a > 0`.

    Dados insuficientes: se não houver nenhuma faixa em comum ou `Σ Pstd_a <= 0`, retorna
    `float('nan')`.
    """
    faixas_comuns = [
        a for a in faixas
        if a in matriz_fluxos_por_idade and a in pop_por_idade_padrao
    ]
    if not faixas_comuns:
        return float("nan")

    denom = sum(float(pop_por_idade_padrao[a]) for a in faixas_comuns)
    if denom <= 0:
        return float("nan")

    numer = sum(
        float(matriz_fluxos_por_idade[a]) * float(pop_por_idade_padrao[a])
        for a in faixas_comuns
    )
    return 100.0 * numer / denom


def mei_agregado(saldos_por_unidade: dict[str, float] | pd.Series, m_total: float) -> float:
    """Migration Effectiveness Index (MEI) agregado do sistema: MEI = 100 * 0.5 * Σ|N_i| / M.

    `N_i` é o saldo migratório de cada unidade (imigração - emigração), `M` é o total de
    migrantes do sistema -- soma de TODOS os fluxos inter-unidades (não conte duas vezes: `M` é
    a mesma soma usada em `cmi`, não `Σ(imig_i + emig_i)` dividido por unidade a unidade, pois
    isso já é exatamente `Σ M_ij` sobre toda a matriz O-D).

    Referência: Bell, M. et al. (2002), idem `cmi`; Rowe, F., Bell, M., Bernard, A., Charles-
    Edwards, E. & Ueffing, P. (2019), "Impact of Internal Migration on Population Redistribution:
    An International Comparison", *Comparative Population Studies* 44:63-94 (síntese de MEI/ANMR
    como par de medidas de eficácia migratória).

    Domínio de validade: `m_total > 0`; requer ao menos 1 unidade em `saldos_por_unidade`.

    Dados insuficientes: se `m_total <= 0` ou `saldos_por_unidade` estiver vazio, retorna
    `float('nan')`. Levanta `ValueError` se `saldos_por_unidade` for `None`.
    """
    if saldos_por_unidade is None:
        raise ValueError("saldos_por_unidade é None")
    if len(saldos_por_unidade) == 0:
        return float("nan")
    if m_total is None or math.isnan(m_total) or m_total <= 0:
        return float("nan")

    if isinstance(saldos_por_unidade, pd.Series):
        soma_abs = saldos_por_unidade.abs().sum()
    else:
        soma_abs = sum(abs(float(v)) for v in saldos_por_unidade.values())
    return 100.0 * 0.5 * soma_abs / m_total


def anmr(cmi_valor: float, mei_valor: float) -> float:
    """Aggregate Net Migration Rate (ANMR): ANMR = CMI * MEI / 100.

    Identidade a conferir em teste (F12.4-t): dado um sistema sintético com saldos N_i, CMI
    calculado por `cmi(...)` e MEI por `mei_agregado(...)`,

        anmr(cmi(...), mei_agregado(...)) == 100 * 0.5 * Σ|N_i| / P

    (a fórmula direta de ANMR, combinando as definições de CMI = 100*M/P e MEI = 100*0.5*Σ|N_i|/M
    -- o M se cancela). Ou seja: ANMR mede o efeito líquido da migração sobre a redistribuição
    populacional em taxa por 100 habitantes, decomposto em "quanta migração há" (CMI) vezes
    "quão eficaz ela é em redistribuir população" (MEI/100).

    Referência: Bell, M. et al. (2002) e Rowe et al. (2019), idem `cmi`/`mei_agregado`.

    Domínio de validade: nenhuma restrição adicional além das de `cmi_valor`/`mei_valor` -- se
    qualquer um for `NaN`, o produto propaga `NaN` (comportamento correto de propagação de dado
    ausente, não é erro).
    """
    if cmi_valor is None or mei_valor is None:
        return float("nan")
    return cmi_valor * mei_valor / 100.0


def _mqo_ponderado(x: np.ndarray, y: np.ndarray, w: np.ndarray) -> tuple[float, float, float, float]:
    """MQO ponderado manual (álgebra matricial) para y = a + b*x, pesos w.

    Retorna (a, b, erro_padrao_a, erro_padrao_b). Implementação manual porque `statsmodels` não
    está no `.venv` do projeto neste momento (só `duckdb`, `pandas`, `pyarrow`, `openpyxl`,
    `pillow`, `jinja2`, `pytest` em `requirements.txt`; `numpy` está disponível como dependência
    transitiva do `pandas`). Fórmulas padrão de WLS:

        X = [1, x] (n x 2), W = diag(w)
        beta_hat = (X'WX)^-1 X'Wy
        residuos = y - X @ beta_hat
        sigma2 = Σ w_i * residuo_i^2 / (n - 2)   (graus de liberdade: n - k, k=2 parâmetros)
        Var(beta_hat) = sigma2 * (X'WX)^-1
    """
    n = x.size
    xmat = np.column_stack([np.ones(n), x])
    wmat = np.diag(w)
    xtw = xmat.T @ wmat
    xtwx = xtw @ xmat
    xtwx_inv = np.linalg.inv(xtwx)
    beta = xtwx_inv @ xtw @ y
    residuos = y - xmat @ beta
    dof = n - 2
    if dof <= 0:
        sigma2 = float("nan")
    else:
        sigma2 = float((w * residuos ** 2).sum() / dof)
    cov_beta = sigma2 * xtwx_inv
    erro_a = math.sqrt(cov_beta[0, 0]) if not math.isnan(sigma2) else float("nan")
    erro_b = math.sqrt(cov_beta[1, 1]) if not math.isnan(sigma2) else float("nan")
    return float(beta[0]), float(beta[1]), erro_a, erro_b


def beta_fielding(
    nmr_por_unidade: dict[str, float] | pd.Series,
    densidade_por_unidade: dict[str, float] | pd.Series,
    pop_por_unidade: dict[str, float] | pd.Series,
) -> tuple[float, float]:
    """Beta de Fielding: regressão MQO ponderada por população de NMR_i = alpha + beta*log10(densidade_i).

    `NMR_i` é a taxa líquida de migração da unidade `i` (saldo/população, tipicamente por 1.000
    ou por 100 habitantes -- a unidade de `nmr_por_unidade` é a que sai em `beta`). `densidade_i`
    é a densidade demográfica da unidade (hab/km²). O peso da regressão é `pop_por_unidade[i]`
    (unidades mais populosas pesam mais na estimativa, seguindo a prática usual desse tipo de
    regressão agregada).

    Interpretação clássica (Fielding 1989): beta > 0 e significativo indica um sistema migratório
    em fase de "concentração" (unidades mais densas ganham migrantes, tipicamente
    metropolitanização); beta < 0 indica "deconcentração" (contra-urbanização, unidades menos
    densas ganhando migrantes líquidos).

    Referência: Fielding, A. (1989), "Inter-regional migration and social change: a study of
    South East England based upon data from the Longitudinal Study", *Geographical Journal*
    155(1):60-69 [nota: a formalização usada aqui, com log10(densidade) e ponderação
    populacional, segue Rowe, A., Bell, M., Bernard, A., Charles-Edwards, E. & Ueffing, P.
    (2019), "Impact of Internal Migration on Population Redistribution: An International
    Comparison", *Comparative Population Studies* 44:63-94].

    Implementação: MQO ponderado manual via álgebra matricial (ver `_mqo_ponderado`) -- o
    `.venv` do projeto não tem `statsmodels` instalado (confira `requirements.txt`); só
    `numpy` (dependência transitiva do `pandas`) está disponível e é suficiente.

    Domínio de validade: requer ao menos 3 unidades (2 parâmetros a estimar + 1 grau de liberdade
    para o erro-padrão) com densidade > 0 (log10 indefinido em 0) e população > 0.

    Dados insuficientes: se restarem menos de 3 unidades válidas após excluir densidade/população
    não positivas ou ausentes, retorna `(float('nan'), float('nan'))`.
    """
    if isinstance(nmr_por_unidade, dict):
        nmr_por_unidade = pd.Series(nmr_por_unidade)
    if isinstance(densidade_por_unidade, dict):
        densidade_por_unidade = pd.Series(densidade_por_unidade)
    if isinstance(pop_por_unidade, dict):
        pop_por_unidade = pd.Series(pop_por_unidade)

    df = pd.DataFrame({
        "nmr": nmr_por_unidade,
        "densidade": densidade_por_unidade,
        "pop": pop_por_unidade,
    }).dropna()
    df = df[(df["densidade"] > 0) & (df["pop"] > 0)]
    if df.shape[0] < 3:
        return (float("nan"), float("nan"))

    x = np.log10(df["densidade"].to_numpy(dtype=float))
    y = df["nmr"].to_numpy(dtype=float)
    w = df["pop"].to_numpy(dtype=float)
    _a, b, _erro_a, erro_b = _mqo_ponderado(x, y, w)
    return (b, erro_b)


def duncan_d(
    matriz_fluxos_t: pd.DataFrame,
    matriz_fluxos_t1: pd.DataFrame,
    origem_col: str = "origem",
    destino_col: str = "destino",
    valor_col: str = "total",
) -> float:
    """Índice de dissimilaridade de Duncan & Duncan entre a estrutura de fluxos O-D de duas edições.

    Fórmula: D = 0.5 * Σ_ij |M_ij^t / M^t - M_ij^{t+1} / M^{t+1}|, onde `M^t` = Σ_ij M_ij^t é o
    total de fluxo da matriz da edição `t` (idem para `t+1`). D varia de 0 (estruturas
    proporcionalmente idênticas) a 1 (nenhum par em comum, dissimilaridade total).

    Tratamento de pares ausentes: as duas matrizes O-D podem ter conjuntos de pares (origem,
    destino) diferentes -- uma edição pode ter um par que a outra não tem, por supressão de
    revelação (n pequeno) ou por mudança de território (município que não existia, RGI/RGInt
    recodificada). Aqui a convenção é: um par ausente numa das duas matrizes entra como 0 NESSA
    matriz especificamente para este cálculo -- ou seja, faz-se um outer join dos pares e
    preenche-se com 0 onde faltar. Essa convenção é adequada porque o Duncan D aqui mede
    dissimilaridade ESTRUTURAL entre as duas fotografias (qual fração do sistema teria que se
    realocar para uma bater com a outra); tratar ausência estrutural (ex.: excluir municípios
    sem correspondência territorial) é responsabilidade de uma etapa anterior do pipeline
    (F12.4), não deste cálculo.

    Referência: Duncan, O.D. & Duncan, B. (1955), "A Methodological Analysis of Segregation
    Indexes", *American Sociological Review* 20(2):210-217 (índice de dissimilaridade original,
    aplicado aqui à distribuição de fluxos O-D entre duas edições em vez de dois grupos
    populacionais numa mesma área).

    Domínio de validade: requer `Σ M_ij^t > 0` e `Σ M_ij^{t+1} > 0`.

    Dados insuficientes: se qualquer uma das duas matrizes tiver soma total `<= 0` (ou for
    vazia), retorna `float('nan')`. Levanta `ValueError` se `matriz_fluxos_t`/`matriz_fluxos_t1`
    forem `None` ou faltar alguma coluna esperada.
    """
    for nome, m in (("matriz_fluxos_t", matriz_fluxos_t), ("matriz_fluxos_t1", matriz_fluxos_t1)):
        if m is None:
            raise ValueError(f"{nome} é None")
        for col in (origem_col, destino_col, valor_col):
            if col not in m.columns:
                raise ValueError(f"coluna ausente em {nome}: {col}")

    if matriz_fluxos_t.empty or matriz_fluxos_t1.empty:
        return float("nan")

    total_t = matriz_fluxos_t[valor_col].sum()
    total_t1 = matriz_fluxos_t1[valor_col].sum()
    if total_t <= 0 or total_t1 <= 0:
        return float("nan")

    a = matriz_fluxos_t.groupby([origem_col, destino_col])[valor_col].sum()
    b = matriz_fluxos_t1.groupby([origem_col, destino_col])[valor_col].sum()
    combinado = pd.concat([a.rename("t"), b.rename("t1")], axis=1).fillna(0.0)

    prop_t = combinado["t"] / total_t
    prop_t1 = combinado["t1"] / total_t1
    return float(0.5 * (prop_t - prop_t1).abs().sum())


def decomposicao_loglinear(
    matriz_fluxos: pd.DataFrame,
    origem_col: str = "origem",
    destino_col: str = "destino",
    valor_col: str = "total",
    max_iter: int = 50,
    tol: float = 1e-6,
    epsilon: float = 1e-9,
) -> dict[str, Any]:
    """Decomposição multiplicativa log-linear da matriz de fluxos por IPF (Deming-Stephan).

    Ajusta n_ij ~ T * O_i * D_j * OD_ij por Iterative Proportional Fitting (algoritmo de Deming &
    Stephan 1940, formalizado para migração por Willekens 1983): itera reescalando as margens de
    linha (O_i) e coluna (D_j) até a matriz ajustada bater com as margens observadas (Σ_j n_ij e
    Σ_i n_ij), dentro de `tol`. Ao final:

        T      = média geométrica de n_ij (constante multiplicativa de escala do sistema);
        O_i    = efeito principal de origem (propensão a emigrar de i, relativo a T);
        D_j    = efeito principal de destino (atratividade de j, relativo a T);
        OD_ij  = n_ij / (T * O_i * D_j)  (interação origem-destino residual: o quanto o par i-j
                 foge do esperado só pelos efeitos principais de origem e destino -- é aqui que
                 aparece o efeito de distância/contiguidade/laços históricos entre i e j).

    Estabilidade numérica: células com `n_ij == 0` (comuns em matrizes O-D esparsas, sobretudo em
    nível municipal) são mantidas como 0 durante o IPF (0 é ponto fixo do ajuste proporcional:
    0 * qualquer fator = 0) mas excluídas do cálculo de `OD_ij` -- para essas células, `OD_ij` é
    reportado como `0.0` em vez de `epsilon`/`0/0` indeterminado, já que `n_ij = 0` implica
    ausência observada de interação, não um valor pequeno mas positivo. Um `epsilon` pequeno é
    usado apenas para evitar divisão por zero nas margens (O_i ou D_j nulos, unidade sem nenhum
    fluxo de saída ou entrada).

    Referência: Willekens, F. (1983), "Log-linear modelling of spatial interaction", *Papers in
    Regional Science* 52(1):187-205 (decomposição T x O x D x OD aplicada a matrizes de migração);
    algoritmo IPF de Deming, W.E. & Stephan, F.F. (1940), "On a Least Squares Adjustment of a
    Sampled Frequency Table When the Expected Marginal Totals are Known", *Annals of Mathematical
    Statistics* 11(4):427-444.

    Retorna um dict com:
    - `T` (float): escala global (média geométrica de n_ij > 0);
    - `O` (dict[str, float]): efeito de origem por unidade;
    - `D` (dict[str, float]): efeito de destino por unidade;
    - `OD` (dict[tuple[str, str], float]): efeito de interação por par (origem, destino);
    - `iteracoes` (int): número de iterações do IPF até convergência (ou `max_iter` se não
      convergiu -- ver `convergiu`);
    - `convergiu` (bool).

    Domínio de validade: requer ao menos 2 unidades de origem e 2 de destino com fluxo positivo
    (uma matriz 1x1 ou totalmente nula não tem estrutura de interação a decompor).

    Dados insuficientes: se a matriz não tiver ao menos 2x2 unidades com algum fluxo positivo,
    retorna um dict com todos os campos `None` (`T`, `O`, `D`, `OD` = `None`, `convergiu` =
    `False`, `iteracoes` = 0) -- não lança exceção, para não quebrar uma série que itera por
    edição/nível. Levanta `ValueError` se `matriz_fluxos` for `None`/vazia ou faltar coluna.
    """
    if matriz_fluxos is None:
        raise ValueError("matriz_fluxos é None")
    for col in (origem_col, destino_col, valor_col):
        if col not in matriz_fluxos.columns:
            raise ValueError(f"coluna ausente em matriz_fluxos: {col}")
    if matriz_fluxos.empty:
        raise ValueError("matriz_fluxos vazia")

    pivot = matriz_fluxos.pivot_table(
        index=origem_col, columns=destino_col, values=valor_col, aggfunc="sum", fill_value=0.0,
    )
    origens = list(pivot.index)
    destinos = list(pivot.columns)
    n = pivot.to_numpy(dtype=float)

    if len(origens) < 2 or len(destinos) < 2 or n.sum() <= 0:
        return {"T": None, "O": None, "D": None, "OD": None, "convergiu": False, "iteracoes": 0}

    margem_linha_obs = n.sum(axis=1)
    margem_coluna_obs = n.sum(axis=0)

    # início: fatores neutros de linha/coluna, ajustados iterativamente às margens observadas.
    fator_linha = np.ones(len(origens))
    fator_coluna = np.ones(len(destinos))

    convergiu = False
    iteracao = 0
    for iteracao in range(1, max_iter + 1):
        ajustada = n * fator_linha[:, None] * fator_coluna[None, :]

        margem_linha_aj = ajustada.sum(axis=1)
        fator_linha = fator_linha * np.divide(
            margem_linha_obs, margem_linha_aj,
            out=np.ones_like(margem_linha_obs), where=margem_linha_aj > epsilon,
        )

        ajustada = n * fator_linha[:, None] * fator_coluna[None, :]
        margem_coluna_aj = ajustada.sum(axis=0)
        fator_coluna = fator_coluna * np.divide(
            margem_coluna_obs, margem_coluna_aj,
            out=np.ones_like(margem_coluna_obs), where=margem_coluna_aj > epsilon,
        )

        ajustada = n * fator_linha[:, None] * fator_coluna[None, :]
        erro_linha = np.abs(ajustada.sum(axis=1) - margem_linha_obs).max()
        erro_coluna = np.abs(ajustada.sum(axis=0) - margem_coluna_obs).max()
        if max(erro_linha, erro_coluna) < tol:
            convergiu = True
            break

    ajustada = n * fator_linha[:, None] * fator_coluna[None, :]

    # T = média geométrica das células com fluxo observado positivo (0 fica fora, ver docstring).
    positivas = ajustada[n > 0]
    if positivas.size == 0:
        return {"T": None, "O": None, "D": None, "OD": None, "convergiu": False, "iteracoes": iteracao}
    t_escala = float(np.exp(np.mean(np.log(positivas))))

    o_efeito = fator_linha * t_escala if t_escala != 0 else fator_linha
    # normaliza para que O_i e D_j fiquem em torno de 1 relativos a T: O_i tal que T*O_i*D_j
    # reproduza a margem ajustada -- expressamos O_i e D_j como os fatores multiplicativos do
    # IPF, e T como a escala global.
    o_dict = {origens[i]: float(fator_linha[i]) for i in range(len(origens))}
    d_dict = {destinos[j]: float(fator_coluna[j]) for j in range(len(destinos))}

    od_dict: dict[tuple[str, str], float] = {}
    for i, o in enumerate(origens):
        for j, d in enumerate(destinos):
            if n[i, j] > 0 and t_escala > 0 and fator_linha[i] > 0 and fator_coluna[j] > 0:
                od_dict[(o, d)] = float(n[i, j] / (t_escala * fator_linha[i] * fator_coluna[j]))
            else:
                od_dict[(o, d)] = 0.0

    return {
        "T": t_escala,
        "O": o_dict,
        "D": d_dict,
        "OD": od_dict,
        "convergiu": convergiu,
        "iteracoes": iteracao,
    }
