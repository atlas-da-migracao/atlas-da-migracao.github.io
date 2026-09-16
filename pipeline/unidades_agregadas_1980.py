"""Unidades agregadas do Censo 1980: um conjunto de municípios de 1980 que a edição publica
como **uma única unidade**, porque a fonte não distingue os municípios que o compõem.

Hoje há exatamente um caso, o **norte de Goiás** (os 52 municípios que em 1988 formaram o
Tocantins). A história completa está em `pipeline/sql/1980/MAPEAMENTO_norte_goias.md` e em
`docs/METODOLOGIA.md`, item 4 da seção do Censo 1980; o resumo é este:

- **Lado do destino (quem MORAVA lá em 1980)**: 178.338 registros de `sigla_uf = 'GO'`
  chegam da Base dos Dados com `id_municipio` NULL. A sondagem das quatro camadas da Base
  dos Dados (produção, dev e as duas variantes de staging) fechou essa porta em definitivo:
  todas têm exatamente os mesmos 178.338 nulos e os mesmos 171 municípios distintos em
  `sigla_uf='GO'` — o campo é nulo na origem, não é efeito de `safe_cast`. Não há em qual
  dos 52 municípios cada pessoa estava, e não haverá.
- **Lado da origem (quem SAIU de lá entre 1975 e 1980)**: `v518` traz o código de 6 dígitos
  do município de residência anterior, e ele **está preenchido** — inclusive quando é um dos
  52.

A assimetria é real, mas ela só é um problema enquanto a pergunta for "em qual dos 52?".
Numa unidade **coletiva** essa pergunta não é feita: os 178.338 registros têm tudo o mais
(peso, sexo, idade, escolaridade, naturalidade, ocupação, `v517`/`v518` e `v527`), e a
unidade fica com população, imigração, emigração, saldo, deslocamento pendular e malha
próprios — como qualquer outra unidade da edição.

Por isso, desde a versão `1.0.2-1980` dos dados, `'NORTEGO'` **é uma unidade publicada**:
entra em `municipios_ref.parquet`, em `municipios.parquet` (com `pop`/`pop5`/`imig`/`emig`/
`saldo`), nos dois lados de `fluxos.parquet`, no módulo pendular e na malha (uma feição,
dissolvida das 52 originais por `geo/fetch_1980.sh`). Ela **não** é um município, e isso
precisa aparecer no rótulo e na nota do painel, não só na metodologia — ver
`meta["unidades_agregadas"]` (`pipeline/build_meta.py`) e `web/src/components/AvisoUnidade.tsx`.

Isto substitui o desenho anterior (versão `1.0.1-1980`), em que os mesmos 52 municípios eram
só uma **origem** agregada, publicada à parte em `fluxos_origem_agregada.parquet` enquanto os
residentes ficavam de fora da edição. Aquela tabela deixou de ser gerada: a origem virou uma
origem normal em `fluxos.parquet`, com um destino clicável do outro lado.

## Por que UMA unidade coletiva, e não as 52 separadas

Não é só a falta do código de residência (que já bastaria). Mesmo do lado da origem, onde os
52 códigos existem, a granularidade municipal **não sobrevive à revelação**: medido no
universo publicável, 52 origens separadas dariam 145 pares acima do piso de R1 cobrindo 64,0%
da massa, contra 66 pares cobrindo 87,5% com uma origem única. Com uma unidade publica-se um
quarto a mais do que se sabe, e com uma unidade só para explicar.

## A UF: '17' (Tocantins), pelo precedente de Fernando de Noronha

O território era **Goiás (52)** em 1980 e é **Tocantins (17)** desde 1988. A edição publica a
UF de 1980 para todo município, com uma exceção já declarada: Fernando de Noronha, Território
Federal em 1980, sai sob `'26'` (Pernambuco, a UF de 2022), porque é isso que o torna
comparável com as outras edições. O norte de Goiás é o **único outro caso** do país em que a
UF de 1980 e a de 2022 divergem, e a mesma regra resolve: `'17'`.

Publicar sob `'52'` faria o oposto — inflaria a emigração interestadual de Goiás em 27% com um
degrau puramente territorial, e faria Goiás aparecer em 1980 com limites que nenhuma outra
edição do atlas usa. Com `'17'`, a edição 1980 passa a ter **27 UFs**, Goiás fica nos seus
limites de hoje nas cinco edições, e as séries de UF ficam todas sobre o mesmo território.

## RGI, RGInt e RM: NULL, declarado

A unidade cobre 11 RGIs e 3 RGInts de 2022, e nenhuma delas é "dela". Uma unidade não pode
estar em onze regiões, e quebrá-la em onze reintroduz o problema que a agregação resolveu:
`cd_rgi`/`cd_rgint`/`cd_rm` ficam **NULL** e a unidade não participa desses níveis (as 11 RGIs
e 3 RGInts seguem sem município, como já seguiam). Os agregados por RGI/RGInt a excluem
sozinhos — `o_rgi <> d_rgi` é NULL, nunca verdadeiro, em `04_flows.sql` —, e o módulo
metropolitano já filtra `cd_rm IS NOT NULL`.

Dado público: códigos e nomes vêm da malha municipal 1980 do IBGE (`geo/fetch_1980.sh` ->
`docs/qa/malha_1980_codigos.csv`), o mesmo conjunto que `MUN6_1980` cobre e que
`MUNICIPIOS_1980` não cobre (diferença de conjuntos conferida em
`pipeline/tests/test_edicao_1980.py`). Módulo escrito à mão de propósito: `labels_1980.py` é
gerado por `gen_edicao_1980.py` e traz o aviso "não editar à mão".
"""
from __future__ import annotations

