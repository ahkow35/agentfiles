import { describe, it, expect } from 'vitest'
import * as os from 'os'
import * as path from 'path'

// Import only pure exported functions — does NOT import anything that touches obsidian at runtime
// (obsidian is aliased to tests/mocks/obsidian.ts in vitest.config.ts)
import { parseFrontmatter, extractName, isSafePath } from '../src/scanner'

describe('parseFrontmatter', () => {
  it('extracts name and description from valid frontmatter', () => {
    const content = `---\nname: my-skill\ndescription: Does stuff\n---\nBody`
    const result = parseFrontmatter(content)
    expect(result.frontmatter.name).toBe('my-skill')
    expect(result.frontmatter.description).toBe('Does stuff')
  })

  it('returns empty frontmatter for missing frontmatter', () => {
    const result = parseFrontmatter('Just body text with no frontmatter')
    expect(result.frontmatter).toEqual({})
  })

  it('returns empty frontmatter for malformed frontmatter', () => {
    const result = parseFrontmatter('---\n:::invalid yaml:::\n---')
    expect(result.frontmatter).toEqual({})
  })

  it('returns raw string as content when no frontmatter present', () => {
    const body = 'Just body text with no frontmatter'
    const result = parseFrontmatter(body)
    expect(result.content).toBe(body)
  })
})

describe('extractName', () => {
  it('returns frontmatter name if present', () => {
    expect(extractName({ name: 'my-skill' }, '', '/path/to/my-skill.md', 'flat-md')).toBe('my-skill')
  })

  it('falls back to filename stem for flat-md pattern', () => {
    expect(extractName({}, '', '/path/to/review-pr.md', 'flat-md')).toBe('review-pr')
  })

  it('falls back to filename stem for mdc pattern', () => {
    expect(extractName({}, '', '/path/to/commit.mdc', 'mdc')).toBe('commit')
  })

  it('uses H1 heading for directory-with-skillmd pattern when no frontmatter name', () => {
    expect(extractName({}, '# My Great Skill\nsome body', '/path/to/some-skill.md', 'directory-with-skillmd')).toBe('My Great Skill')
  })

  it('uses parent dir name for SKILL.md filename', () => {
    expect(extractName({}, '', '/path/to/my-tool/SKILL.md', 'directory-with-skillmd')).toBe('my-tool')
  })
})

describe('isSafePath', () => {
  const home = os.homedir()

  it('allows paths within home directory', () => {
    expect(isSafePath(path.join(home, '.claude'))).toBe(true)
  })

  it('blocks paths outside home directory', () => {
    expect(isSafePath('/etc/passwd')).toBe(false)
    expect(isSafePath('/private/var/db')).toBe(false)
  })

  it('blocks path traversal attempts', () => {
    expect(isSafePath(path.join(home, '../../etc'))).toBe(false)
  })
})
