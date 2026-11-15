<?php

declare(strict_types=1);

namespace Markflat\Api\Http;

final readonly class Response
{
    /** @param array<string, string> $headers */
    public function __construct(
        public int $status,
        public string $body = '',
        public array $headers = [],
    ) {
    }

    /** @param array<string, string> $headers */
    public static function json(mixed $data, int $status = 200, array $headers = []): self
    {
        return new self(
            $status,
            json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
            ['Content-Type' => 'application/json; charset=utf-8'] + $headers,
        );
    }

    public static function error(HttpError $e): self
    {
        return self::json(['error' => $e->errorCode, 'message' => $e->getMessage()], $e->status, $e->headers);
    }

    /** Decoded JSON body (for tests and callers that need the data). */
    public function data(): mixed
    {
        return json_decode($this->body, true);
    }

    public function send(): void
    {
        http_response_code($this->status);
        header('Cache-Control: no-store');
        header('X-Content-Type-Options: nosniff');
        foreach ($this->headers as $name => $value) {
            header($name.': '.$value);
        }
        echo $this->body;
    }
}
