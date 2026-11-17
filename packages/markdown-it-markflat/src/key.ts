// A song's key: the front matter that states it, finding it from the chords, and spelling notes
// in it. Pure functions, no markdown-it.
//
//   ---
//   key: Em
//   ---
//   # Title - Artist
//
// Transposed chords are spelled by the key they end up in (B♭ and E♭ in B♭ major, not A♯ and
// D♯): at most five accidentals (D♭, not C♯; E♭m, not D♯m; F♯ for a major song, E♭m for a minor
// one), notes outside the key by their usual role (♭II ♭III ♯IV ♭VI ♭VII), never B♯ E♯ C♭ F♭.

import { isChartRow, rowChords } from './chart.ts'
import { parseChord } from './chords.ts'

export interface FrontMatter {
  /** the fields, `name: value` (names lowercased); other lines in the block are ignored */
  fields: Record<string, string>
  /** the number of lines the block takes, both `---` included */
  lines: number
}

/** The front matter at the very top of a song: `---`, `name: value` lines, `---`; else null. */
export function frontMatter(src: string): FrontMatter | null {
  const lines = src.split(/\r\n|\r|\n/)
  if (lines[0]?.trimEnd() !== '---') return null
  const fields: Record<string, string> = {}
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trimEnd() === '---') return { fields, lines: i + 1 }
    const m = /^\s*([\w-]+)\s*:\s*(.*?)\s*$/.exec(lines[i])
    if (m) fields[m[1].toLowerCase()] = m[2]
  }
  return null
}

/** The song without its front matter. */
export function withoutFrontMatter(src: string): string {
  const fm = frontMatter(src)
  return fm ? src.split(/\r\n|\r|\n/).slice(fm.lines).join('\n') : src
}

/**
 * The song with `key: <key>` in its front matter: added to a block that has no key, or a new
 * block at the top. A key that is there already stays as it is.
 */
export function withKeyField(src: string, key: string): string {
  const fm = frontMatter(src)
  if (fm && 'key' in fm.fields) return src
  if (fm) return src.replace(/^---[ \t]*(\r\n|\r|\n)/, m => m + 'key: ' + key + m.slice(m.trimEnd().length))
  return '---\nkey: ' + key + '\n---\n' + src
}

export interface Key {
  /** pitch class of the tonic, C = 0 */
  tonic: number
  minor: boolean
}

const LETTERS = 'CDEFGAB'
const NATURAL = [0, 2, 4, 5, 7, 9, 11]
const pc = (n: number) => ((n % 12) + 12) % 12

