// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import MarkdownIt from 'markdown-it'
import markflat from '../src/index.ts'

// These began as characterisation tests of the old showdown renderer (markflat.pwa, 2026-11);
// the snapshots now hold this plugin's output, reviewed against the old one.

type Options = { transposeBy?: number, detailed?: boolean, unicode?: boolean }
const md = new MarkdownIt({ html: false }).use(markflat)
const render = (text: string, o: Options = {}) =>
  md.render(text, { transpose: o.transposeBy ?? 0, detailed: o.detailed ?? false, unicode: o.unicode ?? false })
// The chord markup of one line, without the surrounding paragraph.
const line = (text: string, o?: Options) => render(text, o).replace(/^<p[^>]*>|<\/p>\n$/g, '')

describe('chords', () => {
  const cases = [
    '{C}a', '{a}a', '{F#}a', '{Bb}a', '{E7}a', '{a7}a', '{D/F#}a', '{C7+}a', '{Ds4}a', '{As2}a',
    '{C0}a', '{C+}a', '{Gm}a', '{C}.', '{C} a', '{C}_a_', '{...}a', '{||:}a', '{:||}a', "{'}a",
    '{...}.', '{C}a{G}b',
  ]
  it('renders each notation', () => {
    expect(Object.fromEntries(cases.map(c => [c, line(c)]))).toMatchInlineSnapshot(`
      {
        "{'}a": "<span class="mb-ca"><span class="mb-chord">'</span>a</span>",
        "{...}.": "<span class="mb-chord-inline">…</span>",
        "{...}a": "<span class="mb-ca"><span class="mb-chord">…</span>a</span>",
        "{:||}a": "<span class="mb-ca"><span class="mb-chord">:||</span>a</span>",
        "{As2}a": "<span class="mb-ca"><span class="mb-chord">A<sup>sus2</sup></span>a</span>",
        "{Bb}a": "<span class="mb-ca"><span class="mb-chord">Bb</span>a</span>",
        "{C+}a": "<span class="mb-ca"><span class="mb-chord">C+</span>a</span>",
        "{C0}a": "<span class="mb-ca"><span class="mb-chord">C0</span>a</span>",
        "{C7+}a": "<span class="mb-ca"><span class="mb-chord">C<sup>maj7</sup></span>a</span>",
        "{C} a": "<span class="mb-ca"><span class="mb-chord">C</span>&nbsp;&nbsp;&nbsp;</span>a",
        "{C}.": "<span class="mb-chord-inline">C</span>",
        "{C}_a_": "<span class="mb-ca"><span class="mb-chord">C</span></span><em>a</em>",
        "{C}a": "<span class="mb-ca"><span class="mb-chord">C</span>a</span>",
        "{C}a{G}b": "<span class="mb-ca"><span class="mb-chord">C</span>a</span><span class="mb-ca"><span class="mb-chord">G</span>b</span>",
        "{D/F#}a": "<span class="mb-ca"><span class="mb-chord">D<sub>/F#</sub></span>a</span>",
        "{Ds4}a": "<span class="mb-ca"><span class="mb-chord">D<sup>sus4</sup></span>a</span>",
        "{E7}a": "<span class="mb-ca"><span class="mb-chord">E<sup>7</sup></span>a</span>",
        "{F#}a": "<span class="mb-ca"><span class="mb-chord">F#</span>a</span>",
        "{Gm}a": "<span class="mb-ca"><span class="mb-chord">Gm</span>a</span>",
        "{a7}a": "<span class="mb-ca"><span class="mb-chord">a<sup>7</sup></span>a</span>",
        "{a}a": "<span class="mb-ca"><span class="mb-chord">a</span>a</span>",
        "{||:}a": "<span class="mb-ca"><span class="mb-chord">||:</span>a</span>",
      }
    `)
  })
  it('renders with unicode accidentals', () => {
    expect(['{F#}a', '{Bb}a', '{D/F#}a', '{Eb/Bb}a', '{C#7}a'].map(c => line(c, { unicode: true }))).toMatchInlineSnapshot(`
      [
        "<span class="mb-ca"><span class="mb-chord">F♯</span>a</span>",
        "<span class="mb-ca"><span class="mb-chord">B♭</span>a</span>",
        "<span class="mb-ca"><span class="mb-chord">D<sub>/F♯</sub></span>a</span>",
        "<span class="mb-ca"><span class="mb-chord">E♭<sub>/B♭</sub></span>a</span>",
        "<span class="mb-ca"><span class="mb-chord">C♯<sup>7</sup></span>a</span>",
      ]
    `)
  })
  it('renders the detailed chord view', () => {
    expect(['{a}a', '{C0}a', '{C+}a', '{a0}a', '{C7+}a'].map(c => line(c, { detailed: true }))).toMatchInlineSnapshot(`
      [
        "<span class="mb-ca"><span class="mb-chord">Am</span>a</span>",
        "<span class="mb-ca"><span class="mb-chord">Cdim</span>a</span>",
        "<span class="mb-ca"><span class="mb-chord">Caug</span>a</span>",
        "<span class="mb-ca"><span class="mb-chord">Adim</span>a</span>",
        "<span class="mb-ca"><span class="mb-chord">C<sup>maj7</sup></span>a</span>",
      ]
    `)
  })
  it('transposes roots and bass notes', () => {
    expect(['{C}a', '{a}a', '{D/F#}a', '{E7}a', '{Bb}a'].map(c => line(c, { transposeBy: 2 }))).toMatchInlineSnapshot(`
      [
        "<span class="mb-ca"><span class="mb-chord">D</span>a</span>",
        "<span class="mb-ca"><span class="mb-chord">b</span>a</span>",
        "<span class="mb-ca"><span class="mb-chord">E<sub>/G#</sub></span>a</span>",
        "<span class="mb-ca"><span class="mb-chord">F#<sup>7</sup></span>a</span>",
        "<span class="mb-ca"><span class="mb-chord">C</span>a</span>",
      ]
    `)
  })
})

