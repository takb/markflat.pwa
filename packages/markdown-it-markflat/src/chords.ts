// Chords: parsing, transposition and display. Pure functions, no markdown-it.

import { spellIn, transposeKey } from './key.ts'

export interface ChordOptions {
  /** semitones to shift every root and bass note by (negative = down) */
  transpose?: number
  /** ♯/♭ instead of #/b */
  unicode?: boolean
  /** spell chords out: a → Am, C0 → Cdim, C+ → Caug */
  detailed?: boolean
  /** jazz symbols: a → A–, C7+ → CΔ7, C0 → C°, a7b5 → Aø7 (wins over `detailed`) */
  jazz?: boolean
  /**
   * the song's key (`G`, `Em`): transposed chords are spelled in the key they end up in. The
   * plugin sets it from the song (its `key:` field, or its chords); without it, a flat note
   * stays flat and any other becomes sharp.
   */
  key?: string | null
}

const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
const SEMITONE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

/**
 * Shifts a note (a letter A–G, optionally followed by # or b) by `by` semitones. With the
 * key it ends up in (`target`), it is spelled in that key; without, a flat note moves on the
 * flat scale and any other on the sharp scale. A lowercase (minor) note stays lowercase.
 * Anything else, and any note when `by` is 0, is returned unchanged.
 */
export function transposeNote(note: string, by: number, target?: string | null): string {
  const m = /^([A-Ga-g])([#b]?)$/.exec(note)
  if (!m || !by) return note
  const [, letter, accidental] = m
  const from = SEMITONE[letter.toUpperCase()] + (accidental === '#' ? 1 : accidental === 'b' ? -1 : 0)
  const to = (((from + by) % 12) + 12) % 12
  const name = target ? spellIn(to, target) : (accidental === 'b' ? FLATS : SHARPS)[to]
  return letter === letter.toLowerCase() ? name.toLowerCase() : name
}

export interface Chord {
  /** root note as written: an uppercase letter is major, a lowercase one minor */
  root: string
  /** what directly follows the root: `m`, `+` (augmented), `0` (diminished), or `` */
  quality: string
  /** the rest: 7, 7+ (maj7), s4 (sus4), 6/9 … */
  extension: string
  /** bass note after a slash, or `` */
  bass: string
}

// root, one of + 0 (or an accidental, part of the root), an optional m, the extension, a bass
const CHORD = /^([A-Ga-g][#b]?)([+0]?m?)(.*?)(?:\/([A-Ga-g][#b]?))?$/

/** Parses a chord; `null` for anything that is not one (repeat marks, comments). */
export function parseChord(text: string): Chord | null {
  const bassOnly = /^\/([A-Ga-g][#b]?)$/.exec(text)
  if (bassOnly) return { root: '', quality: '', extension: '', bass: bassOnly[1] }
  const m = CHORD.exec(text)
  if (!m) return null
  return { root: m[1], quality: m[2], extension: m[3], bass: m[4] ?? '' }
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const accidentals = (s: string, o: ChordOptions) =>
  o.unicode ? s.replace(/#/g, '♯').replace(/b/g, '♭') : s

/**
 * The HTML of a chord: root and quality, the extension as `<sup>`, the bass as `<sub>/X</sub>`.
 * Anything that is not a chord is shown as written (escaped); `...` becomes `…`.
 */
export function chordHtml(text: string, o: ChordOptions = {}): string {
  const chord = parseChord(text)
  if (!chord) return escapeHtml(text === '...' ? '…' : text)
  const by = o.transpose ?? 0
  const target = by && o.key ? transposeKey(o.key, by) : null
  let root = transposeNote(chord.root, by, target)
  let quality = chord.quality
  let extension = chord.extension
  if (o.jazz && root) {
    const minor = root[0] === root[0].toLowerCase() || quality.includes('m')
    root = root[0].toUpperCase() + root.slice(1)
    if (quality.startsWith('0')) quality = '°'
    else if (quality.startsWith('+')) quality = '+'
    else if (minor && /^7b5/.test(extension)) {
      quality = 'ø'
      extension = '7' + extension.slice(3)
    } else quality = minor ? '–' : ''
    extension = extension.replace(/(\d+)\+/g, 'Δ$1')
  } else if (o.detailed && root) {
    const minor = root[0] === root[0].toLowerCase()
    root = root[0].toUpperCase() + root.slice(1)
    if (minor && quality === '') quality = 'm'
    quality = quality.replace('0', 'dim').replace('+', 'aug')
  }
  // The root letter itself may be a lowercase b (B minor): only the accidental is converted.
  const rootHtml = root ? root[0] + accidentals(root.slice(1), o) : ''
  extension = extension.replace(/(\d+)\+/g, 'maj$1').replace(/^.([24])$/, 'sus$1')
  const bass = transposeNote(chord.bass, by, target)
  return escapeHtml(rootHtml + quality)
    + (extension ? '<sup>' + escapeHtml(accidentals(extension, o)) + '</sup>' : '')
    + (bass ? '<sub>/' + escapeHtml(bass[0] + accidentals(bass.slice(1), o)) + '</sub>' : '')
}
