"""Genealogia municipal (F12.1): para cada município de 2022 e cada edição antiga (2010, 2000,
1991, 1980), registra se o território já existia naquela edição e, se não, de qual município
(ou unidade agregada) da época seu território fazia parte -- por SOBREPOSIÇÃO ESPACIAL das
malhas municipais, nunca por reconstrução de AMC (ver plano, "Decisões arquiteturais -> 1.
Genealogia municipal como metadado, não como unidade de análise"). Não toca em `data/raw*`/
`data/interim*`; lê só `data/geo/raw/**` (malhas públicas do IBGE) e
`data/processed[/<edicao>]/municipios_ref.parquet` (já publicado, pós-gate) -- nunca escreve
nessas pastas.

Saídas:
  pipeline/genealogia_municipios.csv -- cd_mun_2022, nm_mun_2022, edicao, existia, cd_mun_mae,
                                          nm_mun_mae, metodo (uma linha por (município de 2022,
                                          edição antiga); 2022 é a base e não tem linha própria).
                                          `existia` sai como string minúscula "true"/"false"
                                          (padrão JSON), nunca o repr Python "True"/"False".
                                          `nm_mun_mae` vem SEMPRE de `municipios_ref.parquet` da
                                          própria edição (JOIN por `cd_mun_mae`), nunca de `NM_MUN`
                                          da malha bruta -- que traz mojibake (2000, CP437 lido
                                          como Latin-1) e CAIXA ALTA SEM ACENTO (1991/2010); ver
                                          `_resolver_nomes_mae`, que também é a asserção de
                                          integridade (toda mãe não-NORTEGO tem que existir em
                                          municipios_ref da edição).
  pipeline/area_km2.parquet          -- nivel, codigo, edicao, area_km2 (mun/rgi/rgint/uf, nas
                                          cinco edições -- ver F12.3, β de Fielding).
  docs/genealogia.md                 -- relatório (contagens, casos-âncora, NORTEGO).

Método (município ausente da malha da edição, por código):
  1. `ST_SetCRS(geom, 'EPSG:4674')` nas duas malhas antes de qualquer operação -- as malhas
     antigas trazem rótulos de CRS diferentes para o mesmo datum (SIRGAS 2000/GRS80) e o join
     espacial do DuckDB se recusa sem isso (já verificado nesta sessão e em `build_centroids.py`).
  2. Interseção com TODOS os polígonos da malha antiga (`ST_Intersects` + `ST_Area(ST_Intersection
     (...))`); pai = polígono de MAIOR interseção. Se esse quinhão for < 90% da área do município
     de 2022, `metodo = 'multiplos_pais'` (ainda registrando o maior pai); senão, `unico_pai`. As
     áreas desta etapa são medidas em graus² -- serve à RAZÃO entre interseção e área própria, não
     à área em si (que tem tabela e unidade dedicadas, `area_km2.parquet`, projetada em Albers).
  3. Sem NENHUMA interseção (ilhas/arquipélagos): casa por centroide (`ST_PointOnSurface`) mais
     próximo (`ST_Distance` mínima) -- `metodo = 'sem_intersecao_por_centroide'`. Sem nenhum
     candidato (malha antiga vazia): `metodo = 'sem_correspondencia'`, `cd_mun_mae = NULL`.
  4. CASO ESPECIAL -- `NORTEGO` (edição 1980): o território do atual Tocantins (UF '17', 139
     municípios de 2022) é publicado pela edição 1980 como UMA unidade agregada, porque a fonte
     tabular não distingue os 52 municípios que o compunham em 1980 (ver
     `pipeline/unidades_agregadas_1980.py`). A malha bruta de 1980 (`geo/fetch_1980.sh`) já chega
     com essas 52 feições DISSOLVIDAS numa só, `CD_MUN = 'NORTEGO'` -- a sobreposição espacial
     acharia esse polígono sozinho para os 139 municípios de Tocantins (ele cobre exatamente essa
     área), com `metodo` genérico `'unico_pai'`. Isso mascararia a unidade agregada: por isso os
     139 municípios de UF '17' são tratados à parte, ANTES do cálculo espacial genérico, com
     `cd_mun_mae = 'NORTEGO'` e `metodo = 'unidade_agregada'` fixos -- o dado publicado não
     distingue os 52 municípios de origem, então a genealogia não pode fingir que distingue.

Área por edição (F12.3, β de Fielding): a malha de 2022 já traz `AREA_KM2` pronta no shapefile
(campo do IBGE); as demais são calculadas transformando a geometria para a MESMA cônica
equivalente de Albers já adotada no atlas (`PROJ4_ALBERS`, ver `build_centroids.py` e
`docs/METODOLOGIA.md`, "Cartografia: projeção cônica equivalente de Albers") e medindo
`ST_Area` em metros -- não um fator fixo de conversão grau²->km², que distorce por latitude;
Albers é equivalente de área por construção, então a medida é exata na projeção, não
aproximada. Os níveis agregados (RGI/RGInt/UF) somam a área municipal sobre os municípios
PRESENTES em `data/processed[/<edicao>]/municipios_ref.parquet` daquela edição -- nunca sobre o
total de 2022.
"""
from __future__ import annotations

