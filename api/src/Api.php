<?php

declare(strict_types=1);

namespace Markflat\Api;

use Markflat\Api\Http\HttpError;
use Markflat\Api\Http\Request;
use Markflat\Api\Http\Response;

/**
 * The songbook API. Every request needs a key in the X-Api-Key header. Every key has a name; a
 * read key reads, a write key also writes (and its name is recorded with each change).
 *
 *   GET    /me                                  who the key belongs to
 *   GET    /songs                               all songs, with content and ETag
 *   GET    /songs/{slug}                        one song
 *   PUT    /songs/{slug}                        create or replace: {"content": …}, If-Match
 *   DELETE /songs/{slug}                        If-Match
 *   POST   /songs/{slug}/rename                 {"to": "new-slug"}, If-Match
 *   GET    /songs/{slug}/revisions              old versions, newest first
 *   GET    /songs/{slug}/revisions/{id}         one old version's content
 *   POST   /songs/{slug}/revisions/{id}/restore make it current (If-Match unless deleted)
 *   GET    /deleted                             deleted songs that still have a history
 *
 * Admin only (D14):
 *   GET    /keys                                every key: name, role, made when and by whom, last use
 *   POST   /keys                                new key: {"name", "role": "read"|"write"} → {"name", "role", "key"} (shown once)
 *   DELETE /keys/{name}                         revoke a key (not the admin's; "shared" = the configured read key)
 */
