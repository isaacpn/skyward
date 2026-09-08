#!/usr/bin/env bash
# Produces dist/skyward.html: the same game as index.html, but as body-level
# markup for hosts that supply their own <!doctype>/<head>/<body> wrapper
# (Claude Artifacts). Levels are always the baked-in copy, since a published
# page has no levels/ directory beside it.
set -e
cd "$(dirname "$0")/.."

bash tools/build.sh > /dev/null
mkdir -p dist

grep -v -E '^<!doctype html>|^<html lang="en">|^<head>|^</head>|^<body>|^</body>|^</html>|^<meta ' index.html \
  | sed 's/^const EMBEDDED_ONLY = false;$/const EMBEDDED_ONLY = true;/' \
  > dist/skyward.html

echo "built dist/skyward.html ($(wc -c < dist/skyward.html) bytes)"