import pathlib
import sys

import duckdb

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "pipeline"))
from edicoes import edicao as get_edicao  # noqa: E402
from unidades_agregadas_1980 import NORTE_GOIAS  # noqa: E402

EDICOES_ANTIGAS = ["2010", "2000", "1991", "1980"]
TODAS_EDICOES = ["2022"] + EDICOES_ANTIGAS

# Mesma projeção do atlas (ver build_centroids.py e docs/METODOLOGIA.md, F10) -- reaproveitada
# aqui só para medir área (equivalente por construção), não para publicar coordenada nenhuma.
CRS_ORIGEM = "+proj=longlat +ellps=GRS80 +no_defs"
PROJ4_ALBERS = (
    "+proj=aea +lat_1=-2 +lat_2=-22 +lat_0=-12 +lon_0=-54 "
    "+x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs"
)

LIMIAR_UNICO_PAI = 0.90

GENEALOGIA_CSV = ROOT / "pipeline" / "genealogia_municipios.csv"
AREA_PARQUET = ROOT / "pipeline" / "area_km2.parquet"
RELATORIO_MD = ROOT / "docs" / "genealogia.md"


def _malha_path(nome: str) -> pathlib.Path:
    ed = get_edicao(nome)
    return ROOT / ed.geo_raw / f"BR_Municipios_{nome}.shp"


def _municipios_ref_path(nome: str) -> pathlib.Path:
    ed = get_edicao(nome)
    return ROOT / ed.processed / "municipios_ref.parquet"


def _carregar_malha_2022(con: duckdb.DuckDBPyConnection) -> None:
    """m2022: só os 5.570 municípios publicados (municipios_ref.parquet exclui as duas lagoas
    do RS e o município não instalado -- ver docs/METODOLOGIA.md, item 9)."""
    path = _malha_path("2022").as_posix()
    ref = _municipios_ref_path("2022").as_posix()
    con.execute(f"""
        CREATE TABLE m2022 AS
        SELECT r.cd_mun, r.nm_mun, r.uf, r.cd_rgi, r.cd_rgint,
               ST_SetCRS(g.geom, 'EPSG:4674') AS geom, g.AREA_KM2 AS area_km2
        FROM ST_Read('{path}') g
        JOIN read_parquet('{ref}') r USING (cd_mun)
    """)


def _carregar_malha_edicao(con: duckdb.DuckDBPyConnection, nome: str) -> None:
    path = _malha_path(nome).as_posix()
    con.execute(f"""
        CREATE OR REPLACE TABLE m_edicao AS
        SELECT CD_MUN AS cd_mun_e, NM_MUN AS nm_mun_e,
               ST_SetCRS(geom, 'EPSG:4674') AS geom_e,
               ST_Area(ST_Transform(geom, '{CRS_ORIGEM}', '{PROJ4_ALBERS}')) / 1e6 AS area_km2
        FROM ST_Read('{path}')
    """)


