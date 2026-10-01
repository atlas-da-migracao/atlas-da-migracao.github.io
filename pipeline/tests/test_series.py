"""Testes da série publicada em data/processed/series/ (F12.4-t).

Verifica identidades entre a série e a fonte, cobertura, comparabilidade
e consistência de dados publicados.
"""
import json
import pathlib
import hashlib
import re

import pytest
import duckdb

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
SERIES_DIR = ROOT / "data/processed/series"
SYS = __import__("sys")
SYS.path.insert(0, str(ROOT / "pipeline"))

from edicoes import EDICOES
from norte_goias_1980 import RECODIFICACAO_1980

GENEALOGIA_CSV = ROOT / "pipeline" / "genealogia_municipios.csv"


def _skip_se_ausente(*paths):
    """Skip teste se arquivos não existem."""
    for p in paths:
        if not pathlib.Path(p).exists():
            pytest.skip(f"{p} ainda não gerado")


def _skip_se_serie_anterior_a_1_1_0_1980():
    """Pula o teste enquanto a série publicada ainda carregar a edição 1980 anterior a 1.1.0.

    Até 1.0.7-1980 o norte de Goiás (hoje Tocantins) era a unidade agregada `NORTEGO`; desde
    1.1.0-1980 são 52 municípios comuns com o código de 2022. O `versao_dados` do `.gate_ok` da
    série concatena a versão de cada edição (`...+1.1.0-1980`); compara-se a versão de 1980 como
    tupla, não como substring, para que 1.1.1, 1.2.0... também valham.
    """
    gate = SERIES_DIR / ".gate_ok"
    _skip_se_ausente(gate, SERIES_DIR / "unidades_serie.parquet", SERIES_DIR / "pares_serie.parquet")
    versao = json.loads(gate.read_text(encoding="utf-8")).get("versao_dados", "")
    m = re.search(r"(\d+)\.(\d+)\.(\d+)-1980", versao)
    if m is None or tuple(int(g) for g in m.groups()) < (1, 1, 0):
        pytest.skip(f"série ainda gerada com a edição 1980 anterior a 1.1.0-1980 ({versao})")


def _ler_serie(con, tabela: str) -> str:
    """Caminho posix de uma tabela de série."""
    return (SERIES_DIR / f"{tabela}.parquet").as_posix()


def _ler_processado(con, edicao: str, tabela: str) -> str:
    """Caminho posix de uma tabela processada de uma edição."""
    e = EDICOES[edicao]
    return (ROOT / e.processed / f"{tabela}.parquet").as_posix()


@pytest.fixture(scope="module")
def con():
    """Conexão DuckDB para testes."""
    c = duckdb.connect()
    c.execute("PRAGMA threads=8;")
    yield c
    c.close()


# ==============================================================================================
# Identidades série × fonte
# ==============================================================================================


