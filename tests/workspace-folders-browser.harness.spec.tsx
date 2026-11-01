// @vitest-environment jsdom
import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { WorkspaceFolderRecord, WorkspaceFolderWrite } from '../src/workspace-folder.ts'
import { WorkspaceBrowser } from '../src/client/workspace/rows/WorkspaceBrowser.tsx'
import { zh } from '../src/client/workspace/locales.ts'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => {
  const icon = () => <span aria-hidden="true" />
  const entries = (items, onSelect) => items.map(item => {
    if (item.type === 'separator') return <hr key={item.id} />
    return <div key={item.id}>
      <button type="button" onClick={() => { onSelect(item.id) }}>{item.label}</button>
      {item.submenu === undefined ? null : entries(item.submenu, onSelect)}
    </div>
  })
  return {
    Button: ({ children, disabled, onClick }) => <button type="button" disabled={disabled} onClick={onClick}>{children}</button>,
    HoverCard: ({ anchor }) => <>{anchor}</>,
    HoverCardGroup: ({ children }) => <>{children}</>,
    IconArchiveCheckOutlineRegular: icon,
    IconArchiveOffOutlineRegular: icon,
    IconArchiveOutlineRegular: icon,
    IconBranchOutlineRegular: icon,
    IconChevronsUpDownOutlineRegular: icon,
    IconClockOutlineRegular: icon,
    IconCloseFillRegular: icon,
    IconCopyOutlineRegular: icon,
    IconEditOutlineRegular: icon,
    IconEllipsisOutlineRegular: icon,
    IconFlatListOutlineRegular: icon,
    IconFolderCloseRegular: icon,
    IconFolderOpenRegular: icon,
    IconNewChatOutlineRegular: icon,
    IconPinFillRegular: icon,
    IconPinOutlineRegular: icon,
    IconProjectAddOutlineRegular: icon,
    IconQueueOutlineRegular: icon,
    IconSearchOutlineRegular: icon,
    IconSlidersTwoOutlineRegular: icon,
    IconTrashOutlineRegular: icon,
    IconTriangleRightFillRegular: icon,
    IconUnarchiveOutlineRegular: icon,
    IconWorkspaceTreeOutlineRegular: icon,
    Menu: ({ open, anchor, items, onSelect, children }) => (
      <div>{anchor}{children}{open ? <div role="menu">{entries(items ?? [], onSelect)}</div> : null}</div>
    ),
    MenuItemButton: ({ children, onSelect }) => <button type="button" onClick={onSelect}>{children}</button>,
    Modal: ({ open, title, description, footer, children }) => open ? (
      <div role="dialog" aria-label={typeof title === 'string' ? title : undefined}>
        {title}{description}{children}{footer}
      </div>
    ) : null,
    relativeTime: () => ({ unit: 'day', n: 1 }),
    ShortcutKeys: () => <span aria-hidden="true" />,
    StateDot: () => <span aria-hidden="true" />,
    Toast: () => <span aria-hidden="true" />,
    Tooltip: ({ children }) => <>{children}</>,
  }
})

const F1 = '1bb797e8-16ad-4d78-8f41-c0a5efaf8451'

function translate(key: string, params: Record<string, unknown> = {}): string {
  const text = (zh as Record<string, string>)[key] ?? key
  return Object.entries(params).reduce((out, [name, value]) => out.replaceAll(`{${name}}`, String(value)), text)
}

const session = (id: string) => ({
  id,
  title: `Session ${id}`,
  displayTitle: `Session ${id}`,
  running: false,
  blank: false,
  updatedAt: 1_000,
  retainedBy: {},
  cwd: '/a',
})

interface Fixture {
  readonly writes: WorkspaceFolderWrite[]
  readonly rerender: (records: readonly WorkspaceFolderRecord[]) => void
}

