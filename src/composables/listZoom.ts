import { useSettings } from '@/stores/settings'

/**
 * A pinch handler for the song lists (All songs, a set list's page): the rows' font size follows
 * the fingers from where it was when they came down, as the song's does on a song page.
 */
export function usePinchListZoom() {
  const settings = useSettings()
  let from: number | null = null
  return (scale: number, phase: 'start' | 'move' | 'end') => {
    if (phase === 'start') from = settings.listZoom
    else if (phase === 'move' && from !== null) settings.setListZoom(from * scale)
    else from = null
  }
}
