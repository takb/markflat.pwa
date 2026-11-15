<?php

declare(strict_types=1);

namespace Markflat\Api\Tests;

use Markflat\Api\Http\HttpError;
use Markflat\Api\SongRepository;
use PHPUnit\Framework\TestCase;

final class SongRepositoryTest extends TestCase
{
    use TempDir;

    private function repo(int $keep = 20): SongRepository
    {
        return new SongRepository($this->dir, $keep);
    }

    private function expectError(int $status, \Closure $fn): void
    {
        try {
            $fn();
            self::fail('expected HTTP '.$status);
        } catch (HttpError $e) {
            self::assertSame($status, $e->status, $e->getMessage());
        }
    }

    public function testCreatesListsAndReadsSongs(): void
    {
        $repo = $this->repo();
        $repo->save('let_it_be', "# Let It Be - The Beatles\n", null, 'kim');
        $repo->save('yesterday', "# Yesterday - The Beatles\n", null, 'kim');

        self::assertSame(['let_it_be', 'yesterday'], array_map(fn ($s) => $s->slug, $repo->all()));
        self::assertSame("# Yesterday - The Beatles\n", $repo->get('yesterday')->content);
        self::assertSame([], $repo->revisions('yesterday'), 'creating keeps no revision');
    }

    public function testReplacingNeedsTheCurrentEtag(): void
    {
        $repo = $this->repo();
        $v1 = $repo->save('song', "# A - B\nv1", null, 'kim');

        $this->expectError(412, fn () => $repo->save('song', "# A - B\nv2", null, 'kim'));
        $this->expectError(412, fn () => $repo->save('song', "# A - B\nv2", '"stale"', 'kim'));
        $v2 = $repo->save('song', "# A - B\nv2", $v1->etag, 'kim');

        self::assertSame("# A - B\nv2", $repo->get('song')->content);
        self::assertNotSame($v1->etag, $v2->etag);
        $revisions = $repo->revisions('song');
        self::assertCount(1, $revisions);
        self::assertSame(['save', 'kim'], [$revisions[0]->action, $revisions[0]->writer]);
        self::assertSame("# A - B\nv1", $repo->revisionContent('song', $revisions[0]->id));
    }

    public function testSavingTheSameContentKeepsNoRevision(): void
    {
        $repo = $this->repo();
        $v1 = $repo->save('song', '# A - B', null, 'kim');
        $repo->save('song', '# A - B', $v1->etag, 'kim');

        self::assertSame([], $repo->revisions('song'));
    }

    public function testRejectsBadNamesAndContent(): void
    {
        $repo = $this->repo();
        foreach (['../evil', 'evil.php', 'UPPER', '.hidden', '', 'a/b', str_repeat('a', 101)] as $slug) {
            $this->expectError(422, fn () => $repo->save($slug, '# A - B', null, 'kim'));
        }
        $this->expectError(413, fn () => $repo->save('big', str_repeat('x', SongRepository::MAX_BYTES + 1), null, 'kim'));
        $this->expectError(422, fn () => $repo->save('empty', "  \n", null, 'kim'));
        $this->expectError(422, fn () => $repo->save('latin1', "# Caf\xE9 - X", null, 'kim'));
        self::assertSame([], $repo->all());
        self::assertSame(['.lock'], array_values(array_diff(scandir($this->dir) ?: [], ['.', '..'])));
    }

    public function testExistingFilesWithOldStyleNamesStayUsable(): void
    {
        file_put_contents($this->dir.'/Old Name.mb', '# Old - Song');
        file_put_contents($this->dir.'/notes.txt', 'not a song');
        $repo = $this->repo();

        self::assertSame(['Old Name'], array_map(fn ($s) => $s->slug, $repo->all()));
        $song = $repo->get('Old Name');
        $repo->save('Old Name', '# Old - Song v2', $song->etag, 'kim');
        self::assertSame('# Old - Song v2', $repo->get('Old Name')->content);
        $this->expectError(404, fn () => $repo->get('../Old Name'));
    }

    public function testDeleteKeepsTheSongAsRevisionAndListsItAsDeleted(): void
    {
        $repo = $this->repo();
        $song = $repo->save('song', "# Title - Artist\n", null, 'kim');

        $this->expectError(428, fn () => $repo->delete('song', null, 'kim'));
        $this->expectError(412, fn () => $repo->delete('song', '"stale"', 'kim'));
        $repo->delete('song', $song->etag, 'kim');

        self::assertNull($repo->find('song'));
        $deleted = $repo->deleted();
        self::assertCount(1, $deleted);
        self::assertSame(['song', 'Title', 'Artist', 'kim'], [$deleted[0]['slug'], $deleted[0]['title'], $deleted[0]['artist'], $deleted[0]['deletedBy']]);
        $this->expectError(404, fn () => $repo->delete('song', '*', 'kim'));
    }

    public function testRestoresAnOldVersionAndADeletedSong(): void
    {
        $repo = $this->repo();
        $v1 = $repo->save('song', '# A - B v1', null, 'kim');
        $v2 = $repo->save('song', '# A - B v2', $v1->etag, 'kim');
        $old = $repo->revisions('song')[0];

        $this->expectError(428, fn () => $repo->restore('song', $old->id, null, 'kim'));
        $v3 = $repo->restore('song', $old->id, $v2->etag, 'takara');
        self::assertSame('# A - B v1', $v3->content);
        self::assertSame('restore', $repo->revisions('song')[0]->action);

        $repo->delete('song', $v3->etag, 'kim');
        $last = $repo->revisions('song')[0];
        $back = $repo->restore('song', $last->id, null, 'kim');
        self::assertSame('# A - B v1', $back->content);
        self::assertSame([], $repo->deleted());
    }

    public function testRenameMovesTheSongAndItsHistory(): void
    {
        $repo = $this->repo();
        $v1 = $repo->save('old', '# A - B v1', null, 'kim');
        $v2 = $repo->save('old', '# A - B v2', $v1->etag, 'kim');
        $repo->save('taken', '# T - T', null, 'kim');

        $this->expectError(409, fn () => $repo->rename('old', 'taken', $v2->etag, 'kim'));
        $this->expectError(422, fn () => $repo->rename('old', '../x', $v2->etag, 'kim'));
        $moved = $repo->rename('old', 'new', $v2->etag, 'kim');

        self::assertSame('new', $moved->slug);
        self::assertNull($repo->find('old'));
        self::assertSame([], $repo->deleted(), 'the old name leaves no duplicate or deleted entry');
        self::assertSame(['rename', 'save'], array_map(fn ($r) => $r->action, $repo->revisions('new')));
    }

    public function testKeepsOnlyTheNewestRevisions(): void
    {
        $repo = $this->repo(3);
        $song = $repo->save('song', '# A - B 0', null, 'kim');
        for ($i = 1; $i <= 6; ++$i) {
            $song = $repo->save('song', '# A - B '.$i, $song->etag, 'kim');
        }
        $revisions = $repo->revisions('song');

        self::assertCount(3, $revisions);
        self::assertSame('# A - B 5', $repo->revisionContent('song', $revisions[0]->id));
        self::assertSame('# A - B 3', $repo->revisionContent('song', $revisions[2]->id));
    }

    public function testRevisionIdsCannotEscape(): void
    {
        $repo = $this->repo();
        $repo->save('song', '# A - B', null, 'kim');
        $this->expectError(404, fn () => $repo->revisionContent('song', '../../song'));
        $this->expectError(404, fn () => $repo->revisionContent('../x', '20260101T000000000000Z-save-kim'));
    }
}
