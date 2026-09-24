/** Plugin-owned LLM message source kind, merged into the Host's MessageSourceMap. */
import type { ContextFormed } from '@deepseek-ai/dsh-llm'

declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    'dsh-session-graph': { kind: 'dsh-session-graph' } & ContextFormed
  }
}

/** Host log provenance marker retained from the original dsh-session-graph package name. */
export const SESSION_GRAPH_MESSAGE_KIND: 'dsh-session-graph' = 'dsh-session-graph'
