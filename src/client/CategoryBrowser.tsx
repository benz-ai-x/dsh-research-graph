/**
 * The sidebar category browsing region: Workspaces hold user-named category
 * Topics, each listing its member Sessions, plus one Uncategorized bucket per
 * Workspace account. Reading stays chrome-free — actions reveal on row hover
 * and live in host Menu popovers (assign submenu, pin, archive) — and the
 * rows reuse the native grammar: StateDot, relative time, tree roles, and a
 * brand bar marking the groups containing the current Session. Registration
 * shadows the native Workspace browser in the `sidebar.workspaces` hole; the
 * sidebar-foot toggle restores it (see client/index.ts).
 */
import {
  useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactElement,
} from 'react'
import {
  IconArchiveOutlineRegular, IconCloseOutlineRegular, IconEditOutlineRegular, IconEllipsisOutlineRegular,
  IconFlatListOutlineRegular, IconNewChatOutlineRegular, IconPinOutlineRegular, IconPlusOutlineRegular,
  IconSearchOutlineRegular, IconTriangleRightFillRegular, Menu, type MenuEntry,
  relativeTime, StateDot, Tooltip,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import type { WorkspaceSnapshot } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { SidebarSectionOwnerProps } from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { ResearchTopic, ResearchTopicWrite } from '../research-topic.ts'
import {
  currentAncestryKeys, deriveCategoryTree, searchCategoryTree,
  NO_WORKSPACE_KEY, UNASSIGNED_KEY,
  type CategoryNode, type CategorySection, type CategorySessionRow,
} from './category-tree.ts'
import { setCategoryView } from './category-toggle.ts'
import styles from './CategoryBrowser.module.css'

/** Minimal observable contract shared by the sessions and workspaces sources. */
export interface CategoryBrowserSource<T> {
  getSnapshot(): T
  subscribe(listener: () => void): () => void
}

/** Business face injected by the client registration. */
export interface CategoryBrowserInjected {
  readonly sources: {
    readonly sessions: CategoryBrowserSource<SessionListState>
    readonly workspaces: CategoryBrowserSource<WorkspaceSnapshot>
  }
  readonly topics: {
    list(signal?: AbortSignal): Promise<readonly ResearchTopic[]>
    write(request: ResearchTopicWrite, signal?: AbortSignal): Promise<ResearchTopic>
  }
  readonly openSession: (sessionId: string) => void
  readonly startSession: (workspaceId?: string) => void
  readonly pinSession: (sessionId: string) => Promise<void>
  readonly unpinSession: (sessionId: string) => Promise<void>
  readonly archiveSession: (sessionId: string) => Promise<void>
}

/** Composed props of the category browsing region. */
export type CategoryBrowserProps =
  SidebarSectionOwnerProps
  & InjectFace<CategoryBrowserInjected>
  & PropsLocale<'sessionGraph'>

type Translate = CategoryBrowserProps['t']

const COLLAPSED_KEY = 'sessionGraph.categoryView.collapsed'
const ARCHIVED_KEY = 'sessionGraph.categoryView.showArchived'

function readCollapsed(): Set<string> {
  try {
    const raw = window.localStorage.getItem(COLLAPSED_KEY)
    return raw === null ? new Set() : new Set(JSON.parse(raw) as unknown as string[])
  } catch {
    return new Set()
  }
}

function writeCollapsed(keys: ReadonlySet<string>): void {
  try {
    window.localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...keys]))
  } catch {
    // A blocked localStorage keeps the collapse state for this mount only.
  }
}

function readShowArchived(): boolean {
  try {
    return window.localStorage.getItem(ARCHIVED_KEY) === '1'
  } catch {
    return false
  }
}

/** Localized compact trailing time, bucketed exactly like the native rows. */
function TimeLabel(props: { readonly updatedAt: number; readonly now: number; readonly t: Translate }): ReactElement {
  const time = relativeTime(props.updatedAt, props.now)
  return <span className={styles.rowTime}>{props.t(`time.${time.unit}`, { n: time.n })}</span>
}

/** The chevron of one foldable row; rotates with the CSS transition. */
function Disclosure(props: { readonly collapsed: boolean }): ReactElement {
  return <span className={styles.disclosure} data-collapsed={props.collapsed ? 'true' : 'false'} aria-hidden="true">
    <IconTriangleRightFillRegular size={12} />
  </span>
}

