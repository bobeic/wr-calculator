import { describe, it, expect } from 'vitest'
import type { CnChampionStat, CnStatsSnapshot } from '@wr-calc/data'
import { CN_BUILDS, CN_STATS } from '@wr-calc/data'
import { assignTiers } from '../src/lib/site/tiers'
import { championLanes } from '../src/lib/site/champion-lanes'
import { calculatorHref, changeLabel, pct } from '../src/lib/site/format'
import { CURRENT_DATASET } from '../src/lib/dataset'
import { cnEntryHref, cnFieldLabel } from '../src/lib/site/cn-preview'
import { decodeState } from '../src/lib/url-state'
import { byWinRate, gemLead, hiddenGems } from '../src/lib/site/builds'
import { workedExample } from '../src/lib/site/worked-example'
import { overlookedWinners } from '../src/components/site/meta-map'
import { loadGuide, parseGuide } from '../src/lib/site/guides'

const row = (championId: string, strengthRank: number): CnChampionStat => ({
  championId, heroId: '1', winRate: 0.5, pickRate: 0.1, banRate: 0, strengthRank,
})

describe('assignTiers', () => {
  it('cuts a lane into tiers by strength order', () => {
    const tiers = assignTiers(Array.from({ length: 40 }, (_, index) => row(`c${index}`, index + 1))).map((entry) => entry.tier)
    expect(tiers.filter((tier) => tier === 'S+')).toHaveLength(3)
    expect(tiers.filter((tier) => tier === 'S')).toHaveLength(7)
    expect(tiers.filter((tier) => tier === 'C')).toHaveLength(10)
    expect(tiers[0]).toBe('S+')
    expect(tiers[39]).toBe('C')
  })
})

describe('championLanes', () => {
  it('lists a champion\'s lanes, most picked first', () => {
    const stats = structuredClone(CN_STATS) as CnStatsSnapshot
    stats.ranks.all.top = [{ ...row('garen', 1), pickRate: 0.02 }]
    stats.ranks.all.mid = [{ ...row('garen', 3), pickRate: 0.05 }, row('ahri', 1)]
    stats.ranks.all.jungle = []
    stats.ranks.all.adc = []
    stats.ranks.all.support = []
    expect(championLanes(stats, 'garen').map((lane) => [lane.lane, lane.laneSize])).toEqual([['mid', 2], ['top', 1]])
  })
})

describe('pct', () => {
  it('formats a fraction', () => {
    expect(pct(0.538765)).toBe('53.9%')
  })
})

describe('changeLabel', () => {
  it('takes the words before the old value', () => {
    expect(changeLabel('Health per level : 128 → 136', '128')).toBe('Health per level:')
    expect(changeLabel('Damage: 33 - 333 → 40-285', '33 - 333')).toBe('Damage:')
  })
})

describe('CN build calculator links', () => {
  it('decode every snapshot build with no dropped ids', () => {
    for (const [championId, lanes] of Object.entries(CN_BUILDS.champions)) {
      for (const { core, runes } of lanes) {
        for (const build of core) {
          const href = calculatorHref(championId, build.ids, runes[0]?.ids ?? [])
          const { state, issues } = decodeState(new URLSearchParams(href.split('?')[1]), CURRENT_DATASET)
          expect(issues, `${championId}: ${href}`).toEqual([])
          expect(state.buildA.items).toEqual(build.ids)
        }
      }
    }
  })
})

describe('CN preview labels', () => {
  it('names ability rows in English where known and links only global entries', () => {
    expect(cnFieldLabel('q.基础伤害')).toBe('Q base damage')
    expect(cnFieldLabel('r.未知')).toBe('R 未知')
    expect(cnFieldLabel('price')).toBe('price')
    expect(cnEntryHref('champion:aatrox')).toBe('/champions/aatrox/')
    expect(cnEntryHref('item:cn-2119')).toBeNull()
  })
})

