import type { AbilityHitProcEffect } from '@wr-calc/schema'
import type { EffectHandler } from './types'
import { resolveScalar, scalarWarning } from '../resolve-scalar'

function cooldownKey(effect: AbilityHitProcEffect): string {
  return `abilityHitProc:${effect.id}`
}

export const abilityHitProcHandler: EffectHandler<AbilityHitProcEffect> = {
  kind: 'abilityHitProc',
  hooks: {
    onAbilityHit(effect, ctx, _abilityKey, instances) {
      if (!instances.some((instance) => instance.raw > 0)) return

      const cooldownResolved = resolveScalar(effect.cooldownSeconds, ctx.level)
      const cooldownWarning = scalarWarning(effect.name, 'cooldownSeconds', cooldownResolved)
      if (cooldownWarning) ctx.addDataWarning(cooldownWarning)

      const key = cooldownKey(effect)
      const startsOnCooldown = effect.startOnCooldownInputId !== undefined
        && ctx.inputs[effect.startOnCooldownInputId] === true
      const availableAt = ctx.self.cooldowns[key] ?? (startsOnCooldown ? cooldownResolved.value : 0)
      if (!ctx.ignoreCooldowns && ctx.time < availableAt) return

      const damageResolved = resolveScalar(effect.damage, ctx.level)
      const damageWarning = scalarWarning(effect.name, 'damage', damageResolved)
      if (damageWarning) ctx.addDataWarning(damageWarning)

      let amount = damageResolved.value
      for (const ratio of effect.ratios) {
        const ratioResolved = resolveScalar(ratio.value, ctx.level)
        const ratioWarning = scalarWarning(effect.name, `ratios.${ratio.stat}`, ratioResolved)
        if (ratioWarning) ctx.addDataWarning(ratioWarning)
        amount += (ctx.selfSheet.total[ratio.stat] ?? 0) * ratioResolved.value
      }

      ctx.dealDamage({
        type: effect.damageType, amount,
        source: { kind: 'item', id: effect.id, name: effect.name },
      })
      ctx.self.cooldowns[key] = ctx.time + cooldownResolved.value
    },
  },
}
