// Chord charts (plan "chord charts", C1–C8): bars in rows. Pure functions, no markdown-it.
//
//   ~A {4/4}
//   {| a6    | %      | Ab07     | %   |
//   {| g7    | C7     | F07 F7+  | F7+ ||
//   {| d7    | G7 {coda} ||       | {coda} C6 ||
//
// A row starts with `{` and a bar line. Bar lines: `|` single, `||` double, `|.` final, `|:` and
// `:|` repeats. A bar holds chords (no braces: in a chart everything is a chord), `%` (repeat the
// bar) or `%%` (the two bars), `-` or nothing (an empty bar), `N.C.`, and marks in braces: `{coda}`
// and `{segno}` (above the bar line they stand next to), `{1.}` `{2.}` (endings, up to the next
// closing bar line), `{3/4}` (a time change), anything else as small text (`{fine}`, `{x3}`).
// `~A` on the line before a row labels it; `~A {4/4}` also sets the time signature.

import { chordHtml, parseChord, type ChordOptions } from './chords.ts'

export type BarLine = '|' | '||' | '|.' | '|:' | ':|'

export interface ChartRow {
  /** the bar line the row starts with */
  start: BarLine
  /** the bars' text, as written between the bar lines */
  bars: string[]
  /** the bar line after each bar; null after a last bar that has none */
  ends: (BarLine | null)[]
  /** a section label from the line before (`~A`) */
  label?: string
  /** a time signature from the label line (`~A {4/4}`) */
  time?: string
}

/**
 * A line that is a chart row: `{|`, `{||`, `{|:`, `{|.` or `{:|` at its start. A line that starts
 * with a closed repeat mark (`{|:}`, `{:||}`) is lyrics.
 */
