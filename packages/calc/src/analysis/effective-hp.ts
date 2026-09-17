import type { StatSheet } from '../resolve-stats'
import { mitigationMultiplier } from '../mitigation'

export interface EffectiveHp {
  physical: number
  magic: number
}

/** A stat sheet's effective HP against physical and magic damage, from its hp/armor/mr totals. */
export function effectiveHp(sheet: StatSheet): EffectiveHp {
  const hp = sheet.total.hp ?? 0
  const armor = sheet.total.armor ?? 0
  const mr = sheet.total.mr ?? 0
  return {
    physical: hp / mitigationMultiplier(armor),
    magic: hp / mitigationMultiplier(mr),
  }
}
