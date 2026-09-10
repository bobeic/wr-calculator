import type { StackingEffect } from '@wr-calc/schema'
import type { EffectHandler } from './types'
import { resolveScalar, scalarWarning } from '../resolve-scalar'

export const stackingHandler: EffectHandler<StackingEffect> = {
  kind: 'stacking',
  stage: 'flat',
  contributeStats(effect, ctx) {
    const rawStacks = ctx.inputs[effect.stackInputId]
    const stacks = typeof rawStacks === 'number' ? Math.max(0, Math.min(rawStacks, effect.maxStacks)) : 0
    const resolved = resolveScalar(effect.perStack, ctx.level)
    return [{
      stat: effect.stat,
      layer: 'bonus',
      amount: resolved.value * stacks,
      source: { kind: 'effect', id: effect.id, name: effect.name },
      dataWarning: scalarWarning(effect.name, 'perStack', resolved),
      usedLevelRangeInterpolation: resolved.usedLevelRangeInterpolation,
    }]
  },
}
