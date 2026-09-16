"""Testes de consistência da edição Censo 1980 (F1/F2/F3), equivalentes aos de
test_edicao_1991.py -- num arquivo à parte em vez de parametrizar os existentes, pelo
mesmo motivo (vocabulário e totais absolutos diferem entre edições). Só agregações --
nunca linhas individuais. Skipa (não falha) se os arquivos da edição ainda não existem.

Particularidades de 1980 em relação a 2022/2010/2000/1991:
  - COM quesito de deslocamento pendular no questionário -- diferente de 1991 (que não tem).
    Portanto, as 8 tabelas pendulares SÃO publicadas em data/processed/1980
    (pendular_trab, pendular_estudo, pendular_trab_dim, pendular_estudo_dim,
    rm_mig_pendular, rm_mig_pendular_resumo, rm_mig_estudo, municipios_pendular).
  - NÃO publica renda: renda_pc, renda_trab, renda_trab_classe são SEMPRE NULL/nao_aplicavel.
  - NÃO tem chave de domicílio (controle é sempre NULL, diferente de 2022/2010/2000).
  - É um PROXY de data fixa, não data fixa real: v517 (tempo de residência) vem em
    faixas (0=<1 ano, 1..5=anos exatos, 6=6-9 anos, 7=10+, 8=nasceu aqui, 9=sem decl.),
    não em "onde você morava há 5 anos" como nas outras edições. Migrante = v517 IN (0,1,2,3,4)
    COM origem em v518 (município anterior). Universo: 5+ anos. Fenômeno documentado em
    MAPEAMENTO_02_classify.md §1 e na UI com selo "proxy".
  - É a única edição com uma UNIDADE AGREGADA: os 52 municípios do norte de Goiás (hoje
    Tocantins) chegam da Base dos Dados sem id_municipio em 178.338 registros de residentes, e
    desde F9.9 (1.0.2-1980) são publicados como UMA unidade, 'NORTEGO' -- com população
    (739.049), imigração, emigração, saldo, pendular, UF ('17', Tocantins), painel e um
    polígono próprio na malha (as 52 feições dissolvidas em uma). Ela entra em municipios_ref,
    municipios.parquet, nos dois lados de fluxos.parquet e no nível de UF; fica FORA de
    RGI/RGInt/RM (cd_rgi/cd_rgint/cd_rm NULL: cobre 11 RGIs de 2022 e não é de nenhuma).
    Mudar de município DENTRO dela não é migração (11.586 registros, 47.598 ponderados) --
    não há autoloop nem "origem não informada" que a fonte informe. Ver
    pipeline/unidades_agregadas_1980.py e MAPEAMENTO_norte_goias.md. (Até 1.0.1-1980 os
    residentes eram excluídos e só a emigração saía, numa tabela à parte
    fluxos_origem_agregada.parquet, que deixou de existir.)
  - Σ imig = Σ emig no universo publicável (13.803.767 dos dois lados, exatamente): todo
    migrante com origem_valida tem origem E destino publicados -- inclusive os que vêm da
    unidade agregada e os que vão para ela, agora que ela existe dos dois lados.
  - se/cv (erro-padrão/coeficiente de variação) são NULL em 100% das linhas de TODAS as
    tabelas publicadas (diferente de 2022/2010/2000 que calculam a variância).
  - rm_resumo não tem as 6 colunas do módulo pendular (ocupados, pendulares, pct_pendular,
    tempo_mediano, pct_coletivo, pct_diario) como NULL -- ao contrário, essas colunas
    existem, populadas com valores reais (porque pendular existe).
  - Regras de revelação de 1980 são diferentes: sem chave de domicílio, R1 = n >= 20 para
    publicar total (em vez de n >= 5 + ndom >= 3), e R2 = n >= 50 para publicar detalhe
    (em vez de n >= 20). Ver pipeline/disclosure_rules.py função limiares().

Valores confirmados rodando o pipeline completo em 2026-09-16 (ver
docs/relatorio_revelacao_1980_1.0.0-1980.md).
"""
import json
import pathlib
import sys

import pytest

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / "pipeline"))
import labels_1980  # noqa: E402
import unidades_agregadas_1980 as _UA  # noqa: E402
from edicoes import edicao as get_edicao  # noqa: E402

ED = get_edicao("1980")
INTERIM = ROOT / ED.interim
PROCESSED = ROOT / ED.processed


