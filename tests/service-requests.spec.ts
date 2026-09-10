import { expect, it, vi } from 'vitest'
import { ServiceRequests } from '../src/service-requests.ts'

it('cancels admitted work and waits for it to settle before closing storage exactly once', async () => {
  const requests = new ServiceRequests('Test service')
  const entered = Promise.withResolvers<AbortSignal>()
  const finish = Promise.withResolvers<void>()
  const pending = requests.run(new AbortController().signal, async signal => {
    entered.resolve(signal)
    await finish.promise
    return 'late value'
  })
  const rejected = expect(pending).rejects.toThrow('disposed')
  const signal = await entered.promise
  const close = vi.fn(async () => {})
  const disposed = requests.dispose(close)
  expect(signal.aborted).toBe(true)
  expect(close).not.toHaveBeenCalled()
  expect(requests.dispose(close)).toBe(disposed)
  finish.resolve()
  await rejected
  await disposed
  expect(close).toHaveBeenCalledTimes(1)
  const operation = vi.fn(async () => 'unreachable')
  await expect(requests.run(new AbortController().signal, operation)).rejects.toThrow('disposed')
  expect(operation).not.toHaveBeenCalled()
})

it('rejects caller cancellation and returns detached results without mutating service-owned values', async () => {
  const requests = new ServiceRequests('Test service')
  const value = { sources: ['retained evidence'] }
  const result = await requests.run(new AbortController().signal, async () => value)
  result.sources.push('browser edit')
  expect(value.sources).toEqual(['retained evidence'])
  const controller = new AbortController()
  const operation = vi.fn(async () => value)
  controller.abort(new Error('Canceled by caller'))
  await expect(requests.run(controller.signal, operation)).rejects.toThrow('Canceled by caller')
  expect(operation).not.toHaveBeenCalled()
  await requests.dispose(async () => {})
})
