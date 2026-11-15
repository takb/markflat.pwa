# markflat (m♭)

A progressive web app to keep, show, edit and transpose **song sheets with chords**. Songs are
written in **markflat**, a small Markdown dialect for lyrics with inline chords (`.mb` files).
The app runs in the browser, can be installed, and keeps working offline. A small PHP script on
the server holds the shared songbook.

It is a personal tool, made in 2025 to play from on a phone or tablet: open a song, enlarge it
with a swipe, transpose it to your key.

## Features

- **Songbook list**: sortable by title or artist, with a search across titles, artists and lyrics.
- **Song view**: chords sit above the syllable they belong to. From the floating menu you can
  transpose up or down by semitones, switch between ♯/♭ symbols and `#`/`b`, show detailed chord
  names, and zoom (0.5×–2×). On a touch screen, swipe right to zoom in, swipe left to zoom out,
  and long-press to go back to the list.
- **Editor** (switch on "Edit mode" in the list menu): a plain-text pane with a live preview.
  The panes sit side by side on wide screens and in two tabs on narrow ones (≤ 1200 px).
  Ctrl/Cmd+S saves.
- **Offline first**: the songbook lives in the browser's `localStorage`. "Download songbook"
  replaces it with the server's copy, and saving or deleting a song also sends the change to the
  server.
- **Installable PWA** (service worker via Workbox). When a new version is deployed, the app
  offers a reload.

## The markflat format

```
# Yesterday - The Beatles
1. {C}Yesterday {E}all my {E7}troubles seemed so {a}far away
   {G}Oh {a}I be{D}lieve in {G}yester{C}day
2. Suddenly I'm not half the man I used to be
   ~Ch {E4}Why {E7}she {a}had {G}to {F}go, I don't {G}know
3. (chorus)
   ~Coda {D}Mmm {D7}mmm {F}mmm {C}mmm…
```

Verses are numbered, `~Ch` labels a chorus, `{X}` puts chord X above the next character, and an
uppercase root is major, a lowercase one minor. The full syntax, the transposition rules and the
display options are in the plugin's README:
[packages/markdown-it-markflat](packages/markdown-it-markflat/README.md).

