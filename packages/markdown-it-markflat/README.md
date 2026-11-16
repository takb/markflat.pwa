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

**Chords.** An uppercase root is major, a lowercase root minor (`{a}` = A minor). `#` or `b`
after the root is an accidental; `+` is augmented, `0` diminished; `/X` adds a bass note
(`{D/F#}`, or alone: `{/F#}`). Whatever follows is set as a superscript (`{E7}`, `{a6/9}`), with
`7+` written as maj7 and `s2`/`s4` as sus2/sus4. German `H` is not recognised as a note.

**Transposing** shifts every root and bass note by semitones. A note written with `b` moves on the
flat scale, any other on the sharp scale, and minor roots stay lowercase.

## Output

| Element | Class |
|---|---|
| chord above its syllables | `<span class="mb-ca"><span class="mb-chord">C</span>Yesterday</span>` |
| chord in the text | `<span class="mb-chord-inline">C</span>` |
| extension, bass | `<sup>7</sup>`, `<sub>/F#</sub>` inside the chord |
| labelled block | `<ul class="mb-block"><li data-label="Ch">…</li></ul>` |
| a list item, block or paragraph with chords above its lines | gets the class `mb-has-chords` (more line height) |

`markflat.css` styles all of this inside an element with the class `mb`.

## Licence

[MIT](LICENSE)
