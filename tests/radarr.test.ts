import { afterEach, expect, test } from 'bun:test'
import { handleApi } from '../src/server/api'

const realFetch = globalThis.fetch
const originalEnv = { ...process.env }
const movies = [
  { id: 10, title: 'Downloaded film' },
  { id: 20, title: 'Pending film' },
  { id: 30, title: 'New film' }
]
let library: unknown = [
  { id: 999, tmdbId: 10, hasFile: true, monitored: false },
  { id: 30, tmdbId: 20, hasFile: false, monitored: true }
]
function configure(failure?: 'http' | 'network') {
  process.env.TMDB_READ_TOKEN = 'test-tmdb'
  process.env.RADARR_URL = 'http://radarr.fixture/radarr/'
  process.env.RADARR_API_KEY = 'test-secret'
  globalThis.fetch = (async (input, init) => {
    const url = new URL(String(input))
    if (url.hostname === 'api.themoviedb.org') {
      if (url.pathname.includes('movie_credits'))
        return Response.json({ cast: movies, crew: movies })
      if (url.pathname.includes('/collection/'))
        return Response.json({ parts: movies })
      return Response.json({ results: movies, total_pages: 3 })
    }
    expect(url.href).toBe('http://radarr.fixture/radarr/api/v3/movie')
    expect(init?.headers).toMatchObject({ 'X-Api-Key': 'test-secret' })
    if (failure === 'network') throw new Error('Connection refused')
    return Response.json(library, { status: failure === 'http' ? 401 : 200 })
  }) as typeof fetch
}
afterEach(() => {
  globalThis.fetch = realFetch
  process.env = { ...originalEnv }
  library = [
    { id: 999, tmdbId: 10, hasFile: true, monitored: false },
    { id: 30, tmdbId: 20, hasFile: false, monitored: true }
  ]
})
const request = (path: string) =>
  handleApi(new Request(`http://localhost${path}`))

test('hides every existing Radarr TMDB ID across movie browsing without sign-in', async () => {
  configure()
  for (const path of [
    '/api/search',
    '/api/search?q=film&page=2',
    '/api/person/1',
    '/api/collection/2'
  ]) {
    const response = await request(path)
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect((await response.json()).results).toEqual([movies[2]])
  }
})
test('refreshes library membership and preserves TMDB pagination on empty pages', async () => {
  configure()
  expect((await (await request('/api/search')).json()).results).toEqual([
    movies[2]
  ])
  library = movies.map((movie) => ({ tmdbId: movie.id }))
  expect(await (await request('/api/search')).json()).toMatchObject({
    results: [],
    total_pages: 3,
    radarrFiltered: true
  })
  library = []
  expect((await (await request('/api/search')).json()).results).toEqual(movies)
})
test('browses without Radarr when both credentials are absent and leaves person results alone', async () => {
  configure('network')
  delete process.env.RADARR_URL
  delete process.env.RADARR_API_KEY
  expect(await (await request('/api/search')).json()).toMatchObject({
    results: movies,
    radarrFiltered: false
  })
  expect((await request('/api/search?kind=person&q=person')).status).toBe(200)
})
test('shows a retryable error for rejected, unreachable, malformed or incomplete Radarr connections', async () => {
  for (const failure of ['http', 'network', undefined] as const) {
    configure(failure)
    library = { error: 'Unexpected response' }
    const response = await request('/api/search')
    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({
      error:
        'Could not check films already in Radarr. Check RADARR_URL and RADARR_API_KEY, then try again.'
    })
  }
  configure()
  delete process.env.RADARR_API_KEY
  expect((await request('/api/search')).status).toBe(502)
})
