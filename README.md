# markflat (m♭)

A progressive web app to keep, show, edit and transpose **song sheets with chords**. Songs are
written in **markflat**, a small Markdown dialect for lyrics with inline chords (`.mb` files).
The app runs in the browser, can be installed, and keeps working offline. A small PHP script on
the server holds the shared songbook.

It is a personal tool, made in 2025 to play from on a phone or tablet: open a song, enlarge it
with two fingers, transpose it to your key.

## Features

- **Songbook list**: one row per song, sorted by title (or by artist, from the menu), with a
  search across titles, artists and lyrics that ignores case and accents (`cafe` finds *Café*).
  A dot marks songs changed on this device and not uploaded yet.
- **Song view**: chords sit above the syllable they belong to. A toolbar at the bottom (it hides
  while you scroll down) transposes by semitones and shows by how much, sets the font size, and
  holds ♯/♭ symbols, detailed chord names and the song's history. On a touch screen, pinch to
  change the font size (the song is laid out again, not magnified) and swipe sideways to
  transpose. Back (the button, the browser's, or the phone's back gesture) returns to the list.
- **Editor** (✎ in the song's toolbar, + in the list, for write keys): CodeMirror with markflat
  highlighting (a brace that is no chord looks different, so typos stand out), undo, search,
  and a live preview, side by side on wide screens and in two tabs on narrow ones. Ctrl/Cmd+S
  saves; a changed title renames the song.
- **History**: every save keeps the previous version on the server (the last 20 per song); a
  writer can restore one, and bring back deleted songs.
- **Offline first**: the songbook lives in the browser's `localStorage`. "Download songbook"
  merges the server's copy in without losing changes made here; changes made offline are
  uploaded later. A song changed on both sides asks which version stays.
- **Keys**: every key has a name and either reads or reads and writes; the admin makes and
  revokes them in the app.
- **Light and dark**: follows the system, or set in Settings.
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
- [Reka UI](https://reka-ui.com) (unstyled, accessible components: menus, dialogs, tabs,
  splitter, toasts, toolbar), Tailwind CSS 4, [Lucide](https://lucide.dev) icons
- CodeMirror 6 for the editor (loaded only when a song is edited)
- markdown-it with the markflat plugin; `@vueuse/core`
- `vite-plugin-pwa` / Workbox for the service worker, manifest and icons (generated from
  `public/favicon.svg`)
- Pinia for the app's state
- Backend: [api/](api), plain PHP 8 that stores songs as `.mb` files
- pnpm (version pinned in `package.json`), Node.js 24; ESLint with typescript-eslint and
  eslint-plugin-vue

## Layout

| Path | What |
|---|---|
| `src/App.vue` | switches between the views; the conflict dialog, toasts |
| `src/stores/songbook.ts` | the songbook (Pinia): songs by name, kept in `localStorage`; download merges, save/delete/rename on the server, conflicts |
| `src/stores/settings.ts` | the key and who it belongs to; this device's zoom, colours, order, chord display |
| `src/stores/ui.ts` | the current view and song, tied to the browser history (`#/song/<name>`, …) |
| `src/stores/toast.ts` | short messages |
| `src/api/client.ts` | the API client (`X-Api-Key`, ETags, errors) |
| `src/lib/` | the merge rules, the heading parser and file names, search, gesture rules, the editor's markflat highlighting, safe `localStorage` |
| `src/composables/gestures.ts` | pinch, swipe and tap on a song; the toolbar that hides while scrolling |
| `src/composables/markdown.ts` | the markdown-it instance with the markflat plugin |
| `packages/markdown-it-markflat/` | the plugin: the markflat syntax, chords, transposition, stylesheet, its tests |
| `src/components/List.vue`, `SettingsDialog.vue` | the song list, search, menu; settings (key, colours) |
| `src/components/SongPage.vue`, `SongSheet.vue` | the song page with its toolbar; a rendered song |
| `src/components/Editor.vue`, `CodeEditor.vue` | the editor page (save, undo all, delete, history); CodeMirror |
| `src/components/HistoryPage.vue`, `DeletedPage.vue` | a song's older versions; deleted songs |
| `src/components/ui/` | dialog, menu and toasts on Reka UI |
| `src/components/Keys.vue`, `ConflictDialog.vue` | key management (admin only); both versions of a song changed on both sides |
| `src/components/PWABadge.vue` | "ready offline" and "update available" prompt |
| `api/` | the server API (backend v2): front controller in `public/`, code in `src/`, tests in `tests/` |
| `public/data/.htaccess` | locks the server's song folder against web access |
| `tests/` | the app's unit tests (`unit/`) and browser tests (`e2e/`) |
| `yesterday.mb` | an example song |

## Development

```sh
pnpm install
pnpm dev        # Vite dev server on http://localhost:5173
pnpm build      # type check (vue-tsc) + production build into dist/
pnpm preview    # serve the production build locally
pnpm lint       # ESLint
pnpm api        # the API's checks (php-cs-fixer, PHPStan, PHPUnit)
pnpm test       # unit tests (Vitest); pnpm coverage adds a coverage report
pnpm e2e        # browser tests (Playwright) against the build; needs pnpm build and PHP
pnpm check      # all of the above, the build and an audit of the runtime dependencies
```

For a local API, copy `api/dev/config.example.php` to `api/dev/config.php`, create
`api/dev/data/` with a few `.mb` files, run `composer install` in `api/`, then `pnpm dev:api` next
to `pnpm dev`; the dev server forwards `/api` to it. The example's keys are `dev-read` and
`dev-admin`.

The service worker is disabled in dev mode. Use `pnpm build && pnpm preview` to try the PWA
behaviour.

### Tests

- `packages/markdown-it-markflat/test`: the renderer and transposition, with reference HTML for
  `yesterday.mb` in `test/golden`.
- `tests/unit`: the store. Known bugs have `it.fails` tests that state the intended output.
- `tests/e2e`: a small browser smoke set (songbook download, song view, transposing, editing
  and saving). `tests/e2e/serve.sh` serves the build and the API under PHP's built-in
  server, with two songs and test keys in a throwaway folder.

The GitHub workflow `check.yml` runs `pnpm check`'s steps on every branch and pull request; the
deploy runs them first and stops if any fails.

## Server API

The backend is in [api/](api): plain PHP 8 with Composer autoloading and no framework, served at
`/api/`. Songs are `.mb` files in one folder. Every change keeps the previous version (the
newest 20 per song), and a deleted song can be brought back.

Every request needs a key in the `X-Api-Key` header. Every key has a name: a **read key** reads,
a **write key** also writes, and its name is recorded with every change. The server keeps only
SHA-256 hashes of the keys. The deploy's secrets hold the bootstrap writers
(`php api/bin/new-key.php <name>` makes a key and its hash) and, optionally, a shared read key
(named `shared`). One bootstrap writer, named by the repository variable `MARKFLAT_ADMIN`, is the
admin, who makes and revokes all other keys in the app; they are kept in the song folder. The
bootstrap writers' keys cannot be revoked from the app; the shared read key can, and stays
revoked after later deploys.
Ten wrong keys from one address within ten minutes lock that address out for the rest of the
ten minutes.

| Request | Effect |
|---|---|
| `GET /me` | whose key it is: `{name, writer, canWrite, isAdmin}` (`writer` is null for a read key) |
| `GET /songs` | all songs: `{songs: [{slug, title, artist, etag, content}]}` |
| `GET /songs/{slug}` | one song, with its `ETag` |
| `PUT /songs/{slug}` `{content}` | creates a song, or replaces it with `If-Match: <ETag>` |
| `DELETE /songs/{slug}` | deletes it (`If-Match`) |
| `POST /songs/{slug}/rename` `{to}` | renames it with its history (`If-Match`) |
| `GET /songs/{slug}/revisions` | its old versions, newest first |
| `GET /songs/{slug}/revisions/{id}` | one old version's content |
| `POST /songs/{slug}/revisions/{id}/restore` | makes it current again (`If-Match`, unless the song was deleted) |
| `GET /deleted` | deleted songs that can be restored |
| `GET /keys` | admin: every key (name, role, made when and by whom, last used, from the configuration?, revocable?) |
| `POST /keys` `{name, role}` | admin: a new key, `role` = `read` or `write`; the reply holds the key, shown only this once |
| `DELETE /keys/{name}` | admin: revokes a key (not a bootstrap writer's; `shared` = the configured read key) |

A change based on an outdated copy is refused with `412`, never silently overwritten. New song
names use `a–z`, `0–9`, `_` and `-`. A song may be at most 100 KB.

```sh
cd api && composer install
composer check   # php-cs-fixer, PHPStan (level 8), PHPUnit
```


## Deployment

A GitHub Action ([.github/workflows/deploy.yml](.github/workflows/deploy.yml)) runs on every push
to `main`. After the checks pass (`check.yml`), it builds the app and the API and syncs the result over SFTP to
markflat.laotravez.de with `rclone`. The songs live in `data/` in the webroot (the
host's PHP cannot reach anything outside its webroot). The deploy names that folder in a
generated `config.php`; `data/.htaccess` and a rewrite rule refuse every web request to it, and
the sync leaves its contents alone, so a deploy never touches the songs. They are not in the
repository.
A manual run is a dry run by default.

The new host is being set up: until the modernisation is done the site is password-protected.
The workflow lists the repository variable and secrets it needs.

## Status

The app works. A modernisation is under way: the tooling and dependencies are up to date and the
tests and CI are in place, the renderer is a markdown-it plugin, the app runs on the new backend
with per-person keys, and the interface is rebuilt on Reka UI (November 2026). Still to come:

- open markflat.laotravez.de to the public (it is password-protected until then)

## Licence

[GPL-3.0](LICENSE)
