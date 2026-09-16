"""F9.8 (investigação, parte 2) — as 4 tabelas candidatas encontradas por
scripts/sonda_1980_staging_bd.py têm o MESMO schema (64 colunas, nenhum campo geográfico extra).
Isso não descarta a hipótese: a limpeza que zera `id_municipio` para os 178.338 registros de
sigla_uf='GO' pode acontecer na materialização final da produção, e a mesma coluna `id_municipio`
pode vir preenchida nas variantes de staging/dev. Este script compara a taxa de preenchimento de
`id_municipio` (mesma coluna, quatro tabelas) -- não precisa de nenhum campo novo.

Regra de sigilo: só contagens agregadas (COUNT). Nenhuma linha individual é lida.
Travas de cota: dry run + maximum_bytes_billed = 2 GiB por consulta (mesmo padrão de
scripts/extract_1980_bd.py) -- cada consulta aqui é um COUNT sobre uma partição por sigla_uf,
deve ficar bem abaixo disso.

Uso:
    .venv/bin/python scripts/sonda_1980_staging_valores.py --project <PROJETO_DE_FATURAMENTO>
"""
from __future__ import annotations

import argparse

from google.cloud import bigquery

GIB = 1024**3
LIMITE_POR_CONSULTA_GIB = 2.0
MAXIMUM_BYTES_BILLED = 2 * GIB

TABELAS = [
    "basedosdados.br_ibge_censo_demografico.microdados_pessoa_1980",
    "basedosdados-dev.br_ibge_censo_demografico.microdados_pessoa_1980",
    "basedosdados-dev.br_ibge_censo_demografico_staging.microdados_pessoa_1980",
    "basedosdados-staging.br_ibge_censo_demografico_staging.microdados_pessoa_1980",
]

# Conhecido da produção (docs/qa/sonda_1980_bd.md / MAPEAMENTO_02_classify.md §3.1): 178.338
# registros de sigla_uf='GO' com id_municipio NULL, de um total de N_GO na partição.
N_GO_NULL_PRODUCAO = 178_338


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--project", required=True, help="Projeto GCP de faturamento das consultas.")
    args = ap.parse_args()
    client = bigquery.Client(project=args.project)

    print("Comparando preenchimento de id_municipio (sigla_uf='GO') nas 4 tabelas candidatas.\n")
    for tabela in TABELAS:
        sql = f"""
            SELECT COUNT(*) AS n_go,
                   COUNT(id_municipio) AS n_preenchido,
                   COUNT(DISTINCT id_municipio) AS n_municipios_distintos
            FROM `{tabela}`
            WHERE sigla_uf = 'GO'
        """
        dry = client.query(sql, job_config=bigquery.QueryJobConfig(dry_run=True))
        estimativa_gib = dry.total_bytes_processed / GIB
        print(f"- `{tabela}`: dry run {estimativa_gib:.3f} GiB")
        if estimativa_gib > LIMITE_POR_CONSULTA_GIB:
            print(f"  ABORTADO: acima de {LIMITE_POR_CONSULTA_GIB} GiB por consulta.")
            continue
        cfg = bigquery.QueryJobConfig(maximum_bytes_billed=MAXIMUM_BYTES_BILLED)
        row = list(client.query(sql, job_config=cfg).result())[0]
        n_nulo = row.n_go - row.n_preenchido
        marca = " <-- MENOS nulos que a produção, INVESTIGAR" if (
            tabela != TABELAS[0] and n_nulo < N_GO_NULL_PRODUCAO) else ""
        print(f"  n_go={row.n_go:,} | preenchido={row.n_preenchido:,} | nulo={n_nulo:,} "
              f"| municípios distintos={row.n_municipios_distintos}{marca}")
    print(f"\nReferência (produção, já documentada): {N_GO_NULL_PRODUCAO:,} nulos esperados.")
    print("Se alguma linha acima mostrar MENOS nulos que a produção, essa tabela recupera parte "
          "dos 178.338 -- me avise o nome da tabela e os números para eu escrever o próximo passo "
          "(comparar os municípios distintos recuperados contra os 52 que faltam em "
          "pipeline/labels_1980.MUNICIPIOS_1980).")


if __name__ == "__main__":
    main()