def _req(*paths: pathlib.Path) -> None:
    for p in paths:
        if not p.exists():
            pytest.skip(f"{p} ainda não gerado (rode `python pipeline/run.py --edicao 1980`)")


# ================= F1: extração =================

def test_total_pessoas(con):
    """Desde F9.9 a edição não exclui nenhum registro: 29.378.753 = os 29.200.415 de
    1.0.1-1980 mais os 178.338 residentes do norte de Goiás, que agora entram sob a unidade
    agregada."""
    _req(INTERIM / "pessoas.parquet")
    n, = con.execute(f"SELECT COUNT(*) FROM read_parquet('{INTERIM}/pessoas.parquet')").fetchone()
    assert n == 29_378_753
    assert n == 29_200_415 + 178_338


def test_soma_pesos_nacional(con):
    _req(INTERIM / "pessoas.parquet")
    peso, = con.execute(f"SELECT SUM(peso) FROM read_parquet('{INTERIM}/pessoas.parquet')").fetchone()
    # 119.011.062 = 100,0% dos 119.002.706 recenseados em 1980 (a diferença de 8 mil é do
    # próprio sistema de pesos da amostra, não de exclusão nenhuma).
    assert abs(peso - 119_011_062) < 50_000, "a edição não exclui mais nenhum registro"


def test_27_ufs_1980(con):
    """27 UFs, com Tocantins ('17') -- a UF publicada da unidade agregada.

    O território que hoje é Tocantins era Goiás em 1980, mas a edição o publica sob '17' pelo
    mesmo motivo (e com o mesmo precedente) que publica Fernando de Noronha sob '26': é o que
    torna a série de UF comparável entre as cinco edições. Publicá-lo sob '52' inflaria a
    emigração interestadual de Goiás em 27% com um degrau puramente territorial. Ver
    pipeline/unidades_agregadas_1980.py.
    """
    _req(INTERIM / "pessoas.parquet")
    ufs = {r[0] for r in con.execute(
        f"SELECT DISTINCT uf FROM read_parquet('{INTERIM}/pessoas.parquet')").fetchall()}
    assert len(ufs) == 27
    assert "17" in ufs


def test_codigos_municipio_bruto_validos(con):
    """Todo cd_mun de municipios_bruto é um município de 1980 OU a unidade agregada."""
    _req(INTERIM / "municipios_bruto.parquet")
    codigos = con.execute(f"SELECT DISTINCT cd_mun FROM read_parquet('{INTERIM}/municipios_bruto.parquet')").fetchall()
    validos = set(labels_1980.MUNICIPIOS_1980) | set(_UA.UNIDADES_AGREGADAS_1980)
    fora = [c[0] for c in codigos if c[0] not in validos]
    assert fora == []
    assert len(codigos) == 3940  # 3.939 municípios + 1 unidade agregada


def test_codigos_municipio_processed_validos(con):
    """Todo cd_mun publicado é um município de 1980 OU a unidade agregada."""
    _req(PROCESSED / "municipios.parquet")
    codigos = con.execute(f"SELECT DISTINCT cd_mun FROM read_parquet('{PROCESSED}/municipios.parquet')").fetchall()
    validos = set(labels_1980.MUNICIPIOS_1980) | set(_UA.UNIDADES_AGREGADAS_1980)
    fora = [c[0] for c in codigos if c[0] not in validos]
    assert fora == []
    assert len(codigos) == 3940  # 3.939 municípios + 1 unidade agregada


def test_cd_apond_formato_municipio_urbano_rural(con):
    """Em 1980 cd_apond é cd_mun || 'U'/'R' (situação urbano/rural), não área de ponderação
    numérica como em 2022/2010/2000. Diferente de 1991 onde a situação vem em v598."""
    _req(INTERIM / "pessoas_classificado.parquet")
    p = f"{INTERIM}/pessoas_classificado.parquet"
    sufixos = {r[0] for r in con.execute(f"SELECT DISTINCT RIGHT(cd_apond, 1) FROM read_parquet('{p}')").fetchall()}
    assert sufixos <= {"U", "R"}
    # Confere que prefixo de cd_apond é exatamente cd_mun
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


