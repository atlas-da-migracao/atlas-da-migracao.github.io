"""Testes de pipeline/verify_gate.py -- roda inteiramente sobre fixtures sintéticas em

diretório temporário, sem depender de data/interim nem de data/raw (o próprio objetivo do
script: verificar o gate sem acesso aos microdados). Cobre o fluxo aprovado e cada tipo de
violação pedido no plano F7: carimbo ausente, arquivo alterado, arquivo extra não carimbado,
CSV intruso, e coluna proibida.
"""
from __future__ import annotations

import hashlib
import json
import pathlib

import duckdb
import pytest

from verify_gate import Verificador


def _sha256(caminho: pathlib.Path) -> str:
    return hashlib.sha256(caminho.read_bytes()).hexdigest()


def _escrever_parquet(con: duckdb.DuckDBPyConnection, destino: pathlib.Path, sql_select: str) -> None:
    destino.parent.mkdir(parents=True, exist_ok=True)
    con.execute(f"COPY ({sql_select}) TO '{destino}' (FORMAT PARQUET)")


@pytest.fixture()
def processed_valido(tmp_path: pathlib.Path) -> pathlib.Path:
    """Um data/processed sintético, pequeno, com carimbo .gate_ok válido."""
    processed = tmp_path / "data" / "processed"
    processed.mkdir(parents=True)
    con = duckdb.connect()

    # fluxos.parquet: total múltiplo de 5, n_faixa dentro do conjunto permitido
    _escrever_parquet(con, processed / "fluxos.parquet", """
        SELECT * FROM (VALUES
            ('1100015', '1100023', 20, '20-49'),
            ('1100023', '1100015', 100, '100-499')
        ) AS t(origem, destino, total, n_faixa)
    """)
    # municipios.parquet: pop múltiplo de 5
    _escrever_parquet(con, processed / "municipios.parquet", """
        SELECT * FROM (VALUES ('1100015', 'Alta Floresta DOeste', 25), (' 1100023', 'Ariquemes', 100)
        ) AS t(cd_mun, nm_mun, pop)
    """)
    # geo/ subpasta, para confirmar que o carimbo é recursivo
    _escrever_parquet(con, processed / "geo" / "centroides.parquet", """
        SELECT * FROM (VALUES ('1100015', -11.9, -61.9)) AS t(cd_mun, lat, lon)
    """)
    (processed / "meta.json").write_text('{"versao_dados": "teste"}', encoding="utf-8")

    hashes = {}
    for f in sorted(processed.rglob("*")):
        if f.is_file():
            hashes[f.relative_to(processed).as_posix()] = _sha256(f)
    carimbo = {
        "formato_versao": 1,
        "versao_dados": "teste",
        "timestamp": "2026-09-06T00:00:00",
        "arquivos": hashes,
    }
    (processed / ".gate_ok").write_text(json.dumps(carimbo, indent=2), encoding="utf-8")
    return processed


def test_gate_valido_aprova(processed_valido: pathlib.Path) -> None:
    v = Verificador(processed_valido)
    assert v.rodar() == 0
    assert v.erros == []


def test_carimbo_ausente_reprova(tmp_path: pathlib.Path) -> None:
    processed = tmp_path / "data" / "processed"
    processed.mkdir(parents=True)
    con = duckdb.connect()
    _escrever_parquet(con, processed / "municipios.parquet",
                       "SELECT * FROM (VALUES ('1100015', 25)) AS t(cd_mun, pop)")
    v = Verificador(processed)
    assert v.rodar() == 1
    assert any(".gate_ok" in e for e in v.erros)


def test_arquivo_alterado_depois_do_gate_reprova(processed_valido: pathlib.Path) -> None:
    # Reabre e modifica um parquet já carimbado -- simula alguém editando data/processed
    # por fora do pipeline, depois que o gate rodou.
    con = duckdb.connect()
    _escrever_parquet(con, processed_valido / "municipios.parquet", """
        SELECT * FROM (VALUES ('1100015', 'Alta Floresta DOeste', 999999)) AS t(cd_mun, nm_mun, pop)
    """)
    v = Verificador(processed_valido)
    assert v.rodar() == 1
    assert any("diferente do carimbado" in e for e in v.erros)


def test_arquivo_extra_nao_carimbado_reprova(processed_valido: pathlib.Path) -> None:
    con = duckdb.connect()
    _escrever_parquet(con, processed_valido / "fluxos_uf.parquet", """
        SELECT * FROM (VALUES ('11', '12', 50, '20-49')) AS t(origem, destino, total, n_faixa)
    """)
    v = Verificador(processed_valido)
    assert v.rodar() == 1
    assert any("não estão no carimbo" in e for e in v.erros)


def test_csv_intruso_reprova(processed_valido: pathlib.Path) -> None:
    (processed_valido / "vazamento.csv").write_text("cd_mun,pop\n1100015,25\n", encoding="utf-8")
    v = Verificador(processed_valido)
    assert v.rodar() == 1
    assert any("CSV" in e for e in v.erros)
    # o CSV intruso também não está carimbado -- as duas violações são esperadas e coerentes
    assert any("não estão no carimbo" in e for e in v.erros)


