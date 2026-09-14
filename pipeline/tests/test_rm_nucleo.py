"""Testes do script build_rm_nucleo.py e consistência dos núcleos de RM.

Verifica:
  (a) O script build_rm_nucleo.py --check aprova o arquivo existente
  (b) Cada cd_nucleo é membro (existe) da sua cd_rm em data/processed/rm.parquet
  (c) Âncoras: verificação de RMs e núcleos específicos
  (d) Cada cd_nucleo existe em data/processed/2010/municipios.parquet (2010)

Os testes (b)-(d) podem falhar até o outro agente regenerar pipeline/rm_nucleo.csv.
"""
import pathlib
import subprocess
import sys

import pytest

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / "pipeline"))
from edicoes import edicao as get_edicao  # noqa: E402

SCRIPT = ROOT / "pipeline" / "build_rm_nucleo.py"


def _req(*paths: pathlib.Path) -> None:
    for p in paths:
        if not p.exists():
            pytest.skip(f"{p} ainda não gerado")


def test_build_rm_nucleo_check_aprova():
    """subprocess.run([...build_rm_nucleo.py --check]) retorna 0."""
    _req(SCRIPT, ROOT / "pipeline" / "rm_nucleo.csv")
    result = subprocess.run(
        [sys.executable, str(SCRIPT), "--check"],
        cwd=ROOT,
        capture_output=True,
    )
    assert result.returncode == 0, f"build_rm_nucleo.py --check falhou: {result.stderr.decode()}"


def test_rm_nucleos_sao_membros_suas_rms(con):
    """Cada cd_nucleo de rm_nucleo.csv é membro (existe) da sua cd_rm em rm.parquet (2022)."""
    PROC_2022 = ROOT / "data" / "processed"
    _req(PROC_2022 / "rm.parquet", ROOT / "pipeline" / "rm_nucleo.csv")

    # Lê o CSV de núcleos
    nucleos = con.execute(
        f"SELECT cd_nucleo, cd_rm FROM read_csv('{ROOT / 'pipeline' / 'rm_nucleo.csv'}', all_varchar=true)"
    ).fetchall()

    for cd_nucleo, cd_rm in nucleos:
        exists, = con.execute(f"""
            SELECT COUNT(*) FROM read_parquet('{PROC_2022}/rm.parquet')
            WHERE cd_mun = '{cd_nucleo}' AND cd_rm = '{cd_rm}'
        """).fetchone()
        assert exists >= 1, f"cd_nucleo {cd_nucleo} não encontrado ou não pertence a cd_rm {cd_rm}"


def test_rm_nucleo_ancoras_2022(con):
    """Âncoras: verificação de RMs e núcleos específicos (edição 2022)."""
    PROC_2022 = ROOT / "data" / "processed"
    _req(PROC_2022 / "rm.parquet", ROOT / "pipeline" / "rm_nucleo.csv")

    # Lê os núcleos (cd_mun onde nucleo = true, agrupados por cd_rm)
    nucleo_rows = con.execute(
        f"SELECT cd_rm, cd_mun, nm_mun FROM read_parquet('{PROC_2022}/rm.parquet') "
        f"WHERE nucleo = true ORDER BY cd_rm"
    ).fetchall()

    nucleo_dict = {row[0]: (row[1], row[2]) for row in nucleo_rows}

    # Âncoras
    assert "4701" in nucleo_dict, "RM 4701 (Vitória) não encontrada"
    assert nucleo_dict["4701"][1] == "Vitória", f"Núcleo de 4701 é {nucleo_dict['4701'][1]}, esperado 'Vitória'"

    assert "2501" in nucleo_dict, "RM 2501 não encontrada"
    assert nucleo_dict["2501"][1] == "Barra de Santa Rosa", f"Núcleo de 2501 é {nucleo_dict['2501'][1]}"

    assert "7801" in nucleo_dict, "RM 7801 não encontrada"
    assert nucleo_dict["7801"][0] == "5300108", f"cd_mun (núcleo) de 7801 é {nucleo_dict['7801'][0]}, esperado 5300108"

    assert "3101" in nucleo_dict, "RM 3101 não encontrada"
    assert nucleo_dict["3101"][1] == "Petrolina", f"Núcleo de 3101 é {nucleo_dict['3101'][1]}"


def test_rm_nucleos_existem_2010(con):
    """Cada cd_nucleo de rm_nucleo.csv existe em data/processed/2010/municipios.parquet."""
    PROC_2010 = ROOT / "data" / "processed" / "2010"
    _req(PROC_2010 / "municipios.parquet", ROOT / "pipeline" / "rm_nucleo.csv")

    # Lê cd_nucleo do CSV
    nucleos = con.execute(
        f"SELECT DISTINCT cd_nucleo FROM read_csv('{ROOT / 'pipeline' / 'rm_nucleo.csv'}', all_varchar=true)"
    ).fetchall()
    nucleos_set = {row[0] for row in nucleos}

    # Verifica que existem em municipios 2010
    presentes = con.execute(
        f"SELECT COUNT(cd_mun) FROM read_parquet('{PROC_2010}/municipios.parquet') "
        f"WHERE cd_mun IN ({','.join(repr(n) for n in nucleos_set)})"
    ).fetchone()[0]

    assert presentes == len(nucleos_set), (
        f"Nem todos os núcleos existem em municipios 2010: "
        f"{presentes}/{len(nucleos_set)} encontrados"
    )
