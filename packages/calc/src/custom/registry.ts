import type { EffectHandler } from '../effects/types'

/**
 * Handler id -> implementation for `kind: 'custom'` effects that don't fit the declarative model.
 * Empty in Phase 1: no real champion kits are implemented until Step 6+ (real data skeletons).
 */
export const CUSTOM_HANDLERS: Record<string, EffectHandler> = {}
