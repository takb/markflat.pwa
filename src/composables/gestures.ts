import { onScopeDispose, ref, watch, type Ref } from 'vue'
import { useEventListener } from '@vueuse/core'
import { barVisible, distance, swipeSteps, twoFingerMode } from '@/lib/gestures'

export interface SongGestures {
  /** Two fingers apart or together: the scale since the pinch began (1 = unchanged). */
  pinch?: (scale: number, phase: 'start' | 'move' | 'end') => void
  /** Two fingers up (+1 per step) or down (−1 per step). */
  transpose?: (steps: number) => void
  /** A tap or click that was not part of a gesture. */
  tap?: (e: MouseEvent) => void
}

/**
 * Two-finger gestures on the song pages (L9). The pages get `touch-action: pan-x pan-y`: one
 * finger scrolls (vertically within a song, sideways between songs), the browser's own pinch
 * zoom is off, and two-finger moves are ours (pinch = font size, swipe up/down = transpose).
 * Taps come as clicks, ignored right after a gesture.
 */
export function useSongGestures(target: Ref<HTMLElement | undefined>, on: SongGestures) {
  let from: { dist: number, y: number } | null = null
  let mode: 'pinch' | 'swipe' | null = null
  let stepsDone = 0
  let lastGesture = 0
  let frame = 0
  let pending = 1

  const mid = (e: TouchEvent) => (e.touches[0].clientY + e.touches[1].clientY) / 2

  useEventListener(target, 'touchstart', (e: TouchEvent) => {
    if (e.touches.length === 2) {
      from = { dist: distance(e.touches[0], e.touches[1]), y: mid(e) }
      mode = null
      stepsDone = 0
    }
  }, { passive: true })

  useEventListener(target, 'touchmove', (e: TouchEvent) => {
    if (e.touches.length !== 2 || !from) return
    if (e.cancelable) e.preventDefault()
    const scale = distance(e.touches[0], e.touches[1]) / from.dist
    const y = mid(e)
    if (!mode) {
      mode = twoFingerMode(scale, y - from.y)
      if (mode === 'pinch') on.pinch?.(1, 'start')
    }
    if (mode === 'pinch') {
      pending = scale
      if (!frame) {
        frame = requestAnimationFrame(() => {
          frame = 0
          on.pinch?.(pending, 'move')
        })
      }
    } else if (mode === 'swipe') {
      const steps = swipeSteps(from.y, y)
      if (steps !== stepsDone) {
        on.transpose?.(steps - stepsDone)
        stepsDone = steps
      }
    }
  }, { passive: false })

  const end = (e: TouchEvent) => {
    if (!from || e.touches.length >= 2) return
    if (mode === 'pinch') {
      cancelAnimationFrame(frame)
      frame = 0
      on.pinch?.(pending, 'end')
    }
    if (mode) lastGesture = e.timeStamp
    from = null
    mode = null
    pending = 1
  }
  useEventListener(target, 'touchend', end)
  useEventListener(target, 'touchcancel', end)

  useEventListener(target, 'click', (e: MouseEvent) => {
    if (e.timeStamp - lastGesture < 400) return
    if ((e.target as HTMLElement).closest('a, button, input, textarea, [role="menu"]')) return
    if (window.getSelection()?.toString()) return
    on.tap?.(e)
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

  // another page (or song) starts with the bar
  watch(scroller, el => { visible.value = true; last = el?.scrollTop ?? 0 })

  return { visible, toggle: () => { visible.value = !visible.value } }
}
