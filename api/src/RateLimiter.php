<?php

declare(strict_types=1);

namespace Markflat\Api;

/** Counts failed key checks per client in small files; too many in the window locks it out. */
final readonly class RateLimiter
{
    public function __construct(
        private string $dir,
        private int $maxFailures = 10,
        private int $windowSeconds = 600,
    ) {
    }

    /** Seconds until the client may try again, or 0 if it may now. */
    public function retryAfter(string $client, int $now): int
    {
        $failures = $this->recent($client, $now);
        if (count($failures) < $this->maxFailures) {
            return 0;
        }

        return max(1, $failures[0] + $this->windowSeconds - $now);
    }

    public function fail(string $client, int $now): void
    {
        if (!is_dir($this->dir)) {
            @mkdir($this->dir, 0700, true);
        }
        $failures = $this->recent($client, $now);
        $failures[] = $now;
        file_put_contents($this->file($client), json_encode(array_slice($failures, -$this->maxFailures)), LOCK_EX);
    }

    /** @return list<int> failure times inside the window, oldest first */
    private function recent(string $client, int $now): array
    {
        $raw = @file_get_contents($this->file($client));
        $times = $raw === false ? [] : json_decode($raw, true);
        if (!is_array($times)) {
            return [];
        }

        return array_values(array_filter($times, fn ($t) => is_int($t) && $t > $now - $this->windowSeconds));
    }

    private function file(string $client): string
    {
        return $this->dir.'/'.hash('sha256', $client).'.json';
    }
}
