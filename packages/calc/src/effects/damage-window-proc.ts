import type { DamageWindowProcEffect } from '@wr-calc/schema'
import type { EffectHandler } from './types'
import { resolveScalar, scalarWarning } from '../resolve-scalar'

function stateKey(effect: DamageWindowProcEffect): string {
  return `damageWindowProc:${effect.id}`
}

export const damageWindowProcHandler: EffectHandler<DamageWindowProcEffect> = {
  kind: 'damageWindowProc',
  hooks: {
    onDamageDealt(effect, ctx, instance) {
      if (instance.source.id === effect.id) return
      const key = stateKey(effect)
      const availableAt = ctx.self.cooldowns[key] ?? 0
      if (!ctx.ignoreCooldowns && instance.time < availableAt) return

      // Damage history lives in the buff's data, keyed by hit time (seconds, as a string).
      const history: Record<string, number> = {}
      const windowStart = instance.time - effect.windowSeconds
      for (const [time, amount] of Object.entries(ctx.self.buffs[key]?.data ?? {})) {
        if (Number(time) >= windowStart) history[time] = amount
      }
      const timeKey = String(instance.time)
      history[timeKey] = (history[timeKey] ?? 0) + instance.mitigated

      const total = Object.values(history).reduce((sum, amount) => sum + amount, 0)
      const threshold = effect.targetMaxHpFraction * (ctx.opponentSheet.total.hp ?? 0)
      if (threshold <= 0 || total < threshold) {
        ctx.self.buffs[key] = { data: history }
        return
      }
      ctx.self.buffs[key] = { data: {} }

      const cooldownResolved = resolveScalar(effect.cooldownSeconds, ctx.level)
      const cooldownWarning = scalarWarning(effect.name, 'cooldownSeconds', cooldownResolved)
      if (cooldownWarning) ctx.addDataWarning(cooldownWarning)
      ctx.self.cooldowns[key] = instance.time + cooldownResolved.value

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

      ctx.scheduleEvent?.(instance.time + effect.delaySeconds, (laterCtx) => {
        laterCtx.dealDamage({
          type: effect.damageType, amount,
          source: { kind: 'item', id: effect.id, name: effect.name },
        })
      })
    },
  },
}
