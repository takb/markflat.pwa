import { describe, expect, it } from 'vitest'
import { barVisible, swipeSteps, tapZone, twoFingerMode } from '@/lib/gestures'

describe('two fingers: pinch or swipe (L9)', () => {
  it.each([
    [1.3, 0, 'pinch'],
    [0.8, 5, 'pinch'],
    [1.05, -40, 'swipe'],
    [0.95, 45, 'swipe'],
    [1.05, 10, null], // undecided yet
  ])('scale %d, moved %d px → %s', (scale, dy, mode) => {
    expect(twoFingerMode(scale, dy)).toBe(mode)
  })

  it('transposes one semitone per 50 px, up is higher', () => {
    expect(swipeSteps(400, 360)).toBe(0)
    expect(swipeSteps(400, 340)).toBe(1)
    expect(swipeSteps(400, 290)).toBe(2)
    expect(swipeSteps(400, 455)).toBe(-1)
  })
})

describe('taps', () => {
  it('turn the page on the outer tenth, toggle the toolbar in between', () => {
    expect(tapZone(20, 400)).toBe('previous')
    expect(tapZone(200, 400)).toBe('middle')
    expect(tapZone(380, 400)).toBe('next')
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
