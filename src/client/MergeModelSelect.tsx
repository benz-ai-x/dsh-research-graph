/** Shared Merge model picker over the Host model catalog. */
import { useEffect, useState, type ReactElement } from 'react'
import type { SessionMergeModelSelection } from '../session-merge.ts'
import type { MergeModelCatalog } from './GraphView.tsx'
import styles from './GraphView.module.css'

type CatalogState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly value: MergeModelCatalog }
  | { readonly status: 'failed'; readonly message: string }

/** Entry-point texts, each supplied from its own locale namespace. */
export interface MergeModelSelectTexts {
  readonly label: string
  /** Host-default option; the argument names the default route when known. */
  readonly followDefault: (model: string | undefined) => string
  readonly loading: string
  readonly failed: string
}

function encodeRoute(provider: string, model: string): string {
  return JSON.stringify([provider, model])
}

/**
 * One provider/model picker for Merge entries. An absent catalog face renders
 * nothing, preserving the pre-selection behavior of older mounts; the blank
 * option follows the Host default route without issuing a selection.
 */
export function MergeModelSelect({ catalog, texts, value, onChange, disabled }: {
  readonly catalog: (() => Promise<MergeModelCatalog>) | undefined
  readonly texts: MergeModelSelectTexts
  readonly value: SessionMergeModelSelection | undefined
  readonly onChange: (next: SessionMergeModelSelection | undefined) => void
  readonly disabled?: boolean
}): ReactElement | null {
  const [state, setState] = useState<CatalogState>({ status: 'loading' })
  useEffect(() => {
    if (catalog === undefined) return
    let active = true
    setState({ status: 'loading' })
    catalog().then(
      value => { if (active) setState({ status: 'ready', value }) },
      error => {
        if (active) setState({
          status: 'failed',
          message: error instanceof Error ? error.message : String(error),
        })
      },
    )
    return () => { active = false }
  }, [catalog])
  if (catalog === undefined) return null
  const ready = state.status === 'ready' ? state.value : undefined
  const defaultRoute = ready?.default === undefined || ready.default === null
    ? undefined
    : `${ready.default.provider}/${ready.default.model}`
  return <label className={styles.mergeModelLabel}>
    <span>{texts.label}</span>
    <select
      value={value === undefined ? '' : encodeRoute(value.provider, value.model)}
      disabled={disabled === true || state.status !== 'ready'}
      onChange={event => {
        const chosen = event.target.value
        if (chosen === '') {
          onChange(undefined)
          return
        }
        const [provider, model] = JSON.parse(chosen) as readonly [string, string]
        onChange({ provider, model })
      }}
    >
      <option value="">{texts.followDefault(defaultRoute)}</option>
      {state.status === 'loading' ? <option disabled value="">{texts.loading}</option> : null}
      {state.status === 'failed' ? <option disabled value="" title={state.message}>{texts.failed}</option> : null}
      {ready?.groups.map(group => <optgroup key={group.id} label={group.name}>
        {group.models.map(model => <option
          key={model.id}
          value={encodeRoute(group.id, model.id)}
        >{model.name}</option>)}
      </optgroup>)}
    </select>
  </label>
}
