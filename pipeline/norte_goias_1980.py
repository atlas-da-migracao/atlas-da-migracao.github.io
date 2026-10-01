"""Norte de Goiás (atual Tocantins) no Censo 1980: a recodificação dos 52 municípios de 1980
para os códigos de 2022, e o que mais a edição precisa saber sobre esse território.

Substitui `pipeline/unidades_agregadas_1980.py` (removido em 1.1.0-1980). A história das
decisões está em `pipeline/sql/1980/MAPEAMENTO_norte_goias.md`; o resumo é este:

- **1.0.0-1980** (16/09/2026): os 178.338 registros dos 52 municípios chegavam da Base dos
  Dados sem `id_municipio` (o `merge` em Stata que gera a tabela casa o código de 1980 com o
  diretório ATUAL de municípios, onde `52xxxx` não existe mais) e foram EXCLUÍDOS.
- **1.0.1-1980**: só a emigração deles foi publicada, numa origem coletiva à parte.
- **1.0.2 a 1.0.7-1980**: o território inteiro virou UMA unidade publicada, `'NORTEGO'`, com
  UF `'17'`, RGI/RGInt/RM NULL e polígono dissolvido -- porque se acreditava que "a fonte
  não distingue os municípios que o compõem".
- **1.1.0-1980** (esta versão): a fonte da edição passou a ser o Parquet do censobr/IPEA
  (`scripts/prep_1980_censobr.py`), derivado dos mesmos microdados e que traz `code_muni`
  para todos os registros -- os 52 chegam como `52xxxxx`, o código de 1980, e são
  recodificados AQUI para o código de 2022 (`17xxxxx`). A unidade agregada deixou de existir;
  o mecanismo genérico do front (`meta.unidades_agregadas`) continua, inativo.

## Por que recodificar para 17xxxxx, e não publicar 52xxxxx

A edição publica todo município pelo código ATUAL (é o que a Base dos Dados já fazia para os
outros 3.939, e é o que liga cada município às demais edições, aos recortes de 2022
(`labels.RECORTES`) e à genealogia). Os 52 mantêm o serial de 4 dígitos entre 1980 e 2022
(`5202106` Araguaína -> `1702109`): só a UF e o dígito verificador mudam. Conferido 52 de 52
contra `labels.MUNICIPIOS` (nome batendo, com 12 renomeações do tipo "Colinas de Goiás" ->
"Colinas do Tocantins"); todos existem em 1991, 2000, 2010 e 2022. O mesmo tratamento já
valia para Fernando de Noronha (`2000107` -> `2605459`), Território Federal em 1980.

## A UF: '17' (Tocantins), pelo precedente de Fernando de Noronha

O território era Goiás (52) em 1980 e é Tocantins (17) desde 1988. Publicar sob '17' é o que
mantém Goiás nos seus limites de hoje nas cinco edições e as séries de UF sobre o mesmo
território; publicar sob '52' inflaria a emigração interestadual de Goiás em 27% com um degrau
puramente territorial. O aviso "esta UF não existia na época" no nível UF vem de
`uf_fora_da_epoca()` -> `meta["ufs_fora_da_epoca"]`.

## O que permanece aproximado (declarar na metodologia)

- A naturalidade é só por UF: quem nasceu no norte e mora fora traz `v512` = Goiás, porque era
  isso que o Censo de 1980 registrava. `retorno_uf_natal` fica subestimado para o Tocantins e
  superestimado para o sul de Goiás; só `v513` ("nasceu neste município") vale por município.
- Mesmo código não é mesmo território: 34 dos 52 cederam área a municípios criados depois; a
  genealogia (`pipeline/build_genealogia.py`) trata isso como para qualquer outro município.

- A origem "Goiás sem município" (`v518` = `52` + `0000`, UF conhecida e município ignorado) é
  atribuída integralmente a Goiás, como a UF da época mandava: parte dela vem do norte, e não há
  como separá-la. Entra em `fluxos_uf` como origem `52`, nunca como `17`.

Dado público: códigos e nomes de 1980 vêm da malha municipal 1980 do IBGE (`geo/fetch_1980.sh`,
`data/geo/raw/1980/`), consolidados em `MUN6_1980`/`MUNICIPIOS_1980` de `pipeline/labels_1980.py`
-- a lista versionada; `docs/qa/malha_1980_codigos.csv` é só a exportação local de trabalho dessa
mesma malha (não versionada: `*.csv` é bloqueado pelo .gitignore). Os códigos de 2022 vêm de
`pipeline/labels.py`. Módulo escrito à mão de propósito: `labels_1980.py` é gerado e traz o aviso
"não editar à mão".
"""
from __future__ import annotations

import sys
from pathlib import Path

_PIPELINE = Path(__file__).resolve().parent
if str(_PIPELINE) not in sys.path:
    sys.path.insert(0, str(_PIPELINE))

import labels  # noqa: E402
import labels_1980  # noqa: E402

UF_TOCANTINS = "17"
UF_1980_DO_TERRITORIO = "52"

