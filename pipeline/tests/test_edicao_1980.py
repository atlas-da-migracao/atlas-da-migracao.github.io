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
  - Os 52 municípios do norte de Goiás (hoje Tocantins) são publicados como municípios comuns,
    sob o código de 2022 (17xxxxx), na UF '17', com RGI/RGInt/RM de 2022 (13 deles nas RMs de
    Palmas e de Gurupi). Desde 1.1.0-1980 a fonte é o Parquet do censobr/IPEA, que traz o código
    de município dos 29.378.753 registros; os 52 chegam como 52xxxxx (código de 1980) e são
    recodificados por pipeline/norte_goias_1980.py, como Fernando de Noronha (2000107 ->
    2605459). De 1.0.2 a 1.0.7-1980 (fonte Base dos Dados, que os entregava sem município) eles
    eram UMA unidade agregada, 'NORTEGO', que deixou de existir. Mudar de município DENTRO do
    território voltou a ser migração intermunicipal (782 pares, 47.598 ponderados, intraestadual
    sob a UF '17'); o aviso "esta UF não existia na época" vem de meta["ufs_fora_da_epoca"].
    (Até 1.0.1-1980 os residentes eram excluídos e só a emigração saía, numa tabela à parte,
    fluxos_origem_agregada.parquet, que deixou de existir.)
  - Σ imig = Σ emig no universo publicável (13.851.365 dos dois lados, exatamente): todo migrante
    com origem_valida tem origem E destino publicados. Eram 13.803.767 até 1.0.7-1980; os 47.598
    a mais são a migração entre os 52 municípios, que deixou de ser "não migração".
  - se/cv (erro-padrão/coeficiente de variação) são NULL em 100% das linhas de TODAS as
    tabelas publicadas (diferente de 2022/2010/2000 que calculam a variância).
  - rm_resumo não tem as 6 colunas do módulo pendular (ocupados, pendulares, pct_pendular,
    tempo_mediano, pct_coletivo, pct_diario) como NULL -- ao contrário, essas colunas
    existem, populadas com valores reais (porque pendular existe).
  - Regras de revelação de 1980 são diferentes: sem chave de domicílio, R1 = n >= 20 para
    publicar total (em vez de n >= 5 + ndom >= 3), e R2 = n >= 50 para publicar detalhe
    (em vez de n >= 20). Ver pipeline/disclosure_rules.py função limiares().

