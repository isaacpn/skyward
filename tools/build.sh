#!/usr/bin/env bash
# Builds index.html from src/* and bakes levels/*.json into the page so the
# game also runs when opened straight from disk (file:// blocks fetch).
set -e
cd "$(dirname "$0")/.."

TMP=".build.js"
: > "$TMP"

# concatenate the javascript sources in order
for f in src/10-core.js src/20-sprites.js src/30-game.js src/40-ui.js; do
  echo "" >> "$TMP"
  cat "$f" >> "$TMP"
done

# build the embedded level array from the JSON files listed in levels/index.json
LEVELS_JS=".build-levels.js"
{
  printf '['
  first=1
  for f in levels/[0-9]*.json; do
    [ "$first" = 1 ] || printf ','
    first=0
    cat "$f"
  done
  printf ']'
} > "$LEVELS_JS"

# splice it in where the marker sits
awk -v levfile="$LEVELS_JS" '
  /__LEVELS__/ {
    printf "const EMBEDDED_LEVELS = "
    while ((getline line < levfile) > 0) printf "%s ", line
    close(levfile)
    print ";"
    next
  }
  { print }
' "$TMP" > "$TMP.out"

cat src/shell.html "$TMP.out" src/90-tail.html > index.html
rm -f "$TMP" "$TMP.out" "$LEVELS_JS"

echo "built index.html ($(wc -c < index.html) bytes, $(ls levels/[0-9]*.json | wc -l) levels)"
