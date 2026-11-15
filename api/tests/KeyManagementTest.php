<?php

declare(strict_types=1);

namespace Markflat\Api\Tests;

use Markflat\Api\Api;
use Markflat\Api\Auth;
use Markflat\Api\Config;
use Markflat\Api\Http\Request;
use Markflat\Api\Http\Response;
use Markflat\Api\KeyStore;
use Markflat\Api\RateLimiter;
use Markflat\Api\SongRepository;
use PHPUnit\Framework\TestCase;

final class KeyManagementTest extends TestCase
{
    use TempDir {
        setUp as makeDir;
    }

    private Api $api;
    private int $now = 1_800_000_000;

    protected function setUp(): void
    {
        $this->makeDir();
        $this->api = $this->makeApi();
    }

    private function makeApi(): Api
    {
        $keys = new KeyStore($this->dir);

        return new Api(
            new SongRepository($this->dir),
            new Auth(Auth::hash('read'), ['taki' => Auth::hash('taki-key'), 'kim' => Auth::hash('kim-key')], $keys, 'taki'),
            new RateLimiter($this->dir.'/.ratelimit'),
            fn () => $this->now,
            $keys,
        );
    }

    private function call(string $method, string $path, string $key, mixed $json = null): Response
    {
        return $this->api->handle(new Request($method, $path, ['x-api-key' => $key], $json === null ? '' : (string) json_encode($json), '198.51.100.1'));
    }

    public function testOnlyTheAdminManagesKeys(): void
    {
        self::assertSame(['writer' => 'taki', 'canWrite' => true, 'isAdmin' => true], $this->call('GET', '/me', 'taki-key')->data());
        self::assertSame(['writer' => 'kim', 'canWrite' => true, 'isAdmin' => false], $this->call('GET', '/me', 'kim-key')->data());
        foreach (['kim-key', 'read'] as $key) {
            self::assertSame(403, $this->call('GET', '/keys', $key)->status);
            self::assertSame(403, $this->call('POST', '/keys', $key, ['name' => 'eve'])->status);
            self::assertSame(403, $this->call('POST', '/read-key', $key)->status);
        }
    }

    public function testCreatesUsesAndRevokesAWriter(): void
    {
        $created = $this->call('POST', '/keys', 'taki-key', ['name' => 'lou']);
        self::assertSame(201, $created->status);
        $data = $created->data();
        self::assertIsArray($data);
        self::assertSame('lou', $data['name']);
        $key = $data['key'];
        self::assertIsString($key);
        self::assertSame(32, strlen($key));
        self::assertStringNotContainsString($key, (string) file_get_contents($this->dir.'/.keys.json'), 'only the hash is stored');

        self::assertSame(['writer' => 'lou', 'canWrite' => true, 'isAdmin' => false], $this->call('GET', '/me', $key)->data());
        self::assertSame(201, $this->call('PUT', '/songs/lous-song', $key, ['content' => '# Lou - Song'])->status);

        $list = $this->call('GET', '/keys', 'taki-key')->data();
        self::assertIsArray($list);
        self::assertSame(['taki', 'kim', 'lou'], array_column($list['writers'], 'name'));
        self::assertSame([true, true, false], array_column($list['writers'], 'bootstrap'));
        self::assertSame('taki', $list['writers'][2]['by']);
        self::assertSame('2027-01-15T08:00:00Z', $list['writers'][2]['lastUsed']);

        self::assertSame(409, $this->call('POST', '/keys', 'taki-key', ['name' => 'lou'])->status);
        self::assertSame(204, $this->call('DELETE', '/keys/lou', 'taki-key')->status);
        self::assertSame(401, $this->call('GET', '/me', $key)->status);
        self::assertSame(404, $this->call('DELETE', '/keys/lou', 'taki-key')->status);
    }

    public function testBootstrapKeysCannotBeRevokedOrShadowed(): void
    {
        self::assertSame(409, $this->call('DELETE', '/keys/taki', 'taki-key')->status);
        self::assertSame(409, $this->call('DELETE', '/keys/kim', 'taki-key')->status);
        self::assertSame(409, $this->call('POST', '/keys', 'taki-key', ['name' => 'taki'])->status);
        self::assertSame(422, $this->call('POST', '/keys', 'taki-key', ['name' => '../x'])->status);
        self::assertSame(422, $this->call('POST', '/keys', 'taki-key', ['name' => 'Big'])->status);
    }

    public function testReplacingTheReadKeyRetiresTheOldOne(): void
    {
        $new = $this->call('POST', '/read-key', 'taki-key')->data();
        self::assertIsArray($new);
        $key = $new['key'];
        self::assertIsString($key);

        self::assertSame(401, $this->call('GET', '/songs', 'read')->status);
        self::assertSame(200, $this->call('GET', '/songs', $key)->status);
        $list = $this->call('GET', '/keys', 'taki-key')->data();
        self::assertIsArray($list);
        self::assertSame(['fromSecret' => false, 'created' => '2027-01-15T08:00:00Z', 'by' => 'taki'], $list['readKey']);

        // A fresh instance (next request) reads the same store.
        $this->api = $this->makeApi();
        self::assertSame(200, $this->call('GET', '/songs', $key)->status);
    }

    public function testTheAdminMustBeABootstrapWriter(): void
    {
        $config = Config::fromArray(['data_dir' => $this->dir, 'api' => ['write_keys' => ['kim' => Auth::hash('k')], 'admin' => 'taki']]);
        self::assertSame('', $config->admin);
    }

    public function testLastUseIsWrittenAtMostHourly(): void
    {
        $this->call('GET', '/me', 'kim-key');
        $first = (string) file_get_contents($this->dir.'/.keys.json');
        $this->now += 1800;
        $this->call('GET', '/me', 'kim-key');
        self::assertSame($first, (string) file_get_contents($this->dir.'/.keys.json'));
        $this->now += 1801;
        $this->call('GET', '/me', 'kim-key');
        self::assertNotSame($first, (string) file_get_contents($this->dir.'/.keys.json'));
    }
}
