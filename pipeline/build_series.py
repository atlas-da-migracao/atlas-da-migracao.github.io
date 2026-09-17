"""Gera `data/processed/series/` -- a série comparativa entre as cinco edições do atlas (F12.4).

Lê **apenas** `data/processed[/<edicao>]/*.parquet` (agregados já aprovados pelo gate de cada
edição), `pipeline/genealogia_municipios.csv` (F12.1), `pipeline/area_km2.parquet` (F12.1) e
`pipeline/rm_nucleo.csv`. NUNCA toca `data/raw*`/`data/interim*` -- não há microdado neste
script, só recombinação de dado já público/aprovado. Ver CLAUDE.md, regras de sigilo, e
`~/.claude/plans/vamos-retomar-o-plano-expressive-lobster.md`, decisão arquitetural 2.

Sem `--edicao`: roda uma vez, para as cinco edições de uma vez, e escreve:

    data/processed/series/unidades_serie.parquet
    data/processed/series/pares_serie.parquet
    data/processed/series/perfil_serie.parquet
    data/processed/series/sistema_serie.parquet
    data/processed/series/loglinear_serie.parquet
    data/processed/series/comparabilidade.json
    data/processed/series/.gate_ok

Uso: `python pipeline/build_series.py`

--------------------------------------------------------------------------------------------
Decisões de escopo tomadas nesta implementação (documentadas aqui porque não há outro lugar
óbvio para o leitor de `build_series.py` encontrá-las juntas; a metodologia de fundo, os
limiares e a harmonização de vocabulário continuam em `pipeline/comparabilidade_regras.py`):

1. **Unidade agregada `NORTEGO` (1980)**. Não é um `cd_mun` de 2022, então não entra no loop
   dos 5.570 códigos de `unidades_serie` nível `mun`. Ganha, em vez disso, UMA linha extra
   `(nivel='mun', codigo='NORTEGO', edicao='1980')` com as medidas calculadas a partir da linha
   `NORTEGO` de `data/processed/1980/municipios.parquet` -- é a única forma de não perder a
   informação que essa unidade carrega (pop, imig, emig...). As colunas de cobertura
   (`existia`, `n_mun_edicao`, `n_mun_2022`, `cobertura_*`, `estado_cobertura`) não se aplicam a
   ela (ficam `NULL`): cobertura mede a fração de um código de 2022 coberta, e `NORTEGO` não é
   um código de 2022. Os 139 municípios de 2022 do atual Tocantins that mapeiam para ela via
   `cd_mun_mae='NORTEGO'` continuam recebendo sua própria linha em cada edição, com
   `existia=False` em 1980 e `cd_mun_mae='NORTEGO'` -- a interface os liga à série de
   `NORTEGO`, nunca soma as duas.

2. **Cobertura territorial (`cobertura_pop`) credita o município-mãe, dentro do mesmo nível.**
   Um município de 2022 que não existia numa edição, mas cujo município-mãe (a) existe nessa
   edição e (b) pertence à MESMA unidade de 2022 num dado nível (mesma RGI/RGInt/UF/RM), tem seu
   território considerado coberto NAQUELE NÍVEL -- o território dele estava lá, só que agregado
   ao do mãe. Se o mãe pertence a uma unidade de 2022 diferente naquele nível (ex.: desmembra-
   mento que atravessou fronteira de RGI), não é creditado. `NORTEGO` credita o território dos
   139 municípios do atual Tocantins apenas no nível UF (ela tem UF preenchida e RGI/RGInt/RM
   nulos -- ver `pipeline/sql/1980/MAPEAMENTO_norte_goias.md`). `cobertura_cod` NUNCA credita o
   mãe: mede só observação individual.

3. **Medidas do Bloco 2 (`sistema_serie`) e a decomposição log-linear não são calculadas para
   `nivel='rm'`.** As 81 regiões metropolitanas não particionam o país (município fora de RM
   nenhuma não está em nenhuma linha) e o atlas não publica uma matriz RM×RM de fluxos entre
   regiões metropolitanas (só `rm_fluxos_intra`, que é INTRA uma RM, não ENTRE RMs) -- não há
   "sistema de RMs" no sentido de Bell et al. (2002)/Willekens (1983) para decompor. `sistema_
   serie`/`loglinear_serie` cobrem `mun`, `rgi`, `rgint`, `uf`, onde `fluxos*.parquet` já é a
   matriz O-D completa do nível.

4. **SMI (intensidade padronizada por idade) só é calculada em `nivel='mun'`.** A padronização
   por idade depende de `municipios_dim` (perfil migrante/residente por faixa etária), que só é
   publicado no nível municipal -- não há `rgi_dim`/`rgint_dim`/`uf_dim`. Agregar `municipios_dim`
   por soma para os demais níveis teria o mesmo viés de célula suprimida documentado no item 6
   abaixo, então a SMI dos níveis agregados fica `NULL` em vez de uma soma ingênua.

5. **Distância média/mediana ponderada (`distancia_media`/`distancia_mediana`) é calculada em
   `mun`, `rgi`, `rgint`, `uf`.** Não em `rm`: não existe `geo/centroides_rm.parquet` nem uma
   matriz de fluxos "RM contra o resto do país" publicada -- só o intra-RM. Calcular a distância
   de uma RM a partir dos fluxos dos municípios que a compõem exigiria decompor `fluxos.parquet`
   (nível município) por RM de origem/destino, o que reintroduziria supressão célula a célula
   sem o mesmo tratamento dos demais níveis; fica de fora, documentado, não aproximado.

6. **`perfil_serie` nos níveis agregados é uma SOMA de `municipios_dim` dos municípios PRESENTES
   na edição**, não um recálculo a partir de microdado (que não é lido aqui). Células com
   supressão (R1-R3) municipal não são estritamente somáveis sem viés -- um valor agregado pode
   subestimar sistematicamente uma categoria pequena, presente em muitos municípios mas suprimida
   em cada um deles individualmente. `perfil_serie` marca essas linhas agregadas com
   `comparavel_com_ressalva=True` (coluna própria, além do que `comparabilidade.json` já
   declara por medida/edição/nível) -- ver função `_perfil_agregado`.

7. **`pares_serie`**: o conjunto de pares "que merece uma linha em toda edição" é a união dos
   top-20 pares (por volume) de CADA UNIDADE, em CADA edição, para cada nível e tipo de fluxo
   (critério simples e documentado, item 7 do plano). Unidades cujo total de fluxo é zero (sem
   nenhum par publicado) não contribuem pares. `motivo_ausencia` é computado comparando a
   genealogia (município não existia) contra as capacidades da edição (`Capacidades.estudo`,
   `Capacidades.pendular`) e, por eliminação, `suprimido`.

8. **Erro amostral agregado**. Quando este script soma `imig`/`emig` de municípios para formar
   um nível agregado, o erro-padrão correspondente é combinado como `sqrt(sum(se_i^2))`
   (municípios tratados como independentes -- aproximação padrão de agregação de estimadores de
   variância quando não se tem a covariância entre eles, que não é publicada). É uma aproximação
   conservadora documentada aqui, não um recálculo do desenho amostral.

9. **`.gate_ok` desta pasta**: grava no MESMO formato de `disclosure_check.py` (campos
   `formato_versao`, `versao_dados`, `timestamp`, `arquivos`), para que `verify_gate.py`
   continue funcionando sem alteração quando apontado para `data/processed` (que trata
   `series/` como um subgate e pula o conteúdo, exatamente como já faz com `2010/`, `2000/`,
   `1991/`, `1980/`). Uma ressalva genuína: as checagens estruturais (c2-c4) de
   `verify_gate.py --dir data/processed/series` foram escritas para colunas de MICRODADO
   agregado (R1-R6) e algumas colunas aqui são contagens ESTRUTURAIS de município (`n_mun_edicao`,
   `n_mun_2022`), análogas a `n_municipios` de `rm_resumo.parquet` -- que já está listada em
   `verify_gate.COLUNAS_N_ESTRUTURAIS`. As novas não estão. Isso é esperado e não uma falha
   desta fase (a instrução da F12.4 foi explicitamente não alterar `verify_gate.py`); registrado
   aqui para quem for rodar `verify_gate.py --dir data/processed/series` isoladamente: ele vai
   reportar falsos positivos em (c3) até que `COLUNAS_N_ESTRUTURAIS` seja ampliado numa fase
   futura. Rodando `verify_gate.py --dir data/processed` (o padrão, sem `--dir`), o problema não
   aparece, porque a pasta é pulada inteira como subgate.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import math
import pathlib
import sys

import duckdb
import numpy as np
import pandas as pd

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "pipeline"))

import comparabilidade_regras as C  # noqa: E402
import medidas as MED  # noqa: E402
from edicoes import EDICOES as EDICOES_CFG, edicao as get_edicao  # noqa: E402

SERIES_DIR = ROOT / "data/processed/series"
GENEALOGIA_CSV = ROOT / "pipeline/genealogia_municipios.csv"
AREA_KM2_PARQUET = ROOT / "pipeline/area_km2.parquet"
RM_NUCLEO_CSV = ROOT / "pipeline/rm_nucleo.csv"

EDICOES: tuple[str, ...] = C.EDICOES  # ("2022", "2010", "2000", "1991", "1980")
EDICOES_ANTIGAS: tuple[str, ...] = tuple(e for e in EDICOES if e != "2022")
NIVEIS: tuple[str, ...] = C.NIVEIS  # ("mun", "rgi", "rgint", "uf", "rm")
NIVEIS_AGREGADOS: tuple[str, ...] = C.NIVEIS_AGREGADOS  # ("rgi", "rgint", "uf", "rm")
NIVEIS_PARTICAO: tuple[str, ...] = ("mun", "rgi", "rgint", "uf")  # nível que particiona o país

# Nome da coluna de código de nível-2022 dentro de municipios.parquet
COD_COL = {"rgi": "cd_rgi", "rgint": "cd_rgint", "uf": "uf", "rm": "cd_rm"}
NOME_COL = {"rgi": "nm_rgi", "rgint": "nm_rgint", "uf": "uf_sigla", "rm": "nm_rm"}

TOP_N_PARES = 20

con = duckdb.connect()
con.execute("PRAGMA threads=4;")


# ==============================================================================================
# Utilidades de leitura (só data/processed[/<edicao>]/, pipeline/*.csv|*.parquet)
# ==============================================================================================


def _p(edicao: str, nome: str) -> str:
    """Caminho POSIX de um parquet de `data/processed[/<edicao>]/<nome>`."""
    return (ROOT / get_edicao(edicao).processed / nome).as_posix()


def _existe(edicao: str, nome: str) -> bool:
    return (ROOT / get_edicao(edicao).processed / nome).exists()


def _ler(edicao: str, nome: str) -> pd.DataFrame:
    return con.execute(f"SELECT * FROM read_parquet('{_p(edicao, nome)}')").fetchdf()


def _gini(valores: np.ndarray) -> float:
    """Reimplementação vetorizável de `medidas._gini` (mesma fórmula, ver docstring lá).

    Reproduzida aqui (em vez de importar o símbolo privado) só para deixar claro, no
    `build_series.py`, que a fórmula usada é a mesma de `medidas.gini_linha`/`gini_coluna` --
    usada em lote via `groupby(...).apply(_gini)` por desempenho (uma chamada por unidade via
    `medidas.gini_linha` filtraria a tabela inteira de fluxos a cada unidade).
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


