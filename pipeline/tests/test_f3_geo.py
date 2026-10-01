"""Testes da F3: malha geográfica (dado público do IBGE, sem microdados).

Parametrizado por edição (ver pipeline/edicoes.py): os valores esperados para "2022" são os
originais, inalterados; "2010" usa os números confirmados na F1 da edição Censo 2010 (ver
plano) -- 5.565 municípios (5.570 de 2022 menos os 5 criados em 2013), RGI/RGInt aplicadas
retroativamente por código de município (510/133, idênticos a 2022 -- nenhuma RGI/RGInt é
composta só por município criado depois de 2010). "1980" segue o mesmo princípio: 3.991
municípios (a malha de 1980), 500 RGIs e 133 RGInts (as de 2022 que têm ao menos um município
existente em 1980; as 10 RGIs que somem são compostas só por municípios criados depois).
"""
import json
import pathlib
import sys

import pytest

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / "pipeline"))
import norte_goias_1980  # noqa: E402
from edicoes import edicao as get_edicao  # noqa: E402

EDICOES_TESTADAS = [
    pytest.param("2022", 5570, 510, 133, 27, id="2022"),
    pytest.param("2010", 5565, 510, 133, 27, id="2010"),
    pytest.param("2000", 5507, 510, 133, 27, id="2000"),
    pytest.param("1991", 4491, 510, 133, 27, id="1991"),
    # 1980: 3.991 municípios = os 3.939 que a Base dos Dados identificava + os 52 do norte de
    # Goiás (hoje Tocantins), recodificados para 17xxxxx (pipeline/norte_goias_1980.py) e
    # publicados cada um na sua feição -- desde 1.1.0-1980; até 1.0.7-1980 eram uma unidade
    # agregada, 'NORTEGO' (3.940 unidades, 489 RGIs, 130 RGInts). Os 52 trazem RGI/RGInt de 2022
    # (11 e 3): 500 RGIs e 133 RGInts, a mesma contagem de 2022 nas RGInts; 27 UFs, com
    # Tocantins.
    pytest.param("1980", 3991, 500, 133, 27, id="1980"),
]


def _paths(edicao_nome: str):
    ed = get_edicao(edicao_nome)
    proc = ROOT / ed.processed
    _pula_se_publicado_anterior_a_1_1_0(edicao_nome, proc)
    return proc, proc / "geo"


def _pula_se_publicado_anterior_a_1_1_0(edicao_nome: str, proc: pathlib.Path) -> None:
    """Os números de 1980 acima valem para o publicado de 1.1.0-1980 em diante (52 municípios do
    norte de Goiás recodificados, sem unidade agregada). Enquanto data/processed/1980 ainda for
    uma 1.0.x-1980 -- por exemplo no meio da regeneração -- os testes da edição são pulados, não
    reprovados por um motivo que não é bug. Sem carimbo, nada a decidir aqui: _req pula."""
    gate = proc / ".gate_ok"
    if edicao_nome != "1980" or not gate.exists():
        return
    versao = json.loads(gate.read_text(encoding="utf-8"))["versao_dados"]
    if versao.startswith("1.0."):
        pytest.skip(f"{proc} ainda em {versao}; regenerar a edição 1980 (1.1.0-1980 ou posterior)")


def _req(*paths):
    for p in paths:
        if not pathlib.Path(p).exists():
            pytest.skip(f"{p} ainda não gerado (rode geo/build.sh <edicao> e os build_*.py)")


def _topojson_ids(path, id_field="CD_MUN"):
    data = json.loads(path.read_text(encoding="utf-8"))
    obj = next(iter(data["objects"].values()))
    return {g["properties"][id_field] for g in obj["geometries"]}


@pytest.mark.parametrize("edicao_nome, n_mun, n_rgi, n_rgint, n_uf", EDICOES_TESTADAS)
def test_municipios_topojson_dentro_do_orcamento(con, edicao_nome, n_mun, n_rgi, n_rgint, n_uf):
    PROC, GEO = _paths(edicao_nome)
    _req(GEO / "municipios.topojson")
    tam = (GEO / "municipios.topojson").stat().st_size
    assert tam <= 2 * 1024 * 1024, f"{tam/1e6:.2f} MB excede o orçamento de 2 MB"


@pytest.mark.parametrize("edicao_nome, n_mun, n_rgi, n_rgint, n_uf", EDICOES_TESTADAS)
def test_municipios_topojson_e_json_valido_com_ids_esperados(con, edicao_nome, n_mun, n_rgi, n_rgint, n_uf):
    PROC, GEO = _paths(edicao_nome)
    _req(GEO / "municipios.topojson")
    ids = _topojson_ids(GEO / "municipios.topojson")
    assert len(ids) == n_mun


