import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useLiveQuery } from '@tanstack/react-db'
import { videosCollection } from '../../packlets/video-store'

export const Route = createFileRoute('/videos/$event/$slug')({
  component: EditPage,
})

function EditPage() {
  const { event, slug } = Route.useParams()
  const navigate = useNavigate()

  const { data: results } = useLiveQuery((q) =>
    q
      .from({ v: videosCollection })
      .where(({ v }) => v.id === `${event}/${slug}`)
      .select(({ v }) => v),
  )

  const video = results?.[0]

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
