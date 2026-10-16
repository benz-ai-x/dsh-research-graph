/**
 * Standalone declaration of the Host default-model service the branch flow
 * installs on its resumed Agents. The Harness compiler faces resolve the
 * package itself; this stub serves the standalone typecheck via tsconfig paths.
 */
import '@deepseek-ai/cordis'

declare module '@deepseek-ai/cordis' {
  interface Context {
    readonly agentDefaultModel: {
      currentSelection: () => { readonly provider: string; readonly model: string }
    }
  }
}
