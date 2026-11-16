import { useCallback, useEffect, useRef, useState } from 'react'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { KnowledgeDiscussionAddress } from '../knowledge.ts'
import type { SessionGraphNode } from './graph-model.ts'
import type { GraphViewInjected } from './GraphView.tsx'
import { useKnowledge } from './Knowledge.tsx'

interface ExtractionRequest {
  readonly sessionId: SessionId
  readonly requestId: number
  readonly controller: AbortController
}

export function useSessionExtraction(node: SessionGraphNode | undefined, read: GraphViewInjected['readSessionHistory'], onOpen: () => void): {
  readonly openExtraction: () => Promise<void>
  readonly extractionLoading: boolean
  readonly extractionFailed: boolean
} {
  const knowledge = useKnowledge()
  const active = useRef<ExtractionRequest>()
  const nextRequestId = useRef(0)
  const [loading, setLoading] = useState<SessionId>()
  const [failed, setFailed] = useState<SessionId>()
  const sessionId = node?.id
  useEffect(() => {
    active.current?.controller.abort()
    active.current = undefined
    setLoading(undefined)
    setFailed(undefined)
  }, [sessionId])
  useEffect(() => () => { active.current?.controller.abort() }, [])
  const openExtraction = useCallback(async () => {
    if (node === undefined || node.blank || node.turns === 0) return
    const sessionId = node.id
    active.current?.controller.abort()
    const controller = new AbortController()
    const requestId = nextRequestId.current + 1
    nextRequestId.current = requestId
    active.current = { sessionId, requestId, controller }
    setLoading(sessionId)
    setFailed(undefined)
    try {
      const completed: { startSeq: number; endSeq: number }[] = []
      const pageStarts = new Set<number>()
      let result = await read({ sessionId }, controller.signal)
      for (;;) {
        if (result.kind !== 'original') break
        completed.push(...result.turns.flatMap(turn => turn.endSeq === null ? [] : [{ startSeq: turn.startSeq, endSeq: turn.endSeq }]))
        const last = result.turns.at(-1)
        if (!result.hasLater || last === undefined || pageStarts.has(last.startSeq)) break
        pageStarts.add(last.startSeq)
        result = await read({ sessionId, afterSeq: last.startSeq }, controller.signal)
      }
      if (controller.signal.aborted || active.current?.requestId !== requestId) return
      const first = completed[0]
      const last = completed.at(-1)
      if (first === undefined || last === undefined || knowledge === undefined) throw new Error('No completed turns')
      const source: KnowledgeDiscussionAddress = { kind: 'discussion', sessionId, startSeq: first.startSeq, endSeq: last.endSeq }
      onOpen()
      knowledge.extract(source)
    } catch {
      if (!controller.signal.aborted && active.current?.requestId === requestId) setFailed(sessionId)
    } finally {
      if (active.current?.requestId === requestId) {
        active.current = undefined
        setLoading(undefined)
      }
    }
  }, [node, knowledge, read, onOpen])
  return { openExtraction, extractionLoading: loading === sessionId, extractionFailed: failed === sessionId }
}