def _genealogia_edicao(con: duckdb.DuckDBPyConnection, nome: str) -> list[dict]:
    """Uma linha por município de 2022 para a edição `nome` (2010/2000/1991/1980)."""
    linhas: list[dict] = []

    # -- caso especial NORTEGO (só 1980): tratado À PARTE, antes do cálculo espacial genérico,
    # para os 139 municípios de UF '17' (Tocantins) -- ver docstring do módulo, passo 4.
    tocantins: set[str] = set()
    if nome == "1980":
        tocantins_rows = con.execute(
            "SELECT cd_mun, nm_mun FROM m2022 WHERE uf = '17'"
        ).fetchall()
        tocantins = {cd for cd, _ in tocantins_rows}
        for cd, nm in tocantins_rows:
            linhas.append({
                "cd_mun_2022": cd, "nm_mun_2022": nm, "edicao": nome,
                "existia": False, "cd_mun_mae": NORTE_GOIAS, "nm_mun_mae": None,
                "metodo": "unidade_agregada",
            })

    # -- existia: código igual na malha da edição.
    existia_rows = con.execute("""
        SELECT m.cd_mun, m.nm_mun
        FROM m2022 m JOIN m_edicao e ON m.cd_mun = e.cd_mun_e
    """).fetchall()
    existia_codes = {cd for cd, _ in existia_rows} | tocantins
    for cd, nm in existia_rows:
        linhas.append({
            "cd_mun_2022": cd, "nm_mun_2022": nm, "edicao": nome,
            "existia": True, "cd_mun_mae": None, "nm_mun_mae": None, "metodo": "existia",
        })

    # -- ausentes (exceto Tocantins em 1980, já tratado acima): sobreposição espacial.
    exceto = ", ".join(f"'{c}'" for c in existia_codes) or "''"
    con.execute(f"""
        CREATE OR REPLACE TABLE ausentes AS
        SELECT cd_mun, nm_mun, geom, ST_Area(geom) AS area_propria,
               ST_PointOnSurface(geom) AS centroide
        FROM m2022
        WHERE cd_mun NOT IN ({exceto})
    """)
    n_ausentes = con.execute("SELECT COUNT(*) FROM ausentes").fetchone()[0]
    if n_ausentes == 0:
        return linhas

    con.execute("""
        CREATE OR REPLACE TABLE inter AS
        SELECT a.cd_mun, e.cd_mun_e, e.nm_mun_e,
               ST_Area(ST_Intersection(a.geom, e.geom_e)) AS area_int
        FROM ausentes a JOIN m_edicao e ON ST_Intersects(a.geom, e.geom_e)
    """)
    maior_quinhao = con.execute("""
        SELECT cd_mun, cd_mun_e, nm_mun_e, area_int
        FROM (
            SELECT *, ROW_NUMBER() OVER (PARTITION BY cd_mun ORDER BY area_int DESC) AS rn
            FROM inter
        )
        WHERE rn = 1
    """).fetchdf()

    com_intersecao = set(maior_quinhao["cd_mun"]) if not maior_quinhao.empty else set()
    area_propria = dict(con.execute("SELECT cd_mun, area_propria FROM ausentes").fetchall())
    nomes_2022 = dict(con.execute("SELECT cd_mun, nm_mun FROM ausentes").fetchall())

    for _, row in maior_quinhao.iterrows():
        cd = row["cd_mun"]
        share = row["area_int"] / area_propria[cd] if area_propria[cd] else 0.0
        metodo = "unico_pai" if share >= LIMIAR_UNICO_PAI else "multiplos_pais"
        linhas.append({
            "cd_mun_2022": cd, "nm_mun_2022": nomes_2022[cd], "edicao": nome,
            "existia": False, "cd_mun_mae": row["cd_mun_e"], "nm_mun_mae": row["nm_mun_e"],
            "metodo": metodo,
        })

    # -- sem nenhuma interseção: casa por centroide mais próximo.
    sem_intersecao = set(nomes_2022) - com_intersecao
    if sem_intersecao:
        n_malha_e = con.execute("SELECT COUNT(*) FROM m_edicao").fetchone()[0]
        exceto_si = ", ".join(f"'{c}'" for c in sem_intersecao)
        if n_malha_e == 0:
            for cd in sem_intersecao:
                linhas.append({
                    "cd_mun_2022": cd, "nm_mun_2022": nomes_2022[cd], "edicao": nome,
                    "existia": False, "cd_mun_mae": None, "nm_mun_mae": None,
                    "metodo": "sem_correspondencia",
                })
        else:
            con.execute(f"""
                CREATE OR REPLACE TABLE sem_int AS
                SELECT cd_mun FROM ausentes WHERE cd_mun IN ({exceto_si})
            """)
            mais_proximo = con.execute("""
                SELECT cd_mun, cd_mun_e, nm_mun_e, dist
                FROM (
                    SELECT s.cd_mun, e.cd_mun_e, e.nm_mun_e,
                           ST_Distance(a.centroide, e.geom_e) AS dist,
                           ROW_NUMBER() OVER (PARTITION BY s.cd_mun ORDER BY
                               ST_Distance(a.centroide, e.geom_e) ASC) AS rn
                    FROM sem_int s
                    JOIN ausentes a USING (cd_mun)
                    CROSS JOIN m_edicao e
                )
                WHERE rn = 1
            """).fetchdf()
            for _, row in mais_proximo.iterrows():
                cd = row["cd_mun"]
                linhas.append({
                    "cd_mun_2022": cd, "nm_mun_2022": nomes_2022[cd], "edicao": nome,
                    "existia": False, "cd_mun_mae": row["cd_mun_e"], "nm_mun_mae": row["nm_mun_e"],
                    "metodo": "sem_intersecao_por_centroide",
                })
            achados = set(mais_proximo["cd_mun"]) if not mais_proximo.empty else set()
            for cd in sem_intersecao - achados:
                linhas.append({
                    "cd_mun_2022": cd, "nm_mun_2022": nomes_2022[cd], "edicao": nome,
                    "existia": False, "cd_mun_mae": None, "nm_mun_mae": None,
                    "metodo": "sem_correspondencia",
                })
    return linhas


