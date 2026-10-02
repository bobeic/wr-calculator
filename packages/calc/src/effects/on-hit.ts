import type { OnHitEffect, NullableScalar } from '@wr-calc/schema'
import { effectDamageType } from './damage-type'
import type { EffectHandler } from './types'
import { resolveScalar, scalarWarning } from '../resolve-scalar'
import { sumStatRatios } from './stat-ratios'

export const onHitHandler: EffectHandler<OnHitEffect> = {
  kind: 'onHit',
  hooks: {
    onBasicAttack(effect, ctx) {
      const part = (scalar: NullableScalar | undefined, label: string): number => {
        if (scalar === undefined) return 0
        const resolved = resolveScalar(scalar, ctx.level)
        const warning = scalarWarning(effect.name, label, resolved)
        if (warning) ctx.addDataWarning(warning)
        return resolved.value
      }

      let amount = part(effect.flat, 'flat')
      amount += part(effect.pctTargetCurrentHp, 'pctTargetCurrentHp') * ctx.opponent.currentHp
      const targetMaxHp = ctx.opponentSheet.total.hp ?? 0
      amount += part(effect.pctTargetMaxHp, 'pctTargetMaxHp') * targetMaxHp
      amount += part(effect.pctTargetMissingHp, 'pctTargetMissingHp')
        * Math.max(0, targetMaxHp - ctx.opponent.currentHp)
      if (effect.pctOwnStat) {
        const statValue = ctx.selfSheet[effect.pctOwnStat.layer ?? 'total'][effect.pctOwnStat.stat] ?? 0
        amount += part(effect.pctOwnStat.ratio, 'pctOwnStat.ratio') * statValue
      }
      amount += sumStatRatios(effect.ratios ?? [], ctx.selfSheet, ctx.level, effect.name, ctx.addDataWarning)
      if (effect.minDamage !== undefined) {
        amount = Math.max(amount, part(effect.minDamage, 'minDamage'))
      }
      if (effect.maxDamage !== undefined) {
        amount = Math.min(amount, part(effect.maxDamage, 'maxDamage'))
      }

      ctx.dealDamage({
        type: effectDamageType(effect.damageType, ctx), amount,
        source: { kind: 'item', id: effect.id, name: effect.name },
      })
    },
  },
}
