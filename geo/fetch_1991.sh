#!/bin/sh
# F7.4 (Censo 1991): baixa a malha municipal 1991 do IBGE (geoftp, dado público, arquivo
# nacional único -- ao contrário de 2010/2000, que baixam 27 zips por UF) e normaliza os campos
# para o padrão CD_MUN/NM_MUN/SIGLA_UF esperado por geo/build.sh, igual a fetch_2000.sh/fetch_2010.sh.
#
# Entrada: nenhuma (baixa da rede).
# Saída:   data/geo/raw/1991/BR_Municipios_1991.{shp,shx,dbf,prj}
#
# O shapefile nacional do IBGE (05_malha_municipal_1991.zip) traz os campos BR91POLY_I
# (código de município, truncado a 10 caracteres no .dbf -- provavelmente BR91POLY_ID na fonte)
# e NOMEMUNICP (confirmado com `mapshaper -i <shp> -info`), sem SIGLA_UF. O campo de código é
# lido pelo mapshaper como número (precisa de String() antes de .slice()).
set -e
cd "$(dirname "$0")/.."

OUT=data/geo/raw/1991
TMP="$OUT/tmp"
mkdir -p "$TMP"

URL="https://geoftp.ibge.gov.br/organizacao_do_territorio/estrutura_territorial/evolucao_da_divisao_territorial_do_brasil/evolucao_da_divisao_territorial_do_brasil_1872_2010/municipios_1872_1991/divisao_territorial_1872_1991/1991/05_malha_municipal_1991.zip"
zip="$TMP/malha_1991.zip"
if [ ! -f "$zip" ]; then
  echo "== baixando malha 1991 (arquivo único, ~4,7 MB) =="
  curl -sS --fail -o "$zip" "$URL"
fi
dir="$TMP/extract"
if [ ! -d "$dir" ]; then
  mkdir -p "$dir"
  unzip -o -q "$zip" -d "$dir"
fi
SHP=$(find "$dir" -iname '*.shp' | head -1)

echo "== normalizando campos e recortes (mapshaper) =="
# Achados (mapshaper -i "$SHP" -info, e inspeção do .dbf exportado para CSV) antes de decidir
# a lógica abaixo:
#
# - 4.601 registros no shapefile bruto, mas só 4.494 códigos BR91POLY_I distintos -- 27
#   municípios (ex.: 2103703/Bacabal-MA com 18 registros, 2101301/Açailândia-MA com 16) têm
#   partes disjuntas gravadas como registros Polygon separados repetindo o mesmo código, igual
#   ao padrão visto em 2000 (mas aqui já vem assim no arquivo nacional único, não é efeito de
#   fundir 27 shapefiles por UF) -- por isso -dissolve CD_MUN é necessário, confirmado: os
#   4.567 registros que sobram após o filtro abaixo viram exatamente 4.491 ao dissolver.
#
# - Dos 4.494 códigos distintos, 3 não são municípios: "0" (34 registros, nome "PI/CE" em 3
#   deles -- é a área histórica de litígio territorial Piauí/Ceará, ~2.891 km² somados, nunca
#   teve um município do Censo 1991 associado; os outros 31 registros com "0" e nome em branco
#   são frestas/sobras de topologia do próprio arquivo do IBGE, não de um -clean nosso, com área
#   entre ~0,04 km² e ~58 km²) e "9999910"/"9999920" (sem nome; confirmados por centroide em
#   -31,05/-51,35 e -32,75/-52,97 -- Lagoa dos Patos e Lagoa Mirim/RS, os mesmos dois corpos
#   d'água que aparecem como 4300001/4300002 na malha 2022, só que com códigos fictícios
#   diferentes porque esses códigos numéricos ainda não existiam em 1991). Nenhum dos três
#   aparece em pipeline/labels_1991.MUNICIPIOS_1991 -- filtrados aqui (equivalente ao FILTRO de
#   geo/build.sh, mas já na origem, já que "9999910"/"9999920" são específicos de 1991 e o
#   FILTRO do build.sh não os conhece).
#
# - Um código do shapefile (2306045, "ITAPIPOCA") não bate com nenhum município de
#   labels_1991.MUNICIPIOS_1991, que tem Itapipoca/CE em 2306405 -- comparação do conjunto de
#   códigos da malha com o conjunto de labels_1991 mostrou exatamente essa troca de dígitos
#   (2306045 vs. 2306405) como única divergência de código (fora os 3 sentinelas acima).
#   Corrigido aqui como erro de digitação do IBGE na malha histórica (não uma divergência
#   territorial real -- nenhum outro registro usa 2306405 e nenhum outro usa 2306045).
#
# - -snap -clean: testado isoladamente (depois do dissolve) e não alterou nada (0 pontos
#   ajustados, 4.491 de 4.491 feições mantidas) -- diferente de 2000/2010, a malha 1991 é um
#   único arquivo nacional (não a fusão de 27 shapefiles por UF), já com topologia consistente
#   entre municípios vizinhos; por isso omitido aqui (mantendo o script mais simples e o dado
#   mais fiel à fonte). Também não há overlaps do tipo "enclave" (Águas de São Pedro etc.) que
#   justificassem overlap-rule=min-area -- não há municípios sumindo com -clean padrão.
#
# - -proj EPSG:4674: diferente de 2022/2010/2000 (já em SIRGAS 2000 geográfico, graus -- ver
#   .prj), o shapefile nacional de 1991 vem projetado em World Polyconic (metros, meridiano
#   central -54, confirmado no .prj original). Sem reprojetar, ST_Centroid em
#   pipeline/build_centroids.py devolveria coordenadas em metros (não graus) e os testes de
#   bounding box do Brasil (lon/lat) e o front-end (que espera graus) quebrariam. Reprojetado
#   aqui para SIRGAS 2000 (EPSG:4674, mesmo datum de origem, sem transformação de datum) --
#   confirmado que o bounding box final bate com o território brasileiro em graus.
npx --yes mapshaper -i "$SHP" \
    -rename-fields CD_MUN=BR91POLY_I,NM_MUN=NOMEMUNICP \
    -each "CD_MUN = String(CD_MUN)" \
    -each "if (CD_MUN == '2306045') CD_MUN = '2306405';" \
    -filter "CD_MUN != '0' && CD_MUN != '9999910' && CD_MUN != '9999920'" \
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
    -dissolve CD_MUN copy-fields=NM_MUN,SIGLA_UF \
    -proj EPSG:4674 \
    -o format=shapefile encoding=utf8 "$OUT/BR_Municipios_1991.shp"

rm -rf "$TMP"
echo "== ok =="
ls -la "$OUT"