def _mediana_ponderada(valores: np.ndarray, pesos: np.ndarray) -> float:
    """Idêntica a `medidas._mediana_ponderada` -- reproduzida para uso vetorizado em lote."""
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


def nan_to_none(v):
    if v is None:
        return None
    if isinstance(v, (float, np.floating)) and math.isnan(v):
        return None
    if isinstance(v, (np.generic,)):
        return v.item()
    return v


# ==============================================================================================
# 0. Genealogia, área, núcleo de RM, malha de 2022
# ==============================================================================================


def carregar_genealogia() -> pd.DataFrame:
    df = pd.read_csv(GENEALOGIA_CSV, dtype=str)
    # o CSV grava booleanos em minúsculas ("true"/"false", ver build_genealogia.py) -- mapear
    # sem diferenciar caixa evita um NaN silencioso que derrubaria toda a cobertura calculada.
    df["existia"] = df["existia"].str.lower().map({"true": True, "false": False})
    return df


def carregar_2022() -> pd.DataFrame:
    """municipios.parquet de 2022: a malha e as unidades de 2022 que ancoram toda a série."""
    df = _ler("2022", "municipios.parquet")
    return df[["cd_mun", "nm_mun", "uf", "uf_sigla", "cd_rgi", "nm_rgi", "cd_rgint",
               "nm_rgint", "cd_rm", "nm_rm", "pop"]].copy()


def carregar_area() -> pd.DataFrame:
    return pd.read_parquet(AREA_KM2_PARQUET)


def carregar_rm_nucleo() -> pd.DataFrame:
    return pd.read_csv(RM_NUCLEO_CSV, dtype=str)


# ==============================================================================================
# 1. unidades_serie.parquet
# ==============================================================================================


