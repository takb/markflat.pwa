import { computed } from 'vue'
import { compareBy, matches } from '@/lib/search'
import { useSettings } from '@/stores/settings'
import { useSongbook } from '@/stores/songbook'
import { useUi } from '@/stores/ui'

/** The song list as shown: the search's matches in the chosen order (also the swipe order). */
export function useVisibleSongs() {
  const settings = useSettings()
  const songbook = useSongbook()
  const ui = useUi()
  return computed(() => songbook.list.filter(s => matches(s, ui.query)).sort(compareBy(settings.sortBy)))
}
