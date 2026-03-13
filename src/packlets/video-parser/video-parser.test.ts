import { describe, it, expect } from 'vitest'
import { parseVideoFile, serializeVideoFile, serializeVideoFileFormatted } from './index'

const MINIMAL_MD = `---
title: "Test Talk"
youtube: "abc123"
managed: true
---

Some description here.
`

const FULL_MD = `---
title: "Full Talk"
speaker: "Jane Doe"
youtube: "xyz789"
managed: false
type: talk
language: en
published: "2024-06-01"
tags:
  - javascript
  - react
chapters:
  "0:00": "Intro"
  "5:30": "Main content"
---

Talk body.
`

describe('parseVideoFile', () => {
  it('parses minimal frontmatter', () => {
    const { data, content } = parseVideoFile(MINIMAL_MD)
    expect(data.title).toBe('Test Talk')
    expect(data.youtube).toBe('abc123')
    expect(data.managed).toBe(true)
    expect(content).toBe('Some description here.')
  })

  it('parses full frontmatter', () => {
    const { data } = parseVideoFile(FULL_MD)
    expect(data.speaker).toBe('Jane Doe')
    expect(data.language).toBe('en')
    expect(data.published).toBe('2024-06-01')
    expect(data.tags).toEqual(['javascript', 'react'])
    expect(data.chapters).toEqual({
      '0:00': 'Intro',
      '5:30': 'Main content',
    })
  })

  it('applies schema defaults', () => {
    const { data } = parseVideoFile(MINIMAL_MD)
    expect(data.type).toBe('talk')
    expect(data.language).toBe('th')
  })

  it('throws on missing frontmatter', () => {
    expect(() => parseVideoFile('just plain text')).toThrow()
  })

  it('throws on missing required field', () => {
    const bad = `---\ntitle: "No YouTube"\nmanaged: true\n---\n`
    expect(() => parseVideoFile(bad)).toThrow()
  })
})

describe('serializeVideoFile', () => {
  it('round-trips minimal file', () => {
    const { data, content } = parseVideoFile(MINIMAL_MD)
    const serialized = serializeVideoFile(data, content)
    const reparsed = parseVideoFile(serialized)
    expect(reparsed.data.title).toBe(data.title)
    expect(reparsed.data.youtube).toBe(data.youtube)
    expect(reparsed.content).toBe(content)
  })

  it('round-trips full file', () => {
    const { data, content } = parseVideoFile(FULL_MD)
    const serialized = serializeVideoFile(data, content)
    const reparsed = parseVideoFile(serialized)
    expect(reparsed.data).toEqual(data)
    expect(reparsed.content).toBe(content)
  })

  it('wraps in --- delimiters', () => {
    const { data, content } = parseVideoFile(MINIMAL_MD)
    const out = serializeVideoFile(data, content)
    expect(out).toMatch(/^---\n/)
    expect(out).toContain('\n---\n')
  })
})

describe('serializeVideoFileFormatted', () => {
  it('formats YAML with single quotes', async () => {
    const { data, content } = parseVideoFile(FULL_MD)
    const formatted = await serializeVideoFileFormatted(data, content)

    // Should use single quotes for values that need quoting (like dates)
    expect(formatted).toContain("'2024-06-01'")

    // Should not have double quotes in the YAML section
    const [frontmatter] = formatted.split('---').slice(1)
    expect(frontmatter).not.toMatch(/:\s+"[^"]+"\s*$/)
  })

  it('preserves body content', async () => {
    const { data, content } = parseVideoFile(FULL_MD)
    const formatted = await serializeVideoFileFormatted(data, content)
    expect(formatted).toContain('Talk body.')
  })
})
