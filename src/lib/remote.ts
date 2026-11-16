// Songs changed elsewhere (noticing remote changes): this device's songs against the server's
// ETags. Pure, so it can be tested; the polling is in stores/remote.ts.

export interface RemoteChanges {
  /** songs this device has from the server that changed there since */
  changed: string[]
  /** songs on the server this device does not have */
  added: string[]
  /** songs this device has from the server that are gone there */
  removed: string[]
}

export const noChanges = (c: RemoteChanges) => !c.changed.length && !c.added.length && !c.removed.length

/**
 * What differs. A song never uploaded from here (etag null) is this device's own business; a
 * song saved from here has the server's ETag already, so this device's own saves never count.
 */
export function compareVersions(local: Record<string, { etag: string | null }>, server: Record<string, string>): RemoteChanges {
  const changes: RemoteChanges = { changed: [], added: [], removed: [] }
  for (const [slug, etag] of Object.entries(server)) {
    const mine = local[slug]
    if (!mine) changes.added.push(slug)
    else if (mine.etag !== null && mine.etag !== etag) changes.changed.push(slug)
  }
  for (const [slug, mine] of Object.entries(local)) {
    if (mine.etag !== null && !(slug in server)) changes.removed.push(slug)
  }
  return changes
}
