// @vitest-environment jsdom
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { GraphViewProps } from '../src/client/GraphView.tsx'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { useResearchMerge } from '../src/client/prototype/ResearchMerge.tsx'

afterEach(cleanup)

describe('prototype cross-workspace Merge', () => {
  it('retains sources across filters and layouts, confirms explicitly, and retries capture and topic association without a second target', async () => {
    const api = vi.fn<NonNullable<GraphViewProps['mergeResearchSessions']>>()
      .mockRejectedValueOnce(Object.assign(new Error('Capture reply unavailable'), { targetSessionId: 'target' }))
      .mockResolvedValue('target' as SessionId)
    const complete = vi.fn().mockRejectedValueOnce(new Error('Topic association unavailable')).mockResolvedValue(undefined)
    const rows = Object.fromEntries(['a', 'b', 'archived', 'blank', 'subagent'].map(id => [id, {
      id, displayTitle: `${id} 的讨论`, cwd: `/${id}`, blank: id === 'blank', origin: id === 'subagent' ? 'subagent' : undefined,
    }]))
    const props = {
      mergeResearchSessions: api,
      useSessions: (select: (value: unknown) => unknown) => select({ ids: Object.keys(rows), byId: rows }),
      useWorkspaces: (select: (value: unknown) => unknown) => select({ archivedSessionIds: ['archived'], items: ['a', 'b', 'research'].map(id => ({ workspaceId: id, title: `${id} 工作区`, path: `/${id}`, sessionIds: [id] })) }),
    } as unknown as GraphViewProps
    function Bench() {
      const [layout, setLayout] = useState(false)
      const merge = useResearchMerge(props, { topicId: 'topic', title: '跨工作区研究' }, complete)
      return <><button onClick={() => { setLayout(value => !value) }}>切换布局</button>{layout ? <article>{merge.panel}</article> : <aside>{merge.panel}</aside>}</>
    }
    render(<Bench />)
    expect(screen.getAllByRole('checkbox')).toHaveLength(2)
    fireEvent.change(screen.getByRole('combobox', { name: '来源工作区' }), { target: { value: 'a' } })
    fireEvent.click(screen.getByRole('checkbox', { name: /a 的讨论/ }))
    fireEvent.change(screen.getByRole('combobox', { name: '来源工作区' }), { target: { value: 'b' } })
    fireEvent.click(screen.getByRole('checkbox', { name: /b 的讨论/ }))
    fireEvent.click(screen.getByRole('button', { name: '切换布局' }))
    expect(screen.getByRole('button', { name: '移除来源 a 的讨论' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '移除来源 b 的讨论' })).toBeTruthy()
    fireEvent.change(screen.getByRole('combobox', { name: '3 · 新会话放在哪里' }), { target: { value: 'research' } })
    fireEvent.change(screen.getByRole('textbox', { name: '2 · 希望汇聚解决什么' }), { target: { value: '比较两个工作区的发现。' } })
    fireEvent.click(screen.getByRole('button', { name: '预览汇聚' }))
    fireEvent.click(screen.getByRole('button', { name: '切换布局' }))
    expect(api).not.toHaveBeenCalled()
    expect(complete).not.toHaveBeenCalled()
    expect(screen.queryByRole('checkbox')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '确认汇聚并创建会话' }))
    await screen.findByText('Capture reply unavailable')
    expect(api.mock.calls[0]![0]).toEqual({ sourceIds: ['a', 'b'], instruction: '比较两个工作区的发现。', workspaceId: 'research' })
    fireEvent.click(screen.getByRole('button', { name: '重试当前汇聚' }))
    await screen.findByText('Topic association unavailable')
    expect(api.mock.calls[1]![0]).toMatchObject({ targetSessionId: 'target', sourceIds: ['a', 'b'], workspaceId: 'research' })
    fireEvent.click(screen.getByRole('button', { name: '完成研究关联' }))
    await waitFor(() => { expect(complete).toHaveBeenCalledTimes(2) })
    expect(api).toHaveBeenCalledTimes(2)
    expect(complete.mock.calls[1]).toEqual(['target', expect.objectContaining({ topicId: 'topic', workspaceId: 'research', sources: [expect.objectContaining({ id: 'a' }), expect.objectContaining({ id: 'b' })] })])
  })
})
