"""Limiares efetivos de R1/R2 por edição (`disclosure_rules.limiares`).

Guarda a decisão de F9.5: a edição Censo 1980 não tem chave de domicílio, o piso `ndom >= 3`
de R1 não é calculável, e ela publica com limiares substitutos (`n >= 20` na linha, `n >= 50`
no detalhe) calibrados contra as quatro edições que têm a chave -- ver docs/METODOLOGIA.md,
item 8.2 da seção do Censo 1980.

Estes testes NÃO leem microdados nem `data/processed`: rodam em qualquer clone. O que eles
protegem é a fronteira da exceção -- que ela vale só onde deve valer, e que as outras quatro
edições continuam produzindo exatamente o predicado de antes.
"""
import pathlib
import sys

import pytest

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / "pipeline"))
import disclosure_rules as R  # noqa: E402
from edicoes import EDICOES  # noqa: E402

# Predicado literal que publish.py/disclosure_check.py usavam antes de F9.5. Toda edição com
# chave de domicílio tem de continuar gerando exatamente isto: a exceção de 1980 não pode
# afrouxar nem por um caractere o que as demais aplicam.
R1_LEGADO = "n >= 5 AND ndom >= 3"
R1_LEGADO_VIOLA = "c.n IS NULL OR c.n < 5 OR c.ndom < 3"
R2_LEGADO = "n >= 20 AND ndom >= 3"

# Maior célula observada, em qualquer tabela de qualquer edição com chave de domicílio, que o
# piso de domicílios rejeitaria (perfis municipais de 2022, n = 36; fluxos de 1991, n = 23).
# O piso de DETALHE de uma edição sem chave tem de ficar acima dela -- é o critério de
# calibração registrado em docs/METODOLOGIA.md.
MAIOR_CELULA_SEM_3_DOMICILIOS = 36

COM_CHAVE = [n for n, e in EDICOES.items() if e.chave_domicilio]
SEM_CHAVE = [n for n, e in EDICOES.items() if not e.chave_domicilio]


def test_apenas_1980_declara_ausencia_de_chave_de_domicilio():
    """A exceção não pode se espalhar para outra edição sem decisão metodológica nova."""
    assert SEM_CHAVE == ["1980"], (
        f"Edições sem chave de domicílio: {SEM_CHAVE}. Só 1980 tem essa decisão registrada "
        "(docs/METODOLOGIA.md, item 8.2). Uma edição nova precisa recalibrar os limiares "
        "substitutos contra as edições que têm a chave antes de declarar chave_domicilio=False."
    )
    assert len(COM_CHAVE) == 4


@pytest.mark.parametrize("nome", COM_CHAVE)
def test_edicao_com_domicilio_mantem_o_predicado_de_sempre(nome):
    L = R.limiares(EDICOES[nome].chave_domicilio)
    assert L.sql_r1() == R1_LEGADO
    assert L.sql_r2() == R2_LEGADO
    assert L.sql_viola_r1("c.n", "c.ndom") == R1_LEGADO_VIOLA
    assert (L.min_pessoas, L.min_domicilios) == (R.MIN_PESSOAS, R.MIN_DOMICILIOS)
    assert L.min_pessoas_detalhe == R.MIN_PESSOAS_DETALHE
    assert L.faixas_abaixo_r1() == ["<5"]
    assert not L.sem_chave_domicilio


@pytest.mark.parametrize("nome", SEM_CHAVE)
def test_edicao_sem_domicilio_usa_o_substituto_calibrado(nome):
    L = R.limiares(EDICOES[nome].chave_domicilio)
    assert L.sem_chave_domicilio and L.min_domicilios is None
    # nenhum predicado desta edição pode mencionar domicílio: `NULL >= 3` nunca é verdadeiro e
    # descartaria toda linha em silêncio, que é exatamente o bug que a decisão de F9.5 evita.
    for sql in (L.sql_r1(), L.sql_r2(), L.sql_viola_r1(), L.sql_r1("f.n", "f.ndom")):
        assert "ndom" not in sql and "controle" not in sql
    # o substituto é mais restritivo, nunca mais frouxo, que o piso de pessoas padrão
    assert L.min_pessoas > R.MIN_PESSOAS
    assert L.min_pessoas_detalhe > R.MIN_PESSOAS_DETALHE
    # uma linha publicada aqui já passa no piso de DETALHE das outras edições
    assert L.min_pessoas >= R.MIN_PESSOAS_DETALHE
    # e o detalhe só sai acima da maior célula que o piso de domicílios rejeitaria
    assert L.min_pessoas_detalhe > MAIOR_CELULA_SEM_3_DOMICILIOS
    # R5: nenhuma categoria nominal pode cair numa faixa inteiramente abaixo do piso
    assert L.faixas_abaixo_r1() == ["<5", "5-19"]


@pytest.mark.parametrize("chave", [True, False])
def test_sql_viola_r1_e_a_negacao_exata_de_sql_r1(chave):
    """A verificação independente do gate não pode divergir da regra que publish.py aplica."""
    duckdb = pytest.importorskip("duckdb")
    L = R.limiares(chave)
    con = duckdb.connect()
    # grade sintética (não são microdados): todos os pares (n, ndom) plausíveis, mais os NULL
    con.execute("""
        CREATE TABLE g AS
        SELECT n, ndom FROM range(0, 60) t(n), range(0, 8) u(ndom)
        UNION ALL SELECT NULL, NULL UNION ALL SELECT 30, NULL UNION ALL SELECT NULL, 5
    """)
    divergentes = con.execute(f"""
        SELECT COUNT(*) FROM g
        WHERE COALESCE({L.sql_r1()}, false) = COALESCE({L.sql_viola_r1()}, true)
    """).fetchone()[0]
    assert divergentes == 0


def test_faixas_abaixo_r1_cobre_exatamente_as_faixas_sob_o_piso():
    for chave in (True, False):
        L = R.limiares(chave)
        for lo, hi, rot in R.FAIXAS_N:
            proibida = rot in L.faixas_abaixo_r1()
            # faixa proibida <=> ela termina abaixo do piso (nenhum n dela seria publicável)
            assert proibida == (hi is not None and hi < L.min_pessoas), rot
            if not proibida:
                assert R.faixa_n(max(lo, L.min_pessoas)) == rot or lo < L.min_pessoas
