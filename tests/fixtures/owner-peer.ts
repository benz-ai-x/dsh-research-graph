/** Owner Peers for direct Gateway calls, mirroring the Harness Gateway specs. */
import type { Context } from '@deepseek-ai/cordis'
import { Peer } from '@deepseek-ai/dsh-client-connection'
import type { PeerScope } from '@deepseek-ai/dsh-typert-protocol'

const owners = new WeakMap<Context, PeerScope>()

/**
 * The owner Peer of one test Context tree, created on first use. The Gateway
 * requires every invocation to name its Peer explicitly.
 * @param ctx - any Context of the tree; the Peer hangs under its root.
 * @returns the tree's shared owner Peer.
 */
export function ownerPeer(ctx: Context): PeerScope {
  let peer = owners.get(ctx.root)
  if (peer === undefined) {
    peer = new Peer(ctx.root, { principal: { kind: 'owner' } })
    owners.set(ctx.root, peer)
  }
  return peer
}
