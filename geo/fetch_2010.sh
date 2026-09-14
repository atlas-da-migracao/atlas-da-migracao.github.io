#!/bin/sh
# F1 (Censo 2010): baixa a malha municipal 2010 do IBGE (geoftp, dado público, por UF -- não
# há arquivo único do Brasil) e funde num único shapefile equivalente ao BR_Municipios_2022.shp
# usado por geo/build.sh, com os mesmos nomes de campo (CD_MUN, NM_MUN, SIGLA_UF).
#
# Entrada: nenhuma (baixa da rede).
# Saída:   data/geo/raw/2010/BR_Municipios_2010.{shp,shx,dbf,prj}
#
# Os shapefiles por UF do IBGE (municipio_2010/<uf>/<uf>_municipios.zip) trazem os campos
# CD_GEOCODM/NM_MUNICIP, sem SIGLA_UF e em codificação latin1 (sem .cpg) -- diferente da malha
# 2022. Este script normaliza os nomes/encoding na fusão via mapshaper.
set -e
cd "$(dirname "$0")/.."

OUT=data/geo/raw/2010
TMP="$OUT/tmp"
mkdir -p "$TMP"

BASE="https://geoftp.ibge.gov.br/organizacao_do_territorio/malhas_territoriais/malhas_municipais/municipio_2010"
UFS="ac al am ap ba ce df es go ma mg ms mt pa pb pe pi pr rj rn ro rr rs sc se sp to"

for uf in $UFS; do
  zip="$TMP/${uf}_municipios.zip"
  if [ ! -f "$zip" ]; then
    echo "== baixando $uf =="
    curl -sS --fail -o "$zip" "$BASE/$uf/${uf}_municipios.zip"
  fi
  dir="$TMP/$uf"
  if [ ! -d "$dir" ]; then
    mkdir -p "$dir"
    unzip -o -q "$zip" -d "$dir"
  fi
done

echo "== fundindo as 27 malhas por UF (mapshaper) =="
# -snap -clean: os 27 shapefiles foram digitizados independentemente por UF (ao contrário do
# BR_Municipios_2022.shp, um único arquivo nacional já com topologia consistente), então a
# fronteira entre UFs vizinhas não compartilha vértice exato -- sem isso, -simplify do
# geo/build.sh deixa milhares de interseções não reparáveis e o TopoJSON de saída fica ~2.5x
# maior que o orçamento (visto empiricamente: 4,9 MB vs. limite de 2 MB em municipios.topojson).
npx --yes mapshaper -i "$TMP"/*/*.shp combine-files encoding=latin1 \
    -merge-layers force \
    -rename-fields CD_MUN=CD_GEOCODM,NM_MUN=NM_MUNICIP \
    -each "
      var UF_POR_COD = {
        '11':'RO','12':'AC','13':'AM','14':'RR','15':'PA','16':'AP','17':'TO',
        '21':'MA','22':'PI','23':'CE','24':'RN','25':'PB','26':'PE','27':'AL','28':'SE','29':'BA',
        '31':'MG','32':'ES','33':'RJ','35':'SP',
        '41':'PR','42':'SC','43':'RS',
        '50':'MS','51':'MT','52':'GO','53':'DF'
      };
      SIGLA_UF = UF_POR_COD[CD_MUN.slice(0,2)]
    " \
    -filter-fields CD_MUN,NM_MUN,SIGLA_UF \
    -snap \
    -clean \
    -o format=shapefile encoding=utf8 "$OUT/BR_Municipios_2010.shp"

rm -rf "$TMP"
echo "== ok =="
ls -la "$OUT"
