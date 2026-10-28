import { describe, expect, it } from 'vitest'
import {
  researchTopicSchema, researchTopicWriteSchema,
} from '../src/research-topic-codec.ts'

const TOPIC_ID = '0f0e0d0c-1a2b-3c4d-8e9f-0a1b2c3d4e5f'
const ARRANGEMENT = { positions: {}, collapsed: [], offsets: {} }

function legacyRecord(): Record<string, unknown> {
  return { topicId: TOPIC_ID, title: '文献综述', references: [], arrangement: ARRANGEMENT }
}

describe('research topic records with workspace attribution', () => {
  it('parses legacy records without a workspace attribution', () => {
    const topic = researchTopicSchema.parse(legacyRecord())
    expect(topic.workspaceId).toBeUndefined()
    expect(topic.title).toBe('文献综述')
  })

  it('parses records carrying a workspace attribution', () => {
    const topic = researchTopicSchema.parse({ ...legacyRecord(), workspaceId: 'ws-1' })
    expect(topic.workspaceId).toBe('ws-1')
  })

  it('rejects non-string and empty workspace attributions', () => {
    expect(() => researchTopicSchema.parse({ ...legacyRecord(), workspaceId: 7 })).toThrow()
    expect(() => researchTopicSchema.parse({ ...legacyRecord(), workspaceId: ' ' })).toThrow()
  })

  it('keeps ordinary create and rename writes unchanged', () => {
    expect(researchTopicWriteSchema.parse({ kind: 'create', topicId: TOPIC_ID, title: '新主题' }))
      .toEqual({ kind: 'create', topicId: TOPIC_ID, title: '新主题' })
    expect(researchTopicWriteSchema.parse({ kind: 'rename', topicId: TOPIC_ID, title: '改名' }))
      .toEqual({ kind: 'rename', topicId: TOPIC_ID, title: '改名' })
  })

  it('rejects retired sidebar-only write commands without dropping legacy records', () => {
    expect(() => researchTopicWriteSchema.parse({ kind: 'create', topicId: TOPIC_ID, title: '新分类', workspaceId: 'ws-1' })).toThrow()
    expect(() => researchTopicWriteSchema.parse({ kind: 'delete', topicId: TOPIC_ID })).toThrow()
    expect(researchTopicSchema.parse({ ...legacyRecord(), workspaceId: 'ws-1' }).workspaceId).toBe('ws-1')
  })
})
