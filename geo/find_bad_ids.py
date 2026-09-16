"""F9.10: lista, em um GeoJSON intermediário (produto de `-clean` em `geo/build.sh`, ANTES da
conversão final para TopoJSON), os ids de feição que falham ST_IsValid (GEOS) ou a
triangulação earcut (`geo/validate_earcut.mjs`) -- a mesma dupla checagem de
`pipeline/validate_geo.py`, mas operando direto sobre GeoJSON (sem decodificar TopoJSON), para
`geo/build.sh` poder decidir se chama `geo/repair_geojson.py` antes de publicar.

Dado geográfico público -- sem restrição de sigilo.

Uso: python geo/find_bad_ids.py <arquivo.geojson> <campo_id>
Saída: uma linha na stdout com os ids ruins separados por vírgula (vazia se nenhum).
"""
from __future__ import annotations

import json
import pathlib
import subprocess
import sys

import duckdb

ROOT = pathlib.Path(__file__).resolve().parent.parent
EARCUT_JS = ROOT / "geo/validate_earcut.mjs"


def main() -> None:
    caminho, campo_id = sys.argv[1], sys.argv[2]

    con = duckdb.connect()
    con.execute("INSTALL spatial; LOAD spatial;")
    invalidos = {
        str(r[0]) for r in con.execute(
            f"SELECT {campo_id} FROM ST_Read('{pathlib.Path(caminho).as_posix()}') WHERE NOT ST_IsValid(geom)"
        ).fetchall()
    }

    resultado = subprocess.run(
        ["node", str(EARCUT_JS), caminho], check=True, cwd=ROOT, capture_output=True, text=True,
    )
    ruins_earcut = {str(r["id"]) for r in json.loads(resultado.stdout)}

    todos = invalidos | ruins_earcut
    print(",".join(sorted(todos)))


if __name__ == "__main__":
    main()
