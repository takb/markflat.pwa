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
    /** The name of the read key from the server's configuration. */
    public const string SHARED = 'shared';

    /**
     * @param string                $readKey   SHA-256 hex of the shared read key ('' = none)
     * @param array<string, string> $writeKeys bootstrap writer name => SHA-256 hex of the key
     */
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
                $found = new Identity((string) $name, true, $this->admin !== '' && $name === $this->admin);
            }
        }
        foreach ($this->store?->keys() ?? [] as $name => $entry) {
            if (hash_equals(strtolower($entry['hash']), $hash) && !isset($this->writeKeys[$name])) {
                $found ??= new Identity((string) $name, $entry['role'] === 'write');
            }
        }
        if ($this->sharedActive() && hash_equals(strtolower($this->readKey), $hash)) {
            $found ??= new Identity(self::SHARED, false);
        }

        return $found;
    }

    /** Whether the configured read key still works (not revoked, no app-made key took its name). */
    public function sharedActive(): bool
    {
        return $this->readKey !== ''
            && !($this->store?->sharedRevoked() ?? false)
            && !isset($this->store?->keys()[self::SHARED]);
    }

    /** @return list<string> */
    public function bootstrapWriters(): array
    {
        return array_map('strval', array_keys($this->writeKeys));
    }
}
