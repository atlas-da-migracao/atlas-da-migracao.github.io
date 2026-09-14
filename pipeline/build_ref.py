"""Gera <interim>/municipios_ref.parquet a partir de pipeline/labels.py (2022) ou, para
outras edições, do módulo de rótulos correspondente (ver pipeline/edicoes.py).

Tabela de referência pública (código -> nome, UF, recortes territoriais). Sem microdados.
"""
import argparse
import importlib
import pathlib
import sys

import duckdb

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "pipeline"))
import labels  # noqa: E402
from edicoes import Edicao, edicao as get_edicao  # noqa: E402

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


def _build_2022(dest: pathlib.Path) -> None:
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
    import pandas as pd
    df = pd.DataFrame(rows)  # noqa: F841
    con.execute("CREATE TABLE ref AS SELECT * FROM df")
    con.execute(f"COPY ref TO '{dest}' (FORMAT PARQUET)")
    n, n_rm, n_rgi = con.execute(
        "SELECT COUNT(*), COUNT(DISTINCT cd_rm), COUNT(DISTINCT cd_rgi) FROM ref"
    ).fetchone()
    print(f"municipios_ref.parquet: {n} municípios, {n_rm} RMs/RIDEs, {n_rgi} RGIs")


def _build_outra_edicao(ed: Edicao, dest: pathlib.Path) -> None:
    """municipios_ref para edições != 2022 (ver plano, decisão arquitetural 4).

    Para 2010: municipios_ref = pipeline/labels_2010.py (MUNICIPIOS_2010: nome, UF, meso,
    micro -- 5.565 municípios) cruzado por cd_mun com labels.RECORTES (2022 -- RGI/RGInt são
    a divisão de 2017, aplicada retroativamente: todo município de 2010 já existe em 2022, só
    os 5 criados em 2013 não têm municípios de 2010 correspondentes) para preencher
    cd_rgi/nm_rgi/cd_rgint/nm_rgint. cd_rm/nm_rm vêm do MESMO `rec` (COD_CATMETROPOL/
    NOME_CATMETROPOL): o recorte metropolitano de 2022 aplicado retroativamente por código de
    município (decisão do usuário -- ver plano). Os municípios de 2013 sem `rec` (e portanto
    sem RM) fazem a RM correspondente de 2010 ficar com um município a menos.

    O import do módulo de rótulos da edição é condicional/tardio (só acontece se alguém
    chamar `--edicao 2010`) para que a ausência ou falha desse módulo nunca afete o caso
    2022 (default).
    """
    nome_modulo = f"labels_{ed.nome}"
    try:
        labels_mod = importlib.import_module(nome_modulo)
    except Exception as e:  # noqa: BLE001 -- qualquer falha do módulo de rótulos, não só ImportError
        raise SystemExit(
            f"build_ref.py --edicao {ed.nome}: não foi possível importar pipeline/{nome_modulo}.py "
            f"({type(e).__name__}: {e}). Gere/corrija esse módulo antes de rodar build_ref.py "
            f"para a edição {ed.nome}."
        ) from e
    municipios_ed = getattr(labels_mod, f"MUNICIPIOS_{ed.nome}")

    rows = []
    sem_recorte = []
    for cd, info in municipios_ed.items():
        rec = labels.RECORTES.get(cd)
        if rec is None:
            sem_recorte.append(cd)
            rec = {}
        uf = info["uf"]
        rows.append({
            "cd_mun": cd,
            "nm_mun": info["nome"],
            "uf": uf,
            "uf_sigla": UF_SIGLA.get(uf),
            "uf_nome": labels.UF.get(uf),
            # meso/micro: preferimos os da própria edição (info) -- existem tanto em
            # labels.RECORTES (2022) quanto em labels_2010, mas a divisão de meso/micro de um
            # município pode não ter mudado entre censos; usar a da própria edição evita
            # depender de um município 2010 existir idêntico em RECORTES para esse campo.
            "cd_meso": s(info.get("cod_meso")), "nm_meso": info.get("nome_meso"),
            "cd_micro": s(info.get("cod_micro")), "nm_micro": info.get("nome_micro"),
            "cd_rgi": s(rec.get("cod_RGI")), "nm_rgi": rec.get("nome_rgi"),
            "cd_rgint": s(rec.get("cod_RGInt")), "nm_rgint": rec.get("nome_rgint"),
            "cd_concurb": s(rec.get("CodConcUrbana")), "nm_concurb": rec.get("NomeConcUrbana"),
            "cd_rm": s(rec.get("COD_CATMETROPOL")), "nm_rm": rec.get("NOME_CATMETROPOL"),
            "cd_au": s(rec.get("COD_RECAU")), "nm_au": rec.get("NOME_RECAU"),
        })
    if sem_recorte:
        print(f"AVISO: {len(sem_recorte)} município(s) de {ed.nome} sem recorte 2022 "
              f"correspondente (RGI/RGInt ficam NULL): {sorted(sem_recorte)[:10]}"
              f"{'...' if len(sem_recorte) > 10 else ''}")

    con = duckdb.connect()
    import pandas as pd
    df = pd.DataFrame(rows)  # noqa: F841
    con.execute("CREATE TABLE ref AS SELECT * FROM df")
    con.execute(f"COPY ref TO '{dest}' (FORMAT PARQUET)")
    n, n_rgi, n_rgint, n_sem_rgi, n_com_rm = con.execute(
        "SELECT COUNT(*), COUNT(DISTINCT cd_rgi), COUNT(DISTINCT cd_rgint), "
        "SUM(CASE WHEN cd_rgi IS NULL THEN 1 ELSE 0 END), "
        "SUM(CASE WHEN cd_rm IS NOT NULL THEN 1 ELSE 0 END) FROM ref"
    ).fetchone()
    print(f"municipios_ref.parquet ({ed.nome}): {n} municípios, {n_rgi} RGIs, {n_rgint} RGInts, "
          f"{n_sem_rgi} sem RGI, {n_com_rm} com RM")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--edicao", default="2022", help="Edição do censo (ver pipeline/edicoes.py).")
    args = ap.parse_args()
    ed = get_edicao(args.edicao)

    dest = ROOT / ed.interim / "municipios_ref.parquet"
    dest.parent.mkdir(parents=True, exist_ok=True)

    if ed.nome == "2022":
        _build_2022(dest)
    else:
        _build_outra_edicao(ed, dest)


if __name__ == "__main__":
    main()
