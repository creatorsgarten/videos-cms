import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useLiveQuery } from '@tanstack/react-db'
import { videosCollection, getVideoById } from '../../packlets/video-store'

export const Route = createFileRoute('/videos/$event/$slug')({
  component: EditPage,
})

function EditPage() {
  const { event, slug } = Route.useParams()
  const navigate = useNavigate()

  const id = `${event}/${slug}`

  // useLiveQuery can be empty on the first render after SPA navigation —
  // fall back to the synchronous cache until it resolves.
  const { data: liveVideos } = useLiveQuery((q) =>
    q.from({ v: videosCollection }).select(({ v }) => v),
  )
  const video = liveVideos?.find((v) => v.id === id) ?? getVideoById(id)

  if (!video) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <p className="text-gray-500">Video not found. Did you open the folder?</p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <button
        onClick={() => navigate({ to: '/' })}
        className="mb-6 text-sm text-blue-600 hover:underline"
      >
        ← Back
      </button>
      <h1 className="mb-1 text-2xl font-bold">{video.data.title}</h1>
      <p className="mb-6 text-sm text-gray-400">
        {event} / {slug}
      </p>
      {/* Edit form coming in next sub-feature */}
      <pre className="overflow-auto rounded-lg bg-gray-50 p-4 text-xs">
        {JSON.stringify(video.data, null, 2)}
      </pre>
    </main>
  )
}
