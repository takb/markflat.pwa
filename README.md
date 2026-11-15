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

| Syntax | Meaning |
|---|---|
| `# Title - Artist` | heading. The artist is shown on the right. A trailing ` (…)`, for example the capo position, is not part of the artist name in the songbook list |
| `1.`, `2.` … | numbered verses (a Markdown ordered list) |
| `~Label text…` | a block labelled by the word after `~`, e.g. `~Ch` for a chorus or `~Coda`. It runs until the next `~`, numbered verse or blank line |
| `{X}a` | chord `X` above the character that follows |
| `{X}.` | chord `X` inline, with no syllable under it |
| `{...}`, `{\|\|:}`, `{:\|\|}`, `{'}` | repeat, break and similar marks, placed like chords |
| `==` | a wide space |
| end a line with two spaces | line break inside a verse (standard Markdown) |
| `_text_` | emphasis, shown underlined |

Chord notation: an **uppercase root is major, a lowercase root is minor** (`{a}` = A minor).
`#`/`b` after the root are accidentals, and `/X` adds a bass note (`{D/F#}`). Whatever follows
the root is set as a superscript (`{E7}`). A few spellings are rewritten: `7+` → maj7,
`s2`/`s4` → sus2/sus4, and in the detailed chord view `0` → dim and `+` → aug.

**Transposing** shifts every root and bass note. A chord written with `b` uses the flat scale,
any other chord the sharp scale, and minor chords stay lowercase.

The renderer is a [showdown](https://github.com/showdown/showdown) extension:
[src/composables/markflat.ts](src/composables/markflat.ts).

## Stack

- Vue 3 (`<script setup>`, TypeScript 5.9), Vite 8
- PrimeVue 4.5 (Aura theme, pinned: from v5 its licence requires a key) and Tailwind CSS 4 (`tailwindcss-primeui`), PrimeIcons
- showdown for Markdown, `vue3-touch-events` for gestures
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
| `src/composables/markflat.ts` | the markflat renderer and transposition |
| `src/composables/sizes.ts` | the narrow/wide breakpoint |
| `src/components/List.vue` | songbook table, search, menu (edit mode, settings for the API keys, download) |
| `src/components/Show.vue` | song view: transpose, chord display options, zoom, gestures |
| `src/components/Editor.vue`, `Code.vue` | editor layout, text pane with save/reset/delete |
| `src/components/PWABadge.vue` | "ready offline" and "update available" prompt |
| `songbook.php` | the server API (song folder from `config.php`, written by the deploy) |
| `public/data/.htaccess` | locks the server's song folder against web access |
| `tests/` | unit tests (`unit/`) and browser tests (`e2e/`) |
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

- `tests/unit`: the markflat renderer, transposition and the store. The renderer tests pin
  today's output (with golden HTML for `yesterday.mb` in `tests/unit/golden`), so a rewrite can
  be checked against it. Known bugs have `it.fails` tests that state the intended output.
- `tests/e2e`: a small browser smoke set (songbook download, song view, transposing, editing
  and saving). `tests/e2e/serve.sh` serves the build with `songbook.php` under PHP's built-in
  server, with two songs and test keys in a throwaway folder.

The GitHub workflow `check.yml` runs `pnpm check`'s steps on every branch and pull request; the
deploy runs them first and stops if any fails.

## Server API

`songbook.php` takes `POST` form data. Access is controlled by two shared keys: a read key and a
write key. Users enter them in the app's settings, and the server keeps only their bcrypt hashes.

| Request | Effect |
|---|---|
| `key=<read key>` | returns every song as JSON: `[{title, artist, md}]` |
| `key=<write key>&store=<file>.mb&content=…` | creates or overwrites a song |
| `key=<write key>&delete=<file>.mb` | deletes a song |

The app derives the file name from the song title (lowercase, spaces → `_`, other non-word
characters removed). The app calls `songbook.php` next to itself; `VITE_API_URL` overrides that
(for example to point the dev server at a running backend).

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
tests and CI are in place (November 2026). Still to come:

- fix the renderer's known bugs while moving it to markdown-it
- replace PrimeVue (from v5 its licence requires a key)
- rewrite the backend with proper authentication and input handling
- open markflat.laotravez.de to the public (it is password-protected until then)

## Licence

[GPL-3.0](LICENSE)
