import { Context } from '@deepseek-ai/cordis'
import SessionStore from '@deepseek-ai/dsh-session'
import JsonlSessionPersistence from '@deepseek-ai/dsh-session-persistence-jsonl'
import SqliteSessionQueryEngine from '@deepseek-ai/dsh-session-query-sqlite'
import TypertRegistry from '@deepseek-ai/dsh-typert-registry'
import TypertGatewayService from '@deepseek-ai/dsh-api-gateway'
import { createSessionTestController } from 'harness-session-controller-test-support'
import Storage from '@deepseek-ai/dsh-storage'
import * as StorageJson from '@deepseek-ai/dsh-storage-json'
import * as StorageDomain from '@deepseek-ai/dsh-storage-domain'
import { join } from 'node:path'
import { expect, vi } from 'vitest'
import { apply, inject } from '../../src/index.ts'

export async function topicHost(root: string, cleanups: (() => Promise<void>)[]) {
  const ctx = new Context()
  cleanups.push(async () => {
    await ctx.fiber.dispose()
  })
  await ctx.plugin(Storage)
  await ctx.plugin(StorageJson, { root: join(root, 'data') })
  await ctx.plugin(StorageDomain, { backend: 'json' })
  expect(ctx.get('storageDomain'), 'storage domain fixture is available').toBeDefined()
  await ctx.plugin(SessionStore)
  await ctx.plugin(JsonlSessionPersistence, { root: join(root, 'sessions'), compression: 'none' })
  await ctx.plugin(TypertRegistry)
  await ctx.plugin(SqliteSessionQueryEngine, { path: ':memory:', openAt: 'never' })
  const workspaces = [
    { id: 'a', title: 'Research A', path: '/a', sessionIds: [] as string[] },
    { id: 'b', title: 'Research B', path: '/b', sessionIds: [] as string[] },
  ]
  const archivedSessionIds: string[] = []
  ctx.provide('workspaceRegistry', { list: () => workspaces, archivedSessionIds })
  ctx.provide('llm', { stream: vi.fn(() => { throw new Error('Topics must not call a model') }) })
  await ctx.plugin({
    inject: ['sessions', 'sessionPersistence', 'llm', 'typert'],
    apply(controllerCtx) {
      createSessionTestController(controllerCtx, {
        cwd: '/a', defaultModelSelection: () => ({ provider: 'test', model: 'test' }),
      })
    },
  })
  await ctx.plugin({ apply, inject })
  expect(ctx.get('sessionGraphTopics'), 'topic service is ready when plugin startup completes').toBeDefined()
  await ctx.plugin(TypertGatewayService)
  const invoke = (method: string, request?: unknown, signal = new AbortController().signal) => ctx.typertGateway.invoke({
    namespace: 'sessionGraphTopics', method, args: request === undefined ? {} : { request },
    signal,
  })
  return { ctx, workspaces, archivedSessionIds, invoke }
}
