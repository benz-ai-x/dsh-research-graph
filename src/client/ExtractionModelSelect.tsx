import { useEffect, useState, type ReactElement } from 'react'
import type { SessionMergeModelSelection } from '../session-merge.ts'
import type { MergeModelCatalog } from './GraphView.tsx'
import type { SessionGraphKey } from './locales.ts'

type CatalogState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly value: MergeModelCatalog }
  | { readonly status: 'failed' }

export function ExtractionModelSelect({ catalog, value, busy, onChange, onAvailabilityChange, t }: {
  readonly catalog: (() => Promise<MergeModelCatalog>) | undefined
  readonly value: SessionMergeModelSelection
  readonly busy: boolean
  readonly onChange: (value: SessionMergeModelSelection) => void
  readonly onAvailabilityChange: (available: boolean) => void
  readonly t: (key: SessionGraphKey, params?: Record<string, unknown>) => string
}): ReactElement {
  const [state, setState] = useState<CatalogState>({ status: 'loading' })
  useEffect(() => {
    let active = true
    setState({ status: 'loading' })
    if (catalog === undefined) {
      setState({ status: 'failed' })
      return () => { active = false }
    }
    void catalog().then(
      value => { if (active) setState({ status: 'ready', value }) },
      () => { if (active) setState({ status: 'failed' }) },
    )
    return () => { active = false }
  }, [catalog])
  const ready = state.status === 'ready' ? state.value : undefined
  const provider = value.provider || ready?.default?.provider || ready?.groups[0]?.id || ''
  const selectedGroup = ready?.groups.find(group => group.id === provider)
  const model = value.model || (ready?.default?.provider === provider ? ready.default.model : undefined) || selectedGroup?.models[0]?.id || ''
  const available = ready !== undefined && provider !== '' && model !== ''
  useEffect(() => {
    onAvailabilityChange(available)
    if (ready !== undefined && available && (value.provider !== provider || value.model !== model)) onChange({ provider, model })
  }, [ready, available, provider, model, value.provider, value.model, onChange, onAvailabilityChange])
  return <>
    <label>{t('extract.provider')}<select disabled={busy || ready === undefined} value={provider} onChange={event => {
      const nextProvider = event.target.value
      const group = ready?.groups.find(item => item.id === nextProvider)
      const nextModel = group?.models.find(item => item.id === model)?.id ?? group?.models[0]?.id ?? (group === undefined ? model : '')
      onChange({ provider: nextProvider, model: nextModel })
    }}>
      {provider === '' ? <option value="">{t('extract.modelError')}</option> : null}
      {selectedGroup === undefined && provider !== '' ? <option value={provider}>{t('extract.currentRoute', { id: provider })}</option> : null}
      {ready?.groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
    </select></label>
    <label>{t('extract.model')}<select disabled={busy || ready === undefined || provider === ''} value={model} onChange={event => {
      onChange({ provider, model: event.target.value })
    }}>
      {model === '' ? <option value="">{t('extract.modelError')}</option> : null}
      {model !== '' && selectedGroup?.models.some(item => item.id === model) !== true
        ? <option value={model}>{t('extract.currentRoute', { id: model })}</option> : null}
      {selectedGroup?.models.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select></label>
    {state.status === 'failed' || (ready !== undefined && !available)
      ? <p role="alert">{t('extract.modelError')}</p>
      : ready === undefined ? <p role="status">{t('extract.modelLoading')}</p> : null}
  </>
}
