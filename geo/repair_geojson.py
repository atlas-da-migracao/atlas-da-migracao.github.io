"""F9.10: reparo dirigido de geometria -- só toca as feições que `pipeline/validate_geo.py`
marca como problemáticas (ST_IsValid=false, ou earcut mis-triangulando um anel tecnicamente
válido) num GeoJSON intermediário, via `ST_MakeValid` (GEOS, extensão spatial do DuckDB).

Terceiro item da ordem de correção de `geo/build.sh` (depois de `-clean snap-interval=`
pequeno e de reduzir `-simplify`): só entra em ação quando sobra alguma feição inválida
depois do `-clean` default do mapshaper -- ver docstring de `geo/build.sh`.

Preserva o campo de id (CD_MUN/cd_uf/cd_rgi/cd_rgint) e recusa a correção se a área da
feição mudar mais de 0,5% (`--tolerancia-area`, default 0.005) -- nesse caso levanta erro em
vez de publicar uma geometria distorcida silenciosamente.

Dado geográfico público (malha do IBGE) -- sem restrição de sigilo.

Uso: python geo/repair_geojson.py <entrada.geojson> <saida.geojson> --ids ID1,ID2,... --campo-id CD_MUN
"""
from __future__ import annotations

import argparse
import json
import pathlib
import sys

import duckdb


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("entrada")
    ap.add_argument("saida")
    ap.add_argument("--ids", required=True, help="lista de ids (separados por vírgula) a reparar")
    ap.add_argument("--campo-id", required=True)
    ap.add_argument("--tolerancia-area", type=float, default=0.005)
    args = ap.parse_args()

    ids_alvo = set(args.ids.split(","))
    dados = json.loads(pathlib.Path(args.entrada).read_text(encoding="utf-8"))
    con = duckdb.connect()
    con.execute("INSTALL spatial; LOAD spatial;")

    reparadas = []
    for f in dados["features"]:
        fid = str(f["properties"].get(args.campo_id))
        if fid not in ids_alvo:
            continue
        geom_geojson = json.dumps(f["geometry"])
        area_antes, = con.execute(
            "SELECT ST_Area(ST_GeomFromGeoJSON(?))", [geom_geojson]
        ).fetchone()
        reparado_geojson, area_depois = con.execute("""
            WITH r AS (SELECT ST_MakeValid(ST_GeomFromGeoJSON(?)) AS g)
            SELECT ST_AsGeoJSON(g), ST_Area(g) FROM r
        """, [geom_geojson]).fetchone()

        if area_antes > 0:
            desvio = abs(area_depois - area_antes) / area_antes
            if desvio > args.tolerancia_area:
                raise SystemExit(
                    f"ERRO: reparo de {fid} mudou a área em {desvio:.2%} "
                    f"(> {args.tolerancia_area:.2%} de tolerância) -- abortando."
                )
        nova_geom = json.loads(reparado_geojson)
        # ST_MakeValid pode devolver GeometryCollection/MultiPolygon quando o reparo separa
        # a feição em partes -- mantém como está (MultiPolygon é um tipo válido de
        # feição de município no restante do pipeline; GeometryCollection reduzido aos
        # polígonos, se aparecer).
        if nova_geom.get("type") == "GeometryCollection":
            partes = [g for g in nova_geom["geometries"] if g["type"] in ("Polygon", "MultiPolygon")]
            if len(partes) == 1:
                nova_geom = partes[0]
            else:
                coords = []
                for g in partes:
                    coords.extend(g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]])
                nova_geom = {"type": "MultiPolygon", "coordinates": coords}
        f["geometry"] = nova_geom
        reparadas.append(fid)

    faltando = ids_alvo - set(reparadas)
    if faltando:
        print(f"[aviso] ids não encontrados no GeoJSON: {sorted(faltando)}", file=sys.stderr)

    pathlib.Path(args.saida).write_text(json.dumps(dados), encoding="utf-8")
    print(f"reparadas {len(reparadas)} feição(ões): {sorted(reparadas)}")


if __name__ == "__main__":
    main()
