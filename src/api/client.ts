// The songbook API (api/, backend v2). Same origin: a password on the site covers it too.
// VITE_API_URL points the dev server or a test build elsewhere.

export const API_URL: string = (import.meta.env.VITE_API_URL || 'api').replace(/\/$/, '')

export interface ServerSong {
  slug: string
  title: string
  artist: string
  etag: string
  content: string
}

export interface Me {
  writer: string | null
  canWrite: boolean
  isAdmin: boolean
}

export interface Writer {
  name: string
  created: string | null
  by: string | null
  lastUsed: string | null
  bootstrap: boolean
}

export interface RevisionInfo {
  id: string
  time: string
  action: 'save' | 'delete' | 'rename' | 'restore'
  writer: string
}

export interface DeletedSong {
  slug: string
  title: string
  artist: string
  deletedAt: string
  deletedBy: string
}

export interface KeyList {
  writers: Writer[]
  readKey: { fromSecret: boolean, created: string | null, by: string | null }
}

/** An error reply of the API, or status 0 when the server could not be reached. */
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message)
  }

  get offline(): boolean {
    return this.status === 0
  }
}

export function createApi(getKey: () => string, base: string = API_URL) {
  async function call<T>(method: string, path: string, body?: unknown, ifMatch?: string | null): Promise<T> {
    const headers: Record<string, string> = { 'X-Api-Key': getKey(), Accept: 'application/json' }
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    if (ifMatch) headers['If-Match'] = ifMatch
    let response: Response
    try {
      response = await fetch(base + path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: 'no-store',
      })
    } catch {
      throw new ApiError(0, 'offline', 'The server could not be reached.')
    }
    if (response.status === 204) return undefined as T
    let data: unknown = null
    try {
      data = await response.json()
    } catch {
      // not JSON: e.g. the site's login page, or a server error
    }
    if (!response.ok) {
      const e = (data ?? {}) as { error?: string, message?: string }
      throw new ApiError(response.status, e.error ?? 'http_' + response.status, e.message ?? 'The server answered ' + response.status + '.')
    }
    return data as T
  }

  const song = (slug: string) => '/songs/' + encodeURIComponent(slug)

  return {
    me: () => call<Me>('GET', '/me'),
    songs: async () => (await call<{ songs: ServerSong[] }>('GET', '/songs')).songs,
    song: (slug: string) => call<ServerSong>('GET', song(slug)),
    save: (slug: string, content: string, etag: string | null) => call<ServerSong>('PUT', song(slug), { content }, etag),
    remove: (slug: string, etag: string) => call<void>('DELETE', song(slug), undefined, etag),
    rename: (slug: string, to: string, etag: string) => call<ServerSong>('POST', song(slug) + '/rename', { to }, etag),
    revisions: async (slug: string) => (await call<{ revisions: RevisionInfo[] }>('GET', song(slug) + '/revisions')).revisions,
    revision: (slug: string, id: string) =>
      call<RevisionInfo & { content: string }>('GET', song(slug) + '/revisions/' + encodeURIComponent(id)),
    restore: (slug: string, id: string, etag: string | null) =>
      call<ServerSong>('POST', song(slug) + '/revisions/' + encodeURIComponent(id) + '/restore', undefined, etag),
    deleted: async () => (await call<{ songs: DeletedSong[] }>('GET', '/deleted')).songs,
    keys: () => call<KeyList>('GET', '/keys'),
    createKey: (name: string) => call<{ name: string, key: string }>('POST', '/keys', { name }),
    revokeKey: (name: string) => call<void>('DELETE', '/keys/' + encodeURIComponent(name)),
    newReadKey: () => call<{ key: string }>('POST', '/read-key'),
  }
}

export type Api = ReturnType<typeof createApi>
