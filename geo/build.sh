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
# verificados por pipeline/tests/test_f3_geo.py, e a validade de cada polígono (OGC +
# triangulação earcut) por pipeline/validate_geo.py (rode depois deste script).
#
# F9.10 (correção): -simplify seguido de -clean NA MESMA invocação do mapshaper desfaz a
# simplificação (a simplificação é "lazy", só se materializa quando o resultado é escrito) --
# por isso cada produto abaixo roda em DUAS invocações: (1) filtra/junta/dissolve/simplifica e
# grava um GeoJSON intermediário; (2) lê esse intermediário, roda -clean (repara os anéis com
# autointerseção que a simplificação deixa para trás) e, se ainda sobrar alguma feição
# inválida (ST_IsValid) ou mal triangulada (earcut), aplica um reparo dirigido só nela antes
# de gravar o TopoJSON final quantizado -- ver a função `limpa_e_publica` abaixo e
# docs/METODOLOGIA.md para o diagnóstico (anéis com autointerseção faziam o earcut do deck.gl
# gerar triângulos espúrios ou omitir o preenchimento).
#
# F10 (projeção Albers): cada produto gera DOIS arquivos -- o de sempre, em graus (WGS84/
# SIRGAS2000, inalterado) e um paralelo `*_albers.topojson`, em metros, na cônica equivalente
# de Albers (ver docs/METODOLOGIA.md, "Cartografia: projeção cônica equivalente de Albers
# (F10)"). A reprojeção (`-proj`) entra logo depois do -filter/-join/-dissolve e ANTES do
# -simplify -- simplificar em metros pondera o erro igual em todo o país, em vez de
# implicitamente por latitude como simplificar em graus. A quantização usada é A MESMA do
# arquivo em graus (1e5/1e5/1e5/1e5): testado com a malha de municípios 2022, quant=1e5 em
# metros dá um arquivo do mesmo tamanho (1,97 MB) e a mesma ordem de grandeza de resolução
# (bbox ~4740 km x 4289 km / 1e5 ~ 47 m, contra ~5100 km / 1e5 ~ 51 m no arquivo em graus) e
# deixa só 1 feição para o reparo dirigido (o mesmo mecanismo já usado para o arquivo em
# graus). quant=1e6 (mais fino) passa do orçamento de 2 MB sem reduzir inválidos o bastante
# para justificar; manter 1e5.
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
# mas o filtro os cobre de graça caso apareçam em malhas futuras. CD_MUN="0" é um artefato de
# geo/fetch_2000.sh: -clean preenche gaps de topologia com um polígono sem geocódigo (herda
# "0" do DBF), visto na malha 2000 como uma feição degenerada (~1,8e-8 grau² de área, perto da
# Baía de Guanabara/RJ) sem correspondência em municipios_ref.parquet -- inofensivo incluir o
# filtro nas demais edições, já que "0" nunca aparece nelas.
FILTRO='CD_MUN != "8888888" && CD_MUN != "9999999" && CD_MUN != "4300001" && CD_MUN != "4300002" && CD_MUN != "0"'
# Cônica equivalente de Albers, parâmetros fixados em docs/METODOLOGIA.md (F10) -- os mesmos
# para as 5 edições e os 4 produtos, inclusive NORTEGO (1980).
PROJ4="+proj=aea +lat_1=-2 +lat_2=-22 +lat_0=-12 +lon_0=-54 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs"
OUT="$PROCESSED/geo"
mkdir -p "$OUT"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT


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