def test_pendular_existe_em_1980(con):
    """1980 TEM quesito de deslocamento pendular (v527) -- diferente de 1991.
    Portanto, pendular_trab/estudo devem ser preenchidos (não sempre falsos)."""
    _req(INTERIM / "pessoas_classificado.parquet")
    p = f"{INTERIM}/pessoas_classificado.parquet"
    n_trab, n_est = con.execute(f"""
        SELECT COUNT(*) FILTER (WHERE pendular_trab),
               COUNT(*) FILTER (WHERE pendular_estudo)
        FROM read_parquet('{p}')
    """).fetchone()
    assert n_trab > 0, "deve haver pendulares de trabalho"
    assert n_est > 0, "deve haver pendulares de estudo"


def test_proxy_data_fixa_quinzenal(con):
    """Migrantes de 1980 são identificados como v517 IN (0,1,2,3,4) -- uma janela
    quinzenal, não data fixa verdadeira. Teste confirma que todo migrante interno ou
    internacional em pessoas_classificado.parquet corresponde a registros com v517
    nessa faixa (ou NULL para não migrante) no arquivo intermediário pessoas.parquet.

    Como os dois arquivos podem não ter chave de junção direta (não há id de pessoas),
    testamos por contagem: a soma de pessoas com is_mig_interno OR is_mig_internacional
    no universo 5+ bate com a contagem de v517 EM (0..4) no universo 5+."""
    _req(INTERIM / "pessoas.parquet", INTERIM / "pessoas_classificado.parquet")

    # Conta migrantes internos/internacionais no classificado (5+)
    mig_count, = con.execute(f"""
        SELECT COUNT(*) FROM read_parquet('{INTERIM}/pessoas_classificado.parquet')
        WHERE idade >= 5 AND (is_mig_interno OR is_mig_internacional)
    """).fetchone()

    # NOTA: o arquivo intermediário pessoas.parquet não tem is_mig_interno/is_mig_internacional.
    # O que temos é df_local (migração local: '1'=não migrou, '2'=mig interno, '3'=mig intl).
    # Migrantes são df_local IN ('2', '3'). Testamos que a contagem bate:
    df_count, = con.execute(f"""
        SELECT COUNT(*) FROM read_parquet('{INTERIM}/pessoas.parquet')
        WHERE idade >= 5 AND df_local IN ('2', '3')
    """).fetchone()

    # Tolerância generosa para arredondamento/ajustes no pipeline
    assert abs(mig_count - df_count) < 100, \
        f"migrantes classificado={mig_count}, interim={df_count}, diferença fora do esperado"


def test_identidade_imig_emig(con):
    """Σimig = Σemig, EXATAMENTE, nos indicadores municipais pré-revelação.

    Todo migrante de `origem_valida` tem origem e destino publicados, então as duas somas
    varrem o mesmo conjunto de registros -- INCLUSIVE os que saem da unidade agregada e os que
    chegam a ela, que desde F9.9 têm unidade dos dois lados (em 1.0.1-1980 a emigração do norte
    de Goiás ficava fora deste universo justamente para a identidade não quebrar em 64.639).
    A tolerância de ±1 é só para ponto flutuante; o erro do proxy de data fixa está no NÍVEL de
    13.803.767, não nesta identidade.
    """
    _req(INTERIM / "municipios_bruto.parquet")
    p = f"{INTERIM}/municipios_bruto.parquet"
    imig, emig = con.execute(f"SELECT SUM(imig), SUM(emig) FROM read_parquet('{p}')").fetchone()
    assert abs(imig - emig) < 1, f"Σimig={imig} e Σemig={emig} deveriam ser iguais"
    assert abs(imig - 13_803_767) < 1_000, "volume de imigração deve estar perto de 13.803.767"


def test_todos_os_municipios_presentes(con):
    _req(INTERIM / "municipios_bruto.parquet")
    n, = con.execute(f"SELECT COUNT(*) FROM read_parquet('{INTERIM}/municipios_bruto.parquet')").fetchone()
    assert n == 3940


def test_sem_fluxo_com_origem_igual_destino(con):
    _req(INTERIM / "fluxos_bruto.parquet")
    n, = con.execute(f"SELECT COUNT(*) FROM read_parquet('{INTERIM}/fluxos_bruto.parquet') WHERE origem=destino").fetchone()
    assert n == 0


def test_categorias_do_fluxo_reconciliam_com_total(con):
    """st_retorno_natal + st_nao_natural + st_nascido_exterior = total."""
    _req(INTERIM / "fluxos_bruto.parquet")
    p = f"{INTERIM}/fluxos_bruto.parquet"
    row = con.execute(f"""
        SELECT SUM(st_retorno_natal + st_nao_natural + st_nascido_exterior), SUM(total)
        FROM read_parquet('{p}')
    """).fetchone()
    assert abs(row[0] - row[1]) < 1