def _cobertura_mun(genealogia: pd.DataFrame, base2022: pd.DataFrame) -> pd.DataFrame:
    """Uma linha por (cd_mun_2022, edicao) com existia + a membresia de 2022 (para os níveis
    agregados creditarem o município-mãe -- ver decisão de escopo 2 no cabeçalho)."""
    membresia = base2022[["cd_mun", "uf", "cd_rgi", "cd_rgint", "cd_rm", "pop"]].rename(
        columns={"cd_mun": "cd_mun_2022"}
    )
    linhas = []
    for e in EDICOES_ANTIGAS:
        g = genealogia[genealogia["edicao"] == e][
            ["cd_mun_2022", "existia", "cd_mun_mae", "nm_mun_mae", "metodo"]
        ].copy()
        g["edicao"] = e
        linhas.append(g)
    # 2022: todo mundo existia, sem mãe.
    todos2022 = base2022[["cd_mun"]].rename(columns={"cd_mun": "cd_mun_2022"}).copy()
    todos2022["existia"] = True
    todos2022["cd_mun_mae"] = None
    todos2022["nm_mun_mae"] = None
    todos2022["metodo"] = "existia"
    todos2022["edicao"] = "2022"
    linhas.append(todos2022)
    cobertura = pd.concat(linhas, ignore_index=True)
    cobertura = cobertura.merge(membresia, on="cd_mun_2022", how="left")

    # membresia do município-mãe (quando é um código real, não NORTEGO)
    mae = membresia.rename(columns={
        "cd_mun_2022": "cd_mun_mae", "uf": "uf_mae", "cd_rgi": "cd_rgi_mae",
        "cd_rgint": "cd_rgint_mae", "cd_rm": "cd_rm_mae", "pop": "pop_mae",
    })
    cobertura = cobertura.merge(mae, on="cd_mun_mae", how="left")

    for nivel, col, mae_col in (
        ("rgi", "cd_rgi", "cd_rgi_mae"), ("rgint", "cd_rgint", "cd_rgint_mae"),
        ("uf", "uf", "uf_mae"), ("rm", "cd_rm", "cd_rm_mae"),
    ):
        cobertura[f"coberto_{nivel}"] = cobertura.apply(
            lambda r, col=col, mae_col=mae_col: (
                True if r["existia"]
                else (col == "uf" and r["cd_mun_mae"] == "NORTEGO" and r["uf"] == "17")
                if r["cd_mun_mae"] == "NORTEGO"
                else (False if pd.isna(r.get(mae_col)) else r[col] == r[mae_col])
            ),
            axis=1,
        )
    return cobertura


def _agregar_cobertura(cobertura: pd.DataFrame, nivel: str) -> pd.DataFrame:
    """Cobertura por (nivel, codigo, edicao), agregando `_cobertura_mun` pela unidade de 2022."""
    col_cod = COD_COL[nivel]
    coberto_col = f"coberto_{nivel}"
    base = cobertura.dropna(subset=[col_cod]).copy()
    base["_existia_bool"] = base["existia"].fillna(False).astype(bool)
    base["_coberto_bool"] = base[coberto_col].fillna(False).astype(bool)
    base["pop_existia"] = base["pop"].where(base["_existia_bool"], 0.0)
    base["pop_coberta"] = base["pop"].where(base["_coberto_bool"], 0.0)

    agg = base.groupby([col_cod, "edicao"]).agg(
        n_mun_2022=("cd_mun_2022", "count"),
        n_mun_edicao=("_existia_bool", "sum"),
        pop_total=("pop", "sum"),
        pop_existia=("pop_existia", "sum"),
        pop_coberta=("pop_coberta", "sum"),
    ).reset_index().rename(columns={col_cod: "codigo"})
    agg["cobertura_cod"] = agg["pop_existia"] / agg["pop_total"].where(agg["pop_total"] > 0)
    agg["cobertura_pop"] = agg["pop_coberta"] / agg["pop_total"].where(agg["pop_total"] > 0)
    agg["nivel"] = nivel
    return agg[["nivel", "codigo", "edicao", "n_mun_edicao", "n_mun_2022",
                "cobertura_cod", "cobertura_pop"]]


def _rm_extras(cobertura_rm: pd.DataFrame, rm_nucleo: pd.DataFrame) -> pd.DataFrame:
    """`rm_unitaria` e `nucleo_divergente`, só para nivel='rm'."""
    out = cobertura_rm.copy()
    out["rm_unitaria"] = out["n_mun_edicao"] == 1

    nucleo_map = dict(zip(rm_nucleo["cd_rm"], rm_nucleo["cd_nucleo"]))
    divergente = []
    for edicao, cd_rm in zip(out["edicao"], out["codigo"]):
        if not _existe(edicao, "rm.parquet"):
            divergente.append(False)
            continue
        rm_df = _RM_CACHE.setdefault(edicao, _ler(edicao, "rm.parquet"))
        linha = rm_df[(rm_df["cd_rm"] == cd_rm) & (rm_df["nucleo"])]
        if linha.empty:
            divergente.append(False)
            continue
        cd_atual = linha.iloc[0]["cd_mun"]
        cd_esperado = nucleo_map.get(cd_rm)
        divergente.append(cd_esperado is not None and cd_atual != cd_esperado)
    out["nucleo_divergente"] = divergente
    return out


_RM_CACHE: dict[str, pd.DataFrame] = {}


def _medidas_nivel_mun(edicao: str) -> pd.DataFrame:
    """Bloco 1 (+ pendular) por município, calculado direto de municipios.parquet + fluxos.parquet
    dessa edição -- todo cd_mun aqui é código de 2022 (municipios.parquet já é o recorte
    retroativo)."""
    mun = _ler(edicao, "municipios.parquet")
    fluxos = _ler(edicao, "fluxos.parquet")

    mun = mun.rename(columns={"cd_mun": "codigo"})
    # equivalente vetorizado de medidas.turnover (D + O) -- ver docstring de turnover().
    mun["turnover"] = mun["imig"] + mun["emig"]
    mun["taxa_rotatividade"] = np.where(
        mun["pop5"] > 0, 1000.0 * mun["turnover"] / mun["pop5"], np.nan
    )

    dist = _distancia_por_unidade_batch(fluxos, _ler_centroides(edicao, "mun"), id_col="cd_mun")
    conect = _conectividade_batch(fluxos)
    gini = _gini_batch(fluxos)
    pct_uf = _pct_interestadual_batch(fluxos, mun.set_index("codigo")["uf"])

    out = mun[["codigo", "pop", "pop5", "imig", "emig", "saldo", "tbi", "tbe", "tlm", "iem",
               "se_imig", "se_emig", "turnover", "taxa_rotatividade"]].copy()
    out = out.merge(dist, left_on="codigo", right_index=True, how="left")
    out = out.merge(conect.rename("n_parceiros"), left_on="codigo", right_index=True, how="left")
    out = out.merge(gini, left_on="codigo", right_index=True, how="left")
    out = out.merge(pct_uf.rename("pct_interestadual"), left_on="codigo", right_index=True, how="left")

    if get_edicao(edicao).pendular and _existe(edicao, "municipios_pendular.parquet"):
        pend = _ler(edicao, "municipios_pendular.parquet").rename(columns={"cd_mun": "codigo"})
        cols = ["codigo", "saida_trab", "entrada_trab", "saldo_pendular", "saida_estudo",
                "entrada_estudo", "taxa_saida_pendular", "indice_atracao",
                "tempo_mediano", "pct_coletivo"]
        if "pct_retorno_diario" in pend.columns:
            cols.append("pct_retorno_diario")
        out = out.merge(pend[[c for c in cols if c in pend.columns]], on="codigo", how="left")

    out["se_iem"] = [
        C.se_iem(i, e_, si, se_) for i, e_, si, se_ in
        zip(out["imig"], out["emig"], out["se_imig"], out["se_emig"])
    ]
    out["tipo_iem"] = [
        (C.classificar_iem(v, s).value if C.classificar_iem(v, s) is not None else None)
        for v, s in zip(out["iem"], out["se_iem"])
    ]
    out["nivel"] = "mun"
    out["edicao"] = edicao
    return out