/** One click-to-create rename-safe title input row. */
function TitleInput(props: {
  readonly initial: string
  readonly placeholder: string
  readonly submitLabel: string
  readonly cancelLabel: string
  readonly busy: boolean
  readonly onSubmit: (title: string) => void
  readonly onCancel: () => void
}): ReactElement {
  const [value, setValue] = useState(props.initial)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { inputRef.current?.focus() }, [])
  const commit = (): void => {
    const title = value.trim()
    if (title !== '') props.onSubmit(title)
  }
  return <div className={styles.titleInputRow}>
    <input
      ref={inputRef}
      className={styles.titleInput}
      value={value}
      placeholder={props.placeholder}
      disabled={props.busy}
      aria-label={props.placeholder}
      onChange={event => setValue(event.target.value)}
      onKeyDown={event => {
        if (event.key === 'Enter') commit()
        if (event.key === 'Escape') props.onCancel()
      }}
    />
    <button type="button" className={styles.ghostButton} disabled={props.busy || value.trim() === ''} onClick={commit}>
      {props.submitLabel}
    </button>
    <button type="button" className={styles.ghostButton} disabled={props.busy} onClick={props.onCancel}>
      {props.cancelLabel}
    </button>
  </div>
}

/** Editing intents the row components raise to the region owner. */
interface RowContext {
  readonly t: Translate
  readonly now: number
  readonly busy: boolean
  readonly pinned: ReadonlySet<string>
  readonly openSession: (sessionId: string) => void
  readonly removeMember: (topicId: string, sessionId: string) => void
  readonly archive: (sessionId: string) => void
  readonly pin: (sessionId: string, pinned: boolean) => void
  readonly assign: (topicId: string, sessionId: string) => void
  readonly beginAssignNew: (sessionId: string, sectionKey: string) => void
  readonly beginRename: (topicId: string) => void
  readonly submitRename: (topicId: string, title: string) => void
  readonly cancelEditing: () => void
  readonly beginDelete: (topicId: string) => void
  readonly confirmDelete: (topicId: string) => void
}

/** Assignable categories for one row: its own section's plus the unassigned. */
function assignableCategories(sections: readonly CategorySection[], sectionKey: string): readonly CategoryNode[] {
  const own = sections.find(section => section.key === sectionKey)?.categories ?? []
  const general = sections.find(section => section.key === UNASSIGNED_KEY)?.categories ?? []
  return [...own, ...general]
}

/** The ⋯ menu trigger button shared by every row kind. */
function MoreTrigger(props: {
  readonly label: string
  readonly open: boolean
  readonly onToggle: () => void
}): ReactElement {
  return <button
    type="button"
    className={styles.actionButton}
    aria-label={props.label}
    aria-haspopup="menu"
    aria-expanded={props.open}
    onClick={props.onToggle}
  ><IconEllipsisOutlineRegular size={14} /></button>
}

