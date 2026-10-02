import type { DamageType } from '@wr-calc/schema'
import type { HookContext } from './types'
import { resolveAdaptiveDamageType } from '../rules'

/** An effect's damage type with 'adaptive' resolved from the owner's bonus AD and AP right now. */
export function effectDamageType(type: DamageType | 'adaptive', ctx: Pick<HookContext, 'selfSheet' | 'addUnverifiedRule'>): DamageType {
  if (type !== 'adaptive') return type
  ctx.addUnverifiedRule('adaptiveDamageType')
  return resolveAdaptiveDamageType(ctx.selfSheet.bonus.ad ?? 0, ctx.selfSheet.total.ap ?? 0)
}
