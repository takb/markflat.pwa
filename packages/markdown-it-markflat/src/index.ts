import type { MarkdownIt, StateBlock, StateCore, StateInline, Token } from 'markdown-it'
import { CHART_LABEL, chartHtml, isChartRow, parseRow, type ChartRow } from './chart.ts'
import { chordHtml, type ChordOptions } from './chords.ts'
import { frontMatter, songKey } from './key.ts'

export { chordHtml, parseChord, transposeNote, type Chord, type ChordOptions } from './chords.ts'
export { alignChart, alignCharts, barItems, CHART_LABEL, chartHtml, isChartRow, parseRow, rowChords, type BarLine, type ChartRow } from './chart.ts'
export { detectKey, frontMatter, keyName, parseKey, songKey, transposeKey, withKeyField, withoutFrontMatter, type FrontMatter, type Key } from './key.ts'

/**
 * markflat: song sheets in Markdown with chords above the lyrics.
 *
 *   # Title - Artist           heading; the artist is set apart
 *   1. {C}Yesterday {E}all my  numbered verses; {X} puts chord X above the next character
 *   ~Ch {a}chorus line         a block labelled "Ch", up to the next ~, verse or blank line
 *   {C}.  {|:}  ==             a chord with no syllable, a repeat mark, a wide space
 *
 *   ~A {4/4}                    a chord chart: a section label (and time), then rows of bars:
 *   {| a6 | % | Ab07 | % |      `{` and a bar line start a row; chords without braces
 *
 * A front matter block at the very top (`---`, `key: Em`, `---`) is not shown; its key spells
 * transposed chords (without one, the key is worked out from the chords).
 *
 * Options for one rendering go in the environment, so one instance serves every view:
 *   md.render(src, { transpose: 2, unicode: true, detailed: false })
 * Plugin options set the defaults. The classes it emits are styled by `markflat.css`.
 */
export default function markflat(md: MarkdownIt, defaults: ChordOptions = {}): void {
  md.block.ruler.before('table', 'markflat_front_matter', frontMatterBlock)
  md.block.ruler.before('table', 'markflat_chart', chartBlock, { alt: ['paragraph'] })
  md.block.ruler.before('paragraph', 'markflat_block', labelledBlock, { alt: ['paragraph'] })
  md.inline.ruler.before('emphasis', 'markflat_chord', chord)
  md.inline.ruler.before('emphasis', 'markflat_space', wideSpace)
  md.core.ruler.after('block', 'markflat_artist', artist)
  md.core.ruler.push('markflat_has_chords', hasChords)
  md.core.ruler.push('markflat_key', state => { (state.env as KeyEnv).markflatKey = songKey(state.src) })

  // the song's key: given in the environment, or the song's own (set by the core rule above)
  const options = (env: unknown): ChordOptions => {
    const o: ChordOptions = { ...defaults, ...(env as ChordOptions) }
    if (o.key === undefined) o.key = (env as KeyEnv).markflatKey ?? null
    return o
  }
  const rules = md.renderer.rules
  rules.markflat_chord = (tokens, idx, _o, env) => {
    const { base } = tokens[idx].meta as { base: string | null }
    const html = chordHtml(tokens[idx].content, options(env))
    if (base === null) return '<span class="mb-chord-inline">' + html + '</span>'
    const under = base === ' ' ? '&nbsp;&nbsp;&nbsp;' : base === '' ? '&#8203;' : md.utils.escapeHtml(base)
    return '<span class="mb-ca"><span class="mb-chord">' + html + '</span>' + under + '</span>'
  }
  rules.markflat_chart = (tokens, idx, _o, env) => chartHtml((tokens[idx].meta as { rows: ChartRow[] }).rows, options(env))
  rules.markflat_space = () => '&nbsp;&nbsp;'
  // *text* is italic (<i>); _text_ stays emphasis, which the stylesheet underlines
  rules.em_open = (tokens, idx) => (tokens[idx].markup === '*' ? '<i>' : '<em>')
  rules.em_close = (tokens, idx) => (tokens[idx].markup === '*' ? '</i>' : '</em>')
  rules.markflat_artist_open = () => '<span class="mb-artist">'
  rules.markflat_artist_close = () => '</span>'
  rules.markflat_remark_open = () => '<span class="mb-remark">'
  rules.markflat_remark_close = () => '</span>'
  rules.markflat_block_open = (tokens, idx, _o, _env, self) =>
    '<ul class="mb-block"><li' + self.renderAttrs(tokens[idx]) + '>'
  rules.markflat_block_close = () => '</li></ul>\n'
}