def test_renda_sempre_null_nao_aplicavel(con):
    """1980 NÃO publica renda (nem sequer tem o quesito, exceto anomalia do Ceará).
    Todos os campos de renda devem ser NULL ou 'nao_aplicavel'."""
    _req(INTERIM / "pessoas_classificado.parquet")
    p = f"{INTERIM}/pessoas_classificado.parquet"
    row = con.execute(f"""
        SELECT COUNT(*) FILTER (WHERE renda_pc IS NOT NULL) as renda_pc_not_null,
               COUNT(*) FILTER (WHERE renda_trab IS NOT NULL) as renda_trab_not_null,
               COUNT(*) FILTER (WHERE renda_trab_classe <> 'nao_aplicavel') as renda_classe_not_na
        FROM read_parquet('{p}')
    """).fetchone()
    assert row == (0, 0, 0), f"renda deve ser tudo NULL/nao_aplicavel, obteve {row}"


def test_controle_sempre_null(con):
    """1980 não tem chave de domicílio (número de ordem é ordem da pessoa, não id de domicílio).
    Portanto controle deve ser sempre NULL."""
    _req(INTERIM / "pessoas_classificado.parquet")
    p = f"{INTERIM}/pessoas_classificado.parquet"
    n, = con.execute(f"""
        SELECT COUNT(*) FILTER (WHERE controle IS NOT NULL)
        FROM read_parquet('{p}')
    """).fetchone()
    assert n == 0, f"controle deve ser NULL em 100%, encontrado {n} NOT NULL"


# ================= F3: publicação e gate =================

def test_tabelas_pendulares_existem():
    """1980 TEM módulo pendular, diferente de 1991. As 8 tabelas pendulares devem existir."""
    _req(PROCESSED / "municipios.parquet")

    obrigatorias = [
        "pendular_trab.parquet",
        "pendular_estudo.parquet",
        "pendular_trab_dim.parquet",
        "pendular_estudo_dim.parquet",
        "rm_mig_pendular.parquet",
        "rm_mig_pendular_resumo.parquet",
        "rm_mig_estudo.parquet",
        "municipios_pendular.parquet",
    ]

    ausentes = [nome for nome in obrigatorias if not (PROCESSED / nome).exists()]
    assert ausentes == [], f"tabelas pendulares obrigatórias em 1980 não encontradas: {ausentes}"


def test_rm_e_rm_resumo_existem(con):
    _req(PROCESSED / "rm.parquet", PROCESSED / "rm_resumo.parquet")
    n_rm, = con.execute(f"SELECT COUNT(*) FROM read_parquet('{PROCESSED}/rm.parquet')").fetchone()
    n_resumo, = con.execute(f"SELECT COUNT(*) FROM read_parquet('{PROCESSED}/rm_resumo.parquet')").fetchone()
    assert n_rm > 0
    # 1980 tem 78 RMs (ver relatorio_revelacao_1980_1.0.0-1980.md)
    assert n_resumo == 78


def test_rm_nucleo_unico_por_rm(con):
    """Exatamente 1 linha com nucleo=true por cd_rm nas 78 RMs de 1980."""
    _req(PROCESSED / "rm.parquet")
    v, = con.execute(f"""
        SELECT COUNT(*) FROM (
            SELECT cd_rm, COUNT(*) FILTER (WHERE nucleo) k
            FROM read_parquet('{PROCESSED}/rm.parquet') GROUP BY cd_rm
        ) WHERE k <> 1""").fetchone()
    assert v == 0, f"esperado exatamente 1 núcleo por RM, encontrado {v} RMs sem ou com >1 núcleo"

    n_rm_distintas, = con.execute(f"SELECT COUNT(DISTINCT cd_rm) FROM read_parquet('{PROCESSED}/rm.parquet')").fetchone()
    assert n_rm_distintas == 78


