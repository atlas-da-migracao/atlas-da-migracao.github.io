#!/usr/bin/env python3
"""Verifica o carimbo do gate de revelação (.gate_ok) SEM acesso aos microdados.

Complementa `disclosure_check.py` (que recalcula contagens amostrais a partir de
`data/interim/pessoas_classificado.parquet` e só roda na máquina com acesso ao IBGE): este
script roda em qualquer clone do repositório -- inclusive no CI -- porque só lê os arquivos
já publicados em `data/processed` e o carimbo `.gate_ok`. Não depende de `data/raw` nem de
`data/interim`.

Checagens:
    (a) `data/processed/.gate_ok` existe e tem o formato esperado.
    (b) o SHA-256 de cada arquivo publicável em `data/processed` (recursivo, `geo/` incluído)
        bate exatamente com o que está gravado no carimbo -- nada mudou, nada sumiu, nada foi
        adicionado depois do gate ter rodado.
    (c) checagens estruturais que não dependem de microdado:
        - nenhum `*.csv` em `data/processed`;
        - nenhuma coluna que identifique domicílio ou área de ponderação em nenhum parquet
          (mesma lista de `disclosure_rules.COLUNAS_PROIBIDAS`);
        - nenhuma coluna de contagem amostral exata: só `n_faixa`/`*_faixa` são permitidas, e
          os valores dessas colunas devem pertencer ao conjunto de faixas de
          `disclosure_rules.FAIXAS_N` (descoberto a partir dos próprios dados, não hardcoded
          aqui além da lista de faixas válidas já pública em `disclosure_rules.py`);
        - toda coluna de contagem ponderada (`total`, `valor`, `imig`, `emig`, `pop` e afins --
          a lista fechada abaixo é levantada diretamente de onde `publish.py` chama
          `R.sql_arredonda()`) é múltiplo de `disclosure_rules.ARREDONDAMENTO`.

Uso: python pipeline/verify_gate.py [--dir data/processed]
Saída: mensagens claras por checagem; código de saída 0 = aprovado, != 0 = pelo menos uma
checagem falhou.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import pathlib
import sys

import duckdb

ROOT = pathlib.Path(__file__).resolve().parent.parent

sys.path.insert(0, str(ROOT / "pipeline"))
import disclosure_rules as R  # noqa: E402

# R6 -- colunas proibidas (identificam domicílio ou área de ponderação)
COLUNAS_PROIBIDAS = {c.lower() for c in R.COLUNAS_PROIBIDAS}

# R5 -- faixas de n válidas (lidas de disclosure_rules.py, fonte única de verdade)
FAIXAS_VALIDAS = {rot for _, _, rot in R.FAIXAS_N} | {"<5"}

# Colunas "n_*" que NÃO são contagem amostral de pessoas (por isso ficam de fora do R5):
# n_municipios (rm_resumo.parquet) é a contagem de municípios de uma região metropolitana --
# informação geográfica pública do recorte do IBGE, não uma contagem amostral de pessoas.
COLUNAS_N_ESTRUTURAIS = {"n_municipios"}

# R4 -- colunas de contagem ponderada que `publish.py` arredonda com R.sql_arredonda(),
# levantadas diretamente do código-fonte (grep por "sql_arredonda(" em pipeline/publish.py).
# Lista fechada de propósito: evita falso positivo em colunas de razão/percentual/CV/se, que
# não são arredondadas a múltiplos de 5.
COLUNAS_ARREDONDADAS_EXATAS = {
    "total", "valor", "pop", "pop5", "imig", "imig_ni", "imig_int", "emig", "saldo",
    "ocupados", "estudantes", "saida_trab", "entrada_trab", "saldo_pendular",
    "saida_estudo", "entrada_estudo", "varios_municipios", "trabalha_exterior",
    "mig_intra", "nucleo_periferia", "periferia_nucleo", "periferia_periferia",
    "entradas_externas", "saidas_externas", "saldo_externo", "pendulares",
    "migrantes_intra", "mig_ocupados", "mig_pendulares", "pendular_para_origem",
    "pendular_para_nucleo", "pendular_para_outro", "trabalha_onde_mora",
    "mig_estudantes", "mig_estud_pendulares",
}
# Colunas de detalhe por categoria (fluxos.parquet): "<dimensao>__<categoria>" e
# "<dimensao>__outros", também arredondadas (ver publish.py::expr_categorias).
PREFIXOS_DIM = tuple(f"{dim}__" for dim in R.DIMENSOES)


def sha256_arquivo(caminho: pathlib.Path) -> str:
    h = hashlib.sha256()
    with caminho.open("rb") as fh:
        for bloco in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(bloco)
    return h.hexdigest()


def eh_coluna_arredondada(nome: str) -> bool:
    n = nome.lower()
    return n in COLUNAS_ARREDONDADAS_EXATAS or n.startswith(PREFIXOS_DIM)


def eh_coluna_n_exata(nome: str) -> bool:
    """R5: qualquer coluna chamada `n` ou `n_algo` sem terminar em `_faixa` é contagem exata,

    exceto as poucas colunas `n_*` estruturais/geográficas (não são contagem amostral de
    pessoas) listadas em COLUNAS_N_ESTRUTURAIS.
    """
    n = nome.lower()
    if n.endswith("_faixa") or n in COLUNAS_N_ESTRUTURAIS:
        return False
    return n == "n" or n.startswith("n_")


class Verificador:
    """Roda as checagens (a)-(c) contra um diretório `data/processed`.

    Estado (lista de erros) é por instância, não global -- permite rodar o verificador
    várias vezes no mesmo processo (ex.: em testes) sem vazar erros entre chamadas.
    """

    def __init__(self, processed: pathlib.Path):
        self.processed = processed
        self.gate_ok = processed / ".gate_ok"
        self.erros: list[str] = []
        # Subpastas com o PRÓPRIO .gate_ok (outra edição publicada dentro desta, ex.:
        # data/processed/2010/.gate_ok dentro de data/processed/.gate_ok da edição 2022):
        # excluídas de todas as varreduras -- não são deste gate, têm o seu próprio.
        self.subgates = [g.parent for g in processed.rglob(".gate_ok") if g != self.gate_ok]

    def _pertence_a_subgate(self, f: pathlib.Path) -> bool:
        return any(f == sg or sg in f.parents for sg in self.subgates)

    def falha(self, msg: str) -> None:
        self.erros.append(msg)
        print(f"  [FALHA] {msg}")

    def ok(self, msg: str) -> None:
        print(f"  [ok] {msg}")

    def arquivos_atuais(self) -> dict[str, pathlib.Path]:
        atuais = {}
        for f in sorted(self.processed.rglob("*")):
            if f.is_file() and f != self.gate_ok and not self._pertence_a_subgate(f):
                atuais[f.relative_to(self.processed).as_posix()] = f
        return atuais

    def verificar_carimbo(self) -> dict | None:
        print("=== (a) Carimbo do gate ===")
        if not self.gate_ok.exists():
            self.falha(f"{self.gate_ok} não existe -- rode pipeline/disclosure_check.py")
            return None
        try:
            carimbo = json.loads(self.gate_ok.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            self.falha(f"{self.gate_ok} não é um JSON válido: {e}")
            return None
        campos_obrigatorios = {"formato_versao", "versao_dados", "timestamp", "arquivos"}
        faltando = campos_obrigatorios - carimbo.keys()
        if faltando:
            self.falha(f"carimbo sem os campos obrigatórios: {sorted(faltando)}")
            return None
        if not isinstance(carimbo["arquivos"], dict) or not carimbo["arquivos"]:
            self.falha("carimbo não lista nenhum arquivo em 'arquivos'")
            return None
        self.ok(f"carimbo válido -- versão dos dados {carimbo['versao_dados']!r}, "
                f"gerado em {carimbo['timestamp']}, {len(carimbo['arquivos'])} arquivos registrados")
        return carimbo

    def verificar_hashes(self, carimbo: dict) -> None:
        print("=== (b) Integridade dos arquivos publicados (SHA-256) ===")
        registrados: dict[str, str] = carimbo["arquivos"]
        atuais = self.arquivos_atuais()

        faltando = sorted(set(registrados) - set(atuais))
        extras = sorted(set(atuais) - set(registrados))
        diferentes = []
        for rel in sorted(set(registrados) & set(atuais)):
            h = sha256_arquivo(atuais[rel])
            if h != registrados[rel]:
                diferentes.append(rel)

        if faltando:
            self.falha(f"{len(faltando)} arquivo(s) do carimbo não existem mais em data/processed: {faltando}")
        if extras:
            self.falha(f"{len(extras)} arquivo(s) em data/processed não estão no carimbo (adicionados "
                       f"depois do gate, ou o gate não foi rerodado): {extras}")
        if diferentes:
            self.falha(f"{len(diferentes)} arquivo(s) com conteúdo diferente do carimbado (SHA-256 não bate): {diferentes}")
        if not (faltando or extras or diferentes):
            self.ok(f"{len(registrados)} arquivos conferem exatamente com o carimbo")

    def verificar_sem_csv(self) -> None:
        print("=== (c1) Nenhum CSV em data/processed ===")
        csvs = sorted(p.relative_to(self.processed).as_posix() for p in self.processed.rglob("*.csv")
                      if not self._pertence_a_subgate(p))
        csvs += sorted(p.relative_to(self.processed).as_posix() for p in self.processed.rglob("*.CSV")
                       if not self._pertence_a_subgate(p))
        if csvs:
            self.falha(f"{len(csvs)} arquivo(s) CSV encontrados em data/processed: {csvs}")
        else:
            self.ok("nenhum *.csv em data/processed")

    def verificar_parquets_estruturais(self, con: duckdb.DuckDBPyConnection) -> None:
        print("=== (c2-c4) Estrutura dos arquivos Parquet ===")
        parquets = sorted(p for p in self.processed.rglob("*.parquet") if not self._pertence_a_subgate(p))
        if not parquets:
            self.falha("nenhum arquivo .parquet em data/processed")
            return

        total_col_proibida = total_n_exata = total_faixa_invalida = total_nao_multiplo = 0

        for f in parquets:
            rel = f.relative_to(self.processed).as_posix()
            cols = list(con.execute(f"SELECT * FROM read_parquet('{f}') LIMIT 0").df().columns)
            cols_lower = {c.lower() for c in cols}

            # c2: colunas proibidas (R6)
            proibidas = cols_lower & COLUNAS_PROIBIDAS
            if proibidas:
                self.falha(f"{rel}: coluna(s) proibida(s) presentes: {sorted(proibidas)}")
                total_col_proibida += len(proibidas)

            # c3: nenhuma contagem amostral exata; faixas com valores válidos (R5)
            n_exatas = [c for c in cols if eh_coluna_n_exata(c)]
            if n_exatas:
                self.falha(f"{rel}: coluna(s) de contagem amostral exata (só *_faixa é permitido): {n_exatas}")
                total_n_exata += len(n_exatas)

            faixas = [c for c in cols if c.lower().endswith("_faixa")]
            for c in faixas:
                valores = {r[0] for r in con.execute(
                    f'SELECT DISTINCT "{c}" FROM read_parquet(\'{f}\') WHERE "{c}" IS NOT NULL').fetchall()}
                fora = valores - FAIXAS_VALIDAS
                if fora:
                    self.falha(f"{rel}.{c}: valores fora do conjunto de faixas permitido {sorted(FAIXAS_VALIDAS)}: {sorted(fora)}")
                    total_faixa_invalida += len(fora)

            # c4: colunas de contagem ponderada em múltiplos de 5 (R4)
            for c in cols:
                if not eh_coluna_arredondada(c):
                    continue
                v = con.execute(
                    f'SELECT COUNT(*) FROM read_parquet(\'{f}\') WHERE "{c}" IS NOT NULL '
                    f'AND ABS("{c}" - ROUND("{c}"/{R.ARREDONDAMENTO}.0)*{R.ARREDONDAMENTO}) > 1e-6'
                ).fetchone()[0]
                if v:
                    self.falha(f"{rel}.{c}: {v} valor(es) que não são múltiplos de {R.ARREDONDAMENTO}")
                    total_nao_multiplo += 1

        if not total_col_proibida:
            self.ok(f"{len(parquets)} arquivos parquet sem colunas de domicílio/área de ponderação")
        if not total_n_exata:
            self.ok("nenhuma coluna de contagem amostral exata (só *_faixa)")
        if not total_faixa_invalida:
            self.ok("todas as colunas *_faixa têm valores dentro do conjunto de faixas permitido")
        if not total_nao_multiplo:
            self.ok(f"colunas de contagem ponderada verificadas, todas em múltiplos de {R.ARREDONDAMENTO}")

    def rodar(self) -> int:
        print("=== Verificação independente do gate de revelação (sem microdados) ===")
        carimbo = self.verificar_carimbo()
        if carimbo is not None:
            self.verificar_hashes(carimbo)
        self.verificar_sem_csv()
        con = duckdb.connect()
        self.verificar_parquets_estruturais(con)

        if self.erros:
            print(f"\nVERIFY_GATE REPROVADO: {len(self.erros)} problema(s).")
            return 1
        print("\nVERIFY_GATE APROVADO: data/processed íntegro e consistente com o carimbo do gate.")
        return 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", default=str(ROOT / "data/processed"),
                     help="Diretório publicável a verificar (padrão: data/processed).")
    args = ap.parse_args(argv)
    return Verificador(pathlib.Path(args.dir)).rodar()


if __name__ == "__main__":
    raise SystemExit(main())
