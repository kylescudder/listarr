import { expect, test } from '@playwright/test'

test('hides Radarr films throughout browsing and keeps empty collections understandable', async ({
  page
}, info) => {
  await page.goto('/')
  await expect(
    page.getByText('Films already in Radarr are hidden.')
  ).toBeVisible()
  const hidden = page.getByRole('heading', {
    name: 'Already in Radarr',
    exact: true
  })
  await expect(hidden).toHaveCount(0)
  await expect(
    page.getByRole('heading', { name: 'Dune', exact: true })
  ).toBeVisible()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Arrival', exact: true })
  ).toBeVisible()
  await expect(hidden).toHaveCount(0)
  await page.getByLabel('Search TMDB').fill('space')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Dune', exact: true })
  ).toBeVisible()
  await expect(hidden).toHaveCount(0)
  await page.reload()
  await expect(
    page.getByText('Films already in Radarr are hidden.')
  ).toBeVisible()
  await expect(hidden).toHaveCount(0)
  await page.screenshot({
    path: info.outputPath('radarr-filtered.png'),
    fullPage: true
  })
  await page.getByLabel('Look for').selectOption('person')
  await page.getByLabel('Search TMDB').fill('Nolan')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await page.getByRole('button', { name: 'Explore films' }).click()
  await expect(
    page.getByRole('heading', { name: 'Interstellar', exact: true })
  ).toBeVisible()
  await expect(hidden).toHaveCount(0)
  await page.getByLabel('Look for').selectOption('collection')
  await page.getByLabel('Search TMDB').fill('Owned')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await page
    .locator('article')
    .filter({ hasText: 'Owned Collection' })
    .getByRole('button', { name: 'Explore films' })
    .click()
  await expect(
    page.getByRole('heading', { name: 'No pictures found' })
  ).toBeVisible()
  await expect(hidden).toHaveCount(0)
  await expect(
    page.getByText('Films already in Radarr are hidden.')
  ).toBeVisible()
  await page.screenshot({
    path: info.outputPath('radarr-empty-collection.png'),
    fullPage: true
  })
})
