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

const GERMAN: Record<string, string> = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss', Ä: 'Ae', Ö: 'Oe', Ü: 'Ue', ẞ: 'SS' }

/**
 * The file name (slug) for a new or renamed song, from its title: German umlauts and ß spelled
 * out (ä → ae, ß → ss), other accents dropped (é → e), anything in "(…)" left out, spaces as _,
 * nothing but a–z, 0–9, _ and - kept. A title with nothing left (e.g. only Japanese) gives
 * "song". Existing songs keep their names until their title changes.
 */
export function slugFor(title: string): string {
  const slug = title.replace(/\(.*\)/g, '')
    .replace(/[äöüßÄÖÜẞ]/g, c => GERMAN[c])
    .normalize('NFD').replace(/\p{M}/gu, '')
    .trim().toLowerCase().replace(/\s+/g, '_').replace(/\W+/g, '')
    .replace(/^[_-]+/, '').slice(0, 100)
  return slug || 'song'
}
