/** The published view API must accept the Host's nominal SessionId. */
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { GraphViewInjected } from '../lib/types/client.js'
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-api-workspace-controller/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import './harness-client-types.ts'

declare const sessionId: SessionId
declare const graph: GraphViewInjected
graph.openSession(sessionId)