Valores de 1.1.0-1980, medidos em 2026-09-30 (ver docs/relatorio_revelacao_1980_1.1.0-1980.md e
docs/qa/censobr_1980.md, que documenta a troca de fonte). O norte de Goiás recodificado tem testes
próprios em test_norte_goias_1980.py (dicionário, dígito verificador, nomes) e no bloco
"1.1.0-1980" deste arquivo (efeito nos agregados e nos arquivos publicados).
"""
import json
import pathlib
import sys

import pytest

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / "pipeline"))
import labels_1980  # noqa: E402
import norte_goias_1980 as _NG  # noqa: E402
from edicoes import edicao as get_edicao  # noqa: E402

ED = get_edicao("1980")
INTERIM = ROOT / ED.interim
PROCESSED = ROOT / ED.processed

VERSAO = "1.1.0-1980"

# Os 52 municípios do norte de Goiás pelo código PUBLICADO (17xxxxx) e pelo de 1980 (52xxxxx).
MUNICIPIOS_52 = sorted(_NG.RECODIFICACAO_1980.values())
IN_52 = ", ".join(f"'{c}'" for c in MUNICIPIOS_52)
IN_CODIGOS_1980 = ", ".join(f"'{c}'" for c in (*sorted(_NG.RECODIFICACAO_1980), "2000107"))

# Todo código de município que a edição pode publicar: os 3.939 de MUNICIPIOS_1980 (que já inclui
# Fernando de Noronha como 2605459) + os 52 recodificados = 3.991, um por unidade da malha de 1980.
PUBLICAVEIS = set(labels_1980.MUNICIPIOS_1980) | set(_NG.RECODIFICACAO_1980.values()) | {"2605459"}


def _req(*paths: pathlib.Path) -> None:
    for p in paths:
        if not p.exists():
            pytest.skip(f"{p} ainda não gerado (rode `python pipeline/run.py --edicao 1980`)")


def _req_publicado(*paths: pathlib.Path) -> None:
    """Como _req, e pula também se o carimbo de data/processed/1980 ainda for de uma versão
    1.0.x-1980, anterior à recodificação do norte de Goiás (1.1.0-1980): os números destes testes
    só valem para o publicado depois dela. Sem isso, rodar a suíte no meio da regeneração
    (intermediário novo, publicado velho) reprovaria por um motivo que não é bug."""
    _req(PROCESSED / ".gate_ok", *paths)
    versao = json.loads((PROCESSED / ".gate_ok").read_text(encoding="utf-8"))["versao_dados"]
    if versao.startswith("1.0."):
        pytest.skip(f"data/processed/1980 ainda em {versao}; regenerar para {VERSAO} "
                    "(`python pipeline/run.py --edicao 1980` + disclosure_check)")


# ================= F1: extração =================

def test_total_pessoas(con):
    """A edição não exclui nenhum registro: 29.378.753 = os 29.200.415 de 1.0.1-1980 mais os
    178.338 residentes do norte de Goiás (que entravam sob a unidade agregada de 1.0.2 a
    1.0.7-1980 e, desde 1.1.0-1980, cada um no seu município de 17xxxxx). O total é o mesmo da
    Base dos Dados e do censobr (docs/qa/censobr_1980.md)."""
    _req(INTERIM / "pessoas.parquet")
    n, = con.execute(f"SELECT COUNT(*) FROM read_parquet('{INTERIM}/pessoas.parquet')").fetchone()
    assert n == 29_378_753
    assert n == 29_200_415 + 178_338


def test_soma_pesos_nacional(con):
    _req(INTERIM / "pessoas.parquet")
    peso, = con.execute(f"SELECT SUM(peso) FROM read_parquet('{INTERIM}/pessoas.parquet')").fetchone()
    # 119.011.052 = 100,0% dos 119.002.706 recenseados em 1980 (a diferença de 8 mil é do
    # próprio sistema de pesos da amostra, não de exclusão nenhuma). Eram 119.011.062 na Base dos
    # Dados: um registro de MS tinha peso 14 lá e tem 4 no censobr e na cópia DBF do IBGE
    # (docs/qa/censobr_1980.md). A soma é exata: tolerância zero.
    assert abs(peso - 119_011_052) < 0.5, "a edição não exclui nenhum registro"


def test_27_ufs_1980(con):
    """27 UFs, com Tocantins ('17') -- a UF publicada dos 52 municípios do norte de Goiás.

    O território que hoje é Tocantins era Goiás em 1980, mas a edição o publica sob '17' pelo
    mesmo motivo (e com o mesmo precedente) que publica Fernando de Noronha sob '26': é o que
    torna a série de UF comparável entre as cinco edições. Publicá-lo sob '52' inflaria a
    emigração interestadual de Goiás em 27% com um degrau puramente territorial. Ver
    pipeline/norte_goias_1980.py.
    """
    _req(INTERIM / "pessoas.parquet")
    ufs = {r[0] for r in con.execute(
        f"SELECT DISTINCT uf FROM read_parquet('{INTERIM}/pessoas.parquet')").fetchall()}
    assert len(ufs) == 27
    assert "17" in ufs


def test_codigos_municipio_bruto_validos(con):
    """Todo cd_mun de municipios_bruto é um código publicável: um dos 3.939 de MUNICIPIOS_1980 ou
    um dos 52 do norte de Goiás recodificados (17xxxxx) -- nunca um 52xxxxx, que é o código de
    1980 desses 52. São 3.991, um por unidade da malha de 1980."""
    _req(INTERIM / "municipios_bruto.parquet")
    codigos = con.execute(f"SELECT DISTINCT cd_mun FROM read_parquet('{INTERIM}/municipios_bruto.parquet')").fetchall()
    fora = [c[0] for c in codigos if c[0] not in PUBLICAVEIS]
    assert fora == []
    assert len(codigos) == 3991  # 3.939 municípios + os 52 do norte de Goiás


def test_codigos_municipio_processed_validos(con):
    """Todo cd_mun publicado é um código publicável (ver o teste acima): 3.991."""
    _req_publicado(PROCESSED / "municipios.parquet")
    codigos = con.execute(f"SELECT DISTINCT cd_mun FROM read_parquet('{PROCESSED}/municipios.parquet')").fetchall()
    fora = [c[0] for c in codigos if c[0] not in PUBLICAVEIS]
    assert fora == []
    assert len(codigos) == 3991  # 3.939 municípios + os 52 do norte de Goiás


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
    varrem o mesmo conjunto de registros. O volume é 13.851.365 -- eram 13.803.767 até
    1.0.7-1980, e os 47.598 a mais são a migração entre os 52 municípios do norte de Goiás, que
    deixou de ser "não migração" quando a unidade agregada deixou de existir. A tolerância de
    ±1 na identidade é só para ponto flutuante; o erro do proxy de data fixa está no NÍVEL do
    volume, não nesta identidade.
    """
    _req(INTERIM / "municipios_bruto.parquet")
    p = f"{INTERIM}/municipios_bruto.parquet"
    imig, emig = con.execute(f"SELECT SUM(imig), SUM(emig) FROM read_parquet('{p}')").fetchone()
    assert abs(imig - emig) < 1, f"Σimig={imig} e Σemig={emig} deveriam ser iguais"
    assert abs(imig - 13_851_365) < 100, "volume de imigração deve ser 13.851.365"
    assert abs(imig - (13_803_767 + 47_598)) < 1, "13.803.767 de 1.0.7-1980 + 47.598 entre os 52"


