"""Testes de pipeline/norte_goias_1980.py: a recodificação dos 52 municípios do norte de Goiás
(hoje Tocantins) do código de 1980 (52xxxxx) para o de 2022 (17xxxxx), e os artefatos que o
módulo alimenta (mun6_lookup.parquet, as 52 linhas de municipios_ref, meta["ufs_fora_da_epoca"]).

Só dado público e constantes do código -- nenhum microdado, nenhum arquivo de data/: roda em
qualquer clone. Os testes que conferem o efeito da recodificação nos arquivos publicados e nos
agregados do pipeline estão em test_edicao_1980.py (bloco "1.1.0-1980").

O que estes testes travam, porque é o que a recodificação precisa para não corromper nada em
silêncio: (a) o dicionário é uma bijeção de 52 códigos para 52 municípios reais de 2022, com o
mesmo serial de 4 dígitos e dígito verificador correto; (b) cobre exatamente os códigos que a
malha de 1980 tem e o município publicável não; (c) o dicionário de origens/destinos
(`mun6_lookup`) chaveia pelo prefixo de 1980 e devolve só códigos publicados.
"""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / "pipeline"))
import labels  # noqa: E402
import labels_1980  # noqa: E402
import norte_goias_1980 as N  # noqa: E402

FERNANDO_DE_NORONHA_1980 = "2000107"
FERNANDO_DE_NORONHA_PUBLICADO = "2605459"

# Os 12 municípios cujo nome mudou entre 1980 e 2022 (o sufixo "de Goiás"/"do Norte" virou
# "do Tocantins", mais Couto de Magalhães -> Couto Magalhães). Lista explícita: um 13º nome
# divergente é erro de digitação em NOMES_1980 ou código trocado, não renomeação.
RENOMEADOS = {
    "1702703",  # Aurora do Norte -> Aurora do Tocantins
    "1702901",  # Axixá de Goiás -> Axixá do Tocantins
    "1705508",  # Colinas de Goiás -> Colinas do Tocantins
    "1705607",  # Conceição do Norte -> Conceição do Tocantins
    "1706001",  # Couto de Magalhães -> Couto Magalhães
    "1707207",  # Dois Irmãos de Goiás -> Dois Irmãos do Tocantins
    "1711100",  # Itaporã de Goiás -> Itaporã do Tocantins
    "1713205",  # Miracema do Norte -> Miracema do Tocantins
    "1716109",  # Paraíso do Norte de Goiás -> Paraíso do Tocantins
    "1717008",  # Pindorama de Goiás -> Pindorama do Tocantins
    "1717909",  # Ponte Alta do Norte -> Ponte Alta do Tocantins
    "1720804",  # Sítio Novo de Goiás -> Sítio Novo do Tocantins
}


# ================= o dicionário de recodificação =================

def test_52_chaves_52_valores_distintos():
    assert len(N.RECODIFICACAO_1980) == 52
    assert len(set(N.RECODIFICACAO_1980.values())) == 52, "dois códigos de 1980 no mesmo município de 2022"


def test_chaves_sao_codigos_de_goias_de_1980_e_valores_de_tocantins():
    assert all(len(k) == 7 and k.startswith(N.UF_1980_DO_TERRITORIO) for k in N.RECODIFICACAO_1980)
    assert all(len(v) == 7 and v.startswith(N.UF_TOCANTINS) for v in N.RECODIFICACAO_1980.values())


def test_cada_valor_e_municipio_de_tocantins_em_2022():
    for cd22 in N.RECODIFICACAO_1980.values():
        assert cd22 in labels.MUNICIPIOS, f"{cd22} não existe em labels.MUNICIPIOS"
        assert labels.MUNICIPIOS[cd22]["uf"] == "17", f"{cd22} não é de Tocantins em labels.MUNICIPIOS"


def test_nenhuma_chave_colide_com_codigo_de_2022():
    """Nenhum dos 52 códigos de 1980 é um código válido de 2022. É o que permite ao gate (R6)
    tratar `52xxxxx` desses 52 como "código de 1980 vazado" sem confundir com um município de
    Goiás de hoje."""
    assert not set(N.RECODIFICACAO_1980) & set(labels.MUNICIPIOS)


def test_serial_de_4_digitos_preservado_entre_1980_e_2022():
    """Só a UF e o dígito verificador mudam (5202106 Araguaína -> 1702109)."""
    for cd80, cd22 in N.RECODIFICACAO_1980.items():
        assert cd80[2:6] == cd22[2:6], f"{cd80} -> {cd22}: serial mudou"


# ================= dígito verificador =================

def test_digito_verificador_reproduz_os_52_codigos_de_2022():
    for cd22 in N.RECODIFICACAO_1980.values():
        assert N.digito_verificador_ibge(cd22[:6]) == cd22[6], f"{cd22}: dígito verificador não bate"


