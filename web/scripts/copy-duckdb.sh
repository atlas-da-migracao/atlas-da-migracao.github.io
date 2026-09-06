#!/bin/sh
# Copia o runtime do DuckDB-WASM para public/duckdb (servido como arquivo estático).
# Mantém o binário fora do grafo do empacotador: o worker resolve o .wasm contra a
# própria base, e URLs absolutas same-origin evitam o problema de origem opaca.
set -e
cd "$(dirname "$0")/.."
mkdir -p public/duckdb
for f in duckdb-eh.wasm duckdb-browser-eh.worker.js; do
  cp "node_modules/@duckdb/duckdb-wasm/dist/$f" public/duckdb/
done
echo "runtime do DuckDB copiado para public/duckdb"
