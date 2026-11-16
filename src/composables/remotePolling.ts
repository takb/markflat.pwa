import { onMounted } from 'vue'
import { useEventListener, useIntervalFn } from '@vueuse/core'
import { useRemote } from '@/stores/remote'

/** How often an open, visible app asks the server for changes made elsewhere. */
export const POLL_MS = 60_000

/**
 * Checks for songs changed elsewhere: at start, every minute while the app is visible, and at
 * once when it becomes visible again (the phone unlocked, the tab back) or comes back online.
 */
export function useRemotePolling() {
  const remote = useRemote()
  const visible = () => document.visibilityState === 'visible'
  useIntervalFn(() => { if (visible()) remote.check() }, POLL_MS)
  useEventListener(document, 'visibilitychange', () => { if (visible()) remote.check() })
  useEventListener(window, 'online', () => remote.check())
  onMounted(() => remote.check())
}
