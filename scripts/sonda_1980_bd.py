"""F9.0 — Sondagem da tabela basedosdados.br_ibge_censo_demografico.microdados_pessoa_1980
(BigQuery) antes de desenhar a extração/classificação da edição Censo 1980.

Regra de sigilo: só consultas AGREGADAS (COUNT, SUM, GROUP BY com n >= 5). Nunca um SELECT que
devolva uma linha de pessoa. Este script não lê nem imprime nenhuma linha individual.

Uso:
    python scripts/sonda_1980_bd.py --project <SEU_PROJETO_GCP_DE_FATURAMENTO>

Requer autenticação já feita (`gcloud auth application-default login`) ou
GOOGLE_APPLICATION_CREDENTIALS apontando para uma service account. O projeto passado em --project é
só o projeto de FATURAMENTO das consultas (o dado é público, em basedosdados-public-data ou lido via
`basedosdados.br_ibge_censo_demografico.microdados_pessoa_1980`, projeto `basedosdados`).

Escreve o relatório em docs/qa/sonda_1980_bd.md (só números agregados).
"""

from __future__ import annotations

import argparse
import pathlib

from google.cloud import bigquery

TABELA = "basedosdados.br_ibge_censo_demografico.microdados_pessoa_1980"

# Esperado, a partir das cópias DBF do IBGE (validado em sessão anterior, ver plano F9):
POP_ESPERADA_1980 = 119_002_706  # aprox.; Σ PESOP nas cópias DBF locais
N_ESPERADO = 29_378_455
N_MUNICIPIOS_ESPERADO = 3_990
SUM_PESO_ES_ESPERADO = 2_023_338  # Espírito Santo, validado na exploração de F9 anterior


