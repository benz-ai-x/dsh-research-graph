// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SidebarCategoryWorkspace, SidebarCategoryWrite } from '../src/sidebar-category.ts'
import { CategoryBrowser } from '../src/client/CategoryBrowser.tsx'
import { zh } from '../src/client/locales.ts'

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
    IconArchiveOutlineRegular: icon,
    IconCloseOutlineRegular: icon,
    IconEditOutlineRegular: icon,
    IconEllipsisOutlineRegular: icon,
    IconFlatListOutlineRegular: icon,
    IconNewChatOutlineRegular: icon,
    IconPinOutlineRegular: icon,
    IconPlusOutlineRegular: icon,
    IconSearchOutlineRegular: icon,
    IconTriangleRightFillRegular: icon,
    Menu: ({ open, anchor, items, onSelect }) => <div>{anchor}{open ? <div role="menu">{entries(items, onSelect)}</div> : null}</div>,
    relativeTime: () => ({ unit: 'day', n: 1 }),
    StateDot: () => <span aria-hidden="true" />,
    Tooltip: ({ children }) => <>{children}</>,
  }
})

const A = '1bb797e8-16ad-4d78-8f41-c0a5efaf8451'
const B = '2bb797e8-16ad-4d78-8f41-c0a5efaf8451'

function translate(key: string, params: Record<string, unknown> = {}): string {
  return Object.entries(params).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), zh[key] ?? key)
}

function moved(record: SidebarCategoryWorkspace, sessionId: string, categoryId?: string): SidebarCategoryWorkspace {
  return {
    ...record,
    categories: record.categories.map(category => ({
      ...category,
      sessionIds: category.categoryId === categoryId
        ? [...category.sessionIds.filter(id => id !== sessionId), sessionId]
        : category.sessionIds.filter(id => id !== sessionId),
    })),
  }
}

function applyWrite(record: SidebarCategoryWorkspace, request: SidebarCategoryWrite): SidebarCategoryWorkspace {
  if (request.kind === 'move') return moved(record, request.sessionId, request.categoryId)
  if (request.kind === 'delete') {
    return { ...record, categories: record.categories.filter(category => category.categoryId !== request.categoryId) }
  }
  if (request.kind === 'rename') {
    return {
      ...record,
      categories: record.categories.map(category => category.categoryId === request.categoryId
        ? { ...category, title: request.title }
        : category),
    }
  }
  const withCategory = record.categories.some(category => category.categoryId === request.categoryId)
    ? record
    : {
        ...record,
        categories: [...record.categories, { categoryId: request.categoryId, title: request.title, sessionIds: [] }],
      }
  return request.sessionId === undefined ? withCategory : moved(withCategory, request.sessionId, request.categoryId)
}

function fixture(withCategories = true) {
  let records: SidebarCategoryWorkspace[] = [{
    workspaceId: 'ws-a',
    categories: withCategories
      ? [
          { categoryId: A, title: '缓存', sessionIds: ['s1'] },
          { categoryId: B, title: '实验', sessionIds: ['s2'] },
        ]
      : [],
  }]
  const write = vi.fn(async (request: SidebarCategoryWrite) => {
    const current = records.find(record => record.workspaceId === request.workspaceId)
    if (current === undefined) throw new Error('Missing workspace')
    const next = applyWrite(current, request)
    records = records.map(record => record.workspaceId === next.workspaceId ? next : record)
    return next
  })
  const sessions = {
    ids: ['s1', 's2', 's3'],
    byId: {
      s1: { id: 's1', displayTitle: '方案 A：让响应更快', running: false, blank: false, updatedAt: 10, retainedBy: { mainView: 1 } },
      s2: { id: 's2', displayTitle: '新的方向：按风险组合缓存策略', running: false, blank: false, updatedAt: 9 },
      s3: { id: 's3', displayTitle: '另一个工作区的会话', running: false, blank: false, updatedAt: 8 },
    },
    current: undefined,
    phase: 'ready',
    projectionsBySession: {},
  }
  const workspaces = {
    items: [{
      workspaceId: 'ws-a', path: '/a', title: '研究体验空间', sessionIds: ['s1', 's2'],
      createdAt: '', updatedAt: '',
    }, {
      workspaceId: 'ws-b', path: '/b', title: '工作区 B', sessionIds: ['s3'],
      createdAt: '', updatedAt: '',
    }],
    archivedSessionIds: [],
    pinnedSessionIds: [],
  }
  const source = <T,>(value: T) => ({
    getSnapshot: () => value,
    subscribe: () => () => {},
  })
  return {
    props: {
      wide: true,
      expandSidebar: vi.fn(),
      sources: { sessions: source(sessions), workspaces: source(workspaces) },
      categories: {
        list: vi.fn(async () => records),
        write,
      },
      openSession: vi.fn(),
      startSession: vi.fn(),
      pinSession: vi.fn(async () => {}),
      unpinSession: vi.fn(async () => {}),
      archiveSession: vi.fn(async () => {}),
      t: translate,
    },
    write,
  }
}

