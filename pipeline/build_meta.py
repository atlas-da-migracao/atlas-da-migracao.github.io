"""Gera <processed>/meta.json: rótulos, cortes, limiares e versão dos dados.

Consolida as constantes usadas no pipeline (disclosure_rules.py) para que o front-end
não precise duplicá-las. Salário mínimo e período de referência variam por edição (ver
pipeline/edicoes.py, fonte única dessas constantes) -- --edicao 2022 é o default e
reproduz exatamente o comportamento anterior.
"""
import argparse
import datetime as dt
import json
import pathlib
import subprocess
import sys
import tempfile

import duckdb

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "pipeline"))
import disclosure_rules as R  # noqa: E402
from edicoes import ACESSO_DESCRICAO, edicao as get_edicao  # noqa: E402


def _maior_fluxo(ed) -> int:
    """Maior valor de `total` entre os fluxos municipais publicados desta edição (F3 -- mapa
    representação): usado pelo front para uma escala de espessura ABSOLUTA por edição, em vez
    de normalizar cada arco pelo maior fluxo em tela (o que faz a mesma espessura em pixels
    valer volumes completamente diferentes conforme a vista). Lê só `data/processed/fluxos.parquet`
    (agregado já publicado, não microdado) -- respeita a regra de sigilo do CLAUDE.md."""
    caminho = ROOT / ed.processed / "fluxos.parquet"
    with duckdb.connect() as con:
        maior = con.execute(f"SELECT MAX(total) FROM read_parquet('{caminho.as_posix()}')").fetchone()[0]
    return int(maior)

# DOI emitido pelo Zenodo ao publicar a release v1.0.0 (integração GitHub -> Zenodo).
# Única fonte destas constantes para o front-end interativo; as páginas estáticas de SEO
# têm suas próprias (pipeline/build_paginas.py), mantidas em sincronia manualmente.
DOI_CONCEITO = "10.5281/zenodo.22469791"  # resolve sempre para a versão mais recente
DOI_VERSAO = "10.5281/zenodo.22469792"    # esta versão (v1.0.0)
AUTOR_NOME = "Daniel Pessini"
AUTOR_ORCID = "https://orcid.org/0000-0002-6632-3991"

ROTULOS = {
    "status": {
        "retorno_natal": "Retorno ao município natal",
        "primeira_saida": "Primeira saída do município natal",
        "etapas_multiplas": "Migração de etapas múltiplas",
        # só na edição 2010 (sem código de município de nascimento, primeira_saida/
        # etapas_multiplas colapsam nesta categoria -- ver docs/METODOLOGIA.md)
        "nao_natural": "Não nasceu no município nem no exterior",
        "nascido_exterior": "Nascido no exterior, migrante interno",
        "internacional_brasileiro": "Retorno do exterior (brasileiro)",
        "internacional_estrangeiro": "Imigração internacional (estrangeiro)",
        "origem_nao_informada": "Origem não informada",
        "outros": "Outros / suprimido",
    },
    "edu": {
        "sem_instr_fund_incompleto": "Sem instrução ou fundamental incompleto",
        "fund_completo_medio_incompleto": "Fundamental completo, médio incompleto",
        "medio_completo_superior_incompleto": "Médio completo, superior incompleto",
        "superior_completo": "Superior completo",
        "nao_determinado": "Não determinado",
        "outros": "Outros / suprimido",
    },
    "renda": {
        "ate_1_4_sm": "Até 1/4 de salário mínimo",
        "de_1_4_a_1_2_sm": "De 1/4 a 1/2 salário mínimo",
        "de_1_2_a_1_sm": "De 1/2 a 1 salário mínimo",
        "de_1_a_2_sm": "De 1 a 2 salários mínimos",
        "mais_de_2_sm": "Mais de 2 salários mínimos",
        "nao_aplicavel": "Não aplicável (domicílio coletivo)",
        "outros": "Outros / suprimido",
    },
    "idade_sexo": {
        "05_14_M": "5 a 14 anos, masculino", "05_14_F": "5 a 14 anos, feminino",
        "15_24_M": "15 a 24 anos, masculino", "15_24_F": "15 a 24 anos, feminino",
        "25_39_M": "25 a 39 anos, masculino", "25_39_F": "25 a 39 anos, feminino",
        "40_59_M": "40 a 59 anos, masculino", "40_59_F": "40 a 59 anos, feminino",
        "60_mais_M": "60 anos ou mais, masculino", "60_mais_F": "60 anos ou mais, feminino",
        "outros": "Outros / suprimido",
    },
    "frequencia": {"retorno_diario": "Retorna 3+ dias/semana", "semanal_longa": "Retorno semanal ou mais longo"},
    "modo": {
        "a_pe_bicicleta": "A pé ou bicicleta", "motocicleta": "Motocicleta ou mototáxi",
        "automovel_taxi": "Automóvel ou táxi", "onibus_van_brt": "Ônibus, van ou BRT",
        "trem_metro": "Trem ou metrô", "outros": "Outros",
    },
    "posicao": {
        "empregado_com_carteira": "Empregado com carteira", "empregado_sem_carteira": "Empregado sem carteira",
        "militar_estatutario": "Militar ou estatutário", "empregador": "Empregador",
        "conta_propria_familiar": "Conta própria ou familiar",
    },
    "setor": {
        "agropecuaria": "Agropecuária", "industria": "Indústria", "construcao": "Construção",
        "comercio": "Comércio", "transporte_logistica": "Transporte e logística",
        "servicos_empresariais": "Serviços empresariais", "admin_educacao_saude": "Administração, educação e saúde",
        "outros_servicos": "Outros serviços",
    },
    "renda_trab": {
        "sem_declaracao": "Sem declaração", "ate_1_sm": "Até 1 salário mínimo",
        "de_1_a_2_sm": "De 1 a 2 salários mínimos", "de_2_a_3_sm": "De 2 a 3 salários mínimos",
        "de_3_a_5_sm": "De 3 a 5 salários mínimos", "mais_de_5_sm": "Mais de 5 salários mínimos",
    },
    "nivel": {
        "infantil_fundamental": "Infantil ou fundamental", "medio": "Médio",
        "graduacao": "Graduação", "pos_graduacao": "Pós-graduação",
    },
}


