import type { EmpoweredAttackEffect } from '@wr-calc/schema'
import type { EffectHandler, HookContext } from './types'

function buffKey(effect: EmpoweredAttackEffect): string {
  return `empowered:${effect.id}`
}

function liveCharges(effect: EmpoweredAttackEffect, ctx: HookContext): number {
  const buff = ctx.self.buffs[buffKey(effect)]
  if (!buff || buff.expiresAt === undefined || buff.expiresAt < ctx.time) return 0
  return buff.stacks ?? 0
}

function grantCharge(effect: EmpoweredAttackEffect, ctx: HookContext): void {
  ctx.self.buffs[buffKey(effect)] = {
    stacks: Math.min(liveCharges(effect, ctx) + (effect.grant.charges ?? 1), effect.maxCharges),
    expiresAt: ctx.time + effect.durationSeconds,
  }
}

export const empoweredAttackHandler: EffectHandler<EmpoweredAttackEffect> = {
  kind: 'empoweredAttack',
  hooks: {
    onAbilityCast(effect, ctx, abilityKey) {
      if (effect.grant.on !== 'abilityCast') return
      if (effect.grant.slots && !effect.grant.slots.includes(abilityKey)) return
      grantCharge(effect, ctx)
    },
    onDash(effect, ctx, dashStartedAt) {
      if (effect.grant.on !== 'dashAfterAbility') return
      const cast = ctx.self.lastAbilityCast
      if (!cast || cast.feintUsed) return
      if (dashStartedAt - cast.at > (effect.grant.withinSeconds ?? 0)) return
      grantCharge(effect, ctx)
    },
    beforeBasicAttack(effect, ctx) {
      const charges = liveCharges(effect, ctx)
      if (charges === 0) return undefined
      const key = buffKey(effect)
      if (charges === 1) delete ctx.self.buffs[key]
      else ctx.self.buffs[key] = { ...ctx.self.buffs[key], stacks: charges - 1 }

      ctx.self.swingAttackSpeedBonus = Math.max(
        ctx.self.swingAttackSpeedBonus ?? 0, effect.attackSpeedBonus ?? 0
      )
      if (!ctx.resolveComponent) {
        throw new Error('empoweredAttack: HookContext.resolveComponent is required')
      }
      const resolved = ctx.resolveComponent(effect.bonus, effect.name)
      resolved.dataWarnings.forEach((warning) => ctx.addDataWarning(warning))
      return {
        empowered: true,
        bonus: [{
          type: resolved.type, amount: resolved.amount,
          source: { kind: 'passive', id: effect.id, name: effect.name },
        }],
      }
    },
  },
}