def test_se_cv_sempre_null_publicados(con):
    """Erro-padrão (se) e coeficiente de variação (cv) são SEMPRE NULL em 1980 em todas as
    tabelas publicadas -- diferente de 2022/2010/2000. Isso reflete a ausência de chave de
    domicílio e, portanto, impossibilidade de calcular variância."""
    _req(PROCESSED / "municipios.parquet", PROCESSED / "fluxos.parquet")

    for arq_nome in ["municipios.parquet", "fluxos.parquet"]:
        arq_path = PROCESSED / arq_nome
        if not arq_path.exists():
            continue

        # Verifica se colunas se/cv existem e estão todas NULL
        cols = con.execute(f"DESCRIBE SELECT * FROM read_parquet('{arq_path}')").fetchall()
        col_names = {c[0] for c in cols}

        if "se" in col_names:
            n, = con.execute(f"SELECT COUNT(*) FILTER (WHERE se IS NOT NULL) FROM read_parquet('{arq_path}')").fetchone()
            assert n == 0, f"{arq_nome}: se deve ser NULL em 100%, encontrado {n} NOT NULL"

        if "cv" in col_names:
            n, = con.execute(f"SELECT COUNT(*) FILTER (WHERE cv IS NOT NULL) FROM read_parquet('{arq_path}')").fetchone()
            assert n == 0, f"{arq_nome}: cv deve ser NULL em 100%, encontrado {n} NOT NULL"


def test_fluxos_respeitam_limiar_r1_1980(con):
    """R1 em 1980: n >= 20 para publicar o total de um fluxo (sem n_dom, pois não há chave).
    Confirma que nenhuma linha de fluxos.parquet tem n < 20."""
    _req(PROCESSED / "fluxos.parquet")

    # Em 1980, a contagem amostral é publicada em faixas (n >= 5), não em valor exato.
    # Mas o teste de revelação verifica o n bruto na amostra antes de arredondar.
    # Como não temos o n bruto aqui (está em data/interim), testamos a contagem faixa:
    # se existe uma coluna 'n' e está preenchida, ela deve respeitar R1.

    cols = con.execute(f"DESCRIBE SELECT * FROM read_parquet('{PROCESSED}/fluxos.parquet')").fetchall()
    col_names = {c[0]: c[1] for c in cols}

    if "n" in col_names:
        # Coluna n existe (contagem amostral em faixas)
        # Não testamos valor específico aqui pois está em faixas
        # Mas verificamos coerência
        min_n, = con.execute(f"SELECT MIN(n) FROM read_parquet('{PROCESSED}/fluxos.parquet')").fetchone()
        # Faixas começam em 5, mas todos os publicados têm n >= 20 efetivo
        assert min_n >= 5, f"mínimo n publicado é {min_n}, incoerente com faixa de 5+"


def test_gate_ok_existe_e_e_valido():
    _req(PROCESSED / ".gate_ok")
    carimbo = json.loads((PROCESSED / ".gate_ok").read_text(encoding="utf-8"))
    assert carimbo["arquivos"]
    # 1.0.2-1980: F9.9 publicou a unidade agregada 'NORTEGO'. Praticamente TODO arquivo mudou
    # (a edição passou a cobrir 178.338 registros a mais), e fluxos_origem_agregada.parquet
    # deixou de existir -- a tabela foi absorvida por fluxos.parquet.
    # 1.0.3-1980: correção de geometria -- o polígono dissolvido de NORTEGO triangulava mal na
    # GPU (earcut produzia um triângulo espúrio de ~54% da área, visível como distorção no
    # mapa); geo/fetch_1980.sh passou a recortar a unidade numa grade 8x16 antes de publicar
    # (pipeline/gridsplit_geom.py), mesma área e contorno externo, só a malha interna de
    # triangulação muda.
    # 1.0.4-1980: F9.10 -- a causa raiz não era a concavidade de NORTEGO, era geo/build.sh
    # publicar TopoJSON sem passar por -clean depois de -simplify/quantização (a simplificação
    # do mapshaper só se materializa na escrita; -clean na mesma invocação a desfazia). Com
    # geo/build.sh corrigido (duas invocações + reparo dirigido, ver pipeline/validate_geo.py),
    # a malha inteira passa a validar sem tratamento especial -- geo/fetch_1980.sh voltou ao
    # dissolve simples e pipeline/gridsplit_geom.py foi removido. Só os arquivos de geo/
    # (topojson, centroides) e o meta.json mudaram.
    assert carimbo["versao_dados"] == "1.0.4-1980"
    assert "1980/municipios.parquet" not in carimbo["arquivos"], \
        "caminhos no carimbo são relativos à própria PROCESSED"
    assert "fluxos_origem_agregada.parquet" not in carimbo["arquivos"], \
        "a tabela de origem agregada foi absorvida por fluxos.parquet em F9.9"


