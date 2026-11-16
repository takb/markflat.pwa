// @vitest-environment node
import MarkdownIt from 'markdown-it'
import { describe, expect, it } from 'vitest'
import markflat from '../src/index.ts'
import { detectKey, frontMatter, parseKey, songKey, spellIn, transposeKey, withKeyField, withoutFrontMatter } from '../src/key.ts'

const md = new MarkdownIt().use(markflat)
const chords = (src: string, transpose: number) =>
  [...md.render(src, { transpose }).matchAll(/class="mb-chord">(.*?)<\/span>/g)].map(m => m[1].replace(/<[^>]+>/g, ''))
const song = (key: string | null, line: string) => (key ? '---\nkey: ' + key + '\n---\n' : '') + '# T - A\n1. ' + line + '\n'

describe('front matter', () => {
  it('is read at the very top only', () => {
    expect(frontMatter('---\nkey: Em\nTempo: 92\n---\n# T')).toEqual({ fields: { key: 'Em', tempo: '92' }, lines: 4 })
    expect(frontMatter('# T\n---\nkey: Em\n---\n')).toBeNull()
    expect(frontMatter('---\nkey: Em\n# T')).toBeNull() // never closed
    expect(withoutFrontMatter('---\nkey: Em\n---\n# T\n')).toBe('# T\n')
  })
  it('is not rendered', () => {
    const html = md.render('---\nkey: Em\n---\n# Title - Artist\n1. {e}la\n')
    expect(html).not.toContain('key')
    expect(html).not.toContain('<hr')
    expect(html.startsWith('<h1>Title')).toBe(true)
  })
  it('gets a key field once', () => {
    expect(withKeyField('# T\n', 'G')).toBe('---\nkey: G\n---\n# T\n')
    expect(withKeyField('---\ntempo: 92\n---\n# T\n', 'G')).toBe('---\nkey: G\ntempo: 92\n---\n# T\n')
    expect(withKeyField('---\nkey: Bb\n---\n# T\n', 'G')).toBe('---\nkey: Bb\n---\n# T\n')
  })
})

describe('keys', () => {
  it('are parsed in the usual spellings', () => {
    expect(['G', 'Em', 'e', 'Bb', 'B♭', 'F#m', 'f#', 'C minor', 'H', 'X'].map(k => JSON.stringify(parseKey(k)))).toEqual([
      '{"tonic":7,"minor":false}', '{"tonic":4,"minor":true}', '{"tonic":4,"minor":true}', '{"tonic":10,"minor":false}',
      '{"tonic":10,"minor":false}', '{"tonic":6,"minor":true}', '{"tonic":6,"minor":true}', '{"tonic":0,"minor":true}', 'null', 'null',
    ])
  })
  it('transpose to their common names (at most five accidentals)', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(n => transposeKey('C', n))).toEqual(
      ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'])
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(n => transposeKey('Am', n))).toEqual(
      ['Am', 'Bbm', 'Bm', 'Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m'])
  })
  it('spell notes by their role in the key', () => {
    const scale = (key: string) => [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(n => spellIn(n, key)).join(' ')
    expect(scale('C')).toBe('C Db D Eb E F F# G Ab A Bb B')
    expect(scale('Bb')).toBe('C Db D Eb E F Gb G Ab A Bb B')
    expect(scale('E')).toBe('C C# D D# E F F# G G# A A# B')
    expect(scale('F#')).toBe('C C# D D# E F F# G G# A A# B') // B♯ and E♯ as C and F
    expect(scale('Am')).toBe('C C# D D# E F F# G G# A Bb B')
    expect(scale('Ebm')).toBe('C Db D Eb E F Gb G Ab A Bb B') // C♭ as B
  })
  it('are found from the chords', () => {
    expect(detectKey('1. {G}a {C}b {D}c {e}d {G}e')).toBe('G')
    expect(detectKey('1. {a}a {d}b {E}c {G}d {F}e {a}f')).toBe('Am')
    expect(detectKey('1. {F}a {Bb}b {C7}c {F}d')).toBe('F')
    expect(detectKey('1. {Eb}a {Ab}b {Bb7}c {c}d {Eb}e')).toBe('Eb')
    expect(detectKey('1. {e}a {C}b {G}c {D}d {e}e')).toBe('Em')
    expect(detectKey('# T\nno chords')).toBeNull()
  })
  it('come from the field before the chords', () => {
    expect(songKey(song('Dm', '{F}a {C}b'))).toBe('Dm')
    expect(songKey(song('C#', '{F}a'))).toBe('Db')
    expect(songKey(song('nonsense', '{F}a {Bb}b {C}c {F}d'))).toBe('F')
  })
})

describe('transposed chords', () => {
  it('are spelled in the key they end up in', () => {
    const line = '{G}a {C}b {D}c {e}d {F}e {Bb}f {G}g'
    expect(chords(song(null, line), 3)).toEqual(['Bb', 'Eb', 'F', 'gm'.slice(0, 1), 'Ab', 'Db', 'Bb'])
    expect(chords(song('G', line), 3)).toEqual(chords(song(null, line), 3))
  })
  it('in a minor song', () => {
    expect(chords(song(null, '{a}a {d}b {E}c {G}d {F}e {a}f'), 1)).toEqual(['bb', 'eb', 'F', 'Ab', 'Gb', 'bb'])
  })
  it('follow the stated key over the chords', () => {
    // these chords suggest C; stated as A minor, up 6 gives E♭ minor (flats), not F♯ major
    expect(chords(song('Am', '{C}a {F}b {G}c {C}d'), 6)).toEqual(['Gb', 'B', 'Db', 'Gb'])
    expect(chords(song(null, '{C}a {F}b {G}c {C}d'), 6)).toEqual(['F#', 'B', 'C#', 'F#'])
  })
  it('include the bass', () => {
    expect(chords(song('C', '{C/E}a {F/G}b'), 1)).toEqual(['Db/F', 'Gb/Ab'])
  })
  it('stay as written when not transposed', () => {
    expect(chords(song('G', '{A#}a {Gb}b'), 0)).toEqual(['A#', 'Gb'])
  })
})
