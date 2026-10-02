import type { ProcEveryNEffect } from '@wr-calc/schema'
import type { EffectHandler, HookContext } from './types'
import { resolveScalar, scalarWarning } from '../resolve-scalar'
import { sumStatRatios } from './stat-ratios'

function procAmount(effect: ProcEveryNEffect, ctx: HookContext): number {
  if (effect.damage === undefined) return 0
  const resolved = resolveScalar(effect.damage, ctx.level)
  const warning = scalarWarning(effect.name, 'damage', resolved)
  if (warning) ctx.addDataWarning(warning)
  let amount = resolved.value + sumStatRatios(effect.ratios ?? [], ctx.selfSheet, ctx.level, effect.name, ctx.addDataWarning)
  if (effect.targetMissingHpAmp) {
    const maxHp = ctx.opponentSheet.total.hp ?? 0
    const missingPct = maxHp > 0 ? Math.max(0, (maxHp - ctx.opponent.currentHp) / maxHp) * 100 : 0
    amount *= 1 + Math.min(effect.targetMissingHpAmp.max, missingPct * effect.targetMissingHpAmp.perMissingPct)
  }
  return amount
}

/** Counts one event and reports whether it completes a proc. The first event procs when the start-ready input is on. */
function countAndCheck(effect: ProcEveryNEffect, ctx: HookContext): boolean {
  const key = `procEveryN:${effect.id}`
  const existing = ctx.self.buffs[key]
  const startReady = existing === undefined && effect.startReadyInputId !== undefined
    && ctx.inputs[effect.startReadyInputId] === true
  const hits = (existing?.stacks ?? 0) + 1
  if (!startReady && hits < effect.n) {
    ctx.self.buffs[key] = { stacks: hits }
    return false
  }
  ctx.self.buffs[key] = { stacks: 0 }
  return true
}

export const procEveryNHandler: EffectHandler<ProcEveryNEffect> = {
  kind: 'procEveryN',
  hooks: {
    onDamageDealt(effect, ctx, instance) {
      if ((effect.countsFrom ?? 'damageInstance') !== 'damageInstance') return
      if (instance.source.id === effect.id) return
      if (!countAndCheck(effect, ctx) || effect.damage === undefined) return
      ctx.dealDamage({
        type: effect.damageType ?? 'physical', amount: procAmount(effect, ctx),
        source: { kind: 'item', id: effect.id, name: effect.name },
      })
    },
    beforeBasicAttack(effect, ctx) {
      if (effect.countsFrom !== 'basicAttack') return undefined
      if (!countAndCheck(effect, ctx) || effect.damage === undefined) return undefined
      return {
        bonus: [{
          type: effect.damageType ?? 'physical', amount: procAmount(effect, ctx),
          source: { kind: 'item', id: effect.id, name: effect.name },
        }],
      }
    },
  },
}