# Os 52 municípios de 1980 que em 1988 formaram o Tocantins: código de 1980 -> código de 2022.
# Fixados literalmente (não calculados em runtime) para o diff ser auditável; o teste
# pipeline/tests/test_norte_goias_1980.py confere serial, dígito verificador, nome e UF.
RECODIFICACAO_1980: dict[str, str] = {
    "5200407": "1700400",  # Almas
    "5200704": "1700707",  # Alvorada
    "5201009": "1701002",  # Ananás
    "5201900": "1701903",  # Araguacema
    "5202007": "1702000",  # Araguaçu
    "5202106": "1702109",  # Araguaína
    "5202205": "1702208",  # Araguatins
    "5202304": "1702307",  # Arapoema
    "5202403": "1702406",  # Arraias
    "5202700": "1702703",  # Aurora do Norte -> Aurora do Tocantins
    "5202908": "1702901",  # Axixá de Goiás -> Axixá do Tocantins
    "5203005": "1703008",  # Babaçulândia
    "5203708": "1703701",  # Brejinho de Nazaré
    "5205505": "1705508",  # Colinas de Goiás -> Colinas do Tocantins
    "5205604": "1705607",  # Conceição do Norte -> Conceição do Tocantins
    "5206008": "1706001",  # Couto de Magalhães -> Couto Magalhães
    "5206107": "1706100",  # Cristalândia
    "5207006": "1707009",  # Dianópolis
    "5207204": "1707207",  # Dois Irmãos de Goiás -> Dois Irmãos do Tocantins
    "5207303": "1707306",  # Dueré
    "5207709": "1707702",  # Filadélfia
    "5208202": "1708205",  # Formoso do Araguaia
    "5209002": "1709005",  # Goiatins
    "5209309": "1709302",  # Guaraí
    "5209507": "1709500",  # Gurupi
    "5210505": "1710508",  # Itacajá
    "5210703": "1710706",  # Itaguatins
    "5211107": "1711100",  # Itaporã de Goiás -> Itaporã do Tocantins
    "5212402": "1712405",  # Lizarda
    "5213202": "1713205",  # Miracema do Norte -> Miracema do Tocantins
    "5213301": "1713304",  # Miranorte
    "5213608": "1713601",  # Monte do Carmo
    "5214200": "1714203",  # Natividade
    "5214309": "1714302",  # Nazaré
    "5215108": "1715101",  # Novo Acordo
    "5216106": "1716109",  # Paraíso do Norte de Goiás -> Paraíso do Tocantins
    "5216205": "1716208",  # Paranã
    "5216502": "1716505",  # Pedro Afonso
    "5216601": "1716604",  # Peixe
    "5216700": "1716703",  # Colméia
    "5217005": "1717008",  # Pindorama de Goiás -> Pindorama do Tocantins
    "5217500": "1717503",  # Pium
    "5217807": "1717800",  # Ponte Alta do Bom Jesus
    "5217906": "1717909",  # Ponte Alta do Norte -> Ponte Alta do Tocantins
    "5218201": "1718204",  # Porto Nacional
    "5218409": "1718402",  # Presidente Kennedy
    "5220306": "1720309",  # São Sebastião do Tocantins
    "5220801": "1720804",  # Sítio Novo de Goiás -> Sítio Novo do Tocantins
    "5220900": "1720903",  # Taguatinga
    "5221106": "1721109",  # Tocantínia
    "5221205": "1721208",  # Tocantinópolis
    "5222104": "1722107",  # Xambioá
}

# Nome de 1980 de cada um dos 52 (malha 1980 do IBGE), pelo código de 2022. A edição publica
# o nome da época, como faz com os outros 37 municípios renomeados desde 1980 (ex.: Embu).
NOMES_1980: dict[str, str] = {
    "1700400": "Almas", "1700707": "Alvorada", "1701002": "Ananás", "1701903": "Araguacema",
    "1702000": "Araguaçu", "1702109": "Araguaína", "1702208": "Araguatins", "1702307": "Arapoema",
    "1702406": "Arraias", "1702703": "Aurora do Norte", "1702901": "Axixá de Goiás",
    "1703008": "Babaçulândia", "1703701": "Brejinho de Nazaré", "1705508": "Colinas de Goiás",
    "1705607": "Conceição do Norte", "1706001": "Couto de Magalhães", "1706100": "Cristalândia",
    "1707009": "Dianópolis", "1707207": "Dois Irmãos de Goiás", "1707306": "Dueré",
    "1707702": "Filadélfia", "1708205": "Formoso do Araguaia", "1709005": "Goiatins",
    "1709302": "Guaraí", "1709500": "Gurupi", "1710508": "Itacajá", "1710706": "Itaguatins",
    "1711100": "Itaporã de Goiás", "1712405": "Lizarda", "1713205": "Miracema do Norte",
    "1713304": "Miranorte", "1713601": "Monte do Carmo", "1714203": "Natividade",
    "1714302": "Nazaré", "1715101": "Novo Acordo", "1716109": "Paraíso do Norte de Goiás",
    "1716208": "Paranã", "1716505": "Pedro Afonso", "1716604": "Peixe", "1716703": "Colméia",
    "1717008": "Pindorama de Goiás", "1717503": "Pium", "1717800": "Ponte Alta do Bom Jesus",
    "1717909": "Ponte Alta do Norte", "1718204": "Porto Nacional", "1718402": "Presidente Kennedy",
    "1720309": "São Sebastião do Tocantins", "1720804": "Sítio Novo de Goiás",
    "1720903": "Taguatinga", "1721109": "Tocantínia", "1721208": "Tocantinópolis",
    "1722107": "Xambioá",
}

