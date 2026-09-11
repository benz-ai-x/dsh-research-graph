// @vitest-environment jsdom
import { randomUUID } from 'node:crypto'
import { useEffect, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { GraphViewProps } from '../src/client/GraphView.tsx'
import type { KnowledgeCard } from '../src/knowledge.ts'
import type { ResearchReuseApi } from '../src/client/research-reuse-remote.ts'
import type { ResearchReuseRecord } from '../src/research-reuse.ts'
import { KnowledgeEditor, KnowledgeProvider, useKnowledge } from '../src/client/Knowledge.tsx'
import { KnowledgeReader } from '../src/client/KnowledgeReader.tsx'
import { ResearchMerge } from '../src/client/ResearchMerge.tsx'
import { ResearchReuseProvider } from '../src/client/ResearchReuse.tsx'
import { knowledgeClient, knowledgeContent, knowledgeSource, knowledgeTranslate as t } from './fixtures/knowledge-client.ts'

afterEach(cleanup)

describe('Research Workbench user actions', () => {
  it('restores the displayed revision, expanded original, and scroll when remounting the shared reader', async () => {
    const client = knowledgeClient()
    const key = randomUUID()
    const card: KnowledgeCard = { cardId: randomUUID(), topicIds: [], revisions: [1, 2].map(number => ({
      revisionId: randomUUID(), requestHash: 'a'.repeat(64), number, savedAt: number * 1000,
      content: knowledgeContent(`研究结论第 ${number} 版`), sources: [knowledgeSource()],
    })) }
    const view = (mode: string) => <article key={mode} data-working-scroll="" data-testid="reader-seat"><KnowledgeReader workingKey={key} card={card} relations={[]} read={client.read} t={t} /></article>
    const rendered = render(view('reading'))
    fireEvent.change(screen.getByRole('combobox', { name: '修订版本' }), { target: { value: card.revisions[0]!.revisionId } })
    fireEvent.click(screen.getByRole('button', { name: /查看来源原文/ }))
    await screen.findByRole('region', { name: '讨论原文' })
    screen.getByTestId('reader-seat').scrollTop = 360
    fireEvent.scroll(screen.getByTestId('reader-seat'))
    rendered.rerender(view('graph'))
    expect((screen.getByRole('combobox', { name: '修订版本' }) as HTMLSelectElement).value).toBe(card.revisions[0]!.revisionId)
    expect(screen.getByRole('region', { name: '讨论原文' })).toBeDefined()
    expect(screen.getByTestId('reader-seat').scrollTop).toBe(360)
  })

  it('opens the displayed revision for editing in one action and retries a failed read before allowing edits', async () => {
    const client = knowledgeClient()
    const card: KnowledgeCard = { cardId: randomUUID(), topicIds: [], revisions: [1, 2].map(number => ({
      revisionId: randomUUID(), requestHash: 'a'.repeat(64), number, savedAt: number * 1000,
      content: knowledgeContent(`研究结论第 ${number} 版`), sources: [],
    })) }
    client.api.read.mockRejectedValueOnce(new Error('Connection unavailable')).mockResolvedValue(card)
    render(<KnowledgeProvider {...client} t={t}><KnowledgeReader card={card} relations={[]} read={client.read} t={t} /></KnowledgeProvider>)
    fireEvent.change(screen.getByRole('combobox', { name: '修订版本' }), { target: { value: card.revisions[0]!.revisionId } })
    fireEvent.click(screen.getByRole('button', { name: '编辑卡片' }))
    await screen.findByRole('alert')
    expect(screen.queryByRole('button', { name: '保存知识' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '重试' }))
    const title = await screen.findByRole('textbox', { name: '卡片标题' })
    expect((title as HTMLInputElement).value).toBe('研究结论第 1 版')
    expect(screen.getByRole('button', { name: '保存知识' })).toBeDefined()
  })

  it('does not overwrite typing or an intentionally cleared field when source prefill arrives late', async () => {
    const client = knowledgeClient()
    const source = { kind: 'discussion' as const, sessionId: 'session-a', startSeq: 10, endSeq: 14 }
    const pending = Promise.withResolvers<Awaited<ReturnType<GraphViewProps['readSessionHistory']>>>()
    client.read.mockReturnValue(pending.promise)
    render(<KnowledgeEditor cardId={undefined} source={source} topicId={undefined} {...client} t={t} close={vi.fn()} changed={vi.fn()} />)
    fireEvent.change(screen.getByRole('textbox', { name: '卡片标题' }), { target: { value: '我的标题' } })
    fireEvent.change(screen.getByRole('textbox', { name: '结论' }), { target: { value: '暂写' } })
    fireEvent.change(screen.getByRole('textbox', { name: '结论' }), { target: { value: '' } })
    await act(async () => { pending.resolve({ kind: 'original', sessionId: source.sessionId, hasEarlier: false, hasLater: false,
      turns: [{ ...knowledgeSource().source.turns[0]!, messages: [{ role: 'user', seq: 11, text: '原始问题' }, { role: 'assistant', seq: 13, text: '原始回答' }] }] }) })
    expect((screen.getByRole('textbox', { name: '卡片标题' }) as HTMLInputElement).value).toBe('我的标题')
    expect((screen.getByRole('textbox', { name: '结论' }) as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText('核心问题') as HTMLTextAreaElement).value).toBe('原始问题')
    expect(client.api.save).not.toHaveBeenCalled()
  })

  it('keeps cross-workspace selection and retries native capture and topic association on the same target', async () => {
    const client = knowledgeClient()
    client.topics.list.mockResolvedValue([{ topicId: 'topic', title: '跨工作区研究', references: [], arrangement: { positions: {}, collapsed: [], offsets: {} } }])
    client.topics.write.mockRejectedValueOnce(new Error('Topic response unavailable')).mockResolvedValue({ topicId: 'topic', title: '跨工作区研究', references: [], arrangement: { positions: {}, collapsed: [], offsets: {} } })
    const merge = vi.fn<NonNullable<GraphViewProps['mergeResearchSessions']>>()
      .mockRejectedValueOnce(Object.assign(new Error('Capture response unavailable'), { targetSessionId: 'target' })).mockResolvedValue('target' as SessionId)
    const byId = Object.fromEntries(['a', 'b', 'archived', 'blank', 'subagent'].map(id => [id, { id, displayTitle: `${id} 的讨论`, cwd: `/${id}`, blank: id === 'blank', origin: id === 'subagent' ? 'subagent' : undefined }]))
    const props = { t, mergeResearchSessions: merge, topics: client.topics,
      useSessions: (select: (value: unknown) => unknown) => select({ ids: Object.keys(byId), byId }),
      useWorkspaces: (select: (value: unknown) => unknown) => select({ archivedSessionIds: ['archived'], items: ['a', 'b', 'research'].map(id => ({ workspaceId: id, title: `${id} 工作区`, path: `/${id}`, sessionIds: [id] })) }),
    } as unknown as GraphViewProps
    const complete = vi.fn()
    function Entry() {
      const knowledge = useKnowledge()!
      const [visible, setVisible] = useState(true)
      useEffect(() => { knowledge.selectTopic('topic') }, [knowledge.selectTopic])
      return <><button onClick={() => { setVisible(true) }}>重新汇聚</button><ResearchMerge props={props} visible={visible} close={() => { setVisible(false) }} completed={complete} /></>
    }
    render(<KnowledgeProvider {...client} t={t}><Entry /></KnowledgeProvider>)
    expect(screen.getAllByRole('checkbox')).toHaveLength(2)
    fireEvent.change(screen.getByRole('combobox', { name: '来源工作区' }), { target: { value: 'a' } })
    fireEvent.click(screen.getByRole('checkbox', { name: /a 的讨论/ }))
    fireEvent.change(screen.getByRole('combobox', { name: '来源工作区' }), { target: { value: 'b' } })
    fireEvent.click(screen.getByRole('checkbox', { name: /b 的讨论/ }))
    fireEvent.change(screen.getByRole('combobox', { name: '3 · 新会话放在哪里' }), { target: { value: 'research' } })
    fireEvent.click(screen.getByRole('button', { name: '预览汇聚' }))
    await screen.findByRole('button', { name: '确认汇聚并创建会话' })
    expect(merge).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '关闭汇聚' }))
    fireEvent.click(screen.getByRole('button', { name: '重新汇聚' }))
    fireEvent.click(screen.getByRole('button', { name: '确认汇聚并创建会话' }))
    await screen.findByText('Capture response unavailable')
    fireEvent.click(screen.getByRole('button', { name: '重试当前汇聚' }))
    await screen.findByText('Topic response unavailable')
    fireEvent.click(screen.getByRole('button', { name: '完成研究关联' }))
    await waitFor(() => { expect(complete).toHaveBeenCalledWith('target', 'topic') })
    expect(merge).toHaveBeenCalledTimes(2)
    expect(merge.mock.calls[1]![0]).toMatchObject({ targetSessionId: 'target', sourceIds: ['a', 'b'], workspaceId: 'research' })
    expect(client.topics.write.mock.calls[1]![0]).toEqual({ kind: 'add', topicId: 'topic', sessionIds: ['a', 'b', 'target'] })
  })

  it('continues from the displayed old revision and keeps the workbench open after confirmation', async () => {
    const client = knowledgeClient()
    const card: KnowledgeCard = { cardId: randomUUID(), topicIds: [], revisions: [1, 2].map(number => ({ revisionId: randomUUID(), requestHash: 'a'.repeat(64), number,
      savedAt: number * 1000, content: knowledgeContent(`研究结论第 ${number} 版`), sources: [] })) }
    const old = card.revisions[0]!
    const record: ResearchReuseRecord = { operationId: randomUUID(), requestHash: 'b'.repeat(64), requestId: randomUUID(), targetSessionId: 'target', targetCreated: false,
      stage: 'prepared', createdAt: 1000, workspace: { id: 'b', title: '工作区 B', cwd: '/b' }, question: '验证旧结论', promptText: '当时的材料', budgetChars: 32000,
      materials: [{ kind: 'card', cardId: card.cardId, revisionId: old.revisionId, revisionNumber: 1, savedAt: 1000, content: old.content, sources: [] }] }
    const api: ResearchReuseApi = { prepare: vi.fn(async () => record), submit: vi.fn(async () => ({ ...record, stage: 'accepted', targetCreated: true, acceptedAt: 2000 })),
      read: vi.fn(async () => record), forSession: vi.fn(async () => []), relations: vi.fn(async () => []) }
    const open = vi.fn()
    render(<ResearchReuseProvider api={api} workspaces={[{ workspaceId: 'b', title: '工作区 B', path: '/b', sessionIds: [], createdAt: '', updatedAt: '' } as never]}
      viewedId={'a' as SessionId} openSession={open} stayInResearch t={t}><KnowledgeProvider {...client} t={t}>
      <KnowledgeReader card={card} relations={[]} read={client.read} t={t} /></KnowledgeProvider></ResearchReuseProvider>)
    fireEvent.change(screen.getByRole('combobox', { name: '修订版本' }), { target: { value: old.revisionId } })
    fireEvent.click(screen.getByRole('button', { name: '继续讨论' }))
    fireEvent.change(screen.getByRole('textbox', { name: '新问题' }), { target: { value: '验证旧结论' } })
    fireEvent.change(screen.getByRole('combobox', { name: '目标工作区' }), { target: { value: 'b' } })
    fireEvent.click(screen.getByRole('button', { name: '预览发送内容' }))
    await screen.findByRole('button', { name: '确认并开始讨论' })
    expect(api.prepare).toHaveBeenCalledWith(expect.objectContaining({ materials: [{ kind: 'card', cardId: card.cardId, revisionId: old.revisionId }] }), expect.any(AbortSignal))
    expect(api.submit).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '确认并开始讨论' }))
    await screen.findByRole('button', { name: '准备另一个讨论' })
    expect(open).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '打开目标会话' }))
    expect(open).toHaveBeenCalledExactlyOnceWith('target')
  })
})
