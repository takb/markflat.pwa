import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import showdown from '@/composables/markflat'

// Characterisation tests: they pin what the showdown renderer produces today, so the port to
// markdown-it (M4) can be checked against them. They are not a statement of what is right;
// known bugs are listed separately, as `it.fails` tests of the intended output.

type Options = { transposeBy?: number, detailed?: boolean, unicode?: boolean }
const render = (text: string, o: Options = {}) => {
  const c = new showdown.Converter({ extensions: ['markflat'] })
  c.setOption('mbAddStyle', false)
  c.setOption('mbTransposeBy', o.transposeBy ?? 0)
  c.setOption('mbDetailedChordView', o.detailed ?? false)
  c.setOption('useUnicodeAccidentals', o.unicode ?? false)
  return c.makeHtml(text)
}
// The chord markup of one line, without the surrounding paragraph.
const line = (text: string, o?: Options) => render(text, o).replace(/^<p>|<\/p>$/g, '')

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
        "{C}_a_": "<span class="mb-ca"><span class="mb-chord">C</span><em></span>a</em>",
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
        "<span class="mb-ca"><span class="mb-chord">am</span>a</span>",
        "<span class="mb-ca"><span class="mb-chord">Cdim</span>a</span>",
        "<span class="mb-ca"><span class="mb-chord">Caug</span>a</span>",
        "<span class="mb-ca"><span class="mb-chord">adim</span>a</span>",
        "<span class="mb-ca"><span class="mb-chord">C<sup>maj7</sup></span>a</span>",
      ]
    `)
  })
  it('transposes roots and bass notes', () => {
    expect(['{C}a', '{a}a', '{D/F#}a', '{E7}a', '{Bb}a'].map(c => line(c, { transposeBy: 2 }))).toMatchInlineSnapshot(`
      [
        "<span class="mb-ca"><span class="mb-chord">D</span>a</span>",
        "<span class="mb-ca"><span class="mb-chord">b</span>a</span>",
        "<span class="mb-ca"><span class="mb-chord">E<sub>/G</sub></span>a</span>",
        "<span class="mb-ca"><span class="mb-chord">F#<sup>7</sup></span>a</span>",
        "<span class="mb-ca"><span class="mb-chord">Db</span>a</span>",
      ]
    `)
  })
})

describe('structure', () => {
  it('renders the heading with the artist', () => {
    expect(render('# Song - Artist')).toMatchInlineSnapshot('"<h1 id="songspanclassmbartistartistspan">Song<span class="mb-artist">Artist</span></h1>"')
    expect(render('# Song - Artist (Capo 2)')).toMatchInlineSnapshot('"<h1 id="songspanclassmbartistartistcapo2span">Song<span class="mb-artist">Artist (Capo 2)</span></h1>"')
  })
  it('renders a wide space', () => {
    expect(line('a==b')).toMatchInlineSnapshot('"a&nbsp;&nbsp;b"')
  })
  it('renders numbered verses and labelled blocks', () => {
    expect(render('1. one  \n   two\n2. three\n   ~Ch {C}chorus line\n3. four')).toMatchInlineSnapshot(`
      "<ol>
      <li>one<br />
      two</li>
      <li><p>three</p></li>
      </ol>
      <ul><li class="mb-has-chords" list="Ch"><span class="mb-ca"><span class="mb-chord">C</span>c</span>horus line</li></ul>
      <ol start="3">
      <li>four</li>
      </ol>"
    `)
  })
})

describe('yesterday.mb', () => {
  it('matches the golden HTML', async () => {
    const text = readFileSync('yesterday.mb', 'utf8')
    await expect(render(text, { unicode: true })).toMatchFileSnapshot('golden/yesterday.html')
  })
  it('matches the golden HTML transposed by +3, detailed', async () => {
    const text = readFileSync('yesterday.mb', 'utf8')
    await expect(render(text, { transposeBy: 3, detailed: true, unicode: true })).toMatchFileSnapshot('golden/yesterday-t3-detailed.html')
  })
})

// Known bugs (vault: markflat.pwa/Plan — modernisation, "Known bugs"), fixed in M4. Each test
// states the intended output; when the fix lands it passes and `it.fails` must become `it`.
describe('known bugs', () => {
  it.fails('B8: the detailed view writes a minor chord with a capital root', () => {
    expect(line('{a}a', { detailed: true })).toContain('>Am<')
  })
  it.fails('B9: a repeat mark at the end of a line is rendered, not shown with its braces', () => {
    expect(line('a {:||}\nb')).not.toContain('{')
    expect(line('a {...}')).not.toContain('{')
  })
  it.fails('B16: a flat chord transposes from its own root (Bb + 2 = C)', () => {
    expect(line('{Bb}a', { transposeBy: 2 })).toContain('>C<')
  })
  it.fails('B17: a chord over an emphasised syllable keeps the tags nested', () => {
    expect(line('{C}_a_')).not.toContain('<em></span>')
  })
})
