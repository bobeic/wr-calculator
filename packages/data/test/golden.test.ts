import { describe, it, expect } from 'vitest'
import { runGoldenCase } from '../src/golden-runner'
import { loadGoldenCases } from '../src/golden-loader'
import { buildChampionMap } from '../src/champion-map'
import { PATCH_7_3_CHAMPIONS, PATCH_7_3_CATALOG } from '../src/patches/7.3'

const GOLDEN_DIR = new URL('../golden', import.meta.url).pathname
const champions = buildChampionMap(PATCH_7_3_CHAMPIONS)
const cases = loadGoldenCases(GOLDEN_DIR)

describe.each(cases)('golden case: $file', ({ file, case: goldenCase }) => {
  it(`matches simulateCombo within tolerance (${file})`, () => {
    const result = runGoldenCase(goldenCase, champions, PATCH_7_3_CATALOG)
    expect(result.passed, result.failures.join('; ')).toBe(true)
  })
})