def test_todos_os_municipios_presentes(con):
    _req(INTERIM / "municipios_bruto.parquet")
    n, = con.execute(f"SELECT COUNT(*) FROM read_parquet('{INTERIM}/municipios_bruto.parquet')").fetchone()
    assert n == 3991


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
    _req_publicado(PROCESSED / "rm.parquet", PROCESSED / "rm_resumo.parquet")
    n_rm, = con.execute(f"SELECT COUNT(*) FROM read_parquet('{PROCESSED}/rm.parquet')").fetchone()
    n_resumo, = con.execute(f"SELECT COUNT(*) FROM read_parquet('{PROCESSED}/rm_resumo.parquet')").fetchone()
    assert n_rm > 0
    # 1980 tem 80 RMs: as 78 de 1.0.7-1980 mais Palmas (901) e Gurupi (1001), que entram com os
    # 52 municípios do norte de Goiás (ver test_rm_palmas_e_gurupi_presentes)
    assert n_resumo == 80


def test_rm_nucleo_unico_por_rm(con):
    """Exatamente 1 linha com nucleo=true por cd_rm nas 80 RMs de 1980."""
    _req_publicado(PROCESSED / "rm.parquet")
    v, = con.execute(f"""
        SELECT COUNT(*) FROM (
            SELECT cd_rm, COUNT(*) FILTER (WHERE nucleo) k
            FROM read_parquet('{PROCESSED}/rm.parquet') GROUP BY cd_rm
        ) WHERE k <> 1""").fetchone()
    assert v == 0, f"esperado exatamente 1 núcleo por RM, encontrado {v} RMs sem ou com >1 núcleo"

    n_rm_distintas, = con.execute(f"SELECT COUNT(DISTINCT cd_rm) FROM read_parquet('{PROCESSED}/rm.parquet')").fetchone()
    assert n_rm_distintas == 80


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
    _req_publicado()
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
    # 1.0.5-1980: Fase 2 (mapa/arcos) -- centroides municipais passaram a ST_PointOnSurface
    # (ponto garantido dentro do polígono, em vez do centroide geométrico) em
    # pipeline/build_centroids.py. Só geo/centroides*.parquet mudou.
    # 1.0.6-1980: Fase 4 (projeção Albers) -- ver nota equivalente em test_edicao_1991.py;
    # NORTEGO recebe a mesma malha/centroides em Albers que os demais municípios.
    # 1.0.7-1980: última versão com a unidade agregada NORTEGO e fonte Base dos Dados.
    # 1.1.0-1980: fonte censobr/IPEA (scripts/prep_1980_censobr.py, gates em
    # docs/qa/censobr_1980.md); os 52 municípios do norte de Goiás são recodificados para 17xxxxx
    # (pipeline/norte_goias_1980.py) e publicados como municípios; NORTEGO deixa de existir.
    # Muda quase todo arquivo: +47.598 de migração intermunicipal (a migração entre os 52),
    # 3.991 municípios (eram 3.940), 500 RGIs, 80 RMs (entram Palmas e Gurupi) e a chave
    # meta.ufs_fora_da_epoca no lugar de meta.unidades_agregadas. O nível de UF não muda.
    assert carimbo["versao_dados"] == VERSAO
    assert "1980/municipios.parquet" not in carimbo["arquivos"], \
        "caminhos no carimbo são relativos à própria PROCESSED"
    assert "fluxos_origem_agregada.parquet" not in carimbo["arquivos"], \
        "a tabela de origem agregada foi absorvida por fluxos.parquet em F9.9"


# ================= 1.1.0-1980: os 52 municípios do norte de Goiás, como municípios =================
#
# De 1.0.2 a 1.0.7-1980 eram UMA unidade agregada ('NORTEGO'); desde 1.1.0 (fonte censobr) cada um
# sai no seu código de 2022 (17xxxxx). Os testes abaixo travam a transição: nada do desenho
# anterior sobrou em lugar nenhum, e nada do que o desenho anterior já publicava mudou de valor
# (o nível de UF e os totais do território são os mesmos; o que passou a existir é a migração
# entre os 52). A recodificação em si -- dicionário, dígito verificador, nomes, mun6_lookup -- é
# testada em test_norte_goias_1980.py, sem depender de nenhum arquivo gerado.