export const isChartRow = (line: string) => /^\{(\||:\|)/.test(line.trim()) && !/^\{[|:.]*\}/.test(line.trim())

/** A section label line in a chart: `~A`, or `~A {4/4}`. */
export const CHART_LABEL = /^~([^\s~{]+)(?:[ \t]+\{(\d+\/\d+)\})?[ \t]*$/

const BAR_LINE = /^(:\||\|\||\|\.|\|:|\|)/

/** A row's bar lines and bars; null for a line that is no chart row. */
export function parseRow(line: string): ChartRow | null {
  const text = line.trim()
  if (!isChartRow(text)) return null
  let pos = 1
  const first = BAR_LINE.exec(text.slice(pos))
  if (!first) return null
  pos += first[0].length
  const row: ChartRow = { start: first[0] as BarLine, bars: [], ends: [] }
  let cell = ''
  while (pos < text.length) {
    const c = text[pos]
    if (c === '{') {
      const end = text.indexOf('}', pos)
      const stop = end < 0 ? text.length : end + 1
      cell += text.slice(pos, stop)
      pos = stop
      continue
    }
    const bar = BAR_LINE.exec(text.slice(pos))
    if (bar) {
      row.bars.push(cell.trim())
      row.ends.push(bar[0] as BarLine)
      cell = ''
      pos += bar[0].length
      continue
    }
    cell += c
    pos++
  }
  if (cell.trim()) {
    row.bars.push(cell.trim())
    row.ends.push(null)
  }
  return row
}

/** The words of a bar: chords and marks; a mark in braces may hold spaces (`{D.S. al coda}`). */
export function barItems(bar: string): string[] {
  return bar.match(/\{[^}]*\}?|[^\s{]+/g) ?? []
}

/** Every chord in a chart row, as written (for finding the song's key). */
export function rowChords(line: string): string[] {
  const row = parseRow(line)
  if (!row) return []
  return row.bars.flatMap(barItems).filter(w => !w.startsWith('{') && parseChord(w) !== null)
}

// ---- HTML

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const SIGN: Record<string, string> = {
  coda: '<svg class="mb-sign-svg" viewBox="0 0 20 24" aria-hidden="true"><ellipse cx="10" cy="12" rx="5.5" ry="7.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10 1v22M1 12h18" stroke="currentColor" stroke-width="1.6"/></svg>',
  segno: '<svg class="mb-sign-svg" viewBox="0 0 20 24" aria-hidden="true"><path d="M14 6.5c0-2-2-3.5-4.2-3.5S5.5 4.4 5.5 6.6c0 4.6 9 5 9 10.2 0 2.4-2 4.2-4.6 4.2S5.8 19.4 5.8 17.4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 21 17 3" stroke="currentColor" stroke-width="1.4"/><circle cx="4" cy="10" r="1.5" fill="currentColor"/><circle cx="16" cy="14" r="1.5" fill="currentColor"/></svg>',
}
const REPEAT = (n: number) => '<svg class="mb-repeat-svg" viewBox="0 0 ' + (10 + 8 * n) + ' 20" aria-hidden="true">'
  + Array.from({ length: n }, (_, i) => '<path d="M' + (3 + 8 * i) + ' 17 ' + (11 + 8 * i) + ' 3" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>').join('')
  + '<circle cx="3.5" cy="5" r="2" fill="currentColor"/><circle cx="' + (6.5 + 8 * n) + '" cy="15" r="2" fill="currentColor"/></svg>'

const CLOSING = new Set<BarLine | null>([':|', '||', '|.'])

function barLine(t: BarLine | null, side: 'start' | 'end'): string {
  return t ? '<span class="mb-bl mb-bl-' + side + '" data-bl="' + escapeHtml(t) + '"></span>' : ''
}

/** A chart as HTML: one grid for all its rows, as many columns as its longest row has bars. */
export function chartHtml(rows: ChartRow[], o: ChordOptions = {}): string {
  const cols = Math.max(1, ...rows.map(r => r.bars.length))
  let ending: string | null = null
  const out: string[] = []
  for (const row of rows) {
    const items = row.bars.map(barItems)
    // a time signature at the very start of a row stands before its first bar, as on a label line
    let time = row.time
    if (!time && /^\{\d+\/\d+\}$/.test(items[0]?.[0] ?? '')) time = items[0].shift()!.slice(1, -1)
    let html = '<div class="mb-row"' + (row.label ? ' data-label="' + escapeHtml(row.label) + '"' : '') + '>'
    html += '<span class="mb-gutter">'
      + (row.label ? '<span class="mb-section">' + escapeHtml(row.label) + '</span>' : '')
      + (time ? timeHtml(time) : '')
      + '</span>'
    items.forEach((words, i) => {
      const left = i === 0 ? row.start : row.ends[i - 1]
      const last = i === row.bars.length - 1
      const marks: string[] = []
      const content: string[] = []
      let seenChord = false
      for (const w of words) {
        if (w.startsWith('{')) {
          const inner = w.replace(/^\{|\}$/g, '').trim()
          const name = inner.toLowerCase()
          const side = seenChord ? 'end' : 'start'
          if (/^\d+\/\d+$/.test(inner)) content.push(timeHtml(inner, true))
          else if (/^\d+\.$/.test(inner)) ending = inner
          else if (SIGN[name]) marks.push('<span class="mb-sign mb-at-' + side + '" title="' + name + '">' + SIGN[name] + '</span>')
          else marks.push('<span class="mb-mark mb-at-' + side + '">' + escapeHtml(inner) + '</span>')
          continue
        }
        seenChord = true
        if (w === '%' || w === '%%') content.push('<span class="mb-repeat' + (w === '%%' ? ' mb-repeat-2' : '') + '" title="repeat ' + (w === '%%' ? 'the last two bars' : 'the bar') + '">' + REPEAT(w.length) + '</span>')
        else if (w === '-') continue
        else if (w === 'N.C.') content.push('<span class="mb-cc mb-nc">N.C.</span>')
        else content.push('<span class="mb-cc">' + chordHtml(w, o) + '</span>')
      }
      const endingStart = ending !== null && words.some(w => /^\{\d+\.\}$/.test(w))
      const classes = ['mb-bar']
      if (ending !== null) classes.push('mb-in-ending')
      html += '<div class="' + classes.join(' ') + '"' + (endingStart ? ' data-ending="' + escapeHtml(ending!) + '"' : '') + '>'
        + barLine(left, 'start')
        + marks.join('')
        + '<span class="mb-chords" style="--n:' + Math.max(1, content.length) + '">' + content.join('') + '</span>'
        + (last ? barLine(row.ends[i], 'end') : '')
        + '</div>'
      // an ending runs to the next closing bar line, or to the row's end
      if (ending !== null && (CLOSING.has(row.ends[i]) || last)) ending = null
    })
    for (let i = row.bars.length; i < cols; i++) html += '<div class="mb-bar mb-bar-none"></div>'
    out.push(html + '</div>')
  }
  return '<div class="mb-chart" style="--cols:' + cols + '">\n' + out.join('\n') + '\n</div>\n'
}

function timeHtml(time: string, inBar = false): string {
  const [top, bottom] = time.split('/')
  return '<span class="mb-time' + (inBar ? ' mb-time-in-bar' : '') + '" title="' + escapeHtml(time) + '"><span>' + escapeHtml(top) + '</span><span>' + escapeHtml(bottom) + '</span></span>'
}

// ---- the editor's "Align bars"

/**
 * Chart rows padded so their bar lines line up: each bar as wide as the widest bar in its
 * column, one space on either side. Other lines (labels, lyrics) stay as they are.
 */
export function alignChart(lines: string[]): string[] {
  const rows = lines.map(l => parseRow(l))
  const widths: number[] = []
  for (const r of rows) r?.bars.forEach((b, i) => { widths[i] = Math.max(widths[i] ?? 0, b.length) })
  return lines.map((line, n) => {
    const r = rows[n]
    if (!r) return line
    const indent = /^\s*/.exec(line)![0]
    let out = indent + '{' + r.start
    r.bars.forEach((b, i) => {
      const end = r.ends[i]
      out += ' ' + (end ? b.padEnd(widths[i]) : b) + (end ? ' ' + end : '')
    })
    return out.trimEnd()
  })
}

/** Every chart in a song aligned (Align bars), each on its own: a chart ends at a line that is neither a row nor a label. */
export function alignCharts(src: string): string {
  const lines = src.split('\n')
  const out: string[] = []
  let block: string[] = []
  const flush = () => { out.push(...alignChart(block)); block = [] }
  for (const line of lines) {
    const t = line.trim()
    if (isChartRow(t) || CHART_LABEL.test(t)) block.push(line)
    else {
      flush()
      out.push(line)
    }
  }
  flush()
  return out.join('\n')
}
