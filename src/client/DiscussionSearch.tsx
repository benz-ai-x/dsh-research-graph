import { useEffect, useLayoutEffect, useRef, useState, type ReactElement } from 'react'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { WorkspaceView } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { DiscussionSearchHit, DiscussionSearchResult, DiscussionSearchScope } from '../session-search.ts'
import type { GraphViewInjected } from './GraphView.tsx'
import type { SessionGraphKey } from './locales.ts'
import { SessionHistory } from './SessionHistory.tsx'
import { retainDialogFocus } from './dialog-focus.ts'
import styles from './GraphView.module.css'
import { useKnowledge } from './Knowledge.tsx'
import { KnowledgeSearch } from './KnowledgeSearch.tsx'
import { loadWorkingPosition, saveWorkingPosition } from './working-position.ts'

/** Search chooses a read-only source independently of the scope-bound canvas. */
export function DiscussionSearch({ initialType, initialScope, workspaces, search, read, open, onClose, onAddToTopic, workingKey, t }: {
  readonly initialType?: 'discussion' | 'knowledge' | undefined
  readonly workingKey?: string
  readonly initialScope: DiscussionSearchScope
  readonly workspaces: readonly WorkspaceView[]
  readonly search: GraphViewInjected['searchDiscussion']
  readonly read: GraphViewInjected['readSessionHistory']
  readonly open: GraphViewInjected['openSession']
  readonly onClose: () => void
  readonly onAddToTopic?: (id: SessionId) => void
  readonly t: (key: SessionGraphKey, params?: Record<string, unknown>) => string
}): ReactElement {
  const knowledge = useKnowledge()
  const [restored] = useState(() => loadWorkingPosition(workingKey))
  const [searchType, setSearchType] = useState<'discussion' | 'knowledge'>(initialType ?? restored.searchType ?? 'discussion')
  const [query, setQuery] = useState(restored.discussion?.query ?? '')
  const [scope, setScope] = useState(restored.discussion?.scope ?? initialScope)
  const [includeArchived, setIncludeArchived] = useState(restored.discussion?.includeArchived ?? false)
  useEffect(() => { saveWorkingPosition(workingKey, { searchType, discussion: { query, scope, includeArchived } }) },
    [workingKey, searchType, query, scope, includeArchived])
  const [result, setResult] = useState<DiscussionSearchResult>()
  const [selected, setSelected] = useState<DiscussionSearchHit>()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [canceled, setCanceled] = useState(false)
  const active = useRef<AbortController>()
  const retryCursor = useRef<string>()
  useEffect(() => () => { active.current?.abort() }, [])

  const invalidate = (): void => {
    active.current?.abort()
    setBusy(false)
    setFailed(false)
    setCanceled(false)
    setResult(undefined)
    setSelected(undefined)
    retryCursor.current = undefined
  }

  const scopeAvailable = scope.kind === 'all' || (scope.kind === 'workspace'
    ? workspaces.some(workspace => workspace.workspaceId === scope.workspaceId)
    : initialScope.kind === 'directory' && initialScope.cwd === scope.cwd)
  useLayoutEffect(() => {
    if (scopeAvailable) return
    invalidate()
    setScope(initialScope.kind === 'workspace' && !workspaces.some(workspace => workspace.workspaceId === initialScope.workspaceId)
      ? { kind: 'all' } : initialScope)
  }, [scopeAvailable, initialScope, workspaces])

  const run = async (cursor?: string): Promise<void> => {
    if (query.trim() === '') return
    active.current?.abort()
    const controller = new AbortController()
    active.current = controller
    setBusy(true)
    setFailed(false)
    setCanceled(false)
    retryCursor.current = cursor
    if (cursor === undefined) {
      setResult(undefined)
      setSelected(undefined)
    }
    try {
      const value = await search({ query, scope, includeArchived, ...(cursor === undefined ? {} : { cursor }) }, controller.signal)
      if (controller.signal.aborted) return
      if (value.kind !== 'results') setSelected(undefined)
      setResult(previous => cursor !== undefined && previous?.kind === 'results' && value.kind === 'results'
        ? { ...value, hits: [...previous.hits, ...value.hits] } : value)
    } catch {
      if (controller.signal.aborted) return
      setFailed(true)
    } finally {
      if (!controller.signal.aborted) setBusy(false)
    }
  }

  useEffect(() => { if (scopeAvailable && searchType === 'discussion' && restored.discussion?.query.trim()) void run() }, [])

  return (
    <section className={styles.searchOverlay} role="dialog" aria-modal="true" aria-label={t(searchType === 'knowledge' ? 'knowledge.search' : 'search.title')}
      onKeyDown={event => {
        if (event.key === 'Escape') { event.stopPropagation(); onClose() }
        retainDialogFocus(event)
      }}>
      <div className={styles.searchHeader}>
        <div><h2>{t(searchType === 'knowledge' ? 'knowledge.search' : 'search.title')}</h2><p>{t(searchType === 'knowledge' ? 'knowledge.searchDescription' : 'search.description')}</p></div>
        <button type="button" onClick={onClose}>{t('search.close')}</button>
      </div>
      {knowledge === undefined ? null : <div className={styles.searchTypes} role="group" aria-label={t('knowledge.searchType')}>
        {(['discussion', 'knowledge'] as const).map(type => <button type="button" key={type} aria-pressed={searchType === type}
          onClick={() => { invalidate(); setSearchType(type) }}>{t(type === 'discussion' ? 'knowledge.discussions' : 'knowledge.title')}</button>)}
      </div>}
      {searchType === 'knowledge' ? <KnowledgeSearch workingKey={workingKey} t={t} /> : <>
      <form className={styles.searchForm} onSubmit={event => { event.preventDefault(); void run() }}>
        <label className={styles.searchQuery}>{t('search.query')}
          <input autoFocus value={query} maxLength={256} placeholder={t('search.placeholder')}
            onChange={event => { invalidate(); setQuery(event.target.value) }} />
        </label>
        <label>{t('search.scope')}
          <select value={scope.kind === 'workspace' ? `workspace:${scope.workspaceId}` : scope.kind}
            onChange={event => {
              const value = event.target.value
              invalidate()
              setScope(value === 'all' ? { kind: 'all' }
                : value === 'directory' ? initialScope : { kind: 'workspace', workspaceId: value.slice(10) })
            }}>
            {initialScope.kind === 'directory' ? <option value="directory">{t('search.directory')}</option> : null}
            {workspaces.map(workspace => <option key={workspace.workspaceId} value={`workspace:${workspace.workspaceId}`}>{workspace.title}</option>)}
            <option value="all">{t('search.all')}</option>
          </select>
        </label>
        <label className={styles.searchArchive}><input type="checkbox" checked={includeArchived}
          onChange={event => { invalidate(); setIncludeArchived(event.target.checked) }} />{t('search.includeArchived')}</label>
        <button type="submit" disabled={busy || query.trim() === ''}>{t('search.submit')}</button>
        {busy ? <button type="button" onClick={() => { invalidate(); setCanceled(true) }}>{t('search.cancel')}</button> : null}
      </form>
      <div className={styles.searchStatus} role="status">
        {busy ? t('search.loading') : result?.kind === 'results'
          ? result.hits.length === 0 ? t('search.empty') : t('search.count', { count: result.hits.length })
          : result?.kind === 'disabled' ? t('search.disabled') : result?.kind === 'stale' ? t('search.stale')
          : canceled ? t('search.canceled') : failed ? '' : t('search.start')}
      </div>
      {result?.kind === 'stale' ? <div className={styles.searchNotice}>
        <button type="button" onClick={() => { void run() }}>{t('search.restart')}</button>
      </div> : null}
      {result?.kind === 'disabled' ? <div className={styles.searchNotice}>
        <p>{t('search.setup')}</p>
        <a href={t('search.setupUrl')} target="_blank" rel="noreferrer">{t('search.setupLink')}</a>
        <button type="button" onClick={() => { void run() }}>{t('search.restart')}</button>
      </div> : null}
      {failed ? <div className={styles.searchNotice} role="alert"><p>{t('search.error')}</p>
        <button type="button" onClick={() => { void run(retryCursor.current) }}>{t('search.retry')}</button>
      </div> : null}
      <div className={styles.searchBody}>
        <div className={styles.searchResults} aria-label={t('search.results')}>
          {result?.kind === 'results' ? result.hits.map(hit => (
            <button type="button" key={hit.sessionId} className={styles.searchHit}
              aria-label={t('search.read', { title: hit.title })} aria-pressed={selected?.sessionId === hit.sessionId}
              onClick={() => { setSelected(hit) }}>
              <strong>{hit.title}</strong>
              <span className={styles.searchMeta}>{hit.workspace?.title ?? hit.cwd ?? t('search.noWorkspace')}
                {hit.archived ? ` · ${t('search.archived')}` : ''}</span>
              <time className={styles.searchMeta} dateTime={new Date(hit.time).toISOString()}>{new Date(hit.time).toLocaleString()}</time>
              <span>{hit.snippet}</span>
            </button>
          )) : null}
          {result?.kind === 'results' && result.nextCursor !== undefined ? <button type="button" disabled={busy}
            onClick={() => { void run(result.nextCursor) }}>{t('search.more')}</button> : null}
        </div>
        <aside className={styles.searchInspector} aria-label={t('search.original')}>
          {selected === undefined ? <p className={styles.searchHint}>{t('search.select')}</p> : <>
            <div className={styles.searchSourceHeader}><h3>{selected.title}</h3>
              {onAddToTopic === undefined ? null : <button type="button" onClick={() => { onAddToTopic(selected.sessionId as SessionId) }}>{t('topic.add')}</button>}
              <button type="button" onClick={() => { open(selected.sessionId as SessionId) }}>{t('panel.open')}</button>
            </div>
            <p className={styles.searchMeta}>{t('search.snapshot')}</p>
            <SessionHistory key={`${selected.sessionId}:${selected.eventSeq}`} sessionId={selected.sessionId}
              anchorSeq={selected.turnStartSeq} highlightSeq={selected.eventSeq} read={read} t={t} />
          </>}
        </aside>
      </div>
      </>}
    </section>
  )
}
