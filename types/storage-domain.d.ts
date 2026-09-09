/** Standalone compiler face only; Harness checks resolve the real public types. */
declare module '@deepseek-ai/dsh-storage-domain' {
  export interface DomainSpec {
    readonly name: string
    readonly version: number
    readonly tables: Record<string, { readonly valueSchema: import('zod').ZodType }>
  }

  export interface KvTable<Key extends string, Value> {
    get(key: Key): Value | undefined
    entries(): IterableIterator<[Key, Value]>
    put(key: Key, value: Value): Promise<void>
    delete(key: Key): Promise<boolean>
  }

  export interface Domain<Spec extends DomainSpec> {
    table<Name extends keyof Spec['tables'] & string>(name: Name): KvTable<string, import('zod').output<Spec['tables'][Name]['valueSchema']>>
    close(): Promise<void>
  }
}
