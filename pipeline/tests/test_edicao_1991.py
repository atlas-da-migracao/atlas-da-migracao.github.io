"""Testes de consistência da edição Censo 1991 (F1/F2/F3), equivalentes aos de
test_edicao_2000.py -- num arquivo à parte em vez de parametrizar os existentes, pelo
mesmo motivo (vocabulário de `status` e totais absolutos diferem entre edições). Só
agregações -- nunca linhas individuais. Skipa (não falha) se os arquivos da edição ainda
não existem, para não quebrar um clone sem os microdados de 1991.

Particularidades de 1991 em relação a 2000/2010/2022:
  - Sem quesito de deslocamento pendular no questionário -- `ed.pendular=False`, portanto
    NENHUMA das 8 tabelas pendulares (`*pendular*`, `rm_mig_pendular*`, `rm_mig_estudo*`)
    é publicada em data/processed/1991 (diferente de 2000, que publica as tabelas mas com
    frequencia/modo/tempo NULL).
  - `cd_apond` é `cd_mun || 'U'/'R'` (situação urbano/rural), não uma área de ponderação
    numérica como em 2000/2010.
  - `rm_resumo` tem as 6 colunas do módulo pendular (ocupados, pendulares, pct_pendular,
    tempo_mediano, pct_coletivo, pct_diario) sempre NULL, tipo DOUBLE.

Valores confirmados rodando o pipeline completo em 2026-09-15 (ver
docs/relatorio_revelacao_1991_1.0.0-1991.md).
"""
import pathlib
import sys

import pytest

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / "pipeline"))
import labels_1991  # noqa: E402
from edicoes import edicao as get_edicao  # noqa: E402

ED = get_edicao("1991")
INTERIM = ROOT / ED.interim
PROCESSED = ROOT / ED.processed


def _req(*paths: pathlib.Path) -> None:
    for p in paths:
        if not p.exists():
            pytest.skip(f"{p} ainda não gerado (rode `python pipeline/run.py --edicao 1991`)")


# ================= F1: extração =================

def test_total_pessoas(con):
    _req(INTERIM / "pessoas.parquet")
    n, = con.execute(f"SELECT COUNT(*) FROM read_parquet('{INTERIM}/pessoas.parquet')").fetchone()
    assert n == 17_045_712


def test_soma_pesos_nacional(con):
    _req(INTERIM / "pessoas.parquet")
    peso, = con.execute(f"SELECT SUM(peso) FROM read_parquet('{INTERIM}/pessoas.parquet')").fetchone()
    assert abs(peso - 146_815_790) < 200_000, "deve bater com a população total do Censo 1991 (IBGE)"


def test_27_ufs(con):
    _req(INTERIM / "pessoas.parquet")
    n, = con.execute(f"SELECT COUNT(DISTINCT uf) FROM read_parquet('{INTERIM}/pessoas.parquet')").fetchone()
    assert n == 27


def test_codigos_municipio_bruto_validos(con):
    """Todos os cd_mun de municipios_bruto.parquet existem em labels_1991.MUNICIPIOS_1991."""
    _req(INTERIM / "municipios_bruto.parquet")
    codigos = con.execute(f"SELECT DISTINCT cd_mun FROM read_parquet('{INTERIM}/municipios_bruto.parquet')").fetchall()
    validos = set(labels_1991.MUNICIPIOS_1991.keys())
    fora = [c[0] for c in codigos if c[0] not in validos]
    assert fora == []
    assert len(codigos) == 4491


def test_codigos_municipio_processed_validos(con):
    """Todos os cd_mun de municipios.parquet (publicado) existem em labels_1991.MUNICIPIOS_1991."""
    _req(PROCESSED / "municipios.parquet")
    codigos = con.execute(f"SELECT DISTINCT cd_mun FROM read_parquet('{PROCESSED}/municipios.parquet')").fetchall()
    validos = set(labels_1991.MUNICIPIOS_1991.keys())
    fora = [c[0] for c in codigos if c[0] not in validos]
    assert fora == []
    assert len(codigos) == 4491


