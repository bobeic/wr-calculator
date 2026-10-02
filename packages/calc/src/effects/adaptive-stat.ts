import type { AdaptiveStatEffect } from '@wr-calc/schema'
import type { EffectHandler } from './types'
import { resolveAdaptiveDamageType } from '../rules'

export const adaptiveStatHandler: EffectHandler<AdaptiveStatEffect> = {
  kind: 'adaptiveStat',
  // After flat stats, so the choice sees every item's AD and AP.
  stage: 'conversion',
  contributeStats(effect, ctx) {
    const physical = resolveAdaptiveDamageType(ctx.statSoFar('ad', 'bonus'), ctx.statSoFar('ap', 'total')) === 'physical'
    return [{
      stat: physical ? 'ad' : 'ap', layer: 'bonus', amount: physical ? effect.ad : effect.ap,
      source: { kind: 'effect', id: effect.id, name: effect.name }, usedLevelRangeInterpolation: false,
    }]
  },
}
