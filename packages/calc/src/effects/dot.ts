import type { DotEffect } from '@wr-calc/schema'
import type { EffectHandler } from './types'
import { resolveScalar, scalarWarning } from '../resolve-scalar'

function buffKey(effect: DotEffect): string {
  return `dot:${effect.id}`
}

export const dotHandler: EffectHandler<DotEffect> = {
  kind: 'dot',
  hooks: {
    onAbilityHit(effect, ctx) {
      const key = buffKey(effect)
      const alreadyActive = ctx.opponent.buffs[key] !== undefined
      if (alreadyActive && effect.refresh === 'ignore') return
      if (alreadyActive && effect.refresh === 'refresh') ctx.cancelScheduled?.(key)

      const amountResolved = resolveScalar(effect.tickAmount, ctx.level)
      const amountWarning = scalarWarning(effect.name, 'tickAmount', amountResolved)
      if (amountWarning) ctx.addDataWarning(amountWarning)

      const durationResolved = resolveScalar(effect.durationSeconds, ctx.level)
      const durationWarning = scalarWarning(effect.name, 'durationSeconds', durationResolved)
      if (durationWarning) ctx.addDataWarning(durationWarning)

      ctx.opponent.buffs[key] = { expiresAt: ctx.time + durationResolved.value }

      const ticks = Math.floor(durationResolved.value / effect.tickIntervalSeconds)
      for (let i = 1; i <= ticks; i++) {
        const tickTime = ctx.time + i * effect.tickIntervalSeconds
        ctx.scheduleEvent?.(tickTime, (laterCtx) => {
          laterCtx.dealDamage({
            type: effect.damageType, amount: amountResolved.value,
            source: { kind: 'item', id: effect.id, name: effect.name },
          })
        }, key)
      }
    },
  },
}
