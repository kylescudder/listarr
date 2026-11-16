import type { Page } from '@playwright/test'

/** The directory opens on people; switch to film search. */
export async function showFilms(page: Page, query = '') {
  await page.getByLabel('Look for').selectOption('movie')
  await page.getByLabel('Search TMDB').fill(query)
  await page.getByRole('button', { name: 'Search', exact: true }).click()
}

/** The film list lives in a modal drawer opened from the masthead. */
export async function openList(page: Page) {
  await page.getByRole('button', { name: /^Your list/ }).click()
}

export async function closeList(page: Page) {
  await page.getByRole('button', { name: 'Close list' }).click()
}
