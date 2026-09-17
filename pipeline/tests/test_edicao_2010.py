"""Testes de consistência da edição Censo 2010 (F1/F2/F2b/F3), equivalentes aos de 2022 em
test_f1_extract.py/test_f2_indicators.py/test_f2b_pendular.py, mas num arquivo à parte em vez
de parametrizar os existentes -- o vocabulário de `status` e os totais absolutos diferem o
bastante entre edições para que duplicar seja mais claro que parametrizar. Só agregações --
nunca linhas individuais. Skipa (não falha) se os arquivos da edição ainda não existem, para
não quebrar um clone sem os microdados de 2010.

Valores esperados confirmados na auditoria do checkpoint F2 (ver docs/METODOLOGIA.md, "Edição
Censo 2010 e comparabilidade") e na publicação F3 desta sessão.
"""
import pathlib
import sys

import pytest

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / "pipeline"))
import labels_2010  # noqa: E402
from edicoes import edicao as get_edicao  # noqa: E402

if not labels_2010.MUNICIPIOS_2010:
    # `data/raw2010` (fonte pública do IBGE, divisão territorial) não está disponível nesta
    # máquina -- CI e clones sem os microdados nunca têm esse symlink. Achado em produção
    # (2026-09-17): sem este guard, `import labels_2010` derruba a coleta do pytest inteira
    # (erro antes de qualquer `pytest.skip` rodar), o que quebrava o CI de publicação.
    pytest.skip("data/raw2010 indisponível nesta máquina -- rótulos do Censo 2010 não carregados", allow_module_level=True)

ED = get_edicao("2010")
INTERIM = ROOT / ED.interim
PROCESSED = ROOT / ED.processed


def _req(*paths: pathlib.Path) -> None:
    for p in paths:
        if not p.exists():
            pytest.skip(f"{p} ainda não gerado (rode `python pipeline/run.py --edicao 2010`)")


# ================= F1: extração =================

def test_total_pessoas(con):
    _req(INTERIM / "pessoas.parquet")
    n, = con.execute(f"SELECT COUNT(*) FROM read_parquet('{INTERIM}/pessoas.parquet')").fetchone()
    assert n == 20_635_472


def test_soma_pesos_nacional(con):
    _req(INTERIM / "pessoas.parquet")
    peso, = con.execute(f"SELECT SUM(peso) FROM read_parquet('{INTERIM}/pessoas.parquet')").fetchone()
    assert abs(peso - 190_755_799) < 100, "deve bater com a população total do Censo 2010 (IBGE)"


def test_27_ufs(con):
    _req(INTERIM / "pessoas.parquet")
    n, = con.execute(f"SELECT COUNT(DISTINCT uf) FROM read_parquet('{INTERIM}/pessoas.parquet')").fetchone()
    assert n == 27


def test_codigos_municipio_residencia_validos(con):
    _req(INTERIM / "pessoas.parquet")
    codigos = con.execute(f"SELECT DISTINCT cd_mun FROM read_parquet('{INTERIM}/pessoas.parquet')").fetchall()
    validos = set(labels_2010.MUNICIPIOS_2010.keys())
    fora = [c[0] for c in codigos if c[0] not in validos]
    assert fora == []
    assert len(codigos) == 5565


def test_join_pessoas_domicilios_completo(con):
    _req(INTERIM / "pessoas.parquet", INTERIM / "domicilios.parquet")
    row = con.execute(f"""
        SELECT (SELECT COUNT(*) FROM read_parquet('{INTERIM}/pessoas.parquet')) AS n_pessoas,
               (SELECT COUNT(*) FROM read_parquet('{INTERIM}/pessoas.parquet') p
                WHERE EXISTS (SELECT 1 FROM read_parquet('{INTERIM}/domicilios.parquet') d
                              WHERE d.controle = p.controle)) AS n_matched
    """).fetchone()
    assert row[0] == row[1]


def test_total_domicilios(con):
    _req(INTERIM / "domicilios.parquet")
    n, = con.execute(f"SELECT COUNT(*) FROM read_parquet('{INTERIM}/domicilios.parquet')").fetchone()
    assert n == 6_192_332