def _ler_centroides(edicao: str, nivel: str) -> pd.DataFrame:
    nome = {"mun": "centroides.parquet", "rgi": "centroides_rgi.parquet",
            "rgint": "centroides_rgint.parquet", "uf": "centroides_uf.parquet"}[nivel]
    df = _ler(edicao, f"geo/{nome}")
    if "cd" in df.columns:
        df = df.rename(columns={"cd": "cd_mun"})
    return df


def _distancia_por_unidade_batch(fluxos: pd.DataFrame, centroides: pd.DataFrame,
                                  id_col: str = "cd_mun") -> pd.DataFrame:
    """MMD/MedMD por unidade, para TODAS as unidades de uma vez (ver `medidas.distancia_media_
    ponderada` -- mesma fórmula, em lote). Retorna DataFrame indexado por `codigo` com colunas
    `distancia_media`, `distancia_mediana`."""
    if fluxos.empty or centroides.empty:
        return pd.DataFrame(columns=["distancia_media", "distancia_mediana"])
    cent = centroides.set_index(id_col)[["x_albers", "y_albers"]]
    df = fluxos[fluxos["total"] > 0].merge(
        cent.rename(columns={"x_albers": "_xo", "y_albers": "_yo"}),
        left_on="origem", right_index=True, how="inner",
    ).merge(
        cent.rename(columns={"x_albers": "_xd", "y_albers": "_yd"}),
        left_on="destino", right_index=True, how="inner",
    )
    if df.empty:
        return pd.DataFrame(columns=["distancia_media", "distancia_mediana"])
    df["_dist"] = np.hypot(df["_xd"] - df["_xo"], df["_yd"] - df["_yo"])
    # cada par contribui para a distribuição de distância de origem E de destino (ver docstring
    # de medidas.distancia_media_ponderada: fluxos DE e PARA a unidade, ambos contam).
    longo = pd.concat([
        df[["origem", "_dist", "total"]].rename(columns={"origem": "codigo"}),
        df[["destino", "_dist", "total"]].rename(columns={"destino": "codigo"}),
    ], ignore_index=True)

    def _agg(g: pd.DataFrame) -> pd.Series:
        v = g["_dist"].to_numpy()
        p = g["total"].to_numpy(dtype=float)
        tot = p.sum()
        mmd = float((v * p).sum() / tot) if tot > 0 else float("nan")
        medmd = _mediana_ponderada(v, p)
        return pd.Series({"distancia_media": mmd, "distancia_mediana": medmd})

    return longo.groupby("codigo").apply(_agg, include_groups=False)


def _conectividade_batch(fluxos: pd.DataFrame) -> pd.Series:
    if fluxos.empty:
        return pd.Series(dtype=float)
    df = fluxos[fluxos["total"] > 0]
    return (df.groupby("origem").size().add(df.groupby("destino").size(), fill_value=0))


def _gini_batch(fluxos: pd.DataFrame) -> pd.DataFrame:
    if fluxos.empty:
        return pd.DataFrame(columns=["gini_linha", "gini_coluna"])
    df = fluxos[fluxos["total"] > 0]
    gl = df.groupby("origem")["total"].apply(lambda s: _gini(s.to_numpy())).rename("gini_linha")
    gc = df.groupby("destino")["total"].apply(lambda s: _gini(s.to_numpy())).rename("gini_coluna")
    return pd.concat([gl, gc], axis=1)


def _pct_interestadual_batch(fluxos: pd.DataFrame, uf_por_codigo: pd.Series) -> pd.Series:
    """% da migração interestadual por unidade -- para nivel='uf' quem chama passa
    `uf_por_codigo` como a identidade (a própria UF), então basta origem != destino."""
    if fluxos.empty:
        return pd.Series(dtype=float)
    df = fluxos[fluxos["total"] > 0].copy()
    df["_uf_o"] = df["origem"].map(uf_por_codigo)
    df["_uf_d"] = df["destino"].map(uf_por_codigo)
    df["_inter"] = (df["_uf_o"] != df["_uf_d"]).astype(float) * df["total"]
    longo = pd.concat([
        df[["origem", "total", "_inter"]].rename(columns={"origem": "codigo"}),
        df[["destino", "total", "_inter"]].rename(columns={"destino": "codigo"}),
    ], ignore_index=True)
    g = longo.groupby("codigo").agg(tot=("total", "sum"), inter=("_inter", "sum"))
    return (g["inter"] / g["tot"].where(g["tot"] > 0))


