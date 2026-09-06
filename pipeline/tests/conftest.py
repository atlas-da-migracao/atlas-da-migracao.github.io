import pathlib
import sys

import duckdb
import pytest

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / "pipeline"))

PESSOAS = str(ROOT / "data/interim/pessoas.parquet")
DOMICILIOS = str(ROOT / "data/interim/domicilios.parquet")


@pytest.fixture(scope="session")
def con():
    c = duckdb.connect()
    c.execute("PRAGMA threads=8;")
    yield c
    c.close()


@pytest.fixture(scope="session")
def pessoas_path():
    if not pathlib.Path(PESSOAS).exists():
        pytest.skip("data/interim/pessoas.parquet ainda não gerado (rode `python pipeline/run.py 01`)")
    return PESSOAS


@pytest.fixture(scope="session")
def domicilios_path():
    if not pathlib.Path(DOMICILIOS).exists():
        pytest.skip("data/interim/domicilios.parquet ainda não gerado")
    return DOMICILIOS