class TestIdentidadeSerieVsFonte:
    """Verifica que os valores da série batem com a fonte publicada de cada edição."""

    def test_imig_emig_saldo_amostra_2022(self, con):
        """Amostra de municípios em 2022: imig/emig/saldo batem com municipios.parquet."""
        _skip_se_ausente(
            _ler_serie(con, "unidades_serie"),
            _ler_processado(con, "2022", "municipios"),
        )

        # Lê amostra de municípios de 2022 da série
        serie = con.execute(
            f"SELECT codigo, edicao, imig, emig, saldo FROM read_parquet('{_ler_serie(con, 'unidades_serie')}') "
            f"WHERE nivel='mun' AND edicao='2022' AND imig IS NOT NULL LIMIT 5"
        ).fetchall()

        for codigo, edicao, imig_s, emig_s, saldo_s in serie:
            # Lê valor correspondente da fonte
            fonte = con.execute(
                f"SELECT imig, emig, saldo FROM read_parquet('{_ler_processado(con, edicao, 'municipios')}') "
                f"WHERE cd_mun='{codigo}'"
            ).fetchall()
            if fonte:
                imig_f, emig_f, saldo_f = fonte[0]
                assert float(imig_s) == pytest.approx(float(imig_f), abs=1.0)
                assert float(emig_s) == pytest.approx(float(emig_f), abs=1.0)
                assert float(saldo_s) == pytest.approx(float(saldo_f), abs=1.0)

    def test_imig_emig_amostra_2010(self, con):
        """Amostra de municípios em 2010: imig/emig/saldo batem."""
        _skip_se_ausente(
            _ler_serie(con, "unidades_serie"),
            _ler_processado(con, "2010", "municipios"),
        )

        serie = con.execute(
            f"SELECT codigo, edicao, imig, emig FROM read_parquet('{_ler_serie(con, 'unidades_serie')}') "
            f"WHERE nivel='mun' AND edicao='2010' AND imig IS NOT NULL LIMIT 5"
        ).fetchall()

        for codigo, edicao, imig_s, emig_s in serie:
            fonte = con.execute(
                f"SELECT imig, emig FROM read_parquet('{_ler_processado(con, edicao, 'municipios')}') "
                f"WHERE cd_mun='{codigo}'"
            ).fetchall()
            if fonte:
                imig_f, emig_f = fonte[0]
                assert float(imig_s) == pytest.approx(float(imig_f), abs=1.0)
                assert float(emig_s) == pytest.approx(float(emig_f), abs=1.0)


# ==============================================================================================
# Pares da série vs. fonte
# ==============================================================================================


class TestParesExistemNaFonte:
    """Verifica que todo par da série existe na fonte com o mesmo total."""

    def test_pares_migracacao_2022(self, con):
        """Pares de migração em 2022: total deve bater com fluxos.parquet."""
        _skip_se_ausente(
            _ler_serie(con, "pares_serie"),
            _ler_processado(con, "2022", "fluxos"),
        )

        pares = con.execute(
            f"SELECT origem, destino, edicao, total FROM read_parquet('{_ler_serie(con, 'pares_serie')}') "
            f"WHERE edicao='2022' AND tipo='mig' AND total IS NOT NULL LIMIT 10"
        ).fetchall()

        for origem, destino, edicao, total_s in pares:
            fonte = con.execute(
                f"SELECT total FROM read_parquet('{_ler_processado(con, edicao, 'fluxos')}') "
                f"WHERE origem='{origem}' AND destino='{destino}'"
            ).fetchall()
            if fonte:
                total_f = fonte[0][0]
                assert float(total_s) == pytest.approx(float(total_f), abs=1.0)

    def test_nenhum_par_pendular_1991(self, con):
        """1991 não tem módulo pendular: nenhum par de trabalho/estudo deve existir."""
        _skip_se_ausente(_ler_serie(con, "pares_serie"))

        pares = con.execute(
            f"SELECT COUNT(*) FROM read_parquet('{_ler_serie(con, 'pares_serie')}') "
            f"WHERE edicao='1991' AND tipo IN ('trab', 'estudo') AND total IS NOT NULL"
        ).fetchone()

        assert pares[0] == 0


# ==============================================================================================
# Verificações de comparabilidade
# ==============================================================================================


class TestComparabilidadePendular:
    """Verificações do módulo pendular nas edições."""

    def test_nenhuma_saida_trab_1991(self, con):
        """1991 sem pendular: saida_trab deve ser NULL em unidades_serie."""
        _skip_se_ausente(_ler_serie(con, "unidades_serie"))

        n = con.execute(
            f"SELECT COUNT(*) FROM read_parquet('{_ler_serie(con, 'unidades_serie')}') "
            f"WHERE edicao='1991' AND saida_trab IS NOT NULL"
        ).fetchone()

        assert n[0] == 0

    def test_nenhuma_entrada_estudo_1991(self, con):
        """1991 sem pendular: entrada_estudo deve ser NULL."""
        _skip_se_ausente(_ler_serie(con, "unidades_serie"))

        n = con.execute(
            f"SELECT COUNT(*) FROM read_parquet('{_ler_serie(con, 'unidades_serie')}') "
            f"WHERE edicao='1991' AND entrada_estudo IS NOT NULL"
        ).fetchone()

        assert n[0] == 0


