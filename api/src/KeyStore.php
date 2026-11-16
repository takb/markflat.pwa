<?php

declare(strict_types=1);

namespace Markflat\Api;

use Markflat\Api\Http\HttpError;

/**
 * The keys made in the app (decision D14, named read keys since 2026-11-15): `.keys.json` in the
 * song folder, hashes only.
 *
 *   {"keys": {"kim": {"hash", "role": "write", "created", "by"},
 *             "band": {"hash", "role": "read", "created", "by"}},
 *    "sharedRevoked": false,
 *    "lastUsed": {"kim": "2026-11-15T18:00:00Z"}}
 *
 * The keys from config.php (the deploy's secrets: the admin's write key and the shared read key)
 * are not in here; Auth combines both. `sharedRevoked` retires the shared read key for good, so
 * a redeploy with the same secret does not bring it back.
 *
 * @phpstan-type Entry array{hash: string, role: 'read'|'write', created: string, by: string}
 */
final class KeyStore
{
    public const string NAME = '/^[a-z0-9_-]{1,40}$/';
    public const array ROLES = ['read', 'write'];

    public function __construct(private readonly string $dir)
    {
    }

    /** @return array<string, Entry> */
    public function keys(): array
    {
        return $this->load()['keys'];
    }

    public function sharedRevoked(): bool
    {
        return $this->load()['sharedRevoked'];
    }

    /** @return array<string, string> key name => time of last use */
    public function lastUsed(): array
    {
        return $this->load()['lastUsed'];
    }

    /** @param 'read'|'write' $role */
    public function add(string $name, string $role, string $hash, string $by, string $now): void
    {
        $this->change(function (array &$data) use ($name, $role, $hash, $by, $now) {
            if (isset($data['keys'][$name])) {
                throw new HttpError(409, 'exists', 'A key with that name exists already.');
            }
            $data['keys'][$name] = ['hash' => $hash, 'role' => $role, 'created' => $now, 'by' => $by];
        });
    }

    public function remove(string $name): void
    {
        $this->change(function (array &$data) use ($name) {
            if (!isset($data['keys'][$name])) {
                throw new HttpError(404, 'not_found', 'No such key.');
            }
            unset($data['keys'][$name], $data['lastUsed'][$name]);
        });
    }

    public function revokeShared(): void
    {
        $this->change(function (array &$data) {
            $data['sharedRevoked'] = true;
            unset($data['lastUsed'][Auth::SHARED]);
        });
    }

    /** Records a key's use, at most once an hour (no file write on every request). */
    public function touch(string $name, \DateTimeImmutable $now): void
    {
        $last = $this->lastUsed()[$name] ?? null;
        if ($last !== null && strtotime($last) > $now->getTimestamp() - 3600) {
            return;
        }
        $this->change(function (array &$data) use ($name, $now) {
            $data['lastUsed'][$name] = $now->format('Y-m-d\TH:i:s\Z');
        });
    }

    /**
     * The file, also in its first format ({"read": …, "writers": …}): writers become write keys,
     * an app-made read key becomes the read key "shared" and retires the configured one.
     *
     * @return array{keys: array<string, Entry>, sharedRevoked: bool, lastUsed: array<string, string>}
     */
    private function load(): array
    {
        $raw = @file_get_contents($this->dir.'/.keys.json');
        $data = $raw === false ? [] : json_decode($raw, true);
        $data = is_array($data) ? $data : [];
        $keys = [];
        foreach (is_array($data['keys'] ?? null) ? $data['keys'] : [] as $name => $entry) {
            if (is_array($entry) && is_string($entry['hash'] ?? null) && in_array($entry['role'] ?? null, self::ROLES, true)) {
                $keys[(string) $name] = $this->entry($entry, $entry['role']);
            }
        }
        $revoked = ($data['sharedRevoked'] ?? false) === true;
        foreach (is_array($data['writers'] ?? null) ? $data['writers'] : [] as $name => $entry) {
            if (is_array($entry) && is_string($entry['hash'] ?? null)) {
                $keys[(string) $name] ??= $this->entry($entry, 'write');
            }
        }
        if (is_array($data['read'] ?? null) && is_string($data['read']['hash'] ?? null)) {
            $keys[Auth::SHARED] ??= $this->entry($data['read'], 'read');
            $revoked = true;
        }
        /** @var array<string, string> $lastUsed */
        $lastUsed = is_array($data['lastUsed'] ?? null) ? $data['lastUsed'] : [];

        return ['keys' => $keys, 'sharedRevoked' => $revoked, 'lastUsed' => $lastUsed];
    }

    /**
     * @param array<mixed>   $entry
     * @param 'read'|'write' $role
     *
     * @return Entry
     */
    private function entry(array $entry, string $role): array
    {
        return [
            'hash' => (string) $entry['hash'],
            'role' => $role,
            'created' => is_string($entry['created'] ?? null) ? $entry['created'] : '',
            'by' => is_string($entry['by'] ?? null) ? $entry['by'] : '',
        ];
    }

    /** @param \Closure(array<string, mixed>&): void $change */
    private function change(\Closure $change): void
    {
        $lock = @fopen($this->dir.'/.keys.lock', 'c');
        if ($lock === false || !flock($lock, LOCK_EX)) {
            throw new HttpError(500, 'lock_failed', 'The key store is busy.');
        }
        try {
            $data = $this->load();
            $change($data);
            $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
            $tmp = $this->dir.'/.tmp-keys-'.bin2hex(random_bytes(6));
            if (file_put_contents($tmp, $json) !== strlen($json) || !rename($tmp, $this->dir.'/.keys.json')) {
                @unlink($tmp);
                throw new HttpError(500, 'write_failed', 'The key store could not be saved.');
            }
        } finally {
            flock($lock, LOCK_UN);
            fclose($lock);
        }
    }
}