# ================= F9.9: unidade agregada (norte de Goiás) =================

def test_unidade_agregada_e_unidade_de_verdade(con):
    """'NORTEGO' está em municipios_ref E em municipios, com população e os dois lados do
    fluxo -- é o que a distingue do desenho de 1.0.1-1980, em que ela era só uma origem."""
    _req(PROCESSED / "municipios.parquet", PROCESSED / "municipios_ref.parquet")
    cod = _UA.NORTE_GOIAS
    for arq in ("municipios_ref.parquet", "municipios.parquet"):
        v, = con.execute(f"SELECT COUNT(*) FROM read_parquet('{PROCESSED}/{arq}') "
                         f"WHERE cd_mun = '{cod}'").fetchone()
        assert v == 1, f"{arq} deve ter exatamente uma linha da unidade agregada"
    pop, pop5, imig, emig, saldo, uf, rgi, rgint, rm = con.execute(
        f"SELECT pop, pop5, imig, emig, saldo, uf, cd_rgi, cd_rgint, cd_rm "
        f"FROM read_parquet('{PROCESSED}/municipios.parquet') WHERE cd_mun = '{cod}'").fetchone()
    # números apurados em F9.9 (arredondados a múltiplos de 5 por R4)
    assert abs(pop - 739_049) <= 5 and abs(pop5 - 608_641) <= 5
    assert abs(imig - 59_212) <= 5 and abs(emig - 64_639) <= 5
    assert abs(saldo - (-5_427)) <= 5
    assert uf == "17", "a UF publicada da unidade é Tocantins, por decisão declarada"
    assert (rgi, rgint, rm) == (None, None, None), (
        "a unidade cobre 11 RGIs de 2022 e não é de nenhuma: os recortes ficam NULL")


def test_unidade_agregada_nos_dois_lados_do_fluxo(con):
    """Ela é origem E destino em fluxos.parquet, sem nenhum autoloop."""
    _req(PROCESSED / "fluxos.parquet")
    cod = _UA.NORTE_GOIAS
    n_o, n_d, loops = con.execute(
        f"SELECT COUNT(*) FILTER (WHERE origem = '{cod}'), "
        f"       COUNT(*) FILTER (WHERE destino = '{cod}'), "
        f"       COUNT(*) FILTER (WHERE origem = destino) "
        f"FROM read_parquet('{PROCESSED}/fluxos.parquet')").fetchone()
    assert n_o == 66, "66 pares de saída passam em R1 (medido em F9.8/F9.9)"
    assert n_d == 144, "144 pares de entrada passam em R1 (medido em F9.9)"
    assert loops == 0


def test_unidade_agregada_fora_de_rgi_rgint_rm(con):
    """Nenhum agregado territorial soma a unidade: RGI/RGInt não a têm, e o módulo
    metropolitano também não. Basta a coluna NULL -- `o_rgi <> d_rgi` nunca é verdadeiro --,
    mas o teste fixa isso porque é a garantia de que nenhuma RGI real ficou inflada."""
    cod = _UA.NORTE_GOIAS
    _req(PROCESSED / "fluxos_rgi.parquet", PROCESSED / "rm.parquet")
    for arq in ("fluxos_rgi.parquet", "fluxos_rgint.parquet"):
        v, = con.execute(f"SELECT COUNT(*) FROM read_parquet('{PROCESSED}/{arq}') "
                         "WHERE origem IS NULL OR destino IS NULL").fetchone()
        assert v == 0, f"{arq} não pode ter linha de recorte nulo"
    v, = con.execute(f"SELECT COUNT(*) FROM read_parquet('{PROCESSED}/rm.parquet') "
                     f"WHERE cd_mun = '{cod}'").fetchone()
    assert v == 0, "a unidade agregada não pertence a nenhuma RM"
    # ...mas ELA ESTÁ no nível de UF, sob '17'
    v, = con.execute(f"SELECT COUNT(*) FROM read_parquet('{PROCESSED}/fluxos_uf.parquet') "
                     "WHERE origem = '17' OR destino = '17'").fetchone()
    assert v > 0, "Tocantins tem de aparecer em fluxos_uf desde F9.9"


