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

/** Traverse data/videos/<event>/<slug>.md and load all videos into the collection.
 *  Non-destructive: upserts records as they are found, then removes any that
 *  disappeared from disk.  onProgress is called with the running file count. */
export async function scanVideos(
  rootHandle: FileSystemDirectoryHandle,
  onProgress?: (count: number) => void,
): Promise<void> {
  const newIds = new Set<string>()
  const newFileHandles = new Map<string, FileSystemFileHandle>()
  const newEventDirHandles = new Map<string, FileSystemDirectoryHandle>()

  const dataHandle = await rootHandle.getDirectoryHandle('data')
  const videosHandle = await dataHandle.getDirectoryHandle('videos')
  let count = 0

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
        const record: VideoRecord = { id, event, slug, data, content }

        if (currentIds.has(id)) {
          videosCollection.update(id, (draft) => {
            draft.data = data
            draft.content = content
          })
        } else {
          videosCollection.insert(record)
        }

        newIds.add(id)
        newFileHandles.set(id, fh)
        newEventDirHandles.set(id, eventHandle as FileSystemDirectoryHandle)
        videoCache.set(id, record)

        count++
        onProgress?.(count)
      } catch (e) {
        console.error(`Failed to parse ${event}/${slug}.md`, e)
      }
    }
  }

  // Remove records that no longer exist on disk
  for (const id of currentIds) {
    if (!newIds.has(id)) {
      videosCollection.delete(id)
      videoCache.delete(id)
    }
  }

  currentIds = newIds
  // Swap in the new handle maps (keep old entries not in newIds removed)
  for (const id of fileHandles.keys()) {
    if (!newIds.has(id)) fileHandles.delete(id)
  }
  for (const [id, fh] of newFileHandles) fileHandles.set(id, fh)
  for (const id of eventDirHandles.keys()) {
    if (!newIds.has(id)) eventDirHandles.delete(id)
  }
  for (const [id, dh] of newEventDirHandles) eventDirHandles.set(id, dh)
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
