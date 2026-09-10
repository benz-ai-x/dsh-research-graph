import type { KeyboardEvent } from 'react'

/** Keep keyboard focus inside the dialog at either end of its controls. */
export function retainDialogFocus(event: KeyboardEvent<HTMLElement>): void {
  if (event.key !== 'Tab') return
  const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button, input, select, a[href], [tabindex="0"]')]
    .filter(element => !element.hasAttribute('disabled'))
  const first = controls[0]
  const last = controls[controls.length - 1]
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
}
