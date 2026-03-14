import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useLiveQuery } from '@tanstack/react-db'
import { useForm } from '@tanstack/react-form'
import React, { useRef, useState } from 'react'
import yaml from 'js-yaml'
import { z } from 'zod'
import { CheckCircle, Loader2, AlertCircle, Upload, Trash2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '#/components/ui/dialog'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Textarea } from '#/components/ui/textarea'
import { Checkbox } from '#/components/ui/checkbox'
import { Label } from '#/components/ui/label'
import { DatePicker } from '#/components/ui/date-picker'
import {
  videosCollection,
  getVideoById,
  saveVideo,
  saveSubtitle,
  type VideoRecord,
} from '../../packlets/video-store'
import type { VideoFrontMatter } from '../../packlets/video-parser'

export const Route = createFileRoute('/videos/$event/$slug')({
  component: EditPage,
})

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function EditPage() {
  const { event, slug } = Route.useParams()
  const navigate = useNavigate()
  const id = `${event}/${slug}`

  const { data: liveVideos } = useLiveQuery((q) =>
    q.from({ v: videosCollection }).select(({ v }) => v),
  )
  const video = liveVideos?.find((v) => v.id === id) ?? getVideoById(id)

  if (!video) {
    return (
      <main className="page-wrap px-4 py-12">
        <div className="island-shell rounded-2xl p-6 sm:p-8">
          <p className="text-gray-500">Video not found. Did you open the folder?</p>
        </div>
      </main>
    )
  }

  return (
    <main className="page-wrap px-4 py-12">
      <div className="island-shell rounded-2xl p-6 sm:p-8">
        <button
        onClick={() => navigate({ to: '/videos', search: { event } })}
        className="mb-6 text-sm text-blue-600 hover:underline"
      >
        ← Back to {event}
      </button>
      <h1 className="mb-1 text-2xl font-bold">{video.data.title}</h1>
      <p className="mb-4 font-mono text-xs text-gray-400">
        {event}/{slug}
      </p>
        <VideoEditForm video={video} id={id} />
      </div>
    </main>
  )
}

// ---------------------------------------------------------------------------
// Form
// ---------------------------------------------------------------------------

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

