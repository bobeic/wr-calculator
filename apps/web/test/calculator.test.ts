import { describe, it, expect } from 'vitest'
import { combatantFromChampion, combatantFromDummy } from '@wr-calc/calc'
import { abilityRows, castActions, displayName, isEmptyBuild, rotation, runCalculator } from '../src/lib/calculator'
import { defaultState, emptyBuild } from '../src/lib/debug-state'
import type { DebugState } from '../src/lib/debug-state'
import { datasetFor } from '../src/lib/dataset'

const dataset = datasetFor('7.3a')
const champion = (id: string) => dataset.champions.get(id)!
const dummy = () => combatantFromDummy({ kind: 'dummy', hp: 10000, armor: 100, mr: 100 })
const attacker = (id: string) => combatantFromChampion(champion(id), 15, { items: [], runes: [], inputs: {} }, dataset.catalog)

function state(overrides: Partial<DebugState> = {}): DebugState {
  return { ...defaultState(dataset), championId: 'darius', target: { kind: 'dummy', hp: 3000, armor: 100, mr: 100 }, combo: 'Q W AA E R', ...overrides }
}

describe('castActions', () => {
  it('casts every stage: a press repeats the key, a dash stage dashes, then waits for burns', () => {
    expect(castActions(champion('lee-sin'), 'q')).toEqual(['Q', 'Q', 'wait:6'])
    expect(castActions(champion('ambessa'), 'e')).toEqual(['E', 'dash', 'wait:6'])
    expect(castActions(champion('darius'), 'r')).toEqual(['R', 'wait:6'])
  })
})

describe('abilityRows', () => {
  it('lists the basic attack and each ability, with what each one does', () => {
    const rows = abilityRows(champion('darius'), attacker('darius'), dummy())
    expect(rows.map((row) => [row.key, row.kind])).toEqual([['aa', 'hit'], ['q', 'hit'], ['w', 'empowers'], ['e', 'none'], ['r', 'hit']])
  })

  it('counts the bleed an attack sets off', () => {
    const [attack] = abilityRows(champion('darius'), attacker('darius'), dummy())
    const ad = attacker('darius').sheet.total.ad!
    // 36% armor pen: 100 armor counts as 64. The attack plus one Hemorrhage stack (18 over 5 seconds).
    expect(attack.damage).toBeCloseTo((ad + 18) * 100 / 164, 6)
    expect(attack.sources.map((source) => source.name)).toEqual(['Basic Attack', 'Hemorrhage'])
  })

  it("an ability that only empowers the next attack shows that attack's extra damage", () => {
    const rows = abilityRows(champion('darius'), attacker('darius'), dummy())
    const ad = attacker('darius').sheet.total.ad!
    expect(rows[2].damage).toBeCloseTo(0.6 * ad * 100 / 164, 6)
  })

  it('a two-stage ability counts both stages', () => {
    const q = abilityRows(champion('lee-sin'), attacker('lee-sin'), dummy())[1]
    // 90 each after armor; the recast gains 90/10000 for the Health the first hit took.
    expect(q.damage).toBeCloseTo(90 + 90 * (1 + 90 / 10000), 6)
    expect(q.sources.map((source) => source.name)).toEqual(['Sonic Wave', 'Resonating Strike'])
  })
})

describe('abilityRows with variants', () => {
  it('lists each of Hwei\'s nine spells under its two keys', () => {
    const rows = abilityRows(champion('hwei'), attacker('hwei'), dummy())
    expect(rows.map((row) => row.label)).toEqual(['AA', 'QQ', 'QW', 'QE', 'WE', 'WQ', 'WW', 'EQ', 'EW', 'EE', 'R'])
    expect(rows.find((row) => row.label === 'QW')?.name).toBe('Severing Bolt')
    expect(rows.find((row) => row.label === 'WE')?.kind).toBe('empowers')
    expect(rows.find((row) => row.label === 'WQ')?.kind).toBe('none')
  })
})

