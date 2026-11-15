<?php

declare(strict_types=1);

namespace Markflat\Api;

use Markflat\Api\Http\HttpError;

/**
 * The keys made in the app (decision D14): `.keys.json` in the song folder, hashes only.
 *
 *   {"read": {"hash", "created", "by"} | null,
 *    "writers": {"kim": {"hash", "created", "by"}},
 *    "lastUsed": {"kim": "2026-11-15T18:00:00Z"}}
 *
 * The keys from config.php (the deploy's secrets) are not in here; Auth combines both.
 */
final class KeyStore
{
    public const string NAME = '/^[a-z0-9_-]{1,40}$/';

    public function __construct(private readonly string $dir)
    {
    }

    public function readKey(): ?string
    {
        $read = $this->load()['read'];

        return $read === null ? null : $read['hash'];
    }

    /** @return array{created: string, by: string}|null */
    public function readKeyInfo(): ?array
    {
        $read = $this->load()['read'];

        return $read === null ? null : ['created' => $read['created'], 'by' => $read['by']];
    }

    /** @return array<string, array{hash: string, created: string, by: string}> */
    public function writers(): array
    {
        return $this->load()['writers'];
    }

    /** @return array<string, string> writer name => time of last use */
    public function lastUsed(): array
    {
        return $this->load()['lastUsed'];
    }

    public function addWriter(string $name, string $hash, string $by, string $now): void
    {
        $this->change(function (array &$data) use ($name, $hash, $by, $now) {
            if (isset($data['writers'][$name])) {
                throw new HttpError(409, 'exists', 'A writer with that name exists already.');
            }
            $data['writers'][$name] = ['hash' => $hash, 'created' => $now, 'by' => $by];
        });
    }

    public function removeWriter(string $name): void
    {
        $this->change(function (array &$data) use ($name) {
            if (!isset($data['writers'][$name])) {
                throw new HttpError(404, 'not_found', 'No such writer.');
            }
            unset($data['writers'][$name], $data['lastUsed'][$name]);
        });
    }

    public function setReadKey(string $hash, string $by, string $now): void
    {
        $this->change(function (array &$data) use ($hash, $by, $now) {
            $data['read'] = ['hash' => $hash, 'created' => $now, 'by' => $by];
        });
    }

    /** Records a writer's use, at most once an hour (no file write on every request). */
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
     * @return array{read: array{hash: string, created: string, by: string}|null,
     *               writers: array<string, array{hash: string, created: string, by: string}>,
     *               lastUsed: array<string, string>}
     */
    private function load(): array
    {
        $raw = @file_get_contents($this->dir.'/.keys.json');
        $data = $raw === false ? [] : json_decode($raw, true);
        $data = is_array($data) ? $data : [];
        /** @var array{hash: string, created: string, by: string}|null $read */
        $read = is_array($data['read'] ?? null) && is_string($data['read']['hash'] ?? null) ? $data['read'] : null;
        /** @var array<string, array{hash: string, created: string, by: string}> $writers */
        $writers = is_array($data['writers'] ?? null) ? $data['writers'] : [];
        /** @var array<string, string> $lastUsed */
        $lastUsed = is_array($data['lastUsed'] ?? null) ? $data['lastUsed'] : [];

        return ['read' => $read, 'writers' => $writers, 'lastUsed' => $lastUsed];
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