function mountBrowser(initialRecords: readonly WorkspaceFolderRecord[]): Fixture {
  const writes: WorkspaceFolderWrite[] = []
  let records = [...initialRecords]
  const initialList = {
    ids: ['s1', 's2'],
    byId: { s1: session('s1'), s2: session('s2') },
    current: undefined,
    phase: 'ready',
    projectionsBySession: {},
  }
  const workspaceSnapshot = {
    items: [{
      workspaceId: 'w1',
      path: '/host/w1',
      title: 'Workspace w1',
      sessionIds: ['s1', 's2'],
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    }],
    archivedSessionIds: [],
    pinnedSessionIds: [],
    state: 'idle',
    phase: 'ready',
    error: undefined,
  }
  const storeState = {
    groupBy: 'workspace',
    orderBy: 'updated',
    groupExpansion: { w1: true },
    folderExpansion: {},
    sessionOrderByAccount: {},
    archivedFilter: 'default',
  }
  const fixture: Fixture = {
    writes,
    rerender: next => { records = [...next]; rerenderFn() },
  }
  let rerenderFn: () => void = () => {}
  const view = render(
    <BrowserHarness />,
  )
  rerenderFn = view.rerender
  return fixture

  function BrowserHarness(): React.ReactElement {
    const [, bump] = React.useReducer(x => x + 1, 0)
    rerenderFn = bump
    const writeFolder = (request: WorkspaceFolderWrite): Promise<WorkspaceFolderRecord> => {
      writes.push(request)
      const record: WorkspaceFolderRecord = records.find(item => item.workspaceId === 'w1')
        ?? { workspaceId: 'w1', folders: [] }
      const next = applyWrite(record, request, writes.length)
      records = [next]
      bump()
      return Promise.resolve(next)
    }
    return (
      <WorkspaceBrowser
        wide
        expandSidebar={() => {}}
        usePanelInfo={selector => selector({ activePanelId: null })}
        useSessions={selector => selector(initialList)}
        useSessionStatus={selector => selector(new Map())}
        useWorkspaces={selector => selector(workspaceSnapshot)}
        useFolders={selector => selector(records)}
        useHostInfo={selector => selector({ home: '/host' })}
        useShortcuts={selector => selector([])}
        useWorkspaceShortcuts={selector => selector({ renameTarget: null, searchRequest: 0, addRequested: false, directoryBusy: false })}
        useDirectoryFlow={selector => selector(false)}
        useStore={selector => selector(storeState)}
        actions={{
          setGroupBy: () => {},
          setOrderBy: () => {},
          setGroupExpanded: (key, expanded) => { storeState.groupExpansion[key] = expanded },
          setFolderExpanded: (key, expanded) => { storeState.folderExpansion = { ...storeState.folderExpansion, [key]: expanded }; bump() },
          retainAccountKeys: () => {},
          syncSessionOrders: () => {},
          setSessionOrder: () => {},
          pinSessionOrder: () => {},
          setArchivedFilter: () => {},
        }}
        startSession={() => {}}
        open={() => {}}
        requestSessionRename={() => {}}
        notifyArchivedNotOpenable={() => {}}
        renameWorkspace={() => Promise.resolve()}
        deleteWorkspace={() => Promise.resolve()}
        insertWorkspaceBefore={() => Promise.resolve()}
        unarchiveSession={() => Promise.resolve()}
        writeFolder={writeFolder}
        createWorkspace={() => Promise.resolve(workspaceSnapshot.items[0])}
        searchSessions={() => Promise.resolve({ items: [], hasMore: false })}
        searchResultLimit={20}
        requestSearch={() => {}}
        requestAddWorkspace={() => {}}
        closeAddWorkspace={() => {}}
        setDirectoryBusy={() => {}}
        renderSlot={() => null}
        t={translate as unknown as (key: never, params?: Record<string, unknown>) => string}
      />
    )
  }
}

