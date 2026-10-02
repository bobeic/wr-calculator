import type { AttackStackEffect } from '@wr-calc/schema'
import type { EffectHandler } from './types'

function key(effect: AttackStackEffect): string {
  return `attackStack:${effect.id}`
}

export const attackStackHandler: EffectHandler<AttackStackEffect> = {
  kind: 'attackStack',
  hooks: {
    onHitLanded(effect, ctx, hit) {
      if (hit.kind !== 'basicAttack') return
      const buffKey = key(effect)
      const counter = `${buffKey}:attacks`
      const attacks = (ctx.self.buffs[counter]?.stacks ?? 0) + 1
      ctx.self.buffs[counter] = { stacks: attacks }
      const every = effect.every ?? 1
      const startAt = effect.startAt ?? 1
      if (attacks < startAt || (attacks - startAt) % every !== 0) return

      const existing = ctx.self.buffs[buffKey]
      const live = existing?.expiresAt !== undefined && existing.expiresAt >= ctx.time ? existing.stacks ?? 0 : 0
      if (effect.cooldownSeconds !== undefined) {
        if (live > 0) return
        if (!ctx.ignoreCooldowns && ctx.time < (ctx.self.cooldowns[buffKey] ?? 0)) return
        ctx.self.cooldowns[buffKey] = ctx.time + effect.cooldownSeconds
      }
      ctx.self.buffs[buffKey] = {
        stacks: Math.min(effect.maxStacks, live + 1), expiresAt: ctx.time + effect.durationSeconds,
      }
    },
  },
  combatStats(effect, self, time) {
    const buff = self.buffs[key(effect)]
    if (buff?.expiresAt === undefined || buff.expiresAt < time || !buff.stacks) return []
    return [{ stat: effect.stat, amount: effect.amountPerStack * buff.stacks }]
  },
}
