"""Gera pipeline/rm_nucleo.csv: define o núcleo de cada região metropolitana/RIDE.

Regra (decisão do usuário, ver plano): núcleo = município MEMBRO da RM cujo nome aparece
como subsequência contígua de tokens no nome da RM (ex.: "Vale do Rio Cuiabá" contém
"Cuiabá"); se nenhum membro for homônimo, núcleo = município mais populoso da RM. Um único
CSV compartilhado pelas edições 2022 e 2010 (ver `pipeline/edicoes.py` e
`pipeline/build_ref.py::_build_outra_edicao`).

Fonte: data/interim/municipios_ref.parquet (cd_rm, nm_rm, cd_mun, nm_mun, uf_sigla) e
data/interim/municipios_bruto.parquet (cd_mun, pop) -- só agregados (contagens, somas de
peso), nunca registro individual.

Uso:
    python pipeline/build_rm_nucleo.py            # regenera pipeline/rm_nucleo.csv
    python pipeline/build_rm_nucleo.py --check     # não escreve; sai 1 se o conteúdo mudaria
"""
from __future__ import annotations

import argparse
import csv
import io
import pathlib
import re
import sys
import unicodedata

import duckdb

ROOT = pathlib.Path(__file__).resolve().parent.parent
DEST = ROOT / "pipeline" / "rm_nucleo.csv"
COLUNAS = ["cd_rm", "nm_rm", "cd_nucleo", "nm_nucleo", "uf_nucleo", "n_municipios", "pop_rm"]

_TOKEN_RE = re.compile(r"[a-z0-9]+")


def tokenizar(texto: str) -> list[str]:
    """NFKD sem acentos, casefold, tokens = sequências alfanuméricas."""
    if not texto:
        return []
    sem_acento = "".join(c for c in unicodedata.normalize("NFKD", texto) if not unicodedata.combining(c))
    return _TOKEN_RE.findall(sem_acento.casefold())


def eh_subsequencia_contigua(sub: list[str], todo: list[str]) -> bool:
    if not sub:
        return False
    n = len(sub)
    return any(todo[i:i + n] == sub for i in range(len(todo) - n + 1))


def carregar_membros():
    con = duckdb.connect()
    return con.execute("""
        SELECT r.cd_rm, r.nm_rm, r.cd_mun, r.nm_mun, r.uf_sigla, m.pop
        FROM read_parquet(?) r
        JOIN read_parquet(?) m USING (cd_mun)
        WHERE r.cd_rm IS NOT NULL
    """, [str(ROOT / "data/interim/municipios_ref.parquet"), str(ROOT / "data/interim/municipios_bruto.parquet")]).fetchdf()


def calcular_nucleos() -> list[dict]:
    df = carregar_membros()

    linhas = []
    n_homonimo = n_fallback = 0
    for cd_rm, grupo in df.groupby("cd_rm", sort=False):
        nm_rm = grupo["nm_rm"].iloc[0]
        tokens_rm = tokenizar(nm_rm)
        membros = list(grupo.itertuples(index=False))

        homonimos = [m for m in membros if eh_subsequencia_contigua(tokenizar(m.nm_mun), tokens_rm)]
        candidatos = homonimos if homonimos else membros
        if homonimos:
            n_homonimo += 1
        else:
            n_fallback += 1

        nucleo = max(candidatos, key=lambda m: (m.pop, m.cd_mun))
        pop_rm_raw = float(grupo["pop"].sum())

        linhas.append({
            "cd_rm": cd_rm,
            "nm_rm": nm_rm,
            "cd_nucleo": nucleo.cd_mun,
            "nm_nucleo": nucleo.nm_mun,
            "uf_nucleo": nucleo.uf_sigla,
            "n_municipios": len(membros),
            "pop_rm": int(pop_rm_raw),  # truncado, não arredondado (mesma convenção do CSV atual)
            "_pop_rm_raw": pop_rm_raw,
        })

    linhas.sort(key=lambda l: l["_pop_rm_raw"], reverse=True)
    for l in linhas:
        del l["_pop_rm_raw"]
    print(f"Núcleo por homônimo: {n_homonimo} RMs. Núcleo por fallback (mais populoso): {n_fallback} RMs.")
    return linhas


def gerar_csv(linhas: list[dict]) -> bytes:
    buf = io.StringIO(newline="")
    w = csv.writer(buf)
    w.writerow(COLUNAS)
    for l in linhas:
        w.writerow([l[c] for c in COLUNAS])
    return buf.getvalue().encode("utf-8")


def ler_csv_antigo(caminho: pathlib.Path) -> dict[str, dict]:
    if not caminho.exists():
        return {}
    antigo = {}
    with caminho.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            antigo[row["cd_rm"]] = row
    return antigo


def imprimir_diff(linhas_novas: list[dict], antigo: dict[str, dict]) -> None:
    mudou = 0
    for l in linhas_novas:
        velho = antigo.get(str(l["cd_rm"]))
        if velho is None:
            continue
        if velho["cd_nucleo"] != str(l["cd_nucleo"]):
            mudou += 1
            print(f"  {l['cd_rm']} {l['nm_rm']}: {velho['nm_nucleo']} -> {l['nm_nucleo']}")
        # sanidade: n_municipios e pop_rm não deveriam mudar (só a escolha do núcleo)
        if int(velho["n_municipios"]) != l["n_municipios"] or int(velho["pop_rm"]) != l["pop_rm"]:
            print(f"  AVISO: {l['cd_rm']} {l['nm_rm']} -- n_municipios/pop_rm mudou "
                  f"(antigo n={velho['n_municipios']} pop={velho['pop_rm']}; "
                  f"novo n={l['n_municipios']} pop={l['pop_rm']}) -- investigar antes de seguir")
    if mudou == 0:
        print("  (nenhuma mudança de núcleo)")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true",
                     help="Não escreve; sai com código 1 se o conteúdo regenerado for diferente do arquivo.")
    args = ap.parse_args()

    linhas = calcular_nucleos()
    conteudo_novo = gerar_csv(linhas)

    antigo = ler_csv_antigo(DEST)
    print("Diff de núcleo (cd_rm, nome, núcleo antigo -> novo):")
    imprimir_diff(linhas, antigo)

    if args.check:
        conteudo_atual = DEST.read_bytes() if DEST.exists() else b""
        if conteudo_novo == conteudo_atual:
            print(f"\n--check: {DEST.relative_to(ROOT)} já está atualizado.")
            return
        print(f"\n--check: {DEST.relative_to(ROOT)} DIFERE do conteúdo regenerado.")
        raise SystemExit(1)

    DEST.write_bytes(conteudo_novo)
    print(f"\n{DEST.relative_to(ROOT)}: {len(linhas)} regiões metropolitanas/RIDEs gravadas.")


if __name__ == "__main__":
    main()