# ================= F2: indicadores e classificação =================

def test_flags_sem_null(con):
    _req(INTERIM / "pessoas_classificado.parquet")
    p = f"{INTERIM}/pessoas_classificado.parquet"
    row = con.execute(f"""
        SELECT COUNT(*) FILTER (WHERE is_migrante IS NULL),
               COUNT(*) FILTER (WHERE is_mig_interno IS NULL),
               COUNT(*) FILTER (WHERE is_mig_internacional IS NULL)
        FROM read_parquet('{p}')
    """).fetchone()
    assert row == (0, 0, 0)


def test_status_reconciliado_com_migrantes_internos(con):
    """As categorias de status (df_local='2') somam exatamente is_mig_interno -- vocabulário
    de 2010 é retorno_natal/nao_natural/nascido_exterior/origem_nao_informada/outro."""
    _req(INTERIM / "pessoas_classificado.parquet")
    p = f"{INTERIM}/pessoas_classificado.parquet"
    row = con.execute(f"""
        SELECT SUM(peso) FILTER (WHERE is_mig_interno),
               COUNT(*) FILTER (WHERE is_mig_interno AND status IS NULL)
        FROM read_parquet('{p}')
    """).fetchone()
    assert row[0] is not None and row[0] > 0
    assert row[1] == 0, "todo migrante interno deve ter status atribuído"


def test_identidade_imig_emig(con):
    _req(INTERIM / "municipios_bruto.parquet")
    p = f"{INTERIM}/municipios_bruto.parquet"
    imig, emig = con.execute(f"SELECT SUM(imig), SUM(emig) FROM read_parquet('{p}')").fetchone()
    assert abs(imig - emig) < 1
    assert abs(imig - 13_194_730) < 100


def test_todos_os_municipios_presentes(con):
    _req(INTERIM / "municipios_bruto.parquet")
    n, = con.execute(f"SELECT COUNT(*) FROM read_parquet('{INTERIM}/municipios_bruto.parquet')").fetchone()
    assert n == 5565


def test_sem_fluxo_com_origem_igual_destino(con):
    _req(INTERIM / "fluxos_bruto.parquet")
    n, = con.execute(f"SELECT COUNT(*) FROM read_parquet('{INTERIM}/fluxos_bruto.parquet') WHERE origem=destino").fetchone()
    assert n == 0


def test_categorias_do_fluxo_reconciliam_com_total(con):
    _req(INTERIM / "fluxos_bruto.parquet")
    p = f"{INTERIM}/fluxos_bruto.parquet"
    row = con.execute(f"""
        SELECT SUM(st_retorno_natal + st_nao_natural + st_nascido_exterior), SUM(total)
        FROM read_parquet('{p}')
    """).fetchone()
    assert abs(row[0] - row[1]) < 1


def test_cv_em_ordem_de_grandeza_plausivel(con):
    _req(INTERIM / "fluxos_bruto.parquet")
    p = f"{INTERIM}/fluxos_bruto.parquet"
    row = con.execute(f"SELECT MIN(cv), MAX(cv), AVG(cv) FROM read_parquet('{p}') WHERE cv IS NOT NULL").fetchone()
    assert 0 < row[0] < 100
    assert row[1] <= 100.0001
    assert 50 < row[2] < 100, "CV médio deve estar na mesma ordem de grandeza de 2022 (~86%)"


# ================= F2b: pendular =================

def test_pendular_saida_igual_entrada_trabalho(con):
    _req(INTERIM / "municipios_pendular_bruto.parquet")
    p = f"{INTERIM}/municipios_pendular_bruto.parquet"
    saida, entrada = con.execute(f"SELECT SUM(saida_trab), SUM(entrada_trab) FROM read_parquet('{p}')").fetchone()
    assert abs(saida - entrada) < 1