function VideoEditForm({ video, id }: { video: VideoRecord; id: string }) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [saveError, setSaveError] = useState('')
  const [showYoutubeTitle, setShowYoutubeTitle] = useState(
    !!video.data.youtubeTitle,
  )
  const [showEnglishDescription, setShowEnglishDescription] = useState(
    !!video.data.englishDescription,
  )
  const [showTeam, setShowTeam] = useState(!!video.data.team)
  const [showBody, setShowBody] = useState(!!video.content.trim())
  const [showChaptersModal, setShowChaptersModal] = useState(false)
  const [chaptersError, setChaptersError] = useState('')

  const youtubeTitle = video.data.youtubeTitle ?? ''

  const form = useForm({
    defaultValues: {
      title: video.data.title,
      speaker: video.data.speaker ?? '',
      tagline: video.data.tagline ?? '',
      youtubeTitle: youtubeTitle,
      youtube: video.data.youtube,
      type: video.data.type,
      language: video.data.language,
      managed: video.data.managed,
      publishedDate:
        typeof video.data.published === 'string' ? video.data.published : '',
      description: video.data.description ?? '',
      englishDescription: video.data.englishDescription ?? '',
      subtitleEn: video.data.subtitles?.includes('en') ?? false,
      subtitleTh: video.data.subtitles?.includes('th') ?? false,
      chaptersYaml: video.data.chapters
        ? yaml.dump(video.data.chapters, { lineWidth: -1 }).trimEnd()
        : '',
      content: video.content,
      team: video.data.team?.name ?? '',
    },
    onSubmit: async ({ value }) => {
      setSaveStatus('saving')
      setSaveError('')
      try {
        let chapters: VideoFrontMatter['chapters']
        if (value.chaptersYaml.trim()) {
          const parsed = yaml.load(value.chaptersYaml)
          if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
            throw new Error('Chapters must be a YAML mapping')
          chapters = parsed as VideoFrontMatter['chapters']
        }

        const published: VideoFrontMatter['published'] = value.publishedDate
          ? value.publishedDate
          : undefined

        const subtitles = [
          value.subtitleEn && 'en',
          value.subtitleTh && 'th',
        ].filter(Boolean) as string[]

        // Build new data, explicitly removing fields when not set
        const newData: any = {
          title: value.title,
          youtube: value.youtube,
          managed: value.managed,
          type: value.type,
          language: value.language,
        }

        // Add optional fields if present
        if (value.speaker) newData.speaker = value.speaker
        if (value.type === 'pitch' && value.tagline) newData.tagline = value.tagline
        if (showYoutubeTitle && value.youtubeTitle)
          newData.youtubeTitle = value.youtubeTitle
        if (value.description) newData.description = value.description
        if (showEnglishDescription && value.englishDescription)
          newData.englishDescription = value.englishDescription
        if (published) newData.published = published
        if (subtitles.length) newData.subtitles = subtitles
        if (chapters) newData.chapters = chapters
        if (showTeam && value.team) newData.team = { name: value.team }

        // Preserve fields from original that aren't being edited
        const data: VideoFrontMatter = { ...video.data }
        // Override with new values
        Object.assign(data, newData)
        // Explicitly remove published if not set
        if (!published) {
          delete data.published
        }

        await saveVideo(id, data, value.content)
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 2500)
      } catch (e: any) {
        setSaveStatus('error')
        setSaveError(e?.message ?? String(e))
      }
    },
  })

  const currentType = form.getFieldValue('type')

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          form.handleSubmit()
        }}
        className="space-y-5"
      >
        {/* ── 1. Core fieldset ── */}
        <fieldset className="space-y-4 rounded-lg border p-4">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-gray-400">
            Core
          </legend>

          <Field label="Title *">
            <form.Field
              name="title"
              validators={{ onChange: z.string().min(1, 'Required') }}
              children={(f) => (
                <>
                  <Input
                    aria-label="Title *"
                    value={f.state.value}
                    onChange={(e) => f.handleChange(e.target.value)}
                    onBlur={f.handleBlur}
                  />
                  <FieldError errors={f.state.meta.errors} />
                </>
              )}
            />
          </Field>

          <Field label="YouTube ID *">
            <form.Field
              name="youtube"
              validators={{ onChange: z.string().min(1, 'Required') }}
              children={(f) => (
                <>
                  <Input
                    aria-label="YouTube ID *"
                    value={f.state.value}
                    onChange={(e) => f.handleChange(e.target.value)}
                    onBlur={f.handleBlur}
                    placeholder="e.g. dQw4w9WgXcQ"
                  />
                  <FieldError errors={f.state.meta.errors} />
                </>
              )}
            />
          </Field>

          <TypeSelect form={form} />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Language">
              <form.Field
                name="language"
                children={(f) => (
                  <select
                    aria-label="Language"
                    className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    value={f.state.value}
                    onChange={(e) => f.handleChange(e.target.value as any)}
                  >
                    <option value="th">Thai</option>
                    <option value="en">English</option>
                  </select>
                )}
              />
            </Field>

            <form.Field
              name="managed"
              children={(f) => (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={f.state.value}
                      onCheckedChange={f.handleChange}
                      aria-label="Managed"
                    />
                    <Label className="text-sm">Managed</Label>
                  </div>
                  <p className="text-xs text-[var(--sea-ink-soft)]">
                    When enabled, this video's metadata will be synced to YouTube
                  </p>
                </div>
              )}
            />
          </div>
        </fieldset>

        {/* ── 2. YouTube Title section (Optional) ── */}
        {showYoutubeTitle && (
          <fieldset className="space-y-4 rounded-lg border p-4">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-gray-400">
              YouTube Title
            </legend>
            <form.Field
              name="youtubeTitle"
              children={(f) => (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-[var(--sea-ink-soft)]">
                      Customize Title
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setShowYoutubeTitle(false)
                        f.handleChange('')
                      }}
                      className="rounded p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                      title="Remove YouTube Title"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <LocalizableTextInput
                    label=""
                    value={f.state.value}
                    onChange={f.handleChange}
                  />
                </div>
              )}
            />
          </fieldset>
        )}

        {!showYoutubeTitle && (
          <div className="rounded-lg border border-dashed p-4">
            <button
              type="button"
              onClick={() => setShowYoutubeTitle(true)}
              className="text-xs text-blue-600 hover:underline"
            >
              [+ Customize YouTube Title]
            </button>
          </div>
        )}

        {/* ── 3. Pitch Info fieldset (Conditional) ── */}
        {currentType === 'pitch' && (
          <fieldset className="space-y-4 rounded-lg border p-4">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-gray-400">
              Pitch Info
            </legend>

            <Field label="Tagline">
              <form.Field
                name="tagline"
                children={(f) => (
                  <>
                    <Input
                      value={f.state.value}
                      onChange={(e) => f.handleChange(e.target.value)}
                      placeholder="Used in pitch titles"
                    />
                    <p className="mt-1 text-xs text-[var(--sea-ink-soft)]">
                      Shown in the YouTube title for pitch videos
                    </p>
                  </>
                )}
              />
            </Field>

            {showTeam && (
              <form.Field
                name="team"
                children={(f) => (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-[var(--sea-ink-soft)]">
                        Team
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setShowTeam(false)
                          f.handleChange('')
                        }}
                        className="rounded p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                        title="Remove Team"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <Input
                      value={f.state.value}
                      onChange={(e) => f.handleChange(e.target.value)}
                      placeholder="Team name"
                    />
                  </div>
                )}
              />
            )}

            {!showTeam && (
              <button
                type="button"
                onClick={() => setShowTeam(true)}
                className="text-xs text-blue-600 hover:underline"
              >
                [+ Add Team]
              </button>
            )}
          </fieldset>
        )}

        {/* ── 4. Speaker & Description fieldset ── */}
        <fieldset className="space-y-4 rounded-lg border p-4">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-gray-400">
            Speaker & Description
          </legend>

          <Field label="Speaker">
            <form.Field
              name="speaker"
              children={(f) => (
                <>
                  <Input
                    value={f.state.value}
                    onChange={(e) => f.handleChange(e.target.value)}
                    placeholder="John Doe; Jane Smith"
                  />
                  <p className="mt-1 text-xs text-[var(--sea-ink-soft)]">
                    Separate multiple speakers with semicolon
                  </p>
                </>
              )}
            />
          </Field>

          <Field label="Description">
            <form.Field
              name="description"
              children={(f) => (
                <Textarea
                  rows={4}
                  value={f.state.value}
                  onChange={(e) => f.handleChange(e.target.value)}
                />
              )}
            />
          </Field>

          {showEnglishDescription && (
            <form.Field
              name="englishDescription"
              children={(f) => (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-[var(--sea-ink-soft)]">
                      English Description
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setShowEnglishDescription(false)
                        f.handleChange('')
                      }}
                      className="rounded p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                      title="Remove English Description"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <Textarea
                    rows={4}
                    value={f.state.value}
                    onChange={(e) => f.handleChange(e.target.value)}
                  />
                </div>
              )}
            />
          )}

          {!showEnglishDescription && (
            <button
              type="button"
              onClick={() => setShowEnglishDescription(true)}
              className="text-xs text-blue-600 hover:underline"
            >
              [+ Add English Description]
            </button>
          )}
        </fieldset>

        {/* ── 5. Publish Date fieldset ── */}
        <fieldset className="space-y-4 rounded-lg border p-4">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-gray-400">
            Publish Date
          </legend>

          <form.Field
            name="publishedDate"
            validators={{
              onChange: z
                .string()
                .refine(
                  (v) => v === '' || /^\d{4}-\d{2}-\d{2}(T[\d:.]+Z)?$/.test(v),
                  'Enter a date: YYYY-MM-DD',
                ),
            }}
            children={(f) => (
              <div className="space-y-2">
                <label className="block text-xs font-medium text-[var(--sea-ink-soft)]">
                  Publish Date
                </label>
                <div className="flex gap-2">
                  <DatePicker
                    value={f.state.value.split('T')[0] || ''}
                    onChange={(date) => f.handleChange(date)}
                    placeholder="Pick a date..."
                  />
                  {f.state.value && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => f.handleChange('')}
                      title="Clear publish date"
                    >
                      <Trash2 size={16} />
                    </Button>
                  )}
                </div>
                <p className="mt-1 text-xs text-[var(--sea-ink-soft)]">
                  Leave empty for draft. Today publishes immediately, future dates schedule on YouTube.
                </p>
                <FieldError errors={f.state.meta.errors} />
              </div>
            )}
          />
        </fieldset>

        {/* ── 6. Chapters section ── */}
        <fieldset className="space-y-4 rounded-lg border p-4">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-gray-400">
            Chapters
          </legend>

          <form.Field
            name="chaptersYaml"
            children={(f) => {
              const parsedChapters = (() => {
                if (!f.state.value.trim()) return {}
                try {
                  const parsed = yaml.load(f.state.value)
                  return (typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}) as Record<string, any>
                } catch {
                  return {}
                }
              })()

              return (
                <div className="space-y-3">
                  {Object.keys(parsedChapters).length > 0 && (
                    <div className="overflow-x-auto rounded border">
                      <table className="w-full text-sm">
                        <thead className="border-b bg-[var(--header-bg)]">
                          <tr>
                            <th className="px-3 py-2 text-left">Timestamp</th>
                            <th className="px-3 py-2 text-left">Chapter Name</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(parsedChapters).map(([time, name], idx) => (
                            <tr key={idx} className="border-b">
                              <td className="px-3 py-2 font-mono text-xs">{time}</td>
                              <td className="px-3 py-2">
                                {typeof name === 'string'
                                  ? name
                                  : typeof name === 'object' && name !== null
                                    ? `${name.en || ''} / ${name.th || ''}`
                                    : String(name)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowChaptersModal(true)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    {Object.keys(parsedChapters).length > 0 ? '[Edit Chapters]' : '[+ Add Chapters]'}
                  </button>
                </div>
              )
            }}
          />
        </fieldset>

        {/* ── 7. Subtitles section ── */}
        <fieldset className="space-y-4 rounded-lg border p-4">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-gray-400">
            Subtitles
          </legend>
          <SubtitleUploads id={id} form={form} />
        </fieldset>

        {/* ── 8. Body/Markdown section (Optional) ── */}
        {showBody && (
          <fieldset className="space-y-4 rounded-lg border p-4">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-gray-400">
              Body (Markdown)
            </legend>
            <form.Field
              name="content"
              children={(f) => (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-[var(--sea-ink-soft)]">
                      Content
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setShowBody(false)
                        f.handleChange('')
                      }}
                      className="rounded p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                      title="Remove Body"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <Textarea
                    rows={6}
                    className="font-mono text-sm"
                    value={f.state.value}
                    onChange={(e) => f.handleChange(e.target.value)}
                  />
                </div>
              )}
            />
          </fieldset>
        )}

        {!showBody && (
          <div className="rounded-lg border border-dashed p-4">
            <button
              type="button"
              onClick={() => setShowBody(true)}
              className="text-xs text-blue-600 hover:underline"
            >
              [+ Add Body]
            </button>
          </div>
        )}

        {/* ── Submit ── */}
        <div className="flex items-center gap-3">
          <form.Subscribe
            selector={(s) => s.isSubmitting}
            children={(isSubmitting) => (
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isSubmitting && <Loader2 size={14} className="animate-spin" />}
                Save
              </button>
            )}
          />
          {saveStatus === 'saved' && (
            <span className="flex items-center gap-1 text-sm text-green-600">
              <CheckCircle size={14} /> Saved
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="flex items-center gap-1 text-sm text-red-600">
              <AlertCircle size={14} /> {saveError || 'Save failed'}
            </span>
          )}
        </div>
      </form>

      {/* ── Chapters Modal ── */}
      {showChaptersModal && (
        <ChaptersModal
          form={form}
          onClose={() => {
            setShowChaptersModal(false)
            setChaptersError('')
          }}
          onSave={() => {
            setShowChaptersModal(false)
            setChaptersError('')
          }}
          error={chaptersError}
          setError={setChaptersError}
        />
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// TypeSelect component - Boxed radio buttons
// ---------------------------------------------------------------------------

function TypeSelect({ form }: { form: any }) {
  const types = [
    { value: 'talk', label: 'Talk', description: 'Regular event talk' },
    { value: 'pitch', label: 'Pitch', description: 'Pitch presentation (shows tagline in title)' },
    { value: 'archive', label: 'Archive', description: 'Archived recording' },
  ]

  return (
    <form.Field
      name="type"
      children={(f: any) => (
        <div className="space-y-2">
          <label className="text-xs font-medium text-[var(--sea-ink-soft)]">Type</label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {types.map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => f.handleChange(type.value)}
                className={`rounded-lg border-2 p-3 text-left transition ${
                  f.state.value === type.value
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 hover:border-gray-300 dark:border-gray-700'
                }`}
              >
                <div className="font-medium text-sm">{type.label}</div>
                <div className="text-xs text-[var(--sea-ink-soft)]">{type.description}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    />
  )
}

// ---------------------------------------------------------------------------
// ChaptersModal component
// ---------------------------------------------------------------------------

function ChaptersModal({
  form,
  onClose,
  onSave,
  error,
  setError,
}: {
  form: any
  onClose: () => void
  onSave: () => void
  error: string
  setError: (err: string) => void
}) {
  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Chapters</DialogTitle>
        </DialogHeader>

        <form.Field
          name="chaptersYaml"
          validators={{
            onChange: z.string().refine((v) => {
              if (!v.trim()) return true
              try {
                const parsed = yaml.load(v)
                return (
                  typeof parsed === 'object' &&
                  parsed !== null &&
                  !Array.isArray(parsed)
                )
              } catch {
                return false
              }
            }, 'Invalid YAML — must be a mapping of timecode: title'),
          }}
          children={(f: any) => (
            <div className="space-y-3">
              <div>
                <label className="mb-2 block text-xs font-medium text-[var(--sea-ink-soft)]">
                  YAML Format
                </label>
                <Textarea
                  rows={10}
                  className="font-mono text-xs"
                  value={f.state.value}
                  onChange={(e) => {
                    f.handleChange(e.target.value)
                    setError('')
                  }}
                  onBlur={f.handleBlur}
                  placeholder={'\'0:00\': Introduction\n\'5:30\': Main content\n\'10:45\': Discussion'}
                />
                <p className="mt-1 text-xs text-[var(--sea-ink-soft)]">
                  Format: &apos;timestamp&apos;: Chapter Name (localized: name with {`{en: ..., th: ...}`})
                </p>
              </div>

              {error && (
                <p className="text-xs text-red-500">{error}</p>
              )}

              {f.state.meta.errors.length > 0 && (
                <FieldError errors={f.state.meta.errors} />
              )}
            </div>
          )}
        />

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <form.Field
            name="chaptersYaml"
            children={(f: any) => (
              <Button
                onClick={() => {
                  if (f.state.meta.errors.length > 0) {
                    setError('Fix validation errors before saving')
                    return
                  }
                  onSave()
                }}
              >
                Save
              </Button>
            )}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Subtitle upload
// ---------------------------------------------------------------------------

function SubtitleUploads({
  id,
  form,
}: {
  id: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: any
}) {
  const enRef = useRef<HTMLInputElement>(null)
  const thRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<Record<string, 'uploading' | 'done' | 'error'>>({})

  async function handleUpload(lang: 'en' | 'th', file: File) {
    setStatus((s) => ({ ...s, [lang]: 'uploading' }))
    try {
      await saveSubtitle(id, lang, file)
      // Auto-check the corresponding subtitle checkbox
      form.setFieldValue(lang === 'en' ? 'subtitleEn' : 'subtitleTh', true)
      setStatus((s) => ({ ...s, [lang]: 'done' }))
    } catch (e) {
      console.error(e)
      setStatus((s) => ({ ...s, [lang]: 'error' }))
    }
  }

  return (
    <div>
      <p className="mb-2 text-xs font-medium text-gray-600">Subtitles</p>
      <div className="space-y-2">
        {(['en', 'th'] as const).map((lang) => {
          const fieldName = lang === 'en' ? 'subtitleEn' : 'subtitleTh'
          const ref = lang === 'en' ? enRef : thRef
          const st = status[lang]
          return (
            <div key={lang} className="flex items-center gap-3">
              <form.Field
                name={fieldName}
                children={(f: any) => (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={f.state.value}
                      onCheckedChange={f.handleChange}
                      aria-label={lang}
                    />
                    <Label className="text-sm">{lang}</Label>
                  </div>
                )}
              />
              <button
                type="button"
                onClick={() => ref.current?.click()}
                disabled={st === 'uploading'}
                className="flex items-center gap-1.5 rounded border px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
              >
                <Upload size={12} />
                Upload .vtt
              </button>
              {st === 'done' && (
                <span className="flex items-center gap-1 text-xs text-green-600">
                  <CheckCircle size={12} /> uploaded
                </span>
              )}
              {st === 'uploading' && (
                <Loader2 size={12} className="animate-spin text-gray-400" />
              )}
              {st === 'error' && (
                <span className="text-xs text-red-500">failed</span>
              )}
              <input
                ref={ref}
                type="file"
                accept=".vtt"
                className="hidden"
                data-testid={`subtitle-upload-${lang}`}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleUpload(lang, file)
                  e.target.value = ''
                }}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs block">{label}</label>
      {children}
    </div>
  )
}

function FieldError({ errors }: { errors: any[] }) {
  if (!errors.length) return null
  return (
    <p className="mt-1 text-xs text-red-500">
      {errors.map((e) => e?.message ?? String(e)).join(', ')}
    </p>
  )
}


/** LocalizableText input that can toggle between plain string and { en, th } */
function LocalizableTextInput({
  value,
  onChange,
  label,
}: {
  value: string | { en: string; th: string }
  onChange: (v: string | { en: string; th: string }) => void
  label: string
}) {
  const isLocalized = typeof value === 'object'

  return (
    <div className="space-y-2">
      {label && <Field label={label}><div /></Field>}
      <div className="flex items-center justify-between">
        <div />
        <button
          type="button"
          onClick={() => {
            if (isLocalized) {
              onChange(value.en || '')
            } else {
              onChange({ en: value, th: value })
            }
          }}
          className="text-xs text-blue-600 hover:underline"
        >
          {isLocalized ? 'Use plain text' : 'Make localized'}
        </button>
      </div>
      {isLocalized ? (
        <div className="space-y-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--sea-ink-soft)]">
              English
            </label>
            <Input
              value={value.en}
              onChange={(e) => onChange({ ...value, en: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--sea-ink-soft)]">
              Thai
            </label>
            <Input
              value={value.th}
              onChange={(e) => onChange({ ...value, th: e.target.value })}
            />
          </div>
        </div>
      ) : (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  )
}
