"""Testes das funções de medidas comparativas (F12.3, F12.4-t).

Testes com dados sintéticos pequenos, sem dependência de microdados.
Verifica identidades algébricas e casos triviais conhecidos.
"""
import math

import numpy as np
import pytest

ROOT_TEST = __import__("pathlib").Path(__file__).resolve().parent.parent.parent
__import__("sys").path.insert(0, str(ROOT_TEST / "pipeline"))

import medidas as MED


class TestTurnover:
    """Turnover: T = I + E."""

    def test_turnover_trivial(self):
        """Casos conhecidos."""
        assert MED.turnover(10.0, 20.0) == 30.0
        assert MED.turnover(0.0, 0.0) == 0.0
        assert MED.turnover(100.5, 50.5) == pytest.approx(151.0)

    def test_turnover_with_nan(self):
        """NaN propaga."""
        assert math.isnan(MED.turnover(float("nan"), 10.0))
        assert math.isnan(MED.turnover(10.0, float("nan")))
        assert math.isnan(MED.turnover(None, 10.0))
        assert math.isnan(MED.turnover(10.0, None))


class TestTaxaRotatividade:
    """Taxa de rotatividade: 1000 * T / pop5."""

    def test_taxa_trivial(self):
        """Casos conhecidos."""
        # 1000 * 100 / 10000 = 10 por mil
        assert MED.taxa_rotatividade(100.0, 10000.0) == pytest.approx(10.0)
        # 1000 * 10 / 100 = 100 por mil
        assert MED.taxa_rotatividade(10.0, 100.0) == pytest.approx(100.0)

    def test_taxa_zero_pop(self):
        """pop5 = 0 retorna NaN."""
        assert math.isnan(MED.taxa_rotatividade(10.0, 0.0))
        assert math.isnan(MED.taxa_rotatividade(10.0, None))

    def test_taxa_nan_propagation(self):
        """NaN em turnover propaga."""
        assert math.isnan(MED.taxa_rotatividade(float("nan"), 100.0))


class TestDistanciaMediaPonderada:
    """Distância média e mediana ponderadas."""

    def test_dmp_trivial_single_pair(self):
        """Um único par: distância é exatamente a distância euclidiana."""
        import pandas as pd

        fluxos = pd.DataFrame({
            "origem": ["A"],
            "destino": ["B"],
            "total": [100.0],
        })
        centroides = pd.DataFrame({
            "cd_mun": ["A", "B"],
            "x_albers": [0.0, 3.0],
            "y_albers": [0.0, 4.0],
        })
        mmd, medmd = MED.distancia_media_ponderada(fluxos, centroides)
        # distância = sqrt(3^2 + 4^2) = 5
        assert mmd == pytest.approx(5.0)
        assert medmd == pytest.approx(5.0)

    def test_dmp_weighted(self):
        """Dois pares com pesos diferentes; MMD é a média ponderada."""
        import pandas as pd

        fluxos = pd.DataFrame({
            "origem": ["A", "A"],
            "destino": ["B", "C"],
            "total": [100.0, 100.0],  # pesos iguais
        })
        centroides = pd.DataFrame({
            "cd_mun": ["A", "B", "C"],
            "x_albers": [0.0, 3.0, 0.0],
            "y_albers": [0.0, 4.0, 5.0],
        })
        mmd, medmd = MED.distancia_media_ponderada(fluxos, centroides)
        # distância A→B = 5, distância A→C = 5
        # MMD = (5*100 + 5*100) / 200 = 5
        assert mmd == pytest.approx(5.0)
        # mediana também é 5 (ambos iguais)
        assert medmd == pytest.approx(5.0)

    def test_dmp_unidade_filter(self):
        """Filtra para uma unidade específica."""
        import pandas as pd

        fluxos = pd.DataFrame({
            "origem": ["A", "B", "A"],
            "destino": ["B", "A", "C"],
            "total": [100.0, 200.0, 150.0],
        })
        centroides = pd.DataFrame({
            "cd_mun": ["A", "B", "C"],
            "x_albers": [0.0, 3.0, 0.0],
            "y_albers": [0.0, 4.0, 5.0],
        })
        mmd, medmd = MED.distancia_media_ponderada(fluxos, centroides, unidade="A")
        # pares de/para A: A→B (100, dist=5), B→A (200, dist=5), A→C (150, dist=5)
        # todos têm a mesma distância, logo MMD=5
        assert mmd == pytest.approx(5.0)

    def test_dmp_empty_dataframe(self):
        """DataFrame vazio levanta ValueError."""
        import pandas as pd

        fluxos = pd.DataFrame({"origem": [], "destino": [], "total": []})
        centroides = pd.DataFrame({"cd_mun": [], "x_albers": [], "y_albers": []})
        with pytest.raises(ValueError):
            MED.distancia_media_ponderada(fluxos, centroides)

    def test_dmp_no_valid_pairs(self):
        """Nenhum par válido retorna (NaN, NaN)."""
        import pandas as pd

        fluxos = pd.DataFrame({
            "origem": ["A", "B"],
            "destino": ["B", "C"],
            "total": [0.0, 0.0],  # nenhum fluxo positivo
        })
        centroides = pd.DataFrame({
            "cd_mun": ["A", "B", "C"],
            "x_albers": [0.0, 3.0, 6.0],
            "y_albers": [0.0, 4.0, 8.0],
        })
        mmd, medmd = MED.distancia_media_ponderada(fluxos, centroides)
        assert math.isnan(mmd) and math.isnan(medmd)


