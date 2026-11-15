import { describe, expect, it } from 'vitest'
import { compareBy, matches } from '@/lib/search'

const song = (title: string, artist = '', content = '') => ({ slug: title.toLowerCase(), title, artist, content })

describe('the list search', () => {
  it.each([
    ['bundische', 'Bündische Vaganten'],
    ['BÜNDISCHE', 'Bündische Vaganten'],
    ['cafe', 'Café del Mar'],
    ['vaganten bund', 'Bündische Vaganten'],
  ])('%s finds %s (case and accents ignored, every word somewhere)', (query, title) => {
    expect(matches(song(title), query)).toBe(true)
  })

  it('searches the artist and the text too', () => {
    expect(matches(song('Yesterday', 'The Beatles'), 'beatles')).toBe(true)
    expect(matches(song('Yesterday', '', '1. {C}Yesterday all my troubles'), 'troubles')).toBe(true)
    expect(matches(song('Yesterday'), 'tomorrow')).toBe(false)
    expect(matches(song('Yesterday'), '  ')).toBe(true)
  })

  it('sorts by title, or by artist then title, ignoring case and accents', () => {
    const list = [song('b', 'Zed'), song('Ä', 'zed'), song('c', 'Abba')]
    expect([...list].sort(compareBy('title')).map(s => s.title)).toEqual(['Ä', 'b', 'c'])
    expect([...list].sort(compareBy('artist')).map(s => s.title)).toEqual(['c', 'Ä', 'b'])
  })
})
