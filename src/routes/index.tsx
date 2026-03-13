import { createFileRoute, Link } from '@tanstack/react-router'
import { useLiveQuery } from '@tanstack/react-db'
import { useEffect, useRef, useState } from 'react'
import { FolderOpen, RefreshCw, AlertCircle, ChevronRight } from 'lucide-react'
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
  | { type: 'scanning' }
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
    setStatus({ type: 'scanning' })
    try {
      await scanVideos(handle)
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
  const grouped = (videos ?? []).reduce<
    Record<string, { total: number; published: number }>
  >((acc, v) => {
    acc[v.event] ??= { total: 0, published: 0 }
    acc[v.event].total++
    if (v.published === true || typeof v.published === 'string') {
      acc[v.event].published++
    }
    return acc
  }, {})

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
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
            <button
              onClick={handleRefresh}
              disabled={status.type === 'scanning'}
              className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw
                size={14}
                className={status.type === 'scanning' ? 'animate-spin' : ''}
              />
              Refresh
            </button>
          )}
          <button
            onClick={handleOpen}
            className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
          >
            <FolderOpen size={14} />
            {hasVideos ? 'Change folder' : 'Open folder'}
          </button>
        </div>
      </div>

      {status.type === 'error' && (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          {status.message}
        </div>
      )}

      {status.type === 'scanning' && (
        <p className="text-sm text-gray-500">Scanning files…</p>
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
              to="/videos/"
              className="text-sm text-blue-600 hover:underline"
            >
              All videos →
            </Link>
          </div>

          <div className="divide-y rounded-lg border">
            {Object.entries(grouped)
              .sort(([a], [b]) => b.localeCompare(a))
              .map(([event, stats]) => (
                <Link
                  key={event}
                  to="/videos/"
                  search={{ event }}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
                >
                  <div>
                    <p className="font-medium">{event}</p>
                    <p className="text-xs text-gray-400">
                      {stats.total} videos · {stats.published} published
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-gray-400" />
                </Link>
              ))}
          </div>
        </>
      )}
    </main>
  )
}
