import { z } from 'zod'
import type { ResearchTopic } from './research-topic.ts'
import { researchTopicSchema } from './research-topic-codec.ts'

/** Adapt the shared protocol validator to the Host Storage Domain schema. */
export const researchTopicStorageSchema: z.ZodType<ResearchTopic> = z.unknown().transform((value, context) => {
  try {
    return researchTopicSchema.parse(value)
  } catch {
    context.addIssue({ code: 'custom', message: 'Invalid Research Topic record' })
    return z.NEVER
  }
})
