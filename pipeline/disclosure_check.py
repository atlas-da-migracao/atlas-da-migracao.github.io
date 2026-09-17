"""GATE de revelação: verifica, de forma independente, se data/processed cumpre R1-R6.

Não confia em publish.py: recalcula as contagens amostrais de cada célula publicada a
partir de data/interim/pessoas_classificado.parquet e confronta com o que foi publicado.
Falha (exit 1) em qualquer violação. Em caso de sucesso, grava
docs/relatorio_revelacao_<versao>.md e o carimbo data/processed/.gate_ok.

--edicao (default 2022, ver pipeline/edicoes.py) troca INTERIM/PROCESSED pelos paths da
edição; sem --edicao o comportamento -- inclusive nomes de arquivo -- é idêntico ao
anterior. Para outras edições, o relatório ganha o nome do arquivo com o sufixo da edição
(`docs/relatorio_revelacao_<edicao>_<versao>.md`), para não colidir com o de 2022.

Uso: python pipeline/disclosure_check.py [--versao v1] [--edicao 2010]
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import pathlib
import sys

import duckdb

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "pipeline"))
import disclosure_rules as R  # noqa: E402
from edicoes import ACESSO_DESCRICAO, edicao as get_edicao  # noqa: E402
from publish import COL_DIM, FILTRO_DIM, nome_col  # noqa: E402

INTERIM = ROOT / "data/interim"
PROCESSED = ROOT / "data/processed"

GATE_OK = PROCESSED / ".gate_ok"
GATE_VERSAO_FORMATO = 1  # versão do esquema do carimbo .gate_ok, não da versão dos dados

violacoes: list[str] = []
notas: list[str] = []


def sha256_arquivo(caminho: pathlib.Path) -> str:
    h = hashlib.sha256()
    with caminho.open("rb") as fh:
        for bloco in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(bloco)
    return h.hexdigest()



# Lixo de sistema operacional que pode aparecer em data/processed numa máquina local (nunca
# commitado -- .gitignore já os bloqueia) mas nunca deve entrar no carimbo do gate: se entrar,
# `verify_gate.py` reprova em qualquer clone/CI limpo, porque o arquivo listado no carimbo não
# existe lá. Achado em produção (2026-09-17): um `.DS_Store` do Finder contaminou o gate da
# edição 2022 e quebrou o CI.
_LIXO_SO = {".DS_Store", "Thumbs.db", "desktop.ini"}


def hashes_publicaveis() -> dict[str, str]:
    """SHA-256 de todo arquivo publicável em data/processed (recursivo, geo/ incluído).

    Caminhos relativos em POSIX (`/`), ordenados, excluindo o próprio carimbo `.gate_ok` --
    é o que `verify_gate.py` recomputa e confere de forma independente do resto do gate --,
    lixo de sistema operacional (`_LIXO_SO`, nunca publicável) e qualquer subpasta com o
    PRÓPRIO `.gate_ok` (outra edição publicada dentro desta, ex.: `2010/` dentro do
    `data/processed` da edição 2022): tem gate próprio, não é deste.
    """
    subgates = [g.parent for g in PROCESSED.rglob(".gate_ok") if g != GATE_OK]
    hashes = {}
    for f in sorted(PROCESSED.rglob("*")):
        if not f.is_file() or f == GATE_OK or f.name in _LIXO_SO:
            continue
        if any(f == sg or sg in f.parents for sg in subgates):
            continue
        rel = f.relative_to(PROCESSED).as_posix()
        hashes[rel] = sha256_arquivo(f)
    return dict(sorted(hashes.items()))


def falha(regra: str, msg: str) -> None:
    violacoes.append(f"{regra}: {msg}")
    print(f"  [VIOLAÇÃO {regra}] {msg}")


def ok(regra: str, msg: str) -> None:
    notas.append(f"{regra}: {msg}")
    print(f"  [ok {regra}] {msg}")


def main() -> int:
    global INTERIM, PROCESSED, GATE_OK
    ap = argparse.ArgumentParser()
    ap.add_argument("--versao", default=dt.date.today().isoformat())
    ap.add_argument("--edicao", default="2022", help="Edição do censo (ver pipeline/edicoes.py).")
    args = ap.parse_args()
    ed = get_edicao(args.edicao)
    INTERIM = ROOT / ed.interim
    PROCESSED = ROOT / ed.processed
    GATE_OK = PROCESSED / ".gate_ok"
    os.chdir(ROOT)
    # Limiares efetivos de R1/R2 da edição (ver disclosure_rules.limiares): em edição sem chave de
    # domicílio o piso `ndom >= 3` não é computável e cede lugar a pisos de pessoas mais altos.
    L = R.limiares(ed.chave_domicilio)
    # Faixas de R5 inteiramente abaixo do piso de R1 — nenhuma categoria nominal pode cair nelas.
    faixas_proibidas = ", ".join(f"'{x}'" for x in L.faixas_abaixo_r1())

    con = duckdb.connect()
    con.execute("PRAGMA threads=10; PRAGMA memory_limit='16GB';")
    con.execute(f"CREATE OR REPLACE TEMP VIEW mig AS SELECT * FROM read_parquet('{INTERIM}/pessoas_classificado.parquet') WHERE origem_valida")

    print("=== Gate de revelação (R1-R6) ===")

    # ---- R6: nenhuma coluna proibida em nenhum arquivo publicado ----
    arquivos = sorted(PROCESSED.glob("*.parquet"))
    if not arquivos:
        falha("R8", "não há arquivos em data/processed")
        return 1
    for f in arquivos:
        cols = {c.lower() for c in con.execute(f"SELECT * FROM read_parquet('{f}') LIMIT 0").df().columns}
        proibidas = cols & R.COLUNAS_PROIBIDAS
        if proibidas:
            falha("R6", f"{f.name} expõe coluna(s) {sorted(proibidas)}")
    if not violacoes:
        ok("R6", f"{len(arquivos)} arquivos sem colunas de domicílio ou área de ponderação")

    # ---- R1: a declaração de `chave_domicilio` confere com os microdados? ----
    # O gate não confia na flag: `chave_domicilio=False` tira o piso de domicílios do predicado de
    # R1 (em troca de pisos de pessoas mais altos), então declará-la numa edição que TEM domicílio
    # seria um caminho para publicar abaixo do limiar. Confere-se, em agregado, que `controle` é
    # de fato inutilizável — ou de fato utilizável — antes de aceitar a declaração.
    com_controle = con.execute(
        "SELECT COUNT(*) FILTER (WHERE controle IS NOT NULL) FROM mig").fetchone()[0]
    if L.sem_chave_domicilio:
        if com_controle:
            falha("R1", f"edição declara chave_domicilio=False, mas {com_controle:,} registros têm "
                        "`controle` preenchido — R1 tem de usar o piso de domicílios")
        else:
            ok("R1", f"edição sem chave de domicílio confirmada (`controle` nulo em 100% dos "
                     f"registros): R1 = {L.descricao_r1()}; R2 = {L.descricao_r2()}")
    elif not com_controle:
        falha("R1", "edição declara chave_domicilio=True, mas `controle` é nulo em todos os "
                    "registros — o piso de domicílios de R1 seria vacuamente falso")

    # ---- R1: todo par publicado passa no limiar da edição (pessoas e, se houver, domicílios) ----
    con.execute("""
        CREATE OR REPLACE TEMP TABLE cel AS
        SELECT df_mun AS origem, cd_mun AS destino,
               COUNT(*) AS n, COUNT(DISTINCT controle) AS ndom
        FROM mig GROUP BY 1, 2
    """)
    r = con.execute(f"""
        SELECT COUNT(*) FROM read_parquet('{PROCESSED}/fluxos.parquet') p
        LEFT JOIN cel c ON c.origem = p.origem AND c.destino = p.destino
        WHERE {L.sql_viola_r1('c.n', 'c.ndom')}
    """).fetchone()[0]
    if r:
        falha("R1", f"{r} fluxos publicados abaixo do limiar de {L.descricao_r1()}")
    else:
        n_pub = con.execute(f"SELECT COUNT(*) FROM read_parquet('{PROCESSED}/fluxos.parquet')").fetchone()[0]
        ok("R1", f"{n_pub:,} fluxos publicados, todos com {L.descricao_r1()}")

    dims = R.dimensoes(ed.nome)

    # ---- R1 célula a célula: cada categoria publicada dentro de um fluxo ----
    total_cel, cel_violadas = 0, 0
    for dim, cats in dims.items():
        col, extra = COL_DIM[dim], (f" AND {FILTRO_DIM[dim]}" if dim in FILTRO_DIM else "")
        sel = ", ".join(
            f"COUNT(*) FILTER (WHERE {col} = '{cat}'{extra}) AS n_{nome_col(dim, cat)}" for cat in cats)
        con.execute(f"""
            CREATE OR REPLACE TEMP TABLE cel_dim AS
            SELECT df_mun AS origem, cd_mun AS destino, {sel} FROM mig GROUP BY 1, 2
        """)
        for cat in cats:
            c = nome_col(dim, cat)
            v = con.execute(f"""
                SELECT COUNT(*) FROM read_parquet('{PROCESSED}/fluxos.parquet') p
                JOIN cel_dim d ON d.origem = p.origem AND d.destino = p.destino
                WHERE p.{c} IS NOT NULL AND d.n_{c} < {R.MIN_PESSOAS}
            """).fetchone()[0]
            total_cel += 1
            if v:
                cel_violadas += 1
                falha("R1", f"categoria {c}: {v} células publicadas com menos de {R.MIN_PESSOAS} observações")
    if not cel_violadas:
        ok("R1", f"{total_cel} categorias de fluxo verificadas célula a célula, nenhuma abaixo do limiar")

    # ---- R2: detalhe só em fluxos acima do piso de detalhe da edição (20; 50 sem domicílio) ----
    alguma = " OR ".join(f"{nome_col(d, c)} IS NOT NULL" for d, cs in dims.items() for c in cs)
    v = con.execute(f"""
        SELECT COUNT(*) FROM read_parquet('{PROCESSED}/fluxos.parquet') p
        JOIN cel c ON c.origem = p.origem AND c.destino = p.destino
        WHERE c.n < {L.min_pessoas_detalhe} AND ({alguma})
    """).fetchone()[0]
    if v:
        falha("R2", f"{v} fluxos com n<{L.min_pessoas_detalhe} publicam detalhe por características")
    else:
        ok("R2", f"nenhum fluxo com menos de {L.min_pessoas_detalhe} observações publica detalhe")

    # ---- R6: as UNIDADES AGREGADAS declaradas são unidades de verdade (F9.9) ----
    # Uma unidade agregada (hoje só 'NORTEGO', o norte de Goiás em 1980 -- ver
    # pipeline/unidades_agregadas_1980.py) é publicada como qualquer outra unidade, e é
    # justamente por isso que ela precisa de uma verificação própria: o gate confere que ela
    # NÃO é um fantasma (tem linha em municipios_ref e em municipios, com população > 0), que
    # não vira autoloop em nenhum fluxo, e que a composição não vazou -- nenhum dos 52 códigos
    # municipais que ela agrega pode aparecer como unidade publicada, sob pena de publicar um
    # território duas vezes. Os limiares R1/R2 dela são os mesmos de todo mundo e já foram
    # verificados acima, junto com os demais pares de fluxos.parquet.
    if ed.nome == "1980":
        import unidades_agregadas_1980 as UA
        for cod, info in UA.UNIDADES_AGREGADAS_1980.items():
            n_ref, n_mun = con.execute(f"""
                SELECT (SELECT COUNT(*) FROM read_parquet('{PROCESSED}/municipios_ref.parquet')
                        WHERE cd_mun = '{cod}'),
                       (SELECT COUNT(*) FROM read_parquet('{PROCESSED}/municipios.parquet')
                        WHERE cd_mun = '{cod}' AND pop > 0)
            """).fetchone()
            if not (n_ref == 1 and n_mun == 1):
                falha("R6", f"unidade agregada {cod}: {n_ref} linha(s) em municipios_ref e "
                            f"{n_mun} em municipios com população > 0 (esperado 1 e 1)")
            v = con.execute(
                f"SELECT COUNT(*) FROM read_parquet('{PROCESSED}/fluxos.parquet') "
                f"WHERE origem = destino AND origem = '{cod}'").fetchone()[0]
            membros = ", ".join(f"'{m}'" for m in UA.MEMBROS[cod])
            vaz = con.execute(
                f"SELECT COUNT(*) FROM read_parquet('{PROCESSED}/municipios_ref.parquet') "
                f"WHERE cd_mun IN ({membros})").fetchone()[0]
            if v or vaz:
                falha("R6", f"unidade agregada {cod}: {v} autoloop(s) em fluxos.parquet e "
                            f"{vaz} município(s) componente(s) publicado(s) à parte")
            else:
                ok("R6", f"unidade agregada {cod} ({info['n_municipios']} municípios de 1980): "
                         "publicada como uma unidade, sem autoloop e sem componente solto")

    # ---- R1 nos perfis municipais ----
    v = con.execute(f"""
        SELECT COUNT(*) FROM read_parquet('{PROCESSED}/municipios_dim.parquet')
        WHERE categoria <> 'outros' AND n_faixa IN ({faixas_proibidas})
    """).fetchone()[0]
    if v:
        falha("R1", f"{v} células de perfil municipal publicadas com n<{L.min_pessoas} fora da categoria 'outros'")
    else:
        ok("R1", f"perfis municipais: nenhuma categoria nominal publicada com menos de {L.min_pessoas} observações")

    # ---- R1/R2 nos fluxos pendulares (F2b) ----
    for tipo, univ, orig, dest in (("trab", "ocupado AND pendular_trab", "cd_mun", "trab_mun"),
                                   ("estudo", "estudante AND pendular_estudo", "cd_mun", "estudo_mun")):
        arq = PROCESSED / f"pendular_{tipo}.parquet"
        if not arq.exists():
            continue
        con.execute(f"""
            CREATE OR REPLACE TEMP TABLE cel_p AS
            SELECT {orig} AS origem, {dest} AS destino, COUNT(*) n, COUNT(DISTINCT controle) ndom
            FROM read_parquet('{INTERIM}/pessoas_classificado.parquet')
            WHERE {univ} GROUP BY 1, 2
        """)
        v = con.execute(f"""
            SELECT COUNT(*) FROM read_parquet('{arq}') p
            LEFT JOIN cel_p c ON c.origem = p.origem AND c.destino = p.destino
            WHERE {L.sql_viola_r1('c.n', 'c.ndom')}
        """).fetchone()[0]
        if v:
            falha("R1", f"pendular_{tipo}: {v} fluxos abaixo do limiar")
        else:
            n = con.execute(f"SELECT COUNT(*) FROM read_parquet('{arq}')").fetchone()[0]
            ok("R1", f"pendular_{tipo}: {n:,} fluxos publicados, todos acima do limiar")
        dim = PROCESSED / f"pendular_{tipo}_dim.parquet"
        if dim.exists():
            v = con.execute(f"""
                SELECT COUNT(*) FROM read_parquet('{dim}') d
                LEFT JOIN cel_p c ON c.origem = d.origem AND c.destino = d.destino
                WHERE c.n IS NULL OR c.n < {L.min_pessoas_detalhe}
            """).fetchone()[0]
            if v:
                falha("R2", f"pendular_{tipo}_dim: {v} linhas de detalhe em fluxos com n<{L.min_pessoas_detalhe}")
            else:
                ok("R2", f"pendular_{tipo}_dim: detalhe restrito a fluxos com n>={L.min_pessoas_detalhe}")
            v = con.execute(
                f"SELECT COUNT(*) FROM read_parquet('{dim}') WHERE categoria <> 'outros' "
                f"AND n_faixa IN ({faixas_proibidas})"
            ).fetchone()[0]
            if v:
                falha("R1", f"pendular_{tipo}_dim: {v} categorias nominais com n<{L.min_pessoas}")

    # ---- R1 nas tabelas metropolitanas ----
    for arq, univ, o, d in (
        ("rm_fluxos_intra.parquet", "origem_valida", "df_mun", "cd_mun"),
        ("rm_mig_estudo.parquet", "origem_valida AND estudante", "df_mun", "cd_mun"),
    ):
        f = PROCESSED / arq
        if not f.exists():
            continue
        con.execute(f"""
            CREATE OR REPLACE TEMP TABLE cel_rm AS
            SELECT {o} AS origem, {d} AS destino, COUNT(*) n, COUNT(DISTINCT controle) ndom
            FROM read_parquet('{INTERIM}/pessoas_classificado.parquet') WHERE {univ} GROUP BY 1, 2
        """)
        col_o = "origem" if arq == "rm_fluxos_intra.parquet" else "origem_mig"
        col_d = "destino" if arq == "rm_fluxos_intra.parquet" else "destino_mig"
        v = con.execute(f"""
            SELECT COUNT(*) FROM read_parquet('{f}') p
            LEFT JOIN cel_rm c ON c.origem = p.{col_o} AND c.destino = p.{col_d}
            WHERE c.n IS NULL OR c.n < {L.min_pessoas}
        """).fetchone()[0]
        if v:
            falha("R1", f"{arq}: {v} linhas abaixo do limiar")
        else:
            ok("R1", f"{arq}: todas as linhas acima do limiar de {L.min_pessoas} observações")

    # ---- R4: valores ponderados em múltiplos de 5 ----
    checagens = [("fluxos.parquet", "total"), ("municipios.parquet", "imig"),
                 ("municipios.parquet", "emig"), ("municipios.parquet", "pop"),
                 ("municipios_dim.parquet", "valor"), ("fluxos_uf.parquet", "total"),
                 ("fluxos_rgi.parquet", "total"), ("fluxos_rgint.parquet", "total"),
                 ("pendular_trab.parquet", "total"), ("pendular_estudo.parquet", "total"),
                 ("pendular_trab_dim.parquet", "valor"), ("rm_fluxos_intra.parquet", "total"),
                 ("rm_mig_pendular.parquet", "total"), ("rm_resumo.parquet", "mig_intra"),
                 ("municipios_pendular.parquet", "saida_trab")]
    ruins = []
    checadas = 0
    for arq, col in checagens:
        if not (PROCESSED / arq).exists():
            continue  # tabelas do módulo metropolitano: não existem em edições sem 08_metro.sql
        checadas += 1
        v = con.execute(
            f"SELECT COUNT(*) FROM read_parquet('{PROCESSED}/{arq}') "
            f"WHERE {col} IS NOT NULL AND ABS({col} - ROUND({col}/{R.ARREDONDAMENTO}.0)*{R.ARREDONDAMENTO}) > 1e-6"
        ).fetchone()[0]
        if v:
            ruins.append(f"{arq}.{col}={v}")
    if ruins:
        falha("R4", "valores fora de múltiplos de 5: " + ", ".join(ruins))
    else:
        ok("R4", f"{checadas} colunas de estimativa verificadas, todas em múltiplos de {R.ARREDONDAMENTO}")

    # ---- R5: n só em faixas, nunca exato ----
    faixas_validas = {rot for _, _, rot in R.FAIXAS_N} | {"<5"}
    for arq in ("fluxos.parquet", "fluxos_uf.parquet", "municipios_dim.parquet",
                "pendular_trab.parquet", "pendular_trab_dim.parquet", "pendular_estudo.parquet",
                "rm_fluxos_intra.parquet", "rm_mig_pendular.parquet"):
        if not (PROCESSED / arq).exists():
            continue  # módulo metropolitano (ou origem agregada): não existe em toda edição
        cols = {c.lower() for c in con.execute(f"SELECT * FROM read_parquet('{PROCESSED}/{arq}') LIMIT 0").df().columns}
        numericas = [c for c in cols if c == "n" or c.startswith("n_") and not c.endswith("_faixa")]
        if numericas:
            falha("R5", f"{arq} publica contagem exata em {numericas}")
        col_faixa = [c for c in cols if c.endswith("_faixa")]
        for c in col_faixa:
            fora = con.execute(
                f"SELECT COUNT(*) FROM read_parquet('{PROCESSED}/{arq}') WHERE {c} NOT IN "
                + "(" + ",".join(f"'{x}'" for x in faixas_validas) + ")").fetchone()[0]
            if fora:
                falha("R5", f"{arq}.{c} tem {fora} valores fora das faixas previstas")
    if not any(x.startswith("R5") for x in violacoes):
        ok("R5", "nenhuma contagem amostral exata publicada; apenas faixas")

    # ---- relatório ----
    if violacoes:
        print(f"\nGATE REPROVADO: {len(violacoes)} violação(ões).")
        GATE_OK.unlink(missing_ok=True)
        return 1

    linhas = ["# Relatório de controle de revelação",
              "",
              f"- Versão dos dados: **{args.versao}**",
              f"- Gerado em: {dt.datetime.now():%Y-%m-%d %H:%M} (fuso local)",
              f"- Fonte: IBGE, Censo Demográfico {ed.nome}, microdados da amostra ({ACESSO_DESCRICAO[ed.acesso]}).",
              "",
              "## Regras aplicadas",
              "",
              f"| Regra | Parâmetro |", "|---|---|",
              f"| R1 limiar por célula | {L.descricao_r1()} |",
              f"| R2 detalhe por características | {L.descricao_r2()} |",
              "| R3 supressão complementar | categorias suprimidas somadas em `outros` da mesma dimensão |",
              f"| R4 arredondamento | múltiplos de {R.ARREDONDAMENTO} |",
              "| R5 contagem amostral | publicada apenas em faixas |",
              "| R6 geografia e cruzamentos | município é a menor unidade; sem área de ponderação nem identificador de domicílio |",
              "",
              "## Verificações independentes", ""]
    linhas += [f"- {n}" for n in notas]
    linhas += ["", "## Arquivos publicados", "", "| Arquivo | Linhas | Tamanho | SHA-256 (12) |", "|---|---:|---:|---|"]
    for f in arquivos:
        n = con.execute(f"SELECT COUNT(*) FROM read_parquet('{f}')").fetchone()[0]
        h = hashlib.sha256(f.read_bytes()).hexdigest()[:12]
        linhas.append(f"| `{f.name}` | {n:,} | {f.stat().st_size/1e6:.1f} MB | `{h}` |")
    linhas += ["", "## Supressão aplicada", ""]
    tot_pares = con.execute("SELECT COUNT(*) FROM cel").fetchone()[0]
    pub = con.execute(f"SELECT COUNT(*) FROM read_parquet('{PROCESSED}/fluxos.parquet')").fetchone()[0]
    vol_pub = con.execute(f"SELECT SUM(total) FROM read_parquet('{PROCESSED}/fluxos.parquet')").fetchone()[0]
    vol_tot = con.execute("SELECT SUM(peso) FROM mig").fetchone()[0]
    linhas += [
        f"- Pares origem→destino existentes na amostra: {tot_pares:,}",
        f"- Pares publicados (após R1): {pub:,} ({100*pub/tot_pares:.1f}%), cobrindo "
        f"{100*vol_pub/vol_tot:.1f}% do volume migratório estimado",
        f"- Os {tot_pares-pub:,} pares suprimidos permanecem contabilizados nos totais municipais "
        "de `municipios.parquet`, de modo que nenhum volume é perdido — apenas a identificação do par.",
    ]
    sufixo_edicao = "" if ed.nome == "2022" else f"_{ed.nome}"
    dest = ROOT / f"docs/relatorio_revelacao{sufixo_edicao}_{args.versao}.md"
    dest.write_text("\n".join(linhas) + "\n", encoding="utf-8")

    carimbo = {
        "formato_versao": GATE_VERSAO_FORMATO,
        "versao_dados": args.versao,
        "timestamp": dt.datetime.now().isoformat(),
        "arquivos": hashes_publicaveis(),
    }
    GATE_OK.write_text(json.dumps(carimbo, indent=2, sort_keys=True, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"\nGATE APROVADO. Relatório: {dest.relative_to(ROOT)}")
    print(f"Carimbo: {GATE_OK.relative_to(ROOT)} ({len(carimbo['arquivos'])} arquivos)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
