interface WirePrimitives {
  readonly invalid: () => never
  readonly object: (value: unknown, keys: readonly string[]) => Record<string, unknown>
  readonly text: (value: unknown, max?: number) => string
  readonly identity: (value: unknown) => string
  readonly uuid: (value: unknown) => string
  readonly count: (value: unknown) => number
  readonly array: (value: unknown) => unknown[]
}

/** Shared wire validation without Host dependencies; each domain keeps its limits and errors. */
export function createWirePrimitives(message: string, textLimit: number): WirePrimitives {
  function invalid(): never { throw new TypeError(message) }
  function object(value: unknown, keys: readonly string[]): Record<string, unknown> {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return invalid()
    if (Object.keys(value).some(key => !keys.includes(key))) return invalid()
    return value as Record<string, unknown>
  }
  function text(value: unknown, max = textLimit): string {
    if (typeof value !== 'string' || value.includes('\0') || value.length > max) return invalid()
    return value
  }
  function identity(value: unknown): string {
    const id = text(value, 200)
    return id.trim() === '' ? invalid() : id
  }
  function uuid(value: unknown): string {
    const id = identity(value)
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(id) ? id : invalid()
  }
  function count(value: unknown): number {
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : invalid()
  }
  function array(value: unknown): unknown[] { return Array.isArray(value) ? value : invalid() }
  return { invalid, object, text, identity, uuid, count, array }
}
