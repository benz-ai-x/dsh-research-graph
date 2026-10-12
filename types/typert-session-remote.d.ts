/**
 * Standalone module augmentation exposing the Host `session` Remote namespace
 * on `ctx.remote`. The Harness compiler faces resolve the same names from the
 * checkout's generated declarations instead; this file never enters those
 * entry-driven programs.
 */
export {}

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteMap {
    'session/selectModel': (
      request: import('@deepseek-ai/dsh-api-session-controller/remote').SessionSelectModelRequest,
    ) => Promise<import('@deepseek-ai/dsh-typert-protocol').RemoteResult<
      import('@deepseek-ai/dsh-api-session-controller/remote').SessionSelectModelValue
    >>
    'session/modelCatalog': () => Promise<import('@deepseek-ai/dsh-typert-protocol').RemoteResult<
      import('@deepseek-ai/dsh-api-session-controller/remote').ModelCatalog
    >>
    'session/rename': (
      request: import('@deepseek-ai/dsh-api-session-controller/remote').SessionRenameRequest,
    ) => Promise<import('@deepseek-ai/dsh-typert-protocol').RemoteResult<
      import('@deepseek-ai/dsh-api-session-controller/remote').SessionRenameValue
    >>
  }
  interface TypertRemoteNamespaceMap {
    session: {
      selectModel: TypertRemoteMap['session/selectModel']
      modelCatalog: TypertRemoteMap['session/modelCatalog']
      rename: TypertRemoteMap['session/rename']
    }
  }
}
