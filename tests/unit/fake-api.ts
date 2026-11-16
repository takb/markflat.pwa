// An in-memory songbook API with the real one's rules (ETags, If-Match, 412, rename),
// installed as global fetch for the store tests.
import { vi } from 'vitest'

export interface FakeApi {
  songs: Map<string, string>
  /** old versions by slug, newest first: [id, content] */
  revisions: Map<string, [string, string][]>
  online: boolean
  calls: string[]
}

const etagOf = (content: string) => '"' + content.length + ':' + content + '"'

export function installFakeApi(initial: Record<string, string> = {}, key = 'writer-key'): FakeApi {
  const api: FakeApi = { songs: new Map(Object.entries(initial)), revisions: new Map(), online: true, calls: [] }
  const json = (status: number, data?: unknown) =>
    new Response(data === undefined ? null : JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
  const error = (status: number, code: string) => json(status, { error: code, message: code })
  const song = (slug: string) => {
    const content = api.songs.get(slug) ?? ''
    return { slug, title: slug, artist: '', etag: etagOf(content), content }
  }
  vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET'
    const path = url.replace(/^api/, '')
    api.calls.push(method + ' ' + path)
    if (!api.online) throw new TypeError('Failed to fetch')
    const headers = init.headers as Record<string, string>
    if (headers['X-Api-Key'] !== key) return error(401, 'unauthorized')
    const ifMatch = headers['If-Match'] ?? null
    const body = init.body ? JSON.parse(String(init.body)) : {}
    if (path === '/me') return json(200, { name: 'kim', writer: 'kim', canWrite: true, isAdmin: false })
    if (path === '/songs') return json(200, { songs: [...api.songs.keys()].sort().map(song) })
    const rv = /^\/songs\/([^/]+)\/revisions\/([^/]+)\/restore$/.exec(path)
    if (rv && method === 'POST') {
      const slug = decodeURIComponent(rv[1])
      const old = api.revisions.get(slug)?.find(([id]) => id === rv[2])
      if (!old) return error(404, 'not_found')
      if (api.songs.has(slug) ? ifMatch !== song(slug).etag : ifMatch !== null) return error(412, 'conflict')
      api.songs.set(slug, old[1])
      return json(200, song(slug))
    }
    const m = /^\/songs\/([^/]+)(\/rename)?$/.exec(path)
    if (!m) return error(404, 'not_found')
    const slug = decodeURIComponent(m[1])
    const exists = api.songs.has(slug)
    if (m[2]) {
      if (!exists) return error(404, 'not_found')
      if (ifMatch !== song(slug).etag) return error(412, 'conflict')
      api.songs.set(body.to, api.songs.get(slug) ?? '')
      api.songs.delete(slug)
      return json(200, song(body.to))
    }
    if (method === 'GET') return exists ? json(200, song(slug)) : error(404, 'not_found')
    if (method === 'PUT') {
      if (exists && ifMatch !== song(slug).etag) return error(412, ifMatch ? 'conflict' : 'exists')
      if (!exists && ifMatch) return error(412, 'conflict')
      api.songs.set(slug, body.content)
      return json(exists ? 200 : 201, song(slug))
    }
    if (method === 'DELETE') {
      if (!exists) return error(404, 'not_found')
      if (ifMatch !== song(slug).etag) return error(412, 'conflict')
      api.songs.delete(slug)
      return new Response(null, { status: 204 })
    }
    return error(405, 'method_not_allowed')
  })
  return api
}