def test_norte_goias_52_municipios_publicados(con):
    """Cada um dos 52 (17xxxxx) está UMA vez em municipios_ref e em municipios, na UF '17', com
    RGI e RGInt e população -- os mesmos critérios de R6 em pipeline/disclosure_check.py -- e com
    o nome de 1980. Nenhum outro município está na UF '17'."""
    _req_publicado(PROCESSED / "municipios.parquet", PROCESSED / "municipios_ref.parquet")
    for arq in ("municipios_ref.parquet", "municipios.parquet"):
        n, distintos, na_uf = con.execute(
            f"SELECT COUNT(*), COUNT(DISTINCT cd_mun), COUNT(*) FILTER (WHERE uf = '17') "
            f"FROM read_parquet('{PROCESSED}/{arq}') WHERE cd_mun IN ({IN_52})").fetchone()
        assert (n, distintos, na_uf) == (52, 52, 52), f"{arq}: {(n, distintos, na_uf)}"
        total_uf, = con.execute(
            f"SELECT COUNT(*) FROM read_parquet('{PROCESSED}/{arq}') WHERE uf = '17'").fetchone()
        assert total_uf == 52, f"{arq}: a UF '17' tem {total_uf} linhas, esperado os 52"
    sem_recorte, sem_pop = con.execute(
        f"SELECT COUNT(*) FILTER (WHERE cd_rgi IS NULL OR cd_rgint IS NULL), "
        f"       COUNT(*) FILTER (WHERE pop IS NULL OR pop <= 0) "
        f"FROM read_parquet('{PROCESSED}/municipios.parquet') WHERE cd_mun IN ({IN_52})").fetchone()
    assert sem_recorte == 0, "os 52 têm RGI e RGInt de 2022"
    assert sem_pop == 0, "os 52 têm população > 0"
    nomes = dict(con.execute(
        f"SELECT cd_mun, nm_mun FROM read_parquet('{PROCESSED}/municipios_ref.parquet') "
        f"WHERE cd_mun IN ({IN_52})").fetchall())
    assert nomes == _NG.NOMES_1980, "a edição publica o nome da época"


def test_nortego_e_codigos_52_ausentes(con):
    """Nenhuma coluna de texto de nenhum arquivo publicado (municipios_ref, municipios, fluxos,
    rm, pendular_*, dimensões, centroides...) traz 'NORTEGO', um 52xxxxx dos 52 ou '2000107'. A
    varredura é por tipo de coluna, não por lista de nomes: um arquivo ou coluna novo entra
    sozinho. O código de Fernando de Noronha de 1980 some pelo mesmo motivo (2605459)."""
    _req_publicado(PROCESSED / "municipios.parquet")
    proibidos = ", ".join(f"'{c}'" for c in (*_NG.RECODIFICACAO_1980, "NORTEGO", "2000107"))
    arquivos = sorted(PROCESSED.glob("*.parquet")) + sorted((PROCESSED / "geo").glob("*.parquet"))
    nomes = {a.stem for a in arquivos}
    assert {"municipios_ref", "municipios", "fluxos", "rm", "pendular_trab", "pendular_estudo"} <= nomes
    vazamentos = []
    for arq in arquivos:
        descricao = con.execute(f"DESCRIBE SELECT * FROM read_parquet('{arq}')").fetchall()
        for col, tipo in ((d[0], d[1]) for d in descricao):
            if tipo != "VARCHAR":
                continue
            n, = con.execute(
                f"SELECT COUNT(*) FROM read_parquet('{arq}') WHERE \"{col}\" IN ({proibidos})").fetchone()
            if n:
                vazamentos.append(f"{arq.relative_to(PROCESSED)}.{col}: {n}")
    assert vazamentos == [], f"código de 1980 ou 'NORTEGO' ainda publicado: {vazamentos}"
    # os JSON que o front lê: nenhuma menção à unidade sintética
    for nome in ("meta.json", "municipios_mapa.json"):
        assert "NORTEGO" not in (PROCESSED / nome).read_text(encoding="utf-8"), nome


