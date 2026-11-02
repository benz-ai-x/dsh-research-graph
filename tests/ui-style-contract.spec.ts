import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const rowsCss = readFileSync(resolve('src/client/workspace/rows/Rows.module.css'), 'utf8')
const graphCss = readFileSync(resolve('src/client/GraphView.module.css'), 'utf8')

describe('Workbench visual interaction contracts', () => {
  it('shows folder actions on hover and keeps them visible while the folder menu is open', () => {
    expect(rowsCss).toMatch(/\.folderRow:hover \.rowActions/)
    expect(rowsCss).toMatch(/\.folderRow\.menuOpen \.rowActions/)
  })

  it('keeps the save-arrangement label on one line instead of wrapping per character', () => {
    expect(graphCss).toMatch(/\.arrangementStatus\s*>\s*button\s*\{[^}]*white-space:\s*nowrap/s)
  })
})
