<?php

declare(strict_types=1);

namespace Markflat\Api\Http;

/** An error that becomes a JSON reply: `{"error": code, "message": …}`. */
final class HttpError extends \RuntimeException
{
    /** @param array<string, string> $headers */
    public function __construct(
        public readonly int $status,
        public readonly string $errorCode,
        string $message,
        public readonly array $headers = [],
    ) {
        parent::__construct($message);
    }
}