function SessionRow(props: {
  readonly row: CategorySessionRow
  readonly context: RowContext
  readonly sectionKey: string
  readonly memberOf?: CategoryNode
  readonly sections: readonly CategorySection[]
}): ReactElement {
  const { row, context } = props
  const [menuOpen, setMenuOpen] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const openable = row.listed && !row.archived
  const candidates = useMemo(
    () => assignableCategories(props.sections, props.sectionKey)
      .filter(category => category.topicId !== props.memberOf?.topicId),
    [props.sections, props.sectionKey, props.memberOf],
  )
  const assignTargets: readonly MenuEntry[] = [
    ...candidates.map(category => ({ id: `topic:${category.topicId}`, label: category.title })),
    { type: 'separator', id: 'assign-new-separator' },
    { id: 'assign-new', label: context.t('category.assignNew'), icon: <IconPlusOutlineRegular size={14} /> },
  ]
  return <li className={styles.treeRow + (row.current ? ` ${styles.rowCurrent}` : '')} role="treeitem">
    <button
      type="button"
      className={styles.sessionButton + (row.listed ? '' : ` ${styles.sessionGhost}`)}
      disabled={!openable}
      title={row.listed ? undefined : context.t('category.unavailable')}
      onClick={() => { if (openable) context.openSession(row.sessionId) }}
    >
      {row.listed ? <StateDot state={row.running ? 'ongoing' : 'idle'} /> : null}
      <span className={styles.sessionTitle}>{row.title}</span>
      {row.listed ? <TimeLabel updatedAt={row.updatedAt} now={context.now} t={context.t} /> : null}
    </button>
    <span className={styles.rowActions}>
      {props.memberOf !== undefined ? <Tooltip label={context.t('category.removeCurrent')} side="bottom" delayMs={400}>
        <button
          type="button"
          className={styles.actionButton}
          aria-label={context.t('category.removeCurrent')}
          onClick={() => { context.removeMember(props.memberOf!.topicId, row.sessionId) }}
        ><IconCloseOutlineRegular size={14} /></button>
      </Tooltip> : <Menu
        open={assignOpen}
        onClose={() => { setAssignOpen(false) }}
        anchor={<Tooltip label={context.t('category.assign')} side="bottom" delayMs={400}>
          <button
            type="button"
            className={styles.actionButton}
            aria-label={context.t('category.assign')}
            aria-haspopup="menu"
            aria-expanded={assignOpen}
            onClick={() => { setAssignOpen(value => !value) }}
          ><IconPlusOutlineRegular size={14} /></button>
        </Tooltip>}
        items={assignTargets}
        onSelect={id => {
          setAssignOpen(false)
          if (id === 'assign-new') context.beginAssignNew(row.sessionId, props.sectionKey)
          else if (id.startsWith('topic:')) context.assign(id.slice('topic:'.length), row.sessionId)
        }}
      />}
      <Menu
        open={menuOpen}
        onClose={() => { setMenuOpen(false) }}
        anchor={<MoreTrigger label={context.t('category.more')} open={menuOpen} onToggle={() => { setMenuOpen(value => !value) }} />}
        items={[
          ...(props.memberOf !== undefined
            ? [{ id: 'remove-current', label: context.t('category.removeCurrent') } as MenuEntry]
            : []),
          {
            id: 'assign',
            label: context.t('category.assign'),
            icon: <IconPlusOutlineRegular size={14} />,
            disabled: candidates.length === 0,
            submenu: candidates.map(category => ({ id: `topic:${category.topicId}`, label: category.title })),
          },
          { type: 'separator', id: 'pin-separator' },
          {
            id: 'pin',
            label: context.pinned.has(row.sessionId) ? context.t('category.unpin') : context.t('category.pin'),
            icon: <IconPinOutlineRegular size={14} />,
          },
          {
            id: 'archive',
            label: context.t('category.archive'),
            icon: <IconArchiveOutlineRegular size={14} />,
          },
        ]}
        onSelect={id => {
          setMenuOpen(false)
          if (id === 'remove-current' && props.memberOf !== undefined) {
            context.removeMember(props.memberOf.topicId, row.sessionId)
          } else if (id === 'pin') {
            context.pin(row.sessionId, context.pinned.has(row.sessionId))
          } else if (id === 'archive') {
            context.archive(row.sessionId)
          } else if (id.startsWith('topic:')) {
            context.assign(id.slice('topic:'.length), row.sessionId)
          }
        }}
      />
    </span>
  </li>
}

