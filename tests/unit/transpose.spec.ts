import { describe, expect, it } from 'vitest'
import showdown from '@/composables/markflat'

const transpose = showdown.getOption('mbTranspose') as (key: string, by: number) => string
const roots = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B']

describe('mbTranspose (characterisation of the current behaviour)', () => {
  it('shifts major roots', () => {
    const table = roots.map(k => k + ': ' + [-1, 1, 2, 5, 11].map(by => transpose(k, by)).join(' '))
    expect(table).toMatchInlineSnapshot(`
      [
        "C: B C# D F B",
        "C#: B C# D F B",
        "Db: Db Eb E G Db",
        "D: C# D# E G C#",
        "D#: C# D# E G C#",
        "Eb: Eb F Gb A Eb",
        "E: D# F F# A D#",
        "F: E F# G A# E",
        "F#: E F# G A# E",
        "Gb: Gb Ab A C Gb",
        "G: F# G# A C F#",
        "G#: F# G# A C F#",
        "Ab: Ab Bb B D Ab",
        "A: G# A# B D G#",
        "A#: G# A# B D G#",
        "Bb: Bb C Db E Bb",
        "B: A# C C# E A#",
      ]
    `)
  })
  it('shifts minor roots and keeps them lowercase', () => {
    const table = roots.map(k => k.toLowerCase()).map(k => k + ': ' + [-1, 1, 2, 5, 11].map(by => transpose(k, by)).join(' '))
    expect(table).toMatchInlineSnapshot(`
      [
        "c: b c# d f b",
        "c#: b c# d f b",
        "db: db eb e g db",
        "d: c# d# e g c#",
        "d#: c# d# e g c#",
        "eb: eb f gb a eb",
        "e: d# f f# a d#",
        "f: e f# g a# e",
        "f#: e f# g a# e",
        "gb: gb ab a c gb",
        "g: f# g# a c f#",
        "g#: f# g# a c f#",
        "ab: ab bb b d ab",
        "a: g# a# b d g#",
        "a#: g# a# b d g#",
        "bb: bb c db e bb",
        "b: a# c c# e a#",
      ]
    `)
  })
  it('leaves the key alone when the shift is 0 or the key is empty', () => {
    expect(transpose('F#', 0)).toBe('F#')
    expect(transpose('', 3)).toBe('')
  })
})

// B16 (found in M3): the root's accidental is cut off before the shift, so C#, Db, … transpose
// as if they were C, D, …, and a trailing "m" or "+" in the key is lost. Fixed in M4; these
// tests then pass and `it.fails` must become `it`.
describe('mbTranspose: known bug B16', () => {
  it.fails('shifts sharp roots from the sharp itself', () => {
    expect(transpose('C#', 1)).toBe('D')
    expect(transpose('F#', -1)).toBe('F')
  })
  it.fails('shifts flat roots from the flat itself', () => {
    expect(transpose('Db', 1)).toBe('D')
    expect(transpose('Bb', -1)).toBe('A')
  })
})
