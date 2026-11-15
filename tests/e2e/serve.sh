#!/bin/sh
# The browser tests' server: the production build (dist/, made by `pnpm build`) with
# songbook.php under PHP's built-in server, in a fresh folder with two songs and test keys.
set -e
cd "$(dirname "$0")/../.."
[ -f dist/index.html ] || { echo "dist/ is missing: run pnpm build first" >&2; exit 1; }
site=node_modules/.tmp/e2e-site
rm -rf "$site"
mkdir -p "$site/data"
cp -r dist/. "$site/"
cp songbook.php "$site/"
php -r 'echo "<?php return ", var_export([
  "data_dir" => getcwd()."/'"$site"'/data",
  "read_key_hash" => password_hash("e2e-read", PASSWORD_DEFAULT),
  "write_key_hash" => password_hash("e2e-write", PASSWORD_DEFAULT),
], true), ";\n";' > "$site/config.php"
cp yesterday.mb "$site/data/"
printf '# Zeta Song - Tester\n1. {a}Hello {G}world {C}again\n' > "$site/data/zeta_song.mb"
exec php -S 127.0.0.1:4173 -t "$site"
