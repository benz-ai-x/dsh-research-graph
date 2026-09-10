import type { KeyboardEvent } from 'react'

/** Keep keyboard focus inside the dialog at either end of its controls. */
export function retainDialogFocus(event: KeyboardEvent<HTMLElement>): void {
  if (event.key !== 'Tab') return
  const closedDetails = [...event.currentTarget.querySelectorAll('details:not([open])')]
  const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button, input, textarea, select, summary, a[href], [tabindex="0"]')]
    .filter(element => element.tabIndex >= 0 && !element.matches(':disabled') && !element.closest('[inert], [aria-hidden="true"], [hidden]')
      && !closedDetails.some(details => details.contains(element) && !details.querySelector(':scope > summary')?.contains(element)))
  const first = controls[0]
  const last = controls[controls.length - 1]
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
}
