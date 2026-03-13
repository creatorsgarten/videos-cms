import { test, expect } from '@playwright/test'
import { injectDirectoryHandle } from './helpers/fs-mock'
import fixtures from './fixtures/videos.json' with { type: 'json' }

test.describe('video edit form', () => {
  test.beforeEach(async ({ page }) => {
    await injectDirectoryHandle(page, fixtures)
    await page.goto('videos/bkkjs22/make-pull-requests-great-again')
    // Wait for the form to be ready
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible()
  })

  test('shows pre-filled form fields', async ({ page }) => {
    await expect(page.getByLabel('Title *')).toHaveValue('Make Pull Requests Great Again')
    await expect(page.getByLabel('YouTube ID *')).toHaveValue('fIF3w66IroM')
    await expect(page.getByLabel('Language')).toHaveValue('en')
    await expect(page.getByRole('checkbox', { name: /published/i })).toBeChecked()
    await expect(page.getByRole('checkbox', { name: /managed/i })).toBeChecked()
  })

  test('validates required title field', async ({ page }) => {
    const titleInput = page.getByLabel('Title *')
    await titleInput.clear()
    await titleInput.blur()
    await expect(page.getByText('Required')).toBeVisible()
  })

  test('saves changes and writes to file', async ({ page }) => {
    const titleInput = page.getByLabel('Title *')
    await titleInput.clear()
    await titleInput.fill('Updated Title')

    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Saved')).toBeVisible()

    // Verify the file was written with the new title
    const writes = await page.evaluate(() => (window as any).__writes ?? {})
    const written = Object.values(writes)[0] as string
    expect(written).toContain('title: Updated Title')
  })

  test('validates chapters YAML', async ({ page }) => {
    const chaptersArea = page.locator('textarea').filter({ hasText: '' }).nth(0)
    // Find chapters textarea by its placeholder
    const chaptersTa = page
      .getByPlaceholder("'0:00': Introduction")
    await chaptersTa.fill('invalid: yaml: [broken')
    await chaptersTa.blur()
    await expect(page.getByText(/invalid yaml/i)).toBeVisible()
  })

  test('uploads subtitle file and auto-checks the checkbox', async ({ page }) => {
    const vttContent = 'WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nHello world\n'
    const enInput = page.locator('[data-testid="subtitle-upload-en"]')

    await enInput.setInputFiles({
      name: 'test_en.vtt',
      mimeType: 'text/vtt',
      buffer: Buffer.from(vttContent),
    })

    await expect(page.getByText('uploaded').first()).toBeVisible()

    // The en subtitle checkbox should now be checked
    await expect(page.getByRole('checkbox', { name: 'en' })).toBeChecked()

    // The file should have been written
    const writes = await page.evaluate(() => (window as any).__writes ?? {})
    expect(Object.keys(writes)).toContain('make-pull-requests-great-again_en.vtt')
    expect(writes['make-pull-requests-great-again_en.vtt']).toContain('Hello world')
  })

  test('can uncheck published and save as draft', async ({ page }) => {
    await page.getByRole('checkbox', { name: /published/i }).uncheck()
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Saved')).toBeVisible()

    const writes = await page.evaluate(() => (window as any).__writes ?? {})
    const written = Object.values(writes)[0] as string
    expect(written).not.toContain('published:')
  })
})