def test_digito_verificador_reproduz_codigos_conhecidos():
    assert N.digito_verificador_ibge("260545") == "9"   # Fernando de Noronha (2605459)
    assert N.digito_verificador_ibge("355030") == "8"   # São Paulo (3550308)
    assert N.digito_verificador_ibge("520870") == "7"   # Goiânia (5208707)
    assert N.digito_verificador_ibge("170210") == "9"   # Araguaína (1702109)
    # a função devolve SEMPRE um único dígito, inclusive quando a soma é múltiplo de 10
    assert all(len(N.digito_verificador_ibge(f"{i:06d}")) == 1 for i in range(0, 1_000_000, 9973))


def test_digito_verificador_reproduz_todos_os_municipios_de_1980():
    """100% dos 3.939 códigos de município de 1980 (nenhuma exceção), o que dá a régua
    para tratar um dígito que não bate como erro de digitação nos 52."""
    ruins = [c for c in labels_1980.MUNICIPIOS_1980 if N.digito_verificador_ibge(c[:6]) != c[6]]
    assert ruins == []


# ================= consistência com labels_1980 =================

def test_chaves_sao_os_codigos_da_malha_que_nao_sao_municipio_publicavel():
    """As 52 chaves são exatamente o que a malha de 1980 (MUN6_1980) conhece e
    MUNICIPIOS_1980 não -- isto é, os municípios do norte de Goiás, que a fonte traz com o
    código de 1980 e o dicionário de municípios publicáveis não tem."""
    assert set(N.RECODIFICACAO_1980) == set(labels_1980.MUN6_1980.values()) - set(labels_1980.MUNICIPIOS_1980)


def test_mun6_1980_resolve_cada_chave_pelo_proprio_prefixo():
    for cd80 in N.RECODIFICACAO_1980:
        assert labels_1980.MUN6_1980[cd80[:6]] == cd80


def test_nenhuma_chave_e_municipio_publicavel_de_1980():
    assert not set(N.RECODIFICACAO_1980) & set(labels_1980.MUNICIPIOS_1980)


def test_fernando_de_noronha_recodificado_do_mesmo_modo():
    assert N.FERNANDO_DE_NORONHA == {FERNANDO_DE_NORONHA_1980: FERNANDO_DE_NORONHA_PUBLICADO}
    assert N.digito_verificador_ibge(FERNANDO_DE_NORONHA_PUBLICADO[:6]) == FERNANDO_DE_NORONHA_PUBLICADO[6]
    assert labels.MUNICIPIOS[FERNANDO_DE_NORONHA_PUBLICADO]["uf"] == "26"


def test_codigo_publicado_tem_53_entradas():
    """52 do norte de Goiás + Fernando de Noronha, sem sobreposição."""
    assert len(N.CODIGO_PUBLICADO) == 53
    assert N.CODIGO_PUBLICADO == {**N.RECODIFICACAO_1980, **N.FERNANDO_DE_NORONHA}
    assert not set(N.RECODIFICACAO_1980) & set(N.FERNANDO_DE_NORONHA)


# ================= nomes =================

def test_nomes_1980_cobrem_exatamente_os_52_codigos_publicados():
    assert set(N.NOMES_1980) == set(N.RECODIFICACAO_1980.values())
    assert all(isinstance(nome, str) and nome.strip() == nome and nome for nome in N.NOMES_1980.values())


def test_nome_de_1980_bate_com_o_de_2022_exceto_nas_12_renomeacoes():
    """Mesmo código, mesmo município: o nome de 1980 é o de 2022 em 40 dos 52, e nos 12
    renomeados a primeira palavra (a identidade do município) é a mesma. Um nome que diverge
    fora dessa lista é código trocado, não renomeação."""
    renomeados = set()
    for cd22, nome80 in N.NOMES_1980.items():
        nome22 = labels.MUNICIPIOS[cd22]["nome"]
        assert nome80.split()[0] == nome22.split()[0], f"{cd22}: {nome80!r} x {nome22!r}"
        if nome80 != nome22:
            renomeados.add(cd22)
    assert renomeados == RENOMEADOS
    assert len(renomeados) == 12


# ================= mun6_lookup (origens e destinos pendulares) =================

def test_mun6_lookup_tem_3991_prefixos_unicos():
    linhas = N.mun6_lookup()
    assert len(linhas) == 3_991
    assert {r["prefixo6"] for r in linhas} == set(labels_1980.MUN6_1980)
    assert len({r["prefixo6"] for r in linhas}) == 3_991
    assert all(len(r["prefixo6"]) == 6 and len(r["cd_mun"]) == 7 for r in linhas)


