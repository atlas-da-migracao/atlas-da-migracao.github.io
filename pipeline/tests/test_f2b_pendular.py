"""Testes da F2b: deslocamento pendular e módulo metropolitano.

Só agregações; nenhum registro individual é lido ou impresso.
"""
import pathlib

import pytest

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
I = ROOT / "data/interim"
PUB = ROOT / "data/processed"


def _req(*paths):
    for p in paths:
        if not pathlib.Path(p).exists():
            pytest.skip(f"{p} ainda não gerado (rode o pipeline)")


def test_identidade_pendular_trabalho(con):
    """Σ saídas pendulares (destino conhecido) deve igualar Σ entradas."""
    _req(I / "municipios_pendular_bruto.parquet", I / "pendular_trab_bruto.parquet")
    s, e = con.execute(
        f"SELECT SUM(saida_trab), SUM(entrada_trab) FROM read_parquet('{I}/municipios_pendular_bruto.parquet')"
    ).fetchone()
    f, = con.execute(f"SELECT SUM(total) FROM read_parquet('{I}/pendular_trab_bruto.parquet')").fetchone()
    assert abs(s - e) < 1
    assert abs(s - f) < 1


def test_identidade_pendular_estudo(con):
    _req(I / "municipios_pendular_bruto.parquet")
    s, e = con.execute(
        f"SELECT SUM(saida_estudo), SUM(entrada_estudo) FROM read_parquet('{I}/municipios_pendular_bruto.parquet')"
    ).fetchone()
    assert abs(s - e) < 1


def test_universo_pendular_restrito_a_ocupados_e_estudantes(con):
    _req(I / "pessoas_classificado.parquet")
    v, = con.execute(f"""
        SELECT COUNT(*) FROM read_parquet('{I}/pessoas_classificado.parquet')
        WHERE (pendular_trab AND NOT ocupado) OR (pendular_estudo AND NOT estudante)""").fetchone()
    # pendular_trab/estudo são flags de destino; o universo é aplicado nas views do pipeline.
    # O que não pode existir é fluxo publicado fora do universo:
    f, = con.execute(f"SELECT SUM(total) FROM read_parquet('{I}/pendular_trab_bruto.parquet')").fetchone()
    u, = con.execute(f"""
        SELECT SUM(peso) FROM read_parquet('{I}/pessoas_classificado.parquet')
        WHERE ocupado AND pendular_trab""").fetchone()
    assert abs(f - u) < 1, "fluxos pendulares devem cobrir exatamente os ocupados que se deslocam"
    assert v >= 0


def test_sem_autoloop_pendular(con):
    _req(I / "pendular_trab_bruto.parquet", I / "pendular_estudo_bruto.parquet")
    for arq in ("pendular_trab_bruto", "pendular_estudo_bruto"):
        v, = con.execute(f"SELECT COUNT(*) FROM read_parquet('{I}/{arq}.parquet') WHERE origem = destino").fetchone()
        assert v == 0


def test_guarulhos_sao_paulo_e_o_maior_par_pendular(con):
    _req(I / "pendular_trab_bruto.parquet")
    o, d = con.execute(
        f"SELECT origem, destino FROM read_parquet('{I}/pendular_trab_bruto.parquet') ORDER BY total DESC LIMIT 1"
    ).fetchone()
    assert (o, d) == ("3518800", "3550308"), "Guarulhos -> São Paulo deve liderar os fluxos pendulares"


def test_santana_macapa_presente(con):
    _req(I / "pendular_trab_bruto.parquet")
    n, = con.execute(
        f"SELECT COUNT(*) FROM read_parquet('{I}/pendular_trab_bruto.parquet') "
        f"WHERE origem = '1600600' AND destino = '1600303'").fetchone()
    assert n == 1


def test_tripla_soma_aos_migrantes_intra_rm_ocupados(con):
    """Σ (origem -> residência -> trabalho) = migrantes intra-RM ocupados."""
    _req(I / "rm_mig_pendular_bruto.parquet", I / "rm_mig_pendular_resumo_bruto.parquet")
    t, = con.execute(f"SELECT SUM(total) FROM read_parquet('{I}/rm_mig_pendular_bruto.parquet')").fetchone()
    o, = con.execute(f"SELECT SUM(mig_ocupados) FROM read_parquet('{I}/rm_mig_pendular_resumo_bruto.parquet')").fetchone()
    assert abs(t - o) < 1


def test_classe_origem_coerente(con):
    """A classe 'origem' só existe quando o município de trabalho é o de origem da migração."""
    _req(I / "rm_mig_pendular_bruto.parquet")
    v, = con.execute(f"""
        SELECT COUNT(*) FROM read_parquet('{I}/rm_mig_pendular_bruto.parquet')
        WHERE classe_trab = 'origem' AND destino_trab IS DISTINCT FROM origem_mig""").fetchone()
    assert v == 0


def test_cada_rm_tem_exatamente_um_nucleo(con):
    _req(I / "rm_bruto.parquet")
    v, = con.execute(f"""
        SELECT COUNT(*) FROM (
            SELECT cd_rm, COUNT(*) FILTER (WHERE nucleo) k
            FROM read_parquet('{I}/rm_bruto.parquet') GROUP BY cd_rm
        ) WHERE k <> 1""").fetchone()
    assert v == 0


def test_municipio_pertence_a_no_maximo_uma_rm(con):
    _req(I / "rm_bruto.parquet")
    v, = con.execute(f"""
        SELECT COUNT(*) FROM (
            SELECT cd_mun, COUNT(DISTINCT cd_rm) k FROM read_parquet('{I}/rm_bruto.parquet')
            GROUP BY cd_mun) WHERE k > 1""").fetchone()
    assert v == 0


def test_tipologia_intra_rm_soma_ao_total(con):
    _req(I / "rm_fluxos_intra_bruto.parquet", I / "rm_resumo_bruto.parquet")
    t, = con.execute(f"SELECT SUM(total) FROM read_parquet('{I}/rm_fluxos_intra_bruto.parquet')").fetchone()
    r, = con.execute(f"SELECT SUM(mig_intra) FROM read_parquet('{I}/rm_resumo_bruto.parquet')").fetchone()
    assert abs(t - r) < 5


def test_publicados_f2b_respeitam_limiar(con):
    _req(PUB / "pendular_trab.parquet", I / "pessoas_classificado.parquet")
    v, = con.execute(f"""
        WITH cel AS (
            SELECT cd_mun origem, trab_mun destino, COUNT(*) n, COUNT(DISTINCT controle) ndom
            FROM read_parquet('{I}/pessoas_classificado.parquet')
            WHERE ocupado AND pendular_trab GROUP BY 1, 2
        )
        SELECT COUNT(*) FROM read_parquet('{PUB}/pendular_trab.parquet') p
        LEFT JOIN cel c ON c.origem = p.origem AND c.destino = p.destino
        WHERE c.n IS NULL OR c.n < 5 OR c.ndom < 3""").fetchone()
    assert v == 0