def _resolver_nomes_mae(con: duckdb.DuckDBPyConnection, nome: str, linhas: list[dict]) -> None:
    """Preenche `nm_mun_mae` por JOIN com `municipios_ref.parquet` da PRÓPRIA edição (nunca
    `NM_MUN` da malha bruta -- que traz mojibake em 2000 e CAIXA ALTA SEM ACENTO em 1991/2010,
    ver auditoria do F12.1). Modifica `linhas` in place.

    Também é a única asserção de integridade do módulo: todo `cd_mun_mae` não-nulo (exceto o
    sentinela `NORTEGO`, tratado à parte) tem que existir em `municipios_ref` da edição -- essa
    garantia é o que protege contra o código-sentinela `'0'` presente na malha bruta de 2000 e
    contra as "duas lagoas do RS" que aparecem em algumas malhas mas não são município publicado
    (ver `docs/METODOLOGIA.md`, item 9) entrando como pai por engano.
    """
    ref_map = dict(con.execute(
        f"SELECT cd_mun, nm_mun FROM read_parquet('{_municipios_ref_path(nome).as_posix()}')"
    ).fetchall())

    maes = {l["cd_mun_mae"] for l in linhas if l["cd_mun_mae"] is not None}
    faltando = maes - {NORTE_GOIAS} - set(ref_map)
    if faltando:
        raise AssertionError(
            f"edição {nome}: cd_mun_mae fora de municipios_ref.parquet: {sorted(faltando)} -- "
            "provável código-sentinela ('0') ou feição de água presente na malha bruta mas não "
            "publicada (ver docs/METODOLOGIA.md, item 9)."
        )

    for l in linhas:
        if l["cd_mun_mae"] is not None:
            l["nm_mun_mae"] = ref_map[l["cd_mun_mae"]]


