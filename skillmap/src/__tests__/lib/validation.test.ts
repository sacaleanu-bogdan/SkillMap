import { validateStringArray, validateOptionalString } from '@/lib/validation'

// ─── validateStringArray ─────────────────────────────────────────────────────

describe('validateStringArray', () => {
  // Happy paths
  it('returns null for undefined (field is optional)', () => {
    expect(validateStringArray('tags', undefined)).toBeNull()
  })

  it('returns null for an empty array', () => {
    expect(validateStringArray('tags', [])).toBeNull()
  })

  it('returns null for a valid array within limits', () => {
    expect(validateStringArray('tags', ['TypeScript', 'React'])).toBeNull()
  })

  it('returns null for an array exactly at the default 50-item limit', () => {
    const arr = Array.from({ length: 50 }, (_, i) => `item-${i}`)
    expect(validateStringArray('tags', arr)).toBeNull()
  })

  it('returns null for strings exactly at the default 500-character limit', () => {
    const longStr = 'a'.repeat(500)
    expect(validateStringArray('tags', [longStr])).toBeNull()
  })

  // Unhappy paths
  it('returns an error when value is not an array', () => {
    const result = validateStringArray('tags', 'not-an-array')
    expect(result).toMatch(/must be an array of strings/)
  })

  it('returns an error when value is a number', () => {
    const result = validateStringArray('tags', 42)
    expect(result).toMatch(/must be an array of strings/)
  })

  it('returns an error when array has more than 50 items (default)', () => {
    const arr = Array.from({ length: 51 }, (_, i) => `item-${i}`)
    const result = validateStringArray('tags', arr)
    expect(result).toMatch(/at most 50 entries/)
  })

  it('returns an error when an array item is not a string', () => {
    const result = validateStringArray('tags', ['ok', 123])
    expect(result).toMatch(/must be a string/)
  })

  it('returns an error when a string item exceeds 500 characters', () => {
    const tooLong = 'a'.repeat(501)
    const result = validateStringArray('tags', [tooLong])
    expect(result).toMatch(/at most 500 characters/)
  })

  // Edge cases — custom limits
  it('respects a custom maxItems parameter', () => {
    const arr = ['a', 'b', 'c']
    expect(validateStringArray('tags', arr, 2)).toMatch(/at most 2 entries/)
  })

  it('accepts array within custom maxItems', () => {
    const arr = ['a', 'b']
    expect(validateStringArray('tags', arr, 2)).toBeNull()
  })

  it('respects a custom maxLen parameter', () => {
    expect(validateStringArray('tags', ['abc'], 50, 2)).toMatch(/at most 2 characters/)
  })

  it('includes the field name in the error message', () => {
    const result = validateStringArray('languages', 'bad')
    expect(result).toContain('languages')
  })
})

// ─── validateOptionalString ──────────────────────────────────────────────────

describe('validateOptionalString', () => {
  // Happy paths
  it('returns null for undefined', () => {
    expect(validateOptionalString('bio', undefined)).toBeNull()
  })

  it('returns null for an empty string', () => {
    expect(validateOptionalString('bio', '')).toBeNull()
  })

  it('returns null for a string within the default 1000-character limit', () => {
    expect(validateOptionalString('bio', 'a'.repeat(1000))).toBeNull()
  })

  // Unhappy paths
  it('returns an error when value is not a string', () => {
    const result = validateOptionalString('bio', 42)
    expect(result).toMatch(/must be a string/)
  })

  it('returns an error when value is an object', () => {
    const result = validateOptionalString('bio', {})
    expect(result).toMatch(/must be a string/)
  })

  it('returns an error when value exceeds 1000 characters (default)', () => {
    const result = validateOptionalString('bio', 'a'.repeat(1001))
    expect(result).toMatch(/at most 1000 characters/)
  })

  it('respects a custom maxLen parameter', () => {
    const result = validateOptionalString('bio', 'abcde', 4)
    expect(result).toMatch(/at most 4 characters/)
  })

  it('accepts a string exactly at custom limit', () => {
    expect(validateOptionalString('bio', 'abcd', 4)).toBeNull()
  })

  it('includes the field name in the error message', () => {
    const result = validateOptionalString('shortDescription', 123)
    expect(result).toContain('shortDescription')
  })
})
