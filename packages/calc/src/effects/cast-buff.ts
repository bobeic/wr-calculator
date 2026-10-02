import type { CastBuffEffect } from '@wr-calc/schema'
import type { EffectHandler } from './types'
import { resolveScalar } from '../resolve-scalar'

function key(effect: CastBuffEffect): string {
  return `castBuff:${effect.id}`
}

export const castBuffHandler: EffectHandler<CastBuffEffect> = {
  kind: 'castBuff',
  hooks: {
    onAbilityCast(effect, ctx, abilityKey) {
      if (!effect.slots.includes(abilityKey)) return
      const buffKey = key(effect)
      if (!ctx.ignoreCooldowns && ctx.time < (ctx.self.cooldowns[buffKey] ?? 0)) return
      ctx.self.cooldowns[buffKey] = ctx.time + effect.cooldownSeconds
      ctx.self.buffs[buffKey] = {
        expiresAt: ctx.time + effect.durationSeconds,
        ...(effect.charges !== undefined && { stacks: effect.charges }),
      }
    },
    // Spends a charge after the attack, so the attack that spends the last one still had the buff.
    onHitLanded(effect, ctx, hit) {
      if (effect.charges === undefined || hit.kind !== 'basicAttack') return
      const buff = ctx.self.buffs[key(effect)]
      if (buff?.stacks === undefined || buff.expiresAt === undefined || buff.expiresAt < ctx.time) return
      buff.stacks -= 1
      if (buff.stacks <= 0) delete ctx.self.buffs[key(effect)]
    },
  },
  combatStats(effect, self, time, { level }) {
    const buff = self.buffs[key(effect)]
    if (buff?.expiresAt === undefined || buff.expiresAt < time) return []
    return [{ stat: effect.stat, amount: resolveScalar(effect.amount, level).value }]
  },
}