def _area_edicao(con: duckdb.DuckDBPyConnection, nome: str) -> list[dict]:
    """area_km2 nos quatro níveis, para a edição `nome` (2022 inclusive)."""
    linhas: list[dict] = []
    if nome == "2022":
        mun = con.execute("SELECT cd_mun AS codigo, area_km2 FROM m2022").fetchdf()
        ref = con.execute(
            f"SELECT cd_mun, cd_rgi, cd_rgint, uf FROM read_parquet('{_municipios_ref_path('2022').as_posix()}')"
        ).fetchdf()
    else:
        # Restrito às unidades PUBLICADAS pela edição (municipios_ref) -- a malha bruta pode
        # trazer feições extras sem par publicado (placeholders/artefatos de água, ver
        # EXCLUIDOS em build_centroids.py); a unidade agregada NORTEGO (1980) está em
        # municipios_ref e passa por este mesmo filtro, sem tratamento especial.
        ref = con.execute(
            f"SELECT cd_mun, cd_rgi, cd_rgint, uf FROM read_parquet('{_municipios_ref_path(nome).as_posix()}')"
        ).fetchdf()
        con.register("_ref_check_df", ref)
        mun = con.execute("""
            SELECT e.cd_mun_e AS codigo, e.area_km2
            FROM m_edicao e JOIN _ref_check_df r ON r.cd_mun = e.cd_mun_e
        """).fetchdf()
        con.unregister("_ref_check_df")

    for _, row in mun.iterrows():
        linhas.append({"nivel": "mun", "codigo": row["codigo"], "edicao": nome, "area_km2": row["area_km2"]})

    con.register("_mun_df", mun)
    con.register("_ref_df", ref)
    for nivel, coluna in (("rgi", "cd_rgi"), ("rgint", "cd_rgint"), ("uf", "uf")):
        agg = con.execute(f"""
            SELECT r.{coluna} AS codigo, SUM(m.area_km2) AS area_km2
            FROM _ref_df r JOIN _mun_df m ON m.codigo = r.cd_mun
            WHERE r.{coluna} IS NOT NULL
            GROUP BY r.{coluna}
        """).fetchdf()
        for _, row in agg.iterrows():
            linhas.append({"nivel": nivel, "codigo": row["codigo"], "edicao": nome, "area_km2": row["area_km2"]})
    con.unregister("_mun_df")
    con.unregister("_ref_df")
    return linhas


