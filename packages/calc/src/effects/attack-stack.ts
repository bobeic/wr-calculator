import type { AttackStackEffect } from '@wr-calc/schema'
import type { CombatStat, EffectHandler } from './types'
import { resolveAdaptiveDamageType } from '../rules'
import { resolveScalar } from '../resolve-scalar'

function key(effect: AttackStackEffect): string {
  return `attackStack:${effect.id}`
}

export const attackStackHandler: EffectHandler<AttackStackEffect> = {
  kind: 'attackStack',
  hooks: {
    onHitLanded(effect, ctx, hit) {
      if (!(effect.stacksFrom ?? ['basicAttack']).includes(hit.kind)) return
      const buffKey = key(effect)
      const counter = `${buffKey}:hits`
      const hits = (ctx.self.buffs[counter]?.stacks ?? 0) + 1
      ctx.self.buffs[counter] = { stacks: hits }
      const every = effect.every ?? 1
      const startAt = effect.startAt ?? 1
      if (hits < startAt || (hits - startAt) % every !== 0) return

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
  combatStats(effect, self, time, { level, sheet }): CombatStat[] {
    const buff = self.buffs[key(effect)]
    if (buff?.expiresAt === undefined || buff.expiresAt < time || !buff.stacks) return []
    if (effect.adaptive) {
      // Decided on the stats before combat, so the stacks themselves don't flip the choice.
      const physical = resolveAdaptiveDamageType(sheet.bonus.ad ?? 0, sheet.total.ap ?? 0) === 'physical'
      const perStack = resolveScalar(physical ? effect.adaptive.ad : effect.adaptive.ap, level).value
      return [{ stat: physical ? 'ad' : 'ap', amount: perStack * buff.stacks }]
    }
    if (effect.stat === undefined || effect.amountPerStack === undefined) {
      throw new Error(`attackStack ${effect.id}: give stat and amountPerStack, or adaptive`)
    }
    return [{ stat: effect.stat, amount: resolveScalar(effect.amountPerStack, level).value * buff.stacks }]
  },
}
