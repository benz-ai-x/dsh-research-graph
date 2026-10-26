/**
 * The sidebar-foot entry that flips the category browsing region: enabling it
 * shadows the native Workspace browser; disabling restores the native list.
 * The seat itself is additive and stays available in both modes, so the
 * native browser always remains reachable.
 */
import { useSyncExternalStore, type ReactElement } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { SidebarFooterActionOwnerProps } from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { categoryViewPreference, setCategoryView } from './category-toggle.ts'
import styles from './CategoryBrowser.module.css'

/** Composed props of the sidebar-foot toggle entry. */
export type CategoryFootToggleProps =
  SidebarFooterActionOwnerProps
  & PropsLocale<'sessionGraph'>

/**
 * Render the sidebar-foot category-view toggle.
 * @param props - composed props (owner share + locale seat).
 * @returns one foot action button.
 */
export function CategoryFootToggle(props: CategoryFootToggleProps): ReactElement {
  const enabled = useSyncExternalStore(categoryViewPreference.subscribe, categoryViewPreference.getSnapshot)
  const label = enabled ? props.t('category.toggle.disable') : props.t('category.toggle.enable')
  return <button
    type="button"
    className={props.wide ? styles.footToggleWide : styles.footToggleRail}
    title={label}
    aria-label={label}
    aria-pressed={enabled}
    onClick={() => { setCategoryView(!enabled) }}
  >{props.wide ? label : '▦'}</button>
}