def _medidas_nivel_agregado(edicao: str, nivel: str) -> pd.DataFrame:
    """Bloco 1 (+ RM) por unidade agregada (rgi/rgint/uf/rm), somando os municípios PRESENTES
    na edição (municipios.parquet já é só os presentes) e usando fluxos_<nivel>.parquet /
    centroides_<nivel>.parquet já publicados nesse nível (rgi/rgint/uf) -- ou rm.parquet +
    fluxos municipais restritos à RM (rm)."""
    mun = _ler(edicao, "municipios.parquet")
    col = COD_COL[nivel]

    if nivel in ("rgi", "rgint", "uf"):
        grp = mun.dropna(subset=[col]).groupby(col).agg(
            pop=("pop", "sum"), pop5=("pop5", "sum"), imig=("imig", "sum"),
            emig=("emig", "sum"), saldo=("saldo", "sum"),
            se_imig=("se_imig", lambda s: float(np.sqrt((s.fillna(0) ** 2).sum()))),
            se_emig=("se_emig", lambda s: float(np.sqrt((s.fillna(0) ** 2).sum()))),
        ).reset_index().rename(columns={col: "codigo"})
        grp["tbi"] = np.where(grp["pop5"] > 0, 1000.0 * grp["imig"] / grp["pop5"], np.nan)
        grp["tbe"] = np.where(grp["pop5"] > 0, 1000.0 * grp["emig"] / grp["pop5"], np.nan)
        grp["tlm"] = np.where(grp["pop5"] > 0, 1000.0 * grp["saldo"] / grp["pop5"], np.nan)
        grp["iem"] = np.where(
            (grp["imig"] + grp["emig"]) > 0,
            (grp["imig"] - grp["emig"]) / (grp["imig"] + grp["emig"]), np.nan,
        )
        grp["turnover"] = grp["imig"] + grp["emig"]
        grp["taxa_rotatividade"] = np.where(
            grp["pop5"] > 0, 1000.0 * grp["turnover"] / grp["pop5"], np.nan
        )

        nome_fluxos = {"rgi": "fluxos_rgi.parquet", "rgint": "fluxos_rgint.parquet",
                       "uf": "fluxos_uf.parquet"}[nivel]
        fluxos = _ler(edicao, nome_fluxos) if _existe(edicao, nome_fluxos) else pd.DataFrame()
        cent_nivel = {"rgi": "rgi", "rgint": "rgint", "uf": "uf"}[nivel]
        centroides = _ler_centroides(edicao, cent_nivel) if not fluxos.empty else pd.DataFrame()
        dist = _distancia_por_unidade_batch(fluxos, centroides, id_col="cd_mun")
        conect = _conectividade_batch(fluxos)
        gini = _gini_batch(fluxos)
        if nivel == "uf":
            uf_por_codigo = pd.Series(grp["codigo"].to_numpy(), index=grp["codigo"].to_numpy())
        else:
            uf_por_codigo = mun.dropna(subset=[col]).drop_duplicates(col).set_index(col)["uf"]
        pct_uf = _pct_interestadual_batch(fluxos, uf_por_codigo)

        grp = grp.merge(dist, left_on="codigo", right_index=True, how="left")
        grp = grp.merge(conect.rename("n_parceiros"), left_on="codigo", right_index=True, how="left")
        grp = grp.merge(gini, left_on="codigo", right_index=True, how="left")
        grp = grp.merge(pct_uf.rename("pct_interestadual"), left_on="codigo", right_index=True, how="left")

    else:  # nivel == "rm"
        rm = _ler(edicao, "rm.parquet") if _existe(edicao, "rm.parquet") else pd.DataFrame()
        if rm.empty:
            return pd.DataFrame()
        munidx = mun.set_index("cd_mun")
        membros = rm[["cd_rm", "cd_mun"]].merge(
            munidx[["pop", "pop5", "imig", "emig", "saldo", "se_imig", "se_emig"]],
            left_on="cd_mun", right_index=True, how="left",
        )
        grp = membros.groupby("cd_rm").agg(
            pop=("pop", "sum"), pop5=("pop5", "sum"), imig=("imig", "sum"),
            emig=("emig", "sum"), saldo=("saldo", "sum"),
            se_imig=("se_imig", lambda s: float(np.sqrt((s.fillna(0) ** 2).sum()))),
            se_emig=("se_emig", lambda s: float(np.sqrt((s.fillna(0) ** 2).sum()))),
        ).reset_index().rename(columns={"cd_rm": "codigo"})
        grp["tbi"] = np.where(grp["pop5"] > 0, 1000.0 * grp["imig"] / grp["pop5"], np.nan)
        grp["tbe"] = np.where(grp["pop5"] > 0, 1000.0 * grp["emig"] / grp["pop5"], np.nan)
        grp["tlm"] = np.where(grp["pop5"] > 0, 1000.0 * grp["saldo"] / grp["pop5"], np.nan)
        grp["iem"] = np.where(
            (grp["imig"] + grp["emig"]) > 0,
            (grp["imig"] - grp["emig"]) / (grp["imig"] + grp["emig"]), np.nan,
        )
        grp["turnover"] = grp["imig"] + grp["emig"]
        grp["taxa_rotatividade"] = np.where(
            grp["pop5"] > 0, 1000.0 * grp["turnover"] / grp["pop5"], np.nan
        )
        # distância/conectividade/Gini/% interestadual: não computados em nível RM (ver decisão
        # de escopo 5 no cabeçalho) -- ficam NULL.
        for c in ("distancia_media", "distancia_mediana", "n_parceiros", "gini_linha",
                  "gini_coluna", "pct_interestadual"):
            grp[c] = np.nan

        resumo = _ler(edicao, "rm_resumo.parquet") if _existe(edicao, "rm_resumo.parquet") else pd.DataFrame()
        if not resumo.empty:
            resumo = resumo.rename(columns={"cd_rm": "codigo"})
            cols = ["codigo", "mig_intra", "nucleo_periferia", "periferia_nucleo",
                    "periferia_periferia", "saldo_externo", "pct_pendular",
                    "tempo_mediano", "pct_coletivo"]
            grp = grp.merge(resumo[[c for c in cols if c in resumo.columns]], on="codigo", how="left")
            if "pct_diario" in resumo.columns:
                grp = grp.merge(
                    resumo[["codigo", "pct_diario"]].rename(columns={"pct_diario": "pct_retorno_diario"}),
                    on="codigo", how="left",
                )

    grp["se_iem"] = [
        C.se_iem(i, e_, si, se_) for i, e_, si, se_ in
        zip(grp["imig"], grp["emig"], grp["se_imig"], grp["se_emig"])
    ]
    grp["tipo_iem"] = [
        (C.classificar_iem(v, s).value if C.classificar_iem(v, s) is not None else None)
        for v, s in zip(grp["iem"], grp["se_iem"])
    ]
    grp["nivel"] = nivel
    grp["edicao"] = edicao
    return grp


