/**
 * The sidebar category browsing region: Workspaces hold user-named category
 * Topics, each listing its member Sessions, plus one Uncategorized bucket per
 * Workspace account. Registration shadows the native Workspace browser in the
 * `sidebar.workspaces` hole (see client/index.ts); the sidebar-foot toggle
 * restores the native browser by disposing that registration.
 */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactElement } from 'react'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import type { WorkspaceSnapshot } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { SidebarSectionOwnerProps } from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { ResearchTopic, ResearchTopicWrite } from '../research-topic.ts'
import {
  deriveCategoryTree, NO_WORKSPACE_KEY, UNASSIGNED_KEY,
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
}

/** Composed props of the category browsing region. */
export type CategoryBrowserProps =
  SidebarSectionOwnerProps
  & InjectFace<CategoryBrowserInjected>
  & PropsLocale<'sessionGraph'>

const COLLAPSED_KEY = 'sessionGraph.categoryView.collapsed'

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
    <button type="button" className={styles.rowButton} disabled={props.busy || value.trim() === ''} onClick={commit}>
      {props.submitLabel}
    </button>
    <button type="button" className={styles.rowButton} disabled={props.busy} onClick={props.onCancel}>
      {props.cancelLabel}
    </button>
  </div>
}

/** The inline add-to-category picker opened from an uncategorized row. */
function AddPicker(props: {
  readonly categories: readonly CategoryNode[]
  readonly emptyLabel: string
  readonly busy: boolean
  readonly onPick: (topicId: string) => void
  readonly onClose: () => void
}): ReactElement {
  return <div className={styles.addPicker} role="menu">
    {props.categories.length === 0 ? <span className={styles.addPickerEmpty}>{props.emptyLabel}</span>
      : props.categories.map(category => <button
        key={category.topicId}
        type="button"
        role="menuitem"
        className={styles.addPickerItem}
        disabled={props.busy}
        onClick={() => props.onPick(category.topicId)}
      >
        {category.title}
      </button>)}
    <button type="button" role="menuitem" className={styles.addPickerItem} onClick={props.onClose}>
      ×
    </button>
  </div>
}

function SessionRow(props: {
  readonly row: CategorySessionRow
  readonly removeLabel: string
  readonly unavailableLabel: string
  readonly busy: boolean
  readonly onOpen: (sessionId: string) => void
  readonly onRemove?: (sessionId: string) => void
  readonly actions?: ReactElement
}): ReactElement {
  const openable = props.row.listed && !props.row.archived
  return <li className={styles.sessionRow}>
    <button
      type="button"
      className={[
        styles.sessionButton,
        props.row.current ? styles.sessionCurrent : '',
        props.row.listed ? '' : styles.sessionGhost,
      ].join(' ')}
      disabled={!openable}
      title={props.row.listed ? undefined : props.unavailableLabel}
      onClick={() => { if (openable) props.onOpen(props.row.sessionId) }}
    >
      <span className={styles.sessionDot} data-running={props.row.running ? 'true' : 'false'} aria-hidden="true" />
      <span className={styles.sessionTitle}>{props.row.title}</span>
    </button>
    {props.onRemove !== undefined
      ? <button
        type="button"
        className={styles.rowButton}
        disabled={props.busy}
        aria-label={props.removeLabel}
        onClick={() => props.onRemove?.(props.row.sessionId)}
      >×</button>
      : null}
    {props.actions ?? null}
  </li>
}