interface KeyEnv { markflatKey?: string | null }

// The front matter (`---` … `---` at the very top) is not part of the sheet.
function frontMatterBlock(state: StateBlock, startLine: number, _endLine: number, silent: boolean): boolean {
  if (startLine !== 0 || state.blkIndent !== 0) return false
  const fm = frontMatter(state.src)
  if (!fm) return false
  if (!silent) state.line = fm.lines
  return true
}

// A chord chart: chart rows, each optionally after a section label line (`~A`, `~A {4/4}`), up to
// the first line that is neither (a blank line ends it too).
function chartBlock(state: StateBlock, startLine: number, endLine: number, silent: boolean): boolean {
  if (state.sCount[startLine] - state.blkIndent >= 4) return false
  const text = (n: number) => state.src.slice(state.bMarks[n] + state.tShift[n], state.eMarks[n])
  const labelBeforeRow = (n: number) => CHART_LABEL.test(text(n)) && n + 1 < endLine && isChartRow(text(n + 1))
  if (!isChartRow(text(startLine)) && !labelBeforeRow(startLine)) return false
  if (silent) return true

  const rows: ChartRow[] = []
  let next = startLine
  let label: { name: string, time?: string } | null = null
  for (; next < endLine; next++) {
    if (state.isEmpty(next) || state.sCount[next] < state.blkIndent) break
    if (labelBeforeRow(next)) {
      const m = CHART_LABEL.exec(text(next))!
      label = { name: m[1], time: m[2] }
      continue
    }
    const row = parseRow(text(next))
    if (!row) break
    if (label) {
      row.label = label.name
      if (label.time) row.time = label.time
      label = null
    }
    rows.push(row)
  }
  const token = state.push('markflat_chart', 'div', 0)
  token.block = true
  token.map = [startLine, next]
  token.meta = { rows }
  state.line = next
  return true
}

// ~Label text…: from a line that starts with ~ up to the next such line, a numbered verse or a
// blank line; the text may also start on the next line, or be missing (a label alone, such as
// "~Instrumental"). Inside a verse it nests in the verse's list item.
function labelledBlock(state: StateBlock, startLine: number, endLine: number, silent: boolean): boolean {
  if (state.sCount[startLine] - state.blkIndent >= 4) return false
  const start = state.bMarks[startLine] + state.tShift[startLine]
  const first = state.src.slice(start, state.eMarks[startLine])
  const m = /^~([^\s~]*)(?:[ \t]+|$)/.exec(first)
  if (!m) return false
  if (silent) return true

  let next = startLine + 1
  for (; next < endLine; next++) {
    if (state.isEmpty(next) || state.sCount[next] < state.blkIndent) break
    const line = state.src.slice(state.bMarks[next] + state.tShift[next], state.eMarks[next])
    if (line.startsWith('~') || /^\d+[.)][ \t]/.test(line) || isChartRow(line)) break
  }
  const rest = state.getLines(startLine + 1, next, state.blkIndent, false)
  const content = (first.slice(m[0].length) + (rest ? '\n' + rest : '')).trim()

  const open = state.push('markflat_block_open', 'li', 1)
  open.attrSet('data-label', m[1])
  open.map = [startLine, next]
  open.block = true
  const inline = state.push('inline', '', 0)
  inline.content = content
  inline.map = [startLine, next]
  inline.children = []
  state.push('markflat_block_close', 'li', -1).block = true
  state.line = next
  return true
}

// Characters that start other inline syntax: a chord in front of one of them is anchored to
// the position but takes no character, so emphasis, links etc. still work after it.
const SPECIAL = new Set(['_', '*', '{', '[', '\\', '`', '<', '&', '=', '!', '~'])