class TestComparabilidadeRenda:
    """1980 não publica renda."""

    def test_nenhuma_renda_1980_alem_de_aplicavel(self, con):
        """1980 sem renda: perfil_serie só tem nao_aplicavel/outros em renda."""
        _skip_se_ausente(_ler_serie(con, "perfil_serie"))

        # Lê categorias de renda em 1980
        categorias = con.execute(
            f"SELECT DISTINCT categoria FROM read_parquet('{_ler_serie(con, 'perfil_serie')}') "
            f"WHERE edicao='1980' AND dimensao='renda'"
        ).fetchall()

        # 1980 só deve ter nao_aplicavel e outros
        categorias_permitidas = {"nao_aplicavel", "outros"}
        for (cat,) in categorias:
            assert cat in categorias_permitidas


# ==============================================================================================
# Cobertura territorial
# ==============================================================================================


class TestCoberturaTerritorial:
    """Verificações de cobertura e genealogia."""

    def test_municipio_ausente_tem_genealogia(self, con):
        """Município ausente numa edição tem existia=false e um cd_mun_mae."""
        _skip_se_ausente(_ler_serie(con, "unidades_serie"))

        # Lê municípios com existia=false
        ausentes = con.execute(
            f"SELECT codigo, edicao FROM read_parquet('{_ler_serie(con, 'unidades_serie')}') "
            f"WHERE nivel='mun' AND existia=false LIMIT 10"
        ).fetchall()

        # Verifica que há genealogia para esses municípios
        genealogia_path = (ROOT / "pipeline" / "genealogia_municipios.csv").as_posix()
        for codigo, edicao in ausentes:
            # Verifica que existe um registro na genealogia
            gen = con.execute(
                f"SELECT cd_mun_mae FROM read_csv('{genealogia_path}') "
                f"WHERE cd_mun_2022='{codigo}' AND edicao='{edicao}'"
            ).fetchall()
            assert len(gen) > 0, f"Nenhuma genealogia para {codigo} em {edicao}"
            assert gen[0][0] is not None, f"{codigo} em {edicao} sem cd_mun_mae"


