import * as TypertProtocol from '@deepseek-ai/dsh-typert-protocol'

interface RemoteFailurePayload {
  readonly code: string
  readonly message: string
  readonly details: object
}

type RemoteErrorConstructor = new (
  code: string,
  message: string,
  details: object,
) => Error

type LegacyRemoteFailureConstructor = new (failure: RemoteFailurePayload) => Error

/**
 * Construct a transport-visible business failure across the alpha.1/alpha.2
 * Typert error-vocabulary transition. Reflective lookup is intentional: a
 * static named import makes Node reject the whole plugin before this adapter
 * can select the constructor exposed by the active Harness profile.
 */
export function remoteFailure(failure: RemoteFailurePayload): Error {
  const RemoteError = Reflect.get(TypertProtocol, 'RemoteError') as
    | RemoteErrorConstructor
    | undefined
  if (typeof RemoteError === 'function') {
    return new RemoteError(failure.code, failure.message, failure.details)
  }
  const TypertRemoteFailure = Reflect.get(TypertProtocol, 'TypertRemoteFailure') as
    | LegacyRemoteFailureConstructor
    | undefined
  if (typeof TypertRemoteFailure === 'function') return new TypertRemoteFailure(failure)
  throw new Error('Session Graph requires a supported DSH Remote failure constructor')
}