# Fernando de Noronha: Território Federal em 1980 (UF 20 na fonte, código 2000107 na malha),
# publicado sob Pernambuco com o código de 2022 -- o mesmo tratamento, pelo mesmo motivo.
FERNANDO_DE_NORONHA: dict[str, str] = {"2000107": "2605459"}

# Tudo o que muda de código entre a malha/fonte de 1980 e o publicado: 53 entradas.
CODIGO_PUBLICADO: dict[str, str] = {**RECODIFICACAO_1980, **FERNANDO_DE_NORONHA}


def digito_verificador_ibge(codigo6: str) -> str:
    """Dígito verificador do código municipal do IBGE (módulo 10, pesos 1,2,1,2,1,2; produtos
    >= 10 somam os dígitos). Conferido nos 52 códigos de 2022 do Tocantins e em 100% dos
    códigos de 7 dígitos de `v518`/`v527` da Base dos Dados."""
    soma = 0
    for i, ch in enumerate(codigo6):
        p = int(ch) * (1 if i % 2 == 0 else 2)
        soma += p - 9 if p >= 10 else p
    return str((10 - soma % 10) % 10)


def linhas_referencia() -> list[dict]:
    """As 52 linhas de `municipios_ref.parquet` (esquema de build_ref.py), com nome de 1980,
    UF '17' e os recortes de 2022 (`labels.RECORTES`) do código de 2022."""
    from build_ref import UF_SIGLA, s  # import tardio: build_ref importa este módulo

    linhas = []
    for cd22, nome in NOMES_1980.items():
        rec = labels.RECORTES.get(cd22, {})
        linhas.append({
            "cd_mun": cd22, "nm_mun": nome,
            "uf": UF_TOCANTINS, "uf_sigla": UF_SIGLA[UF_TOCANTINS], "uf_nome": labels.UF.get(UF_TOCANTINS),
            # meso/micro: a edição 1980 não os tem (labels_1980 traz ''), e build_ref.py usa os
            # da própria edição para as outras 3.939 linhas -- mesma convenção aqui, nunca os
            # de 2022, para a coluna ser homogênea.
            "cd_meso": "", "nm_meso": "", "cd_micro": "", "nm_micro": "",
            "cd_rgi": s(rec.get("cod_RGI")), "nm_rgi": rec.get("nome_rgi"),
            "cd_rgint": s(rec.get("cod_RGInt")), "nm_rgint": rec.get("nome_rgint"),
            "cd_concurb": s(rec.get("CodConcUrbana")), "nm_concurb": rec.get("NomeConcUrbana"),
            "cd_rm": s(rec.get("COD_CATMETROPOL")), "nm_rm": rec.get("NOME_CATMETROPOL"),
            "cd_au": s(rec.get("COD_RECAU")), "nm_au": rec.get("NOME_RECAU"),
        })
    return linhas


def mun6_lookup() -> list[dict]:
    """Dicionário `prefixo6 (UF||MUNIC de 1980) -> cd_mun publicado, uf` para
    `01_extract.sql` resolver `v518` (origem) e `v527` (destino pendular): as 3.991 entradas de
    `MUN6_1980`, com os 52 do norte de Goiás e Fernando de Noronha já recodificados. A chave é
    o prefixo DE 1980 -- `'520210'` -> `'1702109'` -- porque é assim que as origens chegam na
    fonte; chavear pelo prefixo do código publicado (`'170210'`) nunca casaria com nada."""
    linhas = []
    for prefixo6, cd80 in labels_1980.MUN6_1980.items():
        cd = CODIGO_PUBLICADO.get(cd80, cd80)
        linhas.append({"prefixo6": prefixo6, "cd_mun": cd, "uf": cd[:2]})
    return linhas


def uf_fora_da_epoca() -> list[dict]:
    """`meta["ufs_fora_da_epoca"]`: UFs publicadas que não existiam na data do censo. O front
    (web/src/components/AvisoUnidade.tsx, `AvisoUnidadeUf`) mostra a nota no painel da UF."""
    return [{
        "uf": UF_TOCANTINS, "uf_sigla": "TO", "uf_censo": UF_1980_DO_TERRITORIO, "uf_censo_sigla": "GO",
        "n_municipios": len(RECODIFICACAO_1980),
        "nota": (
            "O Tocantins foi criado em 1988. Em 1980 este território eram 52 municípios do norte "
            "de Goiás, publicados aqui sob o código de UF de hoje (mesmo precedente de Fernando "
            "de Noronha) para que a série de UF compare o mesmo território nas cinco edições. As "
            "trocas com o restante de Goiás aparecem como migração interestadual; quem nasceu "
            "aqui e mora fora declarou Goiás como UF de nascimento."
        ),
    }]
