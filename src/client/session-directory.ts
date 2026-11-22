import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'

function projectedString(values: object | undefined, key: string): string | undefined {
  if (values === undefined) return undefined
  const value: unknown = Reflect.get(values, key)
  return typeof value === 'string' ? value : undefined
}

/** Select the current working directory, falling back to the original header cwd. */
export function selectSessionDirectory(state: SessionListState, sessionId: SessionId): string | undefined {
  return projectedString(state.projectionsBySession?.[sessionId]?.values, 'workingDirectory')
    ?? projectedString(state.byId[sessionId]?.projectionValues, 'workingDirectory')
    ?? state.byId[sessionId]?.cwd
}
