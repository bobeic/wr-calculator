import type { ActiveEffect } from '@wr-calc/schema'
import type { EffectHandler } from './types'
import { resolveScalar, scalarWarning } from '../resolve-scalar'
import { sumStatRatios } from './stat-ratios'

export const activeHandler: EffectHandler<ActiveEffect> = {
  kind: 'active',
  activate(effect, ctx) {
    if (effect.damage === undefined || effect.damageType === undefined) return
    const resolved = resolveScalar(effect.damage, ctx.level)
    const warning = scalarWarning(effect.name, 'damage', resolved)
    if (warning) ctx.addDataWarning(warning)

    let amount = resolved.value
    amount += sumStatRatios(effect.ratios ?? [], ctx.selfSheet, ctx.level, effect.name, ctx.addDataWarning)

    if (effect.targetMaxHpRatio !== undefined) {
      const hpRatio = resolveScalar(effect.targetMaxHpRatio, ctx.level)
      const hpRatioWarning = scalarWarning(effect.name, 'targetMaxHpRatio', hpRatio)
      if (hpRatioWarning) ctx.addDataWarning(hpRatioWarning)
      amount += (ctx.opponentSheet.total.hp ?? 0) * hpRatio.value
    }

    const source = { kind: 'item' as const, id: effect.id, name: effect.name }
    ctx.dealDamage({ type: effect.damageType, amount, source })
    const extraHits = effect.extraHits ?? { count: 0, fraction: 0 }
    for (let hit = 0; hit < extraHits.count; hit++) {
      ctx.dealDamage({ type: effect.damageType, amount: amount * extraHits.fraction, source })
    }
  },
}
