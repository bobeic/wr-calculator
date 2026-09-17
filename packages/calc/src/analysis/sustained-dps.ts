import type { Combatant } from '../combatant'
import type { AbilityKey } from '../effects/types'
import { simulateCombo } from '../simulate-combo'
import type { ComboAction } from '../simulate-combo'

const ABILITY_ACTION: Record<AbilityKey, ComboAction> = { q: 'Q', w: 'W', e: 'E', r: 'R' }

/**
 * Estimated damage per second over `seconds`, casting abilities off cooldown in `priority` order
 * (each attempt is a free no-op in simulateCombo if still on cooldown) and filling with basic
 * attacks. Only counts damage landing strictly before `seconds` so the result matches the
 * attack-speed-implied rate exactly for a pure-AA rotation.
 */
export function sustainedDps(
  attacker: Combatant, target: Combatant, seconds: number, priority: AbilityKey[]
): number {
  const interval = 1 / Math.max(attacker.sheet.total.attackSpeed ?? 1, 0.01)
  const blocks = Math.ceil(seconds / interval) + priority.length + 1
  const sequence: ComboAction[] = []
  for (let i = 0; i < blocks; i++) {
    for (const key of priority) sequence.push(ABILITY_ACTION[key])
    sequence.push('AA')
  }

  const result = simulateCombo(attacker, target, sequence, { critMode: 'expected' })
  const total = result.instances
    .filter((instance) => instance.time < seconds)
    .reduce((sum, instance) => sum + instance.mitigated, 0)
  return total / seconds
}
