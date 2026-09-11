import { useEffect, useState } from 'react'
import type { ResearchRelation, ResearchRelationQuery } from '../research-relations.ts'
import type { ResearchReuseApi } from './research-reuse-remote.ts'

/** One metadata read per bounded batch, not one full journal read for every session. */
export async function readResearchRelations(api: ResearchReuseApi, query: ResearchRelationQuery, signal: AbortSignal): Promise<readonly ResearchRelation[]> {
  const keys = [...new Set(query.cardIds)].map(id => ({ card: true, id }))
    .concat([...new Set(query.sessionIds)].map(id => ({ card: false, id })))
  const records = new Map<string, ResearchRelation>()
  for (let start = 0; start < keys.length; start += 1000) {
    signal.throwIfAborted()
    const batch = keys.slice(start, start + 1000)
    const found = await api.relations({ cardIds: batch.filter(item => item.card).map(item => item.id),
      sessionIds: batch.filter(item => !item.card).map(item => item.id) }, signal)
    signal.throwIfAborted()
    for (const item of found) records.set(item.operationId, item)
  }
  return [...records.values()]
}

export function useResearchRelations(api: ResearchReuseApi, query: ResearchRelationQuery, revision: number): {
  readonly relations: readonly ResearchRelation[]
  readonly failed: boolean
  readonly loading: boolean
  readonly retry: () => void
} {
  const key = JSON.stringify(query)
  const [state, setState] = useState<{ key: string; relations: readonly ResearchRelation[]; failed: boolean; loading: boolean }>(
    { key, relations: [], failed: false, loading: true })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setState({ key, relations: [], failed: false, loading: true })
    void readResearchRelations(api, JSON.parse(key) as ResearchRelationQuery, controller.signal).then(relations => {
      if (!controller.signal.aborted) setState({ key, relations, failed: false, loading: false })
    }, () => {
      if (!controller.signal.aborted) setState({ key, relations: [], failed: true, loading: false })
    })
    return () => { controller.abort() }
  }, [api, key, revision, attempt])
  return { relations: state.key === key ? state.relations : [], failed: state.key === key && state.failed,
    loading: state.key !== key || state.loading, retry: () => { setAttempt(value => value + 1) } }
}
