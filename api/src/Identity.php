<?php

declare(strict_types=1);

namespace Markflat\Api;

/** Who a key belongs to: a named writer (maybe the admin), or a reader (the shared read key). */
final readonly class Identity
{
    public function __construct(public ?string $writer, public bool $isAdmin = false)
    {
    }

    public function canWrite(): bool
    {
        return $this->writer !== null;
    }
}