def _escrever_relatorio(con: duckdb.DuckDBPyConnection, genealogia: list[dict]) -> None:
    import pandas as pd

    df = pd.DataFrame(genealogia)
    con.register("_gen_df", df)

    linhas_md: list[str] = []
    linhas_md.append("# Genealogia municipal (F12.1)\n")
    linhas_md.append(
        "Gerado por `pipeline/build_genealogia.py`. Metadado de comparabilidade territorial "
        "para a seção \"Ao longo dos censos\" (F12) -- **não é AMC** e não entra no SQL do "
        "pipeline nem em `municipios_ref`. Fonte: sobreposição espacial das malhas municipais "
        "públicas do IBGE (`data/geo/raw/**`), nunca microdados.\n"
    )

    linhas_md.append("## Ausência por edição\n")
    linhas_md.append("| Edição | Municípios de 2022 ausentes na malha | `multiplos_pais` | "
                      "`sem_intersecao_por_centroide` | `sem_correspondencia` | `unidade_agregada` |")
    linhas_md.append("|---|---:|---:|---:|---:|---:|")
    resumo = con.execute("""
        SELECT edicao,
               SUM(CASE WHEN NOT existia THEN 1 ELSE 0 END) AS ausentes,
               SUM(CASE WHEN metodo = 'multiplos_pais' THEN 1 ELSE 0 END) AS multiplos,
               SUM(CASE WHEN metodo = 'sem_intersecao_por_centroide' THEN 1 ELSE 0 END) AS centroide,
               SUM(CASE WHEN metodo = 'sem_correspondencia' THEN 1 ELSE 0 END) AS sem_corresp,
               SUM(CASE WHEN metodo = 'unidade_agregada' THEN 1 ELSE 0 END) AS agregada
        FROM _gen_df GROUP BY edicao
        ORDER BY CASE edicao WHEN '2010' THEN 1 WHEN '2000' THEN 2 WHEN '1991' THEN 3 WHEN '1980' THEN 4 END
    """).fetchall()
    esperado = {"2010": 8, "2000": 66, "1991": 1082, "1980": 1634}
    for ed, ausentes, multiplos, centroide, sem_corresp, agregada in resumo:
        linhas_md.append(
            f"| {ed} | {ausentes} (esperado ~{esperado[ed]}, `docs/METODOLOGIA.md`) | {multiplos} | "
            f"{centroide} | {sem_corresp} | {agregada} |"
        )
    linhas_md.append(
        "\nA contagem \"esperado\" de `docs/METODOLOGIA.md` mede **códigos de `labels.RECORTES` "
        "sem par na edição**, uma tabela de rótulos; esta genealogia mede **códigos de "
        "`municipios_ref.parquet` (2022, 5.570 municípios) sem par na MALHA** (shapefile) da "
        "edição. As duas contam quase a mesma coisa, mas de fontes diferentes -- se divergirem "
        "muito, ver a nota abaixo, por edição.\n"
    )

    linhas_md.append("## Casos sem interseção direta (ilhas/arquipélagos)\n")
    sem_int = con.execute("""
        SELECT edicao, cd_mun_2022, nm_mun_2022, metodo, cd_mun_mae, nm_mun_mae
        FROM _gen_df WHERE metodo IN ('sem_intersecao_por_centroide', 'sem_correspondencia')
        ORDER BY edicao, cd_mun_2022
    """).fetchall()
    if sem_int:
        linhas_md.append("| Edição | Município (2022) | Método | Pai atribuído |")
        linhas_md.append("|---|---|---|---|")
        for ed, cd, nm, metodo, mae_cd, mae_nm in sem_int:
            pai = f"{mae_nm} ({mae_cd})" if mae_cd else "nenhum"
            linhas_md.append(f"| {ed} | {nm} ({cd}) | `{metodo}` | {pai} |")
    else:
        linhas_md.append(
            "Nenhum caso: todo município de 2022 teve pelo menos uma interseção geométrica "
            "direta com algum polígono da malha de cada edição antiga. O plano do F12.1 previa "
            "~7 casos (ilhas/arquipélagos, ex.: Fernando de Noronha) exigindo o casamento por "
            "centroide -- não ocorreram porque **os scripts de aquisição da malha já normalizam "
            "esses códigos antes de publicar o shapefile**: Fernando de Noronha (2605459) chega "
            "com o mesmo código em todas as edições -- inclusive 1980, onde `geo/fetch_1980.sh` "
            "remapeia explicitamente o código de Território Federal '2000107' para '2605459' -- "
            "logo aparece como `existia = true`, não como caso sem interseção. Não há, na malha "
            "nacional consolidada que o atlas usa, nenhum outro arquipélago publicado como "
            "município que fique geometricamente isolado o bastante para falhar `ST_Intersects` "
            "contra as quatro malhas antigas.\n"
        )
    linhas_md.append("")

    linhas_md.append("## `NORTEGO` como pai em 1980 (Tocantins)\n")
    n_nortego = con.execute(
        "SELECT COUNT(*) FROM _gen_df WHERE edicao='1980' AND cd_mun_mae='NORTEGO'"
    ).fetchone()[0]
    n_agregada = con.execute(
        "SELECT COUNT(*) FROM _gen_df WHERE edicao='1980' AND metodo='unidade_agregada'"
    ).fetchone()[0]
    linhas_md.append(
        f"{n_nortego} municípios de 2022 têm `cd_mun_mae = 'NORTEGO'` na edição 1980, dos quais "
        f"{n_agregada} com `metodo = 'unidade_agregada'` (os 139 municípios de UF '17', "
        "Tocantins -- tratados à parte da sobreposição espacial genérica, ver docstring do "
        "módulo, passo 4: o dado publicado de 1980 não distingue os 52 municípios de origem, "
        "então nenhum deles pode aparecer como pai único mesmo que a malha traga o polígono "
        "real dissolvido sob o mesmo código.)\n"
    )

    linhas_md.append("## Cobertura de RGI/RGInt/RM por edição\n")
    for nivel, tabela_col in (("rgi", "cd_rgi"), ("rgint", "cd_rgint"), ("rm", "cd_rm")):
        ref2022 = con.execute(
            f"SELECT cd_mun, {tabela_col} AS codigo FROM read_parquet("
            f"'{_municipios_ref_path('2022').as_posix()}') WHERE {tabela_col} IS NOT NULL"
        ).fetchdf()
        con.register("_ref2022_df", ref2022)
        linhas_md.append(f"### {nivel.upper()}\n")
        linhas_md.append(f"| Edição | Unidades de {nivel.upper()} de 2022 com >=1 município presente | Total de {nivel.upper()} com município em 2022 |")
        linhas_md.append("|---|---:|---:|")
        total_unidades = con.execute("SELECT COUNT(DISTINCT codigo) FROM _ref2022_df").fetchone()[0]
        for ed in EDICOES_ANTIGAS:
            cobertas = con.execute(f"""
                SELECT COUNT(DISTINCT r.codigo)
                FROM _ref2022_df r
                JOIN _gen_df g ON g.cd_mun_2022 = r.cd_mun AND g.edicao = '{ed}'
                WHERE g.existia
            """).fetchone()[0]
            linhas_md.append(f"| {ed} | {cobertas} | {total_unidades} |")
        con.unregister("_ref2022_df")
        linhas_md.append("")

    linhas_md.append("## Nenhum município de 2022 sem linha\n")
    faltando = con.execute("""
        SELECT COUNT(*) FROM (
            SELECT cd_mun FROM read_parquet(
                '""" + _municipios_ref_path("2022").as_posix() + """')
        ) m
        WHERE (SELECT COUNT(*) FROM _gen_df g WHERE g.cd_mun_2022 = m.cd_mun) < 4
    """).fetchone()[0]
    linhas_md.append(
        f"{faltando} municípios de 2022 com menos de 4 linhas na genealogia (uma por edição "
        "antiga) -- esperado 0.\n"
    )

    con.unregister("_gen_df")
    RELATORIO_MD.write_text("\n".join(linhas_md) + "\n", encoding="utf-8")
    print(f"{RELATORIO_MD}: relatório escrito.")


