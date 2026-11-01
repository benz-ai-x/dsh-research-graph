import { describe, expect, it } from 'vitest'
import type { SessionListState, SessionSummary } from '@deepseek-ai/dsh-api-session-controller/client'
import type { WorkspaceView } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { SessionStatusSnapshot } from '@deepseek-ai/dsh-client-ui-session/client'
import type { WorkspaceFolderRecord } from '../src/workspace-folder.ts'
import { deriveGroups, folderViewKey, UNGROUPED_KEY } from '../src/client/workspace/tree.ts'

const id = (value: string): SessionId => value as SessionId

function session(value: string, over: Partial<SessionSummary> = {}): SessionSummary {
  return {
    id: id(value),
    title: over.title ?? `Session ${value}`,
    displayTitle: over.displayTitle ?? `Session ${value}`,
    running: over.running ?? false,
    blank: over.blank ?? false,
    updatedAt: over.updatedAt ?? 1_000,
    retainedBy: over.retainedBy ?? {},
    ...over,
  }
}

function listState(byId: Record<string, SessionSummary>): SessionListState {
  return {
    ids: Object.keys(byId).map(id),
    byId,
    current: undefined,
    phase: 'ready',
    projectionsBySession: {},
  } as SessionListState
}

function workspace(value: string, sessionIds: string[]): WorkspaceView {
  return {
    workspaceId: value,
    path: `/host/${value}`,
    title: `Workspace ${value}`,
    sessionIds: sessionIds.map(id),
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  } as WorkspaceView
}

function folderRecord(
  workspaceId: string,
  rows: readonly [folderId: string, title: string, sessionIds: string[]][],
): WorkspaceFolderRecord {
  return {
    workspaceId,
    folders: rows.map(([folderId, title, sessionIds]) => ({ folderId, title, sessionIds })),
  }
}

const F1 = '1bb797e8-16ad-4d78-8f41-c0a5efaf8451'
const F2 = '2bb797e8-16ad-4d78-8f41-c0a5efaf8451'

const noStatuses: SessionStatusSnapshot = new Map()
const rowState = { pinnedSessionIds: [], archivedSessionIds: [], archivedFilter: 'default' as const }

function derive(
  list: SessionListState,
  workspaces: readonly WorkspaceView[],
  records: readonly WorkspaceFolderRecord[],
  view: { expandedGroups: readonly string[]; expandedFolders: readonly string[] },
) {
  return deriveGroups(list, workspaces, rowState, noStatuses, view, new Map(records.map(r => [r.workspaceId, r])))
}

describe('Workspace tree folders', () => {
  it('keeps the native flat layout when the Workspace has no folders', () => {
    const groups = derive(
      listState({ s1: session('s1'), s2: session('s2') }),
      [workspace('w1', ['s1', 's2'])],
      [],
      { expandedGroups: ['w1'], expandedFolders: [] },
    )
    expect(groups).toHaveLength(1)
    expect(groups[0]?.folders).toEqual([])
    expect(groups[0]?.sessions.map(node => node.id)).toEqual(['s1', 's2'])
  })

  it('partitions members between folders and the ungrouped section', () => {
    const groups = derive(
      listState({ s1: session('s1'), s2: session('s2'), s3: session('s3') }),
      [workspace('w1', ['s1', 's2', 's3'])],
      [folderRecord('w1', [[F1, 'Research', ['s1']], [F2, 'Ops', ['s3']]])],
      { expandedGroups: ['w1'], expandedFolders: [folderViewKey('w1', F1)] },
    )
    const group = groups[0]
    expect(group?.folders.map(folder => folder.title)).toEqual(['Research', 'Ops'])
    // Only the expanded folder exposes its rows; the ungrouped remainder stays top-level.
    expect(group?.folders[0]?.sessions.map(node => node.id)).toEqual(['s1'])
    expect(group?.folders[1]?.sessions).toEqual([])
    expect(group?.sessions.map(node => node.id)).toEqual(['s2'])
    expect(group?.folders[0]?.sessionCount).toBe(1)
    expect(group?.sessionCount).toBe(3)
  })

  it('folds folders away with their group and reads stale assignments as unassigned', () => {
    const groups = derive(
      listState({ s1: session('s1'), s2: session('s2') }),
      [workspace('w1', ['s1'])],
      [folderRecord('w1', [[F1, 'Research', ['s1', 'gone']]])],
      { expandedGroups: [], expandedFolders: [folderViewKey('w1', F1)] },
    )
    // Group folded: no rows anywhere — folder headers fold away with it.
    expect(groups[0]?.expanded).toBe(false)
    expect(groups[0]?.sessions).toEqual([])
    expect(groups[0]?.folders).toEqual([])
    // 'gone' is not a Workspace member: it reads as unassigned, not as a folder member.
    const expanded = derive(
      listState({ s1: session('s1'), s2: session('s2') }),
      [workspace('w1', ['s1'])],
      [folderRecord('w1', [[F1, 'Research', ['s1', 'gone']]])],
      { expandedGroups: ['w1'], expandedFolders: [folderViewKey('w1', F1)] },
    )
    expect(expanded[0]?.folders[0]?.sessionCount).toBe(1)
  })

  it('never folders the ungrouped bucket', () => {
    const groups = derive(
      listState({ s1: session('s1') }),
      [],
      [folderRecord(UNGROUPED_KEY, [[F1, 'Research', ['s1']]])],
      { expandedGroups: [UNGROUPED_KEY], expandedFolders: [] },
    )
    expect(groups[0]?.key).toBe(UNGROUPED_KEY)
    expect(groups[0]?.folders).toEqual([])
    expect(groups[0]?.sessions.map(node => node.id)).toEqual(['s1'])
  })

  it('expands the folder containing the current Session by default', () => {
    const groups = derive(
      listState({ s1: session('s1'), s2: session('s2', { retainedBy: { mainView: 1 } }) }),
      [workspace('w1', ['s1', 's2'])],
      [folderRecord('w1', [[F1, 'Research', ['s2']]])],
      { expandedGroups: ['w1'], expandedFolders: [folderViewKey('w1', F1)] },
    )
    expect(groups[0]?.folders[0]?.containsCurrent).toBe(true)
    expect(groups[0]?.folders[0]?.sessions.map(node => node.id)).toEqual(['s2'])
  })
})
