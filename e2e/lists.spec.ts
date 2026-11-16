import { test, expect } from '@playwright/test'
import { token } from './auth'
test('creates an authorised Radarr list once and rejects denied or failed requests', async ({
  request
}) => {
  const headers = {
    Origin: process.env.APP_ORIGIN!,
    Authorization: `Bearer ${token()}`
  }
  const data = { name: 'Space season', ids: [157336, 438631] }
  const unauth = await request.post('/api/lists', {
    data,
    headers: { Origin: process.env.APP_ORIGIN! }
  })
  expect(unauth.status()).toBe(401)
  const denied = await request.post('/api/lists', {
    data,
    headers: { ...headers, Authorization: `Bearer ${token('user_other')}` }
  })
  expect(denied.status()).toBe(403)
  const crossOrigin = await request.post('/api/lists', {
    data,
    headers: { ...headers, Origin: 'https://evil.example' }
  })
  expect(crossOrigin.status()).toBe(403)
  const result = await request.post('/api/lists', { data, headers })
  expect(result.status()).toBe(200)
  const list = await result.json()
  expect(list.id).toBeGreaterThan(0)
  const repeated = await request.post('/api/lists', { data, headers })
  expect((await repeated.json()).existing).toBe(true)
  const feed = await request.get(list.url)
  expect(await feed.json()).toEqual([{ id: 157336 }, { id: 438631 }])
  const failed = await request.post('/api/lists', {
    data: { name: 'Reject this list', ids: [872585] },
    headers
  })
  expect(failed.status()).toBe(502)
  const invalid = await request.post('/api/lists', {
    data: { name: '', ids: [] },
    headers
  })
  expect(invalid.status()).toBe(400)
})

test('verifies expiry, signature and authorised party before contacting Radarr', async ({
  request
}) => {
  for (const bearer of [
    'not-a-token',
    token('user_operator', { exp: Math.floor(Date.now() / 1000) - 600 }),
    token('user_operator', { azp: 'https://evil.example' }),
    token().slice(0, -8) + 'tampered'
  ]) {
    const result = await request.post('/api/lists', {
      headers: {
        Origin: process.env.APP_ORIGIN!,
        Authorization: `Bearer ${bearer}`
      },
      data: { name: 'Forbidden', ids: [1] }
    })
    expect(result.status()).toBe(401)
  }
})

test('recovers after Radarr rejection and deduplicates reordered and concurrent snapshots', async ({
  request
}) => {
  const headers = {
    Origin: process.env.APP_ORIGIN!,
    Authorization: `Bearer ${token()}`
  }
  const failed = await request.post('/api/lists', {
    headers,
    data: { name: 'Reject this list', ids: [12, 13] }
  })
  expect(failed.status()).toBe(502)
  const recovered = await request.post('/api/lists', {
    headers,
    data: { name: 'Recovered', ids: [13, 12] }
  })
  expect(recovered.status()).toBe(200)
  const created = await recovered.json()
  expect(created.existing).toBe(false)
  const duplicate = await request.post('/api/lists', {
    headers,
    data: { name: 'Renamed', ids: [12, 13, 12] }
  })
  expect(await duplicate.json()).toEqual({ ...created, existing: true })
  const concurrent = await Promise.all(
    [1, 2].map(() =>
      request.post('/api/lists', {
        headers,
        data: { name: 'Concurrent', ids: [91, 92] }
      })
    )
  )
  const results = await Promise.all(
    concurrent.map((response) => response.json())
  )
  expect(results.map((result) => result.existing).sort()).toEqual([false, true])
  expect(results[0].id).toBe(results[1].id)
})

test('rejects invalid lists and anonymous feeds without credentials', async ({
  request
}) => {
  for (const ids of [
    '',
    '-1',
    '1,wat',
    Array.from({ length: 101 }, (_, i) => i + 1).join(',')
  ]) {
    expect((await request.get('/api/feed', { params: { ids } })).status()).toBe(
      400
    )
  }
  const feed = await request.get('/api/feed?ids=3,1,3,2')
  expect(feed.status()).toBe(200)
  expect(feed.headers()['cache-control']).toBe('public, max-age=300')
  expect(await feed.json()).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }])
  const headers = {
    Origin: process.env.APP_ORIGIN!,
    Authorization: `Bearer ${token()}`
  }
  for (const data of [
    { name: 'Empty', ids: [] },
    { name: 'Too many', ids: Array.from({ length: 101 }, (_, i) => i + 1) },
    { name: 'Invalid', ids: [-1] },
    { name: 'x'.repeat(81), ids: [1] }
  ])
    expect((await request.post('/api/lists', { headers, data })).status()).toBe(
      400
    )
  for (const query of [
    'page=0',
    'page=501',
    'kind=invalid',
    'year=bad',
    'genre=bad',
    'sort=bad'
  ]) {
    expect((await request.get(`/api/search?${query}`)).status()).toBe(400)
  }
})
