// These owners complete the public SlotMap referenced by the Conversation declarations.
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
// The sidebar and workspace browsing surfaces are vendored into this package
// (the bundle patch disables the official rows), so their slot, locale, and
// toast declarations come from src/client/sidebar and src/client/workspace —
// pulling the official packages here would double-declare the 'sidebar' and
// 'workspace' locale namespaces against the vendored copies.