def test_mun6_lookup_53_recodificados_e_so_eles():
    """Os códigos publicados cuja UF difere da do prefixo de 1980 são os 53 recodificados:
    os 52 do norte de Goiás (52 -> 17) e Fernando de Noronha (20 -> 26)."""
    linhas = N.mun6_lookup()
    trocados = [r for r in linhas if r["cd_mun"][:2] != r["prefixo6"][:2]]
    assert len(trocados) == 53
    tocantins = [r for r in trocados if r["uf"] == "17"]
    assert len(tocantins) == 52
    assert all(r["prefixo6"].startswith("52") for r in tocantins)
    assert {r["cd_mun"] for r in tocantins} == set(N.RECODIFICACAO_1980.values())
    (noronha,) = [r for r in trocados if r["uf"] == "26"]
    assert noronha == {"prefixo6": "200010", "cd_mun": FERNANDO_DE_NORONHA_PUBLICADO, "uf": "26"}


def test_mun6_lookup_so_devolve_codigos_publicaveis():
    """Nenhum cd_mun fora de MUNICIPIOS_1980 + os 52 recodificados (+ Fernando de Noronha, que
    já está em MUNICIPIOS_1980 pelo código de 2022), e nenhum código de 1980 (52xxxxx dos 52,
    2000107) sobra como destino."""
    linhas = N.mun6_lookup()
    publicaveis = set(labels_1980.MUNICIPIOS_1980) | set(N.RECODIFICACAO_1980.values()) | {FERNANDO_DE_NORONHA_PUBLICADO}
    cds = {r["cd_mun"] for r in linhas}
    assert cds <= publicaveis
    assert len(cds) == 3_991, "dois prefixos de 1980 resolvendo para o mesmo município"
    assert not cds & set(N.RECODIFICACAO_1980)
    assert FERNANDO_DE_NORONHA_1980 not in cds


def test_mun6_lookup_uf_e_a_do_codigo_publicado():
    assert all(r["uf"] == r["cd_mun"][:2] for r in N.mun6_lookup())


# ================= linhas de municipios_ref =================

def test_linhas_referencia_52_municipios_de_tocantins():
    linhas = N.linhas_referencia()
    assert len(linhas) == 52
    assert {r["cd_mun"] for r in linhas} == set(N.RECODIFICACAO_1980.values())
    assert len({r["cd_mun"] for r in linhas}) == 52
    for r in linhas:
        assert (r["uf"], r["uf_sigla"], r["uf_nome"]) == ("17", "TO", "Tocantins")
        assert r["nm_mun"] == N.NOMES_1980[r["cd_mun"]], "a edição publica o nome de 1980"


def test_linhas_referencia_todas_com_rgi_e_rgint():
    linhas = N.linhas_referencia()
    assert all(r["cd_rgi"] and r["nm_rgi"] for r in linhas)
    assert all(r["cd_rgint"] and r["nm_rgint"] for r in linhas)
    assert all(r["cd_rgi"].startswith("17") and r["cd_rgint"].startswith("17") for r in linhas)
    assert len({r["cd_rgi"] for r in linhas}) == 11
    assert len({r["cd_rgint"] for r in linhas}) == 3


def test_linhas_referencia_13_em_rm():
    """13 dos 52 caem nas RMs de 2022 de Palmas (901) e de Gurupi (1001): é o que faz as duas
    entrarem em rm.parquet de 1980 (80 RMs, eram 78)."""
    com_rm = [r for r in N.linhas_referencia() if r["cd_rm"]]
    assert len(com_rm) == 13
    assert {r["cd_rm"] for r in com_rm} == {"901", "1001"}
    assert all(r["nm_rm"] for r in com_rm)


def test_linhas_referencia_tem_as_colunas_de_municipios_ref():
    """Esquema de build_ref.py: as 52 linhas têm de caber, coluna a coluna, nas 3.939 dos
    demais municípios (o pipeline faz UNION das duas listas)."""
    esperadas = {
        "cd_mun", "nm_mun", "uf", "uf_sigla", "uf_nome", "cd_meso", "nm_meso", "cd_micro", "nm_micro",
        "cd_rgi", "nm_rgi", "cd_rgint", "nm_rgint", "cd_concurb", "nm_concurb", "cd_rm", "nm_rm",
        "cd_au", "nm_au",
    }
    for r in N.linhas_referencia():
        assert set(r) == esperadas


# ================= UF fora da época =================

def test_uf_fora_da_epoca_declara_tocantins():
    (uf,) = N.uf_fora_da_epoca()
    assert uf["uf"] == "17" and uf["uf_sigla"] == "TO"
    assert uf["uf_censo"] == "52" and uf["uf_censo_sigla"] == "GO"
    assert uf["n_municipios"] == 52
    assert uf["nota"], "o front lê a explicação daqui, nunca hardcoded no componente"


# ================= módulo substituído =================

def test_modulo_unidades_agregadas_foi_removido():
    """`pipeline/unidades_agregadas_1980.py` (a unidade NORTEGO, 1.0.2 a 1.0.7-1980) foi
    substituído por este módulo em 1.1.0-1980; se voltar, alguém reintroduziu a agregação."""
    assert not (ROOT / "pipeline" / "unidades_agregadas_1980.py").exists()
