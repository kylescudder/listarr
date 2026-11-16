import { test, expect } from '@playwright/test'
import { sign } from 'node:crypto'
function token(subject = 'user_operator') {
  const now = Math.floor(Date.now() / 1000)
  const head = Buffer.from(
    JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'fixture' })
  ).toString('base64url')
  const body = Buffer.from(
    JSON.stringify({
      sub: subject,
      iss: 'https://fixture.clerk.accounts.dev',
      sid: 'sess_fixture',
      azp: process.env.APP_ORIGIN,
      iat: now,
      nbf: now - 5,
      exp: now + 300
    })
  ).toString('base64url')
  const signature = sign(
    'RSA-SHA256',
    Buffer.from(`${head}.${body}`),
    process.env.E2E_PRIVATE_KEY!
  ).toString('base64url')
  return `${head}.${body}.${signature}`
}
test('builds a programme, restores the draft and exports a Radarr feed', async ({
  page
}, info) => {
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: 'Christopher Nolan', exact: true })
  ).toBeVisible()
  await page.getByLabel('Look for').selectOption('movie')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Dune', exact: true })
  ).toBeVisible()
  await page.getByLabel('Search TMDB').fill('space')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Results for “space”' })
  ).toBeVisible()
  await page.getByRole('button', { name: 'Add Dune', exact: true }).click()
  await page
    .getByRole('button', { name: 'Add Interstellar', exact: true })
    .click()
  await expect(page.getByRole('button', { name: 'Your list 2' })).toBeVisible()
  await page.getByRole('button', { name: /^Your list/ }).click()
  await page.getByLabel('List name').fill('Space season')
  await page.reload()
  await page.getByRole('button', { name: /^Your list/ }).click()
  await expect(page.getByLabel('List name')).toHaveValue('Space season')
  await expect(
    page.getByRole('button', { name: 'Remove Dune from list' })
  ).toBeVisible()
  await page.getByRole('button', { name: 'Copy Radarr list URL' }).click()
  const url = await page.getByLabel('List URL', { exact: true }).inputValue()
  const feed = await page.request.get(url)
  expect(await feed.json()).toEqual([{ id: 157336 }, { id: 438631 }])
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true)
  await page.screenshot({
    path: info.outputPath('programme.png'),
    fullPage: true
  })
  await page.getByRole('button', { name: 'Remove Dune from list' }).click()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Your list 1' })).toBeVisible()
})
test('explores people and collections, paginates and applies discovery filters', async ({
  page
}, info) => {
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: 'Christopher Nolan', exact: true })
  ).toBeVisible()
  await page.getByLabel('Look for').selectOption('movie')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Dune', exact: true })
  ).toBeVisible()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByText('Page 2 of 2')).toBeVisible()
  await page.getByLabel('Look for').selectOption('person')
  await page.getByLabel('Search TMDB').fill('Nolan')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Christopher Nolan', exact: true })
  ).toBeVisible()
  await page
    .getByRole('button', { name: 'Christopher Nolan', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Interstellar', exact: true })
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Interstellar', exact: true })
  ).toHaveCount(1)
  await page.getByLabel('Look for').selectOption('collection')
  await page.getByLabel('Search TMDB').fill('Dune')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Dune Collection', exact: true })
  ).toBeVisible()
  await page
    .getByRole('button', { name: 'Dune Collection', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Dune', exact: true })
  ).toBeVisible()
  await page.getByLabel('Look for').selectOption('movie')
  await page.getByLabel('Search TMDB').fill('')
  await page.getByText('Discover by genre, year & rating').click()
  await page.getByLabel('Genre', { exact: true }).selectOption('878')
  await page.getByLabel('Release year').fill('2021')
  await page.getByLabel('Sort by').selectOption('vote_average.desc')
  const request = page.waitForRequest(
    (r) => r.url().includes('/api/search') && r.url().includes('genre=878')
  )
  await page
    .getByRole('button', { name: 'Discover films', exact: true })
    .click()
  expect((await request).url()).toContain('year=2021')
  await expect(
    page.getByRole('heading', { name: 'Discover films' })
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Oppenheimer', exact: true })
  ).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  await expect
    .poll(() =>
      page
        .locator('.films img')
        .evaluateAll((images) =>
          images.every((image) => (image as HTMLImageElement).complete)
        )
    )
    .toBe(true)
  await page.screenshot({
    path: info.outputPath('discovery.png'),
    fullPage: true
  })
})
test('handles no results, upstream failure and signed-out list creation', async ({
  page
}, info) => {
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: 'Christopher Nolan', exact: true })
  ).toBeVisible()
  await page.getByLabel('Look for').selectOption('movie')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await page.getByLabel('Search TMDB').fill('missing')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'No results found' })
  ).toBeVisible()
  await page.getByLabel('Search TMDB').fill('unavailable')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('TMDB could not load')
  await page.screenshot({
    path: info.outputPath('upstream-failure.png'),
    fullPage: true
  })
  await page.getByLabel('Search TMDB').fill('Dune')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await page.getByRole('button', { name: 'Add Dune', exact: true }).click()
  await page.getByRole('button', { name: /^Your list/ }).click()
  await page
    .getByRole('button', { name: 'Create list in Radarr', exact: true })
    .click()
  await expect(page.getByRole('status')).toContainText('Configure Clerk')
})
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

test('starts with people, filters a filmography by credit and browses studio films', async ({
  page
}, info) => {
  await page.goto('/')
  await expect(page.getByLabel('Look for')).toHaveValue('person')
  await expect(
    page.getByRole('heading', { name: 'Christopher Nolan', exact: true })
  ).toBeVisible()
  await page.locator('.headshot img').evaluateAll(async (images) => {
    await Promise.all(
      images.map((image) => (image as HTMLImageElement).decode())
    )
  })
  await page.screenshot({
    path: info.outputPath('people-directory.png'),
    fullPage: true
  })
  await page
    .getByRole('button', { name: 'Christopher Nolan', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Christopher Nolan', exact: true })
  ).toBeVisible()
  await page.getByRole('button', { name: 'Directing', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Interstellar', exact: true })
  ).toHaveCount(1)
  await expect(
    page.getByRole('heading', { name: 'Oppenheimer', exact: true })
  ).toHaveCount(0)
  await page.screenshot({
    path: info.outputPath('directing-credits.png'),
    fullPage: true
  })
  await page.getByRole('button', { name: 'Acting', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Dune', exact: true })
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Interstellar', exact: true })
  ).toHaveCount(0)
  await page.getByRole('button', { name: 'Add Dune', exact: true }).click()
  await page.screenshot({
    path: info.outputPath('acting-credits.png'),
    fullPage: true
  })
  await page.getByRole('button', { name: 'Back to results' }).click()
  await expect(
    page.getByRole('heading', { name: 'People to explore', exact: true })
  ).toBeVisible()
  await page.getByLabel('Look for').selectOption('company')
  await page.getByLabel('Search TMDB').fill('A24')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'A24', exact: true })
  ).toBeVisible()
  await page.getByRole('button', { name: 'A24', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Dune', exact: true })
  ).toBeVisible()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByText('Page 2 of 2')).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true)
  await page.screenshot({
    path: info.outputPath('studio-films.png'),
    fullPage: true
  })
})