# Código sintético da unidade agregada. Sete caracteres (mesma largura de um código municipal,
# para não quebrar nada que assuma essa largura), mas NÃO numérico, de propósito -- e a razão
# ficou MAIS forte agora que a unidade é publicada ao lado dos municípios reais:
#   - é impossível confundir com um código do IBGE, em qualquer data; quem encontrar 'NORTEGO'
#     num arquivo sabe na hora que não é um município;
#   - `TRY_CAST(... AS INTEGER)` devolve NULL em vez de um número plausível e errado;
#   - `SUBSTR(cd, 1, 2)` devolve 'NO', que não é UF nenhuma -- qualquer código que derive a UF
#     do prefixo falha visivelmente, em vez de imputar '52' ou '17' em silêncio (a escolha da
#     UF é uma decisão declarada, não um efeito colateral de SUBSTR). Os lugares que precisam
#     da UF a leem de `municipios_ref.uf`, não do prefixo.
# Descartados: '5200000'/'1700000' (lidos como "UF conhecida, município não especificado",
# que é uma categoria REAL e diferente desta edição -- 253.578 registros) e '5299999'/'1799999'
# (a sentinela de "não sabe o município" de 2010 tem exatamente essa forma).
NORTE_GOIAS = "NORTEGO"

UNIDADES_AGREGADAS_1980: dict[str, dict] = {
    NORTE_GOIAS: {
        "nome": "Norte de Goiás (atual Tocantins)",
        "nome_curto": "Norte de Goiás",
        "uf": "17",            # UF publicada: Tocantins (ver docstring)
        "uf_sigla": "TO",
        "uf_nome": "Tocantins",
        "uf_1980": "52",       # Goiás, a UF de direito em 1980
        "n_municipios": 52,
        "observacao": (
            "Não é um município: é a agregação dos 52 municípios do norte de Goiás que em "
            "1988 formaram o Tocantins, publicados como uma unidade só porque a fonte desta "
            "edição não informa em qual deles cada residente morava. Os números abaixo são do "
            "conjunto; mudanças de município dentro dele não aparecem como migração."
        ),
    },
}

