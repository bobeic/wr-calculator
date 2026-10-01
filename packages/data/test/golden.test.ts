import { describe, it, expect } from 'vitest'
import { runGoldenCase } from '../src/golden-runner'
import { loadGoldenCases } from '../src/golden-loader'
import { buildChampionMap } from '../src/champion-map'
import { getPatchDataset } from '../src/patches/registry'

const GOLDEN_DIR = new URL('../golden', import.meta.url).pathname
const cases = loadGoldenCases(GOLDEN_DIR)

// Each case runs against the patch it was recorded on, so a newer patch never silently re-baselines it.
describe.each(cases)('golden case: $file', ({ file, case: goldenCase }) => {
  it(`matches simulateCombo within tolerance (${file}, patch ${goldenCase.patch})`, () => {
    const dataset = getPatchDataset(goldenCase.patch)
    const result = runGoldenCase(goldenCase, buildChampionMap(dataset.champions), dataset.catalog)
    expect(result.passed, result.failures.join('; ')).toBe(true)
  })
})
