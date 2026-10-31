import {
  useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore,
  type DragEvent, type KeyboardEvent as ReactKeyboardEvent, type ReactElement,
} from 'react'
import {
  IconArchiveOutlineRegular, IconCloseOutlineRegular, IconEditOutlineRegular,
  IconEllipsisOutlineRegular, IconFlatListOutlineRegular, IconFolderCloseRegular, IconFolderOpenRegular,
  IconNewChatOutlineRegular, IconPinOutlineRegular,
  IconPlusOutlineRegular, IconSearchOutlineRegular, IconSlidersTwoOutlineRegular, IconTriangleRightFillRegular,
  Menu, type MenuEntry, relativeTime, StateDot, Tooltip,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import type { WorkspaceSnapshot } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { SidebarSectionOwnerProps } from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { SidebarCategoryWorkspace, SidebarCategoryWrite } from '../sidebar-category.ts'
import {
  currentAncestryKeys, deriveCategoryTree, searchCategoryNodes, searchCategoryTree, UNGROUPED_KEY,
  type CategoryNode, type CategorySection, type CategorySessionRow,
} from './category-tree.ts'
import styles from './CategoryBrowser.module.css'

export interface CategoryBrowserSource<T> {
  getSnapshot(): T
  subscribe(listener: () => void): () => void
}

export interface CategoryBrowserInjected {
  readonly sources: {
    readonly sessions: CategoryBrowserSource<SessionListState>
    readonly workspaces: CategoryBrowserSource<WorkspaceSnapshot>
  }
  readonly categories: {
    list(signal?: AbortSignal): Promise<readonly SidebarCategoryWorkspace[]>
    write(request: SidebarCategoryWrite, signal?: AbortSignal): Promise<SidebarCategoryWorkspace>
  }
  readonly openSession: (sessionId: string) => void
  readonly startSession: (workspaceId?: string) => void
  readonly pinSession: (sessionId: string) => Promise<void>
  readonly unpinSession: (sessionId: string) => Promise<void>
  readonly archiveSession: (sessionId: string) => Promise<void>
}

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
    if (raw === null) return new Set()
    const parsed: unknown = JSON.parse(raw)
    return new Set(Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [])
  } catch {
    return new Set()
  }
}

function hasCollapsedPreference(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) !== null
  } catch {
    return true
  }
}

function writeCollapsed(keys: ReadonlySet<string>): void {
  try {
    window.localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...keys]))
  } catch {
    return
  }
}

function readShowArchived(): boolean {
  try {
    return window.localStorage.getItem(ARCHIVED_KEY) === '1'
  } catch {
    return false
  }
}

function TimeLabel(props: { readonly updatedAt: number; readonly now: number; readonly t: Translate }): ReactElement {
  const time = relativeTime(props.updatedAt, props.now)
  return <span className={styles.rowTime}>{props.t(`time.${time.unit}`, { n: time.n })}</span>
}

function Highlight(props: { readonly text: string; readonly query: string }): ReactElement {
  const needle = props.query.trim().toLowerCase()
  if (needle === '') return <>{props.text}</>
  const index = props.text.toLowerCase().indexOf(needle)
  if (index < 0) return <>{props.text}</>
  return <>
    {props.text.slice(0, index)}
    <mark className={styles.searchMatch}>{props.text.slice(index, index + needle.length)}</mark>
    {props.text.slice(index + needle.length)}
  </>
}

function sessionLabel(row: CategorySessionRow, t: Translate): string {
  if (row.title !== '') return row.title
  return row.blank ? t('category.sessionNew') : t('category.sessionUntitled')
}

function Disclosure(props: { readonly collapsed: boolean }): ReactElement {
  return <span className={styles.disclosure} data-collapsed={props.collapsed ? 'true' : 'false'} aria-hidden="true">
    <IconTriangleRightFillRegular size={11} />
  </span>
}

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
  ><IconEllipsisOutlineRegular size={15} /></button>
}

function TitleInput(props: {
  readonly initial: string
  readonly placeholder: string
  readonly submitLabel: string
  readonly cancelLabel: string
  readonly busy: boolean
  readonly error: string | null
  readonly onSubmit: (title: string) => void
  readonly onCancel: () => void
}): ReactElement {
  const [value, setValue] = useState(props.initial)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])
  const commit = (): void => {
    const title = value.trim()
    if (title !== '') props.onSubmit(title)
  }
  return <div className={styles.editor} data-editor="true">
    <form
      className={styles.titleInputRow}
      onSubmit={event => { event.preventDefault(); commit() }}
    >
      <input
        ref={inputRef}
        className={styles.titleInput}
        value={value}
        placeholder={props.placeholder}
        disabled={props.busy}
        aria-label={props.placeholder}
        aria-invalid={props.error !== null}
        onChange={event => setValue(event.target.value)}
        onKeyDown={event => { if (event.key === 'Escape') props.onCancel() }}
      />
      <Tooltip label={props.submitLabel} side="bottom" delayMs={300}>
        <button type="submit" className={styles.actionButton} disabled={props.busy || value.trim() === ''} aria-label={props.submitLabel}>
          <span aria-hidden="true">✓</span>
        </button>
      </Tooltip>
      <Tooltip label={props.cancelLabel} side="bottom" delayMs={300}>
        <button type="button" className={styles.actionButton} disabled={props.busy} aria-label={props.cancelLabel} onClick={props.onCancel}>
          <IconCloseOutlineRegular size={15} />
        </button>
      </Tooltip>
    </form>
    {props.error !== null ? <p className={styles.editorError} role="alert">{props.error}</p> : null}
  </div>
}

