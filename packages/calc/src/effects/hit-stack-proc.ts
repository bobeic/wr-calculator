import type { HitStackProcEffect } from '@wr-calc/schema'
import type { EffectHandler, HitInfo } from './types'
import { effectDamageType } from './damage-type'
import { resolveScalar, scalarWarning } from '../resolve-scalar'

function key(effect: HitStackProcEffect): string {
  return `hitStackProc:${effect.id}`
}

function countsHit(effect: HitStackProcEffect, hit: HitInfo): boolean {
  if (hit.kind === 'ability') return effect.stacksFrom.includes('ability')
  return effect.stacksFrom.includes('basicAttack')
    || (hit.empowered && effect.stacksFrom.includes('empoweredAttack'))
}

export const hitStackProcHandler: EffectHandler<HitStackProcEffect> = {
  kind: 'hitStackProc',
  hooks: {
    onHitLanded(effect, ctx, hit) {
      if (!countsHit(effect, hit)) return
      const stackKey = key(effect)
      if (!ctx.ignoreCooldowns && ctx.time < (ctx.self.cooldowns[stackKey] ?? 0)) return

      const existing = ctx.opponent.buffs[stackKey]
      const live = existing?.expiresAt !== undefined && existing.expiresAt >= ctx.time
        ? existing.stacks ?? 0 : 0
      const stacks = live + 1
      if (stacks < effect.stacksToProc) {
        ctx.opponent.buffs[stackKey] = { stacks, expiresAt: ctx.time + effect.stackWindowSeconds }
        return
      }
      delete ctx.opponent.buffs[stackKey]
      const cooldown = resolveScalar(effect.cooldownSeconds, ctx.level)
      const cooldownWarning = scalarWarning(effect.name, 'cooldownSeconds', cooldown)
      if (cooldownWarning) ctx.addDataWarning(cooldownWarning)
      ctx.self.cooldowns[stackKey] = ctx.time + cooldown.value

      if (!ctx.resolveComponent) {
        throw new Error('hitStackProc: HookContext.resolveComponent is required')
      }
      const component = effect.adaptive ? { ...effect.damage, type: effectDamageType('adaptive', ctx) } : effect.damage
      const resolved = ctx.resolveComponent(component, effect.name)
      resolved.dataWarnings.forEach((warning) => ctx.addDataWarning(warning))
      const source = { kind: 'item' as const, id: effect.id, name: effect.name }
      if (effect.delivery.kind === 'instant') {
        ctx.dealDamage({ type: resolved.type, amount: resolved.amount, source })
        return
      }
      // Damage over time: the per-tick amount is read now, when the proc fires.
      const { tickIntervalSeconds, durationSeconds } = effect.delivery
      const ticks = Math.round(durationSeconds / tickIntervalSeconds)
      for (let tick = 1; tick <= ticks; tick++) {
        ctx.scheduleEvent?.(ctx.time + tick * tickIntervalSeconds, (later) => {
          later.dealDamage({ type: resolved.type, amount: resolved.amount, source })
        }, stackKey)
      }
    },
  },
}
