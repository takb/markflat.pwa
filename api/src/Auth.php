<?php

declare(strict_types=1);

namespace Markflat\Api;

/**
 * Keys are long random strings, so a plain SHA-256 of each is stored and compared in constant
 * time: a slow password hash adds nothing for them and would make every request pay once per
 * writer.
 *
 * Two sources (D14): the keys from config.php (the deploy's secrets: the bootstrap writers,
 * among them the admin, and the starting read key) and the keys made in the app (KeyStore).
 * A read key made in the app replaces config's. Only a bootstrap writer can be the admin.
 */
final readonly class Auth
{
    /** @param array<string, string> $writeKeys bootstrap writer name => SHA-256 hex of the key */
    public function __construct(
        private string $readKey,
        private array $writeKeys,
        private ?KeyStore $store = null,
        private string $admin = '',
    ) {
    }

    public static function hash(string $key): string
    {
        return hash('sha256', $key);
    }

    /** A new key: 24 random bytes, base64url (32 characters). */
    public static function newKey(): string
    {
        return rtrim(strtr(base64_encode(random_bytes(24)), '+/', '-_'), '=');
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
                $found = new Identity((string) $name, $this->admin !== '' && $name === $this->admin);
            }
        }
        foreach ($this->store?->writers() ?? [] as $name => $entry) {
            if (hash_equals(strtolower($entry['hash']), $hash) && !isset($this->writeKeys[$name])) {
                $found ??= new Identity((string) $name);
            }
        }
        $read = $this->currentReadKey();
        if ($read !== '' && hash_equals(strtolower($read), $hash)) {
            $found ??= new Identity(null);
        }

        return $found;
    }

    public function currentReadKey(): string
    {
        return $this->store?->readKey() ?? $this->readKey;
    }

    /** @return list<string> */
    public function bootstrapWriters(): array
    {
        return array_map('strval', array_keys($this->writeKeys));
    }
}
