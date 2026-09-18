import { describe, it, expect } from 'vitest'
import { loadGoldenCases, runGoldenCase } from '../src/golden-runner'
import { PATCH_7_3_CHAMPIONS } from '../src/patches/7.3/champions'
import { PATCH_7_3_CATALOG } from '../src/patches/7.3'

const GOLDEN_DIR = new URL('../golden', import.meta.url).pathname
const champions = new Map(PATCH_7_3_CHAMPIONS.map((champion) => [champion.id, champion]))
const cases = loadGoldenCases(GOLDEN_DIR)

describe.each(cases)('golden case: $file', ({ file, case: goldenCase }) => {
  it(`matches simulateCombo within tolerance (${file})`, () => {
    const result = runGoldenCase(goldenCase, champions, PATCH_7_3_CATALOG)
    expect(result.passed, result.failures.join('; ')).toBe(true)
  })
})
