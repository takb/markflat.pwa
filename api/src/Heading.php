<?php

declare(strict_types=1);

namespace Markflat\Api;

/**
 * Title and artist from a song's heading, "# Title - Artist (capo 2)": its first line after the
 * front matter ("---" … "---" at the very top, if any). The same rules as the app's parseHeading.
 */
final class Heading
{
    /** @return array{title: string, artist: string} */
    public static function parse(string $content): array
    {
        $lines = preg_split('/\R/u', $content) ?: [];
        if (rtrim($lines[0] ?? '') === '---') {
            foreach (array_slice($lines, 1, null, true) as $i => $line) {
                if (rtrim($line) === '---') {
                    $lines = array_slice($lines, $i + 1);
                    break;
                }
            }
        }
        foreach ($lines as $line) {
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