final readonly class Api
{
    public function __construct(
        private SongRepository $songs,
        private Auth $auth,
        private RateLimiter $limiter,
        private \Closure $now,
        private ?KeyStore $keys = null,
    ) {
    }

    public static function fromConfig(Config $config): self
    {
        $keys = new KeyStore($config->dataDir);

        return new self(
            new SongRepository($config->dataDir),
            new Auth($config->readKey, $config->writeKeys, $keys, $config->admin),
            new RateLimiter($config->dataDir.'/.ratelimit'),
            fn (): int => time(),
            $keys,
        );
    }

    public function handle(Request $request): Response
    {
        try {
            return $this->route($request);
        } catch (HttpError $e) {
            return Response::error($e);
        } catch (\Throwable $e) {
            error_log('markflat api: '.$e);

            return Response::error(new HttpError(500, 'server_error', 'Something went wrong on the server.'));
        }
    }

    private function route(Request $r): Response
    {
        $parts = array_map('rawurldecode', array_values(array_filter(explode('/', $r->path), fn ($p) => $p !== '')));
        $route = match (count($parts)) {
            1 => $parts[0],
            2 => $parts[0].'/*',
            3 => $parts[0].'/*/'.$parts[2],
            4 => $parts[0].'/*/'.$parts[2].'/*',
            5 => $parts[0].'/*/'.$parts[2].'/*/'.$parts[4],
            default => '',
        };
        $handlers = [
            'me' => ['GET' => fn () => $this->me($r)],
            'songs' => ['GET' => fn () => $this->list($r)],
            'songs/*' => [
                'GET' => fn () => $this->show($r, $parts[1]),
                'PUT' => fn () => $this->save($r, $parts[1]),
                'DELETE' => fn () => $this->delete($r, $parts[1]),
            ],
            'songs/*/rename' => ['POST' => fn () => $this->rename($r, $parts[1])],
            'songs/*/revisions' => ['GET' => fn () => $this->revisions($r, $parts[1])],
            'songs/*/revisions/*' => ['GET' => fn () => $this->revision($r, $parts[1], $parts[3])],
            'songs/*/revisions/*/restore' => ['POST' => fn () => $this->restore($r, $parts[1], $parts[3])],
            'deleted' => ['GET' => fn () => $this->deleted($r)],
            'keys' => ['GET' => fn () => $this->listKeys($r), 'POST' => fn () => $this->createKey($r)],
            'keys/*' => ['DELETE' => fn () => $this->revokeKey($r, $parts[1])],
        ];
        $methods = $handlers[$route] ?? throw new HttpError(404, 'not_found', 'No such endpoint.');
        $handler = $methods[$r->method] ?? throw new HttpError(405, 'method_not_allowed', 'Method not allowed here.', ['Allow' => implode(', ', array_keys($methods))]);

        return $handler();
    }

    private function me(Request $r): Response
    {
        $who = $this->identify($r);

        return Response::json(['name' => $who->name, 'writer' => $who->writer, 'canWrite' => $who->canWrite, 'isAdmin' => $who->isAdmin]);
    }

    private function list(Request $r): Response
    {
        $this->identify($r);

        return Response::json(['songs' => array_map(fn (Song $s) => $s->toArray(), $this->songs->all())]);
    }

    private function show(Request $r, string $slug): Response
    {
        $this->identify($r);
        $song = $this->songs->get($slug);

        return Response::json($song->toArray(), 200, ['ETag' => $song->etag]);
    }

    private function save(Request $r, string $slug): Response
    {
        $writer = $this->writer($r);
        $content = $r->json()['content'] ?? null;
        if (!is_string($content)) {
            throw new HttpError(422, 'bad_content', 'The body needs "content", the song text.');
        }
        $existed = $this->songs->find($slug) !== null;
        $song = $this->songs->save($slug, $content, $r->header('if-match'), $writer);

        return Response::json($song->toArray(), $existed ? 200 : 201, ['ETag' => $song->etag]);
    }

    private function delete(Request $r, string $slug): Response
    {
        $this->songs->delete($slug, $r->header('if-match'), $this->writer($r));

        return new Response(204);
    }

    private function rename(Request $r, string $slug): Response
    {
        $writer = $this->writer($r);
        $to = $r->json()['to'] ?? null;
        if (!is_string($to)) {
            throw new HttpError(422, 'bad_slug', 'The body needs "to", the new name.');
        }
        $song = $this->songs->rename($slug, $to, $r->header('if-match'), $writer);

        return Response::json($song->toArray(), 200, ['ETag' => $song->etag]);
    }

    private function revisions(Request $r, string $slug): Response
    {
        $this->identify($r);

        return Response::json(['revisions' => array_map(fn (Revision $v) => $v->toArray(), $this->songs->revisions($slug))]);
    }

    private function revision(Request $r, string $slug, string $id): Response
    {
        $this->identify($r);
        $revision = Revision::fromId($id) ?? throw new HttpError(404, 'not_found', 'No such revision.');

        return Response::json($revision->toArray() + ['content' => $this->songs->revisionContent($slug, $id)]);
    }

    private function restore(Request $r, string $slug, string $id): Response
    {
        $song = $this->songs->restore($slug, $id, $r->header('if-match'), $this->writer($r));

        return Response::json($song->toArray(), 200, ['ETag' => $song->etag]);
    }

    private function deleted(Request $r): Response
    {
        $this->identify($r);

        return Response::json(['songs' => $this->songs->deleted()]);
    }

    private function listKeys(Request $r): Response
    {
        $this->admin($r);
        $store = $this->store();
        $lastUsed = $store->lastUsed();
        $keys = [];
        foreach ($this->auth->bootstrapWriters() as $name) {
            $keys[] = ['name' => $name, 'role' => 'write', 'created' => null, 'by' => null, 'lastUsed' => $lastUsed[$name] ?? null, 'configured' => true, 'revocable' => false];
        }
        if ($this->auth->sharedActive()) {
            $keys[] = ['name' => Auth::SHARED, 'role' => 'read', 'created' => null, 'by' => null, 'lastUsed' => $lastUsed[Auth::SHARED] ?? null, 'configured' => true, 'revocable' => true];
        }
        foreach ($store->keys() as $name => $entry) {
            if (!in_array((string) $name, $this->auth->bootstrapWriters(), true)) {
                $keys[] = ['name' => (string) $name, 'role' => $entry['role'], 'created' => $entry['created'], 'by' => $entry['by'], 'lastUsed' => $lastUsed[$name] ?? null, 'configured' => false, 'revocable' => true];
            }
        }

        return Response::json(['keys' => $keys]);
    }

    private function createKey(Request $r): Response
    {
        $admin = $this->admin($r);
        $body = $r->json();
        $name = $body['name'] ?? null;
        $role = $body['role'] ?? null;
        if (!is_string($name) || !preg_match(KeyStore::NAME, $name)) {
            throw new HttpError(422, 'bad_name', 'A key\'s name may only use a–z, 0–9, _ and - (at most 40).');
        }
        if (!in_array($role, KeyStore::ROLES, true)) {
            throw new HttpError(422, 'bad_role', 'The role is "read" or "write".');
        }
        if (in_array($name, $this->auth->bootstrapWriters(), true) || ($name === Auth::SHARED && $this->auth->sharedActive())) {
            throw new HttpError(409, 'exists', 'A key with that name exists already.');
        }
        $key = Auth::newKey();
        $this->store()->add($name, $role, Auth::hash($key), $admin, $this->timestamp());

        return Response::json(['name' => $name, 'role' => $role, 'key' => $key], 201);
    }

    private function revokeKey(Request $r, string $name): Response
    {
        $this->admin($r);
        if (in_array($name, $this->auth->bootstrapWriters(), true)) {
            throw new HttpError(409, 'bootstrap', 'The admin\'s key comes from the server\'s configuration and cannot be revoked here.');
        }
        if ($name === Auth::SHARED && $this->auth->sharedActive()) {
            $this->store()->revokeShared();
        } else {
            $this->store()->remove($name);
        }

        return new Response(204);
    }

    private function admin(Request $r): string
    {
        $who = $this->identify($r);
        if (!$who->isAdmin || $who->writer === null) {
            throw new HttpError(403, 'not_admin', 'Only the admin may manage keys.');
        }

        return $who->writer;
    }

    private function store(): KeyStore
    {
        return $this->keys ?? throw new HttpError(500, 'no_key_store', 'Key management is not set up.');
    }

    private function timestamp(): string
    {
        return gmdate('Y-m-d\TH:i:s\Z', ($this->now)());
    }

    /** The key's owner; a missing or wrong key is a 401 and counts towards the rate limit. */
    private function identify(Request $r): Identity
    {
        $now = ($this->now)();
        $wait = $this->limiter->retryAfter($r->clientIp, $now);
        if ($wait > 0) {
            throw new HttpError(429, 'too_many_attempts', 'Too many wrong keys; try again later.', ['Retry-After' => (string) $wait]);
        }
        $who = $this->auth->identify($r->header('x-api-key') ?? '');
        if ($who === null) {
            $this->limiter->fail($r->clientIp, $now);

            throw new HttpError(401, 'unauthorized', 'A valid key is needed (X-Api-Key).');
        }
        $this->keys?->touch($who->name, new \DateTimeImmutable('@'.$now));

        return $who;
    }

    private function writer(Request $r): string
    {
        return $this->identify($r)->writer ?? throw new HttpError(403, 'read_only', 'This key can only read.');
    }
}
