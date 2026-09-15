#!/bin/sh
# F1 (Censo 2000): baixa a malha municipal 2000 do IBGE (geoftp, dado público, por UF -- não
# há arquivo único do Brasil) e funde num único shapefile equivalente ao BR_Municipios_2022.shp
# usado por geo/build.sh, com os mesmos nomes de campo (CD_MUN, NM_MUN, SIGLA_UF).
#
# Entrada: nenhuma (baixa da rede).
# Saída:   data/geo/raw/2000/BR_Municipios_2000.{shp,shx,dbf,prj}
#
# Os shapefiles por UF do IBGE (municipio_2000/<uf>/<uf>_municipios.zip) trazem os campos
# GEOCODIGO/NOME (confirmado com `mapshaper -i <shp> -info` no arquivo do AC -- diferente de
# CD_GEOCODM/NM_MUNICIP usados em 2010), sem SIGLA_UF e em codificação latin1 (sem .cpg).
# Este script normaliza os nomes/encoding na fusão via mapshaper, igual ao fetch_2010.sh.
set -e
cd "$(dirname "$0")/.."

OUT=data/geo/raw/2000
TMP="$OUT/tmp"
mkdir -p "$TMP"

BASE="https://geoftp.ibge.gov.br/organizacao_do_territorio/malhas_territoriais/malhas_municipais/municipio_2000"
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
# geo/build.sh deixa milhares de interseções não reparáveis e o TopoJSON de saída fica muito
# maior que o orçamento (visto empiricamente na malha 2010: 4,9 MB vs. limite de 2 MB).
#
# -clean overlap-rule=min-area: a malha 2000 tem overlaps internos (dentro de uma mesma UF,
# não só entre UFs vizinhas) entre municípios pequenos "enclave" e o vizinho maior que os
# circunda -- ex.: Águas de São Pedro/SP (3500600, ~4 km², cercado por São Pedro), Ladário/MS
# (5005202) e Portelândia/GO (5218102). Com a regra padrão (max-area), -clean resolve o
# overlap dando a área inteira ao polígono maior e o município pequeno inteiro desaparece do
# shapefile final (confirmado testando `-clean` isolado no shapefile de SP: 691 de 693
# feições sobrevivem, sumindo justamente Águas de São Pedro). Com min-area, o polígono menor
# fica com a área sobreposta e nenhum município é perdido -- confirmado testando os 3 casos
# (SP, MS, GO) isoladamente antes de aplicar na malha completa.
#
# -dissolve CD_MUN: diferente da malha 2010 (cujos shapefiles por UF já trazem cada município
# como um único registro, mesmo os com ilhas/partes disjuntas), os shapefiles de 2000 guardam
# cada parte de um município multi-parte como um registro Polygon separado repetindo o mesmo
# GEOCODIGO (visto no RJ: só o município 3303807 tinha 34 registros). Sem dissolver por
# CD_MUN, build_centroids.py calcularia um centroide por PARTE (ex.: 34 "centroides" para o
# mesmo município) em vez de um por município. -dissolve agrupa as partes de cada CD_MUN numa
# única feição (multipolígono quando as partes são disjuntas) -- confirmado: 5.755 registros
# viram 5.510 (5.507 municípios + 2 corpos d'água + a feição residual sem geocódigo, ver
# comentário sobre CD_MUN="0" em geo/build.sh), com contagem de registros == contagem de
# CD_MUN distintos.
npx --yes mapshaper -i "$TMP"/*/*.shp combine-files encoding=latin1 \
    -merge-layers force \
    -rename-fields CD_MUN=GEOCODIGO,NM_MUN=NOME \
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
    -clean overlap-rule=min-area \
    -dissolve CD_MUN copy-fields=NM_MUN,SIGLA_UF \
    -o format=shapefile encoding=utf8 "$OUT/BR_Municipios_2000.shp"

rm -rf "$TMP"
echo "== ok =="
ls -la "$OUT"
