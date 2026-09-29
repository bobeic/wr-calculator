import type { StatConversionEffect } from '@wr-calc/schema'
import type { EffectHandler } from './types'
import { resolveScalar, scalarWarning } from '../resolve-scalar'

export const statConversionHandler: EffectHandler<StatConversionEffect> = {
  kind: 'statConversion',
  stage: 'conversion',
  contributeStats(effect, ctx) {
    const basis = ctx.statSoFar(effect.fromStat, effect.fromLayer ?? 'total')
    const resolved = resolveScalar(effect.ratio, ctx.level)
    return [{
      stat: effect.toStat,
      layer: 'bonus',
      amount: basis * resolved.value,
      source: { kind: 'effect', id: effect.id, name: effect.name },
      dataWarning: scalarWarning(effect.name, 'ratio', resolved),
      usedLevelRangeInterpolation: resolved.usedLevelRangeInterpolation,
    }]
  },
}
