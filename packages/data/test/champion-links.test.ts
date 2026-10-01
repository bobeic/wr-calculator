import { describe, it, expect } from 'vitest'
import type { Champion } from '@wr-calc/schema'
import { championRows } from '../scripts/patch/diff'
import { checkChampion, championValue, parseRanks, sameValue } from '../scripts/patch/champion-sync'
import { buildPatchDiff } from '../scripts/patch/patch-diff'
import { readSnapshot } from '../scripts/patch/snapshot-io'
import { applyChampionSync } from '../src/patches/overlay'
import { CHAMPION_LINKS } from '../src/patches/champion-links'
import { CURRENT_PATCH, getPatchDataset } from '../src/patches/registry'

const SNAPSHOTS = new URL('../snapshots/wrpocket/', import.meta.url).pathname

describe(`champion links against patch ${CURRENT_PATCH}`, async () => {
  const snapshot = await readSnapshot(`${SNAPSHOTS}${CURRENT_PATCH}`)
  const dataset = getPatchDataset(CURRENT_PATCH)
  const cases = Object.entries(CHAMPION_LINKS).flatMap(([id, entry]) => entry.links.map((link) => [`${id} ${link.path}`, id, link] as const))

  it.each(cases)('%s matches its row and the model', (_, id, link) => {
    const rows = championRows(snapshot.champions.find((champion) => champion.id === id)!)
    expect(rows[link.row], link.row).toBeDefined()
    const model = championValue(dataset.champions.find((champion) => champion.id === id) as Champion, link.path)
    const fromRow = (link.value ?? ((ranks: number[]) => ({ byRank: ranks })))(parseRanks(rows[link.row]))
    expect(sameValue(model, fromRow), `${JSON.stringify(model)} vs ${JSON.stringify(fromRow)}`).toBe(true)
  })

  it('lists every scaling row of a linked champion as linked or ignored', () => {
    for (const [id, entry] of Object.entries(CHAMPION_LINKS)) {
      const rows = Object.keys(championRows(snapshot.champions.find((champion) => champion.id === id)!))
      const known = new Set([...entry.links.map((link) => link.row), ...entry.ignore])
      expect(rows.filter((row) => !known.has(row)), id).toEqual([])
    }
  })
})

describe('checkChampion', () => {
  const ambessa = getPatchDataset('7.3a').champions.find((champion) => champion.id === 'ambessa')!
  const row = (field: string, before: string, after: string) => ({ field, before, after })
  const q = 'Swings, dealing 30 (+30% bonus AD) physical damage. Edge: 60 (+60% bonus AD).'

  it('turns linked row changes into updates and accepts description numbers from those rows', () => {
    const result = checkChampion('ambessa', [
      row('q.scaling.强化伤害', '60/80/100/120', '65/85/105/125'),
      row('q.scaling.基础伤害', '30/40/50/60', '32/42/52/62'),
      { field: 'q.description', before: q, after: q.replace('30 (', '32 (').replace('60 (', '65 ('), numbers: [], wordDiff: '' },
      row('stats.ad', 'Lv1 58', 'Lv1 60'),
    ], CHAMPION_LINKS.ambessa, ambessa)
    expect(result).toEqual({
      ok: true,
      updates: [{ championId: 'ambessa', path: 'abilities.q.damage[0].base', value: { byRank: [65, 85, 105, 125] }, note: 'q.scaling.强化伤害: 60/80/100/120 -> 65/85/105/125' }],
      changedNumbers: ['65', '85', '105', '125', '32', '42', '52', '62'],
    })
  })

  it('refuses an unlinked row, a ratio change in the description, and a link the model disagrees with', () => {
    expect(checkChampion('ambessa', [row('q.scaling.新行', '1/2', '2/3')], CHAMPION_LINKS.ambessa, ambessa)).toMatchObject({ ok: false, reason: /no link/ })
    const ratio = { field: 'q.description', before: q, after: q.replace('+60%', '+70%'), numbers: [], wordDiff: '' }
    expect(checkChampion('ambessa', [ratio], CHAMPION_LINKS.ambessa, ambessa)).toMatchObject({ ok: false, reason: /70 is not in a changed scaling row/ })
    expect(checkChampion('ambessa', [row('q.scaling.强化伤害', '61/80/100/120', '65/85/105/125')], CHAMPION_LINKS.ambessa, ambessa))
      .toMatchObject({ ok: false, reason: /the model has/ })
  })

  it('produces updates the overlay applies', () => {
    const result = checkChampion('ambessa', [row('r.scaling.护甲穿透', '10%/20%/30%', '12%/24%/36%')], CHAMPION_LINKS.ambessa, ambessa)
    if (!result.ok) throw new Error(result.reason)
    const [updated] = applyChampionSync([ambessa], result.updates)
    expect(updated.abilities.r.effects?.[0]).toMatchObject({ amount: { byRank: [0.12, 0.24, 0.36] } })
  })
})

describe('end to end on real data', async () => {
  // A made-up next patch: Cunning Sweep's edge damage goes 60/80/100/120 -> 65/85/105/125, in the row and the text.
  const before = await readSnapshot(`${SNAPSHOTS}${CURRENT_PATCH}`)
  const after = {
    ...before,
    meta: { ...before.meta, patch: 'next' },
    champions: before.champions.map((champion) => {
      if (champion.id !== 'ambessa') return champion
      const abilities = Object.fromEntries(Object.entries(champion.abilities).map(([key, ability]) => {
        if (!ability.scaling.some((row) => row.type === '强化伤害' && row.value === '60/80/100/120')) return [key, ability]
        return [key, {
          ...ability,
          scaling: ability.scaling.map((row) => (row.type === '强化伤害' && row.value === '60/80/100/120' ? { ...row, value: '65/85/105/125' } : row)),
          description: { ...ability.description, en: ability.description.en.replace('increased to 60 (', 'increased to 65 (') },
        }]
      }))
      return { ...champion, abilities }
    }),
  }
  const dataset = getPatchDataset(CURRENT_PATCH)
  const diff = buildPatchDiff({
    before, after,
    handModelled: { items: [], champions: ['ambessa'] }, previousStale: [], covered: { items: [], champions: [] }, goldens: [],
    notesBefore: [], notesAfter: [], notes: null,
    autoApply: { handItems: [], handChampions: dataset.champions.filter((champion) => champion.id === 'ambessa') },
  })

  it('applies the row change to the modelled Q through the real link', () => {
    expect(diff.autoApplied.map((entry) => entry.id)).toEqual(['ambessa'])
    expect(diff.championSync).toEqual([{
      championId: 'ambessa', path: 'abilities.q.damage[0].base', value: { byRank: [65, 85, 105, 125] },
      note: 'q.scaling.强化伤害: 60/80/100/120 -> 65/85/105/125',
    }])
    expect(diff.needsReview).toEqual([])
  })
})