@pytest.mark.parametrize("edicao_nome, n_mun, n_rgi, n_rgint, n_uf", EDICOES_TESTADAS)
def test_ids_do_topojson_batem_1_para_1_com_municipios_parquet(con, edicao_nome, n_mun, n_rgi, n_rgint, n_uf):
    PROC, GEO = _paths(edicao_nome)
    _req(GEO / "municipios.topojson", PROC / "municipios.parquet")
    ids_geo = _topojson_ids(GEO / "municipios.topojson")
    ids_dados, = [set(r[0] for r in con.execute(
        f"SELECT cd_mun FROM read_parquet('{PROC}/municipios.parquet')").fetchall())]
    assert ids_geo == ids_dados


@pytest.mark.parametrize("edicao_nome, n_mun, n_rgi, n_rgint, n_uf", EDICOES_TESTADAS)
def test_nenhum_corpo_dagua_ou_placeholder_no_topojson(con, edicao_nome, n_mun, n_rgi, n_rgint, n_uf):
    PROC, GEO = _paths(edicao_nome)
    _req(GEO / "municipios.topojson")
    ids = _topojson_ids(GEO / "municipios.topojson")
    assert not (ids & {"8888888", "9999999", "4300001", "4300002", "NORTEGO"})


def test_1980_topojson_tem_os_52_municipios_do_norte_de_goias_e_nenhum_codigo_de_1980():
    """Cada um dos 52 tem a sua feição, pelo código de 2022 (17xxxxx). Nem a unidade agregada
    'NORTEGO' (até 1.0.7-1980), nem um 52xxxxx deles, nem o 2000107 de Fernando de Noronha
    (publicado como 2605459) sobram na malha."""
    PROC, GEO = _paths("1980")
    _req(GEO / "municipios.topojson")
    ids = _topojson_ids(GEO / "municipios.topojson")
    assert set(norte_goias_1980.RECODIFICACAO_1980.values()) <= ids
    assert "2605459" in ids
    assert not ids & (set(norte_goias_1980.RECODIFICACAO_1980) | {"NORTEGO", "2000107"})
    assert sum(1 for i in ids if i.startswith("17")) == 52, "a UF '17' tem só os 52"


@pytest.mark.parametrize("edicao_nome, n_mun, n_rgi, n_rgint, n_uf", EDICOES_TESTADAS)
def test_uf_topojson_tem_unidades_esperadas(con, edicao_nome, n_mun, n_rgi, n_rgint, n_uf):
    PROC, GEO = _paths(edicao_nome)
    _req(GEO / "uf.topojson")
    ids = _topojson_ids(GEO / "uf.topojson", id_field="cd_uf")
    assert len(ids) == n_uf


@pytest.mark.parametrize("edicao_nome, n_mun, n_rgi, n_rgint, n_uf", EDICOES_TESTADAS)
def test_centroides_cobrem_todos_os_municipios(con, edicao_nome, n_mun, n_rgi, n_rgint, n_uf):
    PROC, GEO = _paths(edicao_nome)
    _req(GEO / "centroides.parquet")
    n, = con.execute(f"SELECT COUNT(*) FROM read_parquet('{GEO}/centroides.parquet')").fetchone()
    assert n == n_mun


@pytest.mark.parametrize("edicao_nome, n_mun, n_rgi, n_rgint, n_uf", EDICOES_TESTADAS)
def test_centroides_dentro_do_territorio_brasileiro(con, edicao_nome, n_mun, n_rgi, n_rgint, n_uf):
    PROC, GEO = _paths(edicao_nome)
    _req(GEO / "centroides.parquet")
    fora, = con.execute(f"""
        SELECT COUNT(*) FROM read_parquet('{GEO}/centroides.parquet')
        WHERE lon < -75 OR lon > -30 OR lat < -35 OR lat > 6
    """).fetchone()
    assert fora == 0


def test_meta_json_valido(con):
    _req(ROOT / "data/processed/meta.json")
    meta = json.loads((ROOT / "data/processed/meta.json").read_text(encoding="utf-8"))
    assert meta["revelacao"]["min_pessoas"] == 5
    assert "rotulos" in meta and "status" in meta["rotulos"]


# ---- F6: níveis de agregação (RGI, RGInt, UF) ----