function CategoryGroup(props: {
  readonly category: CategoryNode
  readonly context: RowContext
  readonly collapsed: boolean
  readonly containsCurrent: boolean
  readonly renaming: boolean
  readonly confirmingDelete: boolean
  readonly sections: readonly CategorySection[]
  readonly sectionKey: string
  readonly onToggle: () => void
}): ReactElement {
  const { context } = props
  const [menuOpen, setMenuOpen] = useState(false)
  return <li className={styles.category + (props.containsCurrent ? ` ${styles.containsCurrent}` : '')}>
    {props.confirmingDelete ? <div className={styles.confirmStrip}>
      <span className={styles.confirmText}>{context.t('category.deleteConfirmTitle')}</span>
      <button
        type="button"
        className={styles.dangerButton}
        disabled={context.busy}
        onClick={() => { context.confirmDelete(props.category.topicId) }}
      >{context.t('category.delete')}</button>
      <button type="button" className={styles.ghostButton} onClick={() => { context.cancelEditing() }}>
        {context.t('category.cancel')}
      </button>
    </div> : props.renaming ? <TitleInput
      initial={props.category.title}
      placeholder={props.category.title}
      submitLabel={context.t('category.save')}
      cancelLabel={context.t('category.cancel')}
      busy={context.busy}
      onSubmit={title => { context.submitRename(props.category.topicId, title) }}
      onCancel={() => { context.cancelEditing() }}
    /> : <div className={styles.treeRow + ' ' + styles.categoryHeader} role="treeitem" aria-expanded={!props.collapsed}>
      <button
        type="button"
        className={styles.foldButton}
        aria-expanded={!props.collapsed}
        onDoubleClick={() => { context.beginRename(props.category.topicId) }}
        onClick={props.onToggle}
      >
        <Disclosure collapsed={props.collapsed} />
        <span className={styles.categoryTitle}>{props.category.title}</span>
        <span className={styles.rowCount}>{props.category.sessions.length}</span>
      </button>
      <span className={styles.rowActions}>
        <Menu
          open={menuOpen}
          onClose={() => { setMenuOpen(false) }}
          anchor={<MoreTrigger label={context.t('category.more')} open={menuOpen} onToggle={() => { setMenuOpen(value => !value) }} />}
          items={[
            { id: 'rename', label: context.t('category.rename'), icon: <IconEditOutlineRegular size={14} /> },
            {
              id: 'delete',
              label: context.t('category.deleteCategory'),
              icon: <IconCloseOutlineRegular size={14} />,
              danger: true,
            },
          ]}
          onSelect={id => {
            setMenuOpen(false)
            if (id === 'rename') context.beginRename(props.category.topicId)
            else if (id === 'delete') context.beginDelete(props.category.topicId)
          }}
        />
      </span>
    </div>}
    {!props.collapsed || props.category.sessions.length > 0 ? <div
      className={styles.reveal}
      data-closed={props.collapsed || props.category.sessions.length === 0}
    >
      <ul className={styles.groupList} role="group">
        {props.category.sessions.map(row => <SessionRow
          key={row.sessionId}
          row={row}
          context={context}
          sectionKey={props.sectionKey}
          memberOf={props.category}
          sections={props.sections}
        />)}
      </ul>
    </div> : null}
  </li>
}

/**
 * Render the category browsing region.
 * @param props - composed props (owner share, inject face, locale seat).
 * @returns the region element for the sidebar's browsing hole.
 */