def test_tempo_pendular_vocabulario_2010(con):
    """As 5 faixas próprias de V0662 (+ 'nao_se_aplica'), não as 8 de 2022."""
    _req(INTERIM / "pendular_trab_dim_bruto.parquet")
    p = f"{INTERIM}/pendular_trab_dim_bruto.parquet"
    cats = {r[0] for r in con.execute(
        f"SELECT DISTINCT categoria FROM read_parquet('{p}') WHERE dimensao='tempo'").fetchall()}
    assert cats <= {"ate_5min", "de_6_a_30min", "de_31min_a_1h", "de_1_a_2h", "mais_de_2h", "nao_se_aplica"}


def test_dimensao_modo_ausente(con):
    """O Censo 2010 não tem meio de transporte -- a dimensão 'modo' não deve ser publicada."""
    _req(INTERIM / "pendular_trab_dim_bruto.parquet")
    p = f"{INTERIM}/pendular_trab_dim_bruto.parquet"
    n, = con.execute(f"SELECT COUNT(*) FROM read_parquet('{p}') WHERE dimensao='modo'").fetchone()
    assert n == 0


# ================= F3: publicação e gate =================

def test_rm_resumo_publicado(con):
    """rm_resumo.parquet existe com 81 RMs (recorte 2022 retroativo em 2010)."""
    _req(PROCESSED / "rm_resumo.parquet")
    n, = con.execute(f"SELECT COUNT(*) FROM read_parquet('{PROCESSED}/rm_resumo.parquet')").fetchone()
    assert n == 81


def test_rm_resumo_tipos(con):
    """Todas as RMs têm tipo 'RM' ou 'RIDE'."""
    _req(PROCESSED / "rm_resumo.parquet")
    v, = con.execute(f"""
        SELECT COUNT(*) FROM read_parquet('{PROCESSED}/rm_resumo.parquet')
        WHERE tipo NOT IN ('RM', 'RIDE')""").fetchone()
    assert v == 0


def test_rm_nucleo_unico_por_rm(con):
    """Exatamente 1 linha com nucleo=true por cd_rm."""
    _req(PROCESSED / "rm.parquet")
    v, = con.execute(f"""
        SELECT COUNT(*) FROM (
            SELECT cd_rm, COUNT(*) FILTER (WHERE nucleo) k
            FROM read_parquet('{PROCESSED}/rm.parquet') GROUP BY cd_rm
        ) WHERE k <> 1""").fetchone()
    assert v == 0


def test_rm_municipio_em_uma_so_rm(con):
    """Nenhum cd_mun em mais de um cd_rm."""
    _req(PROCESSED / "rm.parquet")
    v, = con.execute(f"""
        SELECT COUNT(*) FROM (
            SELECT cd_mun, COUNT(DISTINCT cd_rm) k FROM read_parquet('{PROCESSED}/rm.parquet')
            GROUP BY cd_mun) WHERE k > 1""").fetchone()
    assert v == 0


def test_rm_conta_municipios_coerente(con):
    """COUNT(*) de rm.parquet = SUM(n_municipios) de rm_resumo = COUNT FILTER cd_rm IS NOT NULL de municipios.parquet."""
    _req(PROCESSED / "rm.parquet", PROCESSED / "rm_resumo.parquet", PROCESSED / "municipios.parquet")
    rm_count, = con.execute(f"SELECT COUNT(*) FROM read_parquet('{PROCESSED}/rm.parquet')").fetchone()
    resumo_sum, = con.execute(f"SELECT SUM(n_municipios) FROM read_parquet('{PROCESSED}/rm_resumo.parquet')").fetchone()
    mun_count, = con.execute(f"SELECT COUNT(*) FROM read_parquet('{PROCESSED}/municipios.parquet') WHERE cd_rm IS NOT NULL").fetchone()
    assert rm_count == resumo_sum == mun_count


def test_rm_menos_de_1388_municipios(con):
    """COUNT(*) de rm.parquet < 1388 (5 de 2013 não existem em 2010)."""
    _req(PROCESSED / "rm.parquet")
    n, = con.execute(f"SELECT COUNT(*) FROM read_parquet('{PROCESSED}/rm.parquet')").fetchone()
    assert n < 1388


def test_rm_resumo_sem_meio_transporte_2010(con):
    """pct_coletivo e tempo_mediano sempre NULL em 2010."""
    _req(PROCESSED / "rm_resumo.parquet")
    v, = con.execute(f"""
        SELECT COUNT(*) FROM read_parquet('{PROCESSED}/rm_resumo.parquet')
        WHERE pct_coletivo IS NOT NULL OR tempo_mediano IS NOT NULL""").fetchone()
    assert v == 0


