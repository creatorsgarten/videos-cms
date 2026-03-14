import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '#/components/ui/dialog'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { createVideo, getVideoById } from '../packlets/video-store'

interface AddVideoModalProps {
  isOpen: boolean
  event: string
  onClose: () => void
  onCreated: (event: string, slug: string) => void
}

export function AddVideoModal({
  isOpen,
  event,
  onClose,
  onCreated,
}: AddVideoModalProps) {
  const [slug, setSlug] = useState('')
  const [youtubeInput, setYoutubeInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setSlug('')
      setYoutubeInput('')
      setError(null)
    }
  }, [isOpen])

  const extractYoutubeId = (input: string): string => {
    // Raw ID (11 chars)
    if (/^[a-zA-Z0-9_-]{11}$/.test(input)) {
      return input
    }

    // Extract from URL
    const match = input.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/)
    if (match?.[1]) {
      return match[1]
    }

    return ''
  }

  const validateSlug = (s: string): boolean => {
    return /^[a-z0-9-]+$/.test(s)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!slug.trim()) {
      setError('Please enter a slug')
      return
    }

    if (!validateSlug(slug)) {
      setError('Slug must contain only lowercase letters, numbers, and hyphens')
      return
    }

    const youtubeId = extractYoutubeId(youtubeInput)
    if (!youtubeId) {
      setError('Please enter a valid YouTube ID or URL')
      return
    }

    // Check uniqueness
    const videoId = `${event}/${slug}`
    if (getVideoById(videoId)) {
      setError(`Video already exists: ${videoId}`)
      return
    }

    setIsLoading(true)

    try {
      await createVideo(event, slug, youtubeId)
      onCreated(event, slug)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create video')
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Video to {event}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Slug
            </label>
            <Input
              type="text"
              placeholder="e.g. my-talk-title"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
              disabled={isLoading}
            />
            <p className="mt-1 text-xs text-gray-500">
              Lowercase letters, numbers, and hyphens only
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              YouTube ID or URL
            </label>
            <Input
              type="text"
              placeholder="e.g. dQw4w9WgXcQ or https://youtube.com/watch?v=dQw4w9WgXcQ"
              value={youtubeInput}
              onChange={(e) => setYoutubeInput(e.target.value)}
              disabled={isLoading}
            />
            <p className="mt-1 text-xs text-gray-500">
              Paste a YouTube URL or just the video ID
            </p>
          </div>

          {error && (
            <div className="rounded bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="flex-1">
              {isLoading ? 'Creating...' : 'Create Video'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
