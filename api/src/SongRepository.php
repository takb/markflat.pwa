<?php

declare(strict_types=1);

namespace Markflat\Api;

use Markflat\Api\Http\HttpError;

/**
 * Songs as `<slug>.mb` files in one folder; old versions in `.revisions/<slug>/`.
 *
 * Every change runs under one lock, writes atomically (temp file + rename) and keeps the
 * previous content as a revision first. Changes to an existing song need its current ETag
 * (If-Match), so a save based on an old copy gets a conflict instead of overwriting.
 */
final class SongRepository
{
    /** New names: lowercase letters, digits, _ and -. Existing files are found by exact name. */
    public const string NEW_SLUG = '/^[a-z0-9][a-z0-9_-]{0,99}$/';
    public const int MAX_BYTES = 100_000;

    /** @var \Closure(): \DateTimeImmutable */
    private \Closure $clock;

    /** @param (\Closure(): \DateTimeImmutable)|null $clock */
    public function __construct(
        private readonly string $dir,
        private readonly int $keepRevisions = 20,
        ?\Closure $clock = null,
    ) {
        $this->clock = $clock ?? fn () => new \DateTimeImmutable('now', new \DateTimeZone('UTC'));
    }

    /** @return list<Song> sorted by slug */
    public function all(): array
    {
        $songs = [];
        foreach ($this->slugs() as $slug) {
            $content = @file_get_contents($this->path($slug));
            if ($content !== false) {
                $songs[] = new Song($slug, $content);
            }
        }

        return $songs;
    }

    public function find(string $slug): ?Song
    {
        if (!in_array($slug, $this->slugs(), true)) {
            return null;
        }
        $content = @file_get_contents($this->path($slug));

        return $content === false ? null : new Song($slug, $content);
    }

    public function get(string $slug): Song
    {
        return $this->find($slug) ?? throw new HttpError(404, 'not_found', 'No such song.');
    }

    /**
     * Creates or replaces a song. Replacing needs the current ETag; creating needs none (a
     * song that was deleted meanwhile is a conflict if the caller still sends one).
     */
    public function save(string $slug, string $content, ?string $ifMatch, string $writer): Song
    {
        self::checkContent($content);

        return $this->locked(function () use ($slug, $content, $ifMatch, $writer) {
            $current = $this->find($slug);
            if ($current === null) {
                self::checkNewSlug($slug);
                if ($ifMatch !== null && $ifMatch !== '*') {
                    throw new HttpError(412, 'conflict', 'The song was deleted in the meantime.');
                }
            } else {
                $this->checkMatch($current, $ifMatch, true);
                if ($current->content === $content) {
                    return $current;
                }
                $this->keep($current, 'save', $writer);
            }
            $this->write($this->path($slug), $content);

            return new Song($slug, $content);
        });
    }

    public function delete(string $slug, ?string $ifMatch, string $writer): void
    {
        $this->locked(function () use ($slug, $ifMatch, $writer) {
            $current = $this->get($slug);
            $this->checkMatch($current, $ifMatch);
            $this->keep($current, 'delete', $writer);
            unlink($this->path($slug));
        });
    }

    /** Moves a song and its history to a new name; the old name is free afterwards (B6). */
    public function rename(string $slug, string $to, ?string $ifMatch, string $writer): Song
    {
        self::checkNewSlug($to);

        return $this->locked(function () use ($slug, $to, $ifMatch, $writer) {
            $current = $this->get($slug);
            $this->checkMatch($current, $ifMatch);
            if ($to === $slug) {
                return $current;
            }
            if ($this->find($to) !== null || is_dir($this->revisionDir($to))) {
                throw new HttpError(409, 'exists', 'A song (or a deleted song) with that name exists.');
            }
            if (is_dir($this->revisionDir($slug))) {
                rename($this->revisionDir($slug), $this->revisionDir($to));
            }
            $moved = new Song($to, $current->content);
            $this->keep($moved, 'rename', $writer);
            rename($this->path($slug), $this->path($to));

            return $moved;
        });
    }

    /** @return list<Revision> newest first */
    public function revisions(string $slug): array
    {
        $dir = $this->revisionDir($slug);
        if (!self::isSafeName($slug) || !is_dir($dir)) {
            return [];
        }
        $revisions = [];
        foreach (scandir($dir, SCANDIR_SORT_DESCENDING) ?: [] as $file) {
            $revision = str_ends_with($file, '.mb') ? Revision::fromId(substr($file, 0, -3)) : null;
            if ($revision !== null) {
                $revisions[] = $revision;
            }
        }

        return $revisions;
    }

    public function revisionContent(string $slug, string $id): string
    {
        if (!self::isSafeName($slug) || Revision::fromId($id) === null) {
            throw new HttpError(404, 'not_found', 'No such revision.');
        }
        $content = @file_get_contents($this->revisionDir($slug).'/'.$id.'.mb');

        return $content === false ? throw new HttpError(404, 'not_found', 'No such revision.') : $content;
    }

