<?php

declare(strict_types=1);

namespace Markflat\Api;

final readonly class Song
{
    public string $etag;

    public function __construct(public string $slug, public string $content)
    {
        $this->etag = self::etagOf($content);
    }

    public static function etagOf(string $content): string
    {
        return '"'.substr(hash('sha256', $content), 0, 20).'"';
    }

    /** @return array{slug: string, title: string, artist: string, etag: string, content: string} */
    public function toArray(): array
    {
        return ['slug' => $this->slug] + Heading::parse($this->content) + ['etag' => $this->etag, 'content' => $this->content];
    }
}
