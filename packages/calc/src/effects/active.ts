import type { ActiveEffect } from '@wr-calc/schema'
import type { EffectHandler } from './types'
import { resolveScalar, scalarWarning } from '../resolve-scalar'

export const activeHandler: EffectHandler<ActiveEffect> = {
  kind: 'active',
  activate(effect, ctx) {
    if (effect.damage === undefined || effect.damageType === undefined) return
    const resolved = resolveScalar(effect.damage, ctx.level)
    const warning = scalarWarning(effect.name, 'damage', resolved)
    if (warning) ctx.addDataWarning(warning)

    let amount = resolved.value
    for (const ratio of effect.ratios ?? []) {
      const ratioResolved = resolveScalar(ratio.value, ctx.level)
      const ratioWarning = scalarWarning(effect.name, `ratios.${ratio.stat}`, ratioResolved)
      if (ratioWarning) ctx.addDataWarning(ratioWarning)
      amount += (ctx.selfSheet.total[ratio.stat] ?? 0) * ratioResolved.value
    }

    const source = { kind: 'item' as const, id: effect.id, name: effect.name }
    ctx.dealDamage({ type: effect.damageType, amount, source })
    const extraHits = effect.extraHits ?? { count: 0, fraction: 0 }
    for (let hit = 0; hit < extraHits.count; hit++) {
      ctx.dealDamage({ type: effect.damageType, amount: amount * extraHits.fraction, source })
    }
  },
}
