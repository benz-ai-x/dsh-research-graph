import { useSyncExternalStore, type ReactElement } from 'react'
import { IconFlatListOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { SidebarFooterActionOwnerProps } from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { categoryViewPreference, setCategoryView } from './category-toggle.ts'
import styles from './CategoryBrowser.module.css'

export type CategoryFootToggleProps =
  SidebarFooterActionOwnerProps
  & PropsLocale<'sessionGraph'>

export function CategoryFootToggle(props: CategoryFootToggleProps): ReactElement {
  const enabled = useSyncExternalStore(categoryViewPreference.subscribe, categoryViewPreference.getSnapshot)
  const label = props.t(enabled ? 'category.toggle.disable' : 'category.toggle.enable')
  return <button
    type="button"
    className={props.wide ? styles.footToggleWide : styles.footToggleRail}
    title={label}
    aria-label={label}
    aria-pressed={enabled}
    onClick={() => { setCategoryView(!enabled) }}
  >{props.wide ? label : <IconFlatListOutlineRegular size={16} />}</button>
}