def _bounds_albers(ed) -> dict | None:
    """Bounds (metros, x/y) da malha de municípios já projetada em Albers (F10):
    `municipios_albers.topojson`, gerado por geo/build.sh. Publicado em meta.json para o
    front-end enquadrar a vista nacional (`fitBounds` cartesiano) sem ter que baixar/decodificar
    o TopoJSON só para calcular um bbox. `None` se o arquivo ainda não foi gerado (edição
    ainda não passou pela Fase 4 do mapa -- não deve acontecer depois que geo/build.sh roda,
    mas evita quebrar o build.py de uma edição parcialmente migrada)."""
    caminho = ROOT / ed.processed / "geo" / "municipios_albers.topojson"
    if not caminho.exists():
        return None
    with tempfile.TemporaryDirectory() as tmp:
        geojson_path = pathlib.Path(tmp) / "decoded.geojson"
        subprocess.run(
            ["node", str(ROOT / "geo/decode_topojson.mjs"), str(caminho), str(geojson_path)],
            check=True, cwd=ROOT,
        )
        fc = json.loads(geojson_path.read_text(encoding="utf-8"))

    xs: list[float] = []
    ys: list[float] = []

    def _coleta(coords):
        if isinstance(coords[0], (int, float)):
            xs.append(coords[0])
            ys.append(coords[1])
        else:
            for c in coords:
                _coleta(c)

    for feat in fc["features"]:
        geom = feat.get("geometry")
        if geom and geom.get("coordinates"):
            _coleta(geom["coordinates"])

    if not xs:
        return None
    return {"x_min": min(xs), "x_max": max(xs), "y_min": min(ys), "y_max": max(ys)}


