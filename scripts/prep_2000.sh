#!/usr/bin/env bash
# Prepara os microdados do Censo 2000 que precisam de um passo prévio ao pipeline DuckDB.
#
# Só a Bahia: data/raw2000/BA/PES29.zip contém pes29.txt (~605 MB descomprimido), o único
# arquivo de PESSOAS que chega zipado (os outros 26 + DOM29.txt de domicílios são .txt
# diretos). DuckDB read_csv não lê dentro de .zip, então descompactamos uma vez para
# data/interim/2000/raw_ba/pes29.txt -- caminho que pipeline/sql/2000/01_extract.sql lê como
# o 27º arquivo de pessoas. data/interim/2000/ é gitignored (padrão data/interim/), então
# esse extrato nunca é versionado.
#
# Idempotente: pula a extração se o arquivo já existe com o tamanho esperado; chame de novo
# sem medo. Rode antes de pipeline/run.py --edicao 2000 (ver CLAUDE.md/README do agente).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ZIP="$ROOT/data/raw2000/BA/PES29.zip"
DEST_DIR="$ROOT/data/interim/2000/raw_ba"
DEST="$DEST_DIR/pes29.txt"
# Tamanho descomprimido de pes29.txt dentro do zip (conferido com `unzip -l`), usado só para
# decidir se um arquivo já extraído está completo -- não é um valor mágico arbitrário.
TAMANHO_ESPERADO=605716747

mkdir -p "$DEST_DIR"

if [[ -f "$DEST" ]]; then
    TAMANHO_ATUAL=$(stat -f%z "$DEST" 2>/dev/null || stat -c%s "$DEST" 2>/dev/null)
    if [[ "$TAMANHO_ATUAL" == "$TAMANHO_ESPERADO" ]]; then
        echo "prep_2000.sh: $DEST já existe com o tamanho esperado ($TAMANHO_ATUAL bytes); nada a fazer."
        exit 0
    fi
    echo "prep_2000.sh: $DEST existe mas com tamanho $TAMANHO_ATUAL (esperado $TAMANHO_ESPERADO); re-extraindo."
fi

echo "prep_2000.sh: extraindo pes29.txt de $ZIP para $DEST ..."
unzip -p "$ZIP" pes29.txt > "$DEST"
echo "prep_2000.sh: ok ($(stat -f%z "$DEST" 2>/dev/null || stat -c%s "$DEST" 2>/dev/null) bytes)."