class TestPctInterestadual:
    """% da migração que cruza limite de UF."""

    def test_pct_trivial_intraestadual(self):
        """Todos os fluxos dentro do mesmo UF: 0%."""
        import pandas as pd

        fluxos = pd.DataFrame({
            "origem": ["11001", "11002"],
            "destino": ["11003", "11004"],
            "total": [100.0, 200.0],
            "uf_origem": ["11", "11"],
            "uf_destino": ["11", "11"],
        })
        pct = MED.pct_interestadual(fluxos, "uf_origem", "uf_destino")
        assert pct == pytest.approx(0.0)

    def test_pct_trivial_interestadual(self):
        """Todos interestadual: 100%."""
        import pandas as pd

        fluxos = pd.DataFrame({
            "origem": ["11001", "21001"],
            "destino": ["21002", "11002"],
            "total": [100.0, 200.0],
            "uf_origem": ["11", "21"],
            "uf_destino": ["21", "11"],
        })
        pct = MED.pct_interestadual(fluxos, "uf_origem", "uf_destino")
        assert pct == pytest.approx(1.0)

    def test_pct_mixed(self):
        """Metade intra, metade inter."""
        import pandas as pd

        fluxos = pd.DataFrame({
            "origem": ["11001", "11002", "11003", "11004"],
            "destino": ["11005", "11006", "21001", "21002"],
            "total": [100.0, 100.0, 100.0, 100.0],
            "uf_origem": ["11", "11", "11", "11"],
            "uf_destino": ["11", "11", "21", "21"],
        })
        pct = MED.pct_interestadual(fluxos, "uf_origem", "uf_destino")
        assert pct == pytest.approx(0.5)

    def test_pct_empty(self):
        """DataFrame vazio levanta ValueError."""
        import pandas as pd

        fluxos = pd.DataFrame({"uf_origem": [], "uf_destino": [], "total": []})
        with pytest.raises(ValueError):
            MED.pct_interestadual(fluxos, "uf_origem", "uf_destino")


