export {}
// Replace external services only in the test process. Production has no fixture mode.
const realFetch = globalThis.fetch
const films = [
  {
    id: 438631,
    title: 'Dune',
    release_date: '2021-09-15',
    vote_average: 7.8,
    poster_path: null
  },
  {
    id: 157336,
    title: 'Interstellar',
    release_date: '2014-11-05',
    vote_average: 8.5,
    poster_path: null
  },
  {
    id: 872585,
    title: 'Oppenheimer',
    release_date: '2023-07-19',
    vote_average: 8.1,
    poster_path: null
  }
]
const owned = { id: 900001, title: 'Already in Radarr', poster_path: null }
const arrival = { id: 329865, title: 'Arrival', release_date: '2016-11-10' }
const limits = Array.from({ length: 101 }, (_, i) => ({
  id: i + 1,
  title: `Limit film ${i + 1}`
}))
const failedOnce = new Set<string>()
const lists: Record<string, unknown>[] = []
globalThis.fetch = (async (
  input: Parameters<typeof fetch>[0],
  init?: RequestInit
) => {
  const url = new URL(
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input.url
  )
  if (url.hostname === 'api.themoviedb.org') {
    const queryKey = url.searchParams.get('query') || ''
    if (queryKey.startsWith('retry-') && !failedOnce.has(queryKey)) {
      failedOnce.add(queryKey)
      return Response.json({}, { status: 503 })
    }
    if (url.searchParams.get('query') === 'unavailable')
      return Response.json({ error: 'upstream unavailable' }, { status: 503 })
    if (url.pathname.includes('/search/person'))
      return Response.json({
        results: [{ id: 525, name: 'Christopher Nolan' }],
        total_pages: 1
      })
    if (url.pathname.includes('/search/collection'))
      return Response.json({
        results: [
          { id: 726871, name: 'Dune Collection' },
          { id: 726872, name: 'Owned Collection' }
        ],
        total_pages: 1
      })
    if (url.pathname.includes('/movie_credits'))
      return Response.json({
        cast: [
          owned,
          films[1],
          { id: 999, title: 'Adult excluded', adult: true }
        ],
        crew: [films[2], films[1]]
      })
    if (url.pathname.includes('/collection/'))
      return Response.json({
        parts: url.pathname.endsWith('/726872') ? [owned] : [owned, films[0]]
      })
    const query = url.searchParams.get('query')
    const page = Number(url.searchParams.get('page') || 1)
    if (query === 'rate-limited') return Response.json({}, { status: 429 })
    if (query === 'limit')
      return Response.json({
        results: limits.slice((page - 1) * 100, page * 100),
        total_pages: 2
      })
    if (
      url.pathname === '/3/discover/movie' &&
      url.searchParams.get('with_genres')
    ) {
      return Response.json({
        results:
          url.searchParams.get('with_genres') === '878' &&
          url.searchParams.get('primary_release_year') === '2021' &&
          url.searchParams.get('sort_by') === 'vote_average.desc'
            ? [films[0]]
            : [],
        total_pages: 1
      })
    }
    // Text search must not accidentally forward discovery-only filters.
    if (
      query &&
      ['with_genres', 'primary_release_year', 'sort_by'].some((key) =>
        url.searchParams.has(key)
      )
    )
      return Response.json({}, { status: 400 })
    return Response.json({
      results:
        query === 'missing'
          ? []
          : page === 2
            ? [owned, arrival]
            : [...films, owned],
      total_pages: query === 'missing' ? 1 : 2,
      total_results: 4
    })
  }
  if (url.hostname === 'radarr.fixture') {
    if (url.pathname === '/api/v3/movie') {
      if (
        init?.headers &&
        new Headers(init.headers).get('X-Api-Key') !== 'fixture-only'
      )
        return Response.json({}, { status: 401 })
      return Response.json([
        { id: 1, tmdbId: owned.id, hasFile: false, monitored: true }
      ])
    }
    if (url.pathname.endsWith('/schema'))
      return Response.json([
        {
          implementation: 'RadarrListImport',
          configContract: 'RadarrListSettings',
          fields: [{ name: 'url', value: '' }]
        }
      ])
    if (init?.method === 'POST') {
      const body = JSON.parse(String(init.body))
      if (
        body.enabled !== true ||
        body.enableAuto !== true ||
        body.monitor !== 'movieOnly' ||
        body.searchOnAdd !== false ||
        body.qualityProfileId !== 1 ||
        body.rootFolderPath !== '/movies'
      )
        return Response.json(
          { error: 'Invalid Radarr contract' },
          { status: 400 }
        )
      if (body.name === 'Reject this list')
        return Response.json({ error: 'fixture error' }, { status: 500 })
      const list = { ...body, id: lists.length + 1 }
      lists.push(list)
      return Response.json(list)
    }
    return Response.json(lists)
  }
  if (['127.0.0.1', 'localhost'].includes(url.hostname))
    return realFetch(input, init)
  throw new Error(`Unexpected outbound host: ${url.hostname}`)
}) as typeof fetch
await import('../server/production')
