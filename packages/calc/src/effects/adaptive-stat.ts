import type { AdaptiveStatEffect } from '@wr-calc/schema'
import type { EffectHandler } from './types'
import { resolveAdaptiveDamageType } from '../rules'
import { resolveScalar, scalarWarning } from '../resolve-scalar'

export const adaptiveStatHandler: EffectHandler<AdaptiveStatEffect> = {
  kind: 'adaptiveStat',
  // After flat stats, so the choice sees every item's AD and AP.
  stage: 'conversion',
  contributeStats(effect, ctx) {
    let stacks = 1
    if (effect.stackInputId !== undefined) {
      const value = ctx.inputs[effect.stackInputId]
      stacks = Math.min(effect.maxStacks ?? Infinity, Math.max(0, typeof value === 'number' ? value : 0))
      if (stacks === 0) return []
    }
    const physical = resolveAdaptiveDamageType(ctx.statSoFar('ad', 'bonus'), ctx.statSoFar('ap', 'total')) === 'physical'
    const resolved = resolveScalar(physical ? effect.ad : effect.ap, ctx.level)
    return [{
      stat: physical ? 'ad' : 'ap', layer: 'bonus', amount: resolved.value * stacks,
      source: { kind: 'effect', id: effect.id, name: effect.name },
      dataWarning: scalarWarning(effect.name, physical ? 'ad' : 'ap', resolved),
      usedLevelRangeInterpolation: resolved.usedLevelRangeInterpolation,
    }]
  },
}
