import { useEffect, useState } from 'react'
import { CheckCircle2, AlertTriangle } from 'lucide-react'
import yaml from 'js-yaml'
import { checkThumbnailExists } from '../packlets/video-store'

export interface ReadinessChecklistProps {
  videoId: string
  title: string
  youtube: string
  description: string
  chaptersYaml: string
  language: 'en' | 'th'
  subtitleEn: boolean
  subtitleTh: boolean
}

type ChecklistStatus = 'green' | 'yellow'

interface ChecklistItem {
  status: ChecklistStatus
  message: string
}

export function ReadinessChecklist({
  videoId,
  title,
  youtube,
  description,
  chaptersYaml,
  language,
  subtitleEn,
  subtitleTh,
}: ReadinessChecklistProps) {
  const [thumbnailExists, setThumbnailExists] = useState(false)
  const [isCheckingThumbnail, setIsCheckingThumbnail] = useState(true)

  useEffect(() => {
    const checkThumbnail = async () => {
      setIsCheckingThumbnail(true)
      const exists = await checkThumbnailExists(videoId)
      setThumbnailExists(exists)
      setIsCheckingThumbnail(false)
    }
    checkThumbnail()
  }, [videoId])

  const parseChapters = (): Record<string, unknown> => {
    if (!chaptersYaml.trim()) return {}
    try {
      const parsed = yaml.load(chaptersYaml)
      return typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {}
    } catch {
      return {}
    }
  }

  const items: ChecklistItem[] = []

  // Check title
  if (title.trim()) {
    items.push({
      status: 'green',
      message: 'Video has a title',
    })
  } else {
    items.push({
      status: 'yellow',
      message: 'Missing title: Please add a title to the video',
    })
  }

  // Check YouTube ID (valid format is 11 alphanumeric chars with underscore/dash)
  const youtubeIdRegex = /^[a-zA-Z0-9_-]{11}$/
  if (youtube && youtubeIdRegex.test(youtube)) {
    items.push({
      status: 'green',
      message: 'Valid YouTube ID',
    })
  } else {
    items.push({
      status: 'yellow',
      message: 'Missing or invalid YouTube ID',
    })
  }

  // Check description
  if (description.trim()) {
    items.push({
      status: 'green',
      message: 'Description present',
    })
  } else {
    items.push({
      status: 'yellow',
      message: 'No description: Add a description',
    })
  }

  // Check chapters
  const parsedChapters = parseChapters()
  if (Object.keys(parsedChapters).length > 0) {
    items.push({
      status: 'green',
      message: 'Chapters present',
    })
  } else {
    items.push({
      status: 'yellow',
      message: 'No chapters for this language',
    })
  }

  // Check subtitles based on language
  const subCheckLang = language === 'en' ? 'English' : 'Thai'
  const hasSubtitles = language === 'en' ? subtitleEn : subtitleTh
  if (hasSubtitles) {
    items.push({
      status: 'green',
      message: `Subtitles present (${subCheckLang})`,
    })
  } else {
    items.push({
      status: 'yellow',
      message: `No ${subCheckLang} subtitles uploaded`,
    })
  }

  // Check thumbnail
  if (!isCheckingThumbnail) {
    if (thumbnailExists) {
      items.push({
        status: 'green',
        message: 'Thumbnail present',
      })
    } else {
      items.push({
        status: 'yellow',
        message: 'No thumbnail — upload one from the video list page',
      })
    }
  }

  return (
    <fieldset className="space-y-4 rounded-lg border p-4">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-gray-400">
        Readiness Checklist
      </legend>

      <ul className="space-y-2">
        {items.map((item, idx) => (
          <li
            key={idx}
            className="flex items-start gap-3 text-sm"
          >
            {item.status === 'green' ? (
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-green-600" />
            ) : (
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-yellow-500" />
            )}
            <span
              className={
                item.status === 'green'
                  ? 'text-green-700'
                  : 'text-yellow-700'
              }
            >
              {item.message}
            </span>
          </li>
        ))}
      </ul>
    </fieldset>
  )
}