def test_cd_apond_formato_situacao_urbano_rural(con):
    """Em 1991 cd_apond é cd_mun || 'U'/'R' (situação de domicílio), não área de
    ponderação numérica como em 2000/2010 -- decisão documentada em
    pipeline/sql/1991/MAPEAMENTO_02_classify.md."""
    _req(INTERIM / "pessoas_classificado.parquet")
    p = f"{INTERIM}/pessoas_classificado.parquet"
    sufixos = {r[0] for r in con.execute(f"SELECT DISTINCT RIGHT(cd_apond, 1) FROM read_parquet('{p}')").fetchall()}
    assert sufixos <= {"U", "R"}
    prefixos_ok, = con.execute(
        f"SELECT COUNT(*) FILTER (WHERE LEFT(cd_apond, LENGTH(cd_apond) - 1) <> cd_mun) FROM read_parquet('{p}')"
    ).fetchone()
    assert prefixos_ok == 0, "prefixo de cd_apond deve ser exatamente cd_mun"


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


def test_sem_pendular_classificado(con):
    """1991 não tem quesito de deslocamento pendular -- pendular_trab/pendular_estudo
    devem ser sempre falsos em pessoas_classificado.parquet."""
    _req(INTERIM / "pessoas_classificado.parquet")
    p = f"{INTERIM}/pessoas_classificado.parquet"
    n, = con.execute(f"""
        SELECT COUNT(*) FILTER (WHERE pendular_trab OR pendular_estudo)
        FROM read_parquet('{p}')
    """).fetchone()
    assert n == 0


def test_identidade_imig_emig(con):
    """Σimig ≈ Σemig -- tolerância generosa por resíduo de arredondamento já documentado
    pelo metodólogo (na prática, o resíduo observado é de fração de pessoa, muito abaixo
    da tolerância)."""
    _req(INTERIM / "municipios_bruto.parquet")
    p = f"{INTERIM}/municipios_bruto.parquet"
    imig, emig = con.execute(f"SELECT SUM(imig), SUM(emig) FROM read_parquet('{p}')").fetchone()
    assert abs(imig - emig) < 1000
    assert abs(imig - 13_456_008) < 1000


def test_todos_os_municipios_presentes(con):
    _req(INTERIM / "municipios_bruto.parquet")
    n, = con.execute(f"SELECT COUNT(*) FROM read_parquet('{INTERIM}/municipios_bruto.parquet')").fetchone()
    assert n == 4491


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


# ================= F3: publicação e gate =================

def test_nenhuma_tabela_pendular_publicada():
    """1991 não tem quesito de deslocamento pendular: nenhum dos 8 arquivos pendulares
    (pendular_*, rm_mig_pendular*, rm_mig_estudo*) deve existir em data/processed/1991,
    ao contrário de 2000/2010/2022 (que publicam mesmo sem alguma dimensão)."""
    _req(PROCESSED / "municipios.parquet")
    proibidos = [
        "municipios_pendular.parquet",
        "pendular_trab_dim.parquet",
        "pendular_estudo_dim.parquet",
        "rm_mig_pendular.parquet",
        "rm_mig_pendular_trab_dim.parquet",
        "rm_mig_estudo.parquet",
        "rm_mig_estudo_dim.parquet",
        "rm_pendular_fluxos_intra.parquet",
    ]
    existentes = [nome for nome in proibidos if (PROCESSED / nome).exists()]
    assert existentes == [], f"tabelas pendulares não deveriam existir em 1991: {existentes}"

    outros_pendular = sorted(
        p.name for p in PROCESSED.glob("*pendular*")
    ) + sorted(p.name for p in PROCESSED.glob("rm_mig_*"))
    assert outros_pendular == [], f"arquivos pendulares inesperados em 1991: {outros_pendular}"