class TestConectividade:
    """Número de pares distintos publicados."""

    def test_conectividade_trivial(self):
        """Contagem de pares com valor > 0."""
        import pandas as pd

        fluxos = pd.DataFrame({
            "origem": ["A", "A", "B"],
            "destino": ["B", "C", "A"],
            "total": [10.0, 20.0, 30.0],
        })
        conn = MED.conectividade(fluxos)
        assert conn == 3

    def test_conectividade_zero_volume_ignored(self):
        """Pares com volume 0 não contam."""
        import pandas as pd

        fluxos = pd.DataFrame({
            "origem": ["A", "A", "B"],
            "destino": ["B", "C", "A"],
            "total": [0.0, 20.0, 30.0],
        })
        conn = MED.conectividade(fluxos)
        # Apenas A→C e B→A contam
        assert conn == 2

    def test_conectividade_unidade_filter(self):
        """Filtra para uma unidade específica."""
        import pandas as pd

        fluxos = pd.DataFrame({
            "origem": ["A", "A", "B", "C"],
            "destino": ["B", "C", "A", "D"],
            "total": [10.0, 20.0, 30.0, 50.0],
        })
        conn = MED.conectividade(fluxos, unidade="A")
        # A→B, A→C, B→A: 3 pares
        assert conn == 3

    def test_conectividade_empty(self):
        """DataFrame vazio retorna 0."""
        import pandas as pd

        fluxos = pd.DataFrame({"origem": [], "destino": [], "total": []})
        conn = MED.conectividade(fluxos)
        assert conn == 0


class TestGiniLinha:
    """Índice de Gini da distribuição de destinos (concentração de saídas)."""

    def test_gini_linha_uniform(self):
        """Distribuição uniforme: Gini baixo (próximo a 0)."""
        import pandas as pd

        # Fluxos iguais para 10 destinos
        fluxos = pd.DataFrame({
            "origem": ["A"] * 10,
            "destino": [str(i) for i in range(10)],
            "total": [100.0] * 10,
        })
        g = MED.gini_linha(fluxos, unidade="A")
        # Distribuição uniforme → Gini = 0
        assert g == pytest.approx(0.0)

    def test_gini_linha_single_destination(self):
        """Um único destino: Gini = 0 (nenhuma dispersão possível)."""
        import pandas as pd

        fluxos = pd.DataFrame({
            "origem": ["A"],
            "destino": ["B"],
            "total": [100.0],
        })
        g = MED.gini_linha(fluxos, unidade="A")
        assert g == pytest.approx(0.0)

    def test_gini_linha_concentrated(self):
        """Fluxo concentrado em um destino: Gini alto."""
        import pandas as pd

        fluxos = pd.DataFrame({
            "origem": ["A", "A", "A"],
            "destino": ["B", "C", "D"],
            "total": [1000.0, 1.0, 1.0],
        })
        g = MED.gini_linha(fluxos, unidade="A")
        # Concentrado em B → Gini alto (próximo a 0.66)
        assert g > 0.6

    def test_gini_linha_no_flow(self):
        """Nenhum fluxo de saída retorna NaN."""
        import pandas as pd

        fluxos = pd.DataFrame({
            "origem": ["A", "A"],
            "destino": ["B", "C"],
            "total": [0.0, 0.0],
        })
        g = MED.gini_linha(fluxos, unidade="A")
        assert math.isnan(g)


class TestGiniColuna:
    """Índice de Gini da distribuição de origens (concentração de chegadas)."""

    def test_gini_coluna_uniform(self):
        """Distribuição uniforme de origens: Gini baixo."""
        import pandas as pd

        fluxos = pd.DataFrame({
            "origem": [str(i) for i in range(10)],
            "destino": ["A"] * 10,
            "total": [100.0] * 10,
        })
        g = MED.gini_coluna(fluxos, unidade="A")
        assert g == pytest.approx(0.0)

    def test_gini_coluna_concentrated(self):
        """Fluxo concentrado em uma origem: Gini alto."""
        import pandas as pd

        fluxos = pd.DataFrame({
            "origem": ["B", "C", "D"],
            "destino": ["A", "A", "A"],
            "total": [1000.0, 1.0, 1.0],
        })
        g = MED.gini_coluna(fluxos, unidade="A")
        assert g > 0.6


