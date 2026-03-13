# videos-cms

A browser-based CMS for editing video metadata in the [creatorsgarten/videos](https://github.com/creatorsgarten/videos) repository. Deployed as a SPA to GitHub Pages at `/videos-cms/`.

## What it does

- Open the local `videos` repo folder via the File System Access API (persists across reloads)
- Browse videos grouped by event
- Edit video frontmatter (title, speaker, YouTube ID, chapters, subtitles, etc.)
- Save changes directly to `.md` files on disk
- Upload `.vtt` subtitle files alongside `.md` files

## Routes

| Route | Description |
|---|---|
| `/` | Event index — lists all events with video counts |
| `/videos/` | All videos (searchable) |
| `/videos/?event=<event>` | Videos filtered to one event |
| `/videos/<event>/<slug>` | Edit form for a single video |

## Development

```bash
pnpm install
pnpm dev
```

## Testing

```bash
# Unit tests (Vitest)
pnpm test

# E2E tests (Playwright)
pnpm test:e2e
```

## Build & deploy

```bash
pnpm build   # outputs to dist/
```

Deployed via GitHub Actions to GitHub Pages at `https://creatorsgarten.github.io/videos-cms/`.

## Tech stack

| Concern | Tool |
|---|---|
| Framework | TanStack Start (SPA mode) + TanStack Router |
| Data store | `@tanstack/react-db` (local-only collection) |
| Forms | `@tanstack/react-form` + Zod v4 (Standard Schema) |
| YAML | `js-yaml` |
| FS persistence | File System Access API + `idb-keyval` |
| Styling | Tailwind CSS |
| Unit tests | Vitest |
| E2E tests | Playwright |
