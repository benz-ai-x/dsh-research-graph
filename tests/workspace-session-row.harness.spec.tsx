// @vitest-environment jsdom
import type { ComponentProps } from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HoverCardGroup } from '@deepseek-ai/dsh-client-ui-primitives'
import { SessionNodeItem } from '../src/client/workspace/rows/Rows.tsx'
import type { SessionNode } from '../src/client/workspace/tree.ts'
import { zh } from '../src/client/workspace/locales.ts'

function translate(key: string, params: Record<string, unknown> = {}): string {
  const text = (zh as Record<string, string>)[key] ?? key
  return Object.entries(params).reduce((out, [name, value]) => out.replaceAll(`{${name}}`, String(value)), text)
}

function sessionNode(over: Partial<SessionNode> = {}): SessionNode {
  return {
    id: 'session-row' as SessionNode['id'],
    title: 'Session row',
    blank: false,
    running: false,
    runningSubagentCount: 0,
    unread: false,
    failed: false,
    pinned: false,
    archived: false,
    updatedAt: 1_000,
    ...over,
  }
}

function renderRow(node: SessionNode): { readonly row: HTMLElement } {
  const view = render(
    <HoverCardGroup>
      <SessionNodeItem
        node={node}
        currentId={undefined}
        now={2_000}
        onOpen={vi.fn()}
        onRenameRequest={vi.fn()}
        renderSlot={() => null}
        t={translate as ComponentProps<typeof SessionNodeItem>['t']}
      />
    </HoverCardGroup>,
  )
  const row = view.container.querySelector<HTMLElement>(`[data-row-key="session:${node.id}"]`)
  if (row === null) throw new Error('Session row did not render')
  return { row }
}

afterEach(cleanup)

describe('Workspace Session row status presentation', () => {
  it.each([
    {
      name: 'Unread',
      node: sessionNode({ unread: true }),
      present: ['status.unread'],
      absent: ['status.failed', 'status.running'],
    },
    {
      name: 'Run failed',
      node: sessionNode({ unread: true, failed: true }),
      present: ['status.failed'],
      absent: ['status.unread', 'status.running'],
    },
    {
      name: 'pending interaction, Subagent activity, and unread together',
      node: sessionNode({ pendingInteraction: 'approval', running: true, runningSubagentCount: 1, unread: true }),
      present: ['status.waitingApproval', 'status.subagentsRunning.one', 'status.unread'],
      absent: ['status.failed', 'status.running'],
    },
    {
      name: 'running and unread together',
      node: sessionNode({ running: true, unread: true }),
      present: ['status.running', 'status.unread'],
      absent: ['status.failed', 'status.waitingApproval'],
    },
  ])('renders $name with the expected companion states', ({ node, present, absent }) => {
    const { row } = renderRow(node)
    for (const key of present) expect(within(row).getByText(translate(key, { n: 1 }))).toBeDefined()
    for (const key of absent) expect(within(row).queryByText(translate(key, { n: 1 }))).toBeNull()
  })

  it('shows the current directory and archived state while suppressing unread and idle in the hover card', async () => {
    const { row } = renderRow(sessionNode({ archived: true, unread: true, cwd: '/current' }))
    expect(within(row).queryByText(translate('status.unread'))).toBeNull()
    fireEvent.pointerEnter(row.parentElement as Element)
    expect(await screen.findByText('/current', undefined, { timeout: 2_000 })).toBeDefined()
    expect(screen.getByText(translate('row.archived'))).toBeDefined()
    expect(screen.queryByText(translate('status.unread'))).toBeNull()
    expect(screen.queryByText(translate('status.idle'))).toBeNull()
  })
})
