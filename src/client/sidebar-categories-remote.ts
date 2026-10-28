import type { RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'
import type { SidebarCategoryWorkspace, SidebarCategoryWrite } from '../sidebar-category.ts'
import {
  sidebarCategoryListSchema, sidebarCategoryWorkspaceSchema, sidebarCategoryWriteSchema,
} from '../sidebar-category-codec.ts'

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteMap {
    'sessionGraphCategories/list': (signal?: AbortSignal) => Promise<RemoteResult<readonly SidebarCategoryWorkspace[]>>
    'sessionGraphCategories/write': (
      request: SidebarCategoryWrite,
      signal?: AbortSignal,
    ) => Promise<RemoteResult<SidebarCategoryWorkspace>>
  }
  interface TypertRemoteNamespaceMap {
    sessionGraphCategories: {
      list: TypertRemoteMap['sessionGraphCategories/list']
      write: TypertRemoteMap['sessionGraphCategories/write']
    }
  }
}

const PACKAGE_NAME = '@benz-ai-x/dsh-research-graph'

export const SIDEBAR_CATEGORIES_REMOTE: TypertRemoteContribution = {
  package: PACKAGE_NAME,
  descriptors: [
    { method: 'list', request: undefined, result: sidebarCategoryListSchema },
    { method: 'write', request: sidebarCategoryWriteSchema, result: sidebarCategoryWorkspaceSchema },
  ].map(({ method, request, result }) => ({
    id: `${PACKAGE_NAME}#sessionGraphCategories/${method}`,
    service: 'sessionGraphCategories', namespace: 'sessionGraphCategories', method,
    invocation: { kind: 'direct' },
    parameters: request === undefined ? [] : [{
      name: 'request', wire: 'request', source: 'json',
      codec: { mode: 'strict', typeSymbol: `${PACKAGE_NAME}#SidebarCategories/${method}/Request`, create: () => request },
    }],
    cancellation: { parameter: 'signal' },
    result: { mode: 'strict', typeSymbol: `${PACKAGE_NAME}#SidebarCategories/${method}/Result`, create: () => result },
  })),
}
