import type { SidebarCategory, SidebarCategoryWorkspace, SidebarCategoryWrite } from './sidebar-category.ts'

function invalid(): never { throw new TypeError('Invalid Sidebar Category data') }

function object(value: unknown, keys?: readonly string[]): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return invalid()
  if (keys !== undefined && Object.keys(value).some(key => !keys.includes(key))) return invalid()
  return value as Record<string, unknown>
}

function string(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '' || value.includes('\0')) return invalid()
  return value
}

function categoryId(value: unknown): string {
  const id = string(value)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(id)) return invalid()
  return id
}

function title(value: unknown): string {
  const label = string(value).trim()
  if (label.length > 120) return invalid()
  return label
}

function array(value: unknown): unknown[] { return Array.isArray(value) ? value : invalid() }

function category(value: unknown): SidebarCategory {
  const item = object(value, ['categoryId', 'title', 'sessionIds'])
  const sessionIds = array(item.sessionIds).map(string)
  if (new Set(sessionIds).size !== sessionIds.length) return invalid()
  return { categoryId: categoryId(item.categoryId), title: title(item.title), sessionIds }
}

export const sidebarCategoryWorkspaceSchema = { parse(value: unknown): SidebarCategoryWorkspace {
  const item = object(value, ['workspaceId', 'categories'])
  const categories = array(item.categories).map(category)
  const categoryIds = categories.map(item => item.categoryId)
  const sessionIds = categories.flatMap(item => item.sessionIds)
  if (new Set(categoryIds).size !== categoryIds.length || new Set(sessionIds).size !== sessionIds.length) return invalid()
  return { workspaceId: string(item.workspaceId), categories }
} }

export const sidebarCategoryWriteSchema = { parse(value: unknown): SidebarCategoryWrite {
  const item = object(value)
  const workspaceId = string(item.workspaceId)
  if (item.kind === 'move') {
    object(item, ['kind', 'workspaceId', 'sessionId', 'categoryId'])
    return {
      kind: item.kind, workspaceId, sessionId: string(item.sessionId),
      ...(item.categoryId === undefined ? {} : { categoryId: categoryId(item.categoryId) }),
    }
  }
  const id = categoryId(item.categoryId)
  if (item.kind === 'create') {
    object(item, ['kind', 'workspaceId', 'categoryId', 'title', 'sessionId'])
    return {
      kind: item.kind, workspaceId, categoryId: id, title: title(item.title),
      ...(item.sessionId === undefined ? {} : { sessionId: string(item.sessionId) }),
    }
  }
  if (item.kind === 'rename') {
    object(item, ['kind', 'workspaceId', 'categoryId', 'title'])
    return { kind: item.kind, workspaceId, categoryId: id, title: title(item.title) }
  }
  if (item.kind === 'delete') {
    object(item, ['kind', 'workspaceId', 'categoryId'])
    return { kind: item.kind, workspaceId, categoryId: id }
  }
  return invalid()
} }

export const sidebarCategoryListSchema = { parse(value: unknown): readonly SidebarCategoryWorkspace[] {
  return array(value).map(sidebarCategoryWorkspaceSchema.parse)
} }
