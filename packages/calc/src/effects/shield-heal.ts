import type { ShieldEffect, HealEffect } from '@wr-calc/schema'
import type { EffectHandler } from './types'
import { resolveScalar, scalarWarning } from '../resolve-scalar'

export const shieldHandler: EffectHandler<ShieldEffect> = {
  kind: 'shield',
  hooks: {
    onAbilityCast(effect, ctx) {
      const amountResolved = resolveScalar(effect.amount, ctx.level)
      const amountWarning = scalarWarning(effect.name, 'amount', amountResolved)
      if (amountWarning) ctx.addDataWarning(amountWarning)

      const durationResolved = resolveScalar(effect.durationSeconds, ctx.level)
      const durationWarning = scalarWarning(effect.name, 'durationSeconds', durationResolved)
      if (durationWarning) ctx.addDataWarning(durationWarning)

      ctx.self.shieldHp += amountResolved.value
    },
  },
}

export const healHandler: EffectHandler<HealEffect> = {
  kind: 'heal',
  hooks: {
    onAbilityCast(effect, ctx) {
      const resolved = resolveScalar(effect.amount, ctx.level)
      const warning = scalarWarning(effect.name, 'amount', resolved)
      if (warning) ctx.addDataWarning(warning)

      const maxHp = ctx.selfSheet.total.hp ?? ctx.self.currentHp
      ctx.self.currentHp = Math.min(maxHp, ctx.self.currentHp + resolved.value)
    },
  },
}
