import { useMemo, type ReactElement } from 'react'
import { MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SessionGraphKey } from './locales.ts'
import styles from './GraphView.module.css'

/** Use the Host's safe document renderer while retaining the original source text. */
export function ResearchMarkdown({ text, t }: {
  readonly text: string
  readonly t: (key: SessionGraphKey, params?: Record<string, unknown>) => string
}): ReactElement {
  const labels = useMemo(() => ({
    code: { copyLabel: t('reading.copy'), copiedLabel: t('reading.copied') },
    footnotes: t('reading.footnotes'),
  }), [t])
  return <div className={styles.researchMarkdown}><MarkdownText text={text} labels={labels} /></div>
}
