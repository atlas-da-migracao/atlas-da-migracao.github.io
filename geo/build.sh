#!/bin/sh
# F3: Malha municipal do IBGE (2022) -> TopoJSON simplificado + limites de UF + centroides.
#
# Entrada: data/geo/raw/BR_Municipios_2022.shp (shapefile público do IBGE, geoftp).
# Saída:   data/processed/geo/municipios.topojson, uf.topojson, centroides.parquet.
#
# Dado geográfico público (sem microdados) -- não sujeito às regras de sigilo do CLAUDE.md,
# mas o alvo de tamanho (<=2MB) e a correspondência 1:1 com municipios.parquet são
# verificados por pipeline/tests/test_f3_geo.py.
set -e
cd "$(dirname "$0")/.."

RAW=data/geo/raw/BR_Municipios_2022.shp
# 4300001/4300002 = Lagoa Mirim e Lagoa dos Patos (corpos d'água sem população,
# incluídos pelo IBGE na malha por completude cartográfica; não são municípios)
OUT=data/processed/geo
mkdir -p "$OUT"

echo "== municípios (simplificado, mantendo topologia) =="
npx --yes mapshaper "$RAW" \
    -filter 'CD_MUN != "8888888" && CD_MUN != "9999999" && CD_MUN != "4300001" && CD_MUN != "4300002"' \
    -simplify 1% keep-shapes \
    -filter-fields CD_MUN,NM_MUN,SIGLA_UF \
    -o format=topojson quantization=1e5 "$OUT/municipios.topojson"

echo "== limites de UF (dissolvidos a partir dos municípios) =="
npx --yes mapshaper "$RAW" \
    -filter 'CD_MUN != "8888888" && CD_MUN != "9999999" && CD_MUN != "4300001" && CD_MUN != "4300002"' \
    -dissolve2 SIGLA_UF \
    -simplify 5% keep-shapes \
    -filter-fields SIGLA_UF \
    -o format=topojson quantization=1e5 "$OUT/uf.topojson"

echo "== ok =="
ls -la "$OUT"