# $1 = caminho do TopoJSON final; $2 = quantization; $3 = campo de id (CD_MUN/cd_uf/cd_rgi/
# cd_rgint), usado pela validação/reparo dirigido. Lê o GeoJSON intermediário de $STAGE1
# (setado por cada bloco de produto antes de chamar esta função).
#
# Ordem de correção (ver docstring no topo do arquivo e pipeline/validate_geo.py):
#   1. `-clean` do mapshaper com o snap-interval PADRÃO (automático, "tiny") -- corrige a
#      maior parte das autointerseções deixadas por -simplify sem distorcer feições pequenas.
#      Testado: um snap-interval maior (ex.: 1e-3 grau) zera os inválidos de 2022 mas em 1980
#      colapsa Maracajá/SC (feição minúscula demais) a uma geometria nula -- descartado.
#   2. Quantização (TopoJSON, grade quant^2 sobre o bbox inteiro): ARREDONDA todas as
#      coordenadas para a grade -- e pode reintroduzir autointerseção em feições que -clean já
#      tinha corrigido em precisão total (achado testando 2022: 0 inválidos antes da
#      quantização, 4 depois). Por isso a checagem roda DEPOIS deste passo, no TopoJSON final,
#      não no GeoJSON intermediário.
#   3. Um segundo `-clean` (sobre o TopoJSON já quantizado, decodificado de volta para GeoJSON
#      antes de limpar e regravado na mesma grade) -- resolve a maior parte do que a
#      quantização reintroduziu (achado testando RGI 2010, código 230003: sozinho, esse
#      segundo -clean fecha a autointerseção e preserva a área a 0,3% do valor pré-
#      quantização; ST_MakeValid direto no mesmo caso, sem esse passo antes, cortava 6,6% da
#      área -- a quantização tinha fragmentado o polígono em 97 partes e o MakeValid descartava
#      fragmentos espúrios em vez de só fechar o anel). F10: o -clean tem que rodar sobre um
#      GeoJSON decodificado, não direto no arquivo TopoJSON -- testado nas malhas em metros
#      (Albers), `-clean` direto no `.topojson` quantizado derruba o mapshaper com "Invalid
#      node geometry" ao (re)construir o mosaico de polígonos (bug de precisão do mapshaper
#      com arcos de magnitude grande, reproduzido em qualquer quantization testada, de 1e5 a
#      1e6); decodificar primeiro (`-o format=geojson`) e só então `-clean` evita o bug e dá um
#      resultado pelo menos tão bom quanto (achado testando municípios 2022 em Albers: 0
#      feições ruins depois do decode-clean-reencode, contra 1 fazendo -clean direto no
#      TopoJSON com quant=1e5). Aplicado às duas malhas (graus e Albers) por uniformidade --
#      não muda o resultado da malha em graus, que já não tinha esse problema.
#   4. Reparo dirigido (`geo/repair_geojson.py`, ST_MakeValid via GEOS), só nas feições que
#      `geo/find_bad_ids.py` ainda marca como ST_IsValid=false OU com triangulação earcut ruim
#      depois do passo 3 -- fallback para o que sobrar. Reparada, a feição é requantizada
#      (mesma grade) e revalidada; não foi necessário reduzir -simplify nem redimensionar a
#      malha em nenhuma das 5 edições.
limpa_e_publica() {
  destino="$1"; quant="$2"; campo_id="$3"; stage1="${4:-$STAGE1}"
  limpo="$TMP/$(basename "$destino" .topojson)_limpo.geojson"
  npx --yes mapshaper "$stage1" -clean -o format=geojson "$limpo"
  npx --yes mapshaper "$limpo" -o format=topojson quantization="$quant" "$destino"
  pos_quant="$TMP/$(basename "$destino" .topojson)_pos_quant.geojson"
  npx --yes mapshaper "$destino" -o format=geojson "$pos_quant"
  npx --yes mapshaper "$pos_quant" -clean -o format=topojson quantization="$quant" "$destino"

  tentativa=0
  while [ "$tentativa" -lt 3 ]; do
    decodificado="$TMP/$(basename "$destino" .topojson)_decodificado_$tentativa.geojson"
    node geo/decode_topojson.mjs "$destino" "$decodificado"
    ruins=$(.venv/bin/python geo/find_bad_ids.py "$decodificado" "$campo_id")
    [ -z "$ruins" ] && break
    echo "  reparo dirigido ($campo_id, tentativa $tentativa): $ruins"
    reparado="$TMP/$(basename "$destino" .topojson)_reparado_$tentativa.geojson"
    .venv/bin/python geo/repair_geojson.py "$decodificado" "$reparado" --ids "$ruins" --campo-id "$campo_id"
    npx --yes mapshaper "$reparado" -o format=topojson quantization="$quant" "$destino"
    tentativa=$((tentativa + 1))
  done
  if [ -n "$ruins" ]; then
    echo "ERRO: $destino ainda tem feição(ões) inválida(s) depois de $tentativa tentativas de reparo: $ruins" >&2
    exit 1
  fi
}

echo "== municípios (simplificado, mantendo topologia) =="
STAGE1="$TMP/municipios.geojson"
npx --yes mapshaper "$RAW" \
    -filter "$FILTRO" \
    -simplify 1% keep-shapes \
    -filter-fields CD_MUN,NM_MUN,SIGLA_UF \
    -o format=geojson "$STAGE1"
limpa_e_publica "$OUT/municipios.topojson" 1e5 CD_MUN

echo "== municípios, projeção Albers (metros) =="
STAGE1_ALBERS="$TMP/municipios_albers.geojson"
npx --yes mapshaper "$RAW" \
    -filter "$FILTRO" \
    -proj "$PROJ4" \
    -simplify 1% keep-shapes \
    -filter-fields CD_MUN,NM_MUN,SIGLA_UF \
    -o format=geojson "$STAGE1_ALBERS"
limpa_e_publica "$OUT/municipios_albers.topojson" 1e5 CD_MUN "$STAGE1_ALBERS"

echo "== limites de UF (dissolvidos a partir dos municípios; id = código numérico de 2 dígitos," \
     "consistente com fluxos_uf/municipios.uf -- uf_sigla vai junto só para exibição) =="
