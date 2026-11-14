import { describe, expect, it } from 'vitest'
import { inferForkParent } from '../src/branch-links.ts'
import { readBranchOriginMap } from '../src/client/branch-links-remote.ts'
import {
  branchOriginListSchema, branchOriginQuerySchema, branchOriginRecordSchema, branchOriginSchema,
} from '../src/branch-links-codec.ts'

/** One copied DeepSeek delivery watermark that names its Session generation. */
function delivery(sessionId: string): Record<string, unknown> {
  return { type: 'session-log-deepseek/delivery-accepted', data: { sessionId, sessionFormatVersion: 4, throughSeq: 1 } }
}

function other(): Record<string, unknown> {
  return { type: 'turn/start', data: { turn: 1 } }
}

describe('inferForkParent', () => {
  it('takes the last foreign delivery Session inside the inherited prefix', () => {
    const events = [other(), delivery('parent'), other(), delivery('parent'), other()]
    expect(inferForkParent(events, 5, 'child')).toBe('parent')
  })

  it('prefers the direct parent over an earlier grandparent marker', () => {
    const events = [delivery('grandparent'), other(), delivery('parent')]
    expect(inferForkParent(events, 3, 'child')).toBe('parent')
  })

  it('does not promote an ancestor when the next generation has no delivery marker', () => {
    const boundary = { type: 'session/end-seed', data: { inherited: true } }
    expect(inferForkParent([delivery('grandparent'), boundary, other()], 3, 'child')).toBeUndefined()
    expect(inferForkParent([delivery('grandparent'), boundary, delivery('parent'), other()], 4, 'child')).toBe('parent')
  })

  it('ignores markers at or after the inherited cut', () => {
    const events = [delivery('parent'), other(), delivery('child-live')]
    expect(inferForkParent(events, 2, 'child')).toBe('parent')
    expect(inferForkParent(events, 0, 'child')).toBeUndefined()
    expect(inferForkParent(events, undefined, 'child')).toBeUndefined()
  })

  it('ignores the child Session itself and malformed events', () => {
    const events = [delivery('child'), null, 'junk', { type: 'session-log-deepseek/delivery-accepted' },
      { type: 'session-log-deepseek/delivery-accepted', data: { sessionId: 7 } }, delivery('parent')]
    expect(inferForkParent(events, 6, 'child')).toBe('parent')
  })

  it('returns undefined without a verifiable inherited marker', () => {
    expect(inferForkParent([other(), delivery('  spaced  ')], 2, 'child')).toBeUndefined()
    expect(inferForkParent([delivery('')], 1, 'child')).toBeUndefined()
    expect(inferForkParent([], 0, 'child')).toBeUndefined()
  })
})

describe('Branch Origin client reads', () => {
  it('reads every requested Session in bounded batches', async () => {
    const sessionIds = Array.from({ length: 121 }, (_, index) => `session-${index}`)
    const batches: string[][] = []
    const origins = await readBranchOriginMap(async request => {
      batches.push([...request.sessionIds])
      return request.sessionIds.map(childSessionId => ({
        childSessionId, parentSessionId: 'root', source: 'recorded' as const, createdAt: 1,
      }))
    }, sessionIds, new AbortController().signal)

    expect(batches.map(batch => batch.length)).toEqual([120, 1])
    expect(origins.size).toBe(121)
    expect(origins.get('session-120')).toBe('root')
  })
})

describe('Branch Origin codecs', () => {
  it('parses recorded and inferred origins', () => {
    expect(branchOriginSchema.parse({
      childSessionId: 'session-child', parentSessionId: 'session-parent', source: 'recorded', createdAt: 10,
    })).toEqual({ childSessionId: 'session-child', parentSessionId: 'session-parent', source: 'recorded', createdAt: 10 })
    expect(branchOriginSchema.parse({
      childSessionId: 'session-child', parentSessionId: 'session-parent', source: 'inferred', createdAt: 0,
    }).source).toBe('inferred')
  })

  it('rejects self-parenting, unknown fields, bad sources and timestamps', () => {
    const base = { childSessionId: 'session-a', parentSessionId: 'session-b', source: 'recorded', createdAt: 1 }
    expect(() => branchOriginSchema.parse({ ...base, parentSessionId: 'session-a' })).toThrow()
    expect(() => branchOriginSchema.parse({ ...base, extra: true })).toThrow()
    expect(() => branchOriginSchema.parse({ ...base, source: 'guessed' })).toThrow()
    expect(() => branchOriginSchema.parse({ ...base, createdAt: -1 })).toThrow()
  })

  it('parses record requests and bounded origin queries', () => {
    expect(branchOriginRecordSchema.parse({ childSessionId: 'session-a', parentSessionId: 'session-b' }))
      .toEqual({ childSessionId: 'session-a', parentSessionId: 'session-b' })
    expect(() => branchOriginRecordSchema.parse({ childSessionId: 'session-a', parentSessionId: 'session-a' })).toThrow()
    expect(branchOriginQuerySchema.parse({ sessionIds: ['session-a', 'session-a', 'session-b'] }))
      .toEqual({ sessionIds: ['session-a', 'session-b'] })
    expect(branchOriginQuerySchema.parse({})).toEqual({})
    expect(() => branchOriginQuerySchema.parse({ sessionIds: [''] })).toThrow()
  })

  it('parses origin list responses and rejects oversized or invalid ones', () => {
    const origin = { childSessionId: 'session-a', parentSessionId: 'session-b', source: 'inferred', createdAt: 1 }
    expect(branchOriginListSchema.parse({ origins: [origin] })).toEqual({ origins: [origin] })
    expect(() => branchOriginListSchema.parse({ origins: [{ ...origin, source: 'x' }] })).toThrow()
    expect(() => branchOriginListSchema.parse({ origins: 'nope' })).toThrow()
  })
})
