/**
 * Package-owned invariant companion for `@benz-ai-x/dsh-research-graph`.
 * @module @benz-ai-x/dsh-research-graph/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@benz-ai-x/dsh-research-graph'

/** Cordis companion plugin name. */
export const name = 'research-graph-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No additional cross-plugin event invariant. Session facts remain owned by
 * Harness; topic records are validated and committed through its Storage
 * Domain contract. Public Gateway and registered-view behavior specs cover
 * topic durability, source immutability, cancellation, and effect disposal.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
