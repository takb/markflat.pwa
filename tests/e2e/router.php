<?php

// The browser tests' router for PHP's built-in server: /api/… goes to the API (as on the
// host, where api/.htaccess sends it to api/index.php); everything else is the build.
$path = (string) parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
if (str_starts_with($path, '/api/')) {
    $_SERVER['SCRIPT_NAME'] = '/api/index.php';
    require __DIR__.'/../../api/public/index.php';

    return true;
}

return false;
