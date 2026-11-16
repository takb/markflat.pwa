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

    /** @return array<string, mixed> */
    private function create(string $name, string $role): array
    {
        $created = $this->call('POST', '/keys', 'taki-key', ['name' => $name, 'role' => $role]);
        self::assertSame(201, $created->status);
        $data = $created->data();
        self::assertIsArray($data);

        return $data;
    }

    /** @return list<array<string, mixed>> */
    private function list(): array
    {
        $data = $this->call('GET', '/keys', 'taki-key')->data();
        self::assertIsArray($data);
        self::assertIsList($data['keys']);

        return $data['keys'];
    }

    public function testOnlyTheAdminManagesKeys(): void
    {
        self::assertSame(['name' => 'taki', 'writer' => 'taki', 'canWrite' => true, 'isAdmin' => true], $this->call('GET', '/me', 'taki-key')->data());
        self::assertSame(['name' => 'kim', 'writer' => 'kim', 'canWrite' => true, 'isAdmin' => false], $this->call('GET', '/me', 'kim-key')->data());
        self::assertSame(['name' => 'shared', 'writer' => null, 'canWrite' => false, 'isAdmin' => false], $this->call('GET', '/me', 'read')->data());
        foreach (['kim-key', 'read'] as $key) {
            self::assertSame(403, $this->call('GET', '/keys', $key)->status);
            self::assertSame(403, $this->call('POST', '/keys', $key, ['name' => 'eve', 'role' => 'read'])->status);
            self::assertSame(403, $this->call('DELETE', '/keys/shared', $key)->status);
        }
        self::assertSame(404, $this->call('POST', '/read-key', 'taki-key')->status, 'replacing the read key is gone');
    }

    public function testCreatesUsesAndRevokesAWriteKey(): void
    {
        $data = $this->create('lou', 'write');
        self::assertSame('write', $data['role']);
        $key = $data['key'];
        self::assertIsString($key);
        self::assertSame(32, strlen($key));
        self::assertStringNotContainsString($key, (string) file_get_contents($this->dir.'/.keys.json'), 'only the hash is stored');

        self::assertSame(['name' => 'lou', 'writer' => 'lou', 'canWrite' => true, 'isAdmin' => false], $this->call('GET', '/me', $key)->data());
        self::assertSame(201, $this->call('PUT', '/songs/lous-song', $key, ['content' => '# Lou - Song'])->status);

        $keys = $this->list();
        self::assertSame(['taki', 'kim', 'shared', 'lou'], array_column($keys, 'name'));
        self::assertSame(['write', 'write', 'read', 'write'], array_column($keys, 'role'));
        self::assertSame([true, true, true, false], array_column($keys, 'configured'));
        self::assertSame([false, false, true, true], array_column($keys, 'revocable'));
        self::assertSame('taki', $keys[3]['by']);
        self::assertSame('2027-01-15T08:00:00Z', $keys[3]['lastUsed']);

        self::assertSame(409, $this->call('POST', '/keys', 'taki-key', ['name' => 'lou', 'role' => 'read'])->status, 'names are unique across roles');
        self::assertSame(204, $this->call('DELETE', '/keys/lou', 'taki-key')->status);
        self::assertSame(401, $this->call('GET', '/me', $key)->status);
        self::assertSame(404, $this->call('DELETE', '/keys/lou', 'taki-key')->status);
    }

    public function testANamedReadKeyReadsButNeverWrites(): void
    {
        $key = $this->create('band', 'read')['key'];
        self::assertIsString($key);

        self::assertSame(['name' => 'band', 'writer' => null, 'canWrite' => false, 'isAdmin' => false], $this->call('GET', '/me', $key)->data());
        self::assertSame(200, $this->call('GET', '/songs', $key)->status);
        self::assertSame(403, $this->call('PUT', '/songs/x', $key, ['content' => 'x'])->status);
        self::assertSame(403, $this->call('GET', '/keys', $key)->status);
        self::assertSame('2027-01-15T08:00:00Z', $this->list()[3]['lastUsed'], 'its use is recorded too');

        self::assertSame(204, $this->call('DELETE', '/keys/band', 'taki-key')->status);
        self::assertSame(401, $this->call('GET', '/songs', $key)->status);
        self::assertSame(200, $this->call('GET', '/songs', 'read')->status, 'the other read keys keep working');
    }

    public function testTheSharedReadKeyStaysRevoked(): void
    {
        self::assertSame(409, $this->call('POST', '/keys', 'taki-key', ['name' => 'shared', 'role' => 'read'])->status);
        self::assertSame(204, $this->call('DELETE', '/keys/shared', 'taki-key')->status);
        self::assertSame(401, $this->call('GET', '/songs', 'read')->status);
        self::assertSame(['taki', 'kim'], array_column($this->list(), 'name'));

        // the next request (a fresh instance, as after a redeploy with the same secret)
        $this->api = $this->makeApi();
        self::assertSame(401, $this->call('GET', '/songs', 'read')->status);

        // the name is free again
        $key = $this->create('shared', 'read')['key'];
        self::assertIsString($key);
        self::assertSame(200, $this->call('GET', '/songs', $key)->status);
    }

    public function testBootstrapKeysCannotBeRevokedOrShadowed(): void
    {
        self::assertSame(409, $this->call('DELETE', '/keys/taki', 'taki-key')->status);
        self::assertSame(409, $this->call('DELETE', '/keys/kim', 'taki-key')->status);
        self::assertSame(409, $this->call('POST', '/keys', 'taki-key', ['name' => 'taki', 'role' => 'write'])->status);
        self::assertSame(422, $this->call('POST', '/keys', 'taki-key', ['name' => '../x', 'role' => 'read'])->status);
        self::assertSame(422, $this->call('POST', '/keys', 'taki-key', ['name' => 'Big', 'role' => 'read'])->status);
        self::assertSame(422, $this->call('POST', '/keys', 'taki-key', ['name' => 'eve', 'role' => 'admin'])->status);
        self::assertSame(422, $this->call('POST', '/keys', 'taki-key', ['name' => 'eve'])->status);
    }

    public function testTheFirstFileFormatIsTakenOver(): void
    {
        file_put_contents($this->dir.'/.keys.json', (string) json_encode([
            'read' => ['hash' => Auth::hash('app-read'), 'created' => '2026-11-15T20:00:00Z', 'by' => 'taki'],
            'writers' => ['lou' => ['hash' => Auth::hash('lou-key'), 'created' => '2026-11-15T19:00:00Z', 'by' => 'taki']],
            'lastUsed' => ['lou' => '2026-11-15T21:00:00Z'],
        ]));
        $this->api = $this->makeApi();

        self::assertSame('lou', $this->call('GET', '/me', 'lou-key')->data()['writer'] ?? null);
        self::assertSame(200, $this->call('GET', '/songs', 'app-read')->status, 'the app-made read key is now "shared"');
        self::assertSame(401, $this->call('GET', '/songs', 'read')->status, 'the configured one stays replaced');
        $keys = $this->list();
        self::assertSame(['taki', 'kim', 'lou', 'shared'], array_column($keys, 'name'));
        self::assertSame(['write', 'write', 'write', 'read'], array_column($keys, 'role'));
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