describe('hidden gems', () => {
  const set = (winRate: number, pickRate: number) => ({ ids: [`i${winRate}`], winRate, pickRate })
  it('flags a core that out-wins the most-picked one by 3+ points in 5%+ of games', () => {
    const top = set(0.5, 0.3)
    expect(gemLead(set(0.535, 0.06), top)).toBeCloseTo(0.035)
    expect(gemLead(set(0.52, 0.06), top)).toBeNull()
    expect(gemLead(set(0.6, 0.04), top)).toBeNull()
    expect(gemLead(top, top)).toBeNull()
  })

  it('finds gems in the real builds, biggest lead first, each linking to a valid comparison', () => {
    const gems = hiddenGems(CN_BUILDS)
    expect(gems.length).toBeGreaterThan(0)
    expect(gems.map((gem) => gem.lead)).toEqual([...gems.map((gem) => gem.lead)].sort((a, b) => b - a))
    const gem = gems[0]
    const href = calculatorHref(gem.championId, gem.mostPicked.ids, gem.runes, { items: gem.build.ids, runes: gem.runes })
    const { state, issues } = decodeState(new URLSearchParams(href.split('?')[1]), CURRENT_DATASET)
    expect(issues).toEqual([])
    expect(state.buildB.items).toEqual(gem.build.ids)
  })
})

describe('byWinRate', () => {
  it('sorts by win rate and drops champions picked under 1%', () => {
    const rows = [
      { ...row('a', 1), winRate: 0.51 }, { ...row('b', 2), winRate: 0.6, pickRate: 0.005 }, { ...row('c', 3), winRate: 0.55 },
    ]
    expect(byWinRate(rows, 5).map((entry) => entry.championId)).toEqual(['c', 'a'])
  })
})

describe('workedExample', () => {
  it('runs the calculator on the biggest off-meta winner against its most-picked core', () => {
    const example = workedExample(hiddenGems(CN_BUILDS)[0])
    expect(example).not.toBeNull()
    expect(example!.mostPicked.comboDamage).toBeGreaterThan(0)
    expect(example!.winner.comboDamage).toBeGreaterThan(0)
    expect(example!.target.hp).toBeGreaterThan(0)
  })
})

describe('overlookedWinners', () => {
  it('keeps 50%+ win rates picked under the lane median, best first', () => {
    const rows = assignTiers([
      { ...row('a', 1), winRate: 0.53, pickRate: 0.006 }, { ...row('b', 2), winRate: 0.55, pickRate: 0.007 },
      { ...row('c', 3), winRate: 0.6, pickRate: 0.2 }, { ...row('d', 4), winRate: 0.48, pickRate: 0.05 },
      { ...row('e', 5), winRate: 0.51, pickRate: 0.1 },
    ])
    expect(overlookedWinners(rows).map((entry) => entry.championId)).toEqual(['b', 'a'])
  })
})

describe('workedExample link', () => {
  it('opens the calculator on the same target the example used', () => {
    const example = workedExample(hiddenGems(CN_BUILDS)[0])!
    const { state, issues } = decodeState(new URLSearchParams(example.href.split('?')[1]), CURRENT_DATASET)
    expect(issues).toEqual([])
    expect(state.target).toEqual({ kind: 'preset', presetId: 'bruiser' })
    expect(example.mostPicked.timeToKill).toBeGreaterThan(0)
  })
})

describe('parseGuide', () => {
  it('reads sections, paragraphs, bullets, bold and matchup notes, and drops the template placeholders', () => {
    const guide = parseGuide([
      'Title line, not shown',
      '## In short',
      'Wins by **dashing** in',
      'after level 6.',
      '',
      '## Combos',
      '- E then Q',
      '- R to finish',
      '',
      '## Matchups',
      '- Darius: stay out of **Q** range.',
      '- Dr. Mundo: farm safely.',
      '',
      '## Common mistakes',
      '-',
    ].join('\n'))
    expect(guide.sections).toEqual([
      { title: 'In short', blocks: [{ kind: 'p', text: [{ text: 'Wins by ', bold: false }, { text: 'dashing', bold: true }, { text: ' in after level 6.', bold: false }] }] },
      { title: 'Combos', blocks: [{ kind: 'ul', items: [[{ text: 'E then Q', bold: false }], [{ text: 'R to finish', bold: false }]] }] },
    ])
    expect(guide.matchups.map((note) => note.name)).toEqual(['Darius', 'Dr. Mundo'])
    expect(guide.matchups[0].text[1]).toEqual({ text: 'Q', bold: true })
  })

  it('has no guide for a champion without a file', () => {
    expect(loadGuide('no-such-champion')).toBeNull()
  })
})
