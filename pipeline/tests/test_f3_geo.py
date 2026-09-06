"""Testes da F3: malha geográfica (dado público do IBGE, sem microdados)."""
import json
import pathlib

import pytest

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
GEO = ROOT / "data/processed/geo"
PROC = ROOT / "data/processed"


def _req(*paths):
    for p in paths:
        if not pathlib.Path(p).exists():
            pytest.skip(f"{p} ainda não gerado (rode geo/build.sh e os build_*.py)")


def _topojson_ids(path, id_field="CD_MUN"):
    data = json.loads(path.read_text(encoding="utf-8"))
    obj = next(iter(data["objects"].values()))
    return {g["properties"][id_field] for g in obj["geometries"]}


def test_municipios_topojson_dentro_do_orcamento(con):
    _req(GEO / "municipios.topojson")
    tam = (GEO / "municipios.topojson").stat().st_size
    assert tam <= 2 * 1024 * 1024, f"{tam/1e6:.2f} MB excede o orçamento de 2 MB"


def test_municipios_topojson_e_json_valido_com_5570_ids(con):
    _req(GEO / "municipios.topojson")
    ids = _topojson_ids(GEO / "municipios.topojson")
    assert len(ids) == 5570


def test_ids_do_topojson_batem_1_para_1_com_municipios_parquet(con):
    _req(GEO / "municipios.topojson", PROC / "municipios.parquet")
    ids_geo = _topojson_ids(GEO / "municipios.topojson")
    ids_dados, = [set(r[0] for r in con.execute(
        f"SELECT cd_mun FROM read_parquet('{PROC}/municipios.parquet')").fetchall())]
    assert ids_geo == ids_dados


def test_nenhum_corpo_dagua_ou_placeholder_no_topojson(con):
    _req(GEO / "municipios.topojson")
    ids = _topojson_ids(GEO / "municipios.topojson")
    assert not (ids & {"8888888", "9999999", "4300001", "4300002"})


def test_uf_topojson_tem_27_unidades(con):
    _req(GEO / "uf.topojson")
    ids = _topojson_ids(GEO / "uf.topojson", id_field="cd_uf")
    assert len(ids) == 27


def test_centroides_cobrem_todos_os_municipios(con):
    _req(GEO / "centroides.parquet")
    n, = con.execute(f"SELECT COUNT(*) FROM read_parquet('{GEO}/centroides.parquet')").fetchone()
    assert n == 5570


def test_centroides_dentro_do_territorio_brasileiro(con):
    _req(GEO / "centroides.parquet")
    fora, = con.execute(f"""
        SELECT COUNT(*) FROM read_parquet('{GEO}/centroides.parquet')
        WHERE lon < -75 OR lon > -30 OR lat < -35 OR lat > 6
    """).fetchone()
    assert fora == 0


def test_meta_json_valido(con):
    _req(PROC / "meta.json")
    meta = json.loads((PROC / "meta.json").read_text(encoding="utf-8"))
    assert meta["revelacao"]["min_pessoas"] == 5
    assert "rotulos" in meta and "status" in meta["rotulos"]


# ---- F6: níveis de agregação (RGI, RGInt, UF) ----

def test_rgi_topojson_tem_510_unidades_dentro_do_orcamento(con):
    _req(GEO / "rgi.topojson")
    tam = (GEO / "rgi.topojson").stat().st_size
    assert tam <= 800 * 1024, f"{tam/1e3:.0f} KB excede o orçamento de 800 KB"
    ids = _topojson_ids(GEO / "rgi.topojson", id_field="cd_rgi")
    assert len(ids) == 510


def test_rgint_topojson_tem_133_unidades_dentro_do_orcamento(con):
    _req(GEO / "rgint.topojson")
    tam = (GEO / "rgint.topojson").stat().st_size
    assert tam <= 400 * 1024, f"{tam/1e3:.0f} KB excede o orçamento de 400 KB"
    ids = _topojson_ids(GEO / "rgint.topojson", id_field="cd_rgint")
    assert len(ids) == 133


def test_rgi_ids_batem_com_municipios_ref(con):
    _req(GEO / "rgi.topojson", PROC / "municipios_ref.parquet")
    ids_geo = _topojson_ids(GEO / "rgi.topojson", id_field="cd_rgi")
    ids_dados, = [set(r[0] for r in con.execute(
        f"SELECT DISTINCT cd_rgi FROM read_parquet('{PROC}/municipios_ref.parquet')").fetchall())]
    assert ids_geo == ids_dados


def test_rgint_ids_batem_com_municipios_ref(con):
    _req(GEO / "rgint.topojson", PROC / "municipios_ref.parquet")
    ids_geo = _topojson_ids(GEO / "rgint.topojson", id_field="cd_rgint")
    ids_dados, = [set(r[0] for r in con.execute(
        f"SELECT DISTINCT cd_rgint FROM read_parquet('{PROC}/municipios_ref.parquet')").fetchall())]
    assert ids_geo == ids_dados


def test_centroides_agregados_cobrem_todas_as_unidades(con):
    _req(GEO / "centroides_rgi.parquet", GEO / "centroides_rgint.parquet", GEO / "centroides_uf.parquet")
    n_rgi, = con.execute(f"SELECT COUNT(*) FROM read_parquet('{GEO}/centroides_rgi.parquet')").fetchone()
    n_rgint, = con.execute(f"SELECT COUNT(*) FROM read_parquet('{GEO}/centroides_rgint.parquet')").fetchone()
    n_uf, = con.execute(f"SELECT COUNT(*) FROM read_parquet('{GEO}/centroides_uf.parquet')").fetchone()
    assert (n_rgi, n_rgint, n_uf) == (510, 133, 27)