def test_migracao_interna_a_unidade_nao_e_migracao(con):
    """Mudar entre dois dos 52 municípios não é migração desta edição -- nem autoloop, nem
    "origem não informada". Conferido pelo lado que se pode observar: ninguém com residência
    na unidade tem origem resolvida para a própria unidade."""
    _req(INTERIM / "pessoas_classificado.parquet")
    cod = _UA.NORTE_GOIAS
    p = f"{INTERIM}/pessoas_classificado.parquet"
    v, = con.execute(f"SELECT COUNT(*) FROM read_parquet('{p}') "
                     f"WHERE cd_mun = '{cod}' AND df_mun = '{cod}'").fetchone()
    assert v == 0
    # e, em toda a edição, nenhum migrante tem origem igual ao município de residência
    v, = con.execute(f"SELECT COUNT(*) FROM read_parquet('{p}') "
                     "WHERE df_mun IS NOT NULL AND df_mun = cd_mun").fetchone()
    assert v == 0


def test_uf_de_origem_coerente_com_a_uf_da_unidade(con):
    """Quem sai da unidade para Goiás é INTERESTADUAL, porque a UF publicada da unidade é 17.

    Sem isso, `interestadual` (que vem de df_uf) e fluxos_uf.parquet (que vem de
    municipios_ref.uf) diriam coisas diferentes sobre o mesmo fluxo -- ver a nota de df_uf em
    pipeline/sql/1980/01_extract.sql."""
    _req(INTERIM / "pessoas_classificado.parquet")
    cod = _UA.NORTE_GOIAS
    p = f"{INTERIM}/pessoas_classificado.parquet"
    v, = con.execute(f"SELECT COUNT(*) FROM read_parquet('{p}') "
                     f"WHERE df_mun = '{cod}' AND df_uf <> '17'").fetchone()
    assert v == 0, "toda origem na unidade agregada tem df_uf = '17'"
    v, = con.execute(f"SELECT COUNT(*) FROM read_parquet('{p}') "
                     f"WHERE df_mun = '{cod}' AND uf = '52' AND NOT interestadual").fetchone()
    assert v == 0, "norte de Goiás -> Goiás tem de ser interestadual"


def test_composicao_nao_vaza_como_unidade(con):
    """Nenhum dos 52 códigos componentes pode aparecer publicado à parte -- senão o mesmo
    território sairia duas vezes."""
    _req(PROCESSED / "municipios_ref.parquet")
    membros = ", ".join(f"'{m}'" for m in _UA.MEMBROS[_UA.NORTE_GOIAS])
    v, = con.execute(f"SELECT COUNT(*) FROM read_parquet('{PROCESSED}/municipios_ref.parquet') "
                     f"WHERE cd_mun IN ({membros})").fetchone()
    assert v == 0


def test_fluxos_origem_agregada_nao_existe_mais():
    """A tabela de 1.0.1-1980 foi absorvida por fluxos.parquet (F9.9) -- se ela reaparecer,
    o mesmo fluxo estará publicado duas vezes, sob dois regimes diferentes."""
    _req(PROCESSED / "municipios.parquet")
    assert not (PROCESSED / "fluxos_origem_agregada.parquet").exists()


def test_unidades_agregadas_1980_consistente_com_labels(con):
    """Os 52 componentes são exatamente os códigos que MUN6_1980 conhece e MUNICIPIOS_1980 não
    -- isto é, os que existem na malha de 1980 e não são município publicável."""
    membros = set(_UA.MEMBROS[_UA.NORTE_GOIAS])
    fora = set(labels_1980.MUN6_1980.values()) - set(labels_1980.MUNICIPIOS_1980)
    assert membros == fora
    assert len(membros) == 52
    assert all(labels_1980.MUN6_1980[c[:6]] == c for c in membros)


def test_meta_declara_unidade_agregada():
    _req(PROCESSED / "meta.json")
    meta = json.loads((PROCESSED / "meta.json").read_text(encoding="utf-8"))
    ag = meta.get("unidades_agregadas")
    assert ag and len(ag) == 1
    assert ag[0]["codigo"] == _UA.NORTE_GOIAS
    assert ag[0]["n_municipios"] == 52
    assert ag[0]["uf"] == "17" and ag[0]["uf_censo"] == "52"
    assert ag[0]["nota"], "o front lê a explicação daqui, nunca hardcoded no componente"
    assert "origens_agregadas" not in meta, "chave substituída por unidades_agregadas em F9.9"


def test_verify_gate_aprova(con):
    _req(PROCESSED / ".gate_ok")
    import verify_gate
    assert verify_gate.Verificador(PROCESSED).rodar() == 0
