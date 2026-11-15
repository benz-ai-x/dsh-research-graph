import z from '@deepseek-ai/schemastery'
import type { SessionDigestRouteFallback } from './session-digest-harness.ts'

/** Optional auxiliary-model, bounded output, and Session Backup upload policy. */
export interface Config {
  readonly provider?: string
  readonly model?: string
  readonly maxOutputTokens?: number
  readonly timeoutMs?: number
  readonly backupMaxUploadBytes?: number
  readonly backupMaxEntryBytes?: number
}

export interface ResolvedConfig {
  readonly route?: SessionDigestRouteFallback
  readonly maxOutputTokens: number
  readonly timeoutMs: number
  readonly backupMaxUploadBytes?: number
  readonly backupMaxEntryBytes?: number
}

// Providers may count reasoning against the same output budget as the digest JSON.
const DEFAULT_MAX_OUTPUT_TOKENS = 4_096
const DEFAULT_TIMEOUT_MS = 60_000

const limits = z.object({
  maxOutputTokens: z.number()
    .step(1)
    .min(1)
    .max(Number.MAX_SAFE_INTEGER)
    .default(DEFAULT_MAX_OUTPUT_TOKENS),
  timeoutMs: z.number()
    .step(1)
    .min(1)
    .max(Number.MAX_SAFE_INTEGER)
    .default(DEFAULT_TIMEOUT_MS),
})

const route = z.union([
  z.object({
    provider: z.string().pattern(/\S/).required(),
    model: z.string().pattern(/\S/).required(),
  }),
  z.object({
    provider: z.never(),
    model: z.never(),
  }),
])

const backupLimits = z.object({
  backupMaxUploadBytes: z.union([z.number().step(1).min(1).max(Number.MAX_SAFE_INTEGER), z.never()]),
  backupMaxEntryBytes: z.union([z.number().step(1).min(1).max(Number.MAX_SAFE_INTEGER), z.never()]),
})

/** Loader-facing runtime schema shared by direct callers and plugin activation. */
export const Config: z<Config> = z.intersect([limits, route, backupLimits]) as z<Config>

/** Validate, default, and normalize configuration before runtime use. */
export function resolveConfig(config: Config = {}): ResolvedConfig {
  const validated = Config(config)
  const provider = validated.provider?.trim()
  const model = validated.model?.trim()
  return {
    ...(provider === undefined || model === undefined
      ? {}
      : { route: { provider, model } }),
    maxOutputTokens: validated.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
    timeoutMs: validated.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    ...(validated.backupMaxUploadBytes === undefined ? {} : { backupMaxUploadBytes: validated.backupMaxUploadBytes }),
    ...(validated.backupMaxEntryBytes === undefined ? {} : { backupMaxEntryBytes: validated.backupMaxEntryBytes }),
  }
}
