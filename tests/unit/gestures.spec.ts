import { describe, expect, it } from 'vitest'
import { barVisible, swipeDirection } from '@/lib/gestures'

describe('swipe (transposes on the song page)', () => {
  it.each([
    [120, 10, 200, 'right'],
    [-120, 30, 300, 'left'],
    [50, 0, 200, null], // too short
    [120, 80, 200, null], // too diagonal: scrolling
    [120, 0, 900, null], // too slow: a drag
  ])('dx %d, dy %d in %d ms → %s', (dx, dy, ms, expected) => {
    expect(swipeDirection(dx, dy, ms)).toBe(expected)
  })
})

describe('the toolbar hides while scrolling down', () => {
  const at = (y: number, moved: number) => barVisible({ y, max: 2000, moved, visible: true })
  it('shows near the top and at the end', () => {
    expect(at(0, 10)).toBe(true)
    expect(at(1998, 30)).toBe(true)
  })
  it('hides scrolling down, shows scrolling up', () => {
    expect(at(500, 40)).toBe(false)
    expect(at(500, -40)).toBe(true)
  })
  it('ignores jitter', () => {
    expect(at(500, 3)).toBeNull()
    expect(at(500, -5)).toBeNull()
  })
})
