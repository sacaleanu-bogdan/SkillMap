// Shared input validation utilities (VULN-010: prevent authenticated DoS via unbounded arrays)

const MAX_ARRAY_ITEMS = 50
const MAX_STRING_LENGTH = 500
const MAX_DESCRIPTION_LENGTH = 1000
const MAX_NAME_LENGTH = 200

/**
 * Validates that a value is either undefined or a bounded string array.
 * Returns an error message string if invalid, or null if valid.
 */
export function validateStringArray(
  field: string,
  value: unknown,
  maxItems = MAX_ARRAY_ITEMS,
  maxLen = MAX_STRING_LENGTH
): string | null {
  if (value === undefined) return null
  if (!Array.isArray(value)) return `${field} must be an array of strings`
  if (value.length > maxItems) return `${field} must have at most ${maxItems} entries`
  for (const item of value) {
    if (typeof item !== 'string') return `Each entry in ${field} must be a string`
    if (item.length > maxLen) return `Each entry in ${field} must be at most ${maxLen} characters`
  }
  return null
}

/**
 * Validates that a value is either undefined or a bounded string.
 * Returns an error message string if invalid, or null if valid.
 */
export function validateOptionalString(
  field: string,
  value: unknown,
  maxLen = MAX_DESCRIPTION_LENGTH
): string | null {
  if (value === undefined) return null
  if (typeof value !== 'string') return `${field} must be a string`
  if (value.length > maxLen) return `${field} must be at most ${maxLen} characters`
  return null
}

export { MAX_NAME_LENGTH, MAX_DESCRIPTION_LENGTH }