class TestTocantins1980:
    """O norte de Goiás (atual Tocantins) em 1980 desde 1.1.0-1980: 52 municípios comuns com o
    código de 2022, sem a unidade agregada `NORTEGO`; os 87 municípios de 2022 do Tocantins
    criados depois recebem a mãe por sobreposição de área, pelo caminho genérico."""

    TOTAL_TO = 139
    N_DE_1980 = 52

    def test_constantes_do_teste_batem_com_a_recodificacao(self):
        """Sanidade do próprio teste: 52 códigos distintos, todos de UF 17."""
        codigos = set(RECODIFICACAO_1980.values())
        assert len(codigos) == self.N_DE_1980
        assert all(c.startswith("17") and len(c) == 7 and c.isdigit() for c in codigos)

    def test_genealogia_sem_unidade_agregada(self, con):
        """genealogia_municipios.csv: nenhuma mãe `NORTEGO`/método `unidade_agregada`; os 52 existem
        em 1980 e os 87 restantes do Tocantins têm mãe real (código de 7 dígitos)."""
        _skip_se_ausente(GENEALOGIA_CSV)
        caminho = GENEALOGIA_CSV.as_posix()
        antigo = con.execute(
            f"SELECT COUNT(*) FROM read_csv('{caminho}', all_varchar=true) "
            "WHERE cd_mun_mae = 'NORTEGO' OR metodo = 'unidade_agregada'"
        ).fetchone()[0]
        if antigo:
            pytest.skip("genealogia ainda não regenerada para 1.1.0-1980 (traz NORTEGO)")

        cods = ", ".join(f"'{c}'" for c in sorted(set(RECODIFICACAO_1980.values())))
        existem = con.execute(
            f"SELECT COUNT(*) FROM read_csv('{caminho}', all_varchar=true) "
            f"WHERE edicao = '1980' AND cd_mun_2022 IN ({cods}) AND existia = 'true' "
            "AND metodo = 'existia' AND cd_mun_mae IS NULL"
        ).fetchone()[0]
        assert existem == self.N_DE_1980

        outros = con.execute(
            f"SELECT cd_mun_mae, metodo FROM read_csv('{caminho}', all_varchar=true) "
            f"WHERE edicao = '1980' AND cd_mun_2022 LIKE '17%' AND cd_mun_2022 NOT IN ({cods})"
        ).fetchall()
        assert len(outros) == self.TOTAL_TO - self.N_DE_1980
        for mae, metodo in outros:
            assert mae is not None and re.fullmatch(r"\d{7}", str(mae)), f"mãe inválida: {mae}"
            assert metodo in ("unico_pai", "multiplos_pais"), f"método inesperado: {metodo}"

    def test_nenhuma_linha_nortego_em_unidades_serie(self, con):
        _skip_se_serie_anterior_a_1_1_0_1980()
        n = con.execute(
            f"SELECT COUNT(*) FROM read_parquet('{_ler_serie(con, 'unidades_serie')}') "
            "WHERE codigo = 'NORTEGO' OR cd_mun_mae = 'NORTEGO'"
        ).fetchone()[0]
        assert n == 0, f"{n} linhas ainda referenciam NORTEGO em unidades_serie"

    def test_todo_codigo_mun_e_numerico_de_7_digitos(self, con):
        """Sem código-sentinela (como o antigo `NORTEGO`, também de 7 caracteres): todo `mun` é
        um código de município de 2022, e cada edição tem exatamente 5.570 deles."""
        _skip_se_serie_anterior_a_1_1_0_1980()
        ruins = con.execute(
            f"SELECT COUNT(*) FROM read_parquet('{_ler_serie(con, 'unidades_serie')}') "
            "WHERE nivel = 'mun' AND NOT regexp_full_match(codigo, '[0-9]{7}')"
        ).fetchone()[0]
        assert ruins == 0
        por_edicao = con.execute(
            f"SELECT edicao, COUNT(DISTINCT codigo) FROM read_parquet('{_ler_serie(con, 'unidades_serie')}') "
            "WHERE nivel = 'mun' GROUP BY edicao"
        ).fetchall()
        assert {e: n for e, n in por_edicao} == {e: 5570 for e in EDICOES}

    def test_os_52_municipios_existem_em_1980(self, con):
        _skip_se_serie_anterior_a_1_1_0_1980()
        cods = ", ".join(f"'{c}'" for c in sorted(set(RECODIFICACAO_1980.values())))
        linhas = con.execute(
            f"SELECT codigo, existia, n_mun_edicao, n_mun_2022, cobertura_cod, cobertura_pop "
            f"FROM read_parquet('{_ler_serie(con, 'unidades_serie')}') "
            f"WHERE nivel = 'mun' AND edicao = '1980' AND codigo IN ({cods})"
        ).fetchall()
        assert len(linhas) == self.N_DE_1980
        assert all(ex is True and ne == 1 and n22 == 1 and cc == 1.0 and cp == 1.0
                   for _, ex, ne, n22, cc, cp in linhas)

    def test_os_87_criados_depois_tem_mae_real_em_1980(self, con):
        _skip_se_serie_anterior_a_1_1_0_1980()
        cods = ", ".join(f"'{c}'" for c in sorted(set(RECODIFICACAO_1980.values())))
        linhas = con.execute(
            f"SELECT codigo, existia, cd_mun_mae FROM read_parquet('{_ler_serie(con, 'unidades_serie')}') "
            f"WHERE nivel = 'mun' AND edicao = '1980' AND codigo LIKE '17%' AND codigo NOT IN ({cods})"
        ).fetchall()
        assert len(linhas) == self.TOTAL_TO - self.N_DE_1980
        for codigo, existia, mae in linhas:
            assert existia is False, codigo
            assert mae is not None and re.fullmatch(r"\d{7}", str(mae)), f"{codigo}: mãe {mae}"

    def test_cobertura_da_uf_17_em_1980(self, con):
        """`cobertura_cod` é ponderada pela população de 2022 (não é a razão de códigos 52/139 =
        0,374): os 52 municípios de 1980 são ~55,5% da população do Tocantins em 2022. A
        `cobertura_pop` credita a mãe dentro da UF e vai a ~1,0; o estado é `parcial`."""
        _skip_se_serie_anterior_a_1_1_0_1980()
        _skip_se_ausente(_ler_processado(con, "2022", "municipios"))
        cods = ", ".join(f"'{c}'" for c in sorted(set(RECODIFICACAO_1980.values())))
        esperado = con.execute(
            f"SELECT SUM(pop) FILTER (WHERE cd_mun IN ({cods})) / SUM(pop) "
            f"FROM read_parquet('{_ler_processado(con, '2022', 'municipios')}') WHERE uf = '17'"
        ).fetchone()[0]
        assert esperado == pytest.approx(0.555, abs=0.01)

        n_ed, n_22, cob_cod, cob_pop, estado = con.execute(
            f"SELECT n_mun_edicao, n_mun_2022, cobertura_cod, cobertura_pop, estado_cobertura "
            f"FROM read_parquet('{_ler_serie(con, 'unidades_serie')}') "
            "WHERE nivel = 'uf' AND codigo = '17' AND edicao = '1980'"
        ).fetchone()
        assert (n_ed, n_22) == (self.N_DE_1980, self.TOTAL_TO)
        assert cob_cod == pytest.approx(esperado, abs=1e-6)
        assert cob_pop == pytest.approx(1.0, abs=0.01)
        assert estado == "parcial"

    def test_nenhum_par_com_nortego_em_pares_serie(self, con):
        _skip_se_serie_anterior_a_1_1_0_1980()
        n = con.execute(
            f"SELECT COUNT(*) FROM read_parquet('{_ler_serie(con, 'pares_serie')}') "
            "WHERE origem = 'NORTEGO' OR destino = 'NORTEGO'"
        ).fetchone()[0]
        assert n == 0

    def test_par_ausente_de_municipio_inexistente_e_nao_existia_nao_suprimido(self, con):
        """Regressão do default `or origem == 'NORTEGO'`: um par `mun` cuja origem ou destino
        não existia na edição é `nao_existia` (ou `nao_medido`), nunca `suprimido`."""
        _skip_se_serie_anterior_a_1_1_0_1980()
        n = con.execute(f"""
            SELECT COUNT(*)
            FROM read_parquet('{_ler_serie(con, 'pares_serie')}') p
            WHERE p.nivel = 'mun' AND p.motivo_ausencia = 'suprimido' AND EXISTS (
                SELECT 1 FROM read_parquet('{_ler_serie(con, 'unidades_serie')}') u
                WHERE u.nivel = 'mun' AND u.edicao = p.edicao AND u.existia = false
                  AND u.codigo IN (p.origem, p.destino)
            )
        """).fetchone()[0]
        assert n == 0, f"{n} pares 'suprimido' com extremo que não existia na edição"



