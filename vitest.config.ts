import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

const execArgv = process.allowedNodeEnvironmentFlags.has('--webstorage') ? ['--no-webstorage'] : []

export default defineConfig({
  resolve: {
    alias: {
      '@deepseek-ai/dsh-client-ui-primitives': resolve('tests/fixtures/ui-primitives.ts'),
    },
  },
  test: {
    include: ['tests/**/*.spec.{ts,tsx}'],
    exclude: ['tests/views.client.spec.tsx', 'tests/**/*.harness.spec.{ts,tsx}'],
    execArgv,
    pool: 'forks',
  },
})