interface Editing {
  readonly kind: 'create' | 'rename' | 'delete'
  readonly sectionKey: string
  readonly categoryId?: string
  readonly sessionId?: string
}

interface UndoMove {
  readonly workspaceId: string
  readonly sessionId: string
  readonly previousCategoryId?: string
  readonly label: string
}

const SESSION_DRAG_TYPE = 'application/x-dsh-sidebar-category'

interface DragSession {
  readonly workspaceId: string
  readonly sessionId: string
}

interface DropHandlers {
  readonly onDragOver: (event: DragEvent<HTMLElement>) => void
  readonly onDragLeave: (event: DragEvent<HTMLElement>) => void
  readonly onDrop: (event: DragEvent<HTMLElement>) => void
}

interface RowContext {
  readonly t: Translate
  readonly now: number
  readonly draggedSessionId: string | undefined
  readonly dropKey: string | undefined
  readonly openSession: (sessionId: string) => void
  readonly move: (section: CategorySection, sessionId: string, categoryId?: string) => void
  readonly archive: (sessionId: string) => void
  readonly pin: (sessionId: string, pinned: boolean) => void
  readonly beginCreate: (section: CategorySection, sessionId?: string) => void
  readonly dragStart: (section: CategorySection, row: CategorySessionRow) => void
  readonly dragEnd: () => void
  readonly dropTarget: (section: CategorySection, categoryId?: string) => DropHandlers
}

function assignableCategories(section: CategorySection, memberOf?: CategoryNode): readonly CategoryNode[] {
  return section.categories.filter(category => category.categoryId !== memberOf?.categoryId)
}

function SessionRow(props: {
  readonly row: CategorySessionRow
  readonly context: RowContext
  readonly section: CategorySection
  readonly memberOf?: CategoryNode
}): ReactElement {
  const { row, context } = props
  const [menuOpen, setMenuOpen] = useState(false)
  const openable = !row.archived
  const candidates = assignableCategories(props.section, props.memberOf)
  const moveTargets = [
    ...candidates.map(category => ({ id: `move:${category.categoryId}`, label: category.title })),
    { id: 'new-category', label: context.t('category.assignNew'), icon: <IconPlusOutlineRegular size={14} /> },
  ]
  const label = sessionLabel(row, context.t)
  return <li
    className={styles.treeRow + ' ' + styles.sessionRow
      + (row.current ? ` ${styles.rowCurrent}` : '')
      + (row.archived ? ` ${styles.rowArchived}` : '')
      + (context.draggedSessionId === row.sessionId ? ` ${styles.dragging}` : '')}
    data-session-id={row.sessionId}
    draggable={!row.archived && props.section.workspaceId !== undefined}
    onDragStart={event => {
      if (props.section.workspaceId === undefined) return
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData(SESSION_DRAG_TYPE, JSON.stringify({
        workspaceId: props.section.workspaceId, sessionId: row.sessionId,
      }))
      event.dataTransfer.setData('text/plain', label)
      context.dragStart(props.section, row)
    }}
    onDragEnd={context.dragEnd}
  >
    <button
      type="button"
      className={styles.sessionButton}
      data-nav="true"
      disabled={!openable}
      aria-current={row.current ? 'page' : undefined}
      aria-label={row.archived ? `${label} · ${context.t('category.archived')}` : label}
      title={label}
      onClick={() => { if (openable) context.openSession(row.sessionId) }}
    >
      <span className={styles.sessionStatus} aria-hidden="true">
        {row.running ? <StateDot state="ongoing" /> : row.archived ? <IconArchiveOutlineRegular size={13} />
          : row.pinned ? <IconPinOutlineRegular size={12} /> : null}
      </span>
      <span className={styles.sessionTitle}>{label}</span>
    </button>
    <span className={styles.trailing}>
      <TimeLabel updatedAt={row.updatedAt} now={context.now} t={context.t} />
      <span className={styles.rowActions}>
        <Menu
          open={menuOpen}
          portal
          closeOnPointerLeave
          onClose={() => { setMenuOpen(false) }}
          anchor={<MoreTrigger label={context.t('category.more')} open={menuOpen} onToggle={() => { setMenuOpen(value => !value) }} />}
          items={[
            { id: 'move-menu', label: context.t('category.assign'), icon: <IconPlusOutlineRegular size={14} />, submenu: moveTargets },
            ...(props.memberOf !== undefined ? [{ id: 'uncategorized', label: context.t('category.removeCurrent') } as MenuEntry] : []),
            { type: 'separator', id: 'pin-separator' },
            {
              id: 'pin',
              label: row.pinned ? context.t('category.unpin') : context.t('category.pin'),
              icon: <IconPinOutlineRegular size={14} />,
            },
            {
              id: 'archive',
              label: context.t('category.archive'),
              icon: <IconArchiveOutlineRegular size={14} />,
              disabled: row.archived,
            },
          ]}
          onSelect={id => {
            setMenuOpen(false)
            if (id === 'new-category') context.beginCreate(props.section, row.sessionId)
            else if (id === 'uncategorized') context.move(props.section, row.sessionId)
            else if (id === 'pin') context.pin(row.sessionId, row.pinned)
            else if (id === 'archive') context.archive(row.sessionId)
            else if (id.startsWith('move:')) context.move(props.section, row.sessionId, id.slice('move:'.length))
          }}
        />
      </span>
    </span>
  </li>
}

