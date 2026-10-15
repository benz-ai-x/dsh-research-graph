/** Owner Peer for direct Gateway calls from real-profile smoke fixtures. */
import { Peer } from '@deepseek-ai/dsh-client-connection'

const owners = new WeakMap()

/**
 * The owner Peer of one Host Context tree, created on first use. The Gateway
 * requires every invocation to name its Peer explicitly.
 * @param ctx - any Context of the tree; the Peer hangs under its root.
 * @returns the tree's shared owner Peer.
 */
export function ownerPeer(ctx) {
  let peer = owners.get(ctx.root)
  if (peer === undefined) {
    peer = new Peer(ctx.root, { principal: { kind: 'owner' } })
    owners.set(ctx.root, peer)
  }
  return peer
}
