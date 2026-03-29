import { describe, it, expect, vi } from 'vitest'

vi.mock('child_process', () => ({
  execFile: vi.fn(),
}))

import { execFile } from 'child_process'
import { runSkillkitJson } from '../src/skillkit'

describe('runSkillkitJson', () => {
  it('resolves with parsed JSON on success', async () => {
    const mockExecFile = vi.mocked(execFile) as unknown as ReturnType<typeof vi.fn>
    mockExecFile.mockImplementation((_bin: unknown, _args: unknown, _opts: unknown, callback: (err: null, stdout: string, stderr: string) => void) => {
      callback(null, JSON.stringify({ version: '1.0' }), '')
    })
    const result = await runSkillkitJson<{ version: string }>('/fake/bin', ['stats'])
    expect(result).toEqual({ version: '1.0' })
  })

  it('rejects when execFile errors', async () => {
    const mockExecFile = vi.mocked(execFile) as unknown as ReturnType<typeof vi.fn>
    mockExecFile.mockImplementation((_bin: unknown, _args: unknown, _opts: unknown, callback: (err: Error, stdout: string, stderr: string) => void) => {
      callback(new Error('binary not found'), '', '')
    })
    await expect(runSkillkitJson('/fake/bin', ['stats'])).rejects.toThrow('binary not found')
  })

  it('rejects on invalid JSON output', async () => {
    const mockExecFile = vi.mocked(execFile) as unknown as ReturnType<typeof vi.fn>
    mockExecFile.mockImplementation((_bin: unknown, _args: unknown, _opts: unknown, callback: (err: null, stdout: string, stderr: string) => void) => {
      callback(null, 'not json', '')
    })
    await expect(runSkillkitJson('/fake/bin', ['stats'])).rejects.toThrow()
  })
})
