import { describe, expect, it } from 'vitest'
import { parseHeading, slugFor } from '@/lib/song'

describe('parseHeading (the same rules as api/src/Heading.php)', () => {
  it.each([
    ['# Let It Be - The Beatles\n1. text', 'Let It Be', 'The Beatles'],
    ['# Let It Be - The Beatles (Capo 2)', 'Let It Be', 'The Beatles'],
    ['# Song - Jay-Z', 'Song', 'Jay-Z'],
    ['# Ob-La-Di, Ob-La-Da - The Beatles', 'Ob-La-Di, Ob-La-Da', 'The Beatles'],
    [' # Johnny I hardly knew ya - Joseph Geoghegan \r\n1. x', 'Johnny I hardly knew ya', 'Joseph Geoghegan'],
    ['\n\n# Only a title', 'Only a title', ''],
    ['1. no heading', '', ''],
    ['# Gluchari (Глухари) - Александр Розенбаум\r\n1. Глуха{e}ри', 'Gluchari (Глухари)', 'Александр Розенбаум'],
  ])('%j', (content, title, artist) => {
    expect(parseHeading(content)).toEqual({ title, artist })
  })
})

describe('slugFor', () => {
  it.each([
    ['Let It Be', 'let_it_be'],
    ['Kimi o nosete (君をのせて)', 'kimi_o_nosete'],
    ["Don't Look Back In Anger", 'dont_look_back_in_anger'],
    ['Bündische Vaganten', 'bndische_vaganten'],
    ['蛍の光', 'song'],
    ['  _Odd_ ', 'odd_'],
  ])('%s → %s', (title, slug) => {
    expect(slugFor(title)).toBe(slug)
  })
})
