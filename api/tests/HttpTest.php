<?php

declare(strict_types=1);

namespace Markflat\Api\Tests;

use Markflat\Api\Auth;
use PHPUnit\Framework\TestCase;

/** The front controller under PHP's built-in server: real headers, real $_SERVER. */
final class HttpTest extends TestCase
{
    use TempDir {
        setUp as makeDir;
        tearDown as removeDir;
    }

    /** @var resource */
    private $server;
    private int $port;

    protected function setUp(): void
    {
        $this->makeDir();
        mkdir($this->dir.'/data');
        file_put_contents($this->dir.'/config.php', '<?php return '.var_export([
            'data_dir' => $this->dir.'/data',
            'api' => ['read_key' => Auth::hash('read'), 'write_keys' => ['kim' => Auth::hash('kim-key')]],
        ], true).';');
        $this->port = random_int(20000, 40000);
        $public = dirname(__DIR__).'/public';
        $server = proc_open(
            [PHP_BINARY, '-S', '127.0.0.1:'.$this->port, '-t', $public, $public.'/index.php'],
            [1 => ['file', '/dev/null', 'w'], 2 => ['file', '/dev/null', 'w']],
            $pipes,
            null,
            ['MARKFLAT_CONFIG' => $this->dir.'/config.php'] + getenv(),
        );
        self::assertIsResource($server);
        $this->server = $server;
        for ($i = 0; $i < 50 && !@fsockopen('127.0.0.1', $this->port); ++$i) {
            usleep(50_000);
        }
    }

    protected function tearDown(): void
    {
        proc_terminate($this->server);
        proc_close($this->server);
        $this->removeDir();
    }

    /**
     * @param list<string> $headers
     *
     * @return array{int, array<string, string>, mixed}
     */
    private function request(string $method, string $path, array $headers = [], string $body = ''): array
    {
        $context = stream_context_create(['http' => [
            'method' => $method, 'header' => $headers, 'content' => $body, 'ignore_errors' => true,
        ]]);
        $reply = file_get_contents('http://127.0.0.1:'.$this->port.$path, false, $context);
        $responseHeaders = [];
        $status = 0;
        foreach (http_get_last_response_headers() ?? [] as $line) {
            if (preg_match('#^HTTP/\S+ (\d+)#', $line, $m)) {
                $status = (int) $m[1];
            } elseif (str_contains($line, ':')) {
                [$k, $v] = explode(':', $line, 2);
                $responseHeaders[strtolower($k)] = trim($v);
            }
        }

        return [$status, $responseHeaders, json_decode((string) $reply, true)];
    }

    public function testRoundTripOverHttp(): void
    {
        [$status] = $this->request('GET', '/songs');
        self::assertSame(401, $status);

        [$status, $headers] = $this->request('PUT', '/songs/yesterday', ['X-Api-Key: kim-key', 'Content-Type: application/json'], (string) json_encode(['content' => '# Yesterday - The Beatles']));
        self::assertSame(201, $status);
        self::assertSame('no-store', $headers['cache-control']);
        self::assertArrayNotHasKey('access-control-allow-origin', $headers);

        [$status, , $data] = $this->request('GET', '/songs', ['X-Api-Key: read']);
        self::assertSame(200, $status);
        self::assertIsArray($data);
        self::assertSame('The Beatles', $data['songs'][0]['artist']);

        // Without URL rewriting the script name is part of the path.
        [$status, , $me] = $this->request('GET', '/index.php/me', ['X-Api-Key: read']);
        self::assertSame([200, ['writer' => null, 'canWrite' => false]], [$status, $me]);

        [$status] = $this->request('PUT', '/songs/yesterday', ['X-Api-Key: kim-key', 'Content-Type: application/json', 'If-Match: '.$headers['etag']], (string) json_encode(['content' => '# Yesterday - v2']));
        self::assertSame(200, $status);
    }
}
