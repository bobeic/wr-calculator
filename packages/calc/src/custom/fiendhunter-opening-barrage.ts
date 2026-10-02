import type { CustomEffect } from '@wr-calc/schema'
import type { EffectHandler } from '../effects/types'
import { BASE_CRIT_DAMAGE_MULTIPLIER } from '../rules'

const CHARGES = 3
const WINDOW_SECONDS = 8
const COOLDOWN_SECONDS = 45
const ATTACK_SPEED = 0.5
const CRIT_DAMAGE_FACTOR = 0.8
const ALREADY_CRIT_TRUE_DAMAGE = 0.15

function key(effect: CustomEffect): string {
  return `custom:${effect.id}`
}

function liveCharges(effect: CustomEffect, buffs: Record<string, { expiresAt?: number; stacks?: number }>, time: number): number {
  const buff = buffs[key(effect)]
  return buff?.expiresAt !== undefined && buff.expiresAt >= time ? buff.stacks ?? 0 : 0
}

/**
 * Fiendhunter Bolts' Opening Barrage: for 8 seconds after the ultimate, the next 3 attacks gain 50% attack speed
 * and crit for 80% of normal crit damage; an attack that would have crit anyway gains 15% bonus true damage
 * instead, taken here as an expected value (crit chance x 15% of the attack). 45 second cooldown.
 */
export const fiendhunterOpeningBarrageHandler: EffectHandler<CustomEffect> = {
  kind: 'custom',
  hooks: {
    onAbilityCast(effect, ctx, abilityKey) {
      if (abilityKey !== 'r') return
      if (!ctx.ignoreCooldowns && ctx.time < (ctx.self.cooldowns[key(effect)] ?? 0)) return
      ctx.self.cooldowns[key(effect)] = ctx.time + COOLDOWN_SECONDS
      ctx.self.buffs[key(effect)] = { stacks: CHARGES, expiresAt: ctx.time + WINDOW_SECONDS }
    },
    beforeBasicAttack(effect, ctx) {
      const charges = liveCharges(effect, ctx.self.buffs, ctx.time)
      if (charges === 0) return undefined
      ctx.self.buffs[key(effect)].stacks = charges - 1
      const total = ctx.selfSheet.total
      const critMultiplier = CRIT_DAMAGE_FACTOR * (BASE_CRIT_DAMAGE_MULTIPLIER + (total.critDamage ?? 0))
      ctx.addUnverifiedRule('critDamageMultiplier')
      const alreadyCrit = Math.min(1, Math.max(0, total.critChance ?? 0))
      const trueDamage = alreadyCrit * ALREADY_CRIT_TRUE_DAMAGE * (total.ad ?? 0) * critMultiplier
      return {
        critMultiplier,
        ...(trueDamage > 0 && {
          bonus: [{ type: 'true' as const, amount: trueDamage, source: { kind: 'item' as const, id: effect.id, name: effect.name } }],
        }),
      }
    },
  },
  // The attack speed holds while charges remain, including for the attack that spends the last one.
  combatStats(effect, self, time) {
    return liveCharges(effect, self.buffs, time) > 0 ? [{ stat: 'attackSpeed', amount: ATTACK_SPEED }] : []
  },
}