/** A note's pitch class: a letter (any case) with #, b, ♯ or ♭; null for anything else. */
function notePc(note: string): number | null {
  const m = /^([A-Ga-g])([#♯b♭]?)$/.exec(note)
  if (!m) return null
  return pc(NATURAL[LETTERS.indexOf(m[1].toUpperCase())] + (/[#♯]/.test(m[2]) ? 1 : m[2] ? -1 : 0))
}

/** A key as written: `G`, `Em`, `Bb`, `F#m`, `B♭`, or lowercase for minor (`e`); else null. */
export function parseKey(text: string): Key | null {
  const m = /^\s*([A-Ga-g][#♯b♭]?)\s*(m|min|minor|maj|major)?\s*$/.exec(text)
  if (!m) return null
  const tonic = notePc(m[1])
  if (tonic === null) return null
  const minor = m[2] ? m[2].startsWith('mi') || m[2] === 'm' : m[1][0] === m[1][0].toLowerCase()
  return { tonic, minor }
}

// The common name of each key (at most five accidentals; F♯ major, E♭ minor at the tie).
const MAJOR = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
const MINOR = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B']

/** A key's common name: `Bb`, `F#m`, `Ebm` (# and b; the caller may show ♯ and ♭). */
export const keyName = (k: Key): string => (k.minor ? MINOR[k.tonic] + 'm' : MAJOR[k.tonic])

/** The key `by` semitones up (down when negative), by its common name. */
export function transposeKey(key: string, by: number): string | null {
  const k = parseKey(key)
  return k ? keyName({ tonic: pc(k.tonic + by), minor: k.minor }) : null
}

/**
 * The key a song's chords suggest: every chord counts for the key whose triads (I ii iii IV V vi
 * and vii°) it belongs to, the first and the last chord twice; minor when the relative minor
 * chord (and its major V) outweighs the major one. Null for a song without chords.
 */
export function detectKey(src: string): string | null {
  const chords: { pc: number, kind: 'major' | 'minor' | 'dim' }[] = []
  const written: string[] = []
  for (const line of withoutFrontMatter(src).split(/\r\n|\r|\n/)) {
    // a chart row's chords have no braces
    if (isChartRow(line)) written.push(...rowChords(line))
    else for (const m of line.matchAll(/\{([^{}\n]+)\}/g)) written.push(m[1].trim())
  }
  for (const w of written) {
    const c = parseChord(w)
    if (!c || !c.root) continue
    const root = notePc(c.root)
    if (root === null) continue
    const lower = c.root[0] === c.root[0].toLowerCase()
    const kind = c.quality.startsWith('0') ? 'dim' : lower || c.quality.includes('m') ? 'minor' : 'major'
    chords.push({ pc: root, kind })
  }
  if (!chords.length) return null

  // a chord's fit: the key's own triads count fully, the minor key's major V (E in A minor) half
  const fits = (tonic: number, c: (typeof chords)[number]) => {
    const d = pc(c.pc - tonic)
    if (c.kind === 'major') return [0, 5, 7].includes(d) ? 1 : d === 4 ? 0.5 : 0
    if (c.kind === 'minor') return [2, 4, 9].includes(d) ? 1 : 0
    return d === 11 ? 1 : 0
  }
  const weight = (i: number) => (i === 0 || i === chords.length - 1 ? 2 : 1)
  let best = 0
  let bestScore = -1
  for (let tonic = 0; tonic < 12; tonic++) {
    let score = 0
    chords.forEach((c, i) => { score += fits(tonic, c) * weight(i) })
    // a tie goes to the key whose I or vi chord starts or ends the song
    const ends = [chords[0], chords[chords.length - 1]]
    if (ends.some(c => (c.kind === 'major' && c.pc === tonic) || (c.kind === 'minor' && c.pc === pc(tonic + 9)))) score += 0.5
    if (score > bestScore) { best = tonic; bestScore = score }
  }
  // major or its relative minor: which tonic chord weighs more (the minor's major V counts for it)
  let major = 0
  let minor = 0
  chords.forEach((c, i) => {
    if (c.kind === 'major' && c.pc === best) major += weight(i)
    if (c.kind === 'minor' && c.pc === pc(best + 9)) minor += weight(i)
    if (c.kind === 'major' && c.pc === pc(best + 4)) minor += weight(i) / 2
  })
  return minor > major ? keyName({ tonic: pc(best + 9), minor: true }) : keyName({ tonic: best, minor: false })
}

// Letter steps above the tonic for each semitone: the scale's own notes, and ♭2 ♭3/3 ♯4 ♭6/6 ♭7/7.
const STEPS = [0, 1, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6]
const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

/** A pitch class spelled in a key (# and b): its role in the key decides the letter. */
export function spellIn(note: number, key: string): string {
  const k = parseKey(key)
  if (!k) return SHARPS[pc(note)]
  const name = keyName(k).replace(/m$/, '')
  const letter = LETTERS.indexOf(name[0])
  const target = LETTERS[(letter + STEPS[pc(note - k.tonic)]) % 7]
  const diff = pc(pc(note) - NATURAL[LETTERS.indexOf(target)] + 6) - 6
  const spelled = target + (diff === 1 ? '#' : diff === -1 ? 'b' : '')
  if (Math.abs(diff) <= 1 && !['B#', 'E#', 'Cb', 'Fb'].includes(spelled)) return spelled
  // no double accidentals, no B♯ E♯ C♭ F♭: the key signature's own name for the note
  const flat = (k.minor ? [0, 2, 3, 5, 7, 10] : [1, 3, 5, 8, 10]).includes(k.tonic)
  return (flat ? FLATS : SHARPS)[pc(note)]
}

/** The key a song is in: its `key:` field when that is a key, otherwise from its chords. */
export function songKey(src: string): string | null {
  const stated = frontMatter(src)?.fields.key
  const k = stated ? parseKey(stated) : null
  return k ? keyName(k) : detectKey(src)
}