def q(client: bigquery.Client, sql: str) -> list[bigquery.table.Row]:
    job = client.query(sql)
    return list(job.result())


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--project", required=True, help="Projeto GCP de faturamento das consultas.")
    args = ap.parse_args()

    client = bigquery.Client(project=args.project)
    linhas: list[str] = ["# Sondagem — basedosdados.br_ibge_censo_demografico.microdados_pessoa_1980",
                          "", "Todas as consultas abaixo são agregadas (COUNT/SUM/GROUP BY); nenhuma "
                          "linha individual foi lida ou impressa.", ""]

    def secao(titulo: str) -> None:
        linhas.append(f"## {titulo}")
        linhas.append("")

    def linha(txt: str) -> None:
        linhas.append(txt)
        print(txt)

    # (a) contagens e Σ peso por UF
    secao("(a) Contagem de registros e Σ peso por UF")
    rows = q(client, f"""
        SELECT sigla_uf, COUNT(*) AS n, SUM(v604) AS soma_peso
        FROM `{TABELA}`
        GROUP BY sigla_uf ORDER BY sigla_uf
    """)
    total_n = total_peso = 0
    for r in rows:
        linha(f"- {r.sigla_uf}: n={r.n:,} | Σpeso={r.soma_peso:,}")
        total_n += r.n
        total_peso += r.soma_peso
    linha("")
    linha(f"**TOTAL: n={total_n:,} (esperado {N_ESPERADO:,}) | Σpeso={total_peso:,} "
          f"(esperado ≈{POP_ESPERADA_1980:,})**")
    es = next((r for r in rows if r.sigla_uf == "ES"), None)
    if es:
        linha(f"- Conferência ES: Σpeso={es.soma_peso:,} (esperado {SUM_PESO_ES_ESPERADO:,})")
    linhas.append("")

    # (b) v518 como município de residência anterior?
    secao("(b) v518 (\"UF do município que morava anteriormente\") — é município ou só UF?")
    rows = q(client, f"""
        SELECT
          CASE WHEN v517 IS NULL THEN 'null'
               WHEN CAST(v517 AS INT64) BETWEEN 0 AND 6 THEN '<10 anos (0-6)'
               WHEN CAST(v517 AS INT64) = 7 THEN '10+ anos (7)'
               WHEN CAST(v517 AS INT64) = 8 THEN 'nasceu (8)'
               ELSE 'outro/s_decl' END AS faixa_v517,
          COUNT(*) AS n,
          COUNTIF(v518 IS NOT NULL AND v518 != 0) AS n_v518_preenchido,
          APPROX_QUANTILES(LENGTH(CAST(v518 AS STRING)), 4) AS quartis_len_v518
        FROM `{TABELA}`
        GROUP BY faixa_v517 ORDER BY faixa_v517
    """)
    for r in rows:
        linha(f"- v517={r.faixa_v517}: n={r.n:,} | v518 preenchido={r.n_v518_preenchido:,} "
              f"({100*r.n_v518_preenchido/r.n:.1f}%) | quartis(len)={r.quartis_len_v518}")
    linhas.append("")
    linha("Interpretação esperada se v518 = código de município (7 dígitos): preenchimento alto "
          "(~100%) para faixas <10 anos, ~0% para 'nasceu'.")
    linhas.append("")

    secao("(b2) Distribuição de v518 (top 20 valores, amostra de dígitos iniciais)")
    rows = q(client, f"""
        SELECT SUBSTR(CAST(v518 AS STRING), 1, 2) AS prefixo2, COUNT(*) AS n
        FROM `{TABELA}` WHERE v518 IS NOT NULL AND v518 != 0
        GROUP BY prefixo2 ORDER BY n DESC LIMIT 30
    """)
    for r in rows:
        linha(f"  prefixo2={r.prefixo2}: n={r.n:,}")
    linhas.append("")

    # (c) municípios distintos e casamento com DTB (id_municipio)
    secao("(c) id_municipio — contagem de municípios distintos")
    rows = q(client, f"SELECT COUNT(DISTINCT id_municipio) AS n_mun FROM `{TABELA}`")
    linha(f"- COUNT(DISTINCT id_municipio) = {rows[0].n_mun:,} (esperado {N_MUNICIPIOS_ESPERADO:,})")
    rows = q(client, f"SELECT COUNT(DISTINCT LENGTH(id_municipio)) AS n_tam, "
                      f"MIN(LENGTH(id_municipio)) AS min_len, MAX(LENGTH(id_municipio)) AS max_len "
                      f"FROM `{TABELA}`")
    linha(f"- comprimentos distintos de id_municipio: {rows[0].n_tam} (min={rows[0].min_len}, "
          f"max={rows[0].max_len}; esperado sempre 7)")
    linhas.append("")

    # (d) numero_ordem: chave de domicílio?
    secao("(d) numero_ordem — é ordem da pessoa (sem chave de domicílio) ou id de domicílio?")
    rows = q(client, f"""
        SELECT MIN(numero_ordem) AS min_o, MAX(numero_ordem) AS max_o,
               APPROX_QUANTILES(numero_ordem, 4) AS quartis,
               COUNT(DISTINCT numero_ordem) AS n_distintos
        FROM `{TABELA}`
    """)
    r = rows[0]
    linha(f"- numero_ordem: min={r.min_o}, max={r.max_o}, quartis={r.quartis}, "
          f"distintos={r.n_distintos:,}")
    linha("Interpretação: max pequeno (dezenas) e muitos repetidos por UF ⇒ é ordem da pessoa no "
          "domicílio (equivalente a V500), NÃO uma chave de domicílio — sem chave de domicílio "
          "publicada na BD, a variância exige estrato substituto sem UPA (ver decisão de F9.0).")
    linhas.append("")

    # (e) v527 (pendular): nunca igual ao próprio município, sentinelas
    secao("(e) v527 (\"Município que trabalha ou estuda\") — validação como pendular")
    rows = q(client, f"""
        SELECT
          COUNTIF(v527 IS NULL OR v527 = '0' OR v527 = '0000000') AS n_zero_ou_nulo,
          COUNTIF(v527 IS NOT NULL AND v527 != '0' AND v527 != '0000000') AS n_preenchido,
          COUNTIF(v527 IS NOT NULL AND v527 = id_municipio) AS n_igual_proprio,
          COUNT(*) AS n_total
        FROM `{TABELA}`
    """)
    r = rows[0]
    linha(f"- zero/nulo: {r.n_zero_ou_nulo:,} | preenchido: {r.n_preenchido:,} "
          f"({100*r.n_preenchido/r.n_total:.2f}%) | igual ao próprio município: {r.n_igual_proprio:,} "
          "(esperado 0)")
    rows = q(client, f"""
        SELECT SUBSTR(v527, 1, 2) AS prefixo2, COUNT(*) AS n
        FROM `{TABELA}` WHERE v527 IS NOT NULL AND v527 != '0' AND v527 != '0000000'
        GROUP BY prefixo2 ORDER BY n DESC LIMIT 30
    """)
    for r in rows:
        linha(f"  prefixo2={r.prefixo2}: n={r.n:,}")
    linhas.append("")

    # (f) v598 sempre preenchida?
    secao("(f) v598 (situação urbano/rural da pessoa) — cobertura")
    rows = q(client, f"""
        SELECT v598, COUNT(*) AS n FROM `{TABELA}` GROUP BY v598 ORDER BY n DESC
    """)
    for r in rows:
        linha(f"- v598={r.v598}: n={r.n:,}")
    linhas.append("")

    # (g) v511/v512 nacionalidade e naturalidade, sentinelas
    secao("(g) v511 (nacionalidade) e v512 (UF de nascimento, sequencial) — distribuição")
    rows = q(client, f"SELECT v511, COUNT(*) AS n FROM `{TABELA}` GROUP BY v511 ORDER BY n DESC")
    for r in rows:
        linha(f"- v511={r.v511}: n={r.n:,}")
    rows = q(client, f"""
        SELECT v512, COUNT(*) AS n FROM `{TABELA}`
        GROUP BY v512 ORDER BY n DESC LIMIT 35
    """)
    linhas.append("")
    for r in rows:
        linha(f"- v512={r.v512}: n={r.n:,}")
    linhas.append("")

    out = pathlib.Path("docs/qa/sonda_1980_bd.md")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(linhas), encoding="utf-8")
    print(f"\nRelatório gravado em {out}")


if __name__ == "__main__":
    main()
