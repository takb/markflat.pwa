<?php

declare(strict_types=1);

namespace Markflat\Api;

/**
 * Keys are long random strings (bin/new-key.php), so a plain SHA-256 of each is stored and
 * compared in constant time: a slow password hash adds nothing for them and would make every
 * request pay once per writer.
 */
final readonly class Auth
{
    /** @param array<string, string> $writeKeys writer name => SHA-256 hex of the key */
    public function __construct(private string $readKey, private array $writeKeys)
    {
    }

    public static function hash(string $key): string
    {
        return hash('sha256', $key);
    }

    public function identify(string $key): ?Identity
    {
        if ($key === '') {
            return null;
        }
        $hash = self::hash($key);
        $found = null;
        // Check every entry, so the time taken does not tell which one matched.
        foreach ($this->writeKeys as $name => $expected) {
            if (hash_equals(strtolower($expected), $hash)) {
                $found = new Identity((string) $name);
            }
        }
        if ($this->readKey !== '' && hash_equals(strtolower($this->readKey), $hash)) {
            $found ??= new Identity(null);
        }

        return $found;
    }
}
