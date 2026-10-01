import { describe, it, expect } from 'vitest'
import { buildImpact, renderBuildImpact } from '../../scripts/patch/build-impact'
import type { ImpactScenario } from '../../scripts/patch/build-impact'
import { buildChampionMap } from '../../src/champion-map'
import { getPatchDataset } from '../../src/patches/registry'

const side = (id: string) => {
  const dataset = getPatchDataset(id)
  return { dataset, champions: buildChampionMap(dataset.champions) }
}
const scenario = (label: string, items: string[], combo: string[]): ImpactScenario => ({
  label, championId: 'ambessa', level: 15, build: { items, runes: [], inputs: {} }, target: { hp: 10000, armor: 100, mr: 100 }, combo,
})

describe('buildImpact on 7.3 -> 7.3a', () => {
  const impact = buildImpact(side('7.3'), side('7.3a'), [
    scenario('botrk-aa', ['blade-of-the-ruined-king'], ['AA']),
    scenario('dance-aa', ['deaths-dance'], ['AA']),
    scenario('ghost', ['no-such-item'], ['AA']),
  ])

  it('reports the BotRK on-hit drop and leaves stats-only scenarios unchanged', () => {
    const botrk = impact.scenarios.find((entry) => entry.label === 'botrk-aa')!
    expect(botrk.after!).toBeLessThan(botrk.before!)
    const dance = impact.scenarios.find((entry) => entry.label === 'dance-aa')!
    expect(dance.after).toBeCloseTo(dance.before!, 9)
  })

  it('records a scenario that cannot run, naming the patch', () => {
    expect(impact.scenarios.find((entry) => entry.label === 'ghost')).toMatchObject({ before: null, after: null, error: expect.stringMatching(/^7\.3: .*no-such-item/) })
  })

  it("lists exactly 7.3a's real item changes: BotRK's passive, Death's Dance's price and Yun Tal's stats", () => {
    expect(impact.items.map((entry) => [entry.id, entry.changes])).toEqual([
      ['blade-of-the-ruined-king', ['effects']],
      ['deaths-dance', ['cost']],
      ['yun-tal-wildarrows', ['stats']],
    ])
    const dance = impact.items.find((entry) => entry.id === 'deaths-dance')!
    expect(dance.after!.efficiency).toBeLessThan(dance.before!.efficiency)
    expect(impact.statPrices).toEqual([])
  })

  it('renders the changed scenario, the failure and the item table', () => {
    const report = renderBuildImpact(impact)
    expect(report).toContain('- 1 scenarios changed, 1 unchanged, 1 can\'t run on both patches')
    expect(report).toMatch(/\| botrk-aa \| [\d.]+ \| [\d.]+ \| -[\d.]+% \|/)
    expect(report).toContain("| Death's Dance (`deaths-dance`) | cost | 3200 → 3300 | 128.4% → 124.5% |")
  })
})