def build_unidades_serie(genealogia: pd.DataFrame, base2022: pd.DataFrame,
                          area: pd.DataFrame, rm_nucleo: pd.DataFrame) -> pd.DataFrame:
    print("== unidades_serie ==")
    cobertura_mun = _cobertura_mun(genealogia, base2022)

    partes_medidas: list[pd.DataFrame] = []
    partes_cobertura: list[pd.DataFrame] = []

    for edicao in EDICOES:
        print(f"  medidas mun/{edicao}")
        partes_medidas.append(_medidas_nivel_mun(edicao))
        for nivel in NIVEIS_AGREGADOS:
            print(f"  medidas {nivel}/{edicao}")
            m = _medidas_nivel_agregado(edicao, nivel)
            if not m.empty:
                partes_medidas.append(m)

    for nivel in NIVEIS_AGREGADOS:
        cob = _agregar_cobertura(cobertura_mun, nivel)
        if nivel == "rm":
            cob = _rm_extras(cob, rm_nucleo)
        partes_cobertura.append(cob)

    medidas_df = pd.concat(partes_medidas, ignore_index=True, sort=False)
    cobertura_df = pd.concat(partes_cobertura, ignore_index=True, sort=False)

    # outer: uma unidade agregada de 2022 (ex.: uma RM ausente inteira de uma edição, como as 3
    # RMs sem nenhum município em 1980) tem que aparecer na série com medidas NULL e
    # `estado_cobertura='sem_cobertura'`, não desaparecer -- `cobertura_df` é o esqueleto
    # completo (toda unidade de 2022 x toda edição); `medidas_df` só tem linha onde a unidade
    # aparece nas tabelas publicadas daquela edição.
    out = medidas_df.merge(cobertura_df, on=["nivel", "codigo", "edicao"], how="outer")

    # existia: só nivel=mun. Municípios ausentes (existia=False) não entram em medidas_df (não
    # há linha em municipios.parquet) -- precisam ser adicionados com todas as medidas NULL.
    mun2022 = base2022["cd_mun"].tolist()
    existentes = set(zip(out.loc[out["nivel"] == "mun", "codigo"], out.loc[out["nivel"] == "mun", "edicao"]))
    faltantes = []
    gmap = genealogia.set_index(["cd_mun_2022", "edicao"])
    for e in EDICOES_ANTIGAS:
        for cd in mun2022:
            if (cd, e) not in existentes:
                row = gmap.loc[(cd, e)] if (cd, e) in gmap.index else None
                faltantes.append({
                    "nivel": "mun", "codigo": cd, "edicao": e, "existia": False,
                    "cd_mun_mae": row["cd_mun_mae"] if row is not None else None,
                    "nm_mun_mae": row["nm_mun_mae"] if row is not None else None,
                })
    faltantes_df = pd.DataFrame(faltantes)
    out = pd.concat([out, faltantes_df], ignore_index=True, sort=False)

    # existia/cobertura para as linhas mun onde havia medida (município presente).
    mun_mask = out["nivel"] == "mun"
    presentes_mask = mun_mask & out["existia"].isna()
    out.loc[presentes_mask, "existia"] = True
    out.loc[mun_mask, "existia"] = out.loc[mun_mask, "existia"].astype(bool)
    existia_bool = out["existia"].fillna(False).astype(bool)
    out.loc[mun_mask & existia_bool, "n_mun_edicao"] = 1
    out.loc[mun_mask & ~existia_bool, "n_mun_edicao"] = 0
    out.loc[mun_mask, "n_mun_2022"] = 1
    out.loc[mun_mask & existia_bool, "cobertura_cod"] = 1.0
    out.loc[mun_mask & ~existia_bool, "cobertura_cod"] = 0.0
    out.loc[mun_mask & existia_bool, "cobertura_pop"] = 1.0
    out.loc[mun_mask & ~existia_bool, "cobertura_pop"] = 0.0

    # linha especial NORTEGO (1980): existia/cobertura não se aplicam (ver decisão de escopo 1).
    nortego_mask = (out["nivel"] == "mun") & (out["codigo"] == "NORTEGO")
    out.loc[nortego_mask, ["existia", "n_mun_edicao", "n_mun_2022", "cobertura_cod",
                           "cobertura_pop"]] = None

    def _estado(row):
        if row["nivel"] == "mun" and row["codigo"] == "NORTEGO":
            return None
        cob_pop = row.get("cobertura_pop")
        cob_cod = row.get("cobertura_cod")
        n_ed = row.get("n_mun_edicao")
        rm_uni = bool(row.get("rm_unitaria")) if pd.notna(row.get("rm_unitaria")) else False
        nuc_div = bool(row.get("nucleo_divergente")) if pd.notna(row.get("nucleo_divergente")) else False
        return C.estado_cobertura(
            cobertura_pop=None if pd.isna(cob_pop) else float(cob_pop),
            cobertura_cod=None if pd.isna(cob_cod) else float(cob_cod),
            n_mun_edicao=0 if pd.isna(n_ed) else int(n_ed),
            intra_unidade=False, rm_unitaria=rm_uni, nucleo_divergente=nuc_div,
        ).value

    out["estado_cobertura"] = out.apply(_estado, axis=1)
    for c in ("rm_unitaria", "nucleo_divergente"):
        if c not in out.columns:
            out[c] = None

    ordem = [
        "nivel", "codigo", "edicao", "imig", "emig", "saldo", "tbi", "tbe", "tlm", "iem",
        "se_iem", "tipo_iem", "turnover", "taxa_rotatividade", "distancia_media",
        "distancia_mediana", "pct_interestadual", "n_parceiros", "gini_linha", "gini_coluna",
        "saida_trab", "entrada_trab", "saldo_pendular", "saida_estudo", "entrada_estudo",
        "taxa_saida_pendular", "indice_atracao", "pct_retorno_diario", "tempo_mediano",
        "pct_coletivo", "mig_intra", "nucleo_periferia", "periferia_nucleo",
        "periferia_periferia", "saldo_externo", "pct_pendular", "existia", "n_mun_edicao",
        "n_mun_2022", "cobertura_cod", "cobertura_pop", "rm_unitaria", "nucleo_divergente",
        "estado_cobertura", "cd_mun_mae", "nm_mun_mae",
    ]
    for c in ordem:
        if c not in out.columns:
            out[c] = None
    return out[ordem].sort_values(["nivel", "codigo", "edicao"]).reset_index(drop=True)


# ==============================================================================================
# 2. pares_serie.parquet
# ==============================================================================================


def _top_n_pares(fluxos: pd.DataFrame, n: int = TOP_N_PARES) -> set[tuple[str, str]]:
    if fluxos.empty:
        return set()
    df = fluxos[fluxos["total"] > 0]
    pares = set()
    for col in ("origem", "destino"):
        rk = df.sort_values("total", ascending=False).groupby(col).head(n)
        pares.update(zip(rk["origem"], rk["destino"]))
    return pares


def build_pares_serie() -> pd.DataFrame:
    print("== pares_serie ==")
    nomes_por_tipo = {
        "mig": {"mun": "fluxos.parquet", "rgi": "fluxos_rgi.parquet",
                "rgint": "fluxos_rgint.parquet", "uf": "fluxos_uf.parquet"},
        "trab": {"mun": "pendular_trab.parquet"},
        "estudo": {"mun": "pendular_estudo.parquet"},
    }
    genealogia = carregar_genealogia()
    existia_map: dict[tuple[str, str], bool] = {
        (r.cd_mun_2022, r.edicao): bool(r.existia) for r in genealogia.itertuples()
    }

    linhas = []
    for tipo, por_nivel in nomes_por_tipo.items():
        for nivel, nome in por_nivel.items():
            # 1. universo de pares "que merece linha": união dos top-N de cada edição
            universo: set[tuple[str, str]] = set()
            tabelas: dict[str, pd.DataFrame] = {}
            for edicao in EDICOES:
                ed_cfg = get_edicao(edicao)
                if tipo == "trab" and not ed_cfg.pendular:
                    continue
                if tipo == "estudo" and not ed_cfg.pendular:
                    continue
                if not _existe(edicao, nome):
                    tabelas[edicao] = pd.DataFrame()
                    continue
                df = _ler(edicao, nome)
                tabelas[edicao] = df
                universo |= _top_n_pares(df)

            if not universo:
                continue

            # 2. uma linha por (par, edicao)
            for edicao in EDICOES:
                df = tabelas.get(edicao, pd.DataFrame())
                if not df.empty:
                    idx = df.set_index(["origem", "destino"])
                else:
                    idx = pd.DataFrame(columns=["total", "cv", "precisao"]).set_index(
                        pd.MultiIndex.from_tuples([], names=["origem", "destino"])
                    )
                cap = C.CAPACIDADES[edicao]
                for origem, destino in universo:
                    if (origem, destino) in idx.index:
                        row = idx.loc[(origem, destino)]
                        if isinstance(row, pd.DataFrame):
                            row = row.iloc[0]
                        linhas.append({
                            "nivel": nivel, "origem": origem, "destino": destino,
                            "edicao": edicao, "tipo": tipo, "total": row.get("total"),
                            "cv": row.get("cv"), "precisao": row.get("precisao"),
                            "motivo_ausencia": None,
                        })
                        continue
                    # ausente: decidir o motivo
                    motivo = "suprimido"
                    if nivel == "mun":
                        o_existia = existia_map.get((origem, edicao), edicao == "2022" or origem == "NORTEGO")
                        d_existia = existia_map.get((destino, edicao), edicao == "2022" or destino == "NORTEGO")
                        if not (o_existia and d_existia):
                            motivo = "nao_existia"
                    if tipo == "trab" and not cap.pendular:
                        motivo = "nao_medido"
                    elif tipo == "estudo" and cap.estudo is None:
                        motivo = "nao_medido"
                    linhas.append({
                        "nivel": nivel, "origem": origem, "destino": destino, "edicao": edicao,
                        "tipo": tipo, "total": None, "cv": None, "precisao": None,
                        "motivo_ausencia": motivo,
                    })

    out = pd.DataFrame(linhas)
    if out.empty:
        return out

    # posto: ranking do par por volume, dentro dos pares que envolvem cada unidade -- publica-se
    # o posto na perspectiva "saída da origem" (ordena os destinos de uma mesma origem).
    out["posto"] = out.groupby(["nivel", "tipo", "edicao", "origem"], group_keys=False)["total"] \
        .apply(lambda s: s.rank(ascending=False, method="min"))
    return out.sort_values(["nivel", "tipo", "edicao", "origem", "destino"]).reset_index(drop=True)