def main() -> None:
    con = duckdb.connect()
    con.execute("INSTALL spatial; LOAD spatial;")

    _carregar_malha_2022(con)

    genealogia: list[dict] = []
    area: list[dict] = []
    area += _area_edicao(con, "2022")

    for nome in EDICOES_ANTIGAS:
        _carregar_malha_edicao(con, nome)
        linhas = _genealogia_edicao(con, nome)
        _resolver_nomes_mae(con, nome, linhas)
        genealogia.extend(linhas)
        area.extend(_area_edicao(con, nome))
        n_existia = sum(1 for l in linhas if l["existia"])
        n_ausentes = len(linhas) - n_existia
        print(f"{nome}: {n_existia} existiam, {n_ausentes} ausentes")

    import pandas as pd
    gen_df = pd.DataFrame(genealogia)
    gen_df = gen_df[["cd_mun_2022", "nm_mun_2022", "edicao", "existia", "cd_mun_mae",
                      "nm_mun_mae", "metodo"]]
    # `existia` sai como string minúscula "true"/"false" (padrão JSON), nunca o repr Python
    # "True"/"False" -- para não ambiguar quem for ler o CSV depois (build_series.py, front).
    gen_df["existia"] = gen_df["existia"].map({True: "true", False: "false"})
    gen_df.to_csv(GENEALOGIA_CSV, index=False)
    print(f"{GENEALOGIA_CSV}: {len(gen_df)} linhas ({gen_df['cd_mun_2022'].nunique()} municípios "
          f"x {gen_df['edicao'].nunique()} edições).")

    area_df = pd.DataFrame(area)
    con.register("_area_df", area_df)
    con.execute(f"COPY (SELECT nivel, codigo, edicao, area_km2 FROM _area_df) TO "
                f"'{AREA_PARQUET.as_posix()}' (FORMAT PARQUET)")
    con.unregister("_area_df")
    print(f"{AREA_PARQUET}: {len(area_df)} linhas.")

    _escrever_relatorio(con, genealogia)


if __name__ == "__main__":
    main()
