# markdown-it-markflat

A [markdown-it](https://github.com/markdown-it/markdown-it) plugin for **markflat**: song sheets
in Markdown, with chords set above the syllable they belong to. Transposition and the chord
display are options of each rendering, so one instance serves every view.

It was written for [markflat](https://github.com/takb/markflat.pwa), a songbook web app.

```
# Yesterday - The Beatles
1. {C}Yesterday {E}all my {E7}troubles seemed so {a}far away
   {G}Oh {a}I be{D}lieve in {G}yester{C}day
2. Suddenly I'm not half the man I used to be
   ~Ch {E4}Why {E7}she {a}had {G}to {F}go, I don't {G}know
3. (chorus)
   ~Coda {D}Mmm {D7}mmm {F}mmm {C}mmm…
```

## Use

```js
import MarkdownIt from 'markdown-it'
import markflat from 'markdown-it-markflat'
import 'markdown-it-markflat/markflat.css'

const md = new MarkdownIt({ html: false }).use(markflat, { unicode: true })
const html = md.render(song, { transpose: 2 })   // inside an element with class="mb"
```

Plugin options are the defaults; the environment of `md.render` overrides them per call:

| Option | Default | Effect |
|---|---|---|
| `transpose` | `0` | semitones to shift every root and bass note by (negative = down) |
| `unicode` | `false` | ♯ and ♭ instead of `#` and `b` |
| `detailed` | `false` | spelled-out chords: `a` → Am, `C0` → Cdim, `C+` → Caug |

The chord functions are exported too: `transposeNote(note, by)`, `parseChord(text)` and
`chordHtml(text, options)`.

## Syntax

| Syntax | Meaning |
|---|---|
| `---` / `key: Em` / `---` | front matter, at the very top only: `name: value` lines between two `---` lines, not shown. `key` is the song's key (below); other fields are ignored |
| `# Title - Artist` | heading; the part after the first ` - ` is the artist (`<span class="mb-artist">`) |
| `1.`, `2.` … | numbered verses (a Markdown ordered list) |
| `~Label text…` | a block labelled by the word after `~`, e.g. `~Ch` for a chorus or `~Coda`. It runs until the next `~` line, numbered verse or blank line; inside a verse it belongs to that verse. A label alone (`~Instrumental`) is fine |
| `{X}word` | chord `X` above the syllables that follow it, up to the end of the word or the next chord |
| `{X}` at the end of a line, or before a space | above the line's end, or above a wide gap |
| `{X}.` | chord `X` in the text, with no syllable under it |
| `{...}`, `{\|:}`, `{:\|}`, `{'}` … | anything in braces that is not a chord is a mark, placed like a chord (`...` shows as …) |
| `==` | a wide space |
| end a line with two spaces | line break inside a verse (standard Markdown) |
| `_text_` | emphasis (the stylesheet underlines it); a chord may stand right before it |
| `*text*` | italic (`<i>`); `**text**` is bold as usual |

**Chords.** An uppercase root is major, a lowercase root minor (`{a}` = A minor). `#` or `b`
after the root is an accidental; `+` is augmented, `0` diminished; `/X` adds a bass note
(`{D/F#}`, or alone: `{/F#}`). Whatever follows is set as a superscript (`{E7}`, `{a6/9}`), with
`7+` written as maj7 and `s2`/`s4` as sus2/sus4. German `H` is not recognised as a note.

**Keys.** `key:` takes a root with `#`/`b` (or `♯`/`♭`) and `m` for minor: `G`, `Em`, `Bb`,
`F#m`; a lowercase root is minor too (`e`). A song without a key, or with one that is not a key,
gets the one its chords suggest (`detectKey`).

**Transposing** shifts every root and bass note by semitones and spells them in the key the song
ends up in: its common name with at most five accidentals (D♭, not C♯; E♭m, not D♯m; F♯ for a
major song, E♭m for a minor one), notes outside the key by their usual role (♭II ♭III ♯IV ♭VI ♭VII:
B♭ and A♭ in C, not A♯ and G♯), and never B♯, E♯, C♭, F♭ or double accidentals. Minor roots stay
lowercase; untransposed chords stay exactly as written. A key passed in the environment
(`md.render(src, { transpose: 2, key: 'G' })`) wins over the song's; `key: null` turns the
spelling off (a `b` note moves on the flat scale, any other on the sharp scale).

The key functions are exported for apps: `frontMatter`, `withoutFrontMatter`, `withKeyField`
(adds `key:` unless there is one), `parseKey`, `keyName`, `detectKey`, `songKey` (the field, or
the chords), `transposeKey`.

## Chord charts

```
~A {4/4}
{|| a6 | %   | Ab07    | %     |
{|  g7 | C7  | F07 F7+ | F7+   ||
~B
{|| f7 | Bb7 | e7      | A7b13 |
{|  d7 | G7 {coda} ||  | {coda} C6 ||
```

| Syntax | Meaning |
|---|---|
| `{\|` at the start of a line | a chart row (also `{\|\|`, `{\|:`, `{\|.`, `{:\|`); a line starting with a closed mark such as `{\|:}` stays lyrics |
| `\|` `\|\|` `\|.` `\|:` `:\|` | bar lines: single, double, final, repeat start, repeat end |
| chords between bar lines | without braces; several in a bar share it equally |
| `%`, `%%` | repeat the previous bar; the previous two bars (`%%` in the first of the two bars, the second left empty) |
| `-` or nothing | an empty bar |
| `N.C.` | no chord |
| `~A` on its own line before a row | a section label (any word), inverted, above the row's start |
| `~A {4/4}`, or `{4/4}` at a row's start | the time signature before the first bar; `{3/4}` inside a bar is a time change there |
| `{coda}`, `{segno}` | the sign above the bar line it stands next to (first in a bar: the bar line before; after a chord: the one after) |
| `{1.}`, `{2.}` | an ending: a bracket from that bar to the next closing bar line (`:\|` `\|\|` `\|.`) or the row's end |
| `{fine}`, `{D.C.}`, `{D.S. al coda}`, `{x3}` … | any other mark: small text above the bar (at its start, or at its end after a chord); marks after a row's last bar line (`G :\| {x3}`) belong to the bar before |

All rows of a chart (up to a blank line or a line that is no row or label) share one grid with
as many equal bars as its longest row; shorter rows leave the rest empty. Chart chords are 1.6 ×
the lyric size; an app may shrink a chart so its widest bar fits (`markflat.css` does not).
Chart chords count for the song's key and transpose like any other. `alignCharts(src)` pads
every chart's bars so their bar lines line up in the source.

**Chord display.** `md.render(src, { jazz: true })` writes chords with jazz symbols: `a` → A–,
`C7+` → CΔ7, `C0` → C°, `a7b5` → Aø7, `C+` → C+ (in charts and lyrics); `detailed: true` spells
them out (Am, Cmaj7, Cdim). `centered: true` shows a chart bar's only chord in the middle of the
bar (`.mb-chart-centered`; bars with more chords are unchanged). **The heading:** a `(…)` at the very end of `# Title - Artist (…)`
becomes a remark line under the artist (`<span class="mb-remark">`), e.g. a style or a capo
reminder; it is never a transposition.

## Output

| Element | Class |
|---|---|
| chord above its syllables | `<span class="mb-ca"><span class="mb-chord">C</span>Yesterday</span>` |
| chord in the text | `<span class="mb-chord-inline">C</span>` |
| extension, bass | `<sup>7</sup>`, `<sub>/F#</sub>` inside the chord |
| labelled block | `<ul class="mb-block"><li data-label="Ch">…</li></ul>` |
| chart | `<div class="mb-chart" style="--cols:4">`, rows `.mb-row` (a `.mb-gutter` with `.mb-section` and `.mb-time`), bars `.mb-bar` with bar lines `.mb-bl[data-bl]`, chords `.mb-cc`, `.mb-repeat`, `.mb-sign`, `.mb-mark`, endings `.mb-in-ending[data-ending]` |
| heading remark | `<span class="mb-remark">` inside `.mb-artist` |
| a list item, block or paragraph with chords above its lines | gets the class `mb-has-chords` (more line height) |

`markflat.css` styles all of this inside an element with the class `mb`. Charts take their colors
from `--mb-mark` (marks), `--mb-inverse-bg`/`--mb-inverse-fg` (section labels) and `--mb-muted`
(the remark), with black and white defaults.

## License

[MIT](LICENSE)
