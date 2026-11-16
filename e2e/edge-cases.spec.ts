import { test, expect } from '@playwright/test'
import { closeList, openList, showFilms } from './browse'

test('enforces 100 picks across pages, then frees a slot and preserves it', async ({
  page
}) => {
  test.setTimeout(90000)
  await page.goto('/')
  const copy = page.getByRole('button', { name: 'Copy Radarr list URL' })
  const create = page.getByRole('button', { name: 'Create list in Radarr' })
  await openList(page)
  await expect(copy).toBeDisabled()
  await expect(create).toBeDisabled()
  await closeList(page)
  await showFilms(page, 'limit')
  for (let i = 1; i <= 100; i++) {
    await page
      .getByRole('button', { name: `Add Limit film ${i}`, exact: true })
      .click()
  }
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page
    .getByRole('button', { name: 'Add Limit film 101', exact: true })
    .click()
  await expect(page.getByRole('status')).toContainText('full at 100 films')
  await expect(
    page.getByRole('button', { name: 'Add Limit film 101', exact: true })
  ).toHaveAttribute('aria-pressed', 'false')
  await openList(page)
  await expect(page.getByRole('button', { name: /from list$/ })).toHaveCount(
    100
  )
  await page
    .getByRole('button', {
      name: 'Remove Limit film 1 from list',
      exact: true
    })
    .click()
  await closeList(page)
  await page
    .getByRole('button', { name: 'Add Limit film 101', exact: true })
    .click()
  await expect(page.getByRole('status')).toHaveCount(0)
  await openList(page)
  await page.getByLabel('List name').fill('   ')
  await expect(create).toBeDisabled()
  await expect(copy).toBeEnabled()
  await page.getByLabel('List name').fill('Full programme')
  await page.reload()
  await openList(page)
  await expect(page.getByLabel('List name')).toHaveValue('Full programme')
  await expect(page.getByRole('button', { name: /from list$/ })).toHaveCount(
    100
  )
  await expect(
    page.getByRole('button', { name: 'Remove Limit film 101 from list' })
  ).toBeVisible()
  await copy.click()
  const feed = await page.request.get(
    await page.getByLabel('List URL', { exact: true }).inputValue()
  )
  expect(await feed.json()).toEqual(
    Array.from({ length: 100 }, (_, i) => ({ id: i + 2 }))
  )
})

for (const draft of [
  '{broken',
  JSON.stringify({ name: 'Bad draft', picks: [{ id: -1, title: 'Invalid' }] })
]) {
  test(`recovers from ${draft === '{broken' ? 'malformed' : 'invalid'} local draft`, async ({
    page
  }) => {
    await page.goto('/')
    await page.evaluate(
      (value) => localStorage.setItem('listarr-draft', value),
      draft
    )
    await page.reload()
    await openList(page)
    await expect(page.getByLabel('List name')).toHaveValue('My film list')
    await expect(
      page.getByRole('button', { name: 'Copy Radarr list URL' })
    ).toBeDisabled()
    await closeList(page)
    await showFilms(page)
    await page.getByRole('button', { name: 'Add Dune', exact: true }).click()
    await page.reload()
    await openList(page)
    await expect(
      page.getByRole('button', { name: 'Remove Dune from list' })
    ).toBeVisible()
  })
}

test('recovers from rate limiting and keeps text search independent of discovery filters', async ({
  page
}) => {
  await page.goto('/')
  await showFilms(page, 'rate-limited')
  await expect(page.getByRole('alert')).toContainText(
    'TMDB is busy. Try again shortly.'
  )
  await page.getByText('Discover by genre, year & rating').click()
  await page.getByLabel('Genre', { exact: true }).selectOption('878')
  await page.getByLabel('Release year').fill('2021')
  await page.getByLabel('Search TMDB').fill('space')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Interstellar', exact: true })
  ).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await page.getByRole('button', { name: 'Add Dune', exact: true }).click()
  await page.getByRole('button', { name: 'Remove Dune', exact: true }).click()
  await openList(page)
  await expect(
    page.getByRole('button', { name: 'Copy Radarr list URL' })
  ).toBeDisabled()
})

test('retries a failed upstream search without losing the programme', async ({
  page
}, info) => {
  await page.goto('/')
  await showFilms(page)
  await page.getByRole('button', { name: 'Add Dune', exact: true }).click()
  await showFilms(page, `retry-${info.project.name}`)
  await expect(page.getByRole('alert')).toContainText('TMDB could not load')
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Interstellar', exact: true })
  ).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await openList(page)
  await expect(
    page.getByRole('button', { name: 'Remove Dune from list' })
  ).toBeVisible()
})
