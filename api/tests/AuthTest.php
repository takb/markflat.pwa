<?php

declare(strict_types=1);

namespace Markflat\Api\Tests;

use Markflat\Api\Auth;
use Markflat\Api\Config;
use PHPUnit\Framework\TestCase;

final class AuthTest extends TestCase
{
    public function testIdentifiesReaderAndWriters(): void
    {
        $auth = new Auth(Auth::hash('r-key'), ['takara' => Auth::hash('t-key'), 'kim' => strtoupper(Auth::hash('k-key'))]);

        $reader = $auth->identify('r-key');
        self::assertNotNull($reader);
        self::assertSame([Auth::SHARED, null, false], [$reader->name, $reader->writer, $reader->canWrite]);
        self::assertSame('takara', $auth->identify('t-key')?->writer);
        self::assertSame('kim', $auth->identify('k-key')?->writer);
        self::assertNull($auth->identify('wrong'));
        self::assertNull($auth->identify(''));
    }

    public function testWithoutKeysNobodyGetsIn(): void
    {
        self::assertNull((new Auth('', []))->identify(''));
        self::assertNull((new Auth('', []))->identify('anything'));
    }

    public function testConfigDropsInvalidEntries(): void
    {
        $config = Config::fromArray([
            'data_dir' => '/data/',
            'api' => [
                'read_key' => 'not-a-hash',
                'write_keys' => ['ok' => Auth::hash('a'), 'Bad Name' => Auth::hash('b'), 'short' => 'abc', 'x/../y' => Auth::hash('c')],
            ],
        ]);

        self::assertSame('/data', $config->dataDir);
        self::assertSame('', $config->readKey);
        self::assertSame(['ok'], array_keys($config->writeKeys));
    }
}
