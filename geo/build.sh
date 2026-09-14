#!/bin/sh
# F3/F6: Malha municipal do IBGE -> TopoJSON simplificado, limites de UF/RGI/RGInt e
# centroides por nível.
#
# Uso: ./geo/build.sh [edicao]      # default: 2022 (ver pipeline/edicoes.py)
#   2022: entrada data/geo/raw/BR_Municipios_2022.shp, saída data/processed/geo/ -- inalterado.
#   2010: entrada data/geo/raw/2010/BR_Municipios_2010.shp (gerada por geo/fetch_2010.sh a
#         partir dos 27 shapefiles por UF do geoftp), saída data/processed/2010/geo/.
# Saída: municipios.topojson, uf.topojson, rgi.topojson, rgint.topojson, centroides.parquet
#        (+ centroides_rgi/rgint/uf.parquet via pipeline/build_centroids.py).
#
# Dado geográfico público (sem microdados) -- não sujeito às regras de sigilo do CLAUDE.md,
# mas o alvo de tamanho e a correspondência 1:1 com municipios_ref.parquet são
# verificados por pipeline/tests/test_f3_geo.py.
set -e
cd "$(dirname "$0")/.."

EDICAO="${1:-2022}"
if [ "$EDICAO" = "2022" ]; then
  RAW=data/geo/raw/BR_Municipios_2022.shp
  PROCESSED=data/processed
else
  RAW="data/geo/raw/$EDICAO/BR_Municipios_$EDICAO.shp"
  PROCESSED="data/processed/$EDICAO"
fi
[ -f "$RAW" ] || { echo "ERRO: $RAW não existe (rode geo/fetch_$EDICAO.sh antes, se houver)." >&2; exit 1; }

# 4300001/4300002 = Lagoa Mirim e Lagoa dos Patos (corpos d'água sem população, incluídos
# pelo IBGE na malha por completude cartográfica; não são municípios). Confirmado presente
# nas duas malhas (2022 e 2010); 8888888/9999999 são placeholders só do dado tabular 2022,
# mas o filtro os cobre de graça caso apareçam em malhas futuras.
FILTRO='CD_MUN != "8888888" && CD_MUN != "9999999" && CD_MUN != "4300001" && CD_MUN != "4300002"'
OUT="$PROCESSED/geo"
mkdir -p "$OUT"

echo "== recortes.json (cd_mun -> RGI/RGInt/UF, a partir de $PROCESSED/municipios_ref.parquet OU data/interim/$EDICAO se ainda não publicado) =="
# municipios_ref.parquet só é copiado para data/processed pelo publish.py (F7); até lá, ele
# vive em data/interim/<edicao> (ou data/interim para 2022) -- geo/build.sh roda antes do
# gate de revelação, então lê de onde o arquivo já existir.
REF="$PROCESSED/municipios_ref.parquet"
if [ "$EDICAO" = "2022" ]; then
  [ -f "$REF" ] || REF="data/interim/municipios_ref.parquet"
else
  [ -f "$REF" ] || REF="data/interim/$EDICAO/municipios_ref.parquet"
fi
[ -f "$REF" ] || { echo "ERRO: municipios_ref.parquet não encontrado para a edição $EDICAO (rode pipeline/build_ref.py --edicao $EDICAO)." >&2; exit 1; }
.venv/bin/python - "$REF" "$OUT/recortes.json" <<'PYEOF'
import json
import pathlib
import sys
import duckdb

ref, dest = sys.argv[1], sys.argv[2]
con = duckdb.connect()
linhas = con.execute(f"""
    SELECT cd_mun, cd_rgi, nm_rgi, cd_rgint, nm_rgint, uf AS cd_uf, uf_sigla
    FROM read_parquet('{ref}')
""").fetchall()
cols = ["cd_mun", "cd_rgi", "nm_rgi", "cd_rgint", "nm_rgint", "cd_uf", "uf_sigla"]
registros = [dict(zip(cols, linha)) for linha in linhas]
pathlib.Path(dest).write_text(json.dumps(registros, ensure_ascii=False), encoding="utf-8")
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