def test_coluna_proibida_reprova(tmp_path: pathlib.Path) -> None:
    processed = tmp_path / "data" / "processed"
    processed.mkdir(parents=True)
    con = duckdb.connect()
    # controle é uma das colunas de disclosure_rules.COLUNAS_PROIBIDAS (identificador de domicílio)
    _escrever_parquet(con, processed / "municipios.parquet", """
        SELECT * FROM (VALUES ('1100015', 25, 42)) AS t(cd_mun, pop, controle)
    """)
    hashes = {"municipios.parquet": _sha256(processed / "municipios.parquet")}
    carimbo = {"formato_versao": 1, "versao_dados": "teste",
               "timestamp": "2026-09-06T00:00:00", "arquivos": hashes}
    (processed / ".gate_ok").write_text(json.dumps(carimbo), encoding="utf-8")

    v = Verificador(processed)
    assert v.rodar() == 1
    assert any("coluna(s) proibida(s)" in e for e in v.erros)


def test_contagem_exata_fora_de_faixa_reprova(tmp_path: pathlib.Path) -> None:
    processed = tmp_path / "data" / "processed"
    processed.mkdir(parents=True)
    con = duckdb.connect()
    # coluna "n" sem sufixo _faixa: contagem amostral exata, proibida por R5
    _escrever_parquet(con, processed / "fluxos.parquet", """
        SELECT * FROM (VALUES ('1100015', '1100023', 20, 37)) AS t(origem, destino, total, n)
    """)
    hashes = {"fluxos.parquet": _sha256(processed / "fluxos.parquet")}
    carimbo = {"formato_versao": 1, "versao_dados": "teste",
               "timestamp": "2026-09-06T00:00:00", "arquivos": hashes}
    (processed / ".gate_ok").write_text(json.dumps(carimbo), encoding="utf-8")

    v = Verificador(processed)
    assert v.rodar() == 1
    assert any("contagem amostral exata" in e for e in v.erros)


def test_faixa_invalida_reprova(tmp_path: pathlib.Path) -> None:
    processed = tmp_path / "data" / "processed"
    processed.mkdir(parents=True)
    con = duckdb.connect()
    _escrever_parquet(con, processed / "fluxos.parquet", """
        SELECT * FROM (VALUES ('1100015', '1100023', 20, '7')) AS t(origem, destino, total, n_faixa)
    """)
    hashes = {"fluxos.parquet": _sha256(processed / "fluxos.parquet")}
    carimbo = {"formato_versao": 1, "versao_dados": "teste",
               "timestamp": "2026-09-06T00:00:00", "arquivos": hashes}
    (processed / ".gate_ok").write_text(json.dumps(carimbo), encoding="utf-8")

    v = Verificador(processed)
    assert v.rodar() == 1
    assert any("fora do conjunto de faixas" in e for e in v.erros)


def test_valor_nao_multiplo_de_5_reprova(tmp_path: pathlib.Path) -> None:
    processed = tmp_path / "data" / "processed"
    processed.mkdir(parents=True)
    con = duckdb.connect()
    _escrever_parquet(con, processed / "fluxos.parquet", """
        SELECT * FROM (VALUES ('1100015', '1100023', 22, '20-49')) AS t(origem, destino, total, n_faixa)
    """)
    hashes = {"fluxos.parquet": _sha256(processed / "fluxos.parquet")}
    carimbo = {"formato_versao": 1, "versao_dados": "teste",
               "timestamp": "2026-09-06T00:00:00", "arquivos": hashes}
    (processed / ".gate_ok").write_text(json.dumps(carimbo), encoding="utf-8")

    v = Verificador(processed)
    assert v.rodar() == 1
    assert any("não são múltiplos de 5" in e for e in v.erros)


def test_n_municipios_nao_e_falso_positivo(tmp_path: pathlib.Path) -> None:
    """n_municipios (rm_resumo.parquet) é contagem geográfica, não amostral -- não deve

    disparar a checagem de contagem amostral exata (regressão do falso positivo encontrado
    ao rodar contra data/processed real)."""
    processed = tmp_path / "data" / "processed"
    processed.mkdir(parents=True)
    con = duckdb.connect()
    _escrever_parquet(con, processed / "rm_resumo.parquet", """
        SELECT * FROM (VALUES ('3501', 'RM de Campinas', 20)) AS t(cd_rm, nm_rm, n_municipios)
    """)
    hashes = {"rm_resumo.parquet": _sha256(processed / "rm_resumo.parquet")}
    carimbo = {"formato_versao": 1, "versao_dados": "teste",
               "timestamp": "2026-09-06T00:00:00", "arquivos": hashes}
    (processed / ".gate_ok").write_text(json.dumps(carimbo), encoding="utf-8")

    v = Verificador(processed)
    assert v.rodar() == 0
    assert v.erros == []