export function CategoryBrowser(props: CategoryBrowserProps): ReactElement {
  // The service stores' methods read `this`; bound wrappers keep the identity
  // stable while useSyncExternalStore calls them detached.
  const sessionsSource = props.sources.sessions
  const workspacesSource = props.sources.workspaces
  const sessions = useSyncExternalStore(
    listener => sessionsSource.subscribe(listener),
    () => sessionsSource.getSnapshot(),
  )
  const workspaces = useSyncExternalStore(
    listener => workspacesSource.subscribe(listener),
    () => workspacesSource.getSnapshot(),
  )
  const [topics, setTopics] = useState<readonly ResearchTopic[]>([])
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => readCollapsed())
  const [showArchived, setShowArchived] = useState<boolean>(() => readShowArchived())
  const [search, setSearch] = useState('')
  const [creatingIn, setCreatingIn] = useState<string | undefined>(undefined)
  const [renaming, setRenaming] = useState<string | undefined>(undefined)
  const [deleting, setDeleting] = useState<string | undefined>(undefined)
  const [pendingAssign, setPendingAssign] = useState<{ sessionId: string; sectionKey: string } | undefined>(undefined)
  const [now, setNow] = useState(() => Date.now())
  const [optionsOpen, setOptionsOpen] = useState(false)
  const autoExpanded = useRef(false)
  const lifecycle = useRef(new AbortController())

  useEffect(() => {
    const controller = lifecycle.current
    const load = async (): Promise<void> => {
      setLoadState('loading')
      const result = await props.topics.list(controller.signal)
      setTopics(result)
      setLoadState('ready')
    }
    load().catch(() => { setLoadState('error') })
    return () => { controller.abort() }
    // Reload on demand only: writes refresh through run(), and the topic set
    // never changes from outside this region.
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => { setNow(Date.now()) }, 60_000)
    return () => { window.clearInterval(timer) }
  }, [])

  const run = useCallback(async (request: ResearchTopicWrite): Promise<boolean> => {
    setBusy(true)
    setError(null)
    try {
      await props.topics.write(request, lifecycle.current.signal)
      setTopics(await props.topics.list(lifecycle.current.signal))
      return true
    } catch (cause) {
      if (!lifecycle.current.signal.aborted) {
        console.warn('category write failed:', cause)
        setError(props.t('category.writeError'))
      }
      return false
    } finally {
      setBusy(false)
    }
  }, [props])

  const tree = useMemo(() => deriveCategoryTree(
    topics,
    workspaces.items,
    sessions,
    { archivedSessionIds: workspaces.archivedSessionIds, showArchived },
  ), [topics, workspaces, sessions, showArchived])

  const ancestry = useMemo(() => currentAncestryKeys(tree), [tree])
  const pinned = useMemo(() => new Set<string>(workspaces.pinnedSessionIds), [workspaces.pinnedSessionIds])
  const hits = useMemo(() => searchCategoryTree(tree, search), [tree, search])

  // First paint with sections: unfold the path to the current Session once.
  useEffect(() => {
    if (autoExpanded.current || tree.sections.length === 0) return
    autoExpanded.current = true
    if (ancestry.size === 0) return
    setCollapsed(previous => {
      const next = new Set(previous)
      let changed = false
      for (const key of ancestry) changed = next.delete(key) || changed
      if (!changed) return previous
      writeCollapsed(next)
      return next
    })
  }, [tree.sections, ancestry])

  const toggle = useCallback((key: string): void => {
    setCollapsed(previous => {
      const next = new Set(previous)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      writeCollapsed(next)
      return next
    })
  }, [])

  const flipShowArchived = useCallback((next: boolean): void => {
    setShowArchived(next)
    try {
      window.localStorage.setItem(ARCHIVED_KEY, next ? '1' : '0')
    } catch {
      // A blocked localStorage keeps the choice for this mount only.
    }
  }, [])

  // Successful edits settle their own intent state inside these flows; run()
  // deliberately leaves every editor open on failure so input is never lost.
  const settleRename = useCallback((topicId: string, title: string): void => {
    void run({ kind: 'rename', topicId, title }).then(ok => { if (ok) setRenaming(undefined) })
  }, [run])
  const settleCreate = useCallback((section: CategorySection, title: string, sessionId?: string): void => {
    const topicId = crypto.randomUUID()
    void run({
      kind: 'create',
      topicId,
      title,
      ...(section.workspaceId === undefined ? {} : { workspaceId: section.workspaceId }),
    }).then(ok => {
      if (!ok) return
      setCreatingIn(undefined)
      setPendingAssign(undefined)
      if (sessionId !== undefined) void run({ kind: 'add', topicId, sessionIds: [sessionId] })
    })
  }, [run])
  const settleDelete = useCallback((topicId: string): void => {
    void run({ kind: 'delete', topicId }).then(ok => { if (ok) setDeleting(undefined) })
  }, [run])

  const context: RowContext = useMemo(() => ({
    t: props.t,
    now,
    busy,
    pinned,
    openSession: props.openSession,
    removeMember: (topicId, sessionId) => { void run({ kind: 'remove', topicId, sessionId }) },
    archive: sessionId => {
      props.archiveSession(sessionId).catch(cause => {
        console.warn('archive failed:', cause)
        setError(props.t('category.writeError'))
      })
    },
    pin: (sessionId, isPinned) => {
      (isPinned ? props.unpinSession(sessionId) : props.pinSession(sessionId)).catch(cause => {
        console.warn('pin failed:', cause)
        setError(props.t('category.writeError'))
      })
    },
    assign: (topicId, sessionId) => { void run({ kind: 'add', topicId, sessionIds: [sessionId] }) },
    beginAssignNew: (sessionId, sectionKey) => { setPendingAssign({ sessionId, sectionKey }) },
    beginRename: topicId => { setRenaming(topicId); setCreatingIn(undefined); setDeleting(undefined) },
    submitRename: settleRename,
    cancelEditing: () => {
      setRenaming(undefined)
      setDeleting(undefined)
      setCreatingIn(undefined)
      setPendingAssign(undefined)
    },
    beginDelete: topicId => { setDeleting(topicId); setRenaming(undefined) },
    confirmDelete: settleDelete,
  }), [props, now, busy, pinned, run, settleRename, settleDelete])

  const sectionLabel = (section: CategorySection): string => {
    if (section.key === UNASSIGNED_KEY) return props.t('category.unassigned')
    if (section.key === NO_WORKSPACE_KEY) return props.t('category.noWorkspace')
    return section.label !== '' ? section.label : (section.cwd ?? section.key)
  }

  if (!props.wide) {
    return <div className={styles.rail}>
      <button
        type="button"
        className={styles.railButton}
        title={props.t('category.expand')}
        aria-label={props.t('category.expand')}
        onClick={props.expandSidebar}
      >
        <IconFlatListOutlineRegular size={16} />
      </button>
    </div>
  }

  return <section className={styles.browser} aria-label={props.t('category.browserTitle')}>
    <header className={styles.header}>
      <h2 className={styles.headerTitle}>{props.t('category.browserTitle')}</h2>
      <Menu
        open={optionsOpen}
        onClose={() => { setOptionsOpen(false) }}
        anchor={<MoreTrigger label={props.t('category.more')} open={optionsOpen} onToggle={() => { setOptionsOpen(value => !value) }} />}
        items={[
          { id: 'archived', label: showArchived ? props.t('category.hideArchived') : props.t('category.showArchived') },
          { type: 'separator', id: 'native-separator' },
          { id: 'native', label: props.t('category.toggle.disable'), icon: <IconFlatListOutlineRegular size={14} /> },
        ]}
        onSelect={id => {
          setOptionsOpen(false)
          if (id === 'archived') flipShowArchived(!showArchived)
          else if (id === 'native') setCategoryView(false)
        }}
      />
    </header>
    <div className={styles.searchRow}>
      <span className={styles.searchIcon} aria-hidden="true"><IconSearchOutlineRegular size={14} /></span>
      <input
        className={styles.searchInput}
        value={search}
        placeholder={props.t('category.search')}
        aria-label={props.t('category.search')}
        onChange={event => { setSearch(event.target.value) }}
        onKeyDown={event => { if (event.key === 'Escape') setSearch('') }}
      />
      {search !== '' ? <button
        type="button"
        className={styles.actionButton}
        aria-label={props.t('category.cancel')}
        onClick={() => { setSearch('') }}
      ><IconCloseOutlineRegular size={14} /></button> : null}
    </div>
    {error !== null ? <div className={styles.errorBanner} role="alert">
      <span className={styles.errorText}>{error}</span>
      <button
        type="button"
        className={styles.actionButton}
        aria-label={props.t('category.cancel')}
        onClick={() => { setError(null) }}
      ><IconCloseOutlineRegular size={14} /></button>
    </div> : null}
    <div className={styles.body}>
      {loadState === 'error' ? <div className={styles.notice}>
        <span>{props.t('category.loadError')}</span>
        <button
          type="button"
          className={styles.ghostButton}
          onClick={() => { void props.topics.list(lifecycle.current.signal)
            .then(result => { setTopics(result); setLoadState('ready') })
            .catch(() => { setLoadState('error') }) }}
        >{props.t('category.retry')}</button>
      </div> : null}
      {loadState === 'ready' && tree.sections.length === 0 ? <p className={styles.notice}>
        {props.t('category.noWorkspaces')}
      </p> : null}
      {search.trim() !== '' ? <ul className={styles.resultList} role="list">
        {hits.length === 0 ? <li className={styles.notice}>{props.t('category.searchEmpty')}</li> : null}
        {hits.map(hit => <li key={hit.row.sessionId} className={styles.treeRow + (hit.row.current ? ` ${styles.rowCurrent}` : '')}>
          <button
            type="button"
            className={styles.sessionButton}
            onClick={() => { props.openSession(hit.row.sessionId) }}
          >
            {hit.row.listed ? <StateDot state={hit.row.running ? 'ongoing' : 'idle'} /> : null}
            <span className={styles.sessionTitle}>{hit.row.title}</span>
            <TimeLabel updatedAt={hit.row.updatedAt} now={now} t={props.t} />
          </button>
          <span className={styles.breadcrumb}>
            {sectionLabel(hit.section)}{hit.category === undefined ? '' : ` · ${hit.category}`}
          </span>
        </li>)}
      </ul> : <ul className={styles.sectionList} role="tree" aria-label={props.t('category.browserTitle')}>
        {tree.sections.map(section => {
          const sectionCollapsed = collapsed.has(section.key)
          const { categories, uncategorized } = section
          return <li
            key={section.key}
            className={styles.section + (ancestry.has(section.key) ? ` ${styles.containsCurrent}` : '')}
            role="treeitem"
            aria-expanded={!sectionCollapsed}
          >
            <div className={styles.treeRow + ' ' + styles.sectionHeader}>
              <button
                type="button"
                className={styles.foldButton}
                aria-expanded={!sectionCollapsed}
                onClick={() => toggle(section.key)}
              >
                <Disclosure collapsed={sectionCollapsed} />
                <span className={styles.sectionTitle}>{sectionLabel(section)}</span>
                <span className={styles.rowCount}>
                  {props.t('category.count', { n: section.sessionCount })}
                </span>
              </button>
              {section.workspaceId !== undefined ? <span className={styles.rowActions}>
                <Tooltip label={props.t('category.newCategory')} side="bottom" delayMs={400}>
                  <button
                    type="button"
                    className={styles.actionButton}
                    aria-label={props.t('category.newCategory')}
                    onClick={() => { setCreatingIn(section.key); setRenaming(undefined) }}
                  ><IconPlusOutlineRegular size={14} /></button>
                </Tooltip>
                <Tooltip label={props.t('category.newSession')} side="bottom" delayMs={400}>
                  <button
                    type="button"
                    className={styles.actionButton}
                    aria-label={props.t('category.newSession')}
                    onClick={() => { props.startSession(section.workspaceId) }}
                  ><IconNewChatOutlineRegular size={14} /></button>
                </Tooltip>
              </span> : null}
            </div>
            <div className={styles.reveal} data-closed={sectionCollapsed}>
              <div>
                {creatingIn === section.key ? <TitleInput
                initial=""
                placeholder={props.t('category.namePlaceholder')}
                submitLabel={props.t('category.create')}
                cancelLabel={props.t('category.cancel')}
                busy={busy}
                onSubmit={title => { settleCreate(section, title) }}
                onCancel={() => { setCreatingIn(undefined) }}
              /> : null}
              {categories.length === 0 && creatingIn !== section.key && uncategorized.length > 0 ? <div className={styles.teachStrip}>
                <span className={styles.teachText}>{props.t('category.emptyTeach')}</span>
                <button
                  type="button"
                  className={styles.ghostButton}
                  onClick={() => { setCreatingIn(section.key) }}
                >{props.t('category.emptyNew')}</button>
              </div> : null}
              {categories.length > 0 ? <ul className={styles.groupList} role="group">
                {categories.map(category => <CategoryGroup
                  key={category.topicId}
                  category={category}
                  context={context}
                  collapsed={collapsed.has(category.topicId)}
                  containsCurrent={ancestry.has(category.topicId)}
                  renaming={renaming === category.topicId}
                  confirmingDelete={deleting === category.topicId}
                  sections={tree.sections}
                  sectionKey={section.key}
                  onToggle={() => toggle(category.topicId)}
                />)}
              </ul> : null}
              {uncategorized.length > 0 ? <div className={styles.uncategorized}>
                <div className={styles.uncategorizedTitle}>{props.t('category.uncategorized')} · {uncategorized.length}</div>
                <ul className={styles.groupList} role="group">
                  {uncategorized.map(row => pendingAssign !== undefined && pendingAssign.sessionId === row.sessionId
                    ? <li key={row.sessionId}>
                      <TitleInput
                        initial=""
                        placeholder={props.t('category.namePlaceholder')}
                        submitLabel={props.t('category.create')}
                        cancelLabel={props.t('category.cancel')}
                        busy={busy}
                        onSubmit={title => { settleCreate(section, title, row.sessionId) }}
                        onCancel={() => { setPendingAssign(undefined) }}
                      />
                    </li>
                    : <SessionRow
                      key={row.sessionId}
                      row={row}
                      context={context}
                      sectionKey={section.key}
                      sections={tree.sections}
                    />)}
                </ul>
              </div> : null}
              </div>
            </div>
          </li>
        })}
      </ul>}
    </div>
  </section>
}