function CategoryGroup(props: {
  readonly category: CategoryNode
  readonly t: CategoryBrowserProps['t']
  readonly busy: boolean
  readonly collapsed: boolean
  readonly renaming: boolean
  readonly confirmingDelete: boolean
  readonly onToggle: () => void
  readonly onOpen: (sessionId: string) => void
  readonly onRemoveSession: (sessionId: string) => void
  readonly onRenameSubmit: (title: string) => void
  readonly onRenameCancel: () => void
  readonly onRenameOpen: () => void
  readonly onDelete: () => void
}): ReactElement {
  return <li className={styles.category}>
    {props.renaming ? <TitleInput
      initial={props.category.title}
      placeholder={props.category.title}
      submitLabel={props.t('category.save')}
      cancelLabel={props.t('category.cancel')}
      busy={props.busy}
      onSubmit={props.onRenameSubmit}
      onCancel={props.onRenameCancel}
    /> : <div className={styles.categoryHeader}>
      <button
        type="button"
        className={styles.categoryToggle}
        aria-expanded={!props.collapsed}
        onClick={props.onToggle}
      >
        <span className={styles.disclosure} data-collapsed={props.collapsed ? 'true' : 'false'} aria-hidden="true">▸</span>
        <span className={styles.categoryTitle}>{props.category.title}</span>
        <span className={styles.categoryCount}>{props.category.sessions.length}</span>
      </button>
      <button type="button" className={styles.rowButton} disabled={props.busy} title={props.t('category.rename')} onClick={props.onRenameOpen}>✎</button>
      <button
        type="button"
        className={props.confirmingDelete ? styles.rowButtonDanger : styles.rowButton}
        disabled={props.busy}
        title={props.confirmingDelete ? props.t('category.deleteConfirm') : props.t('category.delete')}
        onClick={props.onDelete}
      >×</button>
    </div>}
    {!props.collapsed && props.category.sessions.length > 0 ? <ul className={styles.sessionList}>
      {props.category.sessions.map(row => <SessionRow
        key={row.sessionId}
        row={row}
        removeLabel={props.t('category.removeSession')}
        unavailableLabel={props.t('category.unavailable')}
        busy={props.busy}
        onOpen={props.onOpen}
        onRemove={props.onRemoveSession}
      />)}
    </ul> : null}
  </li>
}

/**
 * Render the category browsing region.
 * @param props - composed props (owner share, inject face, locale seat).
 * @returns the region element for the sidebar's browsing hole.
 */
