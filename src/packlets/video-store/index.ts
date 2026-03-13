import { createCollection, localOnlyCollectionOptions } from '@tanstack/react-db'
import { readFile, writeFile } from '../fs'
import {
  parseVideoFile,
  serializeVideoFile,
  type ParsedVideo,
  type VideoFrontMatter,
} from '../video-parser'

// ---------------------------------------------------------------------------
// Collection
// ---------------------------------------------------------------------------

export type VideoRecord = ParsedVideo & { id: string }

export const videosCollection = createCollection(
  localOnlyCollectionOptions<VideoRecord>({
    id: 'videos',
    getKey: (item) => item.id,
  }),
)

// Track current IDs so we can clear on rescan (TanStack DB has no getAll API)
let currentIds = new Set<string>()

// Module-level cache for synchronous reads (useLiveQuery can be async on first render)
const videoCache = new Map<string, VideoRecord>()

// ---------------------------------------------------------------------------
// Scan
// ---------------------------------------------------------------------------

/** Traverse data/videos/<event>/<slug>.md and load all videos into the collection. */
export async function scanVideos(
  rootHandle: FileSystemDirectoryHandle,
): Promise<void> {
  // Clear existing records
  for (const id of currentIds) {
    videosCollection.delete(id)
  }
  currentIds = new Set()
  fileHandles.clear()
  eventDirHandles.clear()
  videoCache.clear()

  const dataHandle = await rootHandle.getDirectoryHandle('data')
  const videosHandle = await dataHandle.getDirectoryHandle('videos')

  for await (const [event, eventHandle] of videosHandle.entries()) {
    if (eventHandle.kind !== 'directory') continue

    for await (const [filename, fileHandle] of eventHandle.entries()) {
      if (fileHandle.kind !== 'file' || !filename.endsWith('.md')) continue

      const slug = filename.replace(/\.md$/, '')
      try {
        const text = await readFile(fileHandle as FileSystemFileHandle)
        const { data, content } = parseVideoFile(text)
        const id = `${event}/${slug}`
        const fh = fileHandle as FileSystemFileHandle
        const record: VideoRecord = { id, event, slug, data, content, fileHandle: fh }
        videosCollection.insert(record)
        currentIds.add(id)
        fileHandles.set(id, fh)
        eventDirHandles.set(id, eventHandle as FileSystemDirectoryHandle)
        videoCache.set(id, record)
      } catch (e) {
        console.error(`Failed to parse ${event}/${slug}.md`, e)
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Save (write-through)
// ---------------------------------------------------------------------------

// Keep separate maps since we can't read back from the collection imperatively
const fileHandles = new Map<string, FileSystemFileHandle>()
const eventDirHandles = new Map<string, FileSystemDirectoryHandle>()

/** Synchronous read — use when useLiveQuery hasn't resolved yet (e.g. first render after navigation) */
export function getVideoById(id: string): VideoRecord | undefined {
  return videoCache.get(id)
}

export async function saveVideo(
  id: string,
  data: VideoFrontMatter,
  content: string,
): Promise<void> {
  const handle = fileHandles.get(id)
  if (!handle) throw new Error(`Video not found: ${id}`)

  const text = serializeVideoFile(data, content)
  await writeFile(handle, text)

  videosCollection.update(id, (draft) => {
    draft.data = data
    draft.content = content
  })

  const cached = videoCache.get(id)
  if (cached) videoCache.set(id, { ...cached, data, content })
}

export async function saveSubtitle(
  id: string,
  lang: 'en' | 'th',
  file: File,
): Promise<void> {
  const cached = videoCache.get(id)
  const dirHandle = eventDirHandles.get(id)
  if (!cached || !dirHandle) throw new Error(`Video not found: ${id}`)

  const filename = `${cached.slug}_${lang}.vtt`
  const fh = await dirHandle.getFileHandle(filename, { create: true })
  const text = await file.text()
  await writeFile(fh, text)
}
