import type { SessionDigestEvent, SessionDigestInspection } from './session-digest.ts'

const MAX_SOURCE_BYTES = 32_768
const MAX_PRIORITY_SEGMENT_BYTES = 4_096
const SOURCE_SEPARATOR = '\n\n'

function recordOf(value: unknown): Readonly<Record<string, unknown>> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>>
    : undefined
}

function textBlocks(value: unknown): string {
  if (!Array.isArray(value)) return ''
  return value
    .flatMap((block) => {
      const candidate = recordOf(block)
      return candidate?.type === 'text' && typeof candidate.text === 'string'
        ? [candidate.text.trim()]
        : []
    })
    .filter(text => text !== '')
    .join('\n')
}

function messageText(event: SessionDigestEvent): { readonly role: 'user' | 'assistant'; readonly text: string } | undefined {
  const data = recordOf(event.data)
  if (event.type === 'user/message') {
    const source = recordOf(data?.source)
    if (source?.kind !== 'user') return undefined
    const text = textBlocks(data?.content)
    return text === '' ? undefined : { role: 'user', text }
  }
  if (event.type !== 'assistant/message') return undefined
  const message = recordOf(data?.message)
  const text = textBlocks(message?.content)
  return text === '' ? undefined : { role: 'assistant', text }
}

function utf8Prefix(value: string, maxBytes: number): string {
  if (maxBytes <= 0) return ''
  if (Buffer.byteLength(value, 'utf8') <= maxBytes) return value
  const characters: string[] = []
  let bytes = 0
  for (const character of value) {
    const next = Buffer.byteLength(character, 'utf8')
    if (bytes + next > maxBytes) break
    characters.push(character)
    bytes += next
  }
  return characters.join('')
}

function prioritySegment(label: string, value: string): string {
  return `${label}: ${utf8Prefix(value, MAX_PRIORITY_SEGMENT_BYTES)}`
}

function latestCheckpoint(events: readonly SessionDigestEvent[]): string | undefined {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (event?.type !== 'compaction/summary') continue
    const summary = textBlocks(recordOf(event.data)?.summary)
    if (summary !== '') return summary
  }
  return undefined
}

/** Bounded human/assistant discussion shared by explicitly requested insights. */
export function sessionInsightSource(inspection: SessionDigestInspection): string {
  const messages = inspection.events.flatMap((event) => {
    const message = messageText(event)
    return message === undefined ? [] : [{ event, message }]
  })
  if (messages.length === 0) return ''
  const firstUser = messages.find(entry => entry.message.role === 'user')
  const checkpoint = latestCheckpoint(inspection.events)
  const priority = [prioritySegment('TITLE', inspection.title)]
  if (firstUser !== undefined) priority.push(prioritySegment('INITIAL USER', firstUser.message.text))
  if (checkpoint !== undefined) priority.push(prioritySegment('LATEST CHECKPOINT', checkpoint))

  const recent: string[] = []
  let used = Buffer.byteLength(priority.join(SOURCE_SEPARATOR), 'utf8')
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const entry = messages[index]
    if (entry === undefined || entry === firstUser) continue
    const prefix = `${entry.message.role.toUpperCase()}: `
    const separatorBytes = Buffer.byteLength(SOURCE_SEPARATOR, 'utf8')
    const available = MAX_SOURCE_BYTES - used - separatorBytes - Buffer.byteLength(prefix, 'utf8')
    if (available <= 0) break
    const text = utf8Prefix(entry.message.text, available)
    if (text === '') continue
    recent.unshift(`${prefix}${text}`)
    used += separatorBytes + Buffer.byteLength(prefix + text, 'utf8')
  }
  return [...priority, ...recent].join(SOURCE_SEPARATOR)
}
