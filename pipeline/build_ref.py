"""Gera data/interim/municipios_ref.parquet a partir de pipeline/labels.py.

Tabela de referência pública (código -> nome, UF, recortes territoriais). Sem microdados.
"""
import pathlib
import sys

import duckdb

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "pipeline"))
import labels  # noqa: E402

UF_SIGLA = {
    "11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA", "16": "AP", "17": "TO",
    "21": "MA", "22": "PI", "23": "CE", "24": "RN", "25": "PB", "26": "PE", "27": "AL",
    "28": "SE", "29": "BA", "31": "MG", "32": "ES", "33": "RJ", "35": "SP", "41": "PR",
    "42": "SC", "43": "RS", "50": "MS", "51": "MT", "52": "GO", "53": "DF",
}


def s(v):
    if v is None:
        return None
    if isinstance(v, float):
        return str(int(v))
    return str(v)


def main() -> None:
    rows = []
    for cd, info in labels.MUNICIPIOS.items():
        rec = labels.RECORTES.get(cd, {})
        uf = info["uf"]
        rows.append({
            "cd_mun": cd,
            "nm_mun": info["nome"],
            "uf": uf,
            "uf_sigla": UF_SIGLA.get(uf),
            "uf_nome": labels.UF.get(uf),
            "cd_meso": s(rec.get("cod_meso")), "nm_meso": rec.get("nome_meso"),
            "cd_micro": s(rec.get("cod_micro")), "nm_micro": rec.get("nome_micro"),
            "cd_rgi": s(rec.get("cod_RGI")), "nm_rgi": rec.get("nome_rgi"),
            "cd_rgint": s(rec.get("cod_RGInt")), "nm_rgint": rec.get("nome_rgint"),
            "cd_concurb": s(rec.get("CodConcUrbana")), "nm_concurb": rec.get("NomeConcUrbana"),
            "cd_rm": s(rec.get("COD_CATMETROPOL")), "nm_rm": rec.get("NOME_CATMETROPOL"),
            "cd_au": s(rec.get("COD_RECAU")), "nm_au": rec.get("NOME_RECAU"),
        })
    con = duckdb.connect()
    con.execute("CREATE TABLE ref AS SELECT * FROM rows_df", {"rows_df": None}) if False else None
    import pandas as pd
    df = pd.DataFrame(rows)  # noqa: F841
    con.execute("CREATE TABLE ref AS SELECT * FROM df")
    dest = ROOT / "data/interim/municipios_ref.parquet"
    con.execute(f"COPY ref TO '{dest}' (FORMAT PARQUET)")
    n, n_rm, n_rgi = con.execute(
        "SELECT COUNT(*), COUNT(DISTINCT cd_rm), COUNT(DISTINCT cd_rgi) FROM ref"
    ).fetchone()
    print(f"municipios_ref.parquet: {n} municípios, {n_rm} RMs/RIDEs, {n_rgi} RGIs")


if __name__ == "__main__":
    main()