def _unidades_agregadas(ed) -> list[dict] | None:
    """Rótulos das unidades agregadas da edição (ver `meta["unidades_agregadas"]`).

    Uma unidade agregada é um conjunto de municípios do censo publicado como UMA unidade,
    porque a fonte não distingue os municípios que o compõem. Só o Censo 1980 tem uma (o norte
    de Goiás, 52 municípios). O import é tardio para que a ausência do módulo nunca afete as
    demais edições.

    Isto é o que o front precisa para dizer, no painel da unidade, que ela NÃO é um município
    -- mesmo padrão do selo `aviso_proxy`: o texto vem daqui, nunca hardcoded no componente,
    para que a explicação tenha uma fonte só (ver web/src/components/AvisoUnidade.tsx).
    """
    if ed.nome != "1980":
        return None
    import unidades_agregadas_1980 as U

    return [
        {
            "codigo": cd,
            "nome": info["nome"],
            "nome_curto": info["nome_curto"],
            "n_municipios": info["n_municipios"],
            "uf": info["uf"],
            "uf_censo": info["uf_1980"],
            "nota": info["observacao"],
        }
        for cd, info in U.UNIDADES_AGREGADAS_1980.items()
    ]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--edicao", default="2022", help="Edição do censo (ver pipeline/edicoes.py).")
    args = ap.parse_args()
    ed = get_edicao(args.edicao)
    L = R.limiares(ed.chave_domicilio)

    # Rótulos parametrizados por edição (ver pipeline/edicoes.py, Edicao.rotulos_pendular):
    # parte do vocabulário-padrão (ROTULOS) e sobrescreve/remove só o que a edição declara.
    rotulos = dict(ROTULOS)  # cópia rasa
    for chave, valor in ed.rotulos_pendular.items():
        if valor is None:
            rotulos.pop(chave, None)
        else:
            rotulos[chave] = valor

    # Edições sem deslocamento pendular (ed.pendular=False) não publicam o módulo inteiro
    # (pipeline/publish.py, F2b): além das chaves de frequencia/modo/tempo já tratadas acima
    # via rotulos_pendular, remove também as demais dimensões que só existem dentro do módulo
    # pendular (posição na ocupação, setor de atividade, renda do trabalho e nível de ensino
    # do local de estudo).
    if not ed.pendular:
        for chave in ("posicao", "setor", "renda_trab", "nivel"):
            rotulos.pop(chave, None)

    acesso_desc = ACESSO_DESCRICAO[ed.acesso]
    meta = {
        "edicao": ed.nome,
        "versao_dados": dt.date.today().isoformat(),
        "gerado_em": dt.datetime.now().isoformat(timespec="seconds"),
        "fonte": f"IBGE, Censo Demográfico {ed.nome}, microdados da amostra ({acesso_desc})",
        "periodo_referencia": dict(ed.periodo_referencia),
        "salario_minimo_referencia": ed.salario_minimo,
        # F3 (mapa-representação): maior fluxo municipal publicado desta edição -- base da
        # escala de espessura ABSOLUTA dos arcos no mapa (ver web/src/map/MapaAtlas.tsx).
        "maior_fluxo": _maior_fluxo(ed),
        # F10: bounds (m) da malha de municípios em Albers, para fitBounds cartesiano da vista
        # nacional sem ler o TopoJSON só para isso (ver web/src/map/MapaAtlas.tsx).
        **({"bounds_albers": ba} if (ba := _bounds_albers(ed)) else {}),
        # Limiares EFETIVOS desta edição, não as constantes-padrão: numa edição sem chave de
        # domicílio (Censo 1980) `min_domicilios` é null e os pisos de pessoas vêm elevados, e a
        # página de metodologia do site precisa dizer isso em vez de prometer um piso de
        # domicílios que não foi aplicado. Ver disclosure_rules.limiares().
        "revelacao": {
            "min_pessoas": L.min_pessoas,
            "min_domicilios": L.min_domicilios,
            "min_pessoas_detalhe": L.min_pessoas_detalhe,
            "arredondamento": R.ARREDONDAMENTO,
            "cv_boa": R.CV_BOA,
            "cv_cautela": R.CV_CAUTELA,
        },
        "rotulos": rotulos,
        "citacao": {
            "autor": AUTOR_NOME,
            "autor_orcid": AUTOR_ORCID,
            "doi_conceito": DOI_CONCEITO,
            "doi_versao": DOI_VERSAO,
            "licenca": "CC BY 4.0",
            "licenca_url": "https://creativecommons.org/licenses/by/4.0/deed.pt-br",
            "texto": (
                f"{AUTOR_NOME}. Atlas da migração interna no Brasil. Dados do Censo "
                f"Demográfico {ed.nome} (IBGE). DOI: https://doi.org/" + DOI_CONCEITO + "."
            ),
        },
        # Achado do checkpoint F9.7-b (ao tornar a página de metodologia sensível à edição):
        # "sujeitas a erro amostral" contradiz a própria página em toda edição sem chave de
        # domicílio (hoje só 1980, `ed.chave_domicilio=False`) -- lá se/cv são NULL e a edição é
        # publicada como `sem_estimativa`, não com erro amostral calculado. A cláusula muda só
        # nesse caso; nas outras quatro o texto é idêntico ao de antes.
        "aviso": (
            "Estimativas elaboradas pelo autor a partir dos microdados da amostra do "
            f"Censo Demográfico {ed.nome} (IBGE, {acesso_desc}), sujeitas a controle "
            "estatístico de revelação"
            + (", publicadas sem estimativa de erro amostral (a fonte não permite calculá-lo)"
               if not ed.chave_domicilio else " e a erro amostral")
            + "; podem divergir das tabulações oficiais do IBGE (SIDRA)."
        ),
        # Texto do selo "proxy" (front-end: componente único usado na capa e nos painéis de
        # município/unidade e de fluxo quando `Edicao.proxyDataFixa` -- ver
        # web/src/lib/edicoes.ts). `null` em toda edição que tem quesito de data fixa direto.
        # Conteúdo consolidado a partir da calibração do proxy contra a data fixa verdadeira
        # do Censo 1991 -- ver docs/METODOLOGIA.md, "Edição Censo 1980 e comparabilidade",
        # item 2, e pipeline/sql/1980/MAPEAMENTO_02_classify.md §2.6. Não editar este texto
        # sem alinhar com a mesma seção de METODOLOGIA.md.
        # Redação revista pelo metodólogo em F9.7: os números seguem o arredondamento do selo
        # aprovado em §2.6 (100%, 89%, 0,98, +7%, ~2 p.p.) e a última frase antes da regra de
        # comparação é a **ressalva obrigatória** daquela seção -- a calibração foi feita em
        # 1991, então os desvios medem o erro do conceito e são um PISO para 1980. Se for
        # preciso encurtar o card, corte a cláusula do meio (origem/correlação), nunca a
        # ressalva. Mexer aqui invalida o carimbo do gate de 1980 (meta.json entra no
        # .gate_ok): regerar meta.json e recarimbar a edição depois de qualquer alteração.
        "aviso_proxy": (
            "Esta edição não tem quesito de data fixa: a migração é um proxy (tempo de "
            "residência no município + município de residência anterior), calibrado contra a "
            "data fixa do Censo 1991. Ele capta 100% dos migrantes, acerta a origem municipal "
            "de 89% deles e reproduz as taxas líquidas com correlação de 0,98; em troca, infla "
            "o volume em cerca de 7%, atenua os saldos em 6% a 9% e subestima a migração "
            "interestadual em cerca de 2 pontos percentuais. Como a calibração foi feita em "
            "1991, esses desvios são um piso. Entre edições, compare composição, direção e "
            "hierarquia dos fluxos — não o nível."
        ) if ed.proxy_data_fixa else None,
        # Resumo de uma linha para o card fechado (achado do auditor em F9.7-b: o texto
        # completo acima tem ~106 palavras e ~40% da altura visível do painel na capa --
        # denso demais pra um card de UI). web/src/components/AvisoProxy.tsx mostra este
        # resumo sempre e abre o texto completo acima ("saiba mais") sob demanda -- a
        # ressalva de calibração (piso, não erro desta edição) fica só no texto completo,
        # de propósito: o resumo é a "o quê", o completo é o "por que confiar quanto".
        "aviso_proxy_resumo": (
            "O Censo 1980 não perguntou onde a pessoa morava 5 anos antes: a migração aqui é "
            "estimada por um proxy, com volume cerca de 7% acima do real e saldos mais fracos "
            "do que seriam. Compare direção e composição entre municípios — não o volume total."
        ) if ed.proxy_data_fixa else None,
        # Unidades agregadas (F9.9): conjuntos de municípios do censo publicados como UMA
        # unidade, porque a fonte não distingue os municípios que os compõem. Hoje só 1980 tem
        # um caso, o norte de Goiás ('NORTEGO'). Diferente da chave `origens_agregadas` de
        # 1.0.1-1980, que descrevia uma origem SEM unidade, esta descreve uma unidade de
        # verdade: ela está em municipios.parquet, nos dois lados de fluxos.parquet e na malha,
        # e o front a trata como qualquer município -- o que este bloco existe para dizer é o
        # que ela tem de diferente (não é um município; 52 municípios agregados; mudanças
        # internas não aparecem como migração). Ver pipeline/unidades_agregadas_1980.py e
        # docs/METODOLOGIA.md, item 4 da seção do Censo 1980.
        **({"unidades_agregadas": unids_ag} if (unids_ag := _unidades_agregadas(ed)) else {}),
    }
    dest = ROOT / ed.processed / "meta.json"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"meta.json: {dest.stat().st_size} bytes")


if __name__ == "__main__":
    main()
