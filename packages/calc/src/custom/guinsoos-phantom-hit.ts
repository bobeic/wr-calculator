import type { CustomEffect } from '@wr-calc/schema'
import type { EffectHandler } from '../effects/types'

/** Guinsoo's Rageblade's Seething Strike stacks (an attackStack effect with this id). */
export const SEETHING_STRIKE_ID = 'guinsoos-rageblade-seething-strike'
const SEETHING_MAX_STACKS = 4
const ATTACKS_PER_PHANTOM_HIT = 3

/**
 * Guinsoo's Rageblade: at max Seething Strike stacks, every third basic attack applies on-hit effects once more.
 * Counts attacks made while already at max stacks.
 */
export const guinsoosPhantomHitHandler: EffectHandler<CustomEffect> = {
  kind: 'custom',
  hooks: {
    beforeBasicAttack(effect, ctx) {
      const seething = ctx.self.buffs[`attackStack:${SEETHING_STRIKE_ID}`]
      const atMax = seething?.expiresAt !== undefined && seething.expiresAt >= ctx.time
        && (seething.stacks ?? 0) >= SEETHING_MAX_STACKS
      const key = `custom:${effect.id}`
      if (!atMax) {
        delete ctx.self.buffs[key]
        return undefined
      }
      const count = (ctx.self.buffs[key]?.stacks ?? 0) + 1
      if (count < ATTACKS_PER_PHANTOM_HIT) {
        ctx.self.buffs[key] = { stacks: count }
        return undefined
      }
      ctx.self.buffs[key] = { stacks: 0 }
      return { extraOnHitApplications: 1 }
    },
  },
}
