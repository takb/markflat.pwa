<?php

declare(strict_types=1);

namespace Markflat\Api\Http;

final readonly class Request
{
    /**
     * @param string                $path    below the API's base, e.g. "/songs/yesterday"
     * @param array<string, string> $headers lowercase names
     */
    public function __construct(
        public string $method,
        public string $path,
        public array $headers = [],
        public string $body = '',
        public string $clientIp = '',
    ) {
    }

    public function header(string $name): ?string
    {
        return $this->headers[strtolower($name)] ?? null;
    }

    /**
     * The JSON body as an array.
     *
     * @return array<mixed>
     */
    public function json(): array
    {
        $data = json_decode($this->body, true);
        if (!is_array($data)) {
            throw new HttpError(400, 'bad_request', 'The body must be a JSON object.');
        }

        return $data;
    }

    /** Builds the request from PHP's globals; `$base` is the URL path of the API's folder. */
    public static function fromGlobals(string $base): self
    {
        $headers = [];
        foreach ($_SERVER as $key => $value) {
            if (is_string($value) && str_starts_with($key, 'HTTP_')) {
                $headers[strtolower(str_replace('_', '-', substr($key, 5)))] = $value;
            }
        }
        if (isset($_SERVER['CONTENT_TYPE']) && is_string($_SERVER['CONTENT_TYPE'])) {
            $headers['content-type'] = $_SERVER['CONTENT_TYPE'];
        }
        $uri = is_string($_SERVER['REQUEST_URI'] ?? null) ? $_SERVER['REQUEST_URI'] : '/';
        $path = (string) parse_url($uri, PHP_URL_PATH);
        // /api/songs (rewritten to index.php) or /api/index.php/songs (no rewriting)
        $script = is_string($_SERVER['SCRIPT_NAME'] ?? null) ? $_SERVER['SCRIPT_NAME'] : '';
        $base = rtrim($base, '/');
        if ($script !== '' && str_starts_with($path, $script.'/')) {
            $path = substr($path, strlen($script));
        } elseif ($base !== '' && str_starts_with($path, $base.'/')) {
            $path = substr($path, strlen($base));
        }

        return new self(
            is_string($_SERVER['REQUEST_METHOD'] ?? null) ? strtoupper($_SERVER['REQUEST_METHOD']) : 'GET',
            '/'.ltrim($path, '/'),
            $headers,
            (string) file_get_contents('php://input'),
            is_string($_SERVER['REMOTE_ADDR'] ?? null) ? $_SERVER['REMOTE_ADDR'] : '',
        );
    }
}
