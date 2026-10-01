"""Testes do script build_rm_nucleo.py e consistência dos núcleos de RM.

Verifica:
  (a) O script build_rm_nucleo.py --check aprova o arquivo existente
  (b) Cada cd_nucleo é membro (existe) da sua cd_rm em data/processed/rm.parquet
  (c) Âncoras: verificação de RMs e núcleos específicos
  (d) Cada cd_nucleo existe em data/processed/2010/municipios.parquet (2010)

Os testes (b)-(d) podem falhar até o outro agente regenerar pipeline/rm_nucleo.csv.
"""
import json
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


def _req_1980_publicado(*paths: pathlib.Path) -> None:
    """Como _req para data/processed/1980, e pula se o carimbo ainda for de uma 1.0.x-1980, anterior
    à recodificação do norte de Goiás (1.1.0-1980): as RMs de Palmas e de Gurupi só existem no
    publicado depois dela (78 RMs antes, 80 depois). Ver test_edicao_1980.py."""
    gate = ROOT / "data" / "processed" / "1980" / ".gate_ok"
    _req(gate, *paths)
    versao = json.loads(gate.read_text(encoding="utf-8"))["versao_dados"]
    if versao.startswith("1.0."):
        pytest.skip(f"data/processed/1980 ainda em {versao}; regenerar para 1.1.0-1980")


def test_build_rm_nucleo_check_aprova():
    """subprocess.run([...build_rm_nucleo.py --check]) retorna 0."""
    _req(
        SCRIPT, ROOT / "pipeline" / "rm_nucleo.csv",
        ROOT / "data/interim/municipios_ref.parquet", ROOT / "data/interim/municipios_bruto.parquet",
    )
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


def test_rm_nucleo_unico_por_rm_1980(con):
    """Edição 1980: exatamente 1 linha com nucleo=true por cd_rm nas 80 RMs (as 78 de 1.0.7-1980
    mais Palmas 901 e Gurupi 1001, que entram com os 52 municípios do norte de Goiás)."""
    PROC_1980 = ROOT / "data" / "processed" / "1980"
    _req_1980_publicado(PROC_1980 / "rm.parquet")

    v, = con.execute(f"""
        SELECT COUNT(*) FROM (
            SELECT cd_rm, COUNT(*) FILTER (WHERE nucleo) k
            FROM read_parquet('{PROC_1980}/rm.parquet') GROUP BY cd_rm
        ) WHERE k <> 1""").fetchone()
    assert v == 0, f"esperado exatamente 1 núcleo por RM em 1980, encontrado {v} RMs sem ou com >1 núcleo"

    n_rm_distintas, = con.execute(f"SELECT COUNT(DISTINCT cd_rm) FROM read_parquet('{PROC_1980}/rm.parquet')").fetchone()
    assert n_rm_distintas == 80, f"esperado 80 RMs em 1980, encontrado {n_rm_distintas}"


def test_rm_nucleos_existem_1980(con):
    """Cada cd_nucleo de rm_nucleo.csv que existe em 1980 está em data/processed/1980/municipios.parquet,
    e os que NÃO existem são exatamente os municípios criados depois de 1980.

    O csv é de 2022 (81 RMs); 1980 tem 80: a RM de Rorainópolis (501) não tem nenhum município
    existente em 1980 e não entra na edição. Dos 81 núcleos, dois não existem em 1980 --
    Rorainópolis (1400472, da RM 501) e Palmas (1721000, da RM 901, criada em 1989) -- e a RM
    de Palmas fica com o núcleo de fallback de pipeline/sql/1980/08_metro.sql. Os demais, inclusive
    Gurupi (1709500, núcleo da RM 1001), existem: Gurupi é um dos 52 municípios do norte de Goiás,
    publicados como 17xxxxx desde 1.1.0-1980."""
    PROC_1980 = ROOT / "data" / "processed" / "1980"
    _req_1980_publicado(PROC_1980 / "municipios.parquet", ROOT / "pipeline" / "rm_nucleo.csv")

    # Lê cd_nucleo do CSV
    nucleos = con.execute(
        f"SELECT DISTINCT cd_nucleo FROM read_csv('{ROOT / 'pipeline' / 'rm_nucleo.csv'}', all_varchar=true)"
    ).fetchall()
    nucleos_set = {row[0] for row in nucleos}

    municipios_1980 = {row[0] for row in con.execute(
        f"SELECT cd_mun FROM read_parquet('{PROC_1980}/municipios.parquet')"
    ).fetchall()}
    nucleos_1980 = nucleos_set & municipios_1980

    assert "1709500" in nucleos_1980, "Gurupi (núcleo da RM 1001) existe na edição, como 17xxxxx"
    assert nucleos_set - municipios_1980 == {"1721000", "1400472"}, (
        "os núcleos que não existem em 1980 devem ser só Palmas e Rorainópolis, criados depois de 1980"
    )

    presentes_1980 = con.execute(
        f"SELECT COUNT(cd_mun) FROM read_parquet('{PROC_1980}/municipios.parquet') "
        f"WHERE cd_mun IN ({','.join(repr(n) for n in nucleos_1980)})"
    ).fetchone()[0]
    assert presentes_1980 == len(nucleos_1980), (
        f"Nem todos os núcleos (de 1980) existem em municipios 1980: "
        f"{presentes_1980}/{len(nucleos_1980)} encontrados"
    )


