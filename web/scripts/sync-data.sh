#!/bin/sh
# Copia data/processed -> web/public/data. Recusa se o gate de revelação não tiver passado.
set -e
cd "$(dirname "$0")/../.."
if [ ! -f data/processed/.gate_ok ]; then
  echo "ERRO: data/processed/.gate_ok ausente. Rode 'python pipeline/disclosure_check.py' antes." >&2
  exit 1
fi
rm -rf web/public/data
mkdir -p web/public/data
cp -R data/processed/. web/public/data/
rm -f web/public/data/.gate_ok
echo "Dados sincronizados ($(du -sh web/public/data | cut -f1)):"
ls web/public/data
