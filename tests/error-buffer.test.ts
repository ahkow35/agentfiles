import { describe, it, expect, beforeEach } from 'vitest'
import { ErrorBuffer } from '../src/error-buffer'

describe('ErrorBuffer', () => {
  let buf: ErrorBuffer

  beforeEach(() => {
    buf = new ErrorBuffer(3)
  })

  it('stores errors up to capacity', () => {
    buf.add('err1')
    buf.add('err2')
    buf.add('err3')
    expect(buf.errors).toHaveLength(3)
  })

  it('drops oldest when over capacity', () => {
    buf.add('err1')
    buf.add('err2')
    buf.add('err3')
    buf.add('err4')
    expect(buf.errors).toHaveLength(3)
    expect(buf.errors[0]).toBe('err2')
    expect(buf.errors[2]).toBe('err4')
  })

  it('flush returns all errors and clears buffer', () => {
    buf.add('err1')
    buf.add('err2')
    const flushed = buf.flush()
    expect(flushed).toEqual(['err1', 'err2'])
    expect(buf.errors).toHaveLength(0)
  })

  it('isEmpty returns true when no errors', () => {
    expect(buf.isEmpty).toBe(true)
    buf.add('err1')
    expect(buf.isEmpty).toBe(false)
  })
})
