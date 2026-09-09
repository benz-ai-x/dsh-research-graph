import type {
  ResearchTopic, ResearchTopicArrangement, ResearchTopicReference, ResearchTopicSnapshot, ResearchTopicSource, ResearchTopicWrite,
} from './research-topic.ts'

function invalid(): never { throw new TypeError('Invalid Research Topic data') }

function object(value: unknown, keys?: readonly string[]): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return invalid()
  if (keys !== undefined && Object.keys(value).some(key => !keys.includes(key))) return invalid()
  return value as Record<string, unknown>
}

function string(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '' || value.includes('\0')) return invalid()
  return value
}

function topicId(value: unknown): string {
  const id = string(value)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(id)) return invalid()
  return id
}

function title(value: unknown): string {
  const label = string(value).trim()
  if (label.length > 120) return invalid()
  return label
}

function array(value: unknown): unknown[] { return Array.isArray(value) ? value : invalid() }
function finite(value: unknown): number { return typeof value === 'number' && Number.isFinite(value) ? value : invalid() }

function arrangement(value: unknown): ResearchTopicArrangement {
  const item = object(value, ['positions', 'collapsed', 'offsets'])
  return {
    positions: Object.fromEntries(Object.entries(object(item.positions)).map(([key, value]) => {
      const point = object(value, ['x', 'y'])
      return [key, { x: finite(point.x), y: finite(point.y) }]
    })),
    collapsed: array(item.collapsed).map(string),
    offsets: Object.fromEntries(Object.entries(object(item.offsets)).map(([key, value]) => {
      const point = object(value, ['dx', 'dy'])
      return [key, { dx: finite(point.dx), dy: finite(point.dy) }]
    })),
  }
}

const REFERENCE_KEYS = ['sessionId', 'title', 'cwd', 'workspace']

function referenceFields(item: Record<string, unknown>): ResearchTopicReference {
  const workspace = item.workspace === undefined ? undefined : object(item.workspace, ['id', 'title'])
  return {
    sessionId: string(item.sessionId), title: string(item.title),
    ...(item.cwd === undefined ? {} : { cwd: string(item.cwd) }),
    ...(workspace === undefined ? {} : { workspace: { id: string(workspace.id), title: string(workspace.title) } }),
  }
}

export const researchTopicSchema = { parse(value: unknown): ResearchTopic {
  const item = object(value, ['topicId', 'title', 'references', 'arrangement'])
  const references = array(item.references).map(value => referenceFields(object(value, REFERENCE_KEYS)))
  if (new Set(references.map(reference => reference.sessionId)).size !== references.length) return invalid()
  return { topicId: topicId(item.topicId), title: title(item.title), references, arrangement: arrangement(item.arrangement) }
} }

export const researchTopicReadSchema = { parse(value: unknown): { readonly topicId: string } {
  return { topicId: topicId(object(value, ['topicId']).topicId) }
} }

export const researchTopicWriteSchema = { parse(value: unknown): ResearchTopicWrite {
  const item = object(value)
  const id = topicId(item.topicId)
  if (item.kind === 'create' || item.kind === 'rename') {
    object(item, ['kind', 'topicId', 'title'])
    return { kind: item.kind, topicId: id, title: title(item.title) }
  }
  if (item.kind === 'add') {
    object(item, ['kind', 'topicId', 'sessionIds'])
    const sessionIds = array(item.sessionIds).map(string)
    if (sessionIds.length === 0) return invalid()
    return { kind: item.kind, topicId: id, sessionIds }
  }
  if (item.kind === 'remove') {
    object(item, ['kind', 'topicId', 'sessionId'])
    return { kind: item.kind, topicId: id, sessionId: string(item.sessionId) }
  }
  if (item.kind === 'arrange') {
    object(item, ['kind', 'topicId', 'arrangement'])
    return { kind: item.kind, topicId: id, arrangement: arrangement(item.arrangement) }
  }
  return invalid()
} }

export const researchTopicListSchema = { parse(value: unknown): readonly ResearchTopic[] {
  return array(value).map(researchTopicSchema.parse)
} }

export const researchTopicSnapshotSchema = { parse(value: unknown): ResearchTopicSnapshot {
  const item = object(value, ['topic', 'sources'])
  const sources = array(item.sources).map((value): ResearchTopicSource => {
    const source = object(value, [...REFERENCE_KEYS, 'status', 'archived', 'parentSessionId'])
    if ((source.status !== 'listed' && source.status !== 'unavailable') || typeof source.archived !== 'boolean') return invalid()
    return {
      ...referenceFields(source), status: source.status, archived: source.archived,
      ...(source.parentSessionId === undefined ? {} : { parentSessionId: string(source.parentSessionId) }),
    }
  })
  return { topic: researchTopicSchema.parse(item.topic), sources }
} }
