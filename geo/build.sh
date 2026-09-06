#!/bin/sh
# F3/F6: Malha municipal do IBGE (2022) -> TopoJSON simplificado, limites de UF/RGI/RGInt
# e centroides por nível.
#
# Entrada: data/geo/raw/BR_Municipios_2022.shp (shapefile público do IBGE, geoftp).
# Saída:   data/processed/geo/municipios.topojson, uf.topojson, rgi.topojson, rgint.topojson,
#          centroides.parquet (+ centroides_rgi/rgint/uf.parquet via pipeline/build_centroids.py).
#
# Dado geográfico público (sem microdados) -- não sujeito às regras de sigilo do CLAUDE.md,
# mas o alvo de tamanho e a correspondência 1:1 com municipios_ref.parquet são
# verificados por pipeline/tests/test_f3_geo.py.
set -e
cd "$(dirname "$0")/.."

RAW=data/geo/raw/BR_Municipios_2022.shp
# 4300001/4300002 = Lagoa Mirim e Lagoa dos Patos (corpos d'água sem população,
# incluídos pelo IBGE na malha por completude cartográfica; não são municípios)
FILTRO='CD_MUN != "8888888" && CD_MUN != "9999999" && CD_MUN != "4300001" && CD_MUN != "4300002"'
OUT=data/processed/geo
mkdir -p "$OUT"

echo "== recortes.json (cd_mun -> RGI/RGInt/UF, a partir de municipios_ref.parquet) =="
.venv/bin/python - <<'PYEOF'
import json
import pathlib
import duckdb

con = duckdb.connect()
linhas = con.execute("""
    SELECT cd_mun, cd_rgi, nm_rgi, cd_rgint, nm_rgint, uf AS cd_uf, uf_sigla
    FROM read_parquet('data/processed/municipios_ref.parquet')
""").fetchall()
cols = ["cd_mun", "cd_rgi", "nm_rgi", "cd_rgint", "nm_rgint", "cd_uf", "uf_sigla"]
registros = [dict(zip(cols, linha)) for linha in linhas]
dest = pathlib.Path("data/processed/geo/recortes.json")
dest.write_text(json.dumps(registros, ensure_ascii=False), encoding="utf-8")
print(f"recortes.json: {len(registros)} municípios")
PYEOF

echo "== municípios (simplificado, mantendo topologia) =="
npx --yes mapshaper "$RAW" \
    -filter "$FILTRO" \
    -simplify 1% keep-shapes \
    -filter-fields CD_MUN,NM_MUN,SIGLA_UF \
    -o format=topojson quantization=1e5 "$OUT/municipios.topojson"

echo "== limites de UF (dissolvidos a partir dos municípios; id = código numérico de 2 dígitos," \
     "consistente com fluxos_uf/municipios.uf -- uf_sigla vai junto só para exibição) =="
npx --yes mapshaper "$RAW" \
    -filter "$FILTRO" \
    -join "$OUT/recortes.json" keys=CD_MUN,cd_mun \
    -dissolve cd_uf copy-fields=uf_sigla \
    -simplify 5% keep-shapes \
    -filter-fields cd_uf,uf_sigla \
    -o format=topojson quantization=1e5 "$OUT/uf.topojson"

echo "== regiões imediatas (RGI, dissolvidas a partir dos municípios) =="
npx --yes mapshaper "$RAW" \
    -filter "$FILTRO" \
    -join "$OUT/recortes.json" keys=CD_MUN,cd_mun \
    -dissolve cd_rgi copy-fields=nm_rgi,cd_uf,uf_sigla \
    -simplify 1.5% keep-shapes \
    -filter-fields cd_rgi,nm_rgi,cd_uf,uf_sigla \
    -o format=topojson quantization=1e5 "$OUT/rgi.topojson"

echo "== regiões intermediárias (RGInt, dissolvidas a partir dos municípios) =="
npx --yes mapshaper "$RAW" \
    -filter "$FILTRO" \
    -join "$OUT/recortes.json" keys=CD_MUN,cd_mun \
    -dissolve cd_rgint copy-fields=nm_rgint,cd_uf,uf_sigla \
    -simplify 1.5% keep-shapes \
    -filter-fields cd_rgint,nm_rgint,cd_uf,uf_sigla \
    -o format=topojson quantization=1e5 "$OUT/rgint.topojson"

echo "== ok =="
ls -la "$OUT"
