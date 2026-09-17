import type { Combatant } from '../combatant'
import type { AbilityKey } from '../effects/types'
import { simulateCombo } from '../simulate-combo'
import type { ComboAction } from '../simulate-combo'

const ABILITY_ACTION: Record<AbilityKey, ComboAction> = { q: 'Q', w: 'W', e: 'E', r: 'R' }

/**
 * Estimated damage per second over `seconds`, casting abilities off cooldown in `priority` order
 * (each attempt is a free no-op in simulateCombo if still on cooldown) and filling with basic
 * attacks. Only counts damage landing strictly before `seconds` so the result matches the
 * attack-speed-implied rate exactly for a pure-AA rotation; the rate reflects the achieved kill
 * time when the target dies inside the window, and the full window otherwise.
 *
 * @throws RangeError if `seconds` is not greater than 0.
 */
export function sustainedDps(
  attacker: Combatant, target: Combatant, seconds: number, priority: AbilityKey[]
): number {
  if (!(seconds > 0)) throw new RangeError(`sustainedDps: seconds must be > 0, got ${seconds}`)

  const interval = 1 / Math.max(attacker.sheet.total.attackSpeed ?? 1, 0.01)
  const blocks = Math.ceil(seconds / interval) + priority.length + 1
  const sequence: ComboAction[] = []
  for (let i = 0; i < blocks; i++) {
    for (const key of priority) sequence.push(ABILITY_ACTION[key])
    sequence.push('AA')
  }

  const { instances, killed, timeToKill } = simulateCombo(
    attacker, target, sequence, { critMode: 'expected' }
  )
  const total = instances
    .filter((instance) => instance.time < seconds)
    .reduce((sum, instance) => sum + instance.mitigated, 0)
  // simulateCombo stops the sequence the moment the target dies, so dividing a truncated rotation
  // by the full window would make every in-window kill converge on effectiveHp/seconds and hide
  // how much faster one build killed than another. Divide by the window actually achieved instead.
  // A kill on the very first instance (timeToKill === 0) has no window to divide by, so it falls
  // back to `seconds` rather than returning Infinity.
  const achievedWindow = killed && timeToKill !== undefined && timeToKill > 0 ? timeToKill : seconds
  return total / achievedWindow
}