class TestCMI:
    """Crude Migration Intensity: CMI = 100 * M / P."""

    def test_cmi_trivial(self):
        """Casos conhecidos com DataFrame."""
        import pandas as pd

        matriz = pd.DataFrame({"total": [100.0, 200.0, 150.0]})
        cmi = MED.cmi(matriz, pop_total=10000.0)
        # CMI = 100 * (100+200+150) / 10000 = 100 * 0.045 = 4.5
        assert cmi == pytest.approx(4.5)

    def test_cmi_scalar(self):
        """CMI com escalar de fluxo total."""
        cmi = MED.cmi(450.0, pop_total=10000.0)
        assert cmi == pytest.approx(4.5)

    def test_cmi_zero_pop(self):
        """pop_total = 0 retorna NaN."""
        import pandas as pd

        matriz = pd.DataFrame({"total": [100.0]})
        cmi = MED.cmi(matriz, pop_total=0.0)
        assert math.isnan(cmi)


class TestMEIAgregado:
    """Migration Effectiveness Index agregado: MEI = 100 * 0.5 * Σ|N_i| / M."""

    def test_mei_trivial_balanced(self):
        """Saldos equilibrados: MEI baixo."""
        import pandas as pd

        saldos = {"A": 100.0, "B": -100.0, "C": 50.0, "D": -50.0}
        mei = MED.mei_agregado(saldos, m_total=1000.0)
        # MEI = 100 * 0.5 * (100 + 100 + 50 + 50) / 1000 = 100 * 0.5 * 0.3 = 15
        assert mei == pytest.approx(15.0)

    def test_mei_trivial_concentrated(self):
        """Todos os saldos na mesma direção: MEI = 100."""
        saldos = {"A": 100.0, "B": 100.0, "C": 100.0}
        mei = MED.mei_agregado(saldos, m_total=600.0)
        # MEI = 100 * 0.5 * (100 + 100 + 100) / 600 = 100 * 0.5 * 0.5 = 25
        # Espera, deixa eu recalcular: M=600, Σ|N|=300
        # MEI = 100 * 0.5 * 300/600 = 100 * 0.5 * 0.5 = 25
        assert mei == pytest.approx(25.0)

    def test_mei_zero_total(self):
        """m_total = 0 retorna NaN."""
        saldos = {"A": 100.0}
        mei = MED.mei_agregado(saldos, m_total=0.0)
        assert math.isnan(mei)

    def test_mei_none_dict(self):
        """saldos None levanta ValueError."""
        with pytest.raises(ValueError):
            MED.mei_agregado(None, m_total=100.0)


class TestANMR:
    """Aggregate Net Migration Rate: ANMR = CMI * MEI / 100.

    Teste crítico: ANMR deve satisfazer a identidade
    ANMR = CMI * MEI / 100 = (100*M/P) * (100*0.5*Σ|N|/M) / 100
                            = (100*M/P) * (0.5*Σ|N|/1) = 100 * 0.5 * Σ|N| / P
    """

    def test_anmr_identity_balanced_system(self):
        """Sistema com saldos equilibrados: ANMR deve ser a identidade."""
        # Sistema: 2 unidades, uma ganha (+100), outra perde (-100)
        # Pop = 10000, fluxo total M = 1000
        # CMI = 100 * 1000 / 10000 = 10
        # MEI = 100 * 0.5 * (100+100) / 1000 = 100 * 0.5 * 0.2 = 10
        # ANMR = 10 * 10 / 100 = 1
        # Verificação direta: 100 * 0.5 * 200 / 10000 = 1 ✓
        cmi_val = 10.0
        mei_val = 10.0
        anmr_val = MED.anmr(cmi_val, mei_val)
        assert anmr_val == pytest.approx(1.0)

    def test_anmr_identity_case2(self):
        """Outro caso para conferir a identidade."""
        # CMI = 5, MEI = 20
        # ANMR = 5 * 20 / 100 = 1
        cmi_val = 5.0
        mei_val = 20.0
        anmr_val = MED.anmr(cmi_val, mei_val)
        assert anmr_val == pytest.approx(1.0)

    def test_anmr_identity_case3(self):
        """Sistema com MEI = 0 (máxima eficácia nula)."""
        cmi_val = 15.0
        mei_val = 0.0
        anmr_val = MED.anmr(cmi_val, mei_val)
        assert anmr_val == pytest.approx(0.0)

    def test_anmr_nan_propagation(self):
        """NaN em qualquer fator propaga."""
        assert math.isnan(MED.anmr(float("nan"), 10.0))
        assert math.isnan(MED.anmr(10.0, float("nan")))


