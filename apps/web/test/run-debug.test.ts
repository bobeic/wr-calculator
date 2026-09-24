import { describe, it, expect } from 'vitest'
import { runDebug, toBuild } from '../src/lib/run-debug'
import type { Stage } from '../src/lib/run-debug'
import { defaultState } from '../src/lib/debug-state'
import type { DebugState, DebugTarget } from '../src/lib/debug-state'
import { PATCH_7_3_DATASET } from '../src/lib/dataset'

const dataset = PATCH_7_3_DATASET
const LEGENDARIES = [
  'rabadons-deathcap', 'blade-of-the-ruined-king', 'trinity-force',
  'liandrys-torment', 'void-staff', 'black-cleaver',
]

function state(overrides: Partial<DebugState> = {}): DebugState {
  return {
    ...defaultState(dataset),
    championId: 'jinx',
    buildA: { items: LEGENDARIES, boots: 'plated-steelcaps', runes: [], inputs: {} },
    buildB: { items: ['long-sword'], runes: [], inputs: {} },
    combo: 'Q AA W AA R',
    ...overrides,
  }
}

function ok<T>(stage: Stage<T>): T {
  if (!stage.ok) throw new Error(`expected ok stage, got error: ${stage.error}`)
  return stage.value
}

function error(stage: Stage<unknown>): string {
  if (stage.ok) throw new Error('expected failed stage, got ok')
  return stage.error
}

describe('runDebug with the real 7.3 dataset', () => {
  it('runs a full champion + 6-item build end to end through every stage', () => {
    const result = runDebug(state(), dataset)
    expect(ok(result.sheetA).total.hp).toBeGreaterThan(0)
    expect(ok(result.sheetB).total.ad).toBeGreaterThan(0)
    // Base AD and item AD are real data, so basic attacks deal damage.
    expect(ok(result.comboA).totalsBySource.AA).toBeGreaterThan(0)
    expect(ok(result.comboB).instances.length).toBeGreaterThan(0)
    const compare = ok(result.compare)
    expect(compare.a).toHaveLength(6)
    expect(compare.b).toHaveLength(1)
  })

  it.each<DebugTarget>([
    { kind: 'preset', presetId: 'tank' },
    { kind: 'dummy', hp: 2500, armor: 90, mr: 60 },
    { kind: 'champion', championId: 'annie', level: 9, build: { items: ['blasting-wand'], runes: [], inputs: {} } },
  ])('runs combo and compare against target %o', (target) => {
    const result = runDebug(state({ target }), dataset)
    expect(result.comboA.ok).toBe(true)
    expect(result.comboB.ok).toBe(true)
    expect(result.compare.ok).toBe(true)
  })
})

describe('runDebug stage isolation', () => {
  it('fails combo and compare on bad combo text but still resolves both stat sheets', () => {
    const result = runDebug(state({ combo: 'Q XX' }), dataset)
    expect(error(result.comboA)).toBe("combo text failed: unknown combo token 'XX'")
    expect(error(result.comboB)).toContain('combo text failed')
    expect(error(result.compare)).toContain('combo text failed')
    expect(result.sheetA.ok).toBe(true)
    expect(result.sheetB.ok).toBe(true)
  })

  it('fails only compare on bad priority text', () => {
    const result = runDebug(state({ priority: 'Q AA' }), dataset)
    expect(error(result.compare)).toContain('priority text failed')
    expect(result.comboA.ok).toBe(true)
  })

  it('fails only build A stages on an unknown item that bypassed decodeState', () => {
    const result = runDebug(state({ buildA: { items: ['nope'], runes: [], inputs: {} } }), dataset)
    expect(error(result.sheetA)).toContain("unknown item id 'nope'")
    expect(error(result.comboA)).toContain('build A failed')
    expect(error(result.compare)).toContain('build A failed')
    expect(result.sheetB.ok).toBe(true)
    expect(result.comboB.ok).toBe(true)
  })

  it('fails target-dependent stages on an unknown preset', () => {
    const result = runDebug(state({ target: { kind: 'preset', presetId: 'mega' } }), dataset)
    expect(error(result.comboA)).toBe("target failed: unknown target preset 'mega'")
    expect(result.sheetA.ok).toBe(true)
  })

  it('fails every champion-dependent stage on an unknown champion', () => {
    const result = runDebug(state({ championId: 'nope-champ' }), dataset)
    expect(error(result.sheetA)).toBe("champion failed: unknown champion 'nope-champ'")
    expect(result.compare.ok).toBe(false)
  })
})

describe('runDebug envelope and nulls', () => {
  it('dedupes unsupported effects and data warnings across every call', () => {
    const result = runDebug(state({ buildB: { items: ['liandrys-torment'], runes: [], inputs: {} } }), dataset)
    const liandrys = result.envelope.unsupportedEffects.filter((entry) => entry.id === 'liandrys-torment-dot')
    expect(liandrys).toHaveLength(1)
    expect(result.envelope.dataWarnings.length).toBe(new Set(result.envelope.dataWarnings).size)
    expect(result.envelope.unverifiedRules.length).toBe(new Set(result.envelope.unverifiedRules).size)
  })

  it('reports each null once even when both builds share an item', () => {
    const buildA = { items: ['seraphs-embrace'], runes: [], inputs: {} }
    const buildB = { items: ['seraphs-embrace'], runes: [], inputs: {} }
    const result = runDebug(state({ buildA, buildB }), dataset)
    const paths = result.nulls.map((entry) => entry.path)
    expect(paths.filter((path) => path === 'item seraphs-embrace › effects[1].amount')).toHaveLength(1)
    expect(paths.some((path) => path.startsWith('champion jinx › '))).toBe(true)
  })

  it('includes a champion target and its items in the null report', () => {
    const target: DebugTarget = {
      kind: 'champion', championId: 'annie', level: 9,
      build: { items: ['seraphs-embrace'], runes: [], inputs: {} },
    }
    const paths = runDebug(state({ target }), dataset).nulls.map((entry) => entry.path)
    expect(paths.some((path) => path.startsWith('champion annie › '))).toBe(true)
    expect(paths).toContain('item seraphs-embrace › effects[1].amount')
  })
})

describe('toBuild', () => {
  it('fills declared input defaults so the engine never sees a missing input', () => {
    expect(toBuild({ items: ['heartsteel'], runes: [], inputs: {} }, dataset)).toEqual({
      items: ['heartsteel'], runes: [], inputs: { 'heartsteel-stacks': 0, 'heartsteel-charge-ready': false },
    })
  })

  it('carries boots and never sets enchant', () => {
    const build = toBuild({ items: [], boots: 'plated-steelcaps', runes: [], inputs: {} }, dataset)
    expect(build.boots).toBe('plated-steelcaps')
    expect('enchant' in build).toBe(false)
  })
})
