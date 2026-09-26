import type { CombatRampAmpEffect } from '@wr-calc/schema'
import type { EffectHandler } from './types'

export const combatRampAmpHandler: EffectHandler<CombatRampAmpEffect> = {
  kind: 'combatRampAmp',
  damageMultiplier(effect, ctx, input) {
    const startedAt = ctx.self.combatStartedAt
    if (startedAt === undefined) return 1
    if (effect.condition && !ctx.conditionMet(
      effect, effect.condition, { damageType: input.type, sourceKind: input.source.kind }
    )) return 1
    const stacks = Math.min(
      effect.maxStacks, Math.floor((ctx.time - startedAt) / effect.stackIntervalSeconds) + 1
    )
    return 1 + stacks * effect.amountPerStack
  },
}
