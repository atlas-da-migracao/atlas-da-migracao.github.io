"""Validações de consistência do pipeline (F1 em diante).

Só executa agregações (COUNT/SUM/GROUP BY) sobre data/interim -- nunca imprime
registros individuais, em conformidade com a regra de sigilo do CLAUDE.md.
"""
from __future__ import annotations

import sys
import pathlib
import duckdb

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "pipeline"))
import labels  # noqa: E402

PESSOAS = str(ROOT / "data/interim/pessoas.parquet")
DOMICILIOS = str(ROOT / "data/interim/domicilios.parquet")

POP_2022_UF_APROX = {  # estimativas IBGE Censo 2022 por UF, em milhões (checagem de ordem de grandeza)
    "35": 44.4, "31": 20.5, "33": 16.1, "29": 14.1, "41": 11.4, "43": 10.9,
    "26": 9.1, "23": 8.8, "15": 8.1, "42": 7.6, "52": 7.1, "21": 6.8,
    "13": 3.9, "32": 3.8, "25": 3.9, "24": 3.3, "51": 3.5, "27": 3.1,
    "22": 3.3, "53": 2.8, "50": 2.8, "28": 2.1, "11": 1.6, "17": 1.5,
    "12": 0.83, "16": 0.73, "14": 0.64,
}

failures: list[str] = []


def check(name: str, cond: bool, detail: str = "") -> None:
    status = "OK " if cond else "FALHA"
    print(f"[{status}] {name}" + (f" — {detail}" if detail else ""))
    if not cond:
        failures.append(name)


def main() -> None:
    con = duckdb.connect()
    con.execute("PRAGMA threads=10;")

    print("=== F1: extração ===")

    n, peso = con.execute(
        f"SELECT COUNT(*), SUM(peso) FROM read_parquet('{PESSOAS}')"
    ).fetchone()
    check(
        "Total de registros de pessoas > 20 milhões",
        n > 20_000_000,
        f"n={n:,}",
    )
    check(
        "Soma nacional de pesos ≈ 203.080.756 (Notas 04/2026, Tabela 3)",
        abs(peso - 203_080_756) < 100,
        f"soma={peso:,.0f}",
    )

    # soma de pesos por UF, checagem de ordem de grandeza (não é fonte oficial por UF)
    rows = con.execute(
        f"SELECT uf, SUM(peso) FROM read_parquet('{PESSOAS}') GROUP BY uf"
    ).fetchall()
    por_uf = {uf: s for uf, s in rows}
    check("27 UFs presentes no arquivo extraído", len(por_uf) == 27, f"n_uf={len(por_uf)}")
    bad_uf = []
    for uf, aprox_milhoes in POP_2022_UF_APROX.items():
        obs = por_uf.get(uf, 0) / 1e6
        if not (0.7 * aprox_milhoes <= obs <= 1.3 * aprox_milhoes):
            bad_uf.append(f"{uf}={obs:.2f}M (esperado ~{aprox_milhoes}M)")
    check(
        "Soma de pesos por UF em ordem de grandeza plausível (±30% do valor aproximado)",
        not bad_uf,
        "; ".join(bad_uf) if bad_uf else "todas as 27 UFs dentro da faixa",
    )

    # distribuição de P0600 (data fixa) plausível
    dist = dict(
        con.execute(
            f"SELECT COALESCE(df_local,'branco'), COUNT(*) FROM read_parquet('{PESSOAS}') "
            f"GROUP BY 1"
        ).fetchall()
    )
    total = sum(dist.values())
    pct_migrante = (dist.get("2", 0) + dist.get("3", 0)) / total * 100
    check(
        "Percentual de migrantes de data fixa (P0600 in {2,3}) entre 2% e 12%",
        2 <= pct_migrante <= 12,
        f"{pct_migrante:.2f}% do total de registros (não só 5+)",
    )

    # 100% dos códigos de df_mun conhecidos pertencem à lista de municípios de 2022
    codigos = con.execute(
        f"SELECT DISTINCT df_mun FROM read_parquet('{PESSOAS}') "
        f"WHERE df_local='2' AND df_mun NOT IN ('8888888','9999999')"
    ).fetchall()
    municipios_validos = set(labels.MUNICIPIOS.keys())
    fora = [c[0] for c in codigos if c[0] not in municipios_validos]
    check(
        "100% dos códigos de município (data fixa) pertencem à lista de 2022",
        not fora,
        f"{len(fora)} código(s) fora da lista" if fora else f"{len(codigos)} códigos distintos, todos válidos",
    )

    # nenhum município de residência atual fora da lista
    codigos_atuais = con.execute(
        f"SELECT DISTINCT cd_mun FROM read_parquet('{PESSOAS}')"
    ).fetchall()
    fora2 = [c[0] for c in codigos_atuais if c[0] not in municipios_validos]
    check(
        "100% dos municípios de residência atual pertencem à lista de 2022",
        not fora2,
        f"{len(fora2)} fora" if fora2 else f"{len(codigos_atuais)} municípios distintos observados",
    )

    print("\n=== Domicílios / join ===")
    nd, = con.execute(f"SELECT COUNT(*) FROM read_parquet('{DOMICILIOS}')").fetchone()
    check("Arquivo de domicílios extraído tem registros", nd > 1_000_000, f"n={nd:,}")

    matched, = con.execute(
        f"""
        SELECT COUNT(*) FROM read_parquet('{PESSOAS}') p
        WHERE EXISTS (SELECT 1 FROM read_parquet('{DOMICILIOS}') d WHERE d.controle = p.controle)
        """
    ).fetchone()
    check(
        "100% das pessoas casam com um domicílio (join controle=controle)",
        matched == n,
        f"{matched:,} / {n:,}",
    )

    print("\n=== Resumo ===")
    if failures:
        print(f"{len(failures)} checagem(ns) falharam: {failures}")
        raise SystemExit(1)
    print("Todas as checagens da F1 passaram.")


if __name__ == "__main__":
    main()
