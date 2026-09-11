// @vitest-environment jsdom
import { randomUUID } from 'node:crypto'
import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { WorkspaceView } from '@deepseek-ai/dsh-api-workspace-controller/client'
import { ResearchReuseProvider, useResearchReuse } from '../src/client/ResearchReuse.tsx'
import type { ResearchReuseApi } from '../src/client/research-reuse-remote.ts'
import type { ResearchReuseRecord } from '../src/research-reuse.ts'
import { knowledgeSource, knowledgeTranslate as t } from './fixtures/knowledge-client.ts'

afterEach(cleanup)

function Entry() {
  const reuse = useResearchReuse()!
  return <><button onClick={() => { reuse.add({ kind: 'turn', sessionId: 'session-a', startSeq: 10, endSeq: 14 }, '原文一') }}>加入原文</button>
    <button onClick={reuse.open}>查看材料</button></>
}

async function compose() {
  const record: ResearchReuseRecord = {
    operationId: randomUUID(), requestHash: 'a'.repeat(64), requestId: randomUUID(), targetSessionId: 'session-target',
    targetCreated: false, stage: 'prepared', workspace: { id: 'b', title: '工作区 B', cwd: '/b' }, createdAt: 1000,
    question: '研究问题', materials: [{ kind: 'turn', source: knowledgeSource() }], promptText: '固定发送内容', budgetChars: 32_000,
  }
  const api = { relations: vi.fn(async () => []), prepare: vi.fn<ResearchReuseApi['prepare']>(async () => record),
    submit: vi.fn<ResearchReuseApi['submit']>(), read: vi.fn<ResearchReuseApi['read']>(),
    forSession: vi.fn<ResearchReuseApi['forSession']>(async () => []) }
  const open = vi.fn()
  const workspace = { workspaceId: 'b', title: '工作区 B', path: '/b', sessionIds: [], createdAt: '', updatedAt: '' } as WorkspaceView
  render(<ResearchReuseProvider api={api} workspaces={[workspace]} viewedId={'session-a' as SessionId} openSession={open} t={t}><Entry /></ResearchReuseProvider>)
  fireEvent.click(screen.getByRole('button', { name: '加入原文' }))
  fireEvent.click(screen.getByRole('button', { name: '查看材料' }))
  fireEvent.change(screen.getByRole('textbox', { name: '新问题' }), { target: { value: '研究问题' } })
  fireEvent.change(screen.getByRole('combobox', { name: '目标工作区' }), { target: { value: 'b' } })
  fireEvent.click(screen.getByRole('button', { name: '预览发送内容' }))
  await screen.findByText('固定发送内容')
  return { api, open, record }
}

it.each(['prepared', 'created', 'accepted'] as const)('recovers the %s journal after a lost submit response and keeps the same target', async stage => {
  const { api, record, open } = await compose()
  const saved: ResearchReuseRecord = { ...record, stage, targetCreated: true,
    ...(stage === 'accepted' ? { acceptedAt: 2000 } : { error: 'Admission response lost' }) }
  api.submit.mockRejectedValueOnce(new Error('Transport disconnected'))
  api.read.mockResolvedValue(saved)
  fireEvent.click(screen.getByRole('button', { name: '确认并开始讨论' }))
  await screen.findByRole('button', { name: '打开目标会话' })
  expect((screen.getByRole('textbox', { name: '新问题' }) as HTMLTextAreaElement).disabled).toBe(true)
  expect(api.read).toHaveBeenCalledWith({ operationId: record.operationId }, expect.any(AbortSignal))
  if (stage !== 'accepted') {
    expect(open).not.toHaveBeenCalled()
    api.submit.mockResolvedValue({ ...saved, stage: 'accepted', acceptedAt: 2000 })
    fireEvent.click(screen.getByRole('button', { name: '重试发送' }))
    await waitFor(() => { expect(open).toHaveBeenCalledExactlyOnceWith(record.targetSessionId) })
    expect(api.submit.mock.calls.map(([request]) => request.operationId)).toEqual([record.operationId, record.operationId])
  } else expect(open).toHaveBeenCalledExactlyOnceWith(record.targetSessionId)
  expect(api.prepare).toHaveBeenCalledTimes(1)
})

it('keeps uncertain materials locked through a failed recovery and rechecks on reopening', async () => {
  const { api, record, open } = await compose()
  api.submit.mockRejectedValue(new Error('Transport disconnected'))
  api.read.mockRejectedValueOnce(new Error('Still disconnected'))
  api.read.mockResolvedValue({ ...record, stage: 'accepted', targetCreated: true, acceptedAt: 2000 })
  fireEvent.click(screen.getByRole('button', { name: '确认并开始讨论' }))
  await screen.findByRole('alert')
  expect((screen.getByRole('textbox', { name: '新问题' }) as HTMLTextAreaElement).disabled).toBe(true)
  expect(screen.getByText(record.targetSessionId, { exact: false })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '关闭材料' }))
  fireEvent.click(screen.getByRole('button', { name: '加入原文' }))
  fireEvent.click(screen.getByRole('button', { name: '查看材料' }))
  await screen.findByRole('button', { name: '打开目标会话' })
  expect(api.read).toHaveBeenCalledTimes(2)
  expect(api.prepare).toHaveBeenCalledTimes(1)
  expect(open).not.toHaveBeenCalled()
})

it('ignores a canceled submit reply and recovers its target without late navigation', async () => {
  const { api, record, open } = await compose()
  let resolve!: (value: ResearchReuseRecord) => void
  api.submit.mockReturnValue(new Promise(value => { resolve = value }))
  const saved: ResearchReuseRecord = { ...record, stage: 'accepted', targetCreated: true, acceptedAt: 2000 }
  api.read.mockResolvedValue(saved)
  fireEvent.click(screen.getByRole('button', { name: '确认并开始讨论' }))
  fireEvent.click(screen.getByRole('button', { name: '关闭材料' }))
  expect(api.submit.mock.lastCall![1].aborted).toBe(true)
  await act(async () => { resolve(saved) })
  expect(open).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '查看材料' }))
  await screen.findByRole('button', { name: '打开目标会话' })
  expect(api.submit).toHaveBeenCalledTimes(1)
  expect(open).not.toHaveBeenCalled()
})

it('unlocks editing only after recovery confirms that creation failed', async () => {
  const { api, record, open } = await compose()
  api.submit.mockRejectedValue(new Error('Lost failure response'))
  api.read.mockResolvedValue({ ...record, error: 'Create failed before a target exists' })
  fireEvent.click(screen.getByRole('button', { name: '确认并开始讨论' }))
  await waitFor(() => { expect(api.read).toHaveBeenCalledTimes(1) })
  await waitFor(() => { expect((screen.getByRole('textbox', { name: '新问题' }) as HTMLTextAreaElement).disabled).toBe(false) })
  expect(screen.queryByRole('button', { name: '打开目标会话' })).toBeNull()
  expect(open).not.toHaveBeenCalled()
})
