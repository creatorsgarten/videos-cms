import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '#/components/ui/dialog'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { createEvent, validateEventName } from '../packlets/video-store'

interface CreateEventModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated: (event: string) => void
}

export function CreateEventModal({
  isOpen,
  onClose,
  onCreated,
}: CreateEventModalProps) {
  const [name, setName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setName('')
      setError(null)
    }
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const validationError = validateEventName(name)
    if (validationError) {
      setError(validationError)
      return
    }

    setIsLoading(true)
    try {
      const trimmed = name.trim()
      await createEvent(trimmed)
      onCreated(trimmed)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create event')
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create event</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Event name
            </label>
            <Input
              type="text"
              placeholder="e.g. wwdc-2026"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
              autoFocus
            />
            <p className="mt-1 text-xs text-gray-500">
              Creates the folder <span className="font-mono">data/videos/{name.trim() || '<name>'}/</span>
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
              {isLoading ? 'Creating...' : 'Create event'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