# ==============================================================================================
# 3. perfil_serie.parquet
# ==============================================================================================


def build_perfil_serie(base2022: pd.DataFrame) -> pd.DataFrame:
    print("== perfil_serie ==")
    linhas = []
    for edicao in EDICOES:
        if not _existe(edicao, "municipios_dim.parquet"):
            continue
        dim = _ler(edicao, "municipios_dim.parquet").rename(columns={"cd_mun": "codigo"})
        dim["nivel"] = "mun"
        dim["edicao"] = edicao
        dim["comparavel_com_ressalva"] = False
        linhas.append(dim[["nivel", "codigo", "edicao", "direcao", "dimensao", "categoria",
                            "valor", "n_faixa", "comparavel_com_ressalva"]])

        mun = _ler(edicao, "municipios.parquet")[["cd_mun", "cd_rgi", "cd_rgint", "uf"]]
        dim_mun = dim.merge(mun, left_on="codigo", right_on="cd_mun", how="left")
        for nivel, col in (("rgi", "cd_rgi"), ("rgint", "cd_rgint"), ("uf", "uf")):
            agg = dim_mun.dropna(subset=[col]).groupby(
                [col, "direcao", "dimensao", "categoria"]
            )["valor"].sum().reset_index().rename(columns={col: "codigo"})
            agg["nivel"] = nivel
            agg["edicao"] = edicao
            agg["n_faixa"] = None
            # soma ingênua de categorias com supressão por célula: marcado com ressalva (ver
            # decisão de escopo 6 no cabeçalho).
            agg["comparavel_com_ressalva"] = True
            linhas.append(agg[["nivel", "codigo", "edicao", "direcao", "dimensao", "categoria",
                                "valor", "n_faixa", "comparavel_com_ressalva"]])

        if _existe(edicao, "rm.parquet"):
            rm = _ler(edicao, "rm.parquet")[["cd_rm", "cd_mun"]]
            dim_rm = dim.merge(rm, left_on="codigo", right_on="cd_mun", how="inner")
            agg = dim_rm.groupby(["cd_rm", "direcao", "dimensao", "categoria"])["valor"] \
                .sum().reset_index().rename(columns={"cd_rm": "codigo"})
            agg["nivel"] = "rm"
            agg["edicao"] = edicao
            agg["n_faixa"] = None
            agg["comparavel_com_ressalva"] = True
            linhas.append(agg[["nivel", "codigo", "edicao", "direcao", "dimensao", "categoria",
                                "valor", "n_faixa", "comparavel_com_ressalva"]])

    return pd.concat(linhas, ignore_index=True).sort_values(
        ["nivel", "codigo", "edicao", "direcao", "dimensao", "categoria"]
    ).reset_index(drop=True)


# ==============================================================================================
# 4. sistema_serie.parquet + 5. loglinear_serie.parquet
# ==============================================================================================


def _nmr_densidade_pop(edicao: str, nivel: str, area: pd.DataFrame) -> tuple[dict, dict, dict]:
    if nivel == "mun":
        mun = _ler(edicao, "municipios.parquet")
        col = "cd_mun"
    else:
        mun_raw = _ler(edicao, "municipios.parquet")
        col2 = COD_COL[nivel]
        mun = mun_raw.dropna(subset=[col2]).groupby(col2).agg(
            pop=("pop", "sum"), pop5=("pop5", "sum"), saldo=("saldo", "sum"),
        ).reset_index().rename(columns={col2: "cd_mun"})
        col = "cd_mun"
    ar = area[(area["edicao"] == edicao) & (area["nivel"] == nivel)].set_index("codigo")["area_km2"]
    nmr = {}
    dens = {}
    pop = {}
    for _, row in mun.iterrows():
        cd = row[col]
        p = row["pop"]
        a = ar.get(cd)
        if p and p > 0 and a and a > 0:
            nmr[cd] = 1000.0 * row["saldo"] / row["pop5"] if row.get("pop5", 0) else float("nan")
            dens[cd] = p / a
            pop[cd] = p
    return nmr, dens, pop


