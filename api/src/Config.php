<?php

declare(strict_types=1);

namespace Markflat\Api;

/**
 * The server configuration, from config.php (written by the deploy; never in the repo):
 *
 *   return [
 *       'data_dir' => '/path/to/data',
 *       'api' => [
 *           'read_key' => '<sha256 hex of the read key>',     (starting value; the app may replace it)
 *           'write_keys' => ['taki' => '<sha256 hex>', …],    (bootstrap writers)
 *           'admin' => 'taki',                                (one of the bootstrap writers)
 *       ],
 *   ];
 */
final readonly class Config
{
    /** @param array<string, string> $writeKeys */
    public function __construct(
        public string $dataDir,
        public string $readKey = '',
        public array $writeKeys = [],
        public string $admin = '',
    ) {
    }

    /** @param array<mixed> $config */
    public static function fromArray(array $config): self
    {
        $dataDir = $config['data_dir'] ?? null;
        $api = is_array($config['api'] ?? null) ? $config['api'] : [];
        $read = $api['read_key'] ?? '';
        $writers = [];
        foreach (is_array($api['write_keys'] ?? null) ? $api['write_keys'] : [] as $name => $hash) {
            // A writer's name ends up in revision file names: keep it to a safe alphabet.
            if (is_string($name) && preg_match('/^[a-z0-9_-]{1,40}$/', $name) && is_string($hash) && preg_match('/^[0-9a-f]{64}$/i', $hash)) {
                $writers[$name] = $hash;
            }
        }

        $admin = $api['admin'] ?? '';

        return new self(
            rtrim(is_string($dataDir) ? $dataDir : '', '/'),
            is_string($read) && preg_match('/^[0-9a-f]{64}$/i', $read) ? $read : '',
            $writers,
            is_string($admin) && isset($writers[$admin]) ? $admin : '',
        );
    }

    public static function load(string $file): self
    {
        $config = is_file($file) ? require $file : [];

        return self::fromArray(is_array($config) ? $config : []);
    }
}