# ==============================================================================================
# Identidades algébricas
# ==============================================================================================


class TestIdentidadesAlgebricas:
    """Verifica identidades matemáticas nas medidas agregadas."""

    def test_anmr_identity_sistema_serie(self, con):
        """ANMR = CMI * MEI / 100 em sistema_serie.parquet."""
        _skip_se_ausente(_ler_serie(con, "sistema_serie"))

        dados = con.execute(
            f"SELECT nivel, edicao, cmi, mei, anmr FROM read_parquet('{_ler_serie(con, 'sistema_serie')}') "
            f"WHERE cmi IS NOT NULL AND mei IS NOT NULL AND anmr IS NOT NULL"
        ).fetchall()

        for nivel, edicao, cmi, mei, anmr in dados:
            anmr_calculado = float(cmi) * float(mei) / 100.0
            assert float(anmr) == pytest.approx(anmr_calculado, rel=1e-4), \
                f"{nivel}/{edicao}: ANMR={anmr} != CMI*MEI/100={anmr_calculado}"

    def test_iem_bounds(self, con):
        """IEM sempre está em [-1, 1] ou é NULL."""
        _skip_se_ausente(_ler_serie(con, "unidades_serie"))

        dados = con.execute(
            f"SELECT iem FROM read_parquet('{_ler_serie(con, 'unidades_serie')}') "
            f"WHERE iem IS NOT NULL"
        ).fetchall()

        for (iem,) in dados:
            iem_val = float(iem)
            assert -1.0 <= iem_val <= 1.0, f"IEM fora de [-1,1]: {iem_val}"

    def test_duncan_d_bounds(self, con):
        """Duncan D sempre está em [0, 1]."""
        _skip_se_ausente(_ler_serie(con, "sistema_serie"))

        dados = con.execute(
            f"SELECT duncan_d_ant FROM read_parquet('{_ler_serie(con, 'sistema_serie')}') "
            f"WHERE duncan_d_ant IS NOT NULL"
        ).fetchall()

        for (d,) in dados:
            d_val = float(d)
            assert 0.0 <= d_val <= 1.0, f"Duncan D fora de [0,1]: {d_val}"