def build_sistema_e_loglinear(area: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    print("== sistema_serie + loglinear_serie ==")
    linhas_sistema = []
    linhas_log = []
    nome_fluxos = {"mun": "fluxos.parquet", "rgi": "fluxos_rgi.parquet",
                   "rgint": "fluxos_rgint.parquet", "uf": "fluxos_uf.parquet"}

    matriz_anterior: dict[str, pd.DataFrame] = {}

    for nivel in NIVEIS_PARTICAO:
        # percorre da mais antiga (1980) para a mais nova (2022): duncan_d_ant compara cada
        # edição com a que veio ANTES dela no tempo, e a mais antiga fica sem comparação (NULL).
        for edicao in reversed(EDICOES):
            if not _existe(edicao, nome_fluxos[nivel]):
                continue
            fluxos = _ler(edicao, nome_fluxos[nivel])
            if nivel == "mun":
                unidades = _ler(edicao, "municipios.parquet")
            else:
                col = COD_COL[nivel]
                unidades = _ler(edicao, "municipios.parquet").dropna(subset=[col]).groupby(col).agg(
                    pop=("pop", "sum"), saldo=("saldo", "sum"),
                ).reset_index().rename(columns={col: "cd_mun"})
            n_unidades = unidades.shape[0]
            pop_total = unidades["pop"].sum() if "pop" in unidades.columns else float("nan")

            m_total = float(fluxos["total"].sum()) if not fluxos.empty else 0.0
            cmi_v = MED.cmi(m_total, pop_total)
            saldos = unidades.set_index("cd_mun" if "cd_mun" in unidades.columns else "cd_mun")["saldo"] \
                if "saldo" in unidades.columns else pd.Series(dtype=float)
            mei_v = MED.mei_agregado(saldos.dropna(), m_total)
            anmr_v = MED.anmr(cmi_v, mei_v)

            nmr, dens, pop_u = _nmr_densidade_pop(edicao, nivel, area)
            beta_v, ep_beta_v = MED.beta_fielding(nmr, dens, pop_u) if nmr else (float("nan"), float("nan"))

            smi_v = float("nan")
            if nivel == "mun" and _existe(edicao, "municipios_dim.parquet"):
                smi_v = _smi_sistema(edicao)

            duncan_ant = float("nan")
            chave = f"{nivel}"
            if chave in matriz_anterior:
                duncan_ant = MED.duncan_d(fluxos, matriz_anterior[chave])
            matriz_anterior[chave] = fluxos

            linhas_sistema.append({
                "nivel": nivel, "edicao": edicao, "n_unidades": n_unidades,
                "cmi": nan_to_none(cmi_v), "smi": nan_to_none(smi_v), "mei": nan_to_none(mei_v),
                "anmr": nan_to_none(anmr_v), "beta_fielding": nan_to_none(beta_v),
                "ep_beta": nan_to_none(ep_beta_v), "duncan_d_ant": nan_to_none(duncan_ant),
            })

            if not fluxos.empty:
                dec = MED.decomposicao_loglinear(fluxos)
                if dec["T"] is not None:
                    for o, v in dec["O"].items():
                        linhas_log.append({"nivel": nivel, "edicao": edicao, "tipo": "O",
                                            "codigo": o, "origem": None, "destino": None, "valor": v})
                    for d, v in dec["D"].items():
                        linhas_log.append({"nivel": nivel, "edicao": edicao, "tipo": "D",
                                            "codigo": d, "origem": None, "destino": None, "valor": v})
                    # `dec["OD"]` é DENSO (pivot_table preenche com 0 todo par sem fluxo
                    # publicado -- ver docstring de decomposicao_loglinear): publicar só os
                    # pares com fluxo publicado (n_ij > 0) evita uma tabela de ~5.570² linhas
                    # quase todas triviais (OD_ij = 0.0 por construção, sem informação).
                    pares_publicados = set(
                        zip(fluxos.loc[fluxos["total"] > 0, "origem"],
                            fluxos.loc[fluxos["total"] > 0, "destino"])
                    )
                    for (o, d), v in dec["OD"].items():
                        if (o, d) not in pares_publicados:
                            continue
                        linhas_log.append({"nivel": nivel, "edicao": edicao, "tipo": "OD",
                                            "codigo": None, "origem": o, "destino": d, "valor": v})

    sistema = pd.DataFrame(linhas_sistema)
    loglinear = pd.DataFrame(linhas_log)
    return sistema, loglinear


def _smi_sistema(edicao: str) -> float:
    """SMI do sistema municipal (ver decisão de escopo 4: só nível mun). Padrão de idade: a
    população residente por faixa etária de 2022 (fixa entre edições)."""
    dim = _ler(edicao, "municipios_dim.parquet")
    dim = dim[dim["dimensao"] == "idade_sexo"]

    def _faixa(cat: str) -> str | None:
        for f in MED.FAIXAS_IDADE:
            if cat.lower().startswith(f):
                return f
        return None

    dim = dim.copy()
    dim["faixa"] = dim["categoria"].map(_faixa)
    dim = dim.dropna(subset=["faixa"])

    imig = dim[dim["direcao"] == "imig"].groupby("faixa")["valor"].sum()
    residente = dim[dim["direcao"] == "residente"].groupby("faixa")["valor"].sum()
    taxas = (imig / residente.where(residente > 0)).dropna().to_dict()

    if edicao == "2022":
        padrao = residente.to_dict()
    else:
        dim2022 = _ler("2022", "municipios_dim.parquet")
        dim2022 = dim2022[dim2022["dimensao"] == "idade_sexo"].copy()
        dim2022["faixa"] = dim2022["categoria"].map(_faixa)
        dim2022 = dim2022.dropna(subset=["faixa"])
        padrao = dim2022[dim2022["direcao"] == "residente"].groupby("faixa")["valor"].sum().to_dict()

    return MED.smi(taxas, padrao) if taxas else float("nan")


# ==============================================================================================
# 6. comparabilidade.json + 7. gate
# ==============================================================================================


def build_comparabilidade_json() -> dict:
    print("== comparabilidade.json ==")
    C.validar()
    return C.payload()


def versao_dados_concat() -> str:
    partes = []
    for e in EDICOES:
        g = ROOT / get_edicao(e).processed / ".gate_ok"
        if g.exists():
            partes.append(json.loads(g.read_text())["versao_dados"])
        else:
            partes.append(f"{e}-SEM-GATE")
    return "+".join(partes)


def sha256_arquivo(caminho: pathlib.Path) -> str:
    h = hashlib.sha256()
    with caminho.open("rb") as fh:
        for bloco in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(bloco)
    return h.hexdigest()


def gravar_gate() -> None:
    gate_path = SERIES_DIR / ".gate_ok"
    arquivos = {}
    for f in sorted(SERIES_DIR.rglob("*")):
        if f.is_file() and f != gate_path:
            arquivos[f.relative_to(SERIES_DIR).as_posix()] = sha256_arquivo(f)
    carimbo = {
        "formato_versao": 1,
        "versao_dados": versao_dados_concat(),
        "timestamp": dt.datetime.now().isoformat(),
        "arquivos": dict(sorted(arquivos.items())),
        "nota_verificacao": (
            "Esta pasta não tem microdado: as checagens R1-R6 de disclosure_check.py não se "
            "aplicam (nada aqui vem de data/interim/pessoas_classificado.parquet). O carimbo "
            "segue o MESMO formato de data/processed/.gate_ok para que verify_gate.py "
            "continue funcionando sem alteração; ver build_series.py, decisão de escopo 9, "
            "para a ressalva sobre colunas estruturais (n_mun_edicao/n_mun_2022) em "
            "verify_gate.py --dir data/processed/series isolado."
        ),
    }
    gate_path.write_text(json.dumps(carimbo, indent=2, sort_keys=True, ensure_ascii=False) + "\n",
                          encoding="utf-8")
    print(f"Carimbo: {gate_path.relative_to(ROOT)} ({len(carimbo['arquivos'])} arquivos)")


# ==============================================================================================
# main
# ==============================================================================================


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.parse_args()

    SERIES_DIR.mkdir(parents=True, exist_ok=True)

    genealogia = carregar_genealogia()
    base2022 = carregar_2022()
    area = carregar_area()
    rm_nucleo = carregar_rm_nucleo()

    unidades = build_unidades_serie(genealogia, base2022, area, rm_nucleo)
    unidades.to_parquet(SERIES_DIR / "unidades_serie.parquet", index=False)
    print(f"unidades_serie.parquet: {len(unidades):,} linhas")

    pares = build_pares_serie()
    pares.to_parquet(SERIES_DIR / "pares_serie.parquet", index=False)
    print(f"pares_serie.parquet: {len(pares):,} linhas")

    perfil = build_perfil_serie(base2022)
    perfil.to_parquet(SERIES_DIR / "perfil_serie.parquet", index=False)
    print(f"perfil_serie.parquet: {len(perfil):,} linhas")

    sistema, loglinear = build_sistema_e_loglinear(area)
    sistema.to_parquet(SERIES_DIR / "sistema_serie.parquet", index=False)
    loglinear.to_parquet(SERIES_DIR / "loglinear_serie.parquet", index=False)
    print(f"sistema_serie.parquet: {len(sistema):,} linhas")
    print(f"loglinear_serie.parquet: {len(loglinear):,} linhas")

    payload = build_comparabilidade_json()
    (SERIES_DIR / "comparabilidade.json").write_text(
        json.dumps(payload, indent=2, sort_keys=True, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print("comparabilidade.json gravado")

    gravar_gate()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
