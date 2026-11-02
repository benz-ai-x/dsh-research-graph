import { describe, expect, it } from 'vitest'
import { workspaceFolderRecordSchema, workspaceFolderWriteSchema } from '../src/workspace-folder-codec.ts'

const A = '1bb797e8-16ad-4d78-8f41-c0a5efaf8451'
const B = '2bb797e8-16ad-4d78-8f41-c0a5efaf8451'

describe('Workspace Folder codecs', () => {
  it('rejects a Session referenced by two folders in one Workspace', () => {
    expect(() => workspaceFolderRecordSchema.parse({
      workspaceId: 'a',
      folders: [
        { folderId: A, title: '缓存', sessionIds: ['s1'] },
        { folderId: B, title: '实验', sessionIds: ['s1'] },
      ],
    })).toThrow('Invalid Workspace Folder data')
  })

  it('parses moves into a folder and out to the ungrouped section', () => {
    expect(workspaceFolderWriteSchema.parse({
      kind: 'move', workspaceId: 'a', sessionId: 's1', folderId: A,
    })).toEqual({ kind: 'move', workspaceId: 'a', sessionId: 's1', folderId: A })
    expect(workspaceFolderWriteSchema.parse({
      kind: 'move', workspaceId: 'a', sessionId: 's1',
    })).toEqual({ kind: 'move', workspaceId: 'a', sessionId: 's1' })
  })

  it('validates create-and-move atomically and rejects empty titles', () => {
    expect(workspaceFolderWriteSchema.parse({
      kind: 'create', workspaceId: 'a', folderId: A, title: ' 缓存 ', sessionId: 's1',
    })).toEqual({ kind: 'create', workspaceId: 'a', folderId: A, title: '缓存', sessionId: 's1' })
    expect(() => workspaceFolderWriteSchema.parse({
      kind: 'create', workspaceId: 'a', folderId: A, title: ' ',
    })).toThrow('Invalid Workspace Folder data')
  })

  it('rejects non-UUID folder identities and unknown keys', () => {
    expect(() => workspaceFolderWriteSchema.parse({
      kind: 'rename', workspaceId: 'a', folderId: 'not-a-uuid', title: 'x',
    })).toThrow('Invalid Workspace Folder data')
    expect(() => workspaceFolderRecordSchema.parse({
      workspaceId: 'a', folders: [], extra: true,
    })).toThrow('Invalid Workspace Folder data')
  })
})
