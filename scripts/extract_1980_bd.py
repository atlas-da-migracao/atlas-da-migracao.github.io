"""F9.1 — Extração da tabela basedosdados.br_ibge_censo_demografico.microdados_pessoa_1980
(BigQuery) para data/raw1980/pessoa_<uf>.parquet, uma consulta por sigla_uf (partição).

Regra de sigilo: este script só grava Parquet em data/raw1980/ (acesso controlado por convenção
de pipeline, gitignored) e só imprime/loga CONTAGENS agregadas por UF (linhas gravadas, Σ v604,
GiB lidos). Nunca lê nem imprime uma linha de pessoa.

Travas de cota obrigatórias (ver plano F9.0b — medido em 2026-09-16):
  1. Dry run (QueryJobConfig(dry_run=True)) antes de cada consulta real; só executa se o dry run
     estimar <= LIMITE_POR_CONSULTA_GIB.
  2. maximum_bytes_billed = 2 GiB em toda consulta real (o BigQuery recusa antes de rodar se
     estourar).
  3. Orçamento por execução do script: aborta ao acumular BUDGET_EXECUCAO_GIB de bytes billed.
  4. Cache por UF: pula a UF se data/raw1980/pessoa_<uf>.parquet já existir com a contagem
     esperada (ver EXPECTED, de docs/qa/sonda_1980_bd.md).
  5. Sentinela mensal: consulta INFORMATION_SCHEMA.JOBS_BY_PROJECT (metadados, ~0 bytes) e aborta
     se o projeto já tiver passado de SENTINELA_MENSAL_GIB no mês corrente.
  6. Nenhum outro script/agente roda consultas à BD por conta própria — só este e
     scripts/sonda_1980_bd.py, ambos com estas travas.

Uso:
    .venv/bin/python scripts/extract_1980_bd.py --project <PROJETO_DE_FATURAMENTO>

Requer autenticação já feita (gcloud auth application-default login) ou
GOOGLE_APPLICATION_CREDENTIALS. --project é só o projeto de FATURAMENTO das consultas (a tabela é
pública, em basedosdados.br_ibge_censo_demografico.microdados_pessoa_1980).
"""

from __future__ import annotations

import argparse
import pathlib
import sys

import pyarrow.parquet as pq
from google.cloud import bigquery

TABELA = "basedosdados.br_ibge_censo_demografico.microdados_pessoa_1980"
RAW_DIR = pathlib.Path("data/raw1980")

GIB = 1024**3
LIMITE_POR_CONSULTA_GIB = 2.0
MAXIMUM_BYTES_BILLED = 2 * GIB
BUDGET_EXECUCAO_GIB = 10.0
SENTINELA_MENSAL_GIB = 100.0

# 27 valores de sigla_uf na partição (26 UFs + FN, Fernando de Noronha -- ausente das cópias DBF
# do IBGE, ver docs/qa/sonda_1980_bd.md item (c)).
UFS = [
    "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "FN", "GO", "MA", "MG", "MS", "MT", "PA",
    "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP",
]

# n e Σ v604 esperados por UF, de docs/qa/sonda_1980_bd.md (a) -- usados só para validar o cache
# e o log final; nenhuma linha individual é lida para calculá-los.
EXPECTED: dict[str, tuple[int, int]] = {
    "AC": (70_503, 301_276),
    "AL": (490_216, 1_982_915),
    "AM": (338_052, 1_430_528),
    "AP": (42_752, 175_258),
    "BA": (2_345_216, 9_455_392),
    "CE": (1_307_351, 5_288_429),
    "DF": (290_017, 1_176_908),
    "ES": (501_651, 2_023_338),
    "FN": (298, 1_274),
    "GO": (953_137, 3_860_174),
    "MA": (973_793, 3_996_444),
    "MG": (3_329_884, 13_380_105),
    "MS": (328_244, 1_369_779),
    "MT": (264_639, 1_138_918),
    "PA": (828_740, 3_403_498),
    "PB": (699_007, 2_770_346),
    "PE": (1_521_170, 6_142_229),
    "PI": (514_497, 2_139_196),
    "PR": (1_876_014, 7_629_849),
    "RJ": (2_779_456, 11_291_631),
    "RN": (472_982, 1_898_835),
    "RO": (116_536, 491_025),
    "RR": (18_323, 79_121),
    "RS": (1_925_700, 7_773_849),
    "SC": (891_701, 3_628_292),
    "SE": (292_409, 1_140_379),
    "SP": (6_206_465, 25_042_074),
}

