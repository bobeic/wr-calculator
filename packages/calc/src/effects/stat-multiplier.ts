import type { StatMultiplierEffect } from '@wr-calc/schema'
import type { EffectHandler } from './types'
import { resolveScalar, scalarWarning } from '../resolve-scalar'

export const statMultiplierHandler: EffectHandler<StatMultiplierEffect> = {
  kind: 'statMultiplier',
  stage: 'multiplier',
  contributeStats(effect, ctx) {
    const basis = ctx.statSoFar(effect.stat, effect.layer)
    const resolved = resolveScalar(effect.amount, ctx.level)
    return [{
      stat: effect.stat,
      layer: 'bonus',
      amount: basis * resolved.value,
      source: { kind: 'effect', id: effect.id, name: effect.name },
      dataWarning: scalarWarning(effect.name, 'amount', resolved),
      usedLevelRangeInterpolation: resolved.usedLevelRangeInterpolation,
    }]
  },
}
