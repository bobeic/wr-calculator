import type { DotEffect } from '@wr-calc/schema'
import type { EffectHandler, HookContext } from './types'
import { resolveScalar, scalarWarning } from '../resolve-scalar'
import { sumStatRatios } from './stat-ratios'

function buffKey(effect: DotEffect): string {
  return `dot:${effect.id}`
}

/** Applies (or re-applies) the dot to the opponent and schedules its ticks. */
function applyDot(effect: DotEffect, ctx: HookContext): void {
  const key = buffKey(effect)
  const existing = ctx.opponent.buffs[key]
  const alreadyActive = existing !== undefined
  if (alreadyActive && effect.refresh === 'ignore') return
  // A capped stacking dot restarts at the new stack count, so its old ticks go too.
  const capped = effect.refresh === 'stack' && effect.maxStacks !== undefined
  if (alreadyActive && (effect.refresh === 'refresh' || capped)) ctx.cancelScheduled?.(key)

  const amountResolved = resolveScalar(effect.tickAmount, ctx.level)
  const amountWarning = scalarWarning(effect.name, 'tickAmount', amountResolved)
  if (amountWarning) ctx.addDataWarning(amountWarning)
  let tickAmount = amountResolved.value
  tickAmount += sumStatRatios(effect.ratios, ctx.selfSheet, ctx.level, effect.name, ctx.addDataWarning)
  if (effect.targetMaxHpRatio !== undefined) {
    const hpRatioResolved = resolveScalar(effect.targetMaxHpRatio, ctx.level)
    const hpRatioWarning = scalarWarning(effect.name, 'targetMaxHpRatio', hpRatioResolved)
    if (hpRatioWarning) ctx.addDataWarning(hpRatioWarning)
    tickAmount += (ctx.opponentSheet.total.hp ?? 0) * hpRatioResolved.value
  }

  const durationResolved = resolveScalar(effect.durationSeconds, ctx.level)
  const durationWarning = scalarWarning(effect.name, 'durationSeconds', durationResolved)
  if (durationWarning) ctx.addDataWarning(durationWarning)

  let stacks: number | undefined
  if (capped) {
    const live = existing?.expiresAt !== undefined && existing.expiresAt >= ctx.time ? existing.stacks ?? 0 : 0
    stacks = Math.min(live + 1, effect.maxStacks!)
    tickAmount *= stacks
  }
  ctx.opponent.buffs[key] = {
    expiresAt: ctx.time + durationResolved.value, ...(stacks !== undefined && { stacks }),
  }

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
}

/** Live stacks of the owner's dot `effectId` on the opponent: 1 for an uncapped active dot, 0 when none. */
export function targetDotStacks(effectId: string, ctx: HookContext): number {
  const buff = ctx.opponent.buffs[`dot:${effectId}`]
  if (buff?.expiresAt === undefined || buff.expiresAt < ctx.time) return 0
  return buff.stacks ?? 1
}

export const dotHandler: EffectHandler<DotEffect> = {
  kind: 'dot',
  hooks: {
    onAbilityHit(effect, ctx, abilityKey) {
      if (effect.appliedBy !== undefined && !effect.appliedBy.includes(abilityKey)) return
      applyDot(effect, ctx)
    },
    onBasicAttack(effect, ctx) {
      if (!effect.appliedBy?.includes('basicAttack')) return
      applyDot(effect, ctx)
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