N_ESPERADO_TOTAL = 29_378_753
SOMA_PESO_ESPERADA_TOTAL = 119_011_062

# Colunas do contrato (ver instrução da tarefa / plano F9.1) -- id_municipio, v518 e v527 são
# tratados à parte (zero-padding a 7, VARCHAR) por serem códigos de município.
COLUNAS_DIRETAS = [
    "sigla_uf", "numero_ordem", "v598", "v211", "v501", "v503", "v509", "v511", "v512", "v513",
    "v514", "v515", "v516", "v517", "v520", "v521", "v522", "v523", "v524", "v528", "v529",
    "v530", "v532", "v533", "v604", "v606", "v607", "v608", "v609", "v610", "v611", "v612",
    "v613", "v680", "v681", "v682",
]


def build_sql() -> str:
    colunas = ", ".join(COLUNAS_DIRETAS)
    return f"""
        SELECT
          CAST(id_municipio AS STRING) AS id_municipio,
          {colunas},
          CASE WHEN v518 IS NULL THEN NULL
               ELSE LPAD(CAST(CAST(v518 AS INT64) AS STRING), 7, '0') END AS v518,
          CASE WHEN v527 IS NULL THEN NULL
               ELSE LPAD(CAST(CAST(v527 AS INT64) AS STRING), 7, '0') END AS v527
        FROM `{TABELA}`
        WHERE sigla_uf = @uf
    """


def gib(bytes_: int | None) -> float:
    return (bytes_ or 0) / GIB


def checar_sentinela_mensal(client: bigquery.Client, project: str) -> None:
    """Trava 5: aborta se o projeto já tiver passado de SENTINELA_MENSAL_GIB no mês corrente."""
    sql = f"""
        SELECT SUM(total_bytes_billed) AS total
        FROM `{project}`.`region-us`.INFORMATION_SCHEMA.JOBS_BY_PROJECT
        WHERE creation_time >= TIMESTAMP_TRUNC(CURRENT_TIMESTAMP(), MONTH)
    """
    job = client.query(sql)
    total = list(job.result())[0].total
    total_gib = gib(total)
    print(f"[sentinela] bytes billed no mês corrente do projeto {project}: {total_gib:.2f} GiB")
    if total_gib > SENTINELA_MENSAL_GIB:
        print(
            f"ABORTADO (sentinela mensal): {total_gib:.2f} GiB > {SENTINELA_MENSAL_GIB} GiB "
            "já faturados este mês no projeto. Investigue antes de rodar novas consultas.",
            file=sys.stderr,
        )
        sys.exit(1)


def cache_ok(uf: str) -> bool:
    """Trava 4: pula a UF se o parquet já existe com a contagem esperada."""
    caminho = RAW_DIR / f"pessoa_{uf.lower()}.parquet"
    if not caminho.exists():
        return False
    esperado_n, _ = EXPECTED[uf]
    try:
        n = pq.ParquetFile(caminho).metadata.num_rows
    except Exception:
        return False
    if n == esperado_n:
        print(f"[{uf}] cache ok ({n:,} linhas) -- pulando (0 GiB)")
        return True
    print(f"[{uf}] cache presente mas contagem diverge ({n:,} != {esperado_n:,}) -- reextraindo")
    return False


