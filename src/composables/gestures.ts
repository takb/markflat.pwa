import { onScopeDispose, ref, watch, type Ref } from 'vue'
import { useEventListener } from '@vueuse/core'
import { barVisible, distance, swipeDirection } from '@/lib/gestures'

export interface SongGestures {
  /** Two fingers apart or together: the scale since they touched (1 = unchanged). */
  pinch?: (scale: number, phase: 'start' | 'move' | 'end') => void
  swipe?: (direction: 'left' | 'right') => void
  /** A tap or click that was not part of a gesture. */
  tap?: () => void
}

/**
 * Pinch and swipe on a song (D7). The element gets `touch-action: pan-y`: the browser still
 * scrolls vertically, but its own pinch zoom and sideways panning are off there, so both
 * gestures come to us. Taps come as clicks, ignored right after a gesture.
 */
export function useSongGestures(target: Ref<HTMLElement | undefined>, on: SongGestures) {
  let start: { x: number, y: number, t: number } | null = null
  let pinchFrom = 0
  let multi = false
  let lastGesture = 0
  let frame = 0
  let pending = 1

  const opts = { passive: false }

  useEventListener(target, 'touchstart', (e: TouchEvent) => {
    if (e.touches.length >= 2) {
      multi = true
      start = null
      if (e.touches.length === 2 && on.pinch) {
        pinchFrom = distance(e.touches[0], e.touches[1])
        on.pinch(1, 'start')
      }
    } else if (!multi) {
      start = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: e.timeStamp }
    }
  }, opts)

  useEventListener(target, 'touchmove', (e: TouchEvent) => {
    if (e.touches.length !== 2 || !pinchFrom || !on.pinch) return
    if (e.cancelable) e.preventDefault()
    pending = distance(e.touches[0], e.touches[1]) / pinchFrom
    if (!frame) {
      frame = requestAnimationFrame(() => {
        frame = 0
        on.pinch?.(pending, 'move')
      })
    }
  }, opts)

  const end = (e: TouchEvent) => {
    if (pinchFrom && e.touches.length < 2) {
      cancelAnimationFrame(frame)
      frame = 0
      on.pinch?.(pending, 'end')
      pinchFrom = 0
      pending = 1
      lastGesture = e.timeStamp
    }
    if (e.touches.length === 0) {
      if (multi) lastGesture = e.timeStamp
      else if (start && e.type === 'touchend') {
        const t = e.changedTouches[0]
        const dir = swipeDirection(t.clientX - start.x, t.clientY - start.y, e.timeStamp - start.t)
        if (dir && on.swipe) {
          on.swipe(dir)
          lastGesture = e.timeStamp
        }
      }
      multi = false
      start = null
    }
  }
  useEventListener(target, 'touchend', end)
  useEventListener(target, 'touchcancel', end)

  useEventListener(target, 'click', (e: MouseEvent) => {
    if (e.timeStamp - lastGesture < 400) return
    if ((e.target as HTMLElement).closest('a, button, input, textarea')) return
    if (window.getSelection()?.toString()) return
    on.tap?.()
  })

  onScopeDispose(() => cancelAnimationFrame(frame))
}

/** A bar that hides while the content scrolls down and shows on scrolling up and at the ends. */
export function useAutoHide(scroller: Ref<HTMLElement | undefined>) {
  const visible = ref(true)
  let last = 0

  useEventListener(scroller, 'scroll', () => {
    const el = scroller.value
    if (!el) return
    const y = el.scrollTop
    const decision = barVisible({ y, max: el.scrollHeight - el.clientHeight, moved: y - last, visible: visible.value })
    if (decision !== null) {
      visible.value = decision
      last = y
    }
  }, { passive: true })

  // a new song starts at the top, with the bar
  watch(scroller, () => { visible.value = true; last = 0 })

  return { visible, toggle: () => { visible.value = !visible.value } }
}
