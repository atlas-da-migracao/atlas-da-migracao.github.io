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
# - CORREÇÃO F9.6 (pós-decisão do metodologo, pipeline/sql/1980/MAPEAMENTO_02_classify.md
#   §3-§4): a malha bruta do IBGE tem 3.991 feições, mas pipeline/labels_1980.MUNICIPIOS_1980
#   (a lista já corrigida para bater com o extrato tabular) tem só 3.939. A diferença de 52 é
#   coberta pelos dois ajustes abaixo, que deixam a malha e municipios_ref.parquet 1:1:
#
#   1. Fernando de Noronha: a Base dos Dados não geocodifica os 298 registros de residentes
#      de Fernando de Noronha em 1980 (sigla_uf='FN', id_municipio NULL); a decisão foi
#      publicá-los sob '2605459' (Fernando de Noronha/PE, código de 2022), atribuído por
#      sigla_uf no lado tabular (01_extract.sql). Remapeado aqui: CD_MUN '2000107' -> '2605459'
#      (única feição com prefixo "20" na malha -- confirmado por contagem). SIGLA_UF sai 'PE'
#      de graça no bloco de UF_POR_COD abaixo, já que o remap roda antes dele (prefixo "26").
#
#   2. 52 municípios do norte de Goiás (hoje Tocantins): a Base dos Dados não traz
#      id_municipio para 178.338 registros de sigla_uf='GO' -- são exatamente os municípios
#      cujo código de 1980 (prefixo "52") não tem par em id_municipio. Os 52 códigos abaixo
#      são o conjunto exato presente na malha e ausente de MUNICIPIOS_1980 (conferido por
#      diferença de conjuntos entre ST_Read da malha bruta e pipeline.labels_1980.
#      MUNICIPIOS_1980; nenhum outro código de prefixo "52" falta).
#
#      ATÉ 1.0.1-1980 eles eram REMOVIDOS aqui (-filter), porque a edição não publicava o
#      território como unidade: o Tocantins era um buraco branco na malha de 1980.
#      DESDE 1.0.2-1980 eles são DISSOLVIDOS numa feição só, com o código sintético
#      'NORTEGO' -- a unidade agregada que a edição passou a publicar (população, imigração,
#      emigração, saldo, pendular e painel próprios; ver pipeline/unidades_agregadas_1980.py
#      e pipeline/sql/1980/MAPEAMENTO_norte_goias.md). Quem não distingue os 52 municípios é
#      a FONTE TABULAR, não a malha: o polígono dissolvido é a fronteira externa exata dos 52,
#      sem aproximação nenhuma.
#
#      Como o dissolve é feito: as 52 feições vão para uma camada própria (-filter + name=),
#      onde -dissolve2 (união topológica de verdade, que resolve as fronteiras internas) as
#      funde; as outras 3.939 seguem na camada `base` SEM PASSAR POR NENHUMA OPERAÇÃO DE
#      GEOMETRIA, e só no fim as duas camadas são unidas (-merge-layers). É de propósito:
#      -dissolve2 aplicado à malha inteira teria de reprocessar 3.991 polígonos, e nesta malha
#      operações de limpeza são sabidamente destrutivas (o -clean comeu 6 municípios, ver
#      docs/qa/malha_1980.md). Assim, o risco topológico fica confinado às 52, e a fronteira
#      com Goiás, Pará, Maranhão, Bahia e Mato Grosso é a mesma de antes -- essas feições nem
#      foram tocadas.
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
# Os 52 códigos do norte de Goiás, em JS, usados nos DOIS filtros abaixo (um seleciona a
# camada a dissolver, o outro remove as mesmas feições da camada base). Uma só definição para
# não haver como as duas listas divergirem.
GO_TO_1980="['5200407','5200704','5201009','5201900','5202007','5202106','5202205','5202304',\
'5202403','5202700','5202908','5203005','5203708','5205505','5205604','5206008',\
'5206107','5207006','5207204','5207303','5207709','5208202','5209002','5209309',\
'5209507','5210505','5210703','5211107','5212402','5213202','5213301','5213608',\
'5214200','5214309','5215108','5216106','5216205','5216502','5216601','5216700',\
'5217005','5217500','5217807','5217906','5218201','5218409','5220306','5220801',\
'5220900','5221106','5221205','5222104']"

# Código, nome e UF da unidade agregada. TÊM de bater com
# pipeline/unidades_agregadas_1980.UNIDADES_AGREGADAS_1980 -- conferido por
# pipeline/tests/test_edicao_1980.py (malha x municipios_ref 1:1).
NORTEGO_CD=NORTEGO
NORTEGO_NM="Norte de Goiás (atual Tocantins)"
NORTEGO_UF=TO

npx --yes mapshaper -i "$SHP" -rename-layers base \
    -each "CD_MUN = String(codigo)" \
    -rename-fields NM_MUN=nome \
    -each "
      // Fernando de Noronha: '2000107' (Território Federal, código que não existe no sistema
      // atual) -> '2605459' (Fernando de Noronha/PE, código de 2022). Ver nota acima.
      if (CD_MUN == '2000107') CD_MUN = '2605459';
    " \
    -filter "$GO_TO_1980.indexOf(CD_MUN) > -1" + name=nortego \
    -dissolve2 target=nortego \
    -each "CD_MUN = '$NORTEGO_CD'; NM_MUN = '$NORTEGO_NM'; SIGLA_UF = '$NORTEGO_UF'" target=nortego \
    -filter "$GO_TO_1980.indexOf(CD_MUN) === -1" target=base \
    -each "
      var UF_POR_COD = {
        '11':'RO','12':'AC','13':'AM','14':'RR','15':'PA','16':'AP',
        '21':'MA','22':'PI','23':'CE','24':'RN','25':'PB','26':'PE','27':'AL','28':'SE','29':'BA',
        '31':'MG','32':'ES','33':'RJ','35':'SP',
        '41':'PR','42':'SC','43':'RS',
        '50':'MS','51':'MT','52':'GO','53':'DF'
      };
      SIGLA_UF = UF_POR_COD[CD_MUN.slice(0,2)]
    " target=base \
    -merge-layers target=base,nortego force name=municipios \
    -filter-fields CD_MUN,NM_MUN,SIGLA_UF \
    -proj EPSG:4674 \
    -o format=shapefile encoding=utf8 "$OUT/BR_Municipios_1980.shp"

rm -rf "$TMP"
echo "== ok =="
ls -la "$OUT"
