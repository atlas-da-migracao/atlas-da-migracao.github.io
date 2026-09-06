"""Testes da F2: classificação, indicadores municipais, fluxos e revelação.

Só agregações; nenhum registro individual é lido ou impresso.
"""
import pathlib

import pytest

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
CLS = str(ROOT / "data/interim/pessoas_classificado.parquet")
MUN = str(ROOT / "data/interim/municipios_bruto.parquet")
FLU = str(ROOT / "data/interim/fluxos_bruto.parquet")
PUB = ROOT / "data/processed"


def _skip_se_ausente(*paths):
    for p in paths:
        if not pathlib.Path(p).exists():
            pytest.skip(f"{p} ainda não gerado (rode o pipeline)")


def test_flags_booleanas_sem_null(con):
    """df_local é NULL para quem mora há 6+ anos: as flags precisam ser FALSE, não NULL."""
    _skip_se_ausente(CLS)
    n, = con.execute(
        f"SELECT COUNT(*) FROM read_parquet('{CLS}') "
        f"WHERE is_migrante IS NULL OR is_mig_interno IS NULL OR origem_valida IS NULL"
    ).fetchone()
    assert n == 0


def test_nao_migrantes_sao_a_maioria(con):
    _skip_se_ausente(CLS)
    pop, = con.execute(f"SELECT SUM(peso) FROM read_parquet('{CLS}') WHERE NOT is_migrante").fetchone()
    assert 185e6 < pop < 195e6, "não migrantes devem somar ~190 milhões"


def test_status_cobre_todos_os_migrantes(con):
    _skip_se_ausente(CLS)
    n, = con.execute(
        f"SELECT COUNT(*) FROM read_parquet('{CLS}') WHERE is_migrante AND status IS NULL"
    ).fetchone()
    assert n == 0


def test_identidade_imigrantes_igual_emigrantes(con):
    _skip_se_ausente(MUN)
    i, e, s = con.execute(
        f"SELECT SUM(imig), SUM(emig), SUM(saldo) FROM read_parquet('{MUN}')"
    ).fetchone()
    assert abs(i - e) < 1
    assert abs(s) < 1


def test_todos_os_municipios_presentes(con):
    _skip_se_ausente(MUN)
    n, = con.execute(f"SELECT COUNT(*) FROM read_parquet('{MUN}')").fetchone()
    assert n == 5570


def test_fluxos_sem_autoloop_e_somam_a_imigracao(con):
    _skip_se_ausente(FLU, MUN)
    loops, total = con.execute(
        f"SELECT COUNT(*) FILTER (WHERE origem = destino), SUM(total) FROM read_parquet('{FLU}')"
    ).fetchone()
    imig, = con.execute(f"SELECT SUM(imig) FROM read_parquet('{MUN}')").fetchone()
    assert loops == 0
    assert abs(total - imig) < 1


def test_categorias_do_fluxo_reconciliam_com_o_total(con):
    _skip_se_ausente(FLU)
    t, st, ren, isx = con.execute(f"""
        SELECT SUM(total),
               SUM(st_retorno_natal + st_primeira_saida + st_etapas_multiplas + st_nascido_exterior),
               SUM(ren_ate_1_4 + ren_1_4_1_2 + ren_1_2_1 + ren_1_2 + ren_mais_2 + ren_na),
               SUM(is_05_14_m + is_05_14_f + is_15_24_m + is_15_24_f + is_25_39_m + is_25_39_f
                   + is_40_59_m + is_40_59_f + is_60_mais_m + is_60_mais_f + is_sexo_ign)
        FROM read_parquet('{FLU}')""").fetchone()
    assert abs(t - st) < 1 and abs(t - ren) < 1 and abs(t - isx) < 1


def test_cv_coerente_com_a_funcao_de_variancia_do_ibge(con):
    """Razão entre o CV estimado e o da FGV do IBGE deve ficar na mesma ordem de grandeza."""
    _skip_se_ausente(MUN)
    razao, = con.execute(f"""
        SELECT MEDIAN(cv_imig / (4.0616 * POWER(imig, -0.5004) * 100))
        FROM read_parquet('{MUN}') WHERE imig > 100 AND cv_imig IS NOT NULL""").fetchone()
    assert 0.5 <= razao <= 2.0


def test_seletividade_migratoria_positiva(con):
    """Migrantes de 25+ devem ter mais superior completo que os residentes não migrantes."""
    _skip_se_ausente(CLS)
    mig, res = con.execute(f"""
        SELECT 100.0 * SUM(peso) FILTER (WHERE edu_grupo='superior_completo' AND origem_valida)
                     / SUM(peso) FILTER (WHERE origem_valida),
               100.0 * SUM(peso) FILTER (WHERE edu_grupo='superior_completo' AND NOT is_migrante)
                     / SUM(peso) FILTER (WHERE NOT is_migrante)
        FROM read_parquet('{CLS}') WHERE idade >= 25""").fetchone()
    assert mig > res


def test_retorno_ao_natal_maior_no_nordeste(con):
    _skip_se_ausente(CLS)
    ne, br = con.execute(f"""
        SELECT 100.0 * SUM(peso) FILTER (WHERE status='retorno_natal'
                                         AND uf IN ('21','22','23','24','25','26','27','28','29'))
                     / SUM(peso) FILTER (WHERE uf IN ('21','22','23','24','25','26','27','28','29')),
               100.0 * SUM(peso) FILTER (WHERE status='retorno_natal') / SUM(peso)
        FROM read_parquet('{CLS}') WHERE origem_valida""").fetchone()
    assert ne > br


def test_arquivos_publicados_respeitam_o_limiar(con):
    """R1 verificada de forma independente sobre o que foi publicado."""
    _skip_se_ausente(CLS, str(PUB / "fluxos.parquet"))
    v, = con.execute(f"""
        WITH cel AS (
            SELECT df_mun AS origem, cd_mun AS destino, COUNT(*) n, COUNT(DISTINCT controle) ndom
            FROM read_parquet('{CLS}') WHERE origem_valida GROUP BY 1, 2
        )
        SELECT COUNT(*) FROM read_parquet('{PUB}/fluxos.parquet') p
        LEFT JOIN cel c ON c.origem = p.origem AND c.destino = p.destino
        WHERE c.n IS NULL OR c.n < 5 OR c.ndom < 3""").fetchone()
    assert v == 0


def test_publicados_nao_expoem_domicilio_nem_area_de_ponderacao(con):
    _skip_se_ausente(str(PUB / "fluxos.parquet"))
    proibidas = {"controle", "cd_apond", "apond", "d0100", "p0100", "d0090", "p0090"}
    for f in sorted(PUB.glob("*.parquet")):
        cols = {c.lower() for c in con.execute(f"SELECT * FROM read_parquet('{f}') LIMIT 0").df().columns}
        assert not (cols & proibidas), f"{f.name} expõe {cols & proibidas}"


def test_valores_publicados_em_multiplos_de_cinco(con):
    _skip_se_ausente(str(PUB / "fluxos.parquet"))
    v, = con.execute(
        f"SELECT COUNT(*) FROM read_parquet('{PUB}/fluxos.parquet') "
        f"WHERE ABS(total - ROUND(total/5.0)*5) > 1e-6").fetchone()
    assert v == 0