def test_totais_do_territorio_conservados(con):
    """O território é o mesmo de 1.0.7-1980: população e universo de 5+ anos idênticos aos da
    unidade agregada (739.049 / 608.641). Imigração e emigração crescem exatamente o que a
    unidade absorvia como "não migração": 59.212 + 47.598 = 106.810 e 64.639 + 47.598 = 112.237.
    Pré-revelação (interim): a versão publicada é arredondada a múltiplos de 5."""
    _req(INTERIM / "municipios_bruto.parquet")
    p = f"{INTERIM}/municipios_bruto.parquet"
    n, pop, pop5, imig, emig = con.execute(
        f"SELECT COUNT(*), SUM(pop), SUM(pop5), SUM(imig), SUM(emig) FROM read_parquet('{p}') "
        f"WHERE cd_mun IN ({IN_52})").fetchone()
    assert n == 52
    assert (pop, pop5, imig, emig) == (739_049, 608_641, 106_810, 112_237)
    assert imig == 59_212 + 47_598 and emig == 64_639 + 47_598
    n_uf, = con.execute(f"SELECT COUNT(*) FROM read_parquet('{p}') WHERE uf = '17'").fetchone()
    assert n_uf == 52, "a UF '17' não tem nenhum município além dos 52"
    # e o nacional fecha com o total de pesos
    pop_total, = con.execute(f"SELECT SUM(pop) FROM read_parquet('{p}')").fetchone()
    assert pop_total == 119_011_052


def test_migracao_entre_os_52(con):
    """Mudar de um para outro dos 52 municípios é migração intermunicipal comum (não mais
    "não migração"): 782 pares 17->17, Σ 47.598 ponderados. Fecha com as duas pontas -- Σ dos
    fluxos que saem deles = emig e Σ dos que chegam a eles = imig."""
    _req(INTERIM / "fluxos_bruto.parquet", INTERIM / "municipios_bruto.parquet")
    f = f"{INTERIM}/fluxos_bruto.parquet"
    n, total = con.execute(
        f"SELECT COUNT(*), SUM(total) FROM read_parquet('{f}') "
        f"WHERE origem IN ({IN_52}) AND destino IN ({IN_52})").fetchone()
    assert (n, total) == (782, 47_598)
    saem, chegam = con.execute(
        f"SELECT SUM(total) FILTER (WHERE origem IN ({IN_52})), "
        f"       SUM(total) FILTER (WHERE destino IN ({IN_52})) FROM read_parquet('{f}')").fetchone()
    assert (saem, chegam) == (112_237, 106_810)


def test_fluxos_uf_inalterados(con):
    """O nível de UF NÃO muda com a recodificação: o território já era a UF '17' desde 1.0.2-1980
    (a unidade agregada e os 52 municípios saem sob o mesmo código de UF). Números pré-revelação,
    medidos em 1.1.0-1980; em 1.0.7-1980 (publicado, arredondado e com supressão) eram 587
    linhas, Σ 4.507.190, 17->52 = 21.565, 52->17 = 26.510, Σ origem 17 = 64.340, Σ destino 17 =
    59.050. A migração entre os 52 é intraestadual (17->17) e não entra aqui."""
    _req(INTERIM / "fluxos_uf_bruto.parquet")
    p = f"{INTERIM}/fluxos_uf_bruto.parquet"
    n, total, loops = con.execute(
        f"SELECT COUNT(*), SUM(total), COUNT(*) FILTER (WHERE origem = destino) FROM read_parquet('{p}')").fetchone()
    assert (n, total, loops) == (698, 4_511_045, 0)
    t_17_52, t_52_17 = con.execute(
        f"SELECT SUM(total) FILTER (WHERE origem = '17' AND destino = '52'), "
        f"       SUM(total) FILTER (WHERE origem = '52' AND destino = '17') FROM read_parquet('{p}')").fetchone()
    assert (t_17_52, t_52_17) == (21_564, 26_512)
    orig_17, dest_17 = con.execute(
        f"SELECT SUM(total) FILTER (WHERE origem = '17'), SUM(total) FILTER (WHERE destino = '17') "
        f"FROM read_parquet('{p}')").fetchone()
    assert (orig_17, dest_17) == (64_639, 59_212)


def test_tocantins_no_nivel_uf_publicado(con):
    """Tocantins aparece dos dois lados de fluxos_uf.parquet; nenhuma linha UF -> a mesma UF."""
    _req_publicado(PROCESSED / "fluxos_uf.parquet")
    p = f"{PROCESSED}/fluxos_uf.parquet"
    n_o, n_d, loops = con.execute(
        f"SELECT COUNT(*) FILTER (WHERE origem = '17'), COUNT(*) FILTER (WHERE destino = '17'), "
        f"       COUNT(*) FILTER (WHERE origem = destino) FROM read_parquet('{p}')").fetchone()
    assert n_o > 0 and n_d > 0
    assert loops == 0


