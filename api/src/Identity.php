<?php

declare(strict_types=1);

namespace Markflat\Api;

/** Who a key belongs to: its name, whether it may write, whether it is the admin's. */
final readonly class Identity
{
    /** The name to record a change under; null for a key that only reads. */
    public ?string $writer;

    public function __construct(public string $name, public bool $canWrite, public bool $isAdmin = false)
    {
        $this->writer = $canWrite ? $name : null;
    }
}
