<?php

// The local API for `pnpm dev:api` (Vite's dev server proxies /api to it). Copy this file to
// config.php (gitignored) and create the data/ folder next to it; put a few .mb files in it.
// Keys for the app's settings: "dev-read" (reads), "dev-admin" (writes, manages keys).
return [
    'data_dir' => __DIR__.'/data',
    'api' => [
        'read_key' => hash('sha256', 'dev-read'),
        'write_keys' => ['dev' => hash('sha256', 'dev-admin')],
        'admin' => 'dev',
    ],
];
