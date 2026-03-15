import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useLiveQuery } from "@tanstack/react-db";
import { useForm } from "@tanstack/react-form";
import React, { useRef, useState } from "react";
import yaml from "js-yaml";
import { z } from "zod";
import {
  CheckCircle,
  Loader2,
  AlertCircle,
  Upload,
  Trash2,
  ExternalLink,
  Copy,
  Pencil,
  Plus,
  Sparkles,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "#/components/ui/dialog";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Textarea } from "#/components/ui/textarea";
import { Checkbox } from "#/components/ui/checkbox";
import { Label } from "#/components/ui/label";
import { DatePicker } from "#/components/ui/date-picker";
import { ReadinessChecklist } from "#/components/readiness-checklist";
import {
  videosCollection,
  getVideoById,
  saveVideo,
  saveSubtitle,
  checkThumbnailExists,
  checkSubtitleExists,
  readSubtitleContent,
  type VideoRecord,
} from "../../packlets/video-store";
import { generateChaptersPrompt } from "../../packlets/chapters-prompt";
import type { VideoFrontMatter } from "../../packlets/video-parser";

export const Route = createFileRoute("/videos/$event/$slug")({
  component: EditPage,
});

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function EditPage() {
  const { event, slug } = Route.useParams();
  const navigate = useNavigate();
  const id = `${event}/${slug}`;

  const { data: liveVideos } = useLiveQuery((q) =>
    q.from({ v: videosCollection }).select(({ v }) => v),
  );
  const video = liveVideos?.find((v) => v.id === id) ?? getVideoById(id);

  if (!video) {
    return (
      <main className="page-wrap px-4 py-12">
        <div className="island-shell rounded-2xl p-6 sm:p-8">
          <p className="text-gray-500">
            Video not found. Did you open the folder?
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="page-wrap px-4 py-12">
      <div className="island-shell rounded-2xl p-6 sm:p-8">
        <button
          onClick={() => navigate({ to: "/videos", search: { event } })}
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
  );
}

// ---------------------------------------------------------------------------
// Form
// ---------------------------------------------------------------------------

type SaveStatus = "idle" | "saving" | "saved" | "error";

// Helper to check if all checklist items are green
function areAllChecklistItemsGreen(
  title: string,
  youtube: string,
  description: string,
  chaptersYaml: string,
  subtitleEn: boolean,
  subtitleTh: boolean,
  language: "en" | "th",
  thumbnailExists: boolean,
  thumbnailCheckDone: boolean,
): boolean {
  // If thumbnail check isn't done yet, we can't say all items are green
  if (!thumbnailCheckDone) return false;

  // Check title
  if (!title.trim()) return false;

  // Check YouTube ID
  const youtubeIdRegex = /^[a-zA-Z0-9_-]{11}$/;
  if (!youtube || !youtubeIdRegex.test(youtube)) return false;

  // Check description
  if (!description.trim()) return false;

  // Check chapters
  let chapters: Record<string, unknown> = {};
  if (chaptersYaml.trim()) {
    try {
      const parsed = yaml.load(chaptersYaml);
      chapters =
        typeof parsed === "object" && !Array.isArray(parsed)
          ? (parsed as Record<string, unknown>)
          : {};
    } catch {
      return false;
    }
  }
  if (Object.keys(chapters).length === 0) return false;

  // Check subtitles based on language
  const hasRequiredSubtitles = language === "en" ? subtitleEn : subtitleTh;
  if (!hasRequiredSubtitles) return false;

  // Check thumbnail
  if (!thumbnailExists) return false;

  return true;
}

function VideoEditForm({ video, id }: { video: VideoRecord; id: string }) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState("");
  const [showYoutubeTitle, setShowYoutubeTitle] = useState(
    !!video.data.youtubeTitle,
  );
  const [showEnglishDescription, setShowEnglishDescription] = useState(
    !!video.data.englishDescription,
  );
  const [showTeam, setShowTeam] = useState(!!video.data.team);
  const [showBody, setShowBody] = useState(!!video.content.trim());
  const [showChaptersModal, setShowChaptersModal] = useState(false);
  const [showGeneratePromptModal, setShowGeneratePromptModal] = useState(false);
  const [thumbnailExists, setThumbnailExists] = useState(false);
  const [isCheckingThumbnail, setIsCheckingThumbnail] = useState(true);

  const youtubeTitle = video.data.youtubeTitle ?? "";

  const form = useForm({
    defaultValues: {
      title: video.data.title,
      speaker: video.data.speaker ?? "",
      tagline: video.data.tagline ?? "",
      youtubeTitle: youtubeTitle,
      youtube: video.data.youtube,
      type: video.data.type,
      language: video.data.language,
      managed: video.data.managed,
      publishedDate:
        typeof video.data.published === "string" ? video.data.published : "",
      description: video.data.description ?? "",
      englishDescription: video.data.englishDescription ?? "",
      subtitleEn: video.data.subtitles?.includes("en") ?? false,
      subtitleTh: video.data.subtitles?.includes("th") ?? false,
      chaptersYaml: video.data.chapters
        ? yaml.dump(video.data.chapters, { lineWidth: -1 }).trimEnd()
        : "",
      content: video.content,
      team: video.data.team?.name ?? "",
    },
    onSubmit: async ({ value }) => {
      setSaveStatus("saving");
      setSaveError("");
      try {
        let chapters: VideoFrontMatter["chapters"];
        if (value.chaptersYaml.trim()) {
          const parsed = yaml.load(value.chaptersYaml);
          if (
            typeof parsed !== "object" ||
            parsed === null ||
            Array.isArray(parsed)
          )
            throw new Error("Chapters must be a YAML mapping");
          chapters = parsed as VideoFrontMatter["chapters"];
        }

        const published: VideoFrontMatter["published"] = value.publishedDate
          ? value.publishedDate
          : false;

        const subtitles = [
          value.subtitleEn && "en",
          value.subtitleTh && "th",
        ].filter(Boolean) as string[];

        // Build new data, explicitly removing fields when not set
        const newData: any = {
          title: value.title,
          youtube: value.youtube,
          managed: value.managed,
          type: value.type,
          language: value.language,
          published,
        };

        // Add optional fields if present
        if (value.speaker) newData.speaker = value.speaker;
        if (value.type === "pitch" && value.tagline)
          newData.tagline = value.tagline;
        if (showYoutubeTitle && value.youtubeTitle)
          newData.youtubeTitle = value.youtubeTitle;
        if (value.description) newData.description = value.description;
        if (showEnglishDescription && value.englishDescription)
          newData.englishDescription = value.englishDescription;
        if (subtitles.length) newData.subtitles = subtitles;
        if (chapters) newData.chapters = chapters;
        if (showTeam && value.team) newData.team = { name: value.team };

        // Preserve fields from original that aren't being edited
        const data: VideoFrontMatter = { ...video.data };
        // Override with new values
        Object.assign(data, newData);

        await saveVideo(id, data, value.content);
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2500);
      } catch (e: any) {
        setSaveStatus("error");
        setSaveError(e?.message ?? String(e));
      }
    },
  });

  // Check if thumbnail exists (for publish date messaging)
  React.useEffect(() => {
    const checkThumbnail = async () => {
      setIsCheckingThumbnail(true);
      const exists = await checkThumbnailExists(id);
      setThumbnailExists(exists);
      setIsCheckingThumbnail(false);
    };
    checkThumbnail();
  }, [id]);

  const currentType = form.getFieldValue("type");

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
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
              validators={{ onChange: z.string().min(1, "Required") }}
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
              validators={{ onChange: z.string().min(1, "Required") }}
              children={(f) => (
                <>
                  <div className="flex gap-2">
                    <Input
                      aria-label="YouTube ID *"
                      value={f.state.value}
                      onChange={(e) => f.handleChange(e.target.value)}
                      onBlur={f.handleBlur}
                      placeholder="e.g. dQw4w9WgXcQ"
                      className="flex-1"
                    />
                    {f.state.value &&
                      /^[a-zA-Z0-9_-]{11}$/.test(f.state.value) && (
                        <a
                          href={`https://www.youtube.com/watch?v=${f.state.value}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center rounded-md border border-input bg-background px-2.5 py-1 text-sm hover:bg-accent hover:text-accent-foreground"
                          title="View on YouTube"
                        >
                          <ExternalLink size={16} />
                        </a>
                      )}
                  </div>
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
                    When enabled, this video's metadata will be synced to
                    YouTube
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
                        setShowYoutubeTitle(false);
                        f.handleChange("");
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowYoutubeTitle(true)}
          >
            <Plus size={14} className="mr-1" />
            Customize YouTube Title
          </Button>
        )}

        {/* ── 3. Pitch Info fieldset (Conditional) ── */}
        {currentType === "pitch" && (
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
                          setShowTeam(false);
                          f.handleChange("");
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
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowTeam(true)}
              >
                <Plus size={14} className="mr-1" />
                Add Team
              </Button>
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
                        setShowEnglishDescription(false);
                        f.handleChange("");
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowEnglishDescription(true)}
            >
              <Plus size={14} className="mr-1" />
              Add English Description
            </Button>
          )}
        </fieldset>

        {/* ── 5. Chapters section ── */}
        <fieldset className="space-y-4 rounded-lg border p-4">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-gray-400">
            Chapters
          </legend>

          <form.Field
            name="chaptersYaml"
            children={(f) => {
              const parsedChapters = (() => {
                if (!f.state.value.trim()) return {};
                try {
                  const parsed = yaml.load(f.state.value);
                  return (
                    typeof parsed === "object" && !Array.isArray(parsed)
                      ? parsed
                      : {}
                  ) as Record<string, any>;
                } catch {
                  return {};
                }
              })();

              return (
                <div className="space-y-3">
                  {Object.keys(parsedChapters).length > 0 && (
                    <div className="overflow-x-auto rounded border">
                      <table className="w-full text-sm">
                        <thead className="border-b bg-[var(--header-bg)]">
                          <tr>
                            <th className="px-3 py-2 text-left">Timestamp</th>
                            <th className="px-3 py-2 text-left">
                              Chapter Name
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(parsedChapters).map(
                            ([time, name], idx) => (
                              <tr key={idx} className="border-b">
                                <td className="px-3 py-2 font-mono text-xs">
                                  {time}
                                </td>
                                <td className="px-3 py-2">
                                  {typeof name === "string"
                                    ? name
                                    : typeof name === "object" && name !== null
                                      ? `${name.en || ""} / ${name.th || ""}`
                                      : String(name)}
                                </td>
                              </tr>
                            ),
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowChaptersModal(true);
                      }}
                    >
                      {Object.keys(parsedChapters).length > 0 ? (
                        <>
                          <Pencil size={14} className="mr-1" />
                          Edit Chapters
                        </>
                      ) : (
                        <>
                          <Plus size={14} className="mr-1" />
                          Add Chapters
                        </>
                      )}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowGeneratePromptModal(true);
                      }}
                    >
                      <Sparkles size={14} className="mr-1" />
                      Generate Prompt
                    </Button>
                  </div>
                </div>
              );
            }}
          />
        </fieldset>

        {/* ── 6. Subtitles section ── */}
        <fieldset className="space-y-4 rounded-lg border p-4">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-gray-400">
            Subtitles
          </legend>
          <SubtitleUploads id={id} form={form} />
        </fieldset>

        {/* ── 7. Body/Markdown section (Optional) ── */}
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
                        setShowBody(false);
                        f.handleChange("");
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowBody(true)}
          >
            <Plus size={14} className="mr-1" />
            Add Body
          </Button>
        )}

        {/* ── 8. Readiness Checklist ── */}
        <form.Subscribe
          selector={(s) => ({
            title: s.values.title,
            youtube: s.values.youtube,
            description: s.values.description,
            chaptersYaml: s.values.chaptersYaml,
            language: s.values.language,
            subtitleEn: s.values.subtitleEn,
            subtitleTh: s.values.subtitleTh,
          })}
          children={(vals) => <ReadinessChecklist videoId={id} {...vals} />}
        />

        {/* ── 9. Publish Date fieldset ── */}
        <fieldset className="space-y-4 rounded-lg border p-4">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-gray-400">
            Publish Date
          </legend>

          <form.Subscribe
            selector={(s) => ({
              title: s.values.title,
              youtube: s.values.youtube,
              description: s.values.description,
              chaptersYaml: s.values.chaptersYaml,
              language: s.values.language,
              subtitleEn: s.values.subtitleEn,
              subtitleTh: s.values.subtitleTh,
              publishedDate: s.values.publishedDate,
            })}
            children={(vals) => {
              const allChecklistGreen = areAllChecklistItemsGreen(
                vals.title,
                vals.youtube,
                vals.description,
                vals.chaptersYaml,
                vals.subtitleEn,
                vals.subtitleTh,
                vals.language,
                thumbnailExists,
                !isCheckingThumbnail,
              );

              return (
                <form.Field
                  name="publishedDate"
                  validators={{
                    onChange: z
                      .string()
                      .refine(
                        (v) =>
                          v === "" || /^\d{4}-\d{2}-\d{2}(T[\d:.]+Z)?$/.test(v),
                        "Enter a date: YYYY-MM-DD",
                      ),
                  }}
                  children={(f) => (
                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-[var(--sea-ink-soft)]">
                        Publish Date
                      </label>
                      <div className="flex gap-2">
                        <DatePicker
                          value={f.state.value.split("T")[0] || ""}
                          onChange={(date) => f.handleChange(date)}
                          placeholder="Pick a date..."
                        />
                        {f.state.value && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => f.handleChange("")}
                            title="Clear publish date"
                          >
                            <Trash2 size={16} />
                          </Button>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-[var(--sea-ink-soft)]">
                        Leave empty for draft. Today publishes immediately,
                        future dates schedule on YouTube.
                      </p>

                      {/* Publish date readiness messaging */}
                      {allChecklistGreen && !f.state.value && (
                        <p className="mt-2 text-xs text-gray-600">
                          ✓ Ready to publish. Pick a date this video should be
                          published.
                        </p>
                      )}
                      {allChecklistGreen && f.state.value && (
                        <p className="mt-2 flex items-center gap-1 text-xs text-green-600">
                          <CheckCircle size={14} /> Publish date has been set
                        </p>
                      )}
                      {!allChecklistGreen && f.state.value && (
                        <p className="mt-2 flex items-center gap-1 text-xs text-yellow-600">
                          <AlertCircle size={14} /> Video metadata is not ready
                          for publishing yet, please unset publish date
                        </p>
                      )}

                      <FieldError errors={f.state.meta.errors} />
                    </div>
                  )}
                />
              );
            }}
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
          {saveStatus === "saved" && (
            <span className="flex items-center gap-1 text-sm text-green-600">
              <CheckCircle size={14} /> Saved
            </span>
          )}
          {saveStatus === "error" && (
            <span className="flex items-center gap-1 text-sm text-red-600">
              <AlertCircle size={14} /> {saveError || "Save failed"}
            </span>
          )}
        </div>
      </form>

      {/* ── Chapters Modal ── */}
      {showChaptersModal && (
        <ChaptersModal
          initialValue={form.getFieldValue("chaptersYaml")}
          onClose={() => setShowChaptersModal(false)}
          onSave={async (yamlText) => {
            if (!yamlText.trim()) {
              form.setFieldValue("chaptersYaml", "");
              setShowChaptersModal(false);
              return { ok: true };
            }

            try {
              const parsed = yaml.load(yamlText);
              if (
                typeof parsed !== "object" ||
                parsed === null ||
                Array.isArray(parsed)
              ) {
                return {
                  ok: false,
                  reason: "Invalid YAML — must be a mapping of timecode: title",
                };
              }

              form.setFieldValue("chaptersYaml", yamlText);
              setShowChaptersModal(false);
              return { ok: true };
            } catch (e) {
              return {
                ok: false,
                reason: `YAML parsing error: ${String(e)}`,
              };
            }
          }}
        />
      )}

      {showGeneratePromptModal && (
        <GeneratePromptModal
          videoId={id}
          videoLanguage={form.getFieldValue("language")}
          onClose={() => setShowGeneratePromptModal(false)}
          onEditChapters={() => {
            setShowGeneratePromptModal(false);
            setShowChaptersModal(true);
          }}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// TypeSelect component - Boxed radio buttons
// ---------------------------------------------------------------------------

function TypeSelect({ form }: { form: any }) {
  const types = [
    { value: "talk", label: "Talk", description: "Regular event talk" },
    {
      value: "pitch",
      label: "Pitch",
      description: "Pitch presentation (shows tagline in title)",
    },
    { value: "archive", label: "Archive", description: "Archived recording" },
  ];

  return (
    <form.Field
      name="type"
      children={(f: any) => (
        <div className="space-y-2">
          <label className="text-xs font-medium text-[var(--sea-ink-soft)]">
            Type
          </label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {types.map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => f.handleChange(type.value)}
                className={`rounded-lg border-2 p-3 text-left transition ${
                  f.state.value === type.value
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                    : "border-gray-200 hover:border-gray-300 dark:border-gray-700"
                }`}
              >
                <div className="font-medium text-sm">{type.label}</div>
                <div className="text-xs text-[var(--sea-ink-soft)]">
                  {type.description}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// ChaptersModal component
// ---------------------------------------------------------------------------

function ChaptersModal({
  initialValue,
  onClose,
  onSave,
}: {
  initialValue: string;
  onClose: () => void;
  onSave: (
    yaml: string,
  ) => Promise<{ ok: true } | { ok: false; reason: string }>;
}) {
  const [chaptersYaml, setChaptersYaml] = useState(initialValue);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const validationError = (() => {
    if (!chaptersYaml.trim()) return null;
    try {
      const parsed = yaml.load(chaptersYaml);
      if (
        typeof parsed !== "object" ||
        parsed === null ||
        Array.isArray(parsed)
      ) {
        return "Invalid YAML — must be a mapping of timecode: title";
      }
      return null;
    } catch {
      return "Invalid YAML syntax";
    }
  })();

  const handleSave = async () => {
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSaving(true);
    try {
      const result = await onSave(chaptersYaml);
      if (result.ok) {
        onClose();
      } else {
        setError(result.reason);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Chapters</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="mb-2 block text-xs font-medium text-[var(--sea-ink-soft)]">
              YAML Format
            </label>
            <Textarea
              rows={10}
              className="font-mono text-xs max-h-80"
              value={chaptersYaml}
              onChange={(e) => {
                setChaptersYaml(e.target.value);
                setError("");
              }}
              onPaste={(e) => {
                const text = e.clipboardData.getData("text");
                const match = text.match(/<chapters>([\s\S]*?)<\/chapters>/);
                if (match) {
                  e.preventDefault();
                  setChaptersYaml(match[1].trim());
                  setError("");
                }
              }}
              placeholder={
                "'0:00': Introduction\n'5:30': Main content\n'10:45': Discussion"
              }
            />
            <p className="mt-1 text-xs text-[var(--sea-ink-soft)]">
              Format: &apos;timestamp&apos;: Chapter Name (localized: name with{" "}
              {`{en: ..., th: ...}`})
            </p>
          </div>

          {validationError && (
            <p className="text-xs text-red-500">{validationError}</p>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !!validationError}>
            {isSaving ? (
              <>
                <Loader2 size={14} className="mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// GeneratePromptModal component
// ---------------------------------------------------------------------------

function GeneratePromptModal({
  videoId,
  videoLanguage,
  onClose,
  onEditChapters,
}: {
  videoId: string;
  videoLanguage: "en" | "th";
  onClose: () => void;
  onEditChapters: () => void;
}) {
  const [status, setStatus] = useState<"checking" | "error" | "ready">(
    "checking",
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [prompt, setPrompt] = useState("");
  const [copied, setCopied] = useState(false);

  React.useEffect(() => {
    const checkAndGenerate = async () => {
      try {
        const exists = await checkSubtitleExists(videoId, videoLanguage);
        if (!exists) {
          setStatus("error");
          setErrorMessage(
            `No ${videoLanguage.toUpperCase()} subtitle file found. Please upload a subtitle file first.`,
          );
          return;
        }

        const vttContent = await readSubtitleContent(videoId, videoLanguage);
        const generatedPrompt = generateChaptersPrompt(
          vttContent,
          videoLanguage,
        );
        setPrompt(generatedPrompt);
        setStatus("ready");
      } catch (e) {
        setStatus("error");
        setErrorMessage(`Failed to generate prompt: ${String(e)}`);
      }
    };

    checkAndGenerate();
  }, [videoId, videoLanguage]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenRouter = () => {
    window.open(
      "https://openrouter.ai/chat?models=google/gemini-3.1-pro-preview",
      "_blank",
    );
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Generate Chapters Prompt</DialogTitle>
        </DialogHeader>

        {status === "checking" && (
          <div className="flex items-center gap-2 py-8 justify-center">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-sm text-gray-500">
              Checking subtitle file...
            </span>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle size={16} />
              <span className="text-sm">{errorMessage}</span>
            </div>
            <p className="text-xs text-gray-500">
              Go to the Subtitles section to upload a subtitle file first.
            </p>
          </div>
        )}

        {status === "ready" && (
          <div className="space-y-3">
            <div>
              <label className="mb-2 block text-xs font-medium text-[var(--sea-ink-soft)]">
                Generated Prompt
              </label>
              <Textarea
                rows={12}
                className="font-mono text-xs max-h-80"
                value={prompt}
                readOnly
              />
              <p className="mt-1 text-xs text-[var(--sea-ink-soft)]">
                Copy this prompt and use it with an AI model to generate
                chapters.
              </p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleCopy}>
                <Copy size={14} className="mr-1" />
                {copied ? "Copied!" : "Copy"}
              </Button>
              <Button variant="outline" size="sm" onClick={handleOpenRouter}>
                <ExternalLink size={14} className="mr-1" />
                Open Router
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {status === "ready" && (
            <Button onClick={onEditChapters}>
              <Pencil size={14} className="mr-1" />
              Edit Chapters
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Subtitle upload
// ---------------------------------------------------------------------------

function SubtitleUploads({
  id,
  form,
}: {
  id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: any;
}) {
  const enRef = useRef<HTMLInputElement>(null);
  const thRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<
    Record<string, "uploading" | "done" | "error">
  >({});

  async function handleUpload(lang: "en" | "th", file: File) {
    setStatus((s) => ({ ...s, [lang]: "uploading" }));
    try {
      await saveSubtitle(id, lang, file);
      // Auto-check the corresponding subtitle checkbox
      form.setFieldValue(lang === "en" ? "subtitleEn" : "subtitleTh", true);
      setStatus((s) => ({ ...s, [lang]: "done" }));
    } catch (e) {
      console.error(e);
      setStatus((s) => ({ ...s, [lang]: "error" }));
    }
  }

  return (
    <div>
      <p className="mb-2 text-xs font-medium text-gray-600">Subtitles</p>
      <div className="space-y-2">
        {(["en", "th"] as const).map((lang) => {
          const fieldName = lang === "en" ? "subtitleEn" : "subtitleTh";
          const ref = lang === "en" ? enRef : thRef;
          const st = status[lang];
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
                disabled={st === "uploading"}
                className="flex items-center gap-1.5 rounded border px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
              >
                <Upload size={12} />
                Upload .vtt
              </button>
              {st === "done" && (
                <span className="flex items-center gap-1 text-xs text-green-600">
                  <CheckCircle size={12} /> uploaded
                </span>
              )}
              {st === "uploading" && (
                <Loader2 size={12} className="animate-spin text-gray-400" />
              )}
              {st === "error" && (
                <span className="text-xs text-red-500">failed</span>
              )}
              <input
                ref={ref}
                type="file"
                accept=".vtt"
                className="hidden"
                data-testid={`subtitle-upload-${lang}`}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUpload(lang, file);
                  e.target.value = "";
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs block">{label}</label>
      {children}
    </div>
  );
}

function FieldError({ errors }: { errors: any[] }) {
  if (!errors.length) return null;
  return (
    <p className="mt-1 text-xs text-red-500">
      {errors.map((e) => e?.message ?? String(e)).join(", ")}
    </p>
  );
}

/** LocalizableText input that can toggle between plain string and { en, th } */
function LocalizableTextInput({
  value,
  onChange,
  label,
}: {
  value: string | { en: string; th: string };
  onChange: (v: string | { en: string; th: string }) => void;
  label: string;
}) {
  const isLocalized = typeof value === "object";

  return (
    <div className="space-y-2">
      {label && (
        <Field label={label}>
          <div />
        </Field>
      )}
      <div className="flex items-center justify-between">
        <div />
        <button
          type="button"
          onClick={() => {
            if (isLocalized) {
              onChange(value.en || "");
            } else {
              onChange({ en: value, th: value });
            }
          }}
          className="text-xs text-blue-600 hover:underline"
        >
          {isLocalized ? "Use plain text" : "Make localized"}
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
        <Input value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}