function dataTransfer() {
  const values = new Map<string, string>()
  return {
    effectAllowed: '',
    dropEffect: '',
    setData: vi.fn((type: string, value: string) => { values.set(type, value) }),
    getData: vi.fn((type: string) => values.get(type) ?? ''),
  }
}

beforeEach(() => {
  window.localStorage.clear()
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('CategoryBrowser interactions', () => {
  it('shows direct Sessions without repeated Uncategorized or teaching rows when a Workspace has no categories', async () => {
    const { props } = fixture(false)
    render(<CategoryBrowser {...props} />)
    expect(await screen.findByRole('button', { name: '方案 A：让响应更快' })).toBeDefined()
    expect(screen.queryByText('未分类')).toBeNull()
    expect(screen.getAllByRole('button', { name: '新建分类，整理当前工作区' })).toHaveLength(1)
    expect(screen.getByRole('button', { name: '工作区 B' })).toBeDefined()
  })

  it('reserves the same status column for plain, pinned, and running Session titles', async () => {
    const { props } = fixture(false)
    props.sources.workspaces.getSnapshot().pinnedSessionIds = ['s2']
    props.sources.sessions.getSnapshot().byId.s3.running = true
    render(<CategoryBrowser {...props} />)
    await screen.findByRole('button', { name: '方案 A：让响应更快' })
    for (const sessionId of ['s1', 's2', 's3']) {
      const row = document.querySelector<HTMLElement>(`[data-session-id="${sessionId}"]`)!
      const button = within(row).getAllByRole('button')[0]!
      expect(button.firstElementChild?.className).toContain('sessionStatus')
      expect(button.firstElementChild?.childElementCount).toBe(sessionId === 's1' ? 0 : 1)
    }
  })

  it('expands a collapsed Workspace before showing its new-category editor', async () => {
    const { props } = fixture()
    render(<CategoryBrowser {...props} />)
    await waitFor(() => expect(screen.getByRole('button', { name: '工作区 B' }).getAttribute('aria-expanded')).toBe('false'))
    const section = document.querySelector<HTMLElement>('[data-section-key="ws-b"]')!
    const trigger = within(section).getAllByRole('button', { name: '更多操作' })[0]!
    fireEvent.click(trigger)
    fireEvent.click(await screen.findByRole('button', { name: '新建分类' }))
    expect(screen.getByRole('button', { name: '工作区 B' }).getAttribute('aria-expanded')).toBe('true')
    expect(section.querySelector('div[data-closed="true"]')).toBeNull()
    expect(await screen.findByRole('textbox', { name: '分类名称' })).toBeDefined()
  })

  it('moves a Session by drag and drop and undoes the move through the same Host command', async () => {
    const { props, write } = fixture()
    render(<CategoryBrowser {...props} />)
    await waitFor(() => expect(screen.getByRole('button', { name: '工作区 B' }).getAttribute('aria-expanded')).toBe('false'))
    const source = document.querySelector<HTMLElement>('[data-session-id="s1"]')!
    const transfer = dataTransfer()
    expect(source.isConnected).toBe(true)
    expect(source.getAttribute('draggable')).toBe('true')
    fireEvent.dragStart(source, { dataTransfer: transfer })
    expect(transfer.setData).toHaveBeenCalled()
    await waitFor(() => expect(document.querySelector<HTMLElement>('[data-session-id="s1"]')!.className).toContain('dragging'))
    const target = document.querySelector<HTMLElement>(`[data-category-id="${B}"]`)!
    fireEvent.dragOver(target, { dataTransfer: transfer, clientY: 100 })
    await waitFor(() => expect(document.querySelector<HTMLElement>(`[data-category-id="${B}"]`)!.className).toContain('dropTarget'))
    fireEvent.drop(document.querySelector<HTMLElement>(`[data-category-id="${B}"]`)!, { dataTransfer: transfer, clientY: 100 })
    await waitFor(() => expect(write).toHaveBeenCalledWith({
      kind: 'move', workspaceId: 'ws-a', sessionId: 's1', categoryId: B,
    }, expect.any(AbortSignal)))
    expect(await screen.findByText('已移动到“实验”')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: '撤销' }))
    await waitFor(() => expect(write).toHaveBeenCalledWith({
      kind: 'move', workspaceId: 'ws-a', sessionId: 's1', categoryId: A,
    }, expect.any(AbortSignal)))
  })

  it('creates and moves from the Session menu in one Host write', async () => {
    const { props, write } = fixture()
    render(<CategoryBrowser {...props} />)
    await waitFor(() => expect(screen.getByRole('button', { name: '工作区 B' }).getAttribute('aria-expanded')).toBe('false'))
    const source = document.querySelector<HTMLElement>('[data-session-id="s1"]')!
    const trigger = within(source).getByRole('button', { name: '更多操作' })
    fireEvent.click(trigger)
    await waitFor(() => expect(trigger.getAttribute('aria-expanded')).toBe('true'))
    fireEvent.click(await screen.findByRole('button', { name: '新建分类并移动…' }))
    fireEvent.change(screen.getByRole('textbox', { name: '分类名称' }), { target: { value: '性能验证' } })
    fireEvent.click(screen.getByRole('button', { name: '创建' }))
    await waitFor(() => expect(write).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'create', workspaceId: 'ws-a', title: '性能验证', sessionId: 's1',
    }), expect.any(AbortSignal)))
    const request = write.mock.calls[0][0]
    expect(request.kind).toBe('create')
  })

  it('finds a category with search keyboard navigation and restores focus to its tree row', async () => {
    const { props } = fixture()
    render(<CategoryBrowser {...props} />)
    await waitFor(() => expect(screen.getByRole('button', { name: '工作区 B' }).getAttribute('aria-expanded')).toBe('false'))
    const input = screen.getByRole('combobox', { name: '搜索会话或分类' })
    fireEvent.change(input, { target: { value: '实验' } })
    expect(await screen.findByText('实验', { selector: 'mark' })).toBeDefined()
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect((input as HTMLInputElement).value).toBe(''))
    await waitFor(() => expect(document.activeElement?.textContent).toBe('实验'))
    expect(screen.getByRole('button', { name: '实验' }).getAttribute('aria-expanded')).toBe('true')
  })

  it('moves focus and expands rows with arrow keys', async () => {
    const { props } = fixture()
    render(<CategoryBrowser {...props} />)
    await waitFor(() => expect(screen.getByRole('button', { name: '工作区 B' }).getAttribute('aria-expanded')).toBe('false'))
    const workspace = screen.getByRole('button', { name: '研究体验空间' })
    workspace.focus()
    fireEvent.keyDown(workspace, { key: 'ArrowDown' })
    expect(document.activeElement?.textContent).toBe('缓存')
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })
    expect(document.activeElement?.textContent).toBe('方案 A：让响应更快')
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })
    expect(document.activeElement?.textContent).toBe('实验')
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' })
    expect(screen.getByRole('button', { name: '实验' }).getAttribute('aria-expanded')).toBe('true')
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })
    expect(document.activeElement?.textContent).toBe('新的方向：按风险组合缓存策略')
  })

  it('explains that deleting a category only returns its Sessions to Uncategorized', async () => {
    const { props, write } = fixture()
    render(<CategoryBrowser {...props} />)
    await waitFor(() => expect(screen.getByRole('button', { name: '工作区 B' }).getAttribute('aria-expanded')).toBe('false'))
    const category = document.querySelector<HTMLElement>(`[data-category-id="${A}"]`)!
    const trigger = within(category).getAllByRole('button', { name: '更多操作' })[0]!
    fireEvent.click(trigger)
    await waitFor(() => expect(trigger.getAttribute('aria-expanded')).toBe('true'))
    fireEvent.click(await screen.findByRole('button', { name: '删除分类' }))
    expect(screen.getByText('删除“缓存”？')).toBeDefined()
    expect(screen.getByText('1 个会话将移回未分类，不会删除会话')).toBeDefined()
    await waitFor(() => expect(document.activeElement?.textContent).toBe('取消'))
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    await waitFor(() => expect(document.activeElement?.textContent).toBe('缓存'))
    expect(write).not.toHaveBeenCalled()
  })
})
