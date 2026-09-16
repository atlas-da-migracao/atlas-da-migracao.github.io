"""F9.8 (investigação) — sonda a staging da Base dos Dados em busca de um campo geográfico bruto
para os 178.338 registros de sigla_uf='GO' com id_municipio NULL em
basedosdados.br_ibge_censo_demografico.microdados_pessoa_1980 (ver docs/EDICOES.md e
pipeline/sql/1980/MAPEAMENTO_02_classify.md §3).

Hipótese: a tabela pública é modelada via dbt como `safe_cast` de uma tabela de staging anterior
(ver docstring do plano F9.2 -- "cujo modelo dbt apenas faz safe_cast da staging"). Se a staging
tiver um campo geográfico ainda não convertido para INT64 (ex.: um código de 6 dígitos como o do
Ceará em v518/v527, ou um valor com caractere não numérico que quebra o safe_cast), pode ser
recuperável -- o mesmo padrão que já resolveu o Ceará em F9.2.

Regra de sigilo: só metadados (nomes de dataset/tabela/coluna) e contagens agregadas. Nunca uma
linha de pessoa. As mesmas travas de cota de scripts/extract_1980_bd.py se aplicam à Fase 2 (a
Fase 1 é só metadados, ~0 bytes, sem necessidade de trava de custo).

Uso:
    .venv/bin/python scripts/sonda_1980_staging_bd.py --project <PROJETO_DE_FATURAMENTO>

Requer autenticação já feita (gcloud auth application-default login) ou
GOOGLE_APPLICATION_CREDENTIALS -- mesmo requisito de scripts/sonda_1980_bd.py.

Escreve o relatório em docs/qa/sonda_1980_staging_bd.md.
"""
from __future__ import annotations

import argparse
import pathlib

from google.cloud import bigquery

GIB = 1024**3
LIMITE_POR_CONSULTA_GIB = 2.0
MAXIMUM_BYTES_BILLED = 2 * GIB

# Datasets candidatos a conter a staging do censo 1980. A Base dos Dados normalmente publica o
# dataset final (br_ibge_censo_demografico) e, às vezes, um projeto/dataset de staging separado
# com prefixo "br_ibge_censo_demografico_staging" ou dentro de um projeto "basedosdados-dev"/
# "rj-iplanrio" etc. -- não documentado publicamente, por isso a Fase 1 é uma varredura.
PROJETOS_CANDIDATOS = ["basedosdados", "basedosdados-dev", "basedosdados-staging"]
PROJETO_PROD = "basedosdados"
DATASET_PROD = "br_ibge_censo_demografico"
TABELA_PROD = f"{PROJETO_PROD}.{DATASET_PROD}.microdados_pessoa_1980"

# Colunas que, se existirem numa tabela candidata e não forem id_municipio (que sabemos NULL),
# valem a pena inspecionar -- qualquer coisa com "munic" ou "geo" ou "local" no nome.
PALAVRAS_CHAVE_COLUNA = ["munic", "geo", "local", "cod_", "codigo", "uf_", "distrito"]


