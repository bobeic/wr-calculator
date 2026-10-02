import type { AbilityHitProcEffect } from '@wr-calc/schema'
import type { EffectHandler, HookContext, HitInfo } from './types'
import { resolveScalar, scalarWarning } from '../resolve-scalar'
import { sumStatRatios } from './stat-ratios'

function cooldownKey(effect: AbilityHitProcEffect): string {
  return `abilityHitProc:${effect.id}`
}

function triggers(effect: AbilityHitProcEffect): NonNullable<AbilityHitProcEffect['triggeredBy']> {
  return effect.triggeredBy ?? ['ability']
}

/** Whether a basic attack counts for this proc; abilities go through onAbilityHit instead. */
function attackTriggers(effect: AbilityHitProcEffect, hit: HitInfo): boolean {
  if (hit.kind !== 'basicAttack') return false
  return triggers(effect).includes('basicAttack') || (hit.empowered && triggers(effect).includes('empoweredAttack'))
}

function tryProc(effect: AbilityHitProcEffect, ctx: HookContext): void {
  const cooldownResolved = resolveScalar(effect.cooldownSeconds, ctx.level)
  const cooldownWarning = scalarWarning(effect.name, 'cooldownSeconds', cooldownResolved)
  if (cooldownWarning) ctx.addDataWarning(cooldownWarning)

  const key = cooldownKey(effect)
  if (effect.oncePerCombo && ctx.self.buffs[`${key}:used`]) return
  const startsOnCooldown = effect.startOnCooldownInputId !== undefined
    && ctx.inputs[effect.startOnCooldownInputId] === true
  const availableAt = ctx.self.cooldowns[key] ?? (startsOnCooldown ? cooldownResolved.value : 0)
  if (!ctx.ignoreCooldowns && ctx.time < availableAt) return

  const damageResolved = resolveScalar(effect.damage, ctx.level)
  const damageWarning = scalarWarning(effect.name, 'damage', damageResolved)
  if (damageWarning) ctx.addDataWarning(damageWarning)

  let amount = damageResolved.value
  amount += sumStatRatios(effect.ratios, ctx.selfSheet, ctx.level, effect.name, ctx.addDataWarning)

  ctx.dealDamage({
    type: effect.damageType, amount,
    source: { kind: 'item', id: effect.id, name: effect.name },
  })
  ctx.self.cooldowns[key] = ctx.time + cooldownResolved.value
  if (effect.oncePerCombo) ctx.self.buffs[`${key}:used`] = {}
}

export const abilityHitProcHandler: EffectHandler<AbilityHitProcEffect> = {
  kind: 'abilityHitProc',
  hooks: {
    onAbilityHit(effect, ctx, _abilityKey, instances) {
      if (!triggers(effect).includes('ability')) return
      if (!instances.some((instance) => instance.raw > 0)) return
      tryProc(effect, ctx)
    },
    onHitLanded(effect, ctx, hit) {
      if (attackTriggers(effect, hit)) tryProc(effect, ctx)
    },
  },
}
