#!/bin/sh
# F9.4 (Censo 1980): baixa a malha municipal 1980 do IBGE (geoftp, dado público, arquivo
# nacional único, igual a fetch_1991.sh) e normaliza os campos para o padrão
# CD_MUN/NM_MUN/SIGLA_UF esperado por geo/build.sh.
#
# Entrada: nenhuma (baixa da rede).
# Saída:   data/geo/raw/1980/BR_Municipios_1980.{shp,shx,dbf,prj}
#
# O shapefile nacional do IBGE (05_malha_municipal_1980.zip) traz os campos "codigo"
# (código de município de 7 dígitos, lido pelo mapshaper como número -- precisa de String()
# antes de qualquer operação de string) e "nome" (confirmado com `mapshaper -i <shp> -info`
# e inspeção do .dbf exportado para CSV).
set -e
cd "$(dirname "$0")/.."

OUT=data/geo/raw/1980
TMP="$OUT/tmp"
mkdir -p "$TMP"

URL="https://geoftp.ibge.gov.br/organizacao_do_territorio/estrutura_territorial/evolucao_da_divisao_territorial_do_brasil/evolucao_da_divisao_territorial_do_brasil_1872_2010/municipios_1872_1991/divisao_territorial_1872_1991/1980/05_malha_municipal_1980.zip"
zip="$TMP/malha_1980.zip"
if [ ! -f "$zip" ]; then
  echo "== baixando malha 1980 (arquivo único, ~2,5 MB) =="
  curl -sS --fail -o "$zip" "$URL"
fi
dir="$TMP/extract"
if [ ! -d "$dir" ]; then
  mkdir -p "$dir"
  unzip -o -q "$zip" -d "$dir"
fi
SHP=$(find "$dir" -iname '*.shp' | head -1)

echo "== normalizando campos (mapshaper) =="
# Achados (mapshaper -i "$SHP" -info, e inspeção do .dbf exportado para CSV) antes de decidir
# a lógica abaixo:
#
# - 3.991 registros no shapefile bruto, e 3.991 códigos "codigo" distintos -- ao contrário de
#   2000/2010 (fusão de 27 shapefiles por UF) e de 1991 (arquivo nacional único mas com 27
#   municípios partidos em registros repetindo o mesmo código), aqui cada registro já tem um
#   código único: -dissolve CD_MUN não é necessário (confirmado por contagem de códigos
#   distintos via CSV exportado, igual ao total de registros).
#
# - Nenhum código sentinela de água/litígio encontrado: sem "0", sem "9999910"/"9999920" (que
#   aparecem em 1991), sem código de 1 dígito ou fora do padrão de 7 dígitos, sem nome vazio.
#   O único código "fora do padrão" de UF atual é 2000107/Fernando de Noronha (prefixo "20",
#   território federal até 1988, incorporado a PE depois) -- é um município legítimo do Censo
#   1980, não um artefato de topologia. O que fazer com ele (e com os municípios do norte de
#   Goiás sem par na Base dos Dados, ver bloco abaixo) era, neste ponto, decisão pendente do
#   agente metodologo -- decidido em F9.2/F9.3 e implementado logo abaixo.
#
# - RECODIFICAÇÃO (1.1.0-1980; até 1.0.7 os 52 do norte de Goiás eram dissolvidos numa
#   unidade 'NORTEGO'): a malha bruta tem 3.991 feições com o código DE 1980; a edição publica
#   todo município pelo código de 2022, e 53 códigos mudaram de UF desde então -- Fernando de
#   Noronha (2000107 -> 2605459, Território Federal em 1980) e os 52 municípios do norte de
#   Goiás que em 1988 formaram o Tocantins (52xxxxx -> 17xxxxx, mesmo serial, novo dígito
#   verificador). A tabela vem de pipeline/norte_goias_1980.CODIGO_PUBLICADO (fonte única, a
#   mesma que build_ref.py e 01_extract.sql usam); nenhuma feição é dissolvida, filtrada ou
#   tocada em geometria -- só o campo CD_MUN muda, e SIGLA_UF sai do prefixo do código novo.
#   Resultado: 3.991 feições, 1:1 com municipios_ref.parquet (3.939 + 52), 27 UFs.
#
# - -snap -clean: testado isoladamente e DESCARTADO aqui -- diferente de 1991 (0 mudança) e
#   de 2000/2010 (corrige overlaps da fusão de UFs), em 1980 o -clean com o limiar padrão do
#   mapshaper removeu 2.490 slivers e ficou com só 3.985 de 3.991 feições (6 municípios
#   somem). Como o arquivo já não tem duplicidade de código (não precisa de -dissolve) e a
#   fonte é um único arquivo nacional, mantido fiel à fonte sem -snap/-clean.
#
# - -proj EPSG:4674: igual a 1991, o shapefile nacional de 1980 vem em World Polyconic
#   (SIRGAS 2000 / GRS80, meridiano central -54, confirmado no .prj original), não em SIRGAS
#   2000 geográfico (graus) como 2022/2010/2000. Reprojetado aqui para EPSG:4674 (mesmo datum
#   de origem, sem transformação de datum) para que ST_Centroid/bounding box fiquem em graus.
# código de 1980 -> código publicado (53 entradas), em JSON, a partir do módulo Python -- uma
# só definição para não haver como as duas listas divergirem.
REMAP_JS=$(.venv/bin/python -c "import json, sys; sys.path.insert(0, 'pipeline'); import norte_goias_1980 as N; print(json.dumps(N.CODIGO_PUBLICADO))")

npx --yes mapshaper -i "$SHP" \
    -each "CD_MUN = String(codigo)" \
    -rename-fields NM_MUN=nome \
    -each "
      // código de 1980 -> código publicado (Fernando de Noronha e os 52 do norte de Goiás);
      // ver nota acima. Quem não está na tabela mantém o código (é o mesmo de 2022).
      var REMAP = $REMAP_JS;
      if (REMAP[CD_MUN]) CD_MUN = REMAP[CD_MUN];
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
    -proj EPSG:4674 \
    -o format=shapefile encoding=utf8 "$OUT/BR_Municipios_1980.shp"

rm -rf "$TMP"
echo "== ok =="
ls -la "$OUT"
