import { useEffect, useRef, useState } from 'react'
import { Camera, Upload } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '#/components/ui/dialog'
import { Button } from '#/components/ui/button'
import { saveThumbnail } from '../packlets/video-store'

interface ThumbnailUploadModalProps {
  videoId: string
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
}

export function ThumbnailUploadModal({
  videoId,
  isOpen,
  onClose,
  onSaved,
}: ThumbnailUploadModalProps) {
  const [preview, setPreview] = useState<string | null>(null)
  const [selectedBlob, setSelectedBlob] = useState<Blob | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dragOverRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isOpen) {
      setPreview(null)
      setSelectedBlob(null)
      setError(null)
    }
  }, [isOpen])

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!isOpen) return

      const items = e.clipboardData?.items
      if (!items) return

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault()
          const file = item.getAsFile()
          if (file) {
            processImage(file)
          }
          break
        }
      }
    }

    if (isOpen) {
      document.addEventListener('paste', handlePaste)
      return () => document.removeEventListener('paste', handlePaste)
    }
  }, [isOpen])

  const processImage = async (file: File) => {
    setError(null)
    setIsLoading(true)

    try {
      const img = new Image()
      const url = URL.createObjectURL(file)

      img.onload = () => {
        URL.revokeObjectURL(url)
        const canvas = document.createElement('canvas')
        canvas.width = 1280
        canvas.height = 720

        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('Failed to get canvas context')

        ctx.drawImage(img, 0, 0, 1280, 720)

        canvas.toBlob(
          (blob) => {
            if (!blob) throw new Error('Failed to create blob from canvas')
            setSelectedBlob(blob)
            setPreview(canvas.toDataURL('image/jpeg', 0.85))
            setIsLoading(false)
          },
          'image/jpeg',
          0.85,
        )
      }

      img.onerror = () => {
        URL.revokeObjectURL(url)
        setError('Failed to load image')
        setIsLoading(false)
      }

      img.src = url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process image')
      setIsLoading(false)
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0]
    if (file) {
      processImage(file)
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    dragOverRef.current = true
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    dragOverRef.current = false
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    dragOverRef.current = false

    const files = e.dataTransfer.files
    if (files.length > 0) {
      const file = files[0]
      if (file.type.startsWith('image/')) {
        processImage(file as File)
      } else {
        setError('Please drop an image file')
      }
    }
  }

  const handleSave = async () => {
    if (!selectedBlob) return

    setIsLoading(true)
    setError(null)

    try {
      await saveThumbnail(videoId, selectedBlob)
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save thumbnail')
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Update Thumbnail</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {preview ? (
            <div className="space-y-3">
              <div className="rounded border border-gray-200 bg-gray-50 p-2">
                <img
                  src={preview}
                  alt="Preview"
                  className="w-full rounded object-cover"
                  style={{ aspectRatio: '1280 / 720' }}
                />
              </div>
              <div className="text-sm text-gray-600">
                Resized to 1280×720 (JPEG 85% quality)
              </div>
            </div>
          ) : (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="cursor-pointer rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-8 text-center transition hover:border-gray-400 hover:bg-gray-100"
            >
              <Upload className="mx-auto mb-2 h-8 w-8 text-gray-400" />
              <p className="text-sm font-medium text-gray-700">
                Drag and drop an image here
              </p>
              <p className="mt-1 text-xs text-gray-500">
                or click to select, or paste from clipboard
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileInput}
                className="hidden"
              />
            </div>
          )}

          {error && (
            <div className="rounded bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!selectedBlob || isLoading}
              className="flex-1"
            >
              <Camera className="mr-2 h-4 w-4" />
              Save Thumbnail
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
