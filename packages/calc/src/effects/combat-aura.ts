import type { CombatAuraEffect } from '@wr-calc/schema'
import type { EffectHandler, HookContext } from './types'

function key(effect: CombatAuraEffect): string {
  return `combatAura:${effect.id}`
}

function scheduleTick(effect: CombatAuraEffect, ctx: HookContext, at: number): void {
  ctx.scheduleEvent?.(at, (later) => {
    const lastDamageAt = later.self.buffs[key(effect)]?.data?.lastDamageAt ?? at
    if (later.time - lastDamageAt > effect.combatWindowSeconds) {
      delete later.self.buffs[key(effect)]
      return
    }
    if (!later.resolveComponent) throw new Error('combatAura: HookContext.resolveComponent is required')
    const resolved = later.resolveComponent(effect.damage, effect.name)
    resolved.dataWarnings.forEach((warning) => later.addDataWarning(warning))
    later.dealDamage({ type: resolved.type, amount: resolved.amount, source: { kind: 'item', id: effect.id, name: effect.name } })
    scheduleTick(effect, later, later.time + effect.tickIntervalSeconds)
  }, key(effect), { quiet: true })
}

export const combatAuraHandler: EffectHandler<CombatAuraEffect> = {
  kind: 'combatAura',
  hooks: {
    onDamageDealt(effect, ctx, instance) {
      // The aura's own ticks don't keep combat going.
      if (instance.source.id === effect.id) return
      const buffKey = key(effect)
      const running = ctx.self.buffs[buffKey] !== undefined
      ctx.self.buffs[buffKey] = { data: { lastDamageAt: ctx.time } }
      if (!running) scheduleTick(effect, ctx, ctx.time + effect.tickIntervalSeconds)
    },
  },
}