The renderer is a [markdown-it](https://github.com/markdown-it/markdown-it) plugin,
[markdown-it-markflat](packages/markdown-it-markflat) (MIT), kept in this repository as a
package of its own. Raw HTML in a song is shown as text, not run.

## Stack

- Vue 3 (`<script setup>`, TypeScript 5.9), Vite 8
- PrimeVue 4.5 (Aura theme, pinned: from v5 its licence requires a key) and Tailwind CSS 4 (`tailwindcss-primeui`), PrimeIcons
- markdown-it with the markflat plugin, `vue3-touch-events` for gestures
- `vite-plugin-pwa` / Workbox for the service worker, manifest and icons (generated from
  `public/favicon.svg`)
- Backend: one PHP file, [songbook.php](songbook.php), that stores songs as `.mb` files in a
  `mb/` folder next to it
- pnpm (version pinned in `package.json`), Node.js 24; ESLint with typescript-eslint and
  eslint-plugin-vue

## Layout

| Path | What |
|---|---|
| `src/App.vue` | switches between list, song and editor views |
| `src/composables/store.ts` | the app state (songbook, selected song, view, API keys, zoom) and its persistence in `localStorage` |
| `src/composables/markdown.ts` | the markdown-it instance with the markflat plugin |
| `packages/markdown-it-markflat/` | the plugin: the markflat syntax, chords, transposition, stylesheet, its tests |
| `src/composables/sizes.ts` | the narrow/wide breakpoint |
| `src/components/List.vue` | songbook table, search, menu (edit mode, settings for the API keys, download) |
| `src/components/Show.vue` | song view: transpose, chord display options, zoom, gestures |
| `src/components/Editor.vue`, `Code.vue` | editor layout, text pane with save/reset/delete |
| `src/components/PWABadge.vue` | "ready offline" and "update available" prompt |
| `api/` | the server API (backend v2): front controller in `public/`, code in `src/`, tests in `tests/` |
| `songbook.php` | the old server API, used by the app until it moves to `api/` |
| `public/data/.htaccess` | locks the server's song folder against web access |
| `tests/` | the app's unit tests (`unit/`) and browser tests (`e2e/`) |
| `yesterday.mb` | an example song |

## Development

```sh
pnpm install
pnpm dev        # Vite dev server on http://localhost:5173
pnpm build      # type check (vue-tsc) + production build into dist/
pnpm preview    # serve the production build locally
pnpm lint       # ESLint, and php -l on songbook.php
pnpm test       # unit tests (Vitest); pnpm coverage adds a coverage report
pnpm e2e        # browser tests (Playwright) against the build; needs pnpm build and PHP
pnpm check      # all of the above, the build and an audit of the runtime dependencies
```

The service worker is disabled in dev mode. Use `pnpm build && pnpm preview` to try the PWA
behaviour.

### Tests

- `packages/markdown-it-markflat/test`: the renderer and transposition, with reference HTML for
  `yesterday.mb` in `test/golden`.
- `tests/unit`: the store. Known bugs have `it.fails` tests that state the intended output.
- `tests/e2e`: a small browser smoke set (songbook download, song view, transposing, editing
  and saving). `tests/e2e/serve.sh` serves the build with `songbook.php` under PHP's built-in
  server, with two songs and test keys in a throwaway folder.

The GitHub workflow `check.yml` runs `pnpm check`'s steps on every branch and pull request; the
deploy runs them first and stops if any fails.

## Server API

The backend is in [api/](api): plain PHP 8 with Composer autoloading and no framework, served at
`/api/`. Songs are `.mb` files in one folder. Every change keeps the previous version (the
newest 20 per song), and a deleted song can be brought back.

Every request needs a key in the `X-Api-Key` header. One shared **read key** reads; each writer
has their own **write key**, which also reads, and is recorded with every change. The server keeps
only SHA-256 hashes of the keys (`php api/bin/new-key.php <name>` makes a key and its hash).
Ten wrong keys from one address within ten minutes lock that address out for the rest of the
ten minutes.

| Request | Effect |
|---|---|
| `GET /me` | whose key it is: `{writer, canWrite}` |
| `GET /songs` | all songs: `{songs: [{slug, title, artist, etag, content}]}` |
| `GET /songs/{slug}` | one song, with its `ETag` |
| `PUT /songs/{slug}` `{content}` | creates a song, or replaces it with `If-Match: <ETag>` |
| `DELETE /songs/{slug}` | deletes it (`If-Match`) |
| `POST /songs/{slug}/rename` `{to}` | renames it with its history (`If-Match`) |
| `GET /songs/{slug}/revisions` | its old versions, newest first |
| `GET /songs/{slug}/revisions/{id}` | one old version's content |
| `POST /songs/{slug}/revisions/{id}/restore` | makes it current again (`If-Match`, unless the song was deleted) |
| `GET /deleted` | deleted songs that can be restored |

A change based on an outdated copy is refused with `412`, never silently overwritten. New song
names use `a–z`, `0–9`, `_` and `-`. A song may be at most 100 KB.

```sh
cd api && composer install
composer check   # php-cs-fixer, PHPStan (level 8), PHPUnit
```

Until the app moves to the new API, it still uses the old `songbook.php` (form posts with the old
keys).

## Deployment

A GitHub Action ([.github/workflows/deploy.yml](.github/workflows/deploy.yml)) runs on every push
to `main`. After the checks pass (`check.yml`), it builds the app, copies `songbook.php` next to it and syncs the result over SFTP to
markflat.laotravez.de with `rclone`. The songs live in `data/` next to `songbook.php` (the
host's PHP cannot reach anything outside its webroot). The deploy names that folder in a
generated `config.php`; `data/.htaccess` and a rewrite rule refuse every web request to it, and
the sync leaves its contents alone, so a deploy never touches the songs. They are not in the
repository. Without `config.php` (local development) `songbook.php` uses `mb/` next to itself.
A manual run is a dry run by default.

The new host is being set up: until the modernisation is done the site is password-protected.
The workflow lists the repository variable and secrets it needs.

## Status

The app works. A modernisation is under way: the tooling and dependencies are up to date and the
tests and CI are in place, the renderer is a markdown-it plugin and the new backend is written
(November 2026). Still to come:

- move the app onto the new backend (`api/`)
- replace PrimeVue (from v5 its licence requires a key)
- open markflat.laotravez.de to the public (it is password-protected until then)

## Licence

[GPL-3.0](LICENSE)
