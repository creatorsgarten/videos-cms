import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useLiveQuery } from '@tanstack/react-db'
import { useForm } from '@tanstack/react-form'
import { useRef, useState } from 'react'
import yaml from 'js-yaml'
import { z } from 'zod'
import { CheckCircle, Loader2, AlertCircle, Upload } from 'lucide-react'
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
        onClick={() => navigate({ to: '/' })}
        className="mb-6 text-sm text-blue-600 hover:underline"
      >
        ← Back
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
      publishedEnabled: video.data.published != null,
      publishedValue:
        typeof video.data.published === 'string' ? video.data.published : '',
      description: video.data.description ?? '',
      englishDescription: video.data.englishDescription ?? '',
      tagsStr: (video.data.tags ?? []).join(', '),
      subtitleEn: video.data.subtitles?.includes('en') ?? false,
      subtitleTh: video.data.subtitles?.includes('th') ?? false,
      chaptersYaml: video.data.chapters
        ? yaml.dump(video.data.chapters, { lineWidth: -1 }).trimEnd()
        : '',
      content: video.content,
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

        const published: VideoFrontMatter['published'] = value.publishedEnabled
          ? value.publishedValue.trim() || true
          : undefined

        const tags = value.tagsStr
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)

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
        if (value.tagline) newData.tagline = value.tagline
        if (showYoutubeTitle && value.youtubeTitle)
          newData.youtubeTitle = value.youtubeTitle
        if (value.description) newData.description = value.description
        if (value.englishDescription)
          newData.englishDescription = value.englishDescription
        if (published != null) newData.published = published
        if (tags.length) newData.tags = tags
        if (subtitles.length) newData.subtitles = subtitles
        if (chapters) newData.chapters = chapters

        // Preserve fields from original that aren't being edited
        const data: VideoFrontMatter = { ...video.data }
        // Override with new values
        Object.assign(data, newData)
        // Explicitly remove published if unchecked
        if (!value.publishedEnabled) {
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

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        form.handleSubmit()
      }}
      className="space-y-5"
    >
      {/* ── Core fields ── */}
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
                <input
                  className={input(f.state.meta.errors.length > 0)}
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
                <input
                  className={input(f.state.meta.errors.length > 0)}
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

        {showYoutubeTitle && (
          <form.Field
            name="youtubeTitle"
            children={(f) => (
              <LocalizableTextInput
                label="YouTube Title (optional)"
                value={f.state.value}
                onChange={f.handleChange}
              />
            )}
          />
        )}

        {!showYoutubeTitle && (
          <button
            type="button"
            onClick={() => setShowYoutubeTitle(true)}
            className="text-xs text-blue-600 hover:underline"
          >
            [+ Customize YouTube Title]
          </button>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Field label="Type">
            <form.Field
              name="type"
              children={(f) => (
                <select
                  className={input()}
                  value={f.state.value}
                  onChange={(e) => f.handleChange(e.target.value as any)}
                >
                  <option value="talk">talk</option>
                  <option value="pitch">pitch</option>
                  <option value="archive">archive</option>
                </select>
              )}
            />
          </Field>

          <Field label="Language">
            <form.Field
              name="language"
              children={(f) => (
                <select
                  className={input()}
                  value={f.state.value}
                  onChange={(e) => f.handleChange(e.target.value as any)}
                >
                  <option value="th">th</option>
                  <option value="en">en</option>
                </select>
              )}
            />
          </Field>
        </div>

        <div className="flex gap-6">
          <form.Field
            name="managed"
            children={(f) => (
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={f.state.value}
                  onChange={(e) => f.handleChange(e.target.checked)}
                  className="h-4 w-4 rounded"
                />
                Managed
              </label>
            )}
          />
        </div>
      </fieldset>

      {/* ── Speaker / tagline ── */}
      <fieldset className="space-y-4 rounded-lg border p-4">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-gray-400">
          Speaker
        </legend>
        <Field label="Speaker">
          <form.Field
            name="speaker"
            children={(f) => (
              <input
                className={input()}
                value={f.state.value}
                onChange={(e) => f.handleChange(e.target.value)}
              />
            )}
          />
        </Field>
        <Field label="Tagline">
          <form.Field
            name="tagline"
            children={(f) => (
              <input
                className={input()}
                value={f.state.value}
                onChange={(e) => f.handleChange(e.target.value)}
              />
            )}
          />
        </Field>
      </fieldset>

      {/* ── Publishing ── */}
      <fieldset className="space-y-4 rounded-lg border p-4">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-gray-400">
          Publishing
        </legend>

        <form.Field
          name="publishedEnabled"
          children={(fEnabled) => (
            <div className="space-y-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={fEnabled.state.value}
                  onChange={(e) => fEnabled.handleChange(e.target.checked)}
                  className="h-4 w-4 rounded"
                />
                Published
              </label>
              {fEnabled.state.value && (
                <form.Field
                  name="publishedValue"
                  validators={{
                    onChange: z
                      .string()
                      .refine(
                        (v) =>
                          v === '' || /^\d{4}-\d{2}-\d{2}(T[\d:.]+Z)?$/.test(v),
                        'Leave empty for "true", or enter a date: YYYY-MM-DD',
                      ),
                  }}
                  children={(f) => (
                    <>
                      <input
                        className={input(f.state.meta.errors.length > 0)}
                        value={f.state.value}
                        onChange={(e) => f.handleChange(e.target.value)}
                        onBlur={f.handleBlur}
                        placeholder="YYYY-MM-DD  (leave empty for published: true)"
                      />
                      <FieldError errors={f.state.meta.errors} />
                    </>
                  )}
                />
              )}
            </div>
          )}
        />

        <Field label="Tags (comma-separated)">
          <form.Field
            name="tagsStr"
            children={(f) => (
              <input
                className={input()}
                value={f.state.value}
                onChange={(e) => f.handleChange(e.target.value)}
                placeholder="javascript, react, typescript"
              />
            )}
          />
        </Field>

        <SubtitleUploads id={id} form={form} />
      </fieldset>

      {/* ── Description ── */}
      <fieldset className="space-y-4 rounded-lg border p-4">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-gray-400">
          Description
        </legend>
        <Field label="Description (Thai / default)">
          <form.Field
            name="description"
            children={(f) => (
              <textarea
                rows={4}
                className={input()}
                value={f.state.value}
                onChange={(e) => f.handleChange(e.target.value)}
              />
            )}
          />
        </Field>
        <Field label="English Description">
          <form.Field
            name="englishDescription"
            children={(f) => (
              <textarea
                rows={4}
                className={input()}
                value={f.state.value}
                onChange={(e) => f.handleChange(e.target.value)}
              />
            )}
          />
        </Field>
      </fieldset>

      {/* ── Chapters ── */}
      <fieldset className="space-y-2 rounded-lg border p-4">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-gray-400">
          Chapters (YAML)
        </legend>
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
          children={(f) => (
            <>
              <textarea
                rows={8}
                className={`font-mono text-xs ${input(f.state.meta.errors.length > 0)}`}
                value={f.state.value}
                onChange={(e) => f.handleChange(e.target.value)}
                onBlur={f.handleBlur}
                placeholder={'\'0:00\': Introduction\n\'5:30\': Main content'}
              />
              <FieldError errors={f.state.meta.errors} />
            </>
          )}
        />
      </fieldset>

      {/* ── Body ── */}
      <fieldset className="space-y-2 rounded-lg border p-4">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-gray-400">
          Body (Markdown)
        </legend>
        <form.Field
          name="content"
          children={(f) => (
            <textarea
              rows={6}
              className={`font-mono text-sm ${input()}`}
              value={f.state.value}
              onChange={(e) => f.handleChange(e.target.value)}
            />
          )}
        />
      </fieldset>

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
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={f.state.value}
                      onChange={(e) => f.handleChange(e.target.checked)}
                      className="h-4 w-4 rounded"
                    />
                    {lang}
                  </label>
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
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-[var(--sea-ink-soft)]">
        {label}
      </span>
      {children}
    </label>
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

function input(hasError = false) {
  return [
    'w-full rounded-md border px-3 py-1.5 text-sm outline-none',
    'focus:border-blue-500 focus:ring-1 focus:ring-blue-500',
    hasError ? 'border-red-400' : 'border-gray-300',
  ].join(' ')
}

/** LocalizableText input that can toggle between plain string and { en, th } */
function LocalizableTextInput({
  value,
  onChange,
  label,
  hasError = false,
}: {
  value: string | { en: string; th: string }
  onChange: (v: string | { en: string; th: string }) => void
  label: string
  hasError?: boolean
}) {
  const isLocalized = typeof value === 'object'

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Field label={label}>
          <div />
        </Field>
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
            <input
              className={input(hasError)}
              value={value.en}
              onChange={(e) => onChange({ ...value, en: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--sea-ink-soft)]">
              Thai
            </label>
            <input
              className={input(hasError)}
              value={value.th}
              onChange={(e) => onChange({ ...value, th: e.target.value })}
            />
          </div>
        </div>
      ) : (
        <input
          className={input(hasError)}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  )
}
