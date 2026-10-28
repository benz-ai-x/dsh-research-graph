import { describe, expect, it } from 'vitest'
import { sidebarCategoryWorkspaceSchema, sidebarCategoryWriteSchema } from '../src/sidebar-category-codec.ts'

const A = '1bb797e8-16ad-4d78-8f41-c0a5efaf8451'
const B = '2bb797e8-16ad-4d78-8f41-c0a5efaf8451'

describe('Sidebar Category codecs', () => {
  it('rejects a Session referenced by two categories in one Workspace', () => {
    expect(() => sidebarCategoryWorkspaceSchema.parse({
      workspaceId: 'a',
      categories: [
        { categoryId: A, title: '缓存', sessionIds: ['s1'] },
        { categoryId: B, title: '实验', sessionIds: ['s1'] },
      ],
    })).toThrow('Invalid Sidebar Category data')
  })

  it('parses moves to a category and to Uncategorized', () => {
    expect(sidebarCategoryWriteSchema.parse({
      kind: 'move', workspaceId: 'a', sessionId: 's1', categoryId: A,
    })).toEqual({ kind: 'move', workspaceId: 'a', sessionId: 's1', categoryId: A })
    expect(sidebarCategoryWriteSchema.parse({
      kind: 'move', workspaceId: 'a', sessionId: 's1',
    })).toEqual({ kind: 'move', workspaceId: 'a', sessionId: 's1' })
  })

  it('validates create-and-move atomically and rejects empty titles', () => {
    expect(sidebarCategoryWriteSchema.parse({
      kind: 'create', workspaceId: 'a', categoryId: A, title: ' 缓存 ', sessionId: 's1',
    })).toEqual({ kind: 'create', workspaceId: 'a', categoryId: A, title: '缓存', sessionId: 's1' })
    expect(() => sidebarCategoryWriteSchema.parse({
      kind: 'create', workspaceId: 'a', categoryId: A, title: ' ',
    })).toThrow('Invalid Sidebar Category data')
  })
})
