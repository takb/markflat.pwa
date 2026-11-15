<?php
// TEMPORARY diagnostic (2026-11-15): why PHP cannot use the song folder. Behind the site's
// password like everything else; delete it once the folder works (the next deploy removes it).
header('Content-Type: application/json');
$config = @is_file(__DIR__.'/config.php') ? require __DIR__.'/config.php' : [];
$dir = $config['data_dir'] ?? null;
$check = function ($p) {
    if ($p === null) return null;
    $r = ['path' => $p];
    foreach (['file_exists', 'is_dir', 'is_readable', 'is_writable'] as $f) $r[$f] = @$f($p);
    $r['realpath'] = @realpath($p);
    $r['perms'] = @file_exists($p) ? substr(sprintf('%o', @fileperms($p)), -4) : null;
    $r['owner_uid'] = @file_exists($p) ? @fileowner($p) : null;
    error_clear_last();
    $h = @opendir($p);
    $r['opendir'] = $h ? 'ok' : (error_get_last()['message'] ?? 'failed');
    if ($h) closedir($h);
    return $r;
};
echo json_encode([
    'php' => PHP_VERSION,
    'sapi' => PHP_SAPI,
    'open_basedir' => ini_get('open_basedir'),
    'script_dir' => __DIR__,
    'process_uid' => function_exists('posix_geteuid') ? posix_geteuid() : null,
    'script_owner_uid' => getmyuid(),
    'current_user' => get_current_user(),
    'sys_temp_dir' => sys_get_temp_dir(),
    'data_dir' => $check($dir),
    'data_dir_parent' => $check($dir ? dirname($dir) : null),
    // What PHP sees above its webroot: directory names only, no file contents.
    'visible' => (function () {
        $out = [];
        $p = __DIR__;
        for ($i = 0; $i < 6 && $p !== '/'; $i++) {
            $p = dirname($p);
            $e = @scandir($p);
            $out[$p] = $e === false ? 'unreadable'
                : array_values(array_filter($e, fn ($n) => $n !== '.' && $n !== '..' && @is_dir("$p/$n")));
        }
        $out['home'] = getenv('HOME') ?: null;
        return $out;
    })(),
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
