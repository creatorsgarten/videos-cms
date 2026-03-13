import yaml from 'js-yaml'
import { z } from 'zod'
import { format } from 'prettier'

// ---------------------------------------------------------------------------
// Schema (adapted from creatorsgarten/videos/src/Video.ts for browser use)
// ---------------------------------------------------------------------------

export const LocalizableText = z.union([
  z.string(),
  z.object({ en: z.string(), th: z.string() }),
])
export type LocalizableText = z.infer<typeof LocalizableText>

export const VideoFrontMatter = z.object({
  title: z.string().describe('The talk title.'),
  youtubeTitle: LocalizableText.optional().describe(
    'Customized title for YouTube.',
  ),
  speaker: z.string().optional(),
  tagline: z.string().optional(),
  team: z.object({ name: z.string() }).optional(),
  type: z.enum(['talk', 'pitch', 'archive']).default('talk'),
  youtube: z.string(),
  managed: z.boolean(),
  description: z.string().optional(),
  englishDescription: z.string().optional(),
  published: z
    .union([z.boolean(), z.string().regex(/^\d{4}-\d{2}-\d{2}(?:T[\d:.]+Z)?$/)])
    .optional(),
  language: z.enum(['en', 'th']).default('th'),
  subtitles: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  chapters: z.record(z.string(), LocalizableText).optional(),
})
export type VideoFrontMatter = z.infer<typeof VideoFrontMatter>

// ---------------------------------------------------------------------------
// Parse
// ---------------------------------------------------------------------------

export interface ParsedVideo {
  event: string
  slug: string
  data: VideoFrontMatter
  /** Markdown body after frontmatter */
  content: string
}

export interface ParseResult {
  data: VideoFrontMatter
  content: string
}

/** Parse raw .md file text into frontmatter + body. Throws on invalid YAML or schema. */
export function parseVideoFile(text: string): ParseResult {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!match) {
    throw new Error('File does not contain valid frontmatter')
  }
  const [, frontmatterStr, body] = match
  const raw = yaml.load(frontmatterStr)
  const data = VideoFrontMatter.parse(raw)
  return { data, content: body.trim() }
}

/** Serialize frontmatter + body back to .md file text. */
export function serializeVideoFile(
  data: VideoFrontMatter,
  content: string,
): string {
  const frontmatterStr = yaml.dump(data, { lineWidth: -1, quotingType: '"' })
  const body = content.trim()
  return `---\n${frontmatterStr}---\n${body ? `\n${body}\n` : ''}`
}

/** Serialize with prettier formatting for clean YAML output. */
export async function serializeVideoFileFormatted(
  data: VideoFrontMatter,
  content: string,
): Promise<string> {
  const frontmatterStr = yaml.dump(data, { lineWidth: -1, quotingType: '"' })
  const body = content.trim()
  const unformatted = `---\n${frontmatterStr}---\n${body ? `\n${body}\n` : ''}`

  try {
    return await format(unformatted, { parser: 'markdown' })
  } catch {
    // Fallback to unformatted if prettier fails
    console.warn('Prettier formatting failed, using unformatted YAML')
    return unformatted
  }
}