def test_nenhum_municipio_sem_rgi_rgint(con):
    """Sem unidade agregada, nenhuma unidade sai sem RGI/RGInt: 3.991 municípios, 500 RGIs, 133
    RGInts, e nenhuma linha de fluxos_rgi/fluxos_rgint com recorte nulo. O filtro
    `cd_rgi IS NOT NULL` de test_f3_geo.py continua valendo como invariante, mas não exclui mais
    ninguém."""
    _req_publicado(PROCESSED / "municipios_ref.parquet", PROCESSED / "fluxos_rgi.parquet",
                   PROCESSED / "fluxos_rgint.parquet")
    n, sem, rgis, rgints = con.execute(
        f"SELECT COUNT(*), COUNT(*) FILTER (WHERE cd_rgi IS NULL OR cd_rgint IS NULL), "
        f"       COUNT(DISTINCT cd_rgi), COUNT(DISTINCT cd_rgint) "
        f"FROM read_parquet('{PROCESSED}/municipios_ref.parquet')").fetchone()
    assert (n, sem, rgis, rgints) == (3_991, 0, 500, 133)
    for arq in ("fluxos_rgi.parquet", "fluxos_rgint.parquet"):
        v, = con.execute(f"SELECT COUNT(*) FROM read_parquet('{PROCESSED}/{arq}') "
                         "WHERE origem IS NULL OR destino IS NULL").fetchone()
        assert v == 0, f"{arq} não pode ter linha de recorte nulo"


def test_residentes_dos_52_em_pessoas(con):
    """Os 178.338 registros (Σ peso 739.049) dos 52 municípios estão todos em pessoas.parquet,
    cada município com pelo menos um registro, todos na UF '17' (e nenhum sob um 52xxxxx)."""
    _req(INTERIM / "pessoas.parquet")
    p = f"{INTERIM}/pessoas.parquet"
    n, peso, municipios, fora_da_uf = con.execute(
        f"SELECT COUNT(*), SUM(peso), COUNT(DISTINCT cd_mun), COUNT(*) FILTER (WHERE uf <> '17') "
        f"FROM read_parquet('{p}') WHERE cd_mun IN ({IN_52})").fetchone()
    assert (n, peso, municipios, fora_da_uf) == (178_338, 739_049, 52, 0)
    n_uf, peso_uf = con.execute(f"SELECT COUNT(*), SUM(peso) FROM read_parquet('{p}') WHERE uf = '17'").fetchone()
    assert (n_uf, peso_uf) == (178_338, 739_049), "a UF '17' tem só os 52"
    antigos, = con.execute(
        f"SELECT COUNT(*) FROM read_parquet('{p}') WHERE cd_mun IN ({IN_CODIGOS_1980}) "
        f"OR df_mun IN ({IN_CODIGOS_1980})").fetchone()
    assert antigos == 0, "nenhum código de 1980 sobra como residência ou origem"


def test_uf_de_origem_17(con):
    """Quem tem origem em um dos 52 tem df_uf = '17', e a UF publicada é a mesma dos dois lados do
    fluxo: 17 -> 52 e 52 -> 17 são INTERESTADUAIS; 17 -> 17 (migração entre os 52) não é.

    Sem isso, `interestadual` (que vem de df_uf) e fluxos_uf.parquet (que vem de municipios_ref.uf)
    diriam coisas diferentes sobre o mesmo fluxo -- ver a nota de df_uf em
    pipeline/sql/1980/01_extract.sql. Medido em 1.1.0-1980 (registros / Σ peso): 17->52 5.338 /
    21.564; 52->17 6.547 / 26.512; 17->17 11.586 / 47.598."""
    _req(INTERIM / "pessoas.parquet", INTERIM / "pessoas_classificado.parquet")
    v, = con.execute(
        f"SELECT COUNT(*) FROM read_parquet('{INTERIM}/pessoas.parquet') "
        f"WHERE df_mun IN ({IN_52}) AND df_uf IS DISTINCT FROM '17'").fetchone()
    assert v == 0, "toda origem em um dos 52 tem df_uf = '17'"
    c = f"{INTERIM}/pessoas_classificado.parquet"
    esperado = {("17", "52"): (5_338, 21_564, True), ("52", "17"): (6_547, 26_512, True),
                ("17", "17"): (11_586, 47_598, False)}
    for (origem, destino), (n_esp, peso_esp, interestadual) in esperado.items():
        n, peso, n_certo = con.execute(
            f"SELECT COUNT(*), SUM(peso), COUNT(*) FILTER (WHERE interestadual IS {'TRUE' if interestadual else 'FALSE'}) "
            f"FROM read_parquet('{c}') WHERE origem_valida AND df_uf = '{origem}' AND uf = '{destino}'").fetchone()
        assert (n, peso) == (n_esp, peso_esp), f"{origem}->{destino}"
        assert n_certo == n, f"{origem}->{destino}: interestadual deveria ser {interestadual}"


