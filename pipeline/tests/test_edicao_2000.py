"""Testes de consistência da edição Censo 2000 (F1/F2/F2b/F3), equivalentes aos de
test_edicao_2010.py, num arquivo à parte em vez de parametrizar os existentes -- o
vocabulário de `status`/pendular e os totais absolutos diferem o bastante entre edições
para que duplicar seja mais claro que parametrizar. Só agregações -- nunca linhas
individuais. Skipa (não falha) se os arquivos da edição ainda não existem, para não
quebrar um clone sem os microdados de 2000.

Valores esperados confirmados rodando o pipeline completo e conferindo agregações no
checkpoint do auditor em 2026-09-14 (ver docs/METODOLOGIA.md e
docs/relatorio_revelacao_2000_1.0.0-2000.md).
"""
import pathlib
import sys

import pytest

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / "pipeline"))
import labels_2000  # noqa: E402
from edicoes import edicao as get_edicao  # noqa: E402

ED = get_edicao("2000")
INTERIM = ROOT / ED.interim
PROCESSED = ROOT / ED.processed


def _req(*paths: pathlib.Path) -> None:
    for p in paths:
        if not p.exists():
            pytest.skip(f"{p} ainda não gerado (rode `python pipeline/run.py --edicao 2000`)")


# ================= F1: extração =================

def test_total_pessoas(con):
    _req(INTERIM / "pessoas.parquet")
    n, = con.execute(f"SELECT COUNT(*) FROM read_parquet('{INTERIM}/pessoas.parquet')").fetchone()
    assert n == 20_274_412


def test_soma_pesos_nacional(con):
    _req(INTERIM / "pessoas.parquet")
    peso, = con.execute(f"SELECT SUM(peso) FROM read_parquet('{INTERIM}/pessoas.parquet')").fetchone()
    assert abs(peso - 169_872_856) < 200_000, "deve bater com a população total do Censo 2000 (IBGE)"


def test_27_ufs(con):
    _req(INTERIM / "pessoas.parquet")
    n, = con.execute(f"SELECT COUNT(DISTINCT uf) FROM read_parquet('{INTERIM}/pessoas.parquet')").fetchone()
    assert n == 27


def test_codigos_municipio_bruto_validos(con):
    """Todos os cd_mun de municipios_bruto.parquet existem em labels_2000.MUNICIPIOS_2000."""
    _req(INTERIM / "municipios_bruto.parquet")
    codigos = con.execute(f"SELECT DISTINCT cd_mun FROM read_parquet('{INTERIM}/municipios_bruto.parquet')").fetchall()
    validos = set(labels_2000.MUNICIPIOS_2000.keys())
    fora = [c[0] for c in codigos if c[0] not in validos]
    assert fora == []
    assert len(codigos) == 5507


def test_codigos_municipio_processed_validos(con):
    """Todos os cd_mun de municipios.parquet (publicado) existem em labels_2000.MUNICIPIOS_2000."""
    _req(PROCESSED / "municipios.parquet")
    codigos = con.execute(f"SELECT DISTINCT cd_mun FROM read_parquet('{PROCESSED}/municipios.parquet')").fetchall()
    validos = set(labels_2000.MUNICIPIOS_2000.keys())
    fora = [c[0] for c in codigos if c[0] not in validos]
    assert fora == []
    assert len(codigos) == 5507


def test_total_domicilios(con):
    _req(INTERIM / "domicilios.parquet")
    n, = con.execute(f"SELECT COUNT(*) FROM read_parquet('{INTERIM}/domicilios.parquet')").fetchone()
    assert n == 5_304_711


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


def test_mig_interno_implica_status_nao_null(con):
    _req(INTERIM / "pessoas_classificado.parquet")
    p = f"{INTERIM}/pessoas_classificado.parquet"
    n, = con.execute(f"""
        SELECT COUNT(*) FILTER (WHERE is_mig_interno AND status IS NULL)
        FROM read_parquet('{p}')
    """).fetchone()
    assert n == 0, "todo migrante interno deve ter status atribuído"


def test_identidade_imig_emig(con):
    """Σimig ≈ Σemig -- tolerância generosa por resíduo de arredondamento já documentado
    pelo metodólogo (na prática, o resíduo observado é de fração de pessoa, muito abaixo
    da tolerância)."""
    _req(INTERIM / "municipios_bruto.parquet")
    p = f"{INTERIM}/municipios_bruto.parquet"
    imig, emig = con.execute(f"SELECT SUM(imig), SUM(emig) FROM read_parquet('{p}')").fetchone()
    assert abs(imig - emig) < 1000
    assert abs(imig - 14_570_932) < 1000


def test_todos_os_municipios_presentes(con):
    _req(INTERIM / "municipios_bruto.parquet")
    n, = con.execute(f"SELECT COUNT(*) FROM read_parquet('{INTERIM}/municipios_bruto.parquet')").fetchone()
    assert n == 5507


def test_sem_fluxo_com_origem_igual_destino(con):
    _req(INTERIM / "fluxos_bruto.parquet")
    n, = con.execute(f"SELECT COUNT(*) FROM read_parquet('{INTERIM}/fluxos_bruto.parquet') WHERE origem=destino").fetchone()
    assert n == 0


def test_categorias_do_fluxo_reconciliam_com_total(con):
    """status__retorno_natal + status__nao_natural + status__nascido_exterior = total."""
    _req(INTERIM / "fluxos_bruto.parquet")
    p = f"{INTERIM}/fluxos_bruto.parquet"
    row = con.execute(f"""
        SELECT SUM(st_retorno_natal + st_nao_natural + st_nascido_exterior), SUM(total)
        FROM read_parquet('{p}')
    """).fetchone()
    assert abs(row[0] - row[1]) < 1


