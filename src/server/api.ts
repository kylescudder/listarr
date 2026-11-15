import { verifyToken } from '@clerk/backend'
import { z } from 'zod'
import { decodeList, listSchema, listUrl } from '../list'

class ApiError extends Error {
  constructor(
    message: string,
    readonly status = 400
  ) {
    super(message)
  }
}
const searchSchema = z.object({
  q: z.string().trim().max(150).default(''),
  kind: z.enum(['movie', 'person', 'collection']).default('movie'),
  page: z.coerce.number().int().min(1).max(500).default(1),
  genre: z.string().regex(/^\d*$/).default(''),
  year: z
    .string()
    .regex(/^(\d{4})?$/)
    .default(''),
  sort: z
    .enum(['popularity.desc', 'vote_average.desc', 'primary_release_date.desc'])
    .default('popularity.desc')
})
async function tmdb(path: string, params: Record<string, string> = {}) {
  if (!process.env.TMDB_READ_TOKEN)
    throw new ApiError(
      'Set TMDB_READ_TOKEN on the server to search films.',
      503
    )
  const url = new URL(`https://api.themoviedb.org/3/${path}`)
  for (const [key, value] of Object.entries(params))
    if (value) url.searchParams.set(key, value)
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.TMDB_READ_TOKEN}` },
    signal: AbortSignal.timeout(15000)
  })
  if (!response.ok)
    throw new ApiError(
      response.status === 429
        ? 'TMDB is busy. Try again shortly.'
        : 'TMDB could not load these results. Try again.',
      502
    )
  return response.json()
}
async function requireOperator(request: Request) {
  const origin = process.env.APP_ORIGIN
  if (!origin || request.headers.get('origin') !== origin)
    throw new ApiError('Request must come from APP_ORIGIN.', 403)
  const token = request.headers.get('authorization')?.replace(/^Bearer /, '')
  if (!token) throw new ApiError('Sign in to create a list in Radarr.', 401)
  if (!process.env.CLERK_SECRET_KEY && !process.env.CLERK_JWT_KEY)
    throw new ApiError('Clerk is not configured on the server.', 503)
  let subject: string
  try {
    const claims = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
      jwtKey: process.env.CLERK_JWT_KEY,
      authorizedParties: [origin]
    })
    subject = claims.sub
  } catch {
    throw new ApiError('Your session expired. Sign in again.', 401)
  }
  if (
    !process.env.RADARR_ALLOWED_USER_IDS?.split(',')
      .map((s) => s.trim())
      .includes(subject)
  )
    throw new ApiError('This account cannot create lists in Radarr.', 403)
}
async function radarr(path: string, init: RequestInit = {}) {
  const base = process.env.RADARR_URL
  const key = process.env.RADARR_API_KEY
  if (!base || !key)
    throw new ApiError('Set RADARR_URL and RADARR_API_KEY on the server.', 503)
  const response = await fetch(`${base.replace(/\/$/, '')}/api/v3/${path}`, {
    ...init,
    headers: { 'X-Api-Key': key, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(20000)
  })
  if (!response.ok)
    throw new ApiError(
      'Radarr rejected the request. Check its connection, list URL, quality profile and root folder.',
      502
    )
  return response.json()
}
let creation: Promise<unknown> = Promise.resolve()
async function createList(request: Request) {
  await requireOperator(request)
  const body = listSchema.parse(await request.json())
  const origin = process.env.FEED_ORIGIN || process.env.APP_ORIGIN!
  const url = listUrl(origin, body.ids)
  const run = async () => {
    const existing = (await radarr('importlist')) as {
      id: number
      fields: { name: string; value: unknown }[]
    }[]
    const found = existing.find((list) =>
      list.fields.some(
        (field) => field.name.toLowerCase() === 'url' && field.value === url
      )
    )
    if (found) return { id: found.id, url, existing: true }
    const schemas = (await radarr('importlist/schema')) as {
      implementation: string
      fields: { name: string; value: unknown }[]
    }[]
    const schema = schemas.find(
      (item) => item.implementation === 'RadarrListImport'
    )
    if (!schema)
      throw new ApiError(
        'This Radarr does not support custom Radarr lists.',
        502
      )
    const qualityProfileId = Number(process.env.RADARR_QUALITY_PROFILE_ID)
    const rootFolderPath = process.env.RADARR_ROOT_FOLDER
    if (
      !Number.isInteger(qualityProfileId) ||
      qualityProfileId < 1 ||
      !rootFolderPath
    )
      throw new ApiError(
        'Set RADARR_QUALITY_PROFILE_ID and RADARR_ROOT_FOLDER on the server.',
        503
      )
    const result = await radarr('importlist', {
      method: 'POST',
      body: JSON.stringify({
        ...schema,
        id: undefined,
        name: body.name,
        enabled: true,
        enableAuto: true,
        searchOnAdd: false,
        monitor: 'movieOnly',
        qualityProfileId,
        rootFolderPath,
        minimumAvailability: 'released',
        tags: [],
        fields: schema.fields.map((field) =>
          field.name.toLowerCase() === 'url' ? { ...field, value: url } : field
        )
      })
    })
    return { id: result.id, url, existing: false }
  }
  const next = creation.then(run, run)
  creation = next.catch(() => {})
  return next
}
export async function handleApi(request: Request): Promise<Response> {
  const url = new URL(request.url)
  try {
    if (url.pathname === '/api/health')
      return Response.json({
        ok: true,
        revision: process.env.LISTARR_REVISION || 'development'
      })
    if (url.pathname === '/api/feed' && request.method === 'GET')
      return Response.json(
        decodeList(url.searchParams.get('ids') || '').map((id) => ({ id })),
        { headers: { 'Cache-Control': 'public, max-age=300' } }
      )
    if (url.pathname === '/api/search' && request.method === 'GET') {
      const { q, kind, page, genre, year, sort } = searchSchema.parse(
        Object.fromEntries(url.searchParams)
      )
      if (kind !== 'movie' && !q)
        return Response.json({ results: [], total_pages: 0, total_results: 0 })
      const result = await tmdb(q ? `search/${kind}` : 'discover/movie', {
        query: q,
        page: String(page),
        include_adult: 'false',
        language: 'en-GB',
        ...(!q
          ? {
              with_genres: genre,
              primary_release_year: year,
              sort_by: sort,
              'vote_count.gte': '100'
            }
          : {})
      })
      return Response.json(result, {
        headers: { 'Cache-Control': 'public, max-age=60' }
      })
    }
    const expansion = url.pathname.match(/^\/api\/(person|collection)\/(\d+)$/)
    if (expansion && request.method === 'GET') {
      const result = await tmdb(
        expansion[1] === 'person'
          ? `person/${expansion[2]}/movie_credits`
          : `collection/${expansion[2]}`
      )
      const movies =
        expansion[1] === 'person'
          ? [...result.cast, ...result.crew]
          : result.parts
      return Response.json({
        results: [
          ...new Map(
            movies
              .filter((m: { adult?: boolean }) => !m.adult)
              .map((m: { id: number }) => [m.id, m])
          ).values()
        ],
        total_pages: 1
      })
    }
    if (url.pathname === '/api/lists' && request.method === 'POST')
      return Response.json(await createList(request))
    return Response.json({ error: 'Not found' }, { status: 404 })
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 400
    const message =
      error instanceof ApiError
        ? error.message
        : error instanceof z.ZodError
          ? 'Check the search or list values. Lists need 1–100 films.'
          : 'The request could not be completed. Try again.'
    return Response.json(
      { error: message },
      { status, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
