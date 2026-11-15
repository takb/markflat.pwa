// Title, artist and file name of a song, from its heading "# Title - Artist (capo 2)".
// The same rules as the server's Heading (api/src/Heading.php), so both sides agree.

export function parseHeading(content: string): { title: string, artist: string } {
  for (const line of content.split(/\r\n|\r|\n/)) {
    if (line.trim() === '') continue
    let m = /^\s{0,3}#+\s*(.+?)\s+-\s+(.+?)\s*$/u.exec(line)
    if (m) {
      const artist = m[2].replace(/\s*\([^()]*\)$/u, '').trim()
      return { title: m[1], artist: artist !== '' ? artist : m[2] }
    }
    m = /^\s{0,3}#+\s*(.+?)\s*$/u.exec(line)
    if (m) return { title: m[1], artist: '' }
    break
  }
  return { title: '', artist: '' }
}

/**
 * The file name (slug) for a new song or a renamed one: the title without "(…)", lowercase,
 * spaces as _, other characters dropped — the rule the app has always used, so existing songs
 * keep their names. A title with nothing left (e.g. only Japanese) falls back to "song".
 */
export function slugFor(title: string): string {
  const slug = title.replace(/\(.*\)/g, '').trim().toLowerCase().replace(/\s+/g, '_').replace(/\W+/g, '')
    .replace(/^[_-]+/, '').slice(0, 100)
  return slug || 'song'
}
