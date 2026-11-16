import type { ReactElement } from 'react'
import {
  IconCheckCircleOutlineRegular, IconChecklistOutlineRegular, IconLightOutlineRegular,
  IconQuestionOutlineRegular, IconSparkleRegular, IconWarningTriangleOutlineRegular,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { KnowledgeContent } from '../knowledge.ts'
import type { SessionGraphKey } from './locales.ts'
import styles from './GraphView.module.css'

type Translate = (key: SessionGraphKey) => string

export function KnowledgeStatusBadge({ status, t }: {
  readonly status: KnowledgeContent['status']
  readonly t: Translate
}): ReactElement {
  const Icon = status === 'confirmed' ? IconCheckCircleOutlineRegular : IconWarningTriangleOutlineRegular
  return <span className={styles.knowledgeBadge} data-status={status}>
    <Icon size={13} />{t(status === 'confirmed' ? 'workbench.confirmed' : 'workbench.verify')}
  </span>
}

export function KnowledgeKindBadge({ kind, t }: {
  readonly kind: KnowledgeContent['kind']
  readonly t: Translate
}): ReactElement {
  const Icon = kind === 'conclusion' ? IconChecklistOutlineRegular
    : kind === 'method' ? IconLightOutlineRegular
      : kind === 'hypothesis' ? IconSparkleRegular : IconQuestionOutlineRegular
  return <span className={styles.knowledgeBadge} data-kind={kind}>
    <Icon size={13} />{t(`knowledge.kind.${kind}`)}
  </span>
}
