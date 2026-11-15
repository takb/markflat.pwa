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
    }

    #[DataProvider('headings')]
    public function testParsesTitleAndArtist(string $content, string $title, string $artist): void
    {
        self::assertSame(['title' => $title, 'artist' => $artist], Heading::parse($content));
    }
}
