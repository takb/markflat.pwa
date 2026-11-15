<?php

declare(strict_types=1);

namespace Markflat\Api;

/** Title and artist from a song's heading, "# Title - Artist (capo 2)". The one parser for both. */
final class Heading
{
    /** @return array{title: string, artist: string} */
    public static function parse(string $content): array
    {
        foreach (preg_split('/\R/u', $content) ?: [] as $line) {
            if (trim($line) === '') {
                continue;
            }
            if (preg_match('/^\s{0,3}#+\s*(.+?)\s+-\s+(.+?)\s*$/u', $line, $m)) {
                // A trailing "(…)" (capo, key, version) is not part of the artist's name.
                $artist = trim((string) preg_replace('/\s*\([^()]*\)$/u', '', $m[2]));

                return ['title' => $m[1], 'artist' => $artist !== '' ? $artist : $m[2]];
            }
            if (preg_match('/^\s{0,3}#+\s*(.+?)\s*$/u', $line, $m)) {
                return ['title' => $m[1], 'artist' => ''];
            }
            break;
        }

        return ['title' => '', 'artist' => ''];
    }
}
