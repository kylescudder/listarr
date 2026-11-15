import { test, expect } from 'bun:test'
import { handleApi } from '../src/server/api'
test('a Radarr custom list remains readable without a session and ignores duplicate IDs', async () => {
  const response = await handleApi(
    new Request('http://localhost/api/feed?ids=438631,157336,438631')
  )
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual([{ id: 157336 }, { id: 438631 }])
})
test('rejects malformed feeds rather than returning an empty list to Radarr', async () => {
  for (const ids of [
    '',
    '-1',
    '1.2',
    '1,0',
    'abc',
    Array.from({ length: 101 }, (_, i) => i + 1).join(',')
  ]) {
    const response = await handleApi(
      new Request(`http://localhost/api/feed?ids=${ids}`)
    )
    expect(response.status).toBe(400)
  }
})
test('search validation rejects unbounded pages and invalid discovery fields', async () => {
  for (const query of [
    'page=501',
    'genre=invalid',
    'year=abc',
    'sort=unknown',
    'kind=tv'
  ]) {
    expect(
      (await handleApi(new Request(`http://localhost/api/search?${query}`)))
        .status
    ).toBe(400)
  }
})
