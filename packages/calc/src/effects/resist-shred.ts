import type { ResistShredEffect } from '@wr-calc/schema'
import type { EffectHandler } from './types'
import type { ResistModifiers } from '../mitigation'
import { resolveScalar, scalarWarning } from '../resolve-scalar'

function buffKey(effect: ResistShredEffect): string {
  return `resistShred:${effect.id}`
}

export const resistShredHandler: EffectHandler<ResistShredEffect> = {
  kind: 'resistShred',
  hooks: {
    onDamageDealt(effect, ctx) {
      const key = buffKey(effect)
      const existing = ctx.opponent.buffs[key]
      const stacks = effect.stacking
        ? Math.min((existing?.stacks ?? 0) + 1, effect.maxStacks ?? Infinity)
        : 1

      let expiresAt: number | undefined
      if (effect.durationSeconds != null) {
        const resolved = resolveScalar(effect.durationSeconds, ctx.level)
        const warning = scalarWarning(effect.name, 'durationSeconds', resolved)
        if (warning) ctx.addDataWarning(warning)
        expiresAt = ctx.time + resolved.value
      }
      ctx.opponent.buffs[key] = { stacks, expiresAt }
    },
  },
  modifyResist(effect, ctx, damageType) {
    const targetsThisDamageType =
      (effect.resist === 'armor' && damageType === 'physical')
      || (effect.resist === 'mr' && damageType === 'magic')
    if (!targetsThisDamageType) return {}

    const buff = ctx.opponent.buffs[buffKey(effect)]
    if (!buff || (buff.expiresAt !== undefined && buff.expiresAt < ctx.time)) return {}

    const resolved = resolveScalar(effect.amount, ctx.level)
    const warning = scalarWarning(effect.name, 'amount', resolved)
    if (warning) ctx.addDataWarning(warning)
    const total = resolved.value * (buff.stacks ?? 1)

    const modifiers: Partial<ResistModifiers> = {}
    if (effect.mode === 'flat') modifiers.flatReduction = total
    else modifiers.pctReduction = total
    return modifiers
  },
}
