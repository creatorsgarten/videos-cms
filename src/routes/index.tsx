import { createFileRoute, Link } from '@tanstack/react-router'
import { useLiveQuery } from '@tanstack/react-db'
import { useEffect, useRef, useState } from 'react'
import { FolderOpen, RefreshCw, AlertCircle, ChevronRight } from 'lucide-react'
import { Button } from '#/components/ui/button'
import {
  openDirectory,
  loadPersistedDirectory,
  ensurePermission,
} from '../packlets/fs'
import { scanVideos, videosCollection } from '../packlets/video-store'

export const Route = createFileRoute('/')({ component: HomePage })

type Status =
  | { type: 'idle' }
  | { type: 'requesting-permission' }
  | { type: 'scanning'; count: number }
  | { type: 'ready' }
  | { type: 'error'; message: string }

function HomePage() {
  const [dirName, setDirName] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>({ type: 'idle' })
  const initialized = useRef(false)

  const { data: videos } = useLiveQuery((q) =>
    q.from({ v: videosCollection }).select(({ v }) => ({
      id: v.id,
      event: v.event,
      published: v.data.published,
      publishedDate: typeof v.data.published === 'string' ? v.data.published : undefined,
    })),
  )

  async function loadDirectory(handle: FileSystemDirectoryHandle) {
    setStatus({ type: 'requesting-permission' })
    const granted = await ensurePermission(handle)
    if (!granted) {
      setStatus({ type: 'error', message: 'Permission denied.' })
      return
    }
    setDirName(handle.name)
    setStatus({ type: 'scanning', count: 0 })
    try {
      await scanVideos(handle, (count) => setStatus({ type: 'scanning', count }))
      setStatus({ type: 'ready' })
    } catch (e) {
      setStatus({ type: 'error', message: String(e) })
    }
  }

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    loadPersistedDirectory().then((handle) => {
      if (handle) loadDirectory(handle)
    })
  }, [])

  async function handleOpen() {
    try {
      const handle = await openDirectory()
      await loadDirectory(handle)
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        setStatus({ type: 'error', message: String(e) })
      }
    }
  }

  async function handleRefresh() {
    const handle = await loadPersistedDirectory()
    if (handle) await loadDirectory(handle)
  }

  const hasVideos = (videos?.length ?? 0) > 0

  // Group by event for the event index
  type EventStats = { total: number; draft: number; lastPublishedDate: string | null }
  const grouped = (videos ?? []).reduce<Record<string, EventStats>>((acc, v) => {
    if (!acc[v.event]) {
      acc[v.event] = { total: 0, draft: 0, lastPublishedDate: null }
    }
    const eventStats = acc[v.event]!
    eventStats.total++
    // Count drafts (unpublished videos - those without published date/value)
    if (!v.published) {
      eventStats.draft++
    }
    // Track the latest published date
    if (v.publishedDate) {
      const current = eventStats.lastPublishedDate
      if (!current || v.publishedDate > current) {
        eventStats.lastPublishedDate = v.publishedDate as string
      }
    }
    return acc
  }, {} as Record<string, EventStats>)

  return (
    <main className="page-wrap px-4 py-12">
      <div className="island-shell rounded-2xl p-6 sm:p-8">
        <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Videos CMS</h1>
          {dirName && (
            <p className="mt-1 text-sm text-gray-500">
              Folder: <span className="font-mono">{dirName}</span>
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {hasVideos && (
            <Button
              onClick={handleRefresh}
              disabled={status.type === 'scanning'}
              variant="outline"
              size="sm"
            >
              <RefreshCw
                size={14}
                className={status.type === 'scanning' ? 'animate-spin' : ''}
              />
              {status.type === 'scanning' ? `${status.count} files…` : 'Refresh'}
            </Button>
          )}
          <Button
            onClick={handleOpen}
            size="sm"
          >
            <FolderOpen size={14} />
            {hasVideos ? 'Change folder' : 'Open folder'}
          </Button>
        </div>
      </div>

      {status.type === 'error' && (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          {status.message}
        </div>
      )}

      {!hasVideos && status.type !== 'scanning' && (
        <div className="rounded-lg border-2 border-dashed p-16 text-center text-gray-400">
          <FolderOpen size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">
            Open the <span className="font-mono">videos</span> repository folder
            to get started.
          </p>
        </div>
      )}

      {hasVideos && (
        <>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {videos!.length} videos across{' '}
              {Object.keys(grouped).length} events
            </p>
            <Link
              to="/videos"
              search={{ event: undefined }}
              className="text-sm text-blue-600 hover:underline"
            >
              All videos →
            </Link>
          </div>

          <div className="divide-y rounded-lg border">
            {Object.entries(grouped)
              .sort(([eventA, statsA], [eventB, statsB]) => {
                // Archive goes to the bottom
                const aIsArchive = eventA === 'archive'
                const bIsArchive = eventB === 'archive'
                if (aIsArchive !== bIsArchive) {
                  return aIsArchive ? 1 : -1
                }
                // First: events with drafts come first
                const aHasDrafts = statsA.draft > 0
                const bHasDrafts = statsB.draft > 0
                if (aHasDrafts !== bHasDrafts) {
                  return aHasDrafts ? -1 : 1
                }
                // Second: sort by last published date (newest first)
                const aDate = statsA.lastPublishedDate ?? ''
                const bDate = statsB.lastPublishedDate ?? ''
                return bDate.localeCompare(aDate)
              })
              .map(([event, stats]) => (
                <Link
                  key={event}
                  to="/videos"
                  search={{ event }}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
                >
                  <div>
                    <p className="font-medium">{event}</p>
                    <p className="text-xs text-gray-400">
                      {stats.total} videos, {stats.draft} draft
                      {stats.lastPublishedDate && (
                        <>
                          {' '}
                          · last publish: {stats.lastPublishedDate}
                        </>
                      )}
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-gray-400" />
                </Link>
              ))}
          </div>
        </>
      )}
      </div>
    </main>
  )
}