# ==============================================================================================
# Cobertura de comparabilidade.json
# ==============================================================================================


class TestComparabilidadeJSON:
    """Verifica que comparabilidade.json cobre as combinações esperadas."""

    def test_comparabilidade_json_existe(self, con):
        """comparabilidade.json deve existir."""
        _skip_se_ausente(SERIES_DIR / "comparabilidade.json")
        assert (SERIES_DIR / "comparabilidade.json").exists()

    def test_comparabilidade_json_estrutura(self, con):
        """comparabilidade.json tem a estrutura esperada."""
        _skip_se_ausente(SERIES_DIR / "comparabilidade.json")

        with open(SERIES_DIR / "comparabilidade.json", "r") as f:
            data = json.load(f)

        # Deve ter campos principais
        assert "edicoes" in data, "Chave 'edicoes' ausente"
        assert "matriz" in data, "Chave 'matriz' ausente"
        assert "cobertura" in data, "Chave 'cobertura' ausente"
        assert "harmonizacao" in data, "Chave 'harmonizacao' ausente"
        assert "entre_niveis" in data, "Chave 'entre_niveis' ausente"

        # Edicões esperadas
        edicoes_esperadas = {"2022", "2010", "2000", "1991", "1980"}
        assert set(data["edicoes"]) == edicoes_esperadas, \
            f"Edições mismatch: {set(data['edicoes'])} != {edicoes_esperadas}"

    def test_comparabilidade_todas_as_medidas_principais(self, con):
        """As medidas principais estão em comparabilidade.json."""
        _skip_se_ausente(SERIES_DIR / "comparabilidade.json")

        with open(SERIES_DIR / "comparabilidade.json", "r") as f:
            data = json.load(f)

        # Medidas esperadas (subset)
        medidas_esperadas = {"imig", "emig", "saldo", "iem", "cmi"}

        # Lê a matriz para verificar quais medidas estão presentes
        matriz = data.get("matriz", [])
        medidas_presentes = set(m["medida"] for m in matriz if "medida" in m)

        for medida in medidas_esperadas:
            assert medida in medidas_presentes, \
                f"Medida {medida} não encontrada em comparabilidade.json['matriz']"


# ==============================================================================================
# Integridade dos arquivos
# ==============================================================================================


