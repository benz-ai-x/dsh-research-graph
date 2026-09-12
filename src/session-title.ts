export const SESSION_TITLE_MAX_LENGTH = 80

/** A suggestion is read-only until the user applies it through native rename. */
export interface SessionTitleRequest { readonly sessionId: string }
export type SessionTitleResult =
  | { readonly kind: 'empty' }
  | { readonly kind: 'ready'; readonly sessionId: string; readonly title: string; readonly sourceTitle: string; readonly sourceRevision: string }

function recordOf(value: unknown, keys: readonly string[]): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).some(key => !keys.includes(key))) {
    throw new TypeError('Invalid Session title object')
  }
  return value as Readonly<Record<string, unknown>>
}

function stringOf(value: unknown): string {
  if (typeof value !== 'string') throw new TypeError('Session title field must be a string')
  return value
}

function sessionIdOf(value: unknown): string {
  const id = stringOf(value)
  if (id.length === 0 || id.length > 1000) throw new TypeError('Invalid Session title target')
  return id
}

function parseOutput(value: unknown): { readonly title: string } {
  const title = stringOf(recordOf(value, ['title']).title).trim()
  if (title.length === 0 || [...title].length > SESSION_TITLE_MAX_LENGTH
    || /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/u.test(title)) {
    throw new TypeError('Title must be one short visible line')
  }
  return { title }
}

/** Dependency-free codecs are shared by the Host and the lazy browser bundle. */
export const sessionTitleRequestSchema = {
  parse(value: unknown): SessionTitleRequest {
    return { sessionId: sessionIdOf(recordOf(value, ['sessionId']).sessionId) }
  },
}
export const sessionTitleOutputSchema = {
  parse: parseOutput,
  safeParse(value: unknown): { readonly success: true; readonly data: { readonly title: string } } | { readonly success: false } {
    try { return { success: true, data: parseOutput(value) } } catch { return { success: false } }
  },
}
export const sessionTitleResultSchema = {
  parse(value: unknown): SessionTitleResult {
    const result = recordOf(value, ['kind', 'sessionId', 'title', 'sourceTitle', 'sourceRevision'])
    if (result.kind === 'empty') {
      recordOf(value, ['kind'])
      return { kind: 'empty' }
    }
    if (result.kind !== 'ready') throw new TypeError('Invalid Session title result kind')
    return {
      kind: 'ready', sessionId: sessionIdOf(result.sessionId), title: parseOutput({ title: result.title }).title,
      sourceTitle: stringOf(result.sourceTitle), sourceRevision: stringOf(result.sourceRevision),
    }
  },
}
