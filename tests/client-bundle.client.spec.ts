// @vitest-environment jsdom
/** Executes the packed browser-module format against a minimal dsh Client context. */
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const PLUGIN_ID = '@benz-ai-x/dsh-research-graph'

interface Handoff {
  readonly id: string
  readonly factory: (require: (specifier: string) => unknown) => Record<string, unknown>
}

interface ClientPlugin {
  readonly inject: readonly string[]
  readonly apply: (ctx: FakeContext) => void | Promise<void | (() => Promise<void>)>
}

interface ViewDefinition {
  readonly name: string
  readonly id: string
  readonly label: () => string
  readonly inject: () => {
    readonly hostId: string
    readonly openSession: (id: string) => void
    readonly branchSession: (id: string) => Promise<void>
    readonly generateSessionDigest: (
      id: string,
      options: { readonly refresh: boolean },
      signal: AbortSignal,
    ) => Promise<unknown>
    readonly mergeSessions: (
      sourceIds: readonly string[],
      instruction: string,
      signal: AbortSignal,
    ) => Promise<string>
  }
}

interface FakeContext {
  plugin: (definition: Readonly<Record<string, unknown>>) => { dispose: () => Promise<void> }
  inject: (
    services: readonly string[],
    apply: (ctx: FakeContext) => void | Promise<void>,
  ) => Promise<void> & { dispose: () => Promise<void> }
  effect: (install: () => unknown, label: string) => void
  locale: {
    register: (namespace: string, dictionaries: Readonly<Record<string, object>>) => () => void
    bind: (namespace: string) => (key: string) => string
  }
  slots: {
    inject: (name: string, install: () => unknown) => void
    register: (definition: ViewDefinition, component: unknown) => () => void
  }
  sessions: {
    list: {
      getSnapshot: () => Readonly<Record<string, unknown>>
    }
    create: (request: Readonly<Record<string, unknown>>) => Promise<string>
    binding: (id: string) => {
      session: {
        rename: (title: string) => Promise<unknown>
      }
    } | undefined
    fork: (request: { readonly sessionId: string; readonly increaseTitle: boolean }) => Promise<string>
  }
  uiWorkspace: {
    openSession: (id: string) => void
  }
  workspaces: {
    list: {
      getSnapshot: () => Readonly<Record<string, unknown>>
    }
  }
  remote: {
    $mount: (contribution: unknown) => Promise<() => Promise<void>>
    sessionGraphDigest: {
      generate: (request: unknown, signal: AbortSignal) => Promise<unknown>
    }
    sessionGraphMerge: {
      submit: (request: unknown, signal: AbortSignal) => Promise<unknown>
    }
    sessionGraphKnowledge: {
      hostIdentity: (signal: AbortSignal) => Promise<unknown>
    }
  }
}

type BrowserWindow = Window & typeof globalThis & {
  __ModuleLoader__?: { load: (handoff: Handoff) => void }
}

async function loadArtifact(): Promise<{ readonly handoff: Handoff; readonly plugin: ClientPlugin }> {
  const code = readFileSync(resolve('lib/client.js'), 'utf8')
  let handoff: Handoff | undefined
  const browserWindow = window as BrowserWindow
  browserWindow.__ModuleLoader__ = { load: value => { handoff = value } }
  // The built artifact is deliberately evaluated in its target window scope.
  new Function(code)()
  expect(handoff).toBeDefined()
  const shared = new Map<string, unknown>([
    ['react', await import('react')],
    ['react/jsx-runtime', await import('react/jsx-runtime')],
    ['react-dom', await import('react-dom')],
    // Only factory wiring is exercised here; the vendored halves' service
    // calls stay behind the plugin() stub, and rendered output uses the real
    // matching Host in views.client.spec.tsx and packed-profile acceptance.
    ['@deepseek-ai/cordis', await import('@deepseek-ai/cordis')],
    ['@deepseek-ai/dsh-client-store', {}],
    ['@deepseek-ai/dsh-client-ui-slots', {}],
    ['@deepseek-ai/dsh-client-ui-primitives', { MarkdownText: () => { throw new Error('Use the Harness suite for Markdown rendering') } }],
  ])
  const metadata = JSON.parse(readFileSync(resolve('package.json'), 'utf8'))
  // Baseline platform modules are served without an inject row; every other
  // scoped request must name a declared module-table dependency.
  const baseline = new Set(['@deepseek-ai/cordis', '@deepseek-ai/dsh-client-store', '@deepseek-ai/dsh-client-ui-slots', '@deepseek-ai/dsh-client-ui-primitives'])
  const plugin = handoff!.factory((specifier) => {
    if (specifier.startsWith('@deepseek-ai/') && !baseline.has(specifier)) {
      expect(metadata.dsh.client.inject).toContain(specifier)
    }
    if (!shared.has(specifier)) throw new Error(`unexpected client-module request: ${specifier}`)
    return shared.get(specifier)
  }) as unknown as ClientPlugin
  return { handoff: handoff!, plugin }
}

