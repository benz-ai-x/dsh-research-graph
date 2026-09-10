import type { ReactElement } from 'react'
import type { KnowledgeSource } from '../knowledge.ts'
import type { SessionGraphKey } from './locales.ts'
import styles from './GraphView.module.css'

/** Read the frozen structured snapshot; never refetch or reconstruct the send payload. */
export function SourcePreview({ source, t }: {
  readonly source: KnowledgeSource
  readonly t: (key: SessionGraphKey, params?: Record<string, unknown>) => string
}): ReactElement {
  return <section className={styles.sourcePreview} tabIndex={0} aria-label={source.title}>
    <h4>{source.title}</h4>
    {source.source.turns.map(turn => <article key={turn.startSeq}>
      <h5>{t('history.turn', { turn: turn.turn })} · {new Date(turn.startedAt).toLocaleString()}</h5>
      {turn.messages.map(message => <div key={message.seq}>
        <strong>{t(message.role === 'user' ? 'history.user' : 'history.assistant')}</strong>
        <p className={styles.historyText}>{message.text}</p>
      </div>)}
    </article>)}
    <details><summary>{t('knowledge.sourceDetails')}</summary>
      <p className={styles.historyIdentity}>{source.sessionId} · {source.cwd}</p>
      <p>{t('knowledge.sourceRange', { start: source.source.startSeq, end: source.source.endSeq })}</p>
    </details>
  </section>
}
