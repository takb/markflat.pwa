<?php

declare(strict_types=1);

namespace Markflat\Api\Tests;

use Markflat\Api\Api;
use Markflat\Api\Auth;
use Markflat\Api\Http\Request;
use Markflat\Api\Http\Response;
use Markflat\Api\RateLimiter;
use Markflat\Api\SongRepository;
use PHPUnit\Framework\TestCase;

final class ApiTest extends TestCase
{
    use TempDir;

    private Api $api;
    private int $now = 1_800_000_000;

    protected function setUp(): void
    {
        $this->dir = sys_get_temp_dir().'/markflat-api-'.bin2hex(random_bytes(6));
        mkdir($this->dir);
        $this->api = new Api(
            new SongRepository($this->dir),
            new Auth(Auth::hash('read'), ['kim' => Auth::hash('kim-key')]),
            new RateLimiter($this->dir.'/.ratelimit'),
            fn () => $this->now,
        );
    }

    /** @param array<string, string> $headers */
    private function call(string $method, string $path, ?string $key = 'kim-key', mixed $json = null, array $headers = []): Response
    {
        $headers = array_change_key_case($headers) + ($key === null ? [] : ['x-api-key' => $key]);

        return $this->api->handle(new Request($method, $path, $headers, $json === null ? '' : (string) json_encode($json), '203.0.113.7'));
    }

    public function testAKeyIsNeededAndTheReadKeyOnlyReads(): void
    {
        self::assertSame(401, $this->call('GET', '/songs', null)->status);
        self::assertSame(401, $this->call('GET', '/songs', 'wrong')->status);
        self::assertSame(['name' => 'shared', 'writer' => null, 'canWrite' => false, 'isAdmin' => false], $this->call('GET', '/me', 'read')->data());
        self::assertSame(['name' => 'kim', 'writer' => 'kim', 'canWrite' => true, 'isAdmin' => false], $this->call('GET', '/me')->data());
        self::assertSame(403, $this->call('PUT', '/songs/x', 'read', ['content' => '# A - B'])->status);
    }

    public function testErrorsNeverEchoTheKeyOrContent(): void
    {
        $r = $this->call('PUT', '/songs/x', 'secret-guess', ['content' => 'secret text']);

        self::assertStringNotContainsString('secret', $r->body);
    }

    public function testWrongKeysAreRateLimited(): void
    {
        for ($i = 0; $i < 10; ++$i) {
            self::assertSame(401, $this->call('GET', '/songs', 'wrong')->status);
        }
        $r = $this->call('GET', '/songs');
        self::assertSame(429, $r->status, 'even a right key waits once the limit is hit');
        self::assertSame('600', $r->headers['Retry-After']);

        $this->now += 601;
        self::assertSame(200, $this->call('GET', '/songs')->status);
    }

    public function testSongLifecycle(): void
    {
        $created = $this->call('PUT', '/songs/let_it_be', json: ['content' => "# Let It Be - The Beatles (Capo 1)\n1. {C}When"]);
        self::assertSame(201, $created->status);
        $etag = $created->headers['ETag'];

        $list = $this->call('GET', '/songs', 'read')->data();
        self::assertIsArray($list);
        self::assertSame([['slug' => 'let_it_be', 'title' => 'Let It Be', 'artist' => 'The Beatles', 'etag' => $etag, 'content' => "# Let It Be - The Beatles (Capo 1)\n1. {C}When"]], $list['songs']);

        self::assertSame(428, $this->call('DELETE', '/songs/let_it_be')->status);
        $updated = $this->call('PUT', '/songs/let_it_be', json: ['content' => '# Let It Be - The Beatles'], headers: ['If-Match' => $etag]);
        self::assertSame(200, $updated->status);
        self::assertSame(412, $this->call('PUT', '/songs/let_it_be', json: ['content' => '# stale'], headers: ['If-Match' => $etag])->status);

        $renamed = $this->call('POST', '/songs/let_it_be/rename', json: ['to' => 'let-it-be'], headers: ['If-Match' => $updated->headers['ETag']]);
        self::assertSame(200, $renamed->status);
        self::assertSame(404, $this->call('GET', '/songs/let_it_be')->status);

        $revisions = $this->call('GET', '/songs/let-it-be/revisions', 'read')->data();
        self::assertIsArray($revisions);
        self::assertSame(['rename', 'save'], array_column($revisions['revisions'], 'action'));
        $oldId = $revisions['revisions'][1]['id'];
        $old = $this->call('GET', '/songs/let-it-be/revisions/'.$oldId, 'read')->data();
        self::assertIsArray($old);
        self::assertStringContainsString('Capo 1', $old['content']);

        self::assertSame(204, $this->call('DELETE', '/songs/let-it-be', headers: ['If-Match' => $renamed->headers['ETag']])->status);
        $deleted = $this->call('GET', '/deleted', 'read')->data();
        self::assertIsArray($deleted);
        self::assertSame('let-it-be', $deleted['songs'][0]['slug']);

        $lastId = $this->call('GET', '/songs/let-it-be/revisions')->data()['revisions'][0]['id'] ?? '';
        self::assertSame(200, $this->call('POST', '/songs/let-it-be/revisions/'.$lastId.'/restore')->status);
        self::assertSame(200, $this->call('GET', '/songs/let-it-be', 'read')->status);
    }

    public function testVersionsListEveryEtagAndAnswer304WhenUnchanged(): void
    {
        $empty = $this->call('GET', '/versions', 'read');
        self::assertSame(200, $empty->status);
        self::assertSame('{"versions":{}}', $empty->body);

        $a = $this->call('PUT', '/songs/a', json: ['content' => '# A - X'])->headers['ETag'];
        $b = $this->call('PUT', '/songs/b', json: ['content' => '# B - Y'])->headers['ETag'];
        $list = $this->call('GET', '/versions', 'read');
        self::assertSame(['versions' => ['a' => $a, 'b' => $b]], $list->data());
        self::assertStringNotContainsString('# A', $list->body);

        $same = $this->call('GET', '/versions', 'read', headers: ['If-None-Match' => $list->headers['ETag']]);
        self::assertSame(304, $same->status);
        self::assertSame('', $same->body);

        // as the browser sends it back after Apache's compression changed it
        $gzipped = 'W/'.substr($list->headers['ETag'], 0, -1).'-gzip"';
        self::assertSame(304, $this->call('GET', '/versions', 'read', headers: ['If-None-Match' => $gzipped])->status);

        $this->call('PUT', '/songs/a', json: ['content' => '# A - Z'], headers: ['If-Match' => $a]);
        $changed = $this->call('GET', '/versions', 'read', headers: ['If-None-Match' => $list->headers['ETag']]);
        self::assertSame(200, $changed->status);
        self::assertNotSame($list->headers['ETag'], $changed->headers['ETag']);
        self::assertSame(401, $this->call('GET', '/versions', null)->status);
    }

    public function testRoutingErrors(): void
    {
        self::assertSame(404, $this->call('GET', '/nope')->status);
        self::assertSame(404, $this->call('GET', '/songs/a/b/c/d/e/f')->status);
        $r = $this->call('PATCH', '/songs/x');
        self::assertSame(405, $r->status);
        self::assertSame('GET, PUT, DELETE', $r->headers['Allow']);
        self::assertSame(400, $this->call('PUT', '/songs/x', json: null, headers: [])->status);
        self::assertSame(422, $this->call('PUT', '/songs/x', json: ['content' => 5])->status);
        self::assertSame(422, $this->call('PUT', '/songs/..%2Fevil', json: ['content' => '# A - B'])->status);
    }
}