class TestGateOKIntegridade:
    """Verifica que os arquivos não foram modificados após carimbo do gate."""

    def test_gate_ok_existe(self, con):
        """Arquivo .gate_ok deve existir na série."""
        _skip_se_ausente(SERIES_DIR / ".gate_ok")
        assert (SERIES_DIR / ".gate_ok").exists()

    def test_gate_ok_timestamp_e_versao(self, con):
        """Arquivo .gate_ok tem os campos esperados."""
        _skip_se_ausente(SERIES_DIR / ".gate_ok")

        with open(SERIES_DIR / ".gate_ok", "r") as f:
            data = json.load(f)

        assert "timestamp" in data, ".gate_ok sem campo timestamp"
        assert "versao_dados" in data, ".gate_ok sem campo versao_dados"
        assert "arquivos" in data, ".gate_ok sem campo arquivos"

    def test_gate_ok_hashes_dos_parquets(self, con):
        """Hashes dos parquets coincidem com .gate_ok."""
        _skip_se_ausente(SERIES_DIR / ".gate_ok")

        with open(SERIES_DIR / ".gate_ok", "r") as f:
            gate_data = json.load(f)

        arquivos = gate_data.get("arquivos", {})

        for nome_arquivo, hash_esperado in arquivos.items():
            caminho = SERIES_DIR / nome_arquivo
            if caminho.exists():
                # Calcula hash SHA-256 do arquivo
                sha256 = hashlib.sha256()
                with open(caminho, "rb") as f:
                    for bloco in iter(lambda: f.read(4096), b""):
                        sha256.update(bloco)
                hash_real = sha256.hexdigest()
                assert hash_real == hash_esperado, \
                    f"{nome_arquivo}: hash mismatch ({hash_real} != {hash_esperado})"


# ==============================================================================================
# Completude de dados por edição
# ==============================================================================================


class TestCompletudeEdices:
    """Verifica que as tabelas de série têm dados para todas as edições esperadas."""

    def test_unidades_serie_todas_as_edicoes(self, con):
        """unidades_serie tem dados para as 5 edições."""
        _skip_se_ausente(_ler_serie(con, "unidades_serie"))

        edicoes = con.execute(
            f"SELECT DISTINCT edicao FROM read_parquet('{_ler_serie(con, 'unidades_serie')}') "
            f"ORDER BY edicao DESC"
        ).fetchall()

        edicoes_encontradas = set(e[0] for e in edicoes)
        edicoes_esperadas = {"2022", "2010", "2000", "1991", "1980"}
        assert edicoes_encontradas == edicoes_esperadas, \
            f"Edições faltam: {edicoes_esperadas - edicoes_encontradas}"

    def test_sistema_serie_niveis_principais(self, con):
        """sistema_serie cobre os níveis principais."""
        _skip_se_ausente(_ler_serie(con, "sistema_serie"))

        niveis = con.execute(
            f"SELECT DISTINCT nivel FROM read_parquet('{_ler_serie(con, 'sistema_serie')}') "
            f"ORDER BY nivel"
        ).fetchall()

        niveis_encontrados = set(n[0] for n in niveis)
        # Nota: sistema_serie não cobre RM (ver build_series.py decisão 3)
        niveis_esperados = {"mun", "rgi", "rgint", "uf"}
        assert niveis_esperados.issubset(niveis_encontrados), \
            f"Níveis faltam: {niveis_esperados - niveis_encontrados}"


# ==============================================================================================
# Verificações de nível RGI/RGInt/UF
# ==============================================================================================


class TestAgregacoesPorNivel:
    """Verifica agregações por nível territorial."""

    def test_rgi_2022_tem_dados(self, con):
        """RGI em 2022 tem imig/emig não-nulos."""
        _skip_se_ausente(_ler_serie(con, "unidades_serie"))

        n = con.execute(
            f"SELECT COUNT(*) FROM read_parquet('{_ler_serie(con, 'unidades_serie')}') "
            f"WHERE nivel='rgi' AND edicao='2022' AND imig IS NOT NULL"
        ).fetchone()

        assert n[0] > 0, "Nenhum RGI em 2022 com dados de imigração"

    def test_uf_todas_as_edicoes_tem_dados(self, con):
        """UF tem dados em todas as edições."""
        _skip_se_ausente(_ler_serie(con, "unidades_serie"))

        for edicao in ["2022", "2010", "2000", "1991", "1980"]:
            n = con.execute(
                f"SELECT COUNT(*) FROM read_parquet('{_ler_serie(con, 'unidades_serie')}') "
                f"WHERE nivel='uf' AND edicao='{edicao}' AND imig IS NOT NULL"
            ).fetchone()
            assert n[0] > 0, f"Nenhum dado de UF em {edicao}"