afterEach(() => {
  delete (window as BrowserWindow).__ModuleLoader__
  for (const element of document.querySelectorAll('style')) element.remove()
})

describe('tsdown client artifact', () => {
  it('registers its lazy module factory under the published package name', async () => {
    const { handoff, plugin } = await loadArtifact()
    expect(handoff.id).toBe(PLUGIN_ID)
    expect(plugin.apply).toBeTypeOf('function')
    expect(plugin.inject).toEqual(['slots', 'sessions', 'workspaces', 'locale', 'remote', 'remote.session'])
  })

  it('registers and disposes the Graph view through the dsh Client services', async () => {
    const { plugin } = await loadArtifact()
    const views: ViewDefinition[] = []
    const slotNames: string[] = []
    const rootDisposers: Array<() => void | Promise<void>> = []
    const uiDisposers: Array<() => void | Promise<void>> = []
    const injectedServices: readonly string[][] = []
    const forkRequests: { readonly sessionId: string; readonly increaseTitle: boolean }[] = []
    const digestRequests: { readonly request: unknown; readonly signal: AbortSignal }[] = []
    const mergeRequests: { readonly request: unknown; readonly signal: AbortSignal }[] = []
    const createRequests: Readonly<Record<string, unknown>>[] = []
    const renamed: string[] = []
    const opened: string[] = []
    const disposeRemote = vi.fn(async () => {})
    const mountRemote = vi.fn(async () => disposeRemote)
    const digestRemote = {
      generate: async (request: unknown, signal: AbortSignal) => {
        digestRequests.push({ request, signal })
        return { ok: true, value: { kind: 'empty' } }
      },
    }
    const mergeRemote = {
      submit: async (request: unknown, signal: AbortSignal) => {
        mergeRequests.push({ request, signal })
        return {
          ok: true,
          value: {
            operationId: 'operation-1',
            contextEventSeq: 8,
            sources: [
              { sessionId: 'source-a', capturedThroughSeq: 3 },
              { sessionId: 'source-b', capturedThroughSeq: 4 },
            ],
          },
        }
      },
    }
    const mountedHalves: Readonly<Record<string, unknown>>[] = []
    let ctx: FakeContext
    ctx = {
      plugin: definition => {
        mountedHalves.push(definition)
        return { dispose: async () => {} }
      },
      inject: (services, apply) => {
        injectedServices.push(services)
        const injectedCtx: FakeContext = {
          ...ctx,
          effect: (install) => {
            const disposer = install()
            if (typeof disposer === 'function') uiDisposers.push(disposer as () => void | Promise<void>)
          },
          remote: {
            $mount: mountRemote,
            session: {
              rename: async (request: { readonly sessionId: string; readonly title: string }) => {
                renamed.push(request.title)
                return { ok: true, value: { title: request.title, seq: 0 } }
              },
            },
            sessionGraphDigest: digestRemote,
            sessionGraphMerge: mergeRemote,
            sessionGraphKnowledge: { hostIdentity: async () => ({ ok: true, value: { hostId: 'host-one' } }) },
          },
        }
        const fiber = Promise.resolve(apply(injectedCtx)) as Promise<void> & { dispose: () => Promise<void> }
        fiber.dispose = async () => {
          for (const dispose of uiDisposers.reverse()) await dispose()
        }
        return fiber
      },
      effect: (install) => {
        const disposer = install()
        if (typeof disposer === 'function') rootDisposers.push(disposer as () => void | Promise<void>)
      },
      locale: {
        register: () => () => {},
        bind: () => key => key === 'view.graph' ? 'Research Graph' : key,
      },
      slots: {
        inject: (name, install) => {
          slotNames.push(name)
          expect(['conversation.view', 'sidebar.footer.action', 'sidebar.workspaces']).toContain(name)
          const disposer = install()
          if (typeof disposer === 'function') uiDisposers.push(disposer as () => void | Promise<void>)
        },
        register: (definition) => {
          views.push(definition)
          return () => { views.splice(views.indexOf(definition), 1) }
        },
      },
      sessions: {
        list: {
          getSnapshot: () => ({
            byId: {
              'source-a': {
                id: 'source-a', displayTitle: 'Architecture', cwd: '/workspace',
                running: false, blank: false, updatedAt: 2,
              },
              'source-b': {
                id: 'source-b', displayTitle: 'Testing', cwd: '/workspace',
                running: false, blank: false, updatedAt: 1,
              },
            },
          }),
        },
        create: async request => {
          createRequests.push(request)
          return 'target-session'
        },
        binding: id => id === 'target-session'
          ? {
              session: {
                rename: async title => {
                  renamed.push(title)
                  return { ok: true, value: { title, seq: 0 } }
                },
              },
            }
          : undefined,
        fork: async (request) => {
          forkRequests.push(request)
          return 'child'
        },
      },
      uiWorkspace: {
        openSession: id => { opened.push(id) },
      },
      workspaces: {
        list: {
          getSnapshot: () => ({
            items: [{
              workspaceId: 'workspace-1',
              path: '/workspace',
              title: 'Workspace',
              sessionIds: ['source-a', 'source-b'],
              createdAt: '',
              updatedAt: '',
            }],
            archivedSessionIds: [],
            state: 'idle',
            phase: 'ready',
            error: undefined,
          }),
        },
      },
      remote: {
        $mount: mountRemote,
        get session() {
          throw new Error('cannot get property "remote.session" without inject')
        },
        get sessionGraphDigest() {
          throw new Error('cannot get property "remote.sessionGraphDigest" without inject')
        },
        get sessionGraphMerge() {
          throw new Error('cannot get property "remote.sessionGraphMerge" without inject')
        },
        get sessionGraphKnowledge() {
          throw new Error('cannot get property "remote.sessionGraphKnowledge" without inject')
        },
      },
    }

    const disposePlugin = await plugin.apply(ctx)
    expect(mountRemote).toHaveBeenCalledOnce()
    expect(injectedServices).toEqual([[
      'slots', 'sessions', 'workspaces', 'uiWorkspace', 'locale',
      'remote.session',
      'remote.sessionGraphDigest', 'remote.sessionGraphTitle', 'remote.sessionGraphMerge', 'remote.sessionGraphHistory',
      'remote.sessionGraphSearch', 'remote.sessionGraphTopics', 'remote.sessionGraphFolders',
      'remote.sessionGraphKnowledge', 'remote.sessionGraphReuse', 'remote.sessionGraphBranch',
    ]])
    // The vendored sidebar/workspace halves mount through ctx.plugin and are
    // exercised by the Harness suite; this face sees only the Graph entry.
    expect(new Set(slotNames)).toEqual(new Set(['conversation.view']))
    expect(views).toHaveLength(1)
    const graph = views.find(view => view.name === 'conversation.view')
    expect(graph).toMatchObject({ name: 'conversation.view', id: 'graph' })
    expect(graph?.label()).toBe('Research Graph')
    expect(graph?.inject().hostId).toBe('host-one')
    await graph?.inject().branchSession('source')
    expect(forkRequests).toEqual([{ sessionId: 'source', increaseTitle: true }])
    const controller = new AbortController()
    await expect(graph?.inject().generateSessionDigest(
      'source', { refresh: true }, controller.signal,
    )).resolves.toEqual({ kind: 'empty' })
    expect(digestRequests).toEqual([{
      request: { sessionId: 'source', refresh: true },
      signal: controller.signal,
    }])
    await expect(graph?.inject().mergeSessions(
      ['source-a', 'source-b'],
      'Compare conclusions.',
      controller.signal,
    )).resolves.toBe('target-session')
    expect(createRequests).toEqual([{ workspaceId: 'workspace-1' }])
    expect(renamed).toEqual(['Merge: Architecture + Testing'])
    expect(mergeRequests).toHaveLength(1)
    expect(mergeRequests[0]).toMatchObject({
      request: {
        targetSessionId: 'target-session',
        sourceIds: ['source-a', 'source-b'],
        instruction: 'Compare conclusions.',
        operationId: expect.any(String),
      },
      signal: controller.signal,
    })
    expect(opened).toEqual(['target-session'])
    expect(disposePlugin).toBeTypeOf('function')
    await disposePlugin?.()
    for (const dispose of rootDisposers.reverse()) await dispose()
    expect(views).toHaveLength(0)
    expect(disposeRemote).toHaveBeenCalledOnce()
  })

  it('injects package-tagged CSS when the factory materializes', async () => {
    await loadArtifact()
    // One style tag per CSS module across the whole client bundle: the Graph
    // view plus the vendored sidebar/workspace browser surfaces.
    const cssModules = readdirSync(resolve('src/client'), { recursive: true })
      .filter(name => String(name).endsWith('.module.css'))
      .length
    expect(document.querySelectorAll(`style[data-plugin=${JSON.stringify(PLUGIN_ID)}]`))
      .toHaveLength(cssModules)
  })
})