    /** Makes an old version current again (the version it replaces is kept, as on every save). */
    public function restore(string $slug, string $id, ?string $ifMatch, string $writer): Song
    {
        $content = $this->revisionContent($slug, $id);

        return $this->locked(function () use ($slug, $content, $ifMatch, $writer) {
            $current = $this->find($slug);
            if ($current !== null) {
                $this->checkMatch($current, $ifMatch);
                if ($current->content === $content) {
                    return $current;
                }
                $this->keep($current, 'restore', $writer);
            } elseif ($ifMatch !== null && $ifMatch !== '*') {
                throw new HttpError(412, 'conflict', 'The song changed in the meantime.');
            }
            $this->write($this->path($slug), $content);

            return new Song($slug, $content);
        });
    }

    /**
     * Songs that have a history but no current file.
     *
     * @return list<array{slug: string, title: string, artist: string, deletedAt: string, deletedBy: string}>
     */
    public function deleted(): array
    {
        $root = $this->dir.'/.revisions';
        $current = $this->slugs();
        $deleted = [];
        foreach (is_dir($root) ? scandir($root) ?: [] : [] as $slug) {
            if ($slug[0] === '.' || in_array($slug, $current, true)) {
                continue;
            }
            $last = $this->revisions($slug)[0] ?? null;
            if ($last === null) {
                continue;
            }
            $deleted[] = ['slug' => $slug]
                + Heading::parse($this->revisionContent($slug, $last->id))
                + ['deletedAt' => $last->time, 'deletedBy' => $last->writer];
        }

        return $deleted;
    }

    /** @return list<string> slugs of the current songs */
    private function slugs(): array
    {
        $slugs = [];
        foreach (is_dir($this->dir) ? scandir($this->dir) ?: [] : [] as $file) {
            if (str_ends_with($file, '.mb') && self::isSafeName(substr($file, 0, -3)) && is_file($this->dir.'/'.$file)) {
                $slugs[] = substr($file, 0, -3);
            }
        }

        return $slugs;
    }

    /** No path tricks: not empty, no slash, backslash, NUL or leading dot. */
    private static function isSafeName(string $name): bool
    {
        return $name !== '' && $name[0] !== '.' && !preg_match('/[\/\\\\\x00]/', $name);
    }

    private static function checkNewSlug(string $slug): void
    {
        if (!preg_match(self::NEW_SLUG, $slug)) {
            throw new HttpError(422, 'bad_slug', 'A song name may only use a–z, 0–9, _ and - (at most 100).');
        }
    }

    private static function checkContent(string $content): void
    {
        if (strlen($content) > self::MAX_BYTES) {
            throw new HttpError(413, 'too_large', 'A song may be at most 100 KB.');
        }
        if (trim($content) === '' || !mb_check_encoding($content, 'UTF-8')) {
            throw new HttpError(422, 'bad_content', 'A song must be non-empty UTF-8 text.');
        }
    }

    private function checkMatch(Song $current, ?string $ifMatch, bool $existsIsConflict = false): void
    {
        if ($ifMatch === null) {
            throw $existsIsConflict ? new HttpError(412, 'exists', 'A song with that name exists already.') : new HttpError(428, 'precondition_required', 'Send the song\'s ETag in If-Match.');
        }
        if ($ifMatch !== '*' && $ifMatch !== $current->etag) {
            throw new HttpError(412, 'conflict', 'The song changed in the meantime.');
        }
    }

    /** Keeps the song's content as a revision, then prunes to the newest $keepRevisions. */
    private function keep(Song $song, string $action, string $writer): void
    {
        $dir = $this->revisionDir($song->slug);
        if (!is_dir($dir)) {
            mkdir($dir, 0700, true);
        }
        $now = ($this->clock)();
        do {
            $id = $now->format('Ymd\THisu').'Z-'.$action.'-'.$writer;
            $now = $now->modify('+1 microsecond');
        } while (is_file($dir.'/'.$id.'.mb'));
        $this->write($dir.'/'.$id.'.mb', $song->content);
        foreach (array_slice($this->revisions($song->slug), $this->keepRevisions) as $old) {
            @unlink($dir.'/'.$old->id.'.mb');
        }
    }

    private function write(string $path, string $content): void
    {
        $tmp = dirname($path).'/.tmp-'.bin2hex(random_bytes(6));
        if (file_put_contents($tmp, $content) !== strlen($content) || !rename($tmp, $path)) {
            @unlink($tmp);
            throw new HttpError(500, 'write_failed', 'The song could not be saved.');
        }
    }

    private function path(string $slug): string
    {
        return $this->dir.'/'.$slug.'.mb';
    }

    private function revisionDir(string $slug): string
    {
        return $this->dir.'/.revisions/'.$slug;
    }

    /**
     * @template T
     *
     * @param \Closure(): T $work
     *
     * @return T
     */
    private function locked(\Closure $work): mixed
    {
        if (!is_dir($this->dir)) {
            throw new HttpError(500, 'no_data_dir', 'The song folder is missing.');
        }
        $lock = fopen($this->dir.'/.lock', 'c');
        if ($lock === false || !flock($lock, LOCK_EX)) {
            throw new HttpError(500, 'lock_failed', 'The song folder is busy.');
        }
        try {
            return $work();
        } finally {
            flock($lock, LOCK_UN);
            fclose($lock);
        }
    }
}