def test_rm_mig_pendular_sem_pct_coletivo_2010(con):
    """pct_coletivo sempre NULL em rm_mig_pendular em 2010."""
    _req(PROCESSED / "rm_mig_pendular.parquet")
    v, = con.execute(f"SELECT COUNT(pct_coletivo) FROM read_parquet('{PROCESSED}/rm_mig_pendular.parquet')").fetchone()
    assert v == 0


def test_rm_nucleos_existem(con):
    """Todos os cd_nucleo de pipeline/rm_nucleo.csv aparecem em rm.parquet com nucleo=true."""
    _req(PROCESSED / "rm.parquet", ROOT / "pipeline" / "rm_nucleo.csv")
    nucleos = con.execute(f"SELECT DISTINCT cd_nucleo, cd_rm FROM read_csv('{ROOT}/pipeline/rm_nucleo.csv', all_varchar=true) ORDER BY cd_rm").fetchall()
    for cd_nucleo, cd_rm in nucleos:
        n, = con.execute(f"""
            SELECT COUNT(*) FROM read_parquet('{PROCESSED}/rm.parquet')
            WHERE cd_mun = '{cd_nucleo}' AND nucleo = true AND cd_rm = '{cd_rm}'""").fetchone()
        assert n >= 1, f"cd_nucleo {cd_nucleo} (RM {cd_rm}) não encontrado ou sem nucleo=true"


def test_rm_interim_fluxos_intra_soma(con):
    """Σ rm_fluxos_intra_bruto.total = Σ rm_resumo_bruto.mig_intra (tolerância 5)."""
    _req(INTERIM / "rm_fluxos_intra_bruto.parquet", INTERIM / "rm_resumo_bruto.parquet")
    t, = con.execute(f"SELECT SUM(total) FROM read_parquet('{INTERIM}/rm_fluxos_intra_bruto.parquet')").fetchone()
    r, = con.execute(f"SELECT SUM(mig_intra) FROM read_parquet('{INTERIM}/rm_resumo_bruto.parquet')").fetchone()
    assert abs(t - r) < 5


def test_rm_interim_pendular_soma(con):
    """Σ rm_mig_pendular_bruto.total = Σ rm_mig_pendular_resumo_bruto.mig_ocupados (tolerância 1)."""
    _req(INTERIM / "rm_mig_pendular_bruto.parquet", INTERIM / "rm_mig_pendular_resumo_bruto.parquet")
    t, = con.execute(f"SELECT SUM(total) FROM read_parquet('{INTERIM}/rm_mig_pendular_bruto.parquet')").fetchone()
    o, = con.execute(f"SELECT SUM(mig_ocupados) FROM read_parquet('{INTERIM}/rm_mig_pendular_resumo_bruto.parquet')").fetchone()
    assert abs(t - o) < 1


def test_rm_interim_classe_origem_coerente(con):
    """0 linhas com classe_trab='origem' E destino_trab IS DISTINCT FROM origem_mig."""
    _req(INTERIM / "rm_mig_pendular_bruto.parquet")
    v, = con.execute(f"""
        SELECT COUNT(*) FROM read_parquet('{INTERIM}/rm_mig_pendular_bruto.parquet')
        WHERE classe_trab = 'origem' AND destino_trab IS DISTINCT FROM origem_mig""").fetchone()
    assert v == 0


def test_gate_ok_existe_e_e_valido():
    _req(PROCESSED / ".gate_ok")
    import json
    carimbo = json.loads((PROCESSED / ".gate_ok").read_text(encoding="utf-8"))
    assert carimbo["arquivos"]
    assert "2010/municipios.parquet" not in carimbo["arquivos"], "caminhos no carimbo são relativos à própria PROCESSED"


def test_verify_gate_aprova(con):
    _req(PROCESSED / ".gate_ok")
    import verify_gate
    assert verify_gate.Verificador(PROCESSED).rodar() == 0
