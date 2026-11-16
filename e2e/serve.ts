export {}
// Replace external services only in the test process. Production has no fixture mode.
const realFetch = globalThis.fetch
const films = [
  {
    id: 438631,
    title: 'Dune',
    release_date: '2021-09-15',
    vote_average: 7.8,
    poster_path: '/d5NXSklXo0qyIYkgV94XAgMIckC.jpg'
  },
  {
    id: 157336,
    title: 'Interstellar',
    release_date: '2014-11-05',
    vote_average: 8.5,
    poster_path: '/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg'
  },
  {
    id: 872585,
    title: 'Oppenheimer',
    release_date: '2023-07-19',
    vote_average: 8.1,
    poster_path: '/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg'
  }
]
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
    if (url.searchParams.get('query') === 'unavailable')
      return Response.json({ error: 'upstream unavailable' }, { status: 503 })
    if (
      url.pathname.includes('/search/person') ||
      url.pathname.includes('/person/popular')
    )
      return Response.json({
        results: [
          {
            id: 525,
            name: 'Christopher Nolan',
            known_for_department: 'Directing',
            profile_path: '/xuAIuYSmsUzKlUMBFGVZaWsY3DZ.jpg',
            known_for: [films[1], films[2]]
          },
          {
            id: 3894,
            name: 'Christian Bale',
            known_for_department: 'Acting',
            known_for: [films[0]]
          }
        ],
        total_pages: 1
      })
    if (url.pathname.includes('/search/collection'))
      return Response.json({
        results: [{ id: 726871, name: 'Dune Collection' }],
        total_pages: 1
      })
    if (url.pathname.includes('/search/company'))
      return Response.json({
        results: [{ id: 41077, name: 'A24' }],
        total_pages: 1
      })
    if (url.pathname.includes('/movie_credits'))
      return Response.json({
        cast: [films[0]],
        crew: [
          { ...films[1], job: 'Director' },
          { ...films[2], job: 'Producer' },
          { ...films[1], job: 'Director' }
        ]
      })
    if (url.pathname.includes('/collection/'))
      return Response.json({ parts: [films[0]] })
    return Response.json({
      results: url.searchParams.get('query') === 'missing' ? [] : films,
      total_pages: 2,
      total_results: 6
    })
  }
  if (url.hostname === 'radarr.fixture') {
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
  return realFetch(input, init)
}) as typeof fetch
await import('../server/production')
