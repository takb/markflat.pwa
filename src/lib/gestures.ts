// Gesture rules for the song pages (D7, set lists L9), kept apart from the DOM so they can be
// tested. One finger is the browser's own: vertical scrolling and, between songs, horizontal
// scroll-snap. Two fingers are ours: pinch for the font size, a swipe up/down to transpose.

export const distance = (a: { clientX: number, clientY: number }, b: { clientX: number, clientY: number }) =>
  Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)

/**
 * What two fingers are doing, once it is clear: a pinch when their distance changed by more than
 * 12 %, a swipe when they moved together 30 px up or down with the distance about the same;
 * null while undecided.
 */
export function twoFingerMode(scale: number, dy: number): 'pinch' | 'swipe' | null {
  if (Math.abs(scale - 1) > 0.12) return 'pinch'
  if (Math.abs(dy) > 30) return 'swipe'
  return null
}

/** A two-finger swipe transposes one semitone per 50 px: up is higher. */
export const SWIPE_STEP = 50

/** Steps to transpose for a swipe that moved from `from` to `to` (screen y, so up = smaller). */
export function swipeSteps(from: number, to: number): number {
  return Math.trunc((from - to) / SWIPE_STEP)
}

/** Where a tap lands: the outer tenth on either side turns the page. */
export function tapZone(x: number, width: number): 'previous' | 'next' | 'middle' {
  if (x < width * 0.1) return 'previous'
  if (x > width * 0.9) return 'next'
  return 'middle'
}

/**
 * Whether a bar over scrolled content shows: always near the top and at the end, hidden while
 * scrolling down, back when scrolling up. `moved` is the scroll since the last decision; small
 * moves (under `step`) decide nothing, so a jittery finger doesn't make it flicker.
 */
export function barVisible(state: { y: number, max: number, moved: number, visible: boolean }, step = 8): boolean | null {
  if (state.y <= 16 || state.y >= state.max - 4) return true
  if (Math.abs(state.moved) < step) return null
  return state.moved < 0
}