# ================= F2b: pendular =================

def test_pendular_trab_estudo_mutuamente_exclusivos(con):
    """Decisão da edição 2000: universos de pendular_trab e pendular_estudo são disjuntos."""
    _req(INTERIM / "pessoas_classificado.parquet")
    p = f"{INTERIM}/pessoas_classificado.parquet"
    n, = con.execute(f"""
        SELECT COUNT(*) FILTER (WHERE pendular_trab AND pendular_estudo)
        FROM read_parquet('{p}')
    """).fetchone()
    assert n == 0


def test_pendular_saida_igual_entrada_trabalho(con):
    _req(INTERIM / "municipios_pendular_bruto.parquet")
    p = f"{INTERIM}/municipios_pendular_bruto.parquet"
    saida, entrada = con.execute(f"SELECT SUM(saida_trab), SUM(entrada_trab) FROM read_parquet('{p}')").fetchone()
    assert abs(saida - entrada) < 1


def test_pendular_saida_igual_entrada_estudo(con):
    _req(INTERIM / "municipios_pendular_bruto.parquet")
    p = f"{INTERIM}/municipios_pendular_bruto.parquet"
    saida, entrada = con.execute(f"SELECT SUM(saida_estudo), SUM(entrada_estudo) FROM read_parquet('{p}')").fetchone()
    assert abs(saida - entrada) < 1


def test_pendular_trab_dim_vocabulario_2000(con):
    """Sem modo/frequencia/tempo -- nenhum desses quesitos existe no Censo 2000."""
    _req(INTERIM / "pendular_trab_dim_bruto.parquet")
    p = f"{INTERIM}/pendular_trab_dim_bruto.parquet"
    cats = {r[0] for r in con.execute(f"SELECT DISTINCT dimensao FROM read_parquet('{p}')").fetchall()}
    assert cats == {"posicao", "setor", "ocupacao", "renda_trab", "edu", "idade_sexo"}


def test_municipios_pendular_sem_varios_municipios(con):
    _req(PROCESSED / "municipios_pendular.parquet")
    v, = con.execute(f"SELECT SUM(varios_municipios) FROM read_parquet('{PROCESSED}/municipios_pendular.parquet')").fetchone()
    assert v == 0


# ================= F3: publicação e gate =================

def test_rm_e_rm_resumo_existem(con):
    _req(PROCESSED / "rm.parquet", PROCESSED / "rm_resumo.parquet")
    n_rm, = con.execute(f"SELECT COUNT(*) FROM read_parquet('{PROCESSED}/rm.parquet')").fetchone()
    n_resumo, = con.execute(f"SELECT COUNT(*) FROM read_parquet('{PROCESSED}/rm_resumo.parquet')").fetchone()
    assert n_rm > 0
    assert n_resumo == 81


def test_rm_nucleo_unico_por_rm(con):
    """Exatamente 1 linha com nucleo=true por cd_rm."""
    _req(PROCESSED / "rm.parquet")
    v, = con.execute(f"""
        SELECT COUNT(*) FROM (
            SELECT cd_rm, COUNT(*) FILTER (WHERE nucleo) k
            FROM read_parquet('{PROCESSED}/rm.parquet') GROUP BY cd_rm
        ) WHERE k <> 1""").fetchone()
    assert v == 0


def test_rm_resumo_sem_meio_transporte_2000(con):
    """pct_coletivo, tempo_mediano e pct_diario sempre NULL em 2000 -- nenhum quesito
    pendular de meio de transporte, frequência ou tempo de deslocamento existe nesse censo."""
    _req(PROCESSED / "rm_resumo.parquet")
    v, = con.execute(f"""
        SELECT COUNT(*) FROM read_parquet('{PROCESSED}/rm_resumo.parquet')
        WHERE pct_coletivo IS NOT NULL OR tempo_mediano IS NOT NULL OR pct_diario IS NOT NULL""").fetchone()
    assert v == 0


def test_rm_mig_pendular_sem_pct_coletivo_pct_diario_2000(con):
    """pct_coletivo e pct_diario sempre NULL em rm_mig_pendular em 2000."""
    _req(PROCESSED / "rm_mig_pendular.parquet")
    v, = con.execute(f"""
        SELECT COUNT(*) FROM read_parquet('{PROCESSED}/rm_mig_pendular.parquet')
        WHERE pct_coletivo IS NOT NULL OR pct_diario IS NOT NULL""").fetchone()
    assert v == 0


def test_gate_ok_existe_e_e_valido():
    _req(PROCESSED / ".gate_ok")
    import json
    carimbo = json.loads((PROCESSED / ".gate_ok").read_text(encoding="utf-8"))
    assert carimbo["arquivos"]
    # 1.0.1-2000: F9.10 -- correção de geometria da malha (geo/build.sh passou a validar cada
    # TopoJSON publicado, ST_IsValid + triangulação earcut, com reparo dirigido quando
    # necessário; ver pipeline/validate_geo.py). Só os arquivos de geo/ (topojson, centroides)
    # e o meta.json mudaram.
    assert carimbo["versao_dados"] == "1.0.1-2000"
    assert "2000/municipios.parquet" not in carimbo["arquivos"], "caminhos no carimbo são relativos à própria PROCESSED"


def test_verify_gate_aprova(con):
    _req(PROCESSED / ".gate_ok")
    import verify_gate
    assert verify_gate.Verificador(PROCESSED).rodar() == 0
