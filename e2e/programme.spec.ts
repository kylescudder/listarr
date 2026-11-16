import { test, expect } from '@playwright/test'
test('builds a programme, restores the draft and exports a Radarr feed', async ({
  page
}, info) => {
  await page.goto('/')
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
  await page.getByLabel('Programme name').fill('Space season')
  await page.reload()
  await expect(page.getByLabel('Programme name')).toHaveValue('Space season')
  await expect(
    page.getByRole('button', { name: 'Remove Dune from programme' })
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
  await page.getByRole('button', { name: 'Remove Dune from programme' }).click()
  await expect(page.getByLabel('List URL', { exact: true })).toHaveCount(0)
  await page.reload()
  await expect(
    page.getByRole('button', { name: 'Remove Dune from programme' })
  ).toHaveCount(0)
  const anonymous = await page.request.get(url)
  expect(await anonymous.json()).toEqual([{ id: 157336 }, { id: 438631 }])
})
test('explores people and collections, paginates and applies discovery filters', async ({
  page
}, info) => {
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: 'Dune', exact: true })
  ).toBeVisible()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByText('Page 2 of 2')).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Arrival', exact: true })
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Next', exact: true })
  ).toBeDisabled()
  await page.getByRole('button', { name: 'Previous', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Dune', exact: true })
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Previous', exact: true })
  ).toBeDisabled()
  await page.getByLabel('Look for').selectOption('person')
  await page.getByLabel('Search TMDB').fill('Nolan')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Christopher Nolan', exact: true })
  ).toBeVisible()
  await page.getByRole('button', { name: 'Explore films' }).click()
  await expect(
    page.getByRole('heading', { name: 'Interstellar', exact: true })
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Interstellar', exact: true })
  ).toHaveCount(1)
  await expect(
    page.getByRole('heading', { name: 'Oppenheimer', exact: true })
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Adult excluded', exact: true })
  ).toHaveCount(0)
  await page.getByLabel('Look for').selectOption('collection')
  await page.getByLabel('Search TMDB').fill('Dune')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Dune Collection', exact: true })
  ).toBeVisible()
  await page.getByRole('button', { name: 'Explore films' }).click()
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
    page.getByRole('heading', { name: 'Discover pictures' })
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Dune', exact: true })
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
  await page.getByLabel('Search TMDB').fill('missing')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'No pictures found' })
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
  await page
    .getByRole('button', { name: 'Create list in Radarr', exact: true })
    .click()
  await expect(page.getByRole('status')).toContainText('Configure Clerk')
})
