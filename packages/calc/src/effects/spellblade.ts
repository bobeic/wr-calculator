import type { SpellbladeEffect } from '@wr-calc/schema'
import type { EffectHandler } from './types'
import { resolveScalar, scalarWarning } from '../resolve-scalar'

function buffKey(effect: SpellbladeEffect): string {
  return `spellblade:${effect.id}`
}

export const spellbladeHandler: EffectHandler<SpellbladeEffect> = {
  kind: 'spellblade',
  hooks: {
    onAbilityCast(effect, ctx) {
      const key = buffKey(effect)
      const availableAt = ctx.self.cooldowns[key] ?? 0
      if (!ctx.ignoreCooldowns && ctx.time < availableAt) return
      ctx.self.buffs[key] = {}
    },
    beforeBasicAttack(effect, ctx) {
      const key = buffKey(effect)
      if (!ctx.self.buffs[key]) return undefined
      delete ctx.self.buffs[key]

      const icdResolved = resolveScalar(effect.internalCooldownSeconds, ctx.level)
      const icdWarning = scalarWarning(effect.name, 'internalCooldownSeconds', icdResolved)
      if (icdWarning) ctx.addDataWarning(icdWarning)
      ctx.self.cooldowns[key] = ctx.time + icdResolved.value

      const bonusResolved = resolveScalar(effect.bonusDamage, ctx.level)
      const bonusWarning = scalarWarning(effect.name, 'bonusDamage', bonusResolved)
      if (bonusWarning) ctx.addDataWarning(bonusWarning)

      let amount = bonusResolved.value
      for (const ratio of effect.ratios) {
        const statValue = ctx.selfSheet[ratio.layer ?? 'total'][ratio.stat] ?? 0
        const ratioResolved = resolveScalar(ratio.value, ctx.level)
        const ratioWarning = scalarWarning(effect.name, `ratios.${ratio.stat}`, ratioResolved)
        if (ratioWarning) ctx.addDataWarning(ratioWarning)
        amount += statValue * ratioResolved.value
      }

      if (effect.pctTargetMaxHp !== undefined) {
        const hpResolved = resolveScalar(effect.pctTargetMaxHp, ctx.level)
        const hpWarning = scalarWarning(effect.name, 'pctTargetMaxHp', hpResolved)
        if (hpWarning) ctx.addDataWarning(hpWarning)
        amount += (ctx.opponentSheet.total.hp ?? 0) * hpResolved.value
      }
      return {
        // "Shortly afterward" in game; applied right after the attack here.
        ...(effect.extraOnHitApplications !== undefined && { extraOnHitApplications: effect.extraOnHitApplications }),
        bonus: [{
          type: effect.damageType, amount,
          source: { kind: 'item', id: effect.id, name: effect.name },
        }],
      }
    },
  },
}
