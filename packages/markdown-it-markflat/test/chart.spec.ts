// @vitest-environment node
import { readFileSync } from 'node:fs'
import MarkdownIt from 'markdown-it'
import { describe, expect, it } from 'vitest'
import markflat from '../src/index.ts'
import { alignChart, alignCharts, parseRow, rowChords } from '../src/chart.ts'
import { chordHtml } from '../src/chords.ts'
import { detectKey } from '../src/key.ts'

const md = new MarkdownIt().use(markflat)
const corcovado = readFileSync(new URL('./corcovado.mb', import.meta.url), 'utf8')
const chords = (html: string) => [...html.matchAll(/<span class="mb-cc">(.*?)<\/span>(?=<span class="mb-cc">|<\/span>)/g)].map(m => m[1].replace(/<[^>]+>/g, ''))

describe('chart rows', () => {
  it('are bar lines and bars', () => {
    expect(parseRow('{|| a6 | % | F07 F7+ | F7+ ||')).toEqual({ start: '||', bars: ['a6', '%', 'F07 F7+', 'F7+'], ends: ['|', '|', '|', '||'] })
    expect(parseRow('{|: C | G :| {x3}')).toEqual({ start: '|:', bars: ['C', 'G {x3}'], ends: ['|', ':|'] })
    expect(parseRow('{| C | G')).toEqual({ start: '|', bars: ['C', 'G'], ends: ['|', null] })
    expect(parseRow('{| G {D.S. al coda} |.')).toEqual({ start: '|', bars: ['G {D.S. al coda}'], ends: ['|.'] })
    expect(parseRow('| a | b |')).toBeNull() // a Markdown table stays a table
  })
  it('give their chords for the key', () => {
    expect(rowChords('{|| a6 | % | F07 F7+ | N.C. | {coda} C6 ||')).toEqual(['a6', 'F07', 'F7+', 'C6'])
    expect(detectKey(corcovado)).toBe('C') // it ends on C6
    expect(parseRow('{|:}repeat mark in lyrics')).toBeNull()
  })
  it('line up with Align bars', () => {
    expect(alignChart(['~A {4/4}', '{|| a6 | % | Ab07 | % |', '  {| g7 | C7 | F07 F7+ | F7+ ||', 'lyrics'])).toEqual([
      '~A {4/4}',
      '{|| a6 | %  | Ab07    | %   |',
      '  {| g7 | C7 | F07 F7+ | F7+ ||',
      'lyrics',
    ])
  })
})

describe('Align bars over a song', () => {
  it('aligns each chart on its own and leaves the rest', () => {
    expect(alignCharts('# T\n~A\n{| C | G7 |\n{| am | F |\n\n1. {C}text\n{| Dsus4 | D |')).toBe(
      '# T\n~A\n{| C  | G7 |\n{| am | F  |\n\n1. {C}text\n{| Dsus4 | D |')
  })
})

describe('charts', () => {
  it('render the Corcovado example (golden HTML, jazz symbols)', async () => {
    await expect(md.render(corcovado, { jazz: true, unicode: true })).toMatchFileSnapshot('golden/corcovado-jazz.html')
  })
  it('put all rows on one grid, as wide as the longest row', () => {
    const html = md.render('{| C | G |\n{| a | F | C | G |\n{| C |')
    expect(html).toContain('--cols:4')
    expect(html.match(/mb-bar-none/g)).toHaveLength(2 + 3)
  })
  it('show sections, time, repeats, signs, endings and marks', () => {
    const html = md.render('~A {3/4}\n{|: C | % | {1.} G | D :|\n{| {2.} G | {fine} C {segno} |.')
    expect(html).toContain('data-label="A"')
    expect(html).toContain('<span class="mb-section">A</span>')
    expect(html).toContain('title="3/4"')
    expect(html).toContain('data-bl="|:"')
    expect(html).toContain('data-bl=":|"')
    expect(html).toContain('data-bl="|."')
    expect(html).toContain('class="mb-repeat"')
    expect(html).toContain('data-ending="1."')
    expect(html).toContain('data-ending="2."')
    // each ending runs to the next closing bar line or the row's end: 1. over G and D, 2. over G and C
    expect(html.match(/mb-in-ending/g)).toHaveLength(4)
    expect(html).toContain('<span class="mb-mark mb-at-start">fine</span>')
    expect(html).toContain('mb-sign mb-at-end" title="segno"')
  })
  it('end at a blank line or text, and leave label blocks alone', () => {
    const html = md.render('1. {C}verse\n   ~Ch {G}chorus\n{| C | G |\nafter')
    expect(html).toContain('data-label="Ch"')
    expect(html).toContain('class="mb-chart"')
    expect(html.indexOf('mb-chart')).toBeGreaterThan(html.indexOf('chorus'))
    expect(html).toContain('<p>after</p>')
  })
  it('transpose with the song', () => {
    expect(chords(md.render('{| C | F | G7 | a |', { transpose: 3 }))).toEqual(['Eb', 'Ab', 'Bb7', 'c'])
  })
})

describe('jazz symbols', () => {
  it('replace the plain notation', () => {
    const jazz = (c: string) => chordHtml(c, { jazz: true, unicode: true }).replace(/<[^>]+>/g, '')
    expect(['a', 'a6', 'C7+', 'C0', 'Ab07', 'a7b5', 'C+', 'A7b13', 'G7/B', 'e7'].map(jazz)).toEqual(
      ['A–', 'A–6', 'CΔ7', 'C°', 'A♭°7', 'Aø7', 'C+', 'A7♭13', 'G7/B', 'E–7'])
  })
})

describe('the heading', () => {
  it('puts a "(…)" at its end on a remark line under the artist', () => {
    expect(md.render('# Corcovado - Antonio-Carlos Jobim (Bossa Nova)')).toBe(
      '<h1>Corcovado<span class="mb-artist">Antonio-Carlos Jobim<span class="mb-remark">(Bossa Nova)</span></span></h1>\n')
    expect(md.render('# Title (live) - Artist')).toContain('<h1>Title (live)<span class="mb-artist">Artist</span></h1>')
    expect(md.render('# Only a title (capo 2)')).toBe('<h1>Only a title (capo 2)</h1>\n')
  })
})
