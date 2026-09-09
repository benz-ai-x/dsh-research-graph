import type { SessionSummary } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { ResearchTopicSnapshot, ResearchTopicSource } from '../../src/research-topic.ts'

/** Fixed, deterministic 1,000-reference acceptance corpus shared with the benchmark. */
export function researchTopicFixture(): {
  readonly a: ResearchTopicSnapshot
  readonly b: ResearchTopicSnapshot
  readonly rows: Record<string, SessionSummary>
} {
  const sources: ResearchTopicSource[] = Array.from({ length: 1_000 }, (_, index) => ({
    sessionId: `source-${String(index).padStart(4, '0')}`,
    title: `资料 ${String(index).padStart(4, '0')}`,
    cwd: `/research/${index % 4}`,
    workspace: { id: `workspace-${index % 4}`, title: `研究工作区 ${index % 4}` },
    archived: index % 5 === 0,
    status: index % 10 === 9 ? 'unavailable' : 'listed',
    ...(index >= 4 && index % 4 === 1 ? { parentSessionId: `source-${String(index - 4).padStart(4, '0')}` } : {}),
  }))
  const snapshot = (topicId: string, title: string, references: readonly ResearchTopicSource[]): ResearchTopicSnapshot => ({
    topic: {
      topicId, title, references: references.map(({ sessionId, title: label, cwd, workspace }) => ({
        sessionId, title: label, ...(cwd === undefined ? {} : { cwd }), ...(workspace === undefined ? {} : { workspace }),
      })),
      arrangement: { positions: {}, collapsed: [], offsets: {} },
    }, sources: references,
  })
  return {
    a: snapshot('1bb797e8-16ad-4d78-8f41-c0a5efaf8451', '研究 A', sources.slice(0, 500)),
    b: snapshot('2bb797e8-16ad-4d78-8f41-c0a5efaf8451', '研究 B', sources),
    rows: Object.fromEntries(sources.filter(source => source.status === 'listed').map(source => [source.sessionId, {
      id: source.sessionId as SessionId, displayTitle: source.title, running: false, blank: false,
      updatedAt: 1_700_000_000_000, ...(source.cwd === undefined ? {} : { cwd: source.cwd }),
    }])),
  }
}
