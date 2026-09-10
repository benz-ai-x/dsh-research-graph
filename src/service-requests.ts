/** Owns cancellable service work and closes storage only after admitted requests settle. */
export class ServiceRequests {
  private readonly lifecycle = new AbortController()
  private readonly active = new Set<Promise<unknown>>()
  private disposal: Promise<void> | undefined

  constructor(private readonly name: string) {}

  run<Value>(signal: AbortSignal, operation: (signal: AbortSignal) => Promise<Value>): Promise<Value> {
    const combined = AbortSignal.any([signal, this.lifecycle.signal])
    const pending = Promise.resolve().then(async () => {
      combined.throwIfAborted()
      const value = await operation(combined)
      combined.throwIfAborted()
      return structuredClone(value)
    })
    this.active.add(pending)
    const release = (): void => { this.active.delete(pending) }
    void pending.then(release, release)
    return pending
  }

  dispose(close: () => Promise<void>): Promise<void> {
    if (this.disposal !== undefined) return this.disposal
    this.lifecycle.abort(new Error(`${this.name} is disposed`))
    this.disposal = Promise.allSettled([...this.active]).then(close)
    return this.disposal
  }
}