// {X}c: chord X above the character c (and the rest of its word); at the end of a line, above
// the line's end. {X}. is a
// chord in the text, with no character under it (the dot is dropped). {X} followed by a space
// takes a wide gap.
function chord(state: StateInline, silent: boolean): boolean {
  const { src, pos } = state
  if (src.charCodeAt(pos) !== 0x7b /* { */) return false
  const end = src.indexOf('}', pos + 1)
  if (end < 0) return false
  const body = src.slice(pos + 1, end).trim()
  if (!body || body.includes('\n')) return false

  let next = end + 1
  let base: string | null
  const c = src.codePointAt(next)
  const ch = c === undefined ? '' : String.fromCodePoint(c)
  if (ch === '.') {
    base = null
    next += 1
  } else if (ch === '' || ch === '\n' || /^[ \t]*(\n|$)/.test(src.slice(next, src.indexOf('\n', next) + 1 || undefined))) {
    // the end of a line: above the line's end (trailing spaces stay, they may be a line break)
    base = ''
  } else if (ch === ' ' || ch === '\t') {
    base = ' '
    next += 1
  } else if (SPECIAL.has(ch)) {
    base = ''
  } else {
    // the chord takes the rest of the word (letters, digits, marks) up to the next chord, so
    // the two share one box: a chord wider than its syllables pushes the line apart instead
    // of overlapping the next chord (B19)
    const word = /^[\p{L}\p{N}\p{M}]+/u.exec(src.slice(next + ch.length))
    base = ch + (word ? word[0] : '')
    next += base.length
  }
  if (!silent) {
    const token = state.push('markflat_chord', '', 0)
    token.content = body
    token.meta = { base }
  }
  state.pos = next
  return true
}

// == is a wide space.
function wideSpace(state: StateInline, silent: boolean): boolean {
  if (state.src.charCodeAt(state.pos) !== 0x3d || state.src.charCodeAt(state.pos + 1) !== 0x3d) return false
  if (!silent) state.push('markflat_space', '', 0)
  state.pos += 2
  return true
}

// "# Title - Artist (remark)": the part after the first " - " becomes the artist, a "(…)" at its
// end a remark line under it.
function artist(state: StateCore): void {
  const tokens = state.tokens
  for (let i = tokens.length - 2; i >= 0; i--) {
    if (tokens[i].type !== 'heading_open' || tokens[i + 1].type !== 'inline') continue
    const inline = tokens[i + 1]
    const m = /^(.*?)\s-\s(.*)$/.exec(inline.content)
    if (!m) continue
    // a "(…)" at the very end is a remark (a style, a capo reminder): a line under the artist
    const r = /^(.*?\S)\s*(\([^()]*\))$/.exec(m[2])
    const make = (type: string, nesting: 1 | 0 | -1, content = '') => {
      const t = new state.Token(type, nesting === 0 ? '' : 'span', nesting)
      t.content = content
      t.map = inline.map
      if (type === 'inline') t.children = []
      return t
    }
    tokens.splice(i + 1, 1,
      make('inline', 0, m[1]),
      make('markflat_artist_open', 1),
      make('inline', 0, r ? r[1] : m[2]),
      ...(r ? [make('markflat_remark_open', 1), make('inline', 0, r[2]), make('markflat_remark_close', -1)] : []),
      make('markflat_artist_close', -1))
  }
}

// A line with chords above it needs more height: its innermost visible container (list item,
// labelled block or paragraph) gets the class mb-has-chords.
function hasChords(state: StateCore): void {
  const open: Token[] = []
  for (const t of state.tokens) {
    if (t.nesting === 1 && ['list_item_open', 'markflat_block_open', 'paragraph_open'].includes(t.type) && !t.hidden) open.push(t)
    else if (t.nesting === -1 && ['list_item_close', 'markflat_block_close', 'paragraph_close'].includes(t.type) && !t.hidden) open.pop()
    else if (t.type === 'inline' && open.length
      && t.children?.some(c => c.type === 'markflat_chord' && (c.meta as { base: string | null }).base !== null)) {
      const container = open[open.length - 1]
      if (!String(container.attrGet('class') ?? '').split(' ').includes('mb-has-chords')) container.attrJoin('class', 'mb-has-chords')
    }
  }
}
