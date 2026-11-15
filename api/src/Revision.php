<?php

declare(strict_types=1);

namespace Markflat\Api;

/** An old version of a song, kept before a save, delete, rename or restore. */
final readonly class Revision
{
    public const string ID = '/^(\d{8}T\d{12}Z)-(save|delete|rename|restore)-([a-z0-9_-]+)$/';

    public function __construct(
        public string $id,
        public string $time,
        public string $action,
        public string $writer,
    ) {
    }

    public static function fromId(string $id): ?self
    {
        if (!preg_match(self::ID, $id, $m)) {
            return null;
        }
        $t = \DateTimeImmutable::createFromFormat('Ymd\THisu\Z', $m[1], new \DateTimeZone('UTC'));

        return new self($id, $t ? $t->format('Y-m-d\TH:i:s\Z') : $m[1], $m[2], $m[3]);
    }

    /** @return array{id: string, time: string, action: string, writer: string} */
    public function toArray(): array
    {
        return ['id' => $this->id, 'time' => $this->time, 'action' => $this->action, 'writer' => $this->writer];
    }
}
