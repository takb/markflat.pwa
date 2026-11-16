<?php

declare(strict_types=1);

namespace Markflat\Api\Tests;

use Markflat\Api\Heading;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class HeadingTest extends TestCase
{
    /** @return iterable<array{string, string, string}> */
    public static function headings(): iterable
    {
        yield ["# Let It Be - The Beatles\n1. text", 'Let It Be', 'The Beatles'];
        yield ['# Let It Be - The Beatles (Capo 2)', 'Let It Be', 'The Beatles'];
        yield ['# Song - Jay-Z', 'Song', 'Jay-Z'];
        yield ['# Ob-La-Di, Ob-La-Da - The Beatles', 'Ob-La-Di, Ob-La-Da', 'The Beatles'];
        yield [" # Johnny I hardly knew ya - Joseph Geoghegan \r\n1. x", 'Johnny I hardly knew ya', 'Joseph Geoghegan'];
        yield ["\n\n# Only a title", 'Only a title', ''];
        yield ['1. no heading', '', ''];
        yield ['# Kimi o nosete (君をのせて) - Azumi Inoue', 'Kimi o nosete (君をのせて)', 'Azumi Inoue'];
        // UTF-8 bytes such as 0x85 (in х, ら …) are not line breaks
        yield ["# Gluchari (Глухари) - Александр Розенбаум\r\n1. Глуха{e}ри", 'Gluchari (Глухари)', 'Александр Розенбаум'];
        yield ["# Hotaru no hikari (蛍の光) - Chikai Inagaki \r\n~Chords", 'Hotaru no hikari (蛍の光)', 'Chikai Inagaki'];
        // the front matter is skipped; one that is never closed is no front matter
        yield ["---\nkey: Em\n---\n# Let It Be - The Beatles\n1. text", 'Let It Be', 'The Beatles'];
        yield ["---\r\nkey: G\r\n---\r\n\r\n# Only a title", 'Only a title', ''];
        yield ["---\nkey: Em\n# Let It Be - The Beatles", '', ''];
    }

    #[DataProvider('headings')]
    public function testParsesTitleAndArtist(string $content, string $title, string $artist): void
    {
        self::assertSame(['title' => $title, 'artist' => $artist], Heading::parse($content));
    }
}
