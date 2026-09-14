import { describe, expect, it } from 'vitest'
import type { SessionGraphNode } from '../src/client/graph-model.ts'
import { canvasNodeTitle, duplicateTitleIds, shortSessionId } from '../src/client/node-labels.ts'

const node = (id: string, title: string): SessionGraphNode => ({ id, title, mergeSources: [] } as unknown as SessionGraphNode)

describe('readable node labels', () => {
  it('keeps native identity labels concise without conflating identities that differ by their prefix', () => {
    expect(shortSessionId('session-abcdef-1234')).toBe('abcdef')
    const labels = duplicateTitleIds([node('session-abcdef-1234', 'Same'), node('abcdef-1234', 'Same')])
    expect(new Set(labels.values()).size).toBe(2)
  })

  it('preserves user titles while removing a captured Merge operation prefix only for display', () => {
    const original = node('merge', 'Merge: Palantir 商业模式分析')
    expect(canvasNodeTitle(original)).toBe(original.title)
    const merged = { ...original, mergeSources: [{ sessionId: 'a', capturedThroughSeq: 4 }] }
    expect(canvasNodeTitle(merged)).toBe('Palantir 商业模式分析')
    expect(merged.title).toBe('Merge: Palantir 商业模式分析')
  })

  it('uses unambiguous identity labels for equal titles and keeps them stable across recency ordering', () => {
    const nodes = [node('abcdef-branch-one', 'Palantir'), node('abcdef-branch-two', 'Palantir'), node('unique', 'Other research')]
    const labels = duplicateTitleIds(nodes)
    expect(labels.size).toBe(2)
    expect(new Set(labels.values()).size).toBe(2)
    expect(labels.get('abcdef-branch-one')?.length).toBeGreaterThan(6)
    expect(duplicateTitleIds([...nodes].reverse())).toEqual(labels)
  })
})
