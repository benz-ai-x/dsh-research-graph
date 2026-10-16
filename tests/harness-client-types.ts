// These owners complete the public SlotMap referenced by the Conversation declarations.
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
// The built client types drop the side-effect import of the workspace package,
// whose index also declares the 'workspace' locale namespace the toast needs.
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
// The workspace toast factory is not re-exported by the package index, but the
// slots contract references it; pull the declaration so SlotFactoryMap is complete.
// check-harness-types.mjs maps this specifier to the built declaration.
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client/contract/toast'
