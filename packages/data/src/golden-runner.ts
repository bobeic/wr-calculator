import type { Champion } from '@wr-calc/schema'
import type { StatCatalog, ComboAction } from '@wr-calc/calc'
import { combatantFromChampion, combatantFromDummy, simulateCombo } from '@wr-calc/calc'
import type { GoldenCase } from './golden-types'

export interface GoldenRunResult {
  passed: boolean
  failures: string[]
}

/** Runs one golden case's scenario through simulateCombo, checking every declared expected field within tolerance. */
export function runGoldenCase(
  goldenCase: GoldenCase, champions: Map<string, Champion>, catalog: StatCatalog
): GoldenRunResult {
  const champion = champions.get(goldenCase.scenario.championId)
  if (!champion) {
    return { passed: false, failures: [`unknown championId '${goldenCase.scenario.championId}'`] }
  }
  let result: ReturnType<typeof simulateCombo>
  try {
    const attacker = combatantFromChampion(
      champion, goldenCase.scenario.level, goldenCase.scenario.build, catalog
    )
    const target = combatantFromDummy({ kind: 'dummy', ...goldenCase.scenario.target })
    result = simulateCombo(
      attacker, target, goldenCase.scenario.combo as ComboAction[], { critMode: 'expected' }
    )
  } catch (error) {
    return { passed: false, failures: [error instanceof Error ? error.message : String(error)] }
  }

  const failures: string[] = []
  const check = (label: string, actual: number | undefined, expected: number | undefined): void => {
    if (expected === undefined) return
    if (actual === undefined) {
      failures.push(`${label}: expected ${expected}, got undefined`)
      return
    }
    const allowed = Math.abs(expected) * goldenCase.tolerance
    if (Math.abs(actual - expected) > allowed) {
      failures.push(`${label}: expected ${expected} (±${goldenCase.tolerance * 100}%), got ${actual}`)
    }
  }

  const totalDamage = Object.values(result.totalsByType).reduce((sum, value) => sum + (value ?? 0), 0)
  check('timeToKill', result.timeToKill, goldenCase.expected.timeToKill)
  check('totalDamage', totalDamage, goldenCase.expected.totalDamage)

  return { passed: failures.length === 0, failures }
}
