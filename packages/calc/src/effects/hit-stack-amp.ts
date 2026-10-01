import type { HitStackAmpEffect } from '@wr-calc/schema'
import type { EffectHandler, HookContext } from './types'

function key(effect: HitStackAmpEffect): string {
  return `hitStackAmp:${effect.id}`
}

function liveStacks(effect: HitStackAmpEffect, ctx: HookContext): number {
  const buff = ctx.self.buffs[key(effect)]
  if (!buff || buff.expiresAt === undefined || buff.expiresAt < ctx.time) return 0
  return buff.stacks ?? 0
}

export const hitStackAmpHandler: EffectHandler<HitStackAmpEffect> = {
  kind: 'hitStackAmp',
  hooks: {
    onHitLanded(effect, ctx) {
      ctx.self.buffs[key(effect)] = {
        stacks: Math.min(liveStacks(effect, ctx) + 1, effect.maxStacks),
        expiresAt: ctx.time + effect.durationSeconds,
      }
    },
  },
  damageMultiplier(effect, ctx, input) {
    if (!effect.appliesTo.includes(input.source.kind)) return 1
    return 1 + liveStacks(effect, ctx) * effect.amountPerStack
  },
}