def extrair_uf(client: bigquery.Client, uf: str, orcamento_restante_gib: float) -> tuple[int, int, float]:
    sql = build_sql()
    params = [bigquery.ScalarQueryParameter("uf", "STRING", uf)]

    # Trava 1: dry run antes de qualquer consulta real.
    dry_cfg = bigquery.QueryJobConfig(dry_run=True, query_parameters=params)
    dry_job = client.query(sql, job_config=dry_cfg)
    estimativa_gib = gib(dry_job.total_bytes_processed)
    print(f"[{uf}] dry run: {estimativa_gib:.3f} GiB estimados")
    if estimativa_gib > LIMITE_POR_CONSULTA_GIB:
        raise RuntimeError(
            f"[{uf}] dry run estimou {estimativa_gib:.3f} GiB > limite de "
            f"{LIMITE_POR_CONSULTA_GIB} GiB por consulta -- abortando antes de executar."
        )
    if estimativa_gib > orcamento_restante_gib:
        raise RuntimeError(
            f"[{uf}] dry run estimou {estimativa_gib:.3f} GiB, mas só restam "
            f"{orcamento_restante_gib:.3f} GiB no orçamento desta execução -- abortando."
        )

    # Trava 2: maximum_bytes_billed em toda consulta real.
    run_cfg = bigquery.QueryJobConfig(
        query_parameters=params,
        maximum_bytes_billed=MAXIMUM_BYTES_BILLED,
    )
    job = client.query(sql, job_config=run_cfg)
    tabela_arrow = job.to_arrow()
    bytes_billed = job.total_bytes_billed or 0

    caminho = RAW_DIR / f"pessoa_{uf.lower()}.parquet"
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    pq.write_table(tabela_arrow, caminho)

    n = tabela_arrow.num_rows
    # Σ v604 -- agregado, calculado a partir da coluna em memória (sem imprimir linhas).
    soma_v604 = int(pyarrow_sum(tabela_arrow, "v604"))
    return n, soma_v604, gib(bytes_billed)


def pyarrow_sum(tabela, coluna: str) -> int:
    import pyarrow.compute as pc

    return pc.sum(tabela.column(coluna)).as_py() or 0


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--project", required=True, help="Projeto GCP de faturamento das consultas.")
    args = ap.parse_args()

    client = bigquery.Client(project=args.project)

    checar_sentinela_mensal(client, args.project)

    RAW_DIR.mkdir(parents=True, exist_ok=True)

    orcamento_restante_gib = BUDGET_EXECUCAO_GIB
    total_linhas = 0
    total_soma_peso = 0
    total_gib_lido = 0.0
    log: list[str] = []

    for uf in UFS:
        if cache_ok(uf):
            esperado_n, esperado_soma = EXPECTED[uf]
            total_linhas += esperado_n
            total_soma_peso += esperado_soma
            log.append(f"{uf}: n={esperado_n:,} Σv604={esperado_soma:,} GiB=0.000 (cache)")
            continue

        if orcamento_restante_gib <= 0:
            print(
                f"ABORTADO (orçamento por execução): {BUDGET_EXECUCAO_GIB} GiB esgotados antes "
                f"de extrair {uf}.",
                file=sys.stderr,
            )
            sys.exit(1)

        n, soma_v604, gib_lido = extrair_uf(client, uf, orcamento_restante_gib)
        orcamento_restante_gib -= gib_lido
        total_linhas += n
        total_soma_peso += soma_v604
        total_gib_lido += gib_lido

        esperado_n, esperado_soma = EXPECTED[uf]
        marca_n = "ok" if n == esperado_n else f"DIVERGE (esperado {esperado_n:,})"
        marca_soma = "ok" if soma_v604 == esperado_soma else f"DIVERGE (esperado {esperado_soma:,})"
        linha = (
            f"{uf}: n={n:,} [{marca_n}] Σv604={soma_v604:,} [{marca_soma}] "
            f"GiB={gib_lido:.3f} (restam {orcamento_restante_gib:.3f} GiB no orçamento)"
        )
        print(linha)
        log.append(linha)

    print("\n--- Resumo ---")
    for linha in log:
        print(linha)
    print(
        f"\nTOTAL: n={total_linhas:,} (esperado {N_ESPERADO_TOTAL:,}) | "
        f"Σv604={total_soma_peso:,} (esperado {SOMA_PESO_ESPERADA_TOTAL:,}) | "
        f"GiB lidos nesta execução={total_gib_lido:.3f}"
    )


if __name__ == "__main__":
    main()