describe('rotation', () => {
  it('repeats the priority then an attack, enough passes for the time at that attack speed', () => {
    const actions = rotation(['q', 'e'], 1, 2)
    expect(actions.slice(0, 6)).toEqual(['Q', 'E', 'AA', 'Q', 'E', 'AA'])
    expect(actions).toHaveLength((2 + 2 + 1) * 3)
  })
})

describe('runCalculator', () => {
  it('reports both builds when comparing, and only build A otherwise', () => {
    expect(runCalculator(state(), dataset, false).b).toBeNull()
    const report = runCalculator(state({ buildB: { ...emptyBuild(), items: ['bf-sword'] } }), dataset, true)
    expect(report.a.ok && report.b?.ok).toBe(true)
  })

  it('a stronger build kills sooner and deals more per second', () => {
    const report = runCalculator(state({ buildB: { ...emptyBuild(), items: ['bf-sword', 'bf-sword'] } }), dataset, true)
    if (!report.a.ok || !report.b?.ok) throw new Error('both builds should run')
    expect(report.a.value.timeToKill).toBeDefined()
    expect(report.b.value.timeToKill!).toBeLessThan(report.a.value.timeToKill!)
    expect(report.b.value.dps).toBeGreaterThan(report.a.value.dps)
    expect(report.b.value.cost).toBe(2 * dataset.catalog.items.get('bf-sword')!.cost.total)
  })

  it('reports the combo, or the combo error without failing the rest', () => {
    const report = runCalculator(state(), dataset, false)
    expect(report.a.ok && report.a.value.combo?.damage).toBeGreaterThan(0)
    const broken = runCalculator(state({ combo: 'Q bogus' }), dataset, false)
    expect(broken.comboError).toMatch(/bogus/)
    expect(broken.a.ok && broken.a.value.combo).toBeNull()
  })

  it('names and sizes the target', () => {
    expect(runCalculator(state(), dataset, false).target).toEqual({ ok: true, value: { name: 'Custom dummy', hp: 3000, armor: 100, mr: 100 } })
    const preset = runCalculator(state({ target: { kind: 'preset', presetId: 'tank' } }), dataset, false).target
    expect(preset.ok && preset.value.name).toBe('Tank')
  })

  it("fills the champion's kit inputs: Senna's Mist stacks raise her AD", () => {
    const report = runCalculator(state({ championId: 'senna', buildA: { ...emptyBuild(), inputs: { 'senna-mist-stacks': 40 } } }), dataset, false)
    const base = runCalculator(state({ championId: 'senna' }), dataset, false)
    if (!report.a.ok || !base.a.ok) throw new Error('should run')
    expect(report.a.value.stats.ad! - base.a.value.stats.ad!).toBeCloseTo(50, 6)
  })

  it('reports an unknown champion as an error', () => {
    expect(runCalculator(state({ championId: 'nobody' }), dataset, false).a).toEqual({ ok: false, error: "unknown champion 'nobody'" })
  })
})

describe('isEmptyBuild', () => {
  it('is true only for a build with nothing picked', () => {
    expect(isEmptyBuild(emptyBuild())).toBe(true)
    expect(isEmptyBuild({ ...emptyBuild(), runes: ['electrocute'] })).toBe(false)
  })
})

describe('displayName', () => {
  it('title-cases names written in capitals and keeps mixed case', () => {
    expect(displayName('CUNNING SWEEP')).toBe('Cunning Sweep')
    expect(displayName("DRAKEHOUND'S STEP")).toBe("Drakehound's Step")
    expect(displayName('SUBJECT: DISASTER (Devastating Fire)')).toBe('SUBJECT: DISASTER (Devastating Fire)')
    expect(displayName('LACERATE (RECAST)')).toBe('Lacerate (Recast)')
    expect(displayName("Dragon's Rage")).toBe("Dragon's Rage")
  })
})
