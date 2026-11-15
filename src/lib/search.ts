// The list's search: case- and accent-insensitive ("bundische" finds "Bündische", "cafe" finds
// "Café"), over title, artist and text.

export const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

export interface Searchable {
  title: string
  artist: string
  content: string
}

export function matches(song: Searchable, query: string): boolean {
  const words = fold(query).split(/\s+/).filter(Boolean)
  if (!words.length) return true
  const text = fold(song.title + '\n' + song.artist + '\n' + song.content)
  return words.every(w => text.includes(w))
}

/** By title (or artist, then title), ignoring case and accents. */
export function compareBy(key: 'title' | 'artist') {
  const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true })
  return (a: { slug: string, title: string, artist: string }, b: { slug: string, title: string, artist: string }) =>
    (key === 'artist' ? collator.compare(a.artist, b.artist) : 0)
    || collator.compare(a.title || a.slug, b.title || b.slug)
}
