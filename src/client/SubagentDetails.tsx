import { useEffect, useRef, useState, type ReactElement } from 'react'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { SessionGraphNode } from './graph-model.ts'
import type { SessionGraphKey } from './locales.ts'
import styles from './GraphView.module.css'

/** Inspect delegated work without adding Subagent Sessions to the canvas. */
export function SubagentDetails({ node, onOpen, t }: {
  readonly node: SessionGraphNode
  readonly onOpen: (parentId: SessionId, childId: SessionId, signal: AbortSignal) => Promise<void>
  readonly t: (key: SessionGraphKey, params?: Record<string, unknown>) => string
}): ReactElement | null {
  const active = useRef<AbortController>()
  const [opening, setOpening] = useState<SessionId>()
  const [failed, setFailed] = useState(false)
  useEffect(() => () => { active.current?.abort() }, [node.id])
  if (!node.subagents?.length) return null
  const open = (parentId: SessionId, childId: SessionId): void => {
    active.current?.abort()
    const controller = new AbortController()
    active.current = controller
    setOpening(childId)
    setFailed(false)
    void onOpen(parentId, childId, controller.signal).catch(() => {
      if (!controller.signal.aborted) setFailed(true)
    }).finally(() => {
      if (!controller.signal.aborted) setOpening(undefined)
    })
  }
  return <details className={styles.subagentDetails}>
    <summary>{t('panel.subagentSummary', { count: node.subagentCount, running: node.runningSubagents })}</summary>
    <p>{t('panel.subagentHint')}</p>
    {failed ? <p role="alert">{t('panel.subagentOpenError')}</p> : null}
    <ul>{node.subagents.map(agent => <li key={agent.id}>
      <button type="button" disabled={opening !== undefined} aria-busy={opening === agent.id}
        onClick={() => { open(agent.parentId, agent.id) }}>{agent.title.trim() || t('panel.unnamedSubagent')}</button>
      <span data-display-status={agent.displayStatus}>{t(agent.displayStatus === 'running' ? 'preview.status.running'
        : agent.displayStatus === 'waiting-input' ? 'preview.status.pending'
          : agent.displayStatus === 'completed' ? 'preview.status.completed' : 'panel.subagentIdle')}</span>
    </li>)}</ul>
  </details>
}
