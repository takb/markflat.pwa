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

- Vue 3 (`<script setup>`, TypeScript), Vite
- PrimeVue 4 (Aura theme) and Tailwind CSS 4 (`tailwindcss-primeui`), PrimeIcons
- showdown for Markdown, `vue3-touch-events` for gestures
- `vite-plugin-pwa` / Workbox for the service worker, manifest and icons (generated from
  `public/favicon.svg`)
- Backend: one PHP file, [songbook.php](songbook.php), that stores songs as `.mb` files in a
  `mb/` folder next to it
- pnpm (version pinned in `package.json`), Node.js 24

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
| `songbook.php` | the server API |
| `yesterday.mb` | an example song |

## Development

```sh
pnpm install
pnpm dev        # Vite dev server on http://localhost:5173
pnpm build      # type check (vue-tsc) + production build into dist/
pnpm preview    # serve the production build locally
```

The service worker is disabled in dev mode. Use `pnpm build && pnpm preview` to try the PWA
behaviour.

## Server API

`songbook.php` takes `POST` form data. Access is controlled by two shared keys: a read key and a
write key. Users enter them in the app's settings, and the server keeps only their bcrypt hashes.

| Request | Effect |
|---|---|
| `key=<read key>` | returns every song as JSON: `[{title, artist, md}]` |
| `key=<write key>&store=<file>.mb&content=…` | creates or overwrites a song |
| `key=<write key>&delete=<file>.mb` | deletes a song |

The app derives the file name from the song title (lowercase, spaces → `_`, other non-word
characters removed). The API URL is currently hard-coded in the components.

## Deployment

A GitHub Action ([.github/workflows/deploy.yml](.github/workflows/deploy.yml)) runs on every push
to `main`. It builds with `--base /markflat/`, copies `songbook.php` into `dist/`, and uploads the
result over SFTP. The songs live only on the server and are not part of the repository.

## Status

The app works, but it has had almost no changes since mid-2025. A modernisation is
planned:

- update the tooling and dependencies
- replace PrimeVue (from v5 its licence requires a key)
- rewrite the backend with proper authentication and input handling
- add tests and CI checks
- move the app to a new host

## Licence

[GPL-3.0](LICENSE)