def test_rm_e_rm_resumo_existem(con):
    _req(PROCESSED / "rm.parquet", PROCESSED / "rm_resumo.parquet")
    n_rm, = con.execute(f"SELECT COUNT(*) FROM read_parquet('{PROCESSED}/rm.parquet')").fetchone()
    n_resumo, = con.execute(f"SELECT COUNT(*) FROM read_parquet('{PROCESSED}/rm_resumo.parquet')").fetchone()
    assert n_rm > 0
    assert n_resumo == 81


def test_rm_nucleo_unico_por_rm(con):
    """Exatamente 1 linha com nucleo=true por cd_rm, nas 81 RMs -- inclusive a RM 501
    (Rorainópolis), cujo núcleo em 1991 vem do fallback de mais populoso (ver
    pipeline/sql/1991/08_metro.sql)."""
    _req(PROCESSED / "rm.parquet")
    v, = con.execute(f"""
        SELECT COUNT(*) FROM (
            SELECT cd_rm, COUNT(*) FILTER (WHERE nucleo) k
            FROM read_parquet('{PROCESSED}/rm.parquet') GROUP BY cd_rm
        ) WHERE k <> 1""").fetchone()
    assert v == 0
    n_rm_distintas, = con.execute(f"SELECT COUNT(DISTINCT cd_rm) FROM read_parquet('{PROCESSED}/rm.parquet')").fetchone()
    assert n_rm_distintas == 81


def test_rm_501_nucleo_fallback_rorainopolis(con):
    """Âncora específica de 1991: RM 501 não tem homônimo direto no CSV compartilhado
    (pipeline/rm_nucleo.csv) e usa o fallback de município mais populoso, que resulta em
    Rorainópolis (cd_mun 1400506) -- diferente da âncora esperada para outras edições."""
    _req(PROCESSED / "rm.parquet")
    row = con.execute(f"""
        SELECT cd_mun, nm_mun FROM read_parquet('{PROCESSED}/rm.parquet')
        WHERE cd_rm = '501' AND nucleo
    """).fetchone()
    assert row is not None
    assert row[0] == "1400506"


def test_rm_resumo_sem_colunas_pendulares_1991(con):
    """As 6 colunas do módulo pendular (ocupados, pendulares, pct_pendular, tempo_mediano,
    pct_coletivo, pct_diario) devem ser DOUBLE e sempre NULL em 1991 -- questionário sem
    quesito de deslocamento."""
    _req(PROCESSED / "rm_resumo.parquet")
    p = f"{PROCESSED}/rm_resumo.parquet"
    tipos = {nome: tipo for nome, tipo, *_ in con.execute(f"DESCRIBE SELECT * FROM read_parquet('{p}')").fetchall()}
    colunas = ["ocupados", "pendulares", "pct_pendular", "tempo_mediano", "pct_coletivo", "pct_diario"]
    for col in colunas:
        assert tipos[col] == "DOUBLE", f"{col} deveria ser DOUBLE, é {tipos[col]}"
    v, = con.execute(f"""
        SELECT COUNT(*) FROM read_parquet('{p}')
        WHERE ocupados IS NOT NULL OR pendulares IS NOT NULL OR pct_pendular IS NOT NULL
           OR tempo_mediano IS NOT NULL OR pct_coletivo IS NOT NULL OR pct_diario IS NOT NULL
    """).fetchone()
    assert v == 0


def test_gate_ok_existe_e_e_valido():
    _req(PROCESSED / ".gate_ok")
    import json
    carimbo = json.loads((PROCESSED / ".gate_ok").read_text(encoding="utf-8"))
    assert carimbo["arquivos"]
    assert carimbo["versao_dados"] == "1.0.0-1991"
    assert "1991/municipios.parquet" not in carimbo["arquivos"], "caminhos no carimbo são relativos à própria PROCESSED"


def test_verify_gate_aprova(con):
    _req(PROCESSED / ".gate_ok")
    import verify_gate
    assert verify_gate.Verificador(PROCESSED).rodar() == 0