export function CategoryBrowser(props: CategoryBrowserProps): ReactElement {
  const sessions = useSyncExternalStore(props.sources.sessions.subscribe, props.sources.sessions.getSnapshot)
  const workspaces = useSyncExternalStore(props.sources.workspaces.subscribe, props.sources.workspaces.getSnapshot)
  const [topics, setTopics] = useState<readonly ResearchTopic[]>([])
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [busy, setBusy] = useState(false)
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => readCollapsed())
  const [creatingIn, setCreatingIn] = useState<string | undefined>(undefined)
  const [renaming, setRenaming] = useState<string | undefined>(undefined)
  const [deleting, setDeleting] = useState<string | undefined>(undefined)
  const [pickerFor, setPickerFor] = useState<string | undefined>(undefined)

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

  const run = useCallback(async (request: ResearchTopicWrite): Promise<void> => {
    setBusy(true)
    try {
      await props.topics.write(request, lifecycle.current.signal)
      setTopics(await props.topics.list(lifecycle.current.signal))
      setRenaming(undefined)
      setDeleting(undefined)
      setPickerFor(undefined)
      setCreatingIn(undefined)
    } catch (error) {
      if (!lifecycle.current.signal.aborted) console.warn('category write failed:', error)
    } finally {
      setBusy(false)
    }
  }, [props])

  const tree = useMemo(() => deriveCategoryTree(
    topics,
    workspaces.items,
    sessions,
    { archivedSessionIds: workspaces.archivedSessionIds },
  ), [topics, workspaces, sessions])

  const toggle = useCallback((key: string): void => {
    setCollapsed(previous => {
      const next = new Set(previous)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      writeCollapsed(next)
      return next
    })
  }, [])

  const openSession = useCallback((sessionId: string): void => {
    props.openSession(sessionId)
  }, [props])

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
        <span className={styles.disclosure} aria-hidden="true">▦</span>
      </button>
    </div>
  }

  return <section className={styles.browser} aria-label={props.t('category.browserTitle')}>
    <header className={styles.header}>
      <h2 className={styles.headerTitle}>{props.t('category.browserTitle')}</h2>
      <button
        type="button"
        className={styles.nativeToggle}
        title={props.t('category.toggle.disable')}
        aria-label={props.t('category.toggle.disable')}
        onClick={() => { setCategoryView(false) }}
      >↩</button>
    </header>
    <div className={styles.body}>
      {loadState === 'error' ? <div className={styles.notice}>
        <span>{props.t('category.loadError')}</span>
        <button
          type="button"
          className={styles.rowButton}
          onClick={() => { void props.topics.list(lifecycle.current.signal)
            .then(result => { setTopics(result); setLoadState('ready') })
            .catch(() => { setLoadState('error') }) }}
        >{props.t('category.retry')}</button>
      </div> : null}
      {loadState !== 'error' && tree.sections.length === 0 && loadState === 'ready' ? <p className={styles.notice}>
        {props.t('category.empty')}
      </p> : null}
      <ul className={styles.sectionList}>
        {tree.sections.map(section => {
          const sectionCollapsed = collapsed.has(section.key)
          const categories = section.categories
          const uncategorized = section.uncategorized
          return <li key={section.key} className={styles.section}>
            <div className={styles.sectionHeader}>
              <button
                type="button"
                className={styles.sectionToggle}
                aria-expanded={!sectionCollapsed}
                onClick={() => toggle(section.key)}
              >
                <span className={styles.disclosure} data-collapsed={sectionCollapsed ? 'true' : 'false'} aria-hidden="true">▸</span>
                <span className={styles.sectionTitle}>{sectionLabel(section)}</span>
                <span className={styles.sectionCount}>
                  {props.t('category.count', { n: categories.length + uncategorized.length })}
                </span>
              </button>
              {section.workspaceId !== undefined ? <>
                <button
                  type="button"
                  className={styles.rowButton}
                  disabled={busy}
                  title={props.t('category.newCategory')}
                  onClick={() => { setCreatingIn(section.key); setRenaming(undefined) }}
                >＋</button>
                <button
                  type="button"
                  className={styles.rowButton}
                  disabled={busy}
                  title={props.t('category.newSession')}
                  onClick={() => { props.startSession(section.workspaceId) }}
                >✚</button>
              </> : null}
            </div>
            {!sectionCollapsed ? <>
              {creatingIn === section.key ? <TitleInput
                initial=""
                placeholder={props.t('category.namePlaceholder')}
                submitLabel={props.t('category.create')}
                cancelLabel={props.t('category.cancel')}
                busy={busy}
                onSubmit={title => {
                  void run({
                    kind: 'create',
                    topicId: crypto.randomUUID(),
                    title,
                    ...(section.workspaceId === undefined ? {} : { workspaceId: section.workspaceId }),
                  })
                }}
                onCancel={() => { setCreatingIn(undefined) }}
              /> : null}
              {categories.length === 0 && creatingIn !== section.key && uncategorized.length === 0
                ? <p className={styles.sectionEmpty}>{props.t('category.empty')}</p>
                : null}
              <ul className={styles.categoryList}>
                {categories.map(category => <CategoryGroup
                  key={category.topicId}
                  category={category}
                  t={props.t}
                  busy={busy}
                  collapsed={collapsed.has(category.topicId)}
                  renaming={renaming === category.topicId}
                  confirmingDelete={deleting === category.topicId}
                  onToggle={() => toggle(category.topicId)}
                  onOpen={openSession}
                  onRemoveSession={sessionId => {
                    void run({ kind: 'remove', topicId: category.topicId, sessionId })
                  }}
                  onRenameSubmit={title => { void run({ kind: 'rename', topicId: category.topicId, title }) }}
                  onRenameCancel={() => { setRenaming(undefined) }}
                  onRenameOpen={() => { setRenaming(category.topicId); setCreatingIn(undefined) }}
                  onDelete={() => {
                    if (deleting === category.topicId) void run({ kind: 'delete', topicId: category.topicId })
                    else setDeleting(category.topicId)
                  }}
                />)}
              </ul>
              {uncategorized.length > 0 ? <div className={styles.uncategorized}>
                <div className={styles.uncategorizedTitle}>{props.t('category.uncategorized')}</div>
                <ul className={styles.sessionList}>
                  {uncategorized.map(row => {
                    const open = pickerFor === row.sessionId
                    return <SessionRow
                      key={row.sessionId}
                      row={row}
                      removeLabel={props.t('category.removeSession')}
                      unavailableLabel={props.t('category.unavailable')}
                      busy={busy}
                      onOpen={openSession}
                      actions={open ? <AddPicker
                        categories={categories}
                        emptyLabel={props.t('category.empty')}
                        busy={busy}
                        onPick={topicId => {
                          void run({ kind: 'add', topicId, sessionIds: [row.sessionId] })
                        }}
                        onClose={() => { setPickerFor(undefined) }}
                      /> : <button
                        type="button"
                        className={styles.rowButton}
                        disabled={busy}
                        aria-label={props.t('category.addSession')}
                        title={props.t('category.addSession')}
                        onClick={() => { setPickerFor(row.sessionId) }}
                      >＋</button>}
                    />
                  })}
                </ul>
              </div> : null}
            </> : null}
          </li>
        })}
      </ul>
    </div>
  </section>
}
