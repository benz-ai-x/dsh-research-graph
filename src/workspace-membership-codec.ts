import type { WorkspaceMembershipRestoreRequest, WorkspaceMembershipRestoreResult } from './workspace-membership.ts'

function invalid(): never { throw new TypeError('Invalid Workspace Membership data') }

function object(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return invalid()
  if (Object.keys(value).some(key => !keys.includes(key))) return invalid()
  return value as Record<string, unknown>
}

function string(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '' || value.includes('\0')) return invalid()
  return value
}

export const workspaceMembershipRestoreRequestSchema = { parse(value: unknown): WorkspaceMembershipRestoreRequest {
  const item = object(value, ['workspaceId'])
  return { workspaceId: string(item.workspaceId) }
} }

export const workspaceMembershipRestoreResultSchema = { parse(value: unknown): WorkspaceMembershipRestoreResult {
  const item = object(value, ['sessionIds'])
  if (!Array.isArray(item.sessionIds)) return invalid()
  const sessionIds = item.sessionIds.map(string)
  if (new Set(sessionIds).size !== sessionIds.length) return invalid()
  return { sessionIds }
} }