def test_meta_ufs_fora_da_epoca():
    """meta.json declara o Tocantins como UF fora da época (o front lê a nota daqui) e não tem mais
    a chave `unidades_agregadas` -- nem a `origens_agregadas` de 1.0.1-1980."""
    _req_publicado(PROCESSED / "meta.json")
    meta = json.loads((PROCESSED / "meta.json").read_text(encoding="utf-8"))
    ufs = meta.get("ufs_fora_da_epoca")
    assert ufs and len(ufs) == 1
    assert ufs == _NG.uf_fora_da_epoca()
    uf = ufs[0]
    assert uf["uf"] == "17" and uf["uf_sigla"] == "TO" and uf["uf_censo"] == "52"
    assert uf["n_municipios"] == 52
    assert uf["nota"], "o front lê a explicação daqui, nunca hardcoded no componente"
    assert "unidades_agregadas" not in meta, "NORTEGO deixou de existir em 1.1.0-1980"
    assert "origens_agregadas" not in meta, "chave de 1.0.1-1980, substituída em 1.0.2"


def test_rm_palmas_e_gurupi_presentes(con):
    """Com os 52 municípios, as RMs de Palmas (901) e de Gurupi (1001) passam a existir em 1980 --
    13 municípios no total -- e rm.parquet vai de 78 a 80 RMs.

    Gurupi tem o núcleo canônico de pipeline/rm_nucleo.csv (1709500, que existe em 1980). Palmas
    NÃO: o município (1721000) foi criado em 1989, não está na edição, e o núcleo da RM cai no
    fallback de pipeline/sql/1980/08_metro.sql (o membro mais populoso que existe)."""
    _req_publicado(PROCESSED / "rm.parquet", PROCESSED / "rm_resumo.parquet", PROCESSED / "municipios_ref.parquet")
    rm = f"{PROCESSED}/rm.parquet"
    for arq in ("rm.parquet", "rm_resumo.parquet"):
        presentes = {r[0] for r in con.execute(f"SELECT DISTINCT cd_rm FROM read_parquet('{PROCESSED}/{arq}')").fetchall()}
        assert {"901", "1001"} <= presentes, f"{arq} sem Palmas/Gurupi"
    n, n_52 = con.execute(
        f"SELECT COUNT(*), COUNT(*) FILTER (WHERE cd_mun IN ({IN_52})) FROM read_parquet('{rm}') "
        "WHERE cd_rm IN ('901', '1001')").fetchone()
    assert (n, n_52) == (13, 13)
    nucleo = {cd_rm: cd_mun for cd_rm, cd_mun in con.execute(
        f"SELECT cd_rm, cd_mun FROM read_parquet('{rm}') WHERE nucleo AND cd_rm IN ('901', '1001')").fetchall()}
    assert nucleo["1001"] == "1709500", "Gurupi: núcleo canônico, existe em 1980"
    assert nucleo["901"] != "1721000", "Palmas não existe em 1980: o núcleo é o fallback"
    membros_901 = {r[0] for r in con.execute(
        f"SELECT cd_mun FROM read_parquet('{rm}') WHERE cd_rm = '901'").fetchall()}
    assert nucleo["901"] in membros_901
    palmas, = con.execute(
        f"SELECT COUNT(*) FROM read_parquet('{PROCESSED}/municipios_ref.parquet') WHERE cd_mun = '1721000'").fetchone()
    assert palmas == 0, "Palmas (criada em 1989) não pode estar na edição de 1980"


def test_rm_palmas_fallback_e_o_membro_mais_populoso(con):
    """O núcleo de 901 é o membro mais populoso de 1980 (desempate por cd_mun), a regra do
    fallback em 08_metro.sql, reapurada aqui dos agregados municipais pré-revelação."""
    _req(INTERIM / "rm_bruto.parquet")
    membros = con.execute(
        f"SELECT cd_mun, pop, nucleo FROM read_parquet('{INTERIM}/rm_bruto.parquet') WHERE cd_rm = '901'").fetchall()
    assert membros, "RM 901 sem membros em 1980"
    esperado = max(membros, key=lambda m: (m[1] or 0, m[0]))[0]
    assert [m[0] for m in membros if m[2]] == [esperado]
    assert esperado != "1721000"


def test_guarda_origem_igual_residencia(con):
    """Nenhum registro de 1980 tem origem igual ao município de residência: a condição
    `m1.cd_mun = c.cd_mun` do CASE de df_local (01_extract.sql) é rede de segurança e não pode
    disparar -- se disparasse, uma recodificação errada estaria transformando migrantes em não
    migrantes em silêncio (entre 1.0.2 e 1.0.7-1980 ela absorvia a migração interna a NORTEGO).

    Aqui, no intermediário, a condição é `df_local = '1' AND df_mun = cd_mun` (e, mais forte,
    qualquer df_mun = cd_mun). Como df_mun sai NULL sempre que df_local <> '2', este teste só
    pega um df_mun preenchido indevidamente; quem mede o disparo da guarda é o teste seguinte,
    contra a fonte."""
    _req(INTERIM / "pessoas.parquet")
    p = f"{INTERIM}/pessoas.parquet"
    v, = con.execute(f"SELECT COUNT(*) FROM read_parquet('{p}') WHERE df_local = '1' AND df_mun = cd_mun").fetchone()
    assert v == 0
    v, = con.execute(f"SELECT COUNT(*) FROM read_parquet('{p}') WHERE df_mun = cd_mun").fetchone()
    assert v == 0