function applyWrite(
  record: WorkspaceFolderRecord,
  request: WorkspaceFolderWrite,
  seq: number,
): WorkspaceFolderRecord {
  if (request.kind === 'create') {
    return {
      ...record,
      folders: [...record.folders, { folderId: request.folderId, title: request.title, sessionIds: request.sessionId === undefined ? [] : [request.sessionId] }],
    }
  }
  if (request.kind === 'delete') {
    return { ...record, folders: record.folders.filter(folder => folder.folderId !== request.folderId) }
  }
  if (request.kind === 'rename') {
    return {
      ...record,
      folders: record.folders.map(folder => folder.folderId === request.folderId ? { ...folder, title: request.title } : folder),
    }
  }
  return {
    ...record,
    folders: record.folders.map(folder => ({
      ...folder,
      sessionIds: folder.folderId === request.folderId
        ? [...folder.sessionIds.filter(id => id !== request.sessionId), request.sessionId]
        : folder.sessionIds.filter(id => id !== request.sessionId),
    })),
  }
}

afterEach(cleanup)

describe('Workspace browser folders', () => {
  it('renders the native flat layout while the Workspace has no folders', async () => {
    mountBrowser([])
    expect(screen.getAllByText('Session s1')).toHaveLength(1)
    expect(screen.queryByText('新建文件夹')).toBeNull()
    expect(screen.queryByText('未分组')).toBeNull()
  })

  it('creates a folder from the Workspace row menu', async () => {
    const fixture = mountBrowser([])
    fireEvent.click(screen.getByRole('button', { name: '工作区“Workspace w1”的操作' }))
    fireEvent.click(screen.getByRole('button', { name: '新建文件夹' }))
    const dialog = screen.getByRole('dialog')
    fireEvent.change(dialog.querySelector('input'), { target: { value: '研究' } })
    fireEvent.click(screen.getAllByRole('button', { name: '创建' }).at(-1))
    await waitFor(() => expect(fixture.writes).toHaveLength(1))
    expect(fixture.writes[0]).toMatchObject({ kind: 'create', workspaceId: 'w1', title: '研究' })
    await waitFor(() => expect(screen.getByText('研究')).toBeDefined())
  })

  it('groups folder members, keeps loose rows under Ungrouped, and drag-assigns into folders', async () => {
    const fixture = mountBrowser([{ workspaceId: 'w1', folders: [{ folderId: F1, title: '研究', sessionIds: ['s2'] }] }])
    // The folder header shows with its count; s2 is hidden until the folder opens.
    expect(screen.getByText('研究')).toBeDefined()
    expect(screen.getByText('1')).toBeDefined()
    expect(screen.getByText('未分组')).toBeDefined()
    expect(screen.getByText('Session s1')).toBeDefined()
    expect(screen.queryByText('Session s2')).toBeNull()
    fireEvent.click(screen.getByText('研究'))
    expect(screen.getByText('Session s2')).toBeDefined()
    // Dragging a loose row onto the folder header commits a move write.
    fireEvent.dragStart(screen.getByText('Session s1'), { dataTransfer: { effectAllowed: 'move', setData: () => {} } })
    const folderRow = screen.getByText('研究').closest('[data-row-key]')
    expect(folderRow?.getAttribute('data-row-key')).toBe(`folder:${F1}`)
    fireEvent.drop(folderRow, { dataTransfer: { dropEffect: 'move', getData: () => 's1' } })
    await waitFor(() => expect(fixture.writes).toEqual([
      { kind: 'move', workspaceId: 'w1', sessionId: 's1', folderId: F1 },
    ]))
  })

  it('deletes a folder from its menu and returns members to the ungrouped section', async () => {
    const fixture = mountBrowser([{ workspaceId: 'w1', folders: [{ folderId: F1, title: '研究', sessionIds: ['s2'] }] }])
    fireEvent.click(screen.getByRole('button', { name: '文件夹“研究”的操作' }))
    fireEvent.click(screen.getByRole('button', { name: '删除文件夹' }))
    fireEvent.click(screen.getAllByRole('button', { name: '删除文件夹' }).at(-1))
    await waitFor(() => expect(fixture.writes).toEqual([{ kind: 'delete', workspaceId: 'w1', folderId: F1 }]))
    await waitFor(() => expect(screen.queryByText('研究')).toBeNull())
  })
})
