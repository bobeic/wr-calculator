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
      let tickAmount = amountResolved.value
      for (const ratio of effect.ratios) {
        const ratioResolved = resolveScalar(ratio.value, ctx.level)
        const ratioWarning = scalarWarning(effect.name, `ratios.${ratio.stat}`, ratioResolved)
        if (ratioWarning) ctx.addDataWarning(ratioWarning)
        tickAmount += (ctx.selfSheet.total[ratio.stat] ?? 0) * ratioResolved.value
      }

      const durationResolved = resolveScalar(effect.durationSeconds, ctx.level)
      const durationWarning = scalarWarning(effect.name, 'durationSeconds', durationResolved)
      if (durationWarning) ctx.addDataWarning(durationWarning)

      ctx.opponent.buffs[key] = { expiresAt: ctx.time + durationResolved.value }

      const ticks = Math.floor(durationResolved.value / effect.tickIntervalSeconds)
      for (let i = 1; i <= ticks; i++) {
        const tickTime = ctx.time + i * effect.tickIntervalSeconds
        ctx.scheduleEvent?.(tickTime, (laterCtx) => {
          laterCtx.dealDamage({
            type: effect.damageType, amount: tickAmount,
            source: { kind: 'item', id: effect.id, name: effect.name },
          })
        }, key)
      }
    },
  },
  // No condition check here: the dot's condition gates applying it (e.g. an abilitySlot that a
  // damage instance can't match), so an active dot already passed it.
  modifyResist(effect, ctx, damageType) {
    const shred = effect.shredWhileActive
    if (!shred) return {}
    const matches = (shred.resist === 'armor' && damageType === 'physical')
      || (shred.resist === 'mr' && damageType === 'magic')
    if (!matches) return {}

    const buff = ctx.opponent.buffs[buffKey(effect)]
    if (!buff || buff.expiresAt === undefined || buff.expiresAt < ctx.time) return {}

    const resolved = resolveScalar(shred.amount, ctx.level)
    const warning = scalarWarning(effect.name, 'shredWhileActive.amount', resolved)
    if (warning) ctx.addDataWarning(warning)
    return { flatReduction: resolved.value }
  },
}
