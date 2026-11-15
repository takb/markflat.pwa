// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { transposeNote as transpose } from '../src/chords.ts'
const roots = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B']

describe('transposeNote', () => {
  it('shifts major roots', () => {
    const table = roots.map(k => k + ': ' + [-1, 1, 2, 5, 11].map(by => transpose(k, by)).join(' '))
    expect(table).toMatchInlineSnapshot(`
      [
        "C: B C# D F B",
        "C#: C D D# F# C",
        "Db: C D Eb Gb C",
        "D: C# D# E G C#",
        "D#: D E F G# D",
        "Eb: D E F Ab D",
        "E: D# F F# A D#",
        "F: E F# G A# E",
        "F#: F G G# B F",
        "Gb: F G Ab B F",
        "G: F# G# A C F#",
        "G#: G A A# C# G",
        "Ab: G A Bb Db G",
        "A: G# A# B D G#",
        "A#: A B C D# A",
        "Bb: A B C Eb A",
        "B: A# C C# E A#",
      ]
    `)
  })
  it('shifts minor roots and keeps them lowercase', () => {
    const table = roots.map(k => k.toLowerCase()).map(k => k + ': ' + [-1, 1, 2, 5, 11].map(by => transpose(k, by)).join(' '))
    expect(table).toMatchInlineSnapshot(`
      [
        "c: b c# d f b",
        "c#: c d d# f# c",
        "db: c d eb gb c",
        "d: c# d# e g c#",
        "d#: d e f g# d",
        "eb: d e f ab d",
        "e: d# f f# a d#",
        "f: e f# g a# e",
        "f#: f g g# b f",
        "gb: f g ab b f",
        "g: f# g# a c f#",
        "g#: g a a# c# g",
        "ab: g a bb db g",
        "a: g# a# b d g#",
        "a#: a b c d# a",
        "bb: a b c eb a",
        "b: a# c c# e a#",
      ]
    `)
  })
  it('leaves the key alone when the shift is 0 or the key is empty', () => {
    expect(transpose('F#', 0)).toBe('F#')
    expect(transpose('', 3)).toBe('')
  })
})

// B16 of the old renderer: the root's accidental was cut off before the shift.
describe('transposeNote: sharps and flats (B16)', () => {
  it('shifts sharp roots from the sharp itself', () => {
    expect(transpose('C#', 1)).toBe('D')
    expect(transpose('F#', -1)).toBe('F')
  })
  it('shifts flat roots from the flat itself', () => {
    expect(transpose('Db', 1)).toBe('D')
    expect(transpose('Bb', -1)).toBe('A')
  })
})
