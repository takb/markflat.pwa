<?php

declare(strict_types=1);

// The API's front controller. On the server: <webroot>/api/index.php, with the code in
// api/lib/ (denied to the web) and config.php in the webroot (see .github/workflows/deploy.yml).

use Markflat\Api\Api;
use Markflat\Api\Config;
use Markflat\Api\Http\Request;

$lib = is_dir(__DIR__.'/lib') ? __DIR__.'/lib' : dirname(__DIR__);
require $lib.'/vendor/autoload.php';

$configFile = getenv('MARKFLAT_CONFIG') ?: dirname(__DIR__).'/config.php';
$base = rtrim(dirname(is_string($_SERVER['SCRIPT_NAME'] ?? null) ? $_SERVER['SCRIPT_NAME'] : '/'), '/');

Api::fromConfig(Config::load($configFile))->handle(Request::fromGlobals($base))->send();