def test_rm_nucleos_de_1980_batem_csv(con):
    """Verifica que os núcleos publicados de 1980 batem com o pipeline/rm_nucleo.csv (ou
    seu fallback de município mais populoso, caso o núcleo canônico não exista em 1980).

    Obs: 1980 é um subconjunto de 2022 (os municípios criados depois de 1980 não existem), então
    nem todos os núcleos do CSV existem em 1980 -- hoje só Palmas (RM 901), porque a RM de
    Rorainópolis (501) nem entra na edição. Para RMs que existem em 1980, o núcleo deve ser o do CSV
    se ele existe em 1980, ou o fallback aplicado em pipeline/sql/1980/08_metro.sql (membro mais
    populoso): Porto Nacional, no caso de Palmas."""
    PROC_1980 = ROOT / "data" / "processed" / "1980"
    _req_1980_publicado(PROC_1980 / "rm.parquet", ROOT / "pipeline" / "rm_nucleo.csv")

    # Lê núcleos do CSV
    csv_nucleos = con.execute(
        f"SELECT cd_rm, cd_nucleo FROM read_csv('{ROOT / 'pipeline' / 'rm_nucleo.csv'}', all_varchar=true)"
    ).fetchall()
    csv_dict = {cd_rm: cd_nucleo for cd_rm, cd_nucleo in csv_nucleos}

    # Lê núcleos publicados de 1980
    publicados = con.execute(
        f"SELECT cd_rm, cd_mun FROM read_parquet('{PROC_1980}/rm.parquet') WHERE nucleo = true ORDER BY cd_rm"
    ).fetchall()

    municipios_1980 = {row[0] for row in con.execute(
        f"SELECT cd_mun FROM read_parquet('{PROC_1980}/municipios.parquet')"
    ).fetchall()}
    rm_membros = con.execute(f"SELECT cd_rm, cd_mun FROM read_parquet('{PROC_1980}/rm.parquet')").fetchall()

    mismatches = []
    for cd_rm, cd_mun_publicado in publicados:
        if cd_rm not in csv_dict:
            # RM não existe no CSV (não deve acontecer, mas documentar)
            continue

        cd_nucleo_csv = csv_dict[cd_rm]

        # Se o núcleo do CSV existe em 1980, deve ser o publicado
        if cd_nucleo_csv in municipios_1980:
            if cd_mun_publicado != cd_nucleo_csv:
                mismatches.append(
                    f"RM {cd_rm}: esperado núcleo do CSV {cd_nucleo_csv}, obteve {cd_mun_publicado}"
                )
        else:
            # O núcleo do CSV não existe em 1980 (Palmas): o fallback (membro mais populoso) é do
            # SQL. Aqui só se confere que o publicado é membro da RM e não o núcleo inexistente; a
            # regra do fallback em si é conferida em test_edicao_1980.py
            # (test_rm_palmas_fallback_e_o_membro_mais_populoso), contra os agregados pré-revelação.
            membros = {cd_mun for rm, cd_mun in rm_membros if rm == cd_rm}
            if cd_mun_publicado == cd_nucleo_csv or cd_mun_publicado not in membros:
                mismatches.append(
                    f"RM {cd_rm}: núcleo do CSV ({cd_nucleo_csv}) não existe em 1980 e o núcleo "
                    f"publicado ({cd_mun_publicado}) deveria ser outro membro da RM"
                )

    assert mismatches == [], (
        f"Núcleos de 1980 não batem com pipeline/rm_nucleo.csv:\n" +
        "\n".join(mismatches)
    )
