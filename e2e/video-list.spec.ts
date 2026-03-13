import { test, expect } from '@playwright/test'
import { injectDirectoryHandle } from './helpers/fs-mock'
import fixtures from './fixtures/videos.json' with { type: 'json' }

test.describe('video list', () => {
  test.beforeEach(async ({ page }) => {
    await injectDirectoryHandle(page, fixtures)
    await page.goto('/')
  })

  test('shows video list with events grouped', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Videos CMS' })).toBeVisible()
    await expect(page.getByText('bkkjs22', { exact: false })).toBeVisible()
    await expect(page.getByText('creatorsgarten14', { exact: false })).toBeVisible()
  })

  test('shows video titles', async ({ page }) => {
    await expect(page.getByText('Make Pull Requests Great Again')).toBeVisible()
    await expect(page.getByText('Web Performance Tips')).toBeVisible()
  })

  test('can search videos by title', async ({ page }) => {
    const search = page.getByPlaceholder(/search/i)
    await search.fill('pull request')
    await expect(page.getByText('Make Pull Requests Great Again')).toBeVisible()
    await expect(page.getByText('Web Performance Tips')).not.toBeVisible()
  })

  test('can search videos by speaker', async ({ page }) => {
    const search = page.getByPlaceholder(/search/i)
    await search.fill('Alice')
    await expect(page.getByText('Building RAG AI Systems')).toBeVisible()
    await expect(page.getByText('Make Pull Requests Great Again')).not.toBeVisible()
  })

  test('shows published badge', async ({ page }) => {
    await expect(page.getByText('published').first()).toBeVisible()
  })

  test('navigates to edit page when clicking a video', async ({ page }) => {
    await page.getByText('Make Pull Requests Great Again').click()
    await expect(page).toHaveURL(/\/videos\/bkkjs22\/make-pull-requests-great-again/)
    await expect(page.getByRole('button', { name: /back/i })).toBeVisible()
  })
})
