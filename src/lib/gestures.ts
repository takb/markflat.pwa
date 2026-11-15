// Gesture rules for the song page (D7), kept apart from the DOM so they can be tested.

/** A clearly horizontal, quick swipe of some length; anything else is scrolling or a tap. */
export function swipeDirection(dx: number, dy: number, ms: number): 'left' | 'right' | null {
  if (ms > 700 || Math.abs(dx) < 70 || Math.abs(dx) < 2 * Math.abs(dy)) return null
  return dx < 0 ? 'left' : 'right'
}

export const distance = (a: { clientX: number, clientY: number }, b: { clientX: number, clientY: number }) =>
  Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)

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