STAGE1="$TMP/uf.geojson"
npx --yes mapshaper "$RAW" \
    -filter "$FILTRO" \
    -join "$OUT/recortes.json" keys=CD_MUN,cd_mun \
    -dissolve cd_uf copy-fields=uf_sigla \
    -simplify 5% keep-shapes \
    -filter-fields cd_uf,uf_sigla \
    -o format=geojson "$STAGE1"
limpa_e_publica "$OUT/uf.topojson" 1e5 cd_uf

echo "== limites de UF, projeção Albers (metros) =="
STAGE1_ALBERS="$TMP/uf_albers.geojson"
npx --yes mapshaper "$RAW" \
    -filter "$FILTRO" \
    -join "$OUT/recortes.json" keys=CD_MUN,cd_mun \
    -dissolve cd_uf copy-fields=uf_sigla \
    -proj "$PROJ4" \
    -simplify 5% keep-shapes \
    -filter-fields cd_uf,uf_sigla \
    -o format=geojson "$STAGE1_ALBERS"
limpa_e_publica "$OUT/uf_albers.topojson" 1e5 cd_uf "$STAGE1_ALBERS"

echo "== regiões imediatas (RGI, dissolvidas a partir dos municípios) =="
# `cd_rgi != null`: uma UNIDADE AGREGADA (hoje só 'NORTEGO', o norte de Goiás em 1980 --
# ver pipeline/unidades_agregadas_1980.py) cobre 11 RGIs e 3 RGInts de 2022 e não é de
# nenhuma, então sai de municipios_ref com cd_rgi/cd_rgint NULL. Sem este filtro, -dissolve
# criaria uma 490ª "RGI" sem código com a forma do território -- uma unidade fantasma no
# seletor e no mapa. O filtro é inofensivo nas demais edições (onde nenhum município fica sem
# recorte) e a mesma regra vale do lado do dado: queries.ts filtra `IS NOT NULL` ao montar a
# lista de unidades de RGI/RGInt. UF NÃO leva filtro: a unidade agregada TEM UF publicada.
STAGE1="$TMP/rgi.geojson"
npx --yes mapshaper "$RAW" \
    -filter "$FILTRO" \
    -join "$OUT/recortes.json" keys=CD_MUN,cd_mun \
    -filter "cd_rgi != null" \
    -dissolve cd_rgi copy-fields=nm_rgi,cd_uf,uf_sigla \
    -simplify 1.5% keep-shapes \
    -filter-fields cd_rgi,nm_rgi,cd_uf,uf_sigla \
    -o format=geojson "$STAGE1"
limpa_e_publica "$OUT/rgi.topojson" 1e5 cd_rgi

echo "== regiões imediatas, projeção Albers (metros) =="
STAGE1_ALBERS="$TMP/rgi_albers.geojson"
npx --yes mapshaper "$RAW" \
    -filter "$FILTRO" \
    -join "$OUT/recortes.json" keys=CD_MUN,cd_mun \
    -filter "cd_rgi != null" \
    -dissolve cd_rgi copy-fields=nm_rgi,cd_uf,uf_sigla \
    -proj "$PROJ4" \
    -simplify 1.5% keep-shapes \
    -filter-fields cd_rgi,nm_rgi,cd_uf,uf_sigla \
    -o format=geojson "$STAGE1_ALBERS"
limpa_e_publica "$OUT/rgi_albers.topojson" 1e5 cd_rgi "$STAGE1_ALBERS"

echo "== regiões intermediárias (RGInt, dissolvidas a partir dos municípios) =="
STAGE1="$TMP/rgint.geojson"
npx --yes mapshaper "$RAW" \
    -filter "$FILTRO" \
    -join "$OUT/recortes.json" keys=CD_MUN,cd_mun \
    -filter "cd_rgint != null" \
    -dissolve cd_rgint copy-fields=nm_rgint,cd_uf,uf_sigla \
    -simplify 1.5% keep-shapes \
    -filter-fields cd_rgint,nm_rgint,cd_uf,uf_sigla \
    -o format=geojson "$STAGE1"
limpa_e_publica "$OUT/rgint.topojson" 1e5 cd_rgint

echo "== regiões intermediárias, projeção Albers (metros) =="
STAGE1_ALBERS="$TMP/rgint_albers.geojson"
npx --yes mapshaper "$RAW" \
    -filter "$FILTRO" \
    -join "$OUT/recortes.json" keys=CD_MUN,cd_mun \
    -filter "cd_rgint != null" \
    -dissolve cd_rgint copy-fields=nm_rgint,cd_uf,uf_sigla \
    -proj "$PROJ4" \
    -simplify 1.5% keep-shapes \
    -filter-fields cd_rgint,nm_rgint,cd_uf,uf_sigla \
    -o format=geojson "$STAGE1_ALBERS"
limpa_e_publica "$OUT/rgint_albers.topojson" 1e5 cd_rgint "$STAGE1_ALBERS"

echo "== validando (OGC + triangulação earcut) =="
.venv/bin/python pipeline/validate_geo.py --edicao "$EDICAO"

echo "== ok =="
ls -la "$OUT"
