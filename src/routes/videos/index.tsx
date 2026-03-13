import { createFileRoute, Link } from '@tanstack/react-router'
import { useLiveQuery } from '@tanstack/react-db'
import { useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { Input } from '#/components/ui/input'
import { ListItem } from '#/components/ui/list-item'
import { Badge } from '#/components/ui/badge'
import { videosCollection } from '../../packlets/video-store'

export const Route = createFileRoute('/videos/')({
  validateSearch: (search: Record<string, unknown>) => ({
    event: typeof search.event === 'string' ? search.event : undefined,
  }),
  component: VideoListPage,
})

function VideoListPage() {
  const { event: eventFilter } = Route.useSearch()
  const [search, setSearch] = useState('')

  const { data: videos } = useLiveQuery((q) =>
    q.from({ v: videosCollection }).select(({ v }) => ({
      id: v.id,
      event: v.event,
      slug: v.slug,
      title: v.data.title,
      speaker: v.data.speaker,
      published: v.data.published,
    })),
  )

  const filtered = (videos ?? []).filter((v) => {
    if (eventFilter && v.event !== eventFilter) return false
    if (!search) return true
    const q = search.toLowerCase()
    return (
      v.title.toLowerCase().includes(q) ||
      v.slug.toLowerCase().includes(q) ||
      v.event.toLowerCase().includes(q) ||
      v.speaker?.toLowerCase().includes(q)
    )
  })

  const grouped = filtered.reduce<Record<string, typeof filtered>>(
    (acc, v) => {
      ;(acc[v.event] ??= []).push(v)
      return acc
    },
    {},
  )

  return (
    <main className="page-wrap px-4 py-12">
      <div className="island-shell rounded-2xl p-6 sm:p-8">
        <div className="mb-6">
        <Link
          to="/"
          className="mb-3 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ChevronLeft size={14} />
          All events
        </Link>
        <h1 className="text-2xl font-bold">
          {eventFilter ?? 'All videos'}
        </h1>
        {eventFilter && (
          <Link
            to="/videos"
            search={{ event: undefined }}
            className="mt-1 text-sm text-blue-600 hover:underline"
          >
            Show all events
          </Link>
        )}
      </div>

      <Input
        type="search"
        placeholder="Search by title, speaker, event…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-6"
      />

      <div className="space-y-6">
        {Object.entries(grouped)
          .sort(([a], [b]) => b.localeCompare(a))
          .map(([event, items]) => (
            <section key={event}>
              {!eventFilter && (
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  {event} — {items.length}
                </h2>
              )}
              <div className="divide-y rounded-lg border">
                {items
                  .sort((a, b) => a.slug.localeCompare(b.slug))
                  .map((v) => (
                    <Link
                      key={v.id}
                      to="/videos/$event/$slug"
                      params={{ event: v.event, slug: v.slug }}
                    >
                      <ListItem className="gap-3 justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{v.title}</p>
                          <div className="flex flex-wrap gap-2 text-xs text-gray-400">
                            {v.speaker && <p className="truncate">{v.speaker}</p>}
                            <p className="truncate font-mono text-gray-500">{v.slug}</p>
                          </div>
                        </div>
                        <PublishedBadge published={v.published} />
                      </ListItem>
                    </Link>
                  ))}
              </div>
            </section>
          ))}
      </div>
      </div>
    </main>
  )
}

function PublishedBadge({
  published,
}: {
  published: boolean | string | undefined
}) {
  if (published === true || typeof published === 'string') {
    return <Badge variant="success">published</Badge>
  }
  return <Badge variant="muted">draft</Badge>
}
