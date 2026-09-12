import type { ReactElement, ReactNode } from 'react'
import type { SessionGraphKey } from './locales.ts'
import { useReadingPanelGeometry } from './reading-geometry.ts'
import styles from './GraphView.module.css'

/** A stable reading seat: identity and actions stay visible while the document scrolls. */
export function InspectorFrame({ label, title, meta, tabs, actions, children, onClose, closeLabel, workingKey, testId, t }: {
  readonly label: string
  readonly title?: ReactNode
  readonly meta?: ReactNode
  readonly tabs?: ReactNode
  readonly actions?: ReactNode
  readonly children: ReactNode
  readonly onClose: () => void
  readonly closeLabel?: string
  readonly workingKey?: string | undefined
  readonly testId?: string
  readonly t: (key: SessionGraphKey, params?: Record<string, unknown>) => string
}): ReactElement {
  const geometry = useReadingPanelGeometry(workingKey, onClose, t)
  const { expanded, toggle } = geometry
  return <aside {...geometry.panel} className={`${styles.panel} ${styles.readingPanel}`} role="complementary" aria-label={label}
    data-canvas-overlay="" data-reading-panel="" data-testid={testId}>
    <div {...geometry.handle} className={styles.readingResize} />
    <header className={styles.readingPanelHeader}>
      <div className={styles.panelHeader}>
        <span className={styles.panelHeading}>{label}</span>
        <div className={styles.readingPanelTools}>
          <button type="button" aria-expanded={expanded} onClick={toggle}>{t(expanded ? 'reading.collapse' : 'reading.expand')}</button>
          <button type="button" className={styles.panelClose} aria-label={closeLabel ?? t('panel.close')} onClick={onClose}>×</button>
        </div>
      </div>
      {title === undefined ? null : <h2 className={styles.panelTitle}>{title}</h2>}
      {meta}
      {tabs}
    </header>
    <div className={styles.readingPanelBody} data-working-scroll="" data-testid={testId === undefined ? undefined : `${testId}-scroll`}>
      {children}
    </div>
    {actions === undefined ? null : <footer className={styles.readingPanelFooter}>{actions}</footer>}
  </aside>
}
