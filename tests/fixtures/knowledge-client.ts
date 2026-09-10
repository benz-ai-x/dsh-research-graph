import { vi } from 'vitest'
import type { KnowledgeContent, KnowledgeSource } from '../../src/knowledge.ts'
import type { GraphViewInjected } from '../../src/client/GraphView.tsx'
import type { KnowledgeApi } from '../../src/client/knowledge-remote.ts'
import { zh, type SessionGraphKey } from '../../src/client/locales.ts'

export function knowledgeSource(first = 1, last = first): KnowledgeSource {
  return { sessionId: 'session-a', title: '讨论 A', source: {
    startSeq: first * 10, endSeq: last * 10 + 4,
    turns: Array.from({ length: last - first + 1 }, (_, index) => {
      const turn = first + index
      return { turn, startSeq: turn * 10, endSeq: turn * 10 + 4, startedAt: 1000,
        messages: [{ role: 'user', seq: turn * 10 + 1, text: `原文 ${turn}` }] }
    }),
  } }
}

export function knowledgeContent(title = '研究结论'): KnowledgeContent {
  return { title, question: '', conclusion: '需要保留的结论', rationale: '', openQuestions: '', kind: 'method', status: 'draft' }
}

export function knowledgeClient() {
  return {
    api: {
      save: vi.fn<KnowledgeApi['save']>(), read: vi.fn<KnowledgeApi['read']>(), search: vi.fn<KnowledgeApi['search']>(),
      membership: vi.fn<KnowledgeApi['membership']>(), prepareExtraction: vi.fn<KnowledgeApi['prepareExtraction']>(),
      extract: vi.fn<KnowledgeApi['extract']>(), prepareExport: vi.fn<KnowledgeApi['prepareExport']>(),
    },
    topics: { list: vi.fn<GraphViewInjected['topics']['list']>(async () => []),
      read: vi.fn<GraphViewInjected['topics']['read']>(), write: vi.fn<GraphViewInjected['topics']['write']>() },
    read: vi.fn<GraphViewInjected['readSessionHistory']>(async request => {
      const later = request.afterSeq === 10
      return { kind: 'original', sessionId: 'session-a', turns: knowledgeSource(later ? 2 : 1).source.turns,
        hasEarlier: later, hasLater: !later }
    }),
  }
}

export function knowledgeTranslate(key: SessionGraphKey, params: Record<string, unknown> = {}): string {
  return zh[key].replace(/\{([^}]+)\}/gu, (_, name: string) => String(params[name]))
}