describe('structure', () => {
  it('renders the heading with the artist', () => {
    expect(render('# Song - Artist')).toMatchInlineSnapshot(`
      "<h1>Song<span class="mb-artist">Artist</span></h1>
      "
    `)
    expect(render('# Song - Artist (Capo 2)')).toMatchInlineSnapshot(`
      "<h1>Song<span class="mb-artist">Artist (Capo 2)</span></h1>
      "
    `)
  })
  it('renders a wide space', () => {
    expect(line('a==b')).toMatchInlineSnapshot('"a&nbsp;&nbsp;b"')
  })
  it('renders numbered verses and labelled blocks', () => {
    expect(render('1. one  \n   two\n2. three\n   ~Ch {C}chorus line\n3. four')).toMatchInlineSnapshot(`
      "<ol>
      <li>one<br>
      two</li>
      <li>three<ul class="mb-block"><li data-label="Ch" class="mb-has-chords"><span class="mb-ca"><span class="mb-chord">C</span>c</span>horus line</li></ul>
      </li>
      <li>four</li>
      </ol>
      "
    `)
  })
})

describe('yesterday.mb', () => {
  it('matches the golden HTML', async () => {
    const text = readFileSync(new URL('./yesterday.mb', import.meta.url), 'utf8')
    await expect(render(text, { unicode: true })).toMatchFileSnapshot('golden/yesterday.html')
  })
  it('matches the golden HTML transposed by +3, detailed', async () => {
    const text = readFileSync(new URL('./yesterday.mb', import.meta.url), 'utf8')
    await expect(render(text, { transposeBy: 3, detailed: true, unicode: true })).toMatchFileSnapshot('golden/yesterday-t3-detailed.html')
  })
})

// Bugs of the old renderer (B8, B9, B16, B17 in the markflat.pwa plan), fixed here.
describe('fixed bugs of the old renderer', () => {
  it('B8: the detailed view writes a minor chord with a capital root', () => {
    expect(line('{a}a', { detailed: true })).toContain('>Am<')
  })
  it('B9: a repeat mark at the end of a line is rendered, not shown with its braces', () => {
    expect(line('a {:||}\nb')).not.toContain('{')
    expect(line('a {...}')).not.toContain('{')
  })
  it('B16: a flat chord transposes from its own root (Bb + 2 = C)', () => {
    expect(line('{Bb}a', { transposeBy: 2 })).toContain('>C<')
  })
  it('B17: a chord over an emphasised syllable keeps the tags nested', () => {
    expect(line('{C}_a_')).not.toContain('<em></span>')
  })
})
