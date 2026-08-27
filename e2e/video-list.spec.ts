import { test, expect } from '@playwright/test'
import { injectDirectoryHandle } from './helpers/fs-mock'
import fixtures from './fixtures/videos.json' with { type: 'json' }

test.describe('event index', () => {
  test.beforeEach(async ({ page }) => {
    await injectDirectoryHandle(page, fixtures)
    await page.goto('/')
  })

  test('shows event index with event names', async ({ page }) => {
    await expect(page).toHaveTitle('Videos CMS')
    await expect(page.getByRole('heading', { name: 'Videos CMS' })).toBeVisible()
    await expect(page.getByText('bkkjs22', { exact: false })).toBeVisible()
    await expect(page.getByText('creatorsgarten14', { exact: false })).toBeVisible()
  })

  test('shows video count per event', async ({ page }) => {
    // Wait for scan to complete
    await expect(page.getByText('bkkjs22')).toBeVisible()
    // Check for new format: "X videos, Y draft"
    await expect(page.getByText('2 videos, 1 draft').first()).toBeVisible()
  })

  test('navigates to filtered list when clicking an event', async ({ page }) => {
    await page.getByText('bkkjs22').click()
    await expect(page).toHaveURL(/event=bkkjs22/)
  })

  test('navigates to all-videos list via "All videos" link', async ({ page }) => {
    await expect(page.getByText('All videos →')).toBeVisible()
    await page.getByText('All videos →').click()
    await expect(page).toHaveURL(/\/videos/)
  })
})

test.describe('create event', () => {
  test.beforeEach(async ({ page }) => {
    await injectDirectoryHandle(page, fixtures)
    await page.goto('/')
    await expect(page.getByText('bkkjs22')).toBeVisible()
  })

  test('creates a new event folder and can add a video to it', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Create event' }).click()

    const dialog = page.getByRole('dialog')
    await dialog.getByPlaceholder('e.g. wwdc-2026').fill('workshop-2026')
    await dialog.getByRole('button', { name: 'Create event' }).click()

    // Lands on the filtered list for the new (empty) event
    await expect(page).toHaveURL(/event=workshop-2026/)
    await expect(page.getByText(/No videos in/)).toBeVisible()

    // Add a video into the freshly created event
    await page.getByRole('button', { name: 'Add video' }).click()
    const addDialog = page.getByRole('dialog')
    await addDialog.getByPlaceholder(/My Awesome Talk/).fill('Intro to Testing')
    await addDialog.getByPlaceholder(/my-talk-title/).fill('intro-to-testing')
    await addDialog.getByPlaceholder(/dQw4w9WgXcQ/).fill('dQw4w9WgXcQ')
    await addDialog.getByRole('button', { name: 'Create Video' }).click()

    await expect(page).toHaveURL(
      /\/videos\/workshop-2026\/intro-to-testing/,
    )

    const writes = await page.evaluate(() => (window as any).__writes ?? {})
    expect(writes['intro-to-testing.md']).toContain('title: Intro to Testing')
    expect(writes['intro-to-testing.md']).toContain('youtube: dQw4w9WgXcQ')
  })

  test('rejects an event name with spaces', async ({ page }) => {
    await page.getByRole('button', { name: 'Create event' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByPlaceholder('e.g. wwdc-2026').fill('bad name')
    await dialog.getByRole('button', { name: 'Create event' }).click()
    await expect(dialog.getByText(/cannot contain spaces/)).toBeVisible()
  })
})

test.describe('video list', () => {
  test.beforeEach(async ({ page }) => {
    await injectDirectoryHandle(page, fixtures)
    await page.goto('videos/')
    // Wait for scan to complete (videos appear once collection is populated)
    await expect(page.getByText('Make Pull Requests Great Again')).toBeVisible()
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
