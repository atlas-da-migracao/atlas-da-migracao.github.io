#!/bin/sh
# Copia data/processed -> web/public/data (todas as edições publicadas, ex.: raiz = 2022,
# data/processed/2010/ = 2010). Recusa se o gate de revelação de QUALQUER edição publicada
# não tiver passado.
set -e
cd "$(dirname "$0")/../.."
if [ ! -f data/processed/.gate_ok ]; then
  echo "ERRO: data/processed/.gate_ok ausente. Rode 'python pipeline/disclosure_check.py' antes." >&2
  exit 1
fi
for gate in data/processed/*/.gate_ok; do
  [ -e "$gate" ] || continue  # glob sem match, se não houver outra edição publicada ainda
  echo "edição adicional detectada: $(dirname "$gate")"
done
rm -rf web/public/data
mkdir -p web/public/data
cp -R data/processed/. web/public/data/
find web/public/data -name .gate_ok -delete
echo "Dados sincronizados ($(du -sh web/public/data | cut -f1)):"
ls web/public/data
