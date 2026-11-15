<?php

declare(strict_types=1);

// Makes a new API key. Usage: php api/bin/new-key.php <writer name>   (or "read")
// Prints the key (hand it to its owner; it is shown only here) and what goes into the secret:
// the read key's hash for MARKFLAT_READ_KEY_SHA256, or a "name hash" line for MARKFLAT_WRITE_KEYS.

$name = $argv[1] ?? '';
if (!preg_match('/^[a-z0-9_-]{1,40}$/', $name)) {
    fwrite(STDERR, "Usage: php api/bin/new-key.php <name>  (a-z, 0-9, _ and -; \"read\" for the read key)\n");
    exit(1);
}
$key = rtrim(strtr(base64_encode(random_bytes(24)), '+/', '-_'), '=');
$hash = hash('sha256', $key);
echo "key:    $key\n";
echo $name === 'read'
    ? "secret: MARKFLAT_READ_KEY_SHA256 = $hash\n"
    : "secret: add this line to MARKFLAT_WRITE_KEYS:\n        $name $hash\n";