@pytest.mark.parametrize("edicao_nome, n_mun, n_rgi, n_rgint, n_uf", EDICOES_TESTADAS)
def test_rgi_topojson_tem_unidades_esperadas_dentro_do_orcamento(con, edicao_nome, n_mun, n_rgi, n_rgint, n_uf):
    PROC, GEO = _paths(edicao_nome)
    _req(GEO / "rgi.topojson")
    tam = (GEO / "rgi.topojson").stat().st_size
    assert tam <= 800 * 1024, f"{tam/1e3:.0f} KB excede o orçamento de 800 KB"
    ids = _topojson_ids(GEO / "rgi.topojson", id_field="cd_rgi")
    assert len(ids) == n_rgi


@pytest.mark.parametrize("edicao_nome, n_mun, n_rgi, n_rgint, n_uf", EDICOES_TESTADAS)
def test_rgint_topojson_tem_unidades_esperadas_dentro_do_orcamento(con, edicao_nome, n_mun, n_rgi, n_rgint, n_uf):
    PROC, GEO = _paths(edicao_nome)
    _req(GEO / "rgint.topojson")
    tam = (GEO / "rgint.topojson").stat().st_size
    assert tam <= 400 * 1024, f"{tam/1e3:.0f} KB excede o orçamento de 400 KB"
    ids = _topojson_ids(GEO / "rgint.topojson", id_field="cd_rgint")
    assert len(ids) == n_rgint


@pytest.mark.parametrize("edicao_nome, n_mun, n_rgi, n_rgint, n_uf", EDICOES_TESTADAS)
def test_rgi_ids_batem_com_municipios_ref(con, edicao_nome, n_mun, n_rgi, n_rgint, n_uf):
    PROC, GEO = _paths(edicao_nome)
    _req(GEO / "rgi.topojson", PROC / "municipios_ref.parquet")
    ids_geo = _topojson_ids(GEO / "rgi.topojson", id_field="cd_rgi")
    # `IS NOT NULL` é invariante genérico: um município sem RGI não tem feição em rgi.topojson
    # (geo/build.sh filtra antes do -dissolve), e os dois lados têm de excluir a mesma coisa.
    # Em nenhuma edição vigente ele exclui alguém: até 1.0.7-1980 a unidade agregada 'NORTEGO'
    # (a única sem RGI) era a exceção; desde 1.1.0-1980 os 52 municípios do norte de Goiás têm
    # RGI e RGInt de 2022 e nenhuma unidade de 1980 sai sem recorte.
    ids_dados, = [set(r[0] for r in con.execute(
        f"SELECT DISTINCT cd_rgi FROM read_parquet('{PROC}/municipios_ref.parquet') "
        "WHERE cd_rgi IS NOT NULL").fetchall())]
    assert ids_geo == ids_dados


@pytest.mark.parametrize("edicao_nome, n_mun, n_rgi, n_rgint, n_uf", EDICOES_TESTADAS)
def test_rgint_ids_batem_com_municipios_ref(con, edicao_nome, n_mun, n_rgi, n_rgint, n_uf):
    PROC, GEO = _paths(edicao_nome)
    _req(GEO / "rgint.topojson", PROC / "municipios_ref.parquet")
    ids_geo = _topojson_ids(GEO / "rgint.topojson", id_field="cd_rgint")
    ids_dados, = [set(r[0] for r in con.execute(
        f"SELECT DISTINCT cd_rgint FROM read_parquet('{PROC}/municipios_ref.parquet') "
        "WHERE cd_rgint IS NOT NULL").fetchall())]
    assert ids_geo == ids_dados


@pytest.mark.parametrize("edicao_nome, n_mun, n_rgi, n_rgint, n_uf", EDICOES_TESTADAS)
def test_centroides_agregados_cobrem_todas_as_unidades(con, edicao_nome, n_mun, n_rgi, n_rgint, n_uf):
    PROC, GEO = _paths(edicao_nome)
    _req(GEO / "centroides_rgi.parquet", GEO / "centroides_rgint.parquet", GEO / "centroides_uf.parquet")
    n_rgi_, = con.execute(f"SELECT COUNT(*) FROM read_parquet('{GEO}/centroides_rgi.parquet')").fetchone()
    n_rgint_, = con.execute(f"SELECT COUNT(*) FROM read_parquet('{GEO}/centroides_rgint.parquet')").fetchone()
    n_uf_, = con.execute(f"SELECT COUNT(*) FROM read_parquet('{GEO}/centroides_uf.parquet')").fetchone()
    assert (n_rgi_, n_rgint_, n_uf_) == (n_rgi, n_rgint, n_uf)