function CategoryGroup(props: {
  readonly category: CategoryNode
  readonly section: CategorySection
  readonly context: RowContext
  readonly collapsed: boolean
  readonly editing: Editing | undefined
  readonly editorError: string | null
  readonly busy: boolean
  readonly onToggle: () => void
  readonly onBeginRename: () => void
  readonly onRename: (title: string) => void
  readonly onBeginDelete: () => void
  readonly onDelete: () => void
  readonly onCancelEditing: () => void
}): ReactElement {
  const { category, context } = props
  const [menuOpen, setMenuOpen] = useState(false)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const renaming = props.editing?.kind === 'rename' && props.editing.categoryId === category.categoryId
  const deleting = props.editing?.kind === 'delete' && props.editing.categoryId === category.categoryId
  useEffect(() => { if (deleting) cancelRef.current?.focus() }, [deleting])
  const hasMembers = category.sessions.length > 0
  const dropHandlers = context.dropTarget(props.section, category.categoryId)
  if (deleting) {
    return <li className={styles.category} data-category-id={category.categoryId}>
      <div className={styles.confirmStrip}>
        <strong>{context.t('category.deleteConfirmNamed', { title: category.title })}</strong>
        <span>{context.t('category.deleteHint', { n: category.sessions.length })}</span>
        <div className={styles.confirmActions}>
          <button ref={cancelRef} type="button" className={styles.secondaryButton} onClick={props.onCancelEditing}>
            {context.t('category.cancel')}
          </button>
          <button type="button" className={styles.dangerButton} disabled={props.busy} onClick={props.onDelete}>
            {context.t('category.deleteCategory')}
          </button>
        </div>
      </div>
    </li>
  }
  return <li
    className={styles.category + (context.dropKey === category.categoryId ? ` ${styles.dropTarget}` : '')}
    data-category-id={category.categoryId}
    {...dropHandlers}
  >
    {renaming ? <TitleInput
      initial={category.title}
      placeholder={context.t('category.namePlaceholder')}
      submitLabel={context.t('category.save')}
      cancelLabel={context.t('category.cancel')}
      busy={props.busy}
      error={props.editorError}
      onSubmit={props.onRename}
      onCancel={props.onCancelEditing}
    /> : <div className={styles.treeRow + ' ' + styles.categoryHeader}>
      <button
        type="button"
        className={styles.foldButton} data-nav="true"
        aria-expanded={hasMembers ? !props.collapsed : undefined}
        onClick={hasMembers ? props.onToggle : undefined}
        onDoubleClick={props.onBeginRename}
      >
        {hasMembers ? <Disclosure collapsed={props.collapsed} /> : <span className={styles.disclosure} />}
        <span className={styles.categoryTitle} title={category.title}>{category.title}</span>
        {props.collapsed && category.sessions.some(row => row.current)
          ? <span className={styles.currentDescendant} data-current-descendant="true" aria-hidden="true" />
          : null}
      </button>
      <span className={styles.trailing}>
        <span className={styles.rowCount} aria-label={context.t('category.count', { n: category.sessions.length })}>
          {category.sessions.length}
        </span>
        <span className={styles.rowActions}>
          <Menu
            open={menuOpen}
            portal
            closeOnPointerLeave
            onClose={() => { setMenuOpen(false) }}
            anchor={<MoreTrigger label={context.t('category.more')} open={menuOpen} onToggle={() => { setMenuOpen(value => !value) }} />}
            items={[
              { id: 'rename', label: context.t('category.rename'), icon: <IconEditOutlineRegular size={14} /> },
              { id: 'delete', label: context.t('category.deleteCategory'), icon: <IconCloseOutlineRegular size={14} />, danger: true },
            ]}
            onSelect={id => {
              setMenuOpen(false)
              if (id === 'rename') props.onBeginRename()
              else if (id === 'delete') props.onBeginDelete()
            }}
          />
        </span>
      </span>
    </div>}
    {hasMembers ? <div className={styles.reveal} data-closed={props.collapsed}>
      <ul className={styles.sessionList}>
        {category.sessions.map(row => <SessionRow
          key={row.sessionId}
          row={row}
          context={context}
          section={props.section}
          memberOf={category}
        />)}
      </ul>
    </div> : null}
  </li>
}

