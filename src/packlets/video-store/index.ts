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

// ---------------------------------------------------------------------------
// Scan
// ---------------------------------------------------------------------------

/** Traverse data/videos/<event>/<slug>.md and load all videos into the collection. */
export async function scanVideos(
  rootHandle: FileSystemDirectoryHandle,
): Promise<void> {
  // Clear existing records
  for (const item of videosCollection.state.items.values()) {
    videosCollection.delete(item.id)
  }

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
        videosCollection.insert({
          id,
          event,
          slug,
          data,
          content,
          fileHandle: fileHandle as FileSystemFileHandle,
        })
      } catch (e) {
        console.error(`Failed to parse ${event}/${slug}.md`, e)
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Save (write-through)
// ---------------------------------------------------------------------------

export async function saveVideo(
  id: string,
  data: VideoFrontMatter,
  content: string,
): Promise<void> {
  const record = videosCollection.state.items.get(id)
  if (!record) throw new Error(`Video not found: ${id}`)

  const text = serializeVideoFile(data, content)
  await writeFile(record.fileHandle, text)

  videosCollection.update(id, (draft) => {
    draft.data = data
    draft.content = content
  })
}