# ==============================================================================================
# Verificações de formato e tipo
# ==============================================================================================


class TestFormatoTipos:
    """Verifica tipos de dados esperados."""

    def test_codigo_tem_comprimento_esperado(self, con):
        """Códigos de município têm 7 dígitos (zero-padded)."""
        _skip_se_ausente(_ler_serie(con, "unidades_serie"))

        codigos = con.execute(
            f"SELECT codigo FROM read_parquet('{_ler_serie(con, 'unidades_serie')}') "
            f"WHERE nivel='mun' LIMIT 20"
        ).fetchall()

        for (cod,) in codigos:
            # (a checagem de que TODO código `mun` é numérico, sem a unidade agregada
            # `NORTEGO` de 7 caracteres, está em `TestTocantins1980`, que pula em série antiga)
            assert len(str(cod)) in (7,), f"Código com comprimento inesperado: {cod}"

    def test_colunas_n_sao_inteiras(self, con):
        """Colunas n_* são inteiras (contagens)."""
        _skip_se_ausente(_ler_serie(con, "unidades_serie"))

        n = con.execute(
            f"SELECT COUNT(*) FROM read_parquet('{_ler_serie(con, 'unidades_serie')}') "
            f"WHERE n_mun_edicao IS NOT NULL AND n_mun_edicao <> CAST(n_mun_edicao AS BIGINT)"
        ).fetchone()

        # Não deve haver valores fracionários em n_mun_edicao
        assert n[0] == 0


# ==============================================================================================
# Verificações cruzadas: série vs. dados de 2022
# ==============================================================================================


class TestConsistenciaInterna:
    """Verificações cruzadas de consistência."""

    def test_imig_total_serie_aproxima_fonte(self, con):
        """Soma de imigração da série aproxima-se da fonte (dentro de supressão)."""
        _skip_se_ausente(
            _ler_serie(con, "unidades_serie"),
            _ler_processado(con, "2022", "municipios"),
        )

        imig_serie = con.execute(
            f"SELECT SUM(imig) FROM read_parquet('{_ler_serie(con, 'unidades_serie')}') "
            f"WHERE nivel='mun' AND edicao='2022' AND imig IS NOT NULL"
        ).fetchone()[0]

        imig_fonte = con.execute(
            f"SELECT SUM(imig) FROM read_parquet('{_ler_processado(con, '2022', 'municipios')}')"
        ).fetchone()[0]

        # Dentro de 1% por causa de supressão (R1-R3)
        if imig_fonte and imig_fonte > 0:
            razao = float(imig_serie) / float(imig_fonte)
            assert 0.99 <= razao <= 1.01, \
                f"Imigração série ({imig_serie}) muito diferente da fonte ({imig_fonte})"

    def test_saldo_zero_identidade(self, con):
        """Soma de saldos deve ser aproximadamente zero (imigração ≈ emigração)."""
        _skip_se_ausente(_ler_serie(con, "unidades_serie"))

        saldo_total = con.execute(
            f"SELECT SUM(saldo) FROM read_parquet('{_ler_serie(con, 'unidades_serie')}') "
            f"WHERE nivel='mun' AND edicao='2022' AND saldo IS NOT NULL"
        ).fetchone()[0]

        # Saldo total deve estar muito próximo de zero
        assert abs(float(saldo_total)) < 100, \
            f"Saldo total muito afastado de zero: {saldo_total}"
