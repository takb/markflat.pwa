import { defineStore } from 'pinia'
import { ref } from 'vue'

export type View = 'list' | 'show' | 'edit' | 'keys' | 'history' | 'deleted' | 'set'

export interface Route {
  view: View
  /** the song (show, edit, history) or the set list (set) */
  selected: string | null
  /** in a set list: 0 = the list itself, 1… = its songs */
  page: number
}

// Each view has a hash (#/song/yesterday, #/edit/yesterday, #/history/yesterday, #/keys,
// #/deleted, #/set/<list>, #/set/<list>/3), so the phone's back gesture and the browser's back
// button go back within the app (D7) and a reload stays where it was. history.state.depth counts
// the app's own steps, so "back" never leaves the app and "home" goes back to the list in one go.
const VIEWS: Record<string, View> = { song: 'show', edit: 'edit', history: 'history', keys: 'keys', deleted: 'deleted', set: 'set' }
const PREFIX: Record<View, string> = { list: '', show: 'song', edit: 'edit', history: 'history', keys: 'keys', deleted: 'deleted', set: 'set' }
const HOME: Route = { view: 'list', selected: null, page: 0 }

export function parseHash(hash: string): Route {
  const [name, slug, page] = hash.replace(/^#\/?/, '').split('/')
  const view = VIEWS[name ?? '']
  if (!view) return HOME
  const selected = slug ? decodeURIComponent(slug) : null
  if (view !== 'keys' && view !== 'deleted' && !selected) return HOME
  const n = view === 'set' ? Number.parseInt(page ?? '0', 10) : 0
  return { view, selected, page: Number.isInteger(n) && n > 0 ? n : 0 }
}

export function hashFor(view: View, slug: string | null = null, page = 0): string {
  if (view === 'list') return '#/'
  return '#/' + PREFIX[view] + (slug ? '/' + encodeURIComponent(slug) : '') + (view === 'set' && page > 0 ? '/' + page : '')
}

interface HistoryState {
  depth?: number
  /** a set list's song page, pushed once when leaving the list page (see setPage) */
  songPage?: boolean
}
const state = () => (history.state as HistoryState | null) ?? {}
const depth = () => state().depth ?? 0

export const useUi = defineStore('ui', () => {
  const initial = parseHash(location.hash)
  const view = ref<View>(initial.view)
  const selected = ref<string | null>(initial.selected)
  const page = ref(initial.page)
  // the list's search and scroll position, kept while a song is open
  const query = ref('')
  const listScroll = ref(0)
  const settingsOpen = ref(false)

  function apply() {
    const r = parseHash(location.hash)
    view.value = r.view
    selected.value = r.selected
    page.value = r.page
  }
  window.addEventListener('popstate', apply)

  function go(v: View, slug: string | null = null, n = 0, extra: HistoryState = {}) {
    history.pushState({ depth: depth() + 1, ...extra }, '', hashFor(v, slug, n))
    apply()
  }

  function replace(v: View, slug: string | null = null, n = 0) {
    history.replaceState({ ...state(), depth: depth() }, '', hashFor(v, slug, n))
    apply()
  }

  /** One step back within the app; on the first page of the app, the list. */
  function back() {
    if (depth() > 0) history.back()
    else replace('list')
  }

  /** Back to the list, skipping the steps in between. */
  function home() {
    if (depth() > 0) history.go(-depth())
    else replace('list')
  }

  /** Opens a set list on its first page; switching from one list to another replaces the step. */
  function openSet(id: string) {
    if (view.value === 'set' && page.value === 0) replace('set', id)
    else go('set', id)
  }

  /**
   * Turns a set list's page (L10): the first song page reached from the list page is one history
   * step (so back returns to the list), turning between songs replaces it, and returning to the
   * list page takes that step back.
   */
  function setPage(n: number) {
    if (view.value !== 'set' || !selected.value || n === page.value) return
    if (n > 0 && page.value === 0) go('set', selected.value, n, { songPage: true })
    else if (n === 0 && state().songPage && depth() > 0) history.back()
    else replace('set', selected.value, n)
  }

  return {
    view,
    selected,
    page,
    query,
    listScroll,
    settingsOpen,
    show: (slug: string) => go('show', slug),
    /** Another song in the same place (swiping through the song list): no new history step. */
    showInstead: (slug: string) => replace('show', slug),
    edit: (slug: string) => go('edit', slug),
    history: (slug: string) => go('history', slug),
    keys: () => go('keys'),
    deleted: () => go('deleted'),
    openSet,
    setPage,
    /** The current song got a new name (saved under its title): same place in the history. */
    renamed: (slug: string) => replace(view.value, slug),
    replace,
    back,
    home,
  }
})
