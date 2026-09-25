import { describe, it, expect } from 'vitest'
import { combatantFromChampion, combatantFromDummy, simulateCombo } from '@wr-calc/calc'
import type { ComboAction } from '@wr-calc/calc'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runGoldenCase } from '../src/golden-runner'
import { loadGoldenCases } from '../src/golden-loader'
import { buildChampionMap } from '../src/champion-map'
import type { GoldenCase } from '../src/golden-types'
import { PATCH_7_3_CHAMPIONS, PATCH_7_3_CATALOG } from '../src/patches/7.3'

const champions = buildChampionMap(PATCH_7_3_CHAMPIONS)
const nunu = champions.get('nunu-willump')!
const scenario: GoldenCase['scenario'] = {
  championId: 'nunu-willump', level: 1,
  build: { items: [], runes: [], inputs: {} },
  target: { hp: 1000, armor: 0, mr: 0 },
  combo: ['AA'],
}

function actualTotalDamage(): number {
  const attacker = combatantFromChampion(nunu, scenario.level, scenario.build, PATCH_7_3_CATALOG)
  const target = combatantFromDummy({ kind: 'dummy', ...scenario.target })
  const result = simulateCombo(
    attacker, target, scenario.combo as ComboAction[], { critMode: 'expected' }
  )
  return Object.values(result.totalsByType).reduce((sum, value) => sum + (value ?? 0), 0)
}

describe('runGoldenCase', () => {
  it('passes trivially when no fields are asserted', () => {
    const goldenCase: GoldenCase = {
      scenario, expected: {}, tolerance: 0.01, patch: '7.3', source: 'practice-tool',
    }
    expect(runGoldenCase(goldenCase, champions, PATCH_7_3_CATALOG).passed).toBe(true)
  })

  it('passes when expected matches the real simulateCombo result within tolerance', () => {
    const goldenCase: GoldenCase = {
      scenario, expected: { totalDamage: actualTotalDamage() }, tolerance: 0.01,
      patch: '7.3', source: 'practice-tool',
    }
    expect(runGoldenCase(goldenCase, champions, PATCH_7_3_CATALOG).passed).toBe(true)
  })

  it('fails with a descriptive message when expected is outside tolerance', () => {
    const goldenCase: GoldenCase = {
      scenario, expected: { totalDamage: actualTotalDamage() + 1000 }, tolerance: 0.01,
      patch: '7.3', source: 'practice-tool',
    }
    const result = runGoldenCase(goldenCase, champions, PATCH_7_3_CATALOG)
    expect(result.passed).toBe(false)
    expect(result.failures[0]).toContain('totalDamage')
  })

  it('fails with a clear message for an unknown championId', () => {
    const goldenCase: GoldenCase = {
      scenario: { ...scenario, championId: 'does-not-exist' }, expected: {}, tolerance: 0.01,
      patch: '7.3', source: 'practice-tool',
    }
    const result = runGoldenCase(goldenCase, champions, PATCH_7_3_CATALOG)
    expect(result.passed).toBe(false)
    expect(result.failures[0]).toContain('does-not-exist')
  })

  it('fails with a clear message for an unknown item id in the build', () => {
    const goldenCase: GoldenCase = {
      scenario: { ...scenario, build: { ...scenario.build, items: ['does-not-exist'] } },
      expected: {}, tolerance: 0.01, patch: '7.3', source: 'practice-tool',
    }
    const result = runGoldenCase(goldenCase, champions, PATCH_7_3_CATALOG)
    expect(result.passed).toBe(false)
    expect(result.failures[0]).toContain('does-not-exist')
  })
})

describe('loadGoldenCases', () => {
  it('returns an empty array when the directory has no *.json case files', () => {
    // "No real cases yet" is a supported, non-error state, per the Step 6 design doc.
    const emptyDir = mkdtempSync(join(tmpdir(), 'golden-empty-'))
    try {
      expect(loadGoldenCases(emptyDir)).toEqual([])
    } finally {
      rmSync(emptyDir, { recursive: true })
    }
  })

  it('returns an empty array when the directory does not exist', () => {
    expect(loadGoldenCases('/does/not/exist')).toEqual([])
  })
})
