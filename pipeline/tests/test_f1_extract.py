"""Testes de consistência da extração (F1). Só agregações -- nunca linhas individuais."""
import labels


def test_total_pessoas(con, pessoas_path):
    n, = con.execute(f"SELECT COUNT(*) FROM read_parquet('{pessoas_path}')").fetchone()
    assert n == 21_539_579, "deve bater com o total de Pessoas do Questionário da Amostra (Notas 04/2026)"


def test_soma_pesos_nacional(con, pessoas_path):
    peso, = con.execute(f"SELECT SUM(peso) FROM read_parquet('{pessoas_path}')").fetchone()
    assert abs(peso - 203_080_756) < 100


def test_27_ufs(con, pessoas_path):
    n, = con.execute(f"SELECT COUNT(DISTINCT uf) FROM read_parquet('{pessoas_path}')").fetchone()
    assert n == 27


def test_percentual_migrantes_data_fixa_plausivel(con, pessoas_path):
    row = con.execute(
        f"""
        SELECT
            SUM(CASE WHEN df_local IN ('2','3') THEN 1 ELSE 0 END) AS mig,
            COUNT(*) AS total
        FROM read_parquet('{pessoas_path}')
        """
    ).fetchone()
    pct = row[0] / row[1] * 100
    assert 2 <= pct <= 12


def test_codigos_municipio_data_fixa_validos(con, pessoas_path):
    codigos = con.execute(
        f"""
        SELECT DISTINCT df_mun FROM read_parquet('{pessoas_path}')
        WHERE df_local = '2' AND df_mun NOT IN ('8888888', '9999999')
        """
    ).fetchall()
    validos = set(labels.MUNICIPIOS.keys())
    fora = [c[0] for c in codigos if c[0] not in validos]
    assert fora == []


def test_codigos_municipio_residencia_validos(con, pessoas_path):
    codigos = con.execute(f"SELECT DISTINCT cd_mun FROM read_parquet('{pessoas_path}')").fetchall()
    validos = set(labels.MUNICIPIOS.keys())
    fora = [c[0] for c in codigos if c[0] not in validos]
    assert fora == []
    assert len(codigos) == 5570


def test_join_pessoas_domicilios_completo(con, pessoas_path, domicilios_path):
    row = con.execute(
        f"""
        SELECT
            (SELECT COUNT(*) FROM read_parquet('{pessoas_path}')) AS n_pessoas,
            (SELECT COUNT(*) FROM read_parquet('{pessoas_path}') p
             WHERE EXISTS (SELECT 1 FROM read_parquet('{domicilios_path}') d WHERE d.controle = p.controle)
            ) AS n_matched
        """
    ).fetchone()
    assert row[0] == row[1]


def test_total_domicilios(con, domicilios_path):
    n, = con.execute(f"SELECT COUNT(*) FROM read_parquet('{domicilios_path}')").fetchone()
    assert n == 7_689_963, "deve bater com o total de Unidades Domiciliares do Questionário da Amostra"