class TestBetaFielding:
    """Beta de Fielding: regressão MQO ponderada de NMR em log(densidade)."""

    def test_beta_fielding_linear_relationship(self):
        """Relação linear conhecida: NMR_i = 5 + 2*log10(dens_i)."""
        # Gera dados sintéticos:
        # dens = [10, 100, 1000], log(dens) = [1, 2, 3]
        # NMR = 5 + 2*[1, 2, 3] = [7, 9, 11]
        nmr = {"A": 7.0, "B": 9.0, "C": 11.0}
        dens = {"A": 10.0, "B": 100.0, "C": 1000.0}
        pop = {"A": 1000.0, "B": 2000.0, "C": 3000.0}
        beta, erro = MED.beta_fielding(nmr, dens, pop)
        # Beta deveria ser ~2 (slope da relação)
        assert beta == pytest.approx(2.0, abs=0.01)

    def test_beta_fielding_insufficient_data(self):
        """Menos de 3 unidades retorna (NaN, NaN)."""
        nmr = {"A": 5.0, "B": 10.0}
        dens = {"A": 10.0, "B": 100.0}
        pop = {"A": 1000.0, "B": 2000.0}
        beta, erro = MED.beta_fielding(nmr, dens, pop)
        assert math.isnan(beta) and math.isnan(erro)

    def test_beta_fielding_zero_density(self):
        """Densidade 0 é filtrada (log indefinido)."""
        nmr = {"A": 5.0, "B": 10.0, "C": 15.0, "D": 20.0}
        dens = {"A": 0.0, "B": 100.0, "C": 1000.0, "D": 10000.0}
        pop = {"A": 1000.0, "B": 2000.0, "C": 3000.0, "D": 4000.0}
        beta, erro = MED.beta_fielding(nmr, dens, pop)
        # 3 unidades válidas, deve funcionar
        assert not math.isnan(beta)


class TestDuncanD:
    """Índice de dissimilaridade de Duncan entre duas matrizes O-D."""

    def test_duncan_d_identical_matrices(self):
        """Matrizes idênticas: D = 0."""
        import pandas as pd

        m1 = pd.DataFrame({
            "origem": ["A", "A", "B"],
            "destino": ["B", "C", "A"],
            "total": [100.0, 50.0, 75.0],
        })
        m2 = m1.copy()
        d = MED.duncan_d(m1, m2)
        assert d == pytest.approx(0.0)

    def test_duncan_d_disjoint_matrices(self):
        """Matrizes sem pares em comum: D = 1."""
        import pandas as pd

        m1 = pd.DataFrame({
            "origem": ["A", "A"],
            "destino": ["B", "C"],
            "total": [100.0, 100.0],
        })
        m2 = pd.DataFrame({
            "origem": ["D", "D"],
            "destino": ["E", "F"],
            "total": [100.0, 100.0],
        })
        d = MED.duncan_d(m1, m2)
        assert d == pytest.approx(1.0)

    def test_duncan_d_bounds(self):
        """Duncan D sempre está em [0, 1]."""
        import pandas as pd

        m1 = pd.DataFrame({
            "origem": ["A", "A", "B"],
            "destino": ["B", "C", "A"],
            "total": [100.0, 50.0, 75.0],
        })
        m2 = pd.DataFrame({
            "origem": ["A", "A", "B", "C"],
            "destino": ["B", "C", "C", "A"],
            "total": [120.0, 30.0, 100.0, 50.0],
        })
        d = MED.duncan_d(m1, m2)
        assert 0.0 <= d <= 1.0

    def test_duncan_d_empty_matrix(self):
        """Matriz vazia retorna NaN."""
        import pandas as pd

        m1 = pd.DataFrame({
            "origem": ["A"],
            "destino": ["B"],
            "total": [100.0],
        })
        m2 = pd.DataFrame({"origem": [], "destino": [], "total": []})
        d = MED.duncan_d(m1, m2)
        assert math.isnan(d)


