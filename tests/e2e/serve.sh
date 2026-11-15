#!/bin/sh
# The browser tests' server: the production build (dist/, made by `pnpm build`) and the API
# (api/, with its Composer install) under PHP's built-in server, in a fresh folder with two songs
# and test keys: e2e-read (reads), e2e-writer (writes), e2e-admin (writes, manages keys).
set -e
cd "$(dirname "$0")/../.."
[ -f dist/index.html ] || { echo "dist/ is missing: run pnpm build first" >&2; exit 1; }
[ -f api/vendor/autoload.php ] || { echo "api/vendor is missing: run composer install in api/" >&2; exit 1; }
site=node_modules/.tmp/e2e-site
rm -rf "$site"
mkdir -p "$site/data"
cp -r dist/. "$site/"
php -r 'echo "<?php return ", var_export([
  "data_dir" => getcwd()."/'"$site"'/data",
  "api" => [
    "read_key" => hash("sha256", "e2e-read"),
    "write_keys" => ["writer" => hash("sha256", "e2e-writer"), "admin" => hash("sha256", "e2e-admin")],
    "admin" => "admin",
  ],
], true), ";\n";' > "$site/config.php"
cp yesterday.mb "$site/data/"
printf '# Zeta Song - Tester\n1. {a}Hello {G}world {C}again\n' > "$site/data/zeta_song.mb"
export MARKFLAT_CONFIG="$PWD/$site/config.php"
exec php -S 127.0.0.1:4173 -t "$site" tests/e2e/router.php