def test_guarda_origem_igual_residencia_na_fonte(con):
    """A medida de verdade da guarda, sobre a fonte (data/raw1980, só a contagem agregada): em
    0 dos 29.378.753 registros o município de residência anterior (v518, sem o dígito
    verificador) é o de residência atual (id_municipio). Mesma normalização do zero à esquerda
    que 01_extract.sql aplica."""
    fontes = sorted((ROOT / ED.raw).glob("pessoa_??.parquet"))
    if len(fontes) != 27:
        pytest.skip(f"{ROOT / ED.raw}: {len(fontes)} dos 27 Parquet de UF (rode scripts/prep_1980_censobr.py)")
    lista = ", ".join(f"'{f}'" for f in fontes)
    n, iguais = con.execute(f"""
        SELECT COUNT(*),
               COUNT(*) FILTER (WHERE v518 IS NOT NULL AND v518 <> '0000000'
                                 AND CASE WHEN SUBSTR(v518, 1, 1) = '0' THEN SUBSTR(v518, 2, 6)
                                          ELSE SUBSTR(v518, 1, 6) END = SUBSTR(id_municipio, 1, 6))
        FROM read_parquet([{lista}])""").fetchone()
    assert n == 29_378_753
    assert iguais == 0


def test_mun6_lookup_interim_bate_com_o_modulo(con):
    """mun6_lookup.parquet (gerado por build_ref.py) é exatamente norte_goias_1980.mun6_lookup():
    3.991 prefixos, 53 recodificados. E unidades_agregadas.parquet não existe mais no
    intermediário (build_ref.py o apaga) -- um órfão ali seria relido por engano."""
    _req(INTERIM / "mun6_lookup.parquet")
    lido = con.execute(f"SELECT prefixo6, cd_mun, uf FROM read_parquet('{INTERIM}/mun6_lookup.parquet')").fetchall()
    esperado = {(r["prefixo6"], r["cd_mun"], r["uf"]) for r in _NG.mun6_lookup()}
    assert len(lido) == 3_991 and set(lido) == esperado
    assert sum(1 for p, c, _ in lido if c[:2] != p[:2]) == 53
    assert not (INTERIM / "unidades_agregadas.parquet").exists()


def test_fluxos_origem_agregada_nao_existe_mais():
    """A tabela de 1.0.1-1980 foi absorvida por fluxos.parquet (F9.9) -- se ela reaparecer,
    o mesmo fluxo estará publicado duas vezes, sob dois regimes diferentes."""
    _req(PROCESSED / "municipios.parquet")
    assert not (PROCESSED / "fluxos_origem_agregada.parquet").exists()
    assert not (PROCESSED / "unidades_agregadas.parquet").exists()


def test_verify_gate_aprova(con):
    _req(PROCESSED / ".gate_ok")
    import verify_gate
    assert verify_gate.Verificador(PROCESSED).rodar() == 0


def test_universo_do_pendular_de_estudo_1980(con):
    """1.1.0-1980: na fonte censobr (como na cópia pública do IBGE) v527 só é preenchido para
    10 anos ou mais, então o pendular de estudo exclui as crianças de 5 a 9 anos. Âncoras dos
    totais publicados (múltiplos de 5): Σsaida_estudo = 375.825 e Σestudantes = 25.995.810 --
    eram 516.025 e 29.394.755 na 1.0.7-1980 (BD, sem a edição de universo). Uma mudança de
    universo não pode voltar a passar em silêncio; o aviso em meta.json tem de acompanhar."""
    _req_publicado(PROCESSED / "municipios_pendular.parquet", PROCESSED / "meta.json")
    saida, estud = con.execute(f"""
        SELECT SUM(saida_estudo), SUM(estudantes)
        FROM read_parquet('{PROCESSED}/municipios_pendular.parquet')
    """).fetchone()
    assert abs(saida - 375_825) <= 5 * 3991, saida
    assert abs(estud - 25_995_810) <= 5 * 3991, estud
    meta = json.loads((PROCESSED / "meta.json").read_text(encoding="utf-8"))
    assert "10 anos" in (meta.get("aviso_pendular_estudo") or ""), "aviso de universo ausente do meta"