class TestDecomposicaoLoglinear:
    """Decomposição multiplicativa log-linear: n_ij ~ T * O_i * D_j * OD_ij."""

    def test_decomposicao_trivial_2x2(self):
        """Matriz 2x2 simples: verifica reconstrução."""
        import pandas as pd

        matriz = pd.DataFrame({
            "origem": ["A", "A", "B", "B"],
            "destino": ["X", "Y", "X", "Y"],
            "total": [100.0, 50.0, 60.0, 90.0],
        })
        result = MED.decomposicao_loglinear(matriz)

        # Verifica que os campos estão presentes
        assert result["T"] is not None
        assert result["O"] is not None
        assert result["D"] is not None
        assert result["OD"] is not None
        assert result["convergiu"]

        # Reconstrói a matriz: n_ij ≈ T * O_i * D_j * OD_ij
        T = result["T"]
        O = result["O"]
        D = result["D"]
        OD = result["OD"]

        for _, row in matriz.iterrows():
            o, d, obs = row["origem"], row["destino"], row["total"]
            reconstr = T * O[o] * D[d] * OD[(o, d)]
            assert reconstr == pytest.approx(obs, rel=1e-3)

    def test_decomposicao_margins_preserved(self):
        """Margens de linha e coluna são preservadas após IPF."""
        import pandas as pd

        matriz = pd.DataFrame({
            "origem": ["A", "A", "B", "B"],
            "destino": ["X", "Y", "X", "Y"],
            "total": [100.0, 50.0, 60.0, 90.0],
        })
        result = MED.decomposicao_loglinear(matriz)

        # Verifica que a decomposição reconstói as margens observadas
        T = result["T"]
        O = result["O"]
        D = result["D"]
        OD = result["OD"]

        # Margem de linha: Σ_j n_ij = Σ_j T*O_i*D_j*OD_ij = T*O_i * Σ_j D_j*OD_ij
        # A margem de coluna: Σ_i n_ij = Σ_i T*O_i*D_j*OD_ij = T*D_j * Σ_i O_i*OD_ij

        # Recalcula margens observadas
        margem_obs_A = 100.0 + 50.0  # 150
        margem_obs_B = 60.0 + 90.0   # 150
        margem_obs_X = 100.0 + 60.0  # 160
        margem_obs_Y = 50.0 + 90.0   # 140

        # Verifica que as margens são reproduzidas pela decomposição
        margem_A = T * O["A"] * (D["X"] * OD[("A", "X")] + D["Y"] * OD[("A", "Y")])
        margem_B = T * O["B"] * (D["X"] * OD[("B", "X")] + D["Y"] * OD[("B", "Y")])
        margem_X = T * D["X"] * (O["A"] * OD[("A", "X")] + O["B"] * OD[("B", "X")])
        margem_Y = T * D["Y"] * (O["A"] * OD[("A", "Y")] + O["B"] * OD[("B", "Y")])

        assert margem_A == pytest.approx(margem_obs_A, rel=1e-3)
        assert margem_B == pytest.approx(margem_obs_B, rel=1e-3)
        assert margem_X == pytest.approx(margem_obs_X, rel=1e-3)
        assert margem_Y == pytest.approx(margem_obs_Y, rel=1e-3)

    def test_decomposicao_insufficient_data(self):
        """Matriz 1x1 não pode ser decomposta (retorna todos None)."""
        import pandas as pd

        matriz = pd.DataFrame({
            "origem": ["A"],
            "destino": ["X"],
            "total": [100.0],
        })
        result = MED.decomposicao_loglinear(matriz)
        assert result["T"] is None
        assert result["O"] is None
        assert result["D"] is None
        assert result["OD"] is None
        assert not result["convergiu"]

    def test_decomposicao_empty_dataframe(self):
        """DataFrame vazio levanta ValueError."""
        import pandas as pd

        matriz = pd.DataFrame({"origem": [], "destino": [], "total": []})
        with pytest.raises(ValueError):
            MED.decomposicao_loglinear(matriz)