function UncategorizedGroup(props: {
  readonly section: CategorySection
  readonly context: RowContext
  readonly collapsed: boolean
  readonly onToggle: () => void
}): ReactElement {
  const { section, context } = props
  const rows = section.uncategorized
  const key = `${section.key}:uncategorized`
  const dropHandlers = context.dropTarget(section)
  return <li className={styles.uncategorized + (context.dropKey === key ? ` ${styles.dropTarget}` : '')} {...dropHandlers}>
    <div className={styles.treeRow + ' ' + styles.categoryHeader}>
      <button type="button" className={styles.foldButton} data-nav="true" aria-expanded={!props.collapsed} onClick={props.onToggle}>
        <Disclosure collapsed={props.collapsed} />
        <span className={styles.categoryTitle}>{context.t('category.uncategorized')}</span>
        {props.collapsed && rows.some(row => row.current)
          ? <span className={styles.currentDescendant} data-current-descendant="true" aria-hidden="true" />
          : null}
      </button>
      <span className={styles.rowCount} aria-label={context.t('category.count', { n: rows.length })}>{rows.length}</span>
    </div>
    {rows.length > 0 ? <div className={styles.reveal} data-closed={props.collapsed}>
      <ul className={styles.sessionList}>
        {rows.map(row => <SessionRow key={row.sessionId} row={row} context={context} section={section} />)}
      </ul>
    </div> : null}
  </li>
}

function sectionLabel(section: CategorySection, t: Translate): string {
  if (section.key === UNGROUPED_KEY) return t('category.ungrouped')
  return section.label !== '' ? section.label : (section.cwd ?? section.key)
}

