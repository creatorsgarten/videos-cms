import { useEffect, useRef, useState } from 'react'
import { Camera } from 'lucide-react'

interface VideoThumbnailProps {
  event: string
  slug: string
  getEventDirHandle: (id: string) => FileSystemDirectoryHandle | undefined
  alt: string
  onUpdateClick?: () => void
}

export function VideoThumbnail({
  event,
  slug,
  getEventDirHandle,
  alt,
  onUpdateClick,
}: VideoThumbnailProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            loadThumbnail()
            observer.unobserve(entry.target)
          }
        }
      },
      { rootMargin: '50px' },
    )

    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  const loadThumbnail = async () => {
    setIsLoading(true)
    try {
      const id = `${event}/${slug}`
      const eventDirHandle = getEventDirHandle(id)

      if (!eventDirHandle) {
        setIsLoading(false)
        return
      }

      // Try to load thumbnail with the slug as filename
      const thumbnailHandle = await eventDirHandle.getFileHandle(
        `${slug}.jpg`,
      )
      const file = await thumbnailHandle.getFile()
      const blob = new Blob([await file.arrayBuffer()], { type: 'image/jpeg' })
      const url = URL.createObjectURL(blob)
      setImageSrc(url)
    } catch {
      // Thumbnail not found, silently fail
    } finally {
      setIsLoading(false)
    }
  }

  if (onUpdateClick) {
    return (
      <button
        onClick={(e) => {
          e.preventDefault()
          onUpdateClick()
        }}
        className="group relative bg-gray-100 rounded overflow-hidden shrink-0 hover:opacity-90"
        style={{ width: '128px', height: '72px' }}
      >
        <div
          ref={containerRef}
          className="w-full h-full"
        >
          {imageSrc ? (
            <img
              src={imageSrc}
              alt={alt}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-400 text-[10px]">
              {isLoading ? '...' : '—'}
            </div>
          )}
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex flex-col items-center gap-1">
            <Camera size={16} className="text-white" />
            <span className="text-white text-[10px] font-medium">Update</span>
          </div>
        </div>
      </button>
    )
  }

  return (
    <div
      ref={containerRef}
      className="bg-gray-100 rounded overflow-hidden shrink-0"
      style={{ width: '128px', height: '72px' }}
    >
      {imageSrc ? (
        <img
          src={imageSrc}
          alt={alt}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-400 text-[10px]">
          {isLoading ? '...' : '—'}
        </div>
      )}
    </div>
  )
}
