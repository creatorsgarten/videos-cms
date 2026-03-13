import { createFileRoute, Link } from '@tanstack/react-router'
import { useLiveQuery } from '@tanstack/react-db'
import { useEffect, useRef, useState } from 'react'
import { FolderOpen, RefreshCw, AlertCircle } from 'lucide-react'
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
  const [search, setSearch] = useState('')
  const initialized = useRef(false)

  const { data: videos } = useLiveQuery((q) =>
    q.from({ v: videosCollection }).select(({ v }) => ({
      id: v.id,
      event: v.event,
      slug: v.slug,
      title: v.data.title,
      speaker: v.data.speaker,
      youtube: v.data.youtube,
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

  // Group and filter videos
  const filtered = (videos ?? []).filter((v) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      v.title.toLowerCase().includes(q) ||
      v.slug.toLowerCase().includes(q) ||
      v.event.toLowerCase().includes(q) ||
      v.speaker?.toLowerCase().includes(q)
    )
  })

  const grouped = filtered.reduce<Record<string, typeof filtered>>((acc, v) => {
    ;(acc[v.event] ??= []).push(v)
    return acc
  }, {})

  const hasVideos = (videos?.length ?? 0) > 0

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
          <input
            type="search"
            placeholder="Search by title, speaker, event…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-6 w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />

          <div className="space-y-6">
            {Object.entries(grouped)
              .sort(([a], [b]) => b.localeCompare(a))
              .map(([event, items]) => (
                <section key={event}>
                  <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                    {event} — {items.length}
                  </h2>
                  <div className="divide-y rounded-lg border">
                    {items
                      .sort((a, b) => a.slug.localeCompare(b.slug))
                      .map((v) => (
                        <Link
                          key={v.id}
                          to="/videos/$event/$slug"
                          params={{ event: v.event, slug: v.slug }}
                          className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-gray-50"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{v.title}</p>
                            {v.speaker && (
                              <p className="truncate text-xs text-gray-400">
                                {v.speaker}
                              </p>
                            )}
                          </div>
                          <PublishedBadge published={v.published} />
                        </Link>
                      ))}
                  </div>
                </section>
              ))}
          </div>
        </>
      )}
    </main>
  )
}

function PublishedBadge({
  published,
}: {
  published: boolean | string | undefined
}) {
  if (published === true || typeof published === 'string') {
    return (
      <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
        published
      </span>
    )
  }
  return (
    <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
      draft
    </span>
  )
}