def linha_arquivo(linhas: list[str], txt: str) -> None:
    linhas.append(txt)
    print(txt)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--project", required=True, help="Projeto GCP de faturamento das consultas.")
    args = ap.parse_args()

    client = bigquery.Client(project=args.project)
    linhas: list[str] = [
        "# Sondagem — staging da Base dos Dados para os 178.338 registros GO/id_municipio NULL",
        "",
        "Só metadados (Fase 1) e contagens agregadas (Fase 2). Nenhuma linha individual foi lida.",
        "",
    ]

    # ---------------- Fase 1: descoberta de datasets/tabelas (metadados, ~0 bytes) ----------------
    linha_arquivo(linhas, "## Fase 1 — datasets e tabelas candidatas a staging")
    linha_arquivo(linhas, "")

    candidatos: list[tuple[str, str, str]] = []  # (projeto, dataset, tabela)
    for projeto in PROJETOS_CANDIDATOS:
        try:
            datasets = list(client.list_datasets(project=projeto))
        except Exception as e:  # noqa: BLE001 -- projeto pode não existir/não ser acessível
            linha_arquivo(linhas, f"- projeto `{projeto}`: inacessível ({type(e).__name__}: {e})")
            continue
        alvo = [d for d in datasets if "censo_demografico" in d.dataset_id.lower()
                or "staging" in d.dataset_id.lower()]
        linha_arquivo(linhas, f"- projeto `{projeto}`: {len(datasets)} datasets; "
                               f"{len(alvo)} candidato(s): {[d.dataset_id for d in alvo]}")
        for d in alvo:
            try:
                tabelas = list(client.list_tables(f"{projeto}.{d.dataset_id}"))
            except Exception as e:  # noqa: BLE001
                linha_arquivo(linhas, f"  - dataset `{d.dataset_id}`: inacessível ({e})")
                continue
            alvo_tab = [t for t in tabelas if "1980" in t.table_id and "pessoa" in t.table_id.lower()]
            linha_arquivo(linhas, f"  - dataset `{d.dataset_id}`: {len(tabelas)} tabelas; "
                                   f"candidatas 1980/pessoa: {[t.table_id for t in alvo_tab]}")
            for t in alvo_tab:
                candidatos.append((projeto, d.dataset_id, t.table_id))

    # A própria tabela de produção também entra na lista (para comparação de schema lado a lado).
    linha_arquivo(linhas, "")
    linha_arquivo(linhas, "## Schema da tabela de produção (referência)")
    linha_arquivo(linhas, "")
    tabela_prod_ref = client.get_table(TABELA_PROD)
    campos_prod = {f.name for f in tabela_prod_ref.schema}
    for f in tabela_prod_ref.schema:
        linha_arquivo(linhas, f"- `{f.name}` ({f.field_type})")
    if tabela_prod_ref.description:
        linha_arquivo(linhas, "")
        linha_arquivo(linhas, f"Descrição da tabela: {tabela_prod_ref.description}")

    # ---------------- Fase 1b: schema de cada candidata, e diff contra a produção ----------------
    linha_arquivo(linhas, "")
    linha_arquivo(linhas, "## Fase 1b — schema das candidatas e diferenças frente à produção")
    linha_arquivo(linhas, "")

    candidatas_com_coluna_nova: list[tuple[str, str]] = []  # (tabela_completa, coluna)
    if not candidatos:
        linha_arquivo(linhas, "Nenhuma tabela candidata encontrada nos projetos varridos. "
                               "A staging pode estar num projeto não listado em "
                               "PROJETOS_CANDIDATOS, ou não existir mais (pipelines dbt costumam "
                               "descartar a staging após materializar a tabela final). Tentativa "
                               "B (não implementada aqui): perguntar à comunidade Base dos Dados "
                               "(Discord/GitHub) se a staging de microdados_pessoa_1980 está "
                               "acessível publicamente.")
    for projeto, dataset, tabela in candidatos:
        full = f"{projeto}.{dataset}.{tabela}"
        linha_arquivo(linhas, f"### `{full}`")
        try:
            ref = client.get_table(full)
        except Exception as e:  # noqa: BLE001
            linha_arquivo(linhas, f"- inacessível: {e}")
            continue
        campos_cand = {f.name for f in ref.schema}
        novas = campos_cand - campos_prod
        linha_arquivo(linhas, f"- {len(ref.schema)} colunas; {len(novas)} ausentes na produção: "
                               f"{sorted(novas)}")
        suspeitas = [c for c in novas if any(p in c.lower() for p in PALAVRAS_CHAVE_COLUNA)]
        if suspeitas:
            linha_arquivo(linhas, f"- **candidatas a campo geográfico bruto**: {suspeitas}")
            candidatas_com_coluna_nova += [(full, c) for c in suspeitas]
        linha_arquivo(linhas, "")

    # ---------------- Fase 2: contagem agregada nas colunas suspeitas (budget-guarded) ----------------
    linha_arquivo(linhas, "## Fase 2 — taxa de preenchimento das colunas candidatas (sigla_uf='GO')")
    linha_arquivo(linhas, "")
    if not candidatas_com_coluna_nova:
        linha_arquivo(linhas, "Nenhuma coluna candidata encontrada -- Fase 2 não executada. Se "
                               "você souber o nome exato de uma tabela/coluna de staging por "
                               "outro caminho (documentação da Base dos Dados, GitHub do projeto "
                               "querido-diario/basedosdados), rode este script de novo com esse "
                               "nome adicionado a PROJETOS_CANDIDATOS ou consulte manualmente.")
    for tabela_full, coluna in candidatas_com_coluna_nova:
        sql = f"""
            SELECT COUNT(*) AS n_go, COUNT({coluna}) AS n_preenchido
            FROM `{tabela_full}`
            WHERE sigla_uf = 'GO'
        """
        dry_cfg = bigquery.QueryJobConfig(dry_run=True)
        dry = client.query(sql, job_config=dry_cfg)
        estimativa_gib = dry.total_bytes_processed / GIB
        linha_arquivo(linhas, f"- `{tabela_full}`.`{coluna}`: dry run {estimativa_gib:.3f} GiB")
        if estimativa_gib > LIMITE_POR_CONSULTA_GIB:
            linha_arquivo(linhas, f"  - ABORTADO: acima do limite de {LIMITE_POR_CONSULTA_GIB} GiB "
                                   "por consulta.")
            continue
        cfg = bigquery.QueryJobConfig(maximum_bytes_billed=MAXIMUM_BYTES_BILLED)
        row = list(client.query(sql, job_config=cfg).result())[0]
        linha_arquivo(linhas, f"  - sigla_uf='GO': n={row.n_go:,}, preenchido={row.n_preenchido:,} "
                               f"({100 * row.n_preenchido / row.n_go:.1f}%)")
        if row.n_preenchido > 0:
            linha_arquivo(linhas, "  - **PROMISSOR**: esta coluna tem dado onde a produção tem "
                                   "NULL. Próximo passo: comparar com os 171 códigos GO já "
                                   "conhecidos e ver se os valores novos batem com os 52 códigos "
                                   "que faltam (ver pipeline/labels_1980.MUNICIPIOS_1980) -- "
                                   "escrever esse passo específico depois de ver este resultado.")

    dest = pathlib.Path("docs/qa/sonda_1980_staging_bd.md")
    dest.write_text("\n".join(linhas) + "\n", encoding="utf-8")
    print(f"\nRelatório: {dest}")


if __name__ == "__main__":
    main()