# Os 52 municípios que compõem a unidade agregada: código de 7 dígitos de 1980 -> nome.
# O prefixo de 6 dígitos (código[:6]) é a chave de `v518`/`v527`/`MUN6_1980` usada em
# 01_extract.sql; os 7 dígitos são a chave da malha (geo/fetch_1980.sh dissolve exatamente
# estas 52 feições numa só).
MEMBROS: dict[str, dict[str, str]] = {
    NORTE_GOIAS: {
        "5200407": "Almas",
        "5200704": "Alvorada",
        "5201009": "Ananás",
        "5201900": "Araguacema",
        "5202007": "Araguaçu",
        "5202106": "Araguaína",
        "5202205": "Araguatins",
        "5202304": "Arapoema",
        "5202403": "Arraias",
        "5202700": "Aurora do Norte",
        "5202908": "Axixá de Goiás",
        "5203005": "Babaçulândia",
        "5203708": "Brejinho de Nazaré",
        "5205505": "Colinas de Goiás",
        "5205604": "Conceição do Norte",
        "5206008": "Couto de Magalhães",
        "5206107": "Cristalândia",
        "5207006": "Dianópolis",
        "5207204": "Dois Irmãos de Goiás",
        "5207303": "Dueré",
        "5207709": "Filadélfia",
        "5208202": "Formoso do Araguaia",
        "5209002": "Goiatins",
        "5209309": "Guaraí",
        "5209507": "Gurupi",
        "5210505": "Itacajá",
        "5210703": "Itaguatins",
        "5211107": "Itaporã de Goiás",
        "5212402": "Lizarda",
        "5213202": "Miracema do Norte",
        "5213301": "Miranorte",
        "5213608": "Monte do Carmo",
        "5214200": "Natividade",
        "5214309": "Nazaré",
        "5215108": "Novo Acordo",
        "5216106": "Paraíso do Norte de Goiás",
        "5216205": "Paranã",
        "5216502": "Pedro Afonso",
        "5216601": "Peixe",
        "5216700": "Colméia",
        "5217005": "Pindorama de Goiás",
        "5217500": "Pium",
        "5217807": "Ponte Alta do Bom Jesus",
        "5217906": "Ponte Alta do Norte",
        "5218201": "Porto Nacional",
        "5218409": "Presidente Kennedy",
        "5220306": "São Sebastião do Tocantins",
        "5220801": "Sítio Novo de Goiás",
        "5220900": "Taguatinga",
        "5221106": "Tocantínia",
        "5221205": "Tocantinópolis",
        "5222104": "Xambioá",
    },
}


def linhas_composicao() -> list[dict]:
    """Uma linha por município componente, para <interim>/unidades_agregadas.parquet.

    `prefixo6` é a chave de junção com `org6`/`trab6` (os 6 primeiros dígitos de `v518`/`v527`)
    em `pipeline/sql/1980/01_extract.sql`: é por ela que uma origem ou um destino pendular em
    qualquer dos 52 municípios resolve para a unidade, do mesmo jeito que um município real
    resolve por `municipios_ref`.
    """
    linhas = []
    for cd_unidade, info in UNIDADES_AGREGADAS_1980.items():
        for cd_mun_1980, nm_mun_1980 in MEMBROS[cd_unidade].items():
            linhas.append({
                "cd_unidade": cd_unidade,
                "nm_unidade": info["nome"],
                "uf": info["uf"],
                "uf_1980": info["uf_1980"],
                "prefixo6": cd_mun_1980[:6],
                "cd_mun_1980": cd_mun_1980,
                "nm_mun_1980": nm_mun_1980,
            })
    return linhas


def linhas_referencia() -> list[dict]:
    """Uma linha por unidade agregada, no esquema de `municipios_ref.parquet`.

    RGI/RGInt/RM/concentração urbana/AU ficam NULL (ver docstring do módulo): a unidade não
    participa desses níveis. meso/micro seguem o padrão da edição 1980, que não os tem.
    """
    return [
        {
            "cd_mun": cd_unidade,
            "nm_mun": info["nome"],
            "uf": info["uf"],
            "uf_sigla": info["uf_sigla"],
            "uf_nome": info["uf_nome"],
            "cd_meso": None, "nm_meso": None,
            "cd_micro": None, "nm_micro": None,
            "cd_rgi": None, "nm_rgi": None,
            "cd_rgint": None, "nm_rgint": None,
            "cd_concurb": None, "nm_concurb": None,
            "cd_rm": None, "nm_rm": None,
            "cd_au": None, "nm_au": None,
        }
        for cd_unidade, info in UNIDADES_AGREGADAS_1980.items()
    ]
