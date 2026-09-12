import { useEffect, useId, useRef, useState, type ReactElement, type ReactNode, type RefObject } from 'react'
import styles from './GraphView.module.css'

const closesMenu = (target: EventTarget): boolean => target instanceof Element
  && target.closest('button') !== null && target.closest('[data-menu-keep-open]') === null

/** Secondary actions stay next to their subject without occupying a toolbar row. */
export function ActionMenu({ label, children, triggerRef, above = false, iconOnly = false }: {
  readonly label: string
  readonly children: ReactNode
  readonly triggerRef?: RefObject<HTMLButtonElement>
  readonly above?: boolean
  readonly iconOnly?: boolean
}): ReactElement {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const localTrigger = useRef<HTMLButtonElement>(null)
  const trigger = triggerRef ?? localTrigger
  const id = useId()
  useEffect(() => {
    if (!open) return
    const dismiss = (event: PointerEvent): void => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', dismiss, true)
    return () => { document.removeEventListener('pointerdown', dismiss, true) }
  }, [open])
  return <div ref={root} className={styles.actionMenu} data-above={above}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}
    onKeyDown={event => {
      event.stopPropagation()
      if (event.key === 'Escape' && open) {
        event.preventDefault()
        setOpen(false)
        trigger.current?.focus({ preventScroll: true })
      }
    }}>
    <button ref={trigger} type="button" aria-label={label} title={label} aria-expanded={open} aria-controls={id}
      onClick={() => { setOpen(value => !value) }}>{iconOnly ? <span aria-hidden="true">···</span> : label}</button>
    {open ? <div id={id} className={styles.actionMenuBody} role="group" aria-label={label}
      onClickCapture={event => {
        // Dialogs opened by an action should return to the persistent trigger.
        if (closesMenu(event.target)) trigger.current?.focus({ preventScroll: true })
      }} onClick={event => { if (closesMenu(event.target)) setOpen(false) }}>
      {children}
    </div> : null}
  </div>
}
