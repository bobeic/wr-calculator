import type { StatEffect } from '@wr-calc/schema'
import type { EffectHandler } from './types'
import { resolveScalar, scalarWarning } from '../resolve-scalar'

export const statHandler: EffectHandler<StatEffect> = {
  kind: 'stat',
  stage: 'flat',
  contributeStats(effect, ctx) {
    const resolved = resolveScalar(effect.amount, ctx.level)
    return [{
      stat: effect.stat,
      layer: 'bonus',
      amount: resolved.value,
      source: { kind: 'effect', id: effect.id, name: effect.name },
      dataWarning: scalarWarning(effect.name, 'amount', resolved),
      usedLevelRangeInterpolation: resolved.usedLevelRangeInterpolation,
    }]
  },
}