export function CategoryBrowser(props: CategoryBrowserProps): ReactElement {
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
  const [records, setRecords] = useState<readonly SidebarCategoryWorkspace[]>([])
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editorError, setEditorError] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => readCollapsed())
  const [showArchived, setShowArchived] = useState<boolean>(() => readShowArchived())
  const [search, setSearch] = useState('')
  const [searchActive, setSearchActive] = useState(0)
  const [editing, setEditing] = useState<Editing | undefined>(undefined)
  const [focusTarget, setFocusTarget] = useState<{ kind: 'category' | 'section'; key: string } | undefined>(undefined)
  const [undo, setUndo] = useState<UndoMove | undefined>(undefined)
  const [now, setNow] = useState(() => Date.now())
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [locateNonce, setLocateNonce] = useState(0)
  const [dragging, setDragging] = useState<DragSession | undefined>(undefined)
  const [dropKey, setDropKey] = useState<string | undefined>(undefined)
  const autoExpanded = useRef(false)
  const lifecycle = useRef(new AbortController())
  const bodyRef = useRef<HTMLDivElement>(null)
  const expandTimer = useRef<number | undefined>(undefined)

  const load = useCallback(async (): Promise<void> => {
    setLoadState('loading')
    try {
      const result = await props.categories.list(lifecycle.current.signal)
      setRecords(result)
      setLoadState('ready')
    } catch {
      if (!lifecycle.current.signal.aborted) setLoadState('error')
    }
  }, [props.categories])

  useEffect(() => {
    const controller = lifecycle.current
    void load()
    return () => { controller.abort() }
  }, [load])

  useEffect(() => {
    const timer = window.setInterval(() => { setNow(Date.now()) }, 60_000)
    return () => { window.clearInterval(timer) }
  }, [])

  useEffect(() => () => {
    if (expandTimer.current !== undefined) window.clearTimeout(expandTimer.current)
  }, [])

  useEffect(() => {
    if (dragging === undefined) return
    const cancel = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      if (expandTimer.current !== undefined) window.clearTimeout(expandTimer.current)
      setDragging(undefined)
      setDropKey(undefined)
    }
    window.addEventListener('keydown', cancel)
    return () => { window.removeEventListener('keydown', cancel) }
  }, [dragging])

  const run = useCallback(async (request: SidebarCategoryWrite): Promise<boolean> => {
    setBusy(true)
    setError(null)
    setEditorError(null)
    try {
      await props.categories.write(request, lifecycle.current.signal)
      setRecords(await props.categories.list(lifecycle.current.signal))
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
  }, [props.categories, props.t])

  const tree = useMemo(() => deriveCategoryTree(
    records,
    workspaces.items,
    sessions,
    {
      archivedSessionIds: workspaces.archivedSessionIds,
      pinnedSessionIds: workspaces.pinnedSessionIds,
      showArchived,
    },
  ), [records, workspaces, sessions, showArchived])

  const ancestry = useMemo(() => currentAncestryKeys(tree), [tree])
  const hits = useMemo(() => searchCategoryTree(tree, search), [tree, search])
  const categoryHits = useMemo(() => searchCategoryNodes(tree, search), [tree, search])
  const searchResultCount = categoryHits.length + hits.length
  const preferredSectionKey = tree.sections.find(section => ancestry.has(section.key))?.key ?? tree.sections[0]?.key
  const currentRow = useMemo(() => tree.sections.flatMap(section => [
    ...section.categories.flatMap(category => category.sessions),
    ...section.uncategorized,
  ]).find(row => row.current), [tree])

  useEffect(() => {
    if (autoExpanded.current || tree.sections.length === 0) return
    autoExpanded.current = true
    const hadPreference = hasCollapsedPreference()
    setCollapsed(previous => {
      const next = new Set(previous)
      if (!hadPreference) {
        for (const section of tree.sections) {
          if (section.key !== preferredSectionKey) next.add(section.key)
          for (const category of section.categories) {
            if (!ancestry.has(category.categoryId)) next.add(category.categoryId)
          }
        }
      }
      for (const key of ancestry) next.delete(key)
      writeCollapsed(next)
      return next
    })
  }, [tree.sections, ancestry, preferredSectionKey])

  useEffect(() => {
    if (editing === undefined) return
    const frame = window.requestAnimationFrame(() => {
      bodyRef.current?.querySelector('[data-editor="true"]')?.scrollIntoView({ block: 'nearest' })
    })
    return () => { window.cancelAnimationFrame(frame) }
  }, [editing])

  useEffect(() => {
    if (locateNonce === 0 || currentRow === undefined) return
    const frame = window.requestAnimationFrame(() => {
      const rows = bodyRef.current?.querySelectorAll('[data-session-id]') ?? []
      for (const row of rows) {
        if (row.getAttribute('data-session-id') === currentRow.sessionId) {
          row.scrollIntoView({ block: 'nearest' })
          row.querySelector('button')?.focus()
          break
        }
      }
    })
    return () => { window.cancelAnimationFrame(frame) }
  }, [locateNonce, currentRow, collapsed])

  useEffect(() => {
    if (focusTarget === undefined) return
    const frame = window.requestAnimationFrame(() => {
      const attribute = focusTarget.kind === 'category' ? 'data-category-id' : 'data-section-key'
      const rows = bodyRef.current?.querySelectorAll(`[${attribute}]`) ?? []
      for (const row of rows) {
        if (row.getAttribute(attribute) !== focusTarget.key) continue
        row.scrollIntoView({ block: 'nearest' })
        row.querySelector('button')?.focus()
        setFocusTarget(undefined)
        break
      }
    })
    return () => { window.cancelAnimationFrame(frame) }
  }, [focusTarget, collapsed, search, records])

  useEffect(() => {
    if (search.trim() === '' || searchResultCount === 0) return
    bodyRef.current?.querySelector(`[data-search-hit="${searchActive}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [searchActive, search, searchResultCount])

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
      return
    }
  }, [])

  const revealCategory = useCallback((section: CategorySection, categoryId: string): void => {
    setSearch('')
    setSearchActive(0)
    setCollapsed(previous => {
      const next = new Set(previous)
      next.delete(section.key)
      next.delete(categoryId)
      writeCollapsed(next)
      return next
    })
    setFocusTarget({ kind: 'category', key: categoryId })
  }, [])

  const activateSearchResult = useCallback((index: number): void => {
    if (index < 0 || index >= searchResultCount) return
    if (index < categoryHits.length) {
      const hit = categoryHits[index]!
      revealCategory(hit.section, hit.category.categoryId)
      return
    }
    const hit = hits[index - categoryHits.length]
    if (hit !== undefined) props.openSession(hit.row.sessionId)
  }, [categoryHits, hits, props.openSession, revealCategory, searchResultCount])

  const finishEditing = useCallback((target?: { kind: 'category' | 'section'; key: string }): void => {
    setEditing(undefined)
    setEditorError(null)
    setFocusTarget(target)
  }, [])

  const navigateTree = useCallback((event: ReactKeyboardEvent<HTMLUListElement>): void => {
    const target = event.target instanceof HTMLElement
      ? event.target.closest<HTMLButtonElement>('button[data-nav="true"]')
      : null
    if (target === null) return
    const expanded = target.getAttribute('aria-expanded')
    if (event.key === 'ArrowRight' && expanded === 'false') {
      event.preventDefault()
      target.click()
      return
    }
    if (event.key === 'ArrowLeft' && expanded === 'true') {
      event.preventDefault()
      target.click()
      return
    }
    const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button[data-nav="true"]')]
      .filter(button => !button.disabled && button.closest('[data-closed="true"]') === null)
    const index = buttons.indexOf(target)
    if (index < 0) return
    let next: number | undefined
    if (event.key === 'ArrowDown') next = Math.min(buttons.length - 1, index + 1)
    else if (event.key === 'ArrowUp') next = Math.max(0, index - 1)
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = buttons.length - 1
    if (next === undefined || next === index) return
    event.preventDefault()
    buttons[next]?.focus()
  }, [])

  const beginCreate = useCallback((section: CategorySection, sessionId?: string): void => {
    if (section.workspaceId === undefined) return
    setCollapsed(previous => {
      const next = new Set(previous)
      next.delete(section.key)
      writeCollapsed(next)
      return next
    })
    setEditing({ kind: 'create', sectionKey: section.key, ...(sessionId === undefined ? {} : { sessionId }) })
    setEditorError(null)
    setError(null)
  }, [])

  const membership = useCallback((workspaceId: string, sessionId: string): string | undefined => records
    .find(record => record.workspaceId === workspaceId)?.categories
    .find(category => category.sessionIds.includes(sessionId))?.categoryId, [records])

  const showUndo = useCallback((value: UndoMove): void => {
    setUndo(value)
  }, [])

  const move = useCallback((section: CategorySection, sessionId: string, categoryId?: string): void => {
    if (section.workspaceId === undefined) return
    const workspaceId = section.workspaceId
    const previousCategoryId = membership(workspaceId, sessionId)
    if (previousCategoryId === categoryId) return
    void run({ kind: 'move', workspaceId, sessionId, ...(categoryId === undefined ? {} : { categoryId }) }).then(ok => {
      if (!ok) return
      const target = categoryId === undefined
        ? props.t('category.uncategorized')
        : section.categories.find(category => category.categoryId === categoryId)?.title ?? ''
      showUndo({
        workspaceId, sessionId,
        ...(previousCategoryId === undefined ? {} : { previousCategoryId }),
        label: props.t('category.moveSuccess', { title: target }),
      })
    })
  }, [membership, props.t, run, showUndo])

  const clearDrag = useCallback((): void => {
    if (expandTimer.current !== undefined) window.clearTimeout(expandTimer.current)
    expandTimer.current = undefined
    setDragging(undefined)
    setDropKey(undefined)
  }, [])

  const dragStart = useCallback((section: CategorySection, row: CategorySessionRow): void => {
    if (section.workspaceId === undefined) return
    setDragging({ workspaceId: section.workspaceId, sessionId: row.sessionId })
    setDropKey(undefined)
  }, [])

  const dropTarget = useCallback((section: CategorySection, categoryId?: string): DropHandlers => {
    const key = categoryId ?? `${section.key}:uncategorized`
    const valid = dragging !== undefined
      && dragging.workspaceId === section.workspaceId
      && membership(dragging.workspaceId, dragging.sessionId) !== categoryId
    const clearExpand = (): void => {
      if (expandTimer.current !== undefined) window.clearTimeout(expandTimer.current)
      expandTimer.current = undefined
    }
    return {
      onDragOver: event => {
        if (!valid) {
          event.dataTransfer.dropEffect = 'none'
          return
        }
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        setDropKey(previous => previous === key ? previous : key)
        const body = bodyRef.current
        if (body !== null) {
          const rect = body.getBoundingClientRect()
          if (event.clientY < rect.top + 32) body.scrollTop -= 12
          else if (event.clientY > rect.bottom - 32) body.scrollTop += 12
        }
        if (collapsed.has(key) && expandTimer.current === undefined) {
          expandTimer.current = window.setTimeout(() => {
            setCollapsed(previous => {
              const next = new Set(previous)
              next.delete(key)
              writeCollapsed(next)
              return next
            })
            expandTimer.current = undefined
          }, 600)
        }
      },
      onDragLeave: event => {
        const next = event.relatedTarget
        if (next instanceof Node && event.currentTarget.contains(next)) return
        clearExpand()
        setDropKey(previous => previous === key ? undefined : previous)
      },
      onDrop: event => {
        if (!valid || dragging === undefined) return
        event.preventDefault()
        event.stopPropagation()
        const sessionId = dragging.sessionId
        clearDrag()
        move(section, sessionId, categoryId)
      },
    }
  }, [collapsed, dragging, membership, move])

  const submitCreate = useCallback((section: CategorySection, title: string): void => {
    if (section.workspaceId === undefined || editing?.kind !== 'create') return
    if (section.categories.some(category => category.title.toLocaleLowerCase() === title.toLocaleLowerCase())) {
      setEditorError(props.t('category.nameExists'))
      return
    }
    const sessionId = editing.sessionId
    const categoryId = crypto.randomUUID()
    void run({
      kind: 'create', workspaceId: section.workspaceId, categoryId, title,
      ...(sessionId === undefined ? {} : { sessionId }),
    }).then(ok => { if (ok) finishEditing({ kind: 'category', key: categoryId }) })
  }, [editing, props.t, run, finishEditing])

  const submitRename = useCallback((section: CategorySection, categoryId: string, title: string): void => {
    if (section.workspaceId === undefined) return
    if (section.categories.some(category =>
      category.categoryId !== categoryId && category.title.toLocaleLowerCase() === title.toLocaleLowerCase())) {
      setEditorError(props.t('category.nameExists'))
      return
    }
    void run({ kind: 'rename', workspaceId: section.workspaceId, categoryId, title })
      .then(ok => { if (ok) finishEditing({ kind: 'category', key: categoryId }) })
  }, [props.t, run, finishEditing])

  const context: RowContext = useMemo(() => ({
    t: props.t,
    now,
    draggedSessionId: dragging?.sessionId,
    dropKey,
    openSession: props.openSession,
    move,
    archive: sessionId => {
      props.archiveSession(sessionId).catch(cause => {
        console.warn('archive failed:', cause)
        setError(props.t('category.writeError'))
      })
    },
    pin: (sessionId, pinned) => {
      (pinned ? props.unpinSession(sessionId) : props.pinSession(sessionId)).catch(cause => {
        console.warn('pin failed:', cause)
        setError(props.t('category.writeError'))
      })
    },
    beginCreate,
    dragStart,
    dragEnd: clearDrag,
    dropTarget,
  }), [props, now, move, beginCreate, dragging, dropKey, dragStart, clearDrag, dropTarget])

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
      <span className={styles.headerTitle}>{props.t('category.workspaces')}</span>
      <Menu
        open={optionsOpen}
        portal
        onClose={() => { setOptionsOpen(false) }}
        anchor={<button
          type="button"
          className={styles.actionButton}
          aria-label={props.t('category.more')}
          aria-haspopup="menu"
          aria-expanded={optionsOpen}
          onClick={() => { setOptionsOpen(value => !value) }}
        ><IconSlidersTwoOutlineRegular size={16} /></button>}
        items={[
          { id: 'locate', label: props.t('category.locateCurrent'), disabled: currentRow === undefined },
          { id: 'archived', label: showArchived ? props.t('category.hideArchived') : props.t('category.showArchived') },
        ]}
        onSelect={id => {
          setOptionsOpen(false)
          if (id === 'archived') flipShowArchived(!showArchived)
          if (id === 'locate') {
            setSearch('')
            setCollapsed(previous => {
              const next = new Set(previous)
              for (const key of ancestry) next.delete(key)
              writeCollapsed(next)
              return next
            })
            setLocateNonce(value => value + 1)
          }
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
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={search.trim() !== ''}
        aria-controls="category-search-results"
        aria-activedescendant={search.trim() !== '' && searchResultCount > 0 ? `category-search-hit-${searchActive}` : undefined}
        onChange={event => { setSearch(event.target.value); setSearchActive(0) }}
        onKeyDown={event => {
          if (event.key === 'Escape') {
            setSearch('')
            setSearchActive(0)
          } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            if (searchResultCount === 0) return
            event.preventDefault()
            setSearchActive(previous => event.key === 'ArrowDown'
              ? Math.min(searchResultCount - 1, previous + 1)
              : Math.max(0, previous - 1))
          } else if (event.key === 'Enter' && searchResultCount > 0) {
            event.preventDefault()
            activateSearchResult(searchActive)
          }
        }}
      />
      {search !== '' ? <button
        type="button"
        className={styles.actionButton}
        aria-label={props.t('category.cancel')}
        onClick={() => { setSearch(''); setSearchActive(0) }}
      ><IconCloseOutlineRegular size={14} /></button> : null}
    </div>
    {error !== null ? <div className={styles.errorBanner} role="alert">
      <span className={styles.errorText}>{error}</span>
      <button type="button" className={styles.actionButton} aria-label={props.t('category.cancel')} onClick={() => { setError(null) }}>
        <IconCloseOutlineRegular size={14} />
      </button>
    </div> : null}
    {undo !== undefined ? <div className={styles.undoBanner} role="status">
      <span>{undo.label}</span>
      <button type="button" onClick={() => {
        void run({
          kind: 'move', workspaceId: undo.workspaceId, sessionId: undo.sessionId,
          ...(undo.previousCategoryId === undefined ? {} : { categoryId: undo.previousCategoryId }),
        }).then(ok => { if (ok) setUndo(undefined) })
      }}>{props.t('category.undo')}</button>
      <button type="button" className={styles.actionButton} aria-label={props.t('category.cancel')} onClick={() => { setUndo(undefined) }}>
        <IconCloseOutlineRegular size={13} />
      </button>
    </div> : null}
    <div className={styles.body} ref={bodyRef}>
      {loadState === 'loading' ? <p className={styles.notice}>{props.t('category.loading')}</p> : null}
      {loadState === 'error' ? <div className={styles.notice}>
        <span>{props.t('category.loadError')}</span>
        <button type="button" className={styles.secondaryButton} onClick={() => { void load() }}>{props.t('category.retry')}</button>
      </div> : null}
      {loadState === 'ready' && tree.sections.length === 0 ? <p className={styles.notice}>{props.t('category.noWorkspaces')}</p> : null}
      {search.trim() !== '' ? <ul id="category-search-results" className={styles.resultList} role="listbox" aria-label={props.t('category.search')}>
        {searchResultCount === 0 ? <li className={styles.notice}>{props.t('category.searchEmpty')}</li> : null}
        {categoryHits.map((hit, index) => <li key={hit.category.categoryId} className={styles.resultCategory}>
          <button
            type="button"
            id={`category-search-hit-${index}`}
            data-search-hit={index}
            data-active={searchActive === index ? 'true' : 'false'}
            role="option"
            aria-selected={searchActive === index}
            onMouseEnter={() => { setSearchActive(index) }}
            onClick={() => { revealCategory(hit.section, hit.category.categoryId) }}
          >
            <span className={styles.resultKind}>{props.t('category.resultCategory')}</span>
            <span className={styles.resultTitle}><Highlight text={hit.category.title} query={search} /></span>
            <span className={styles.rowCount}>{hit.category.sessions.length}</span>
            <span className={styles.breadcrumb}>{sectionLabel(hit.section, props.t)}</span>
          </button>
        </li>)}
        {hits.map((hit, localIndex) => {
          const index = categoryHits.length + localIndex
          return <li key={hit.row.sessionId} className={styles.resultRow + (hit.row.current ? ` ${styles.rowCurrent}` : '')}>
            <button
              type="button"
              id={`category-search-hit-${index}`}
              className={styles.sessionButton}
              data-search-hit={index}
              data-active={searchActive === index ? 'true' : 'false'}
              role="option"
              aria-selected={searchActive === index}
              disabled={hit.row.archived}
              aria-label={hit.row.archived
                ? `${sessionLabel(hit.row, props.t)} · ${props.t('category.archived')}`
                : sessionLabel(hit.row, props.t)}
              onMouseEnter={() => { setSearchActive(index) }}
              onClick={() => { if (!hit.row.archived) props.openSession(hit.row.sessionId) }}
            >
              <span className={styles.sessionStatus} aria-hidden="true">
                {hit.row.running ? <StateDot state="ongoing" /> : hit.row.archived ? <IconArchiveOutlineRegular size={13} />
                  : hit.row.pinned ? <IconPinOutlineRegular size={12} /> : null}
              </span>
              <span className={styles.sessionTitle} title={sessionLabel(hit.row, props.t)}>
                <Highlight text={sessionLabel(hit.row, props.t)} query={search} />
              </span>
              <TimeLabel updatedAt={hit.row.updatedAt} now={now} t={props.t} />
            </button>
            <span className={styles.breadcrumb}>
              {sectionLabel(hit.section, props.t)}{hit.category === undefined ? '' : ` · ${hit.category}`}
            </span>
          </li>
        })}
      </ul> : <ul className={styles.sectionList} aria-label={props.t('category.browserTitle')} onKeyDown={navigateTree}>
        {tree.sections.map(section => {
          const sectionCollapsed = collapsed.has(section.key)
          const creating = editing?.kind === 'create' && editing.sectionKey === section.key
          return <li key={section.key} className={styles.section} data-section-key={section.key}>
            <div className={styles.treeRow + ' ' + styles.sectionHeader}>
              <button type="button" className={styles.foldButton} data-nav="true" aria-expanded={!sectionCollapsed} onClick={() => { toggle(section.key) }}>
                <span
                  className={styles.workspaceMark + (ancestry.has(section.key) ? ` ${styles.workspaceMarkCurrent}` : '')}
                  aria-hidden="true"
                >
                  <span className={styles.workspaceFolder}>
                    {sectionCollapsed ? <IconFolderCloseRegular size={16} /> : <IconFolderOpenRegular size={16} />}
                  </span>
                  <span className={styles.workspaceDisclosure}><Disclosure collapsed={sectionCollapsed} /></span>
                </span>
                <span className={styles.sectionTitle} title={sectionLabel(section, props.t)}>{sectionLabel(section, props.t)}</span>
              </button>
              {section.workspaceId !== undefined ? <span className={styles.trailing}>
                <span className={styles.rowActions}>
                  <WorkspaceMenu
                    t={props.t}
                    onCreate={() => { beginCreate(section) }}
                    onNewSession={() => { props.startSession(section.workspaceId) }}
                  />
                </span>
              </span> : null}
            </div>
            <div className={styles.reveal} data-closed={sectionCollapsed}>
              <div>
                {creating ? <TitleInput
                  initial=""
                  placeholder={props.t('category.namePlaceholder')}
                  submitLabel={props.t('category.create')}
                  cancelLabel={props.t('category.cancel')}
                  busy={busy}
                  error={editorError}
                  onSubmit={title => { submitCreate(section, title) }}
                  onCancel={() => { finishEditing({ kind: 'section', key: section.key }) }}
                /> : null}
                {section.categories.length === 0 ? <>
                  <ul className={styles.sessionList + ' ' + styles.directSessions}>
                    {section.uncategorized.map(row => <SessionRow key={row.sessionId} row={row} context={context} section={section} />)}
                  </ul>
                </> : <ul className={styles.categoryList}>
                  {section.categories.map(category => <CategoryGroup
                    key={category.categoryId}
                    category={category}
                    section={section}
                    context={context}
                    collapsed={collapsed.has(category.categoryId)}
                    editing={editing}
                    editorError={editorError}
                    busy={busy}
                    onToggle={() => { toggle(category.categoryId) }}
                    onBeginRename={() => {
                      setEditing({ kind: 'rename', sectionKey: section.key, categoryId: category.categoryId })
                      setEditorError(null)
                    }}
                    onRename={title => { submitRename(section, category.categoryId, title) }}
                    onBeginDelete={() => {
                      setEditing({ kind: 'delete', sectionKey: section.key, categoryId: category.categoryId })
                      setEditorError(null)
                    }}
                    onDelete={() => {
                      if (section.workspaceId === undefined) return
                      void run({ kind: 'delete', workspaceId: section.workspaceId, categoryId: category.categoryId })
                        .then(ok => { if (ok) finishEditing({ kind: 'section', key: section.key }) })
                    }}
                    onCancelEditing={() => { finishEditing({ kind: 'category', key: category.categoryId }) }}
                  />)}
                  {section.uncategorized.length > 0 || dragging?.workspaceId === section.workspaceId
                    ? <UncategorizedGroup
                      section={section}
                      context={context}
                      collapsed={collapsed.has(`${section.key}:uncategorized`)}
                      onToggle={() => { toggle(`${section.key}:uncategorized`) }}
                    />
                    : null}
                </ul>}
              </div>
            </div>
          </li>
        })}
      </ul>}
    </div>
  </section>
}

function WorkspaceMenu(props: {
  readonly t: Translate
  readonly onCreate: () => void
  readonly onNewSession: () => void
}): ReactElement {
  const [open, setOpen] = useState(false)
  return <Menu
    open={open}
    portal
    closeOnPointerLeave
    onClose={() => { setOpen(false) }}
    anchor={<MoreTrigger label={props.t('category.more')} open={open} onToggle={() => { setOpen(value => !value) }} />}
    items={[
      { id: 'category', label: props.t('category.newCategory'), icon: <IconPlusOutlineRegular size={14} /> },
      { id: 'session', label: props.t('category.newSession'), icon: <IconNewChatOutlineRegular size={14} /> },
    ]}
    onSelect={id => {
      setOpen(false)
      if (id === 'category') props.onCreate()
      else if (id === 'session') props.onNewSession()
    }}
  />
}
