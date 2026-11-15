import { defineStore } from 'pinia'
import { ref } from 'vue'

export type View = 'list' | 'show' | 'edit' | 'keys' | 'history' | 'deleted'

interface Route {
  view: View
  selected: string | null
}

// Each view has a hash (#/song/yesterday, #/edit/yesterday, #/history/yesterday, #/keys,
// #/deleted), so the phone's back gesture and the browser's back button go back within the
// app (D7) and a reload stays where it was. history.state.depth counts the app's own steps,
// so "back" never leaves the app and "home" goes back to the list in one go.
const VIEWS: Record<string, View> = { song: 'show', edit: 'edit', history: 'history', keys: 'keys', deleted: 'deleted' }
const PREFIX: Record<View, string> = { list: '', show: 'song', edit: 'edit', history: 'history', keys: 'keys', deleted: 'deleted' }

export function parseHash(hash: string): Route {
  const [name, slug] = hash.replace(/^#\/?/, '').split('/')
  const view = VIEWS[name ?? '']
  if (!view) return { view: 'list', selected: null }
  const selected = slug ? decodeURIComponent(slug) : null
  if (view !== 'keys' && view !== 'deleted' && !selected) return { view: 'list', selected: null }
  return { view, selected }
}

export function hashFor(view: View, slug: string | null = null): string {
  if (view === 'list') return '#/'
  return '#/' + PREFIX[view] + (slug ? '/' + encodeURIComponent(slug) : '')
}

const depth = () => (history.state as { depth?: number } | null)?.depth ?? 0

export const useUi = defineStore('ui', () => {
  const initial = parseHash(location.hash)
  const view = ref<View>(initial.view)
  const selected = ref<string | null>(initial.selected)
  // the list's search and scroll position, kept while a song is open
  const query = ref('')
  const listScroll = ref(0)

  function apply() {
    const r = parseHash(location.hash)
    view.value = r.view
    selected.value = r.selected
  }
  window.addEventListener('popstate', apply)

  function go(v: View, slug: string | null = null) {
    history.pushState({ depth: depth() + 1 }, '', hashFor(v, slug))
    apply()
  }

  function replace(v: View, slug: string | null = null) {
    history.replaceState({ depth: depth() }, '', hashFor(v, slug))
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

  return {
    view,
    selected,
    query,
    listScroll,
    show: (slug: string) => go('show', slug),
    edit: (slug: string) => go('edit', slug),
    history: (slug: string) => go('history', slug),
    keys: () => go('keys'),
    deleted: () => go('deleted'),
    /** The current song got a new name (saved under its title): same place in the history. */
    renamed: (slug: string) => replace(view.value, slug),
    replace,
    back,
    home,
  }
})
