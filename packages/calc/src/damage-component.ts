import type { DamageComponent, DamageRatioStat } from '@wr-calc/schema'
import type { Combatant } from './combatant'
import { resolveScalar, scalarWarning } from './resolve-scalar'

export interface ResolvedDamageComponent {
  type: DamageComponent['type']
  amount: number
  dataWarnings: string[]
}

function resolveRatioStat(
  stat: DamageRatioStat, attacker: Combatant, target: Combatant, targetCurrentHp: number
): number {
  switch (stat) {
    case 'totalAd': return attacker.sheet.total.ad ?? 0
    case 'bonusAd': return attacker.sheet.bonus.ad ?? 0
    case 'ap': return attacker.sheet.total.ap ?? 0
    case 'maxHp': return attacker.sheet.total.hp ?? 0
    case 'bonusHp': return attacker.sheet.bonus.hp ?? 0
    case 'targetMaxHp': return target.sheet.total.hp ?? 0
    case 'targetCurrentHp': return targetCurrentHp
    case 'targetMissingHp': return Math.max(0, (target.sheet.total.hp ?? 0) - targetCurrentHp)
    case 'targetMissingHpFraction': {
      const maxHp = target.sheet.total.hp ?? 0
      return maxHp > 0 ? Math.min(1, Math.max(0, (maxHp - targetCurrentHp) / maxHp)) : 0
    }
  }
}

/** Resolves one Ability DamageComponent's damage amount for a given attacker/target/level/ability rank/live target HP. */
export function resolveDamageComponent(
  component: DamageComponent, attacker: Combatant, target: Combatant,
  targetCurrentHp: number, level: number, ownerName: string, rank?: number
): ResolvedDamageComponent {
  const dataWarnings: string[] = []
  const baseResolved = resolveScalar(component.base, level, rank)
  const baseWarning = scalarWarning(ownerName, 'base', baseResolved)
  if (baseWarning) dataWarnings.push(baseWarning)

  let amount = baseResolved.value
  for (const ratio of component.ratios) {
    const statValue = resolveRatioStat(ratio.stat, attacker, target, targetCurrentHp)
    const ratioResolved = resolveScalar(ratio.value, level, rank)
    const ratioWarning = scalarWarning(ownerName, `ratios.${ratio.stat}`, ratioResolved)
    if (ratioWarning) dataWarnings.push(ratioWarning)
    let coefficient = ratioResolved.value
    if (ratio.perStat) {
      const perResolved = resolveScalar(ratio.perStat.value, level, rank)
      const perWarning = scalarWarning(
        ownerName, `ratios.${ratio.stat}.perStat.${ratio.perStat.stat}`, perResolved
      )
      if (perWarning) dataWarnings.push(perWarning)
      coefficient += perResolved.value
        * resolveRatioStat(ratio.perStat.stat, attacker, target, targetCurrentHp)
    }
    amount += statValue * coefficient
  }

  return { type: component.type, amount: amount * (component.hits ?? 1), dataWarnings }
}
