import { describe, it, expect } from 'vitest'
import { buildPatchDiff } from '../scripts/patch/patch-diff'
import { checkDescription, maskNumbers, modelValue, numberSpans, resolveLink } from '../scripts/patch/text-sync'
import { readSnapshot } from '../scripts/patch/snapshot-io'
import { applyTextSync } from '../src/patches/overlay'
import { CURRENT_PATCH, getPatchDataset } from '../src/patches/registry'
import { ITEM_TEXT_LINKS } from '../src/patches/text-links'
import type { ItemTextLinks } from '../src/patches/text-links'
import type { Item } from '@wr-calc/schema'

const SNAPSHOTS = new URL('../snapshots/wrpocket/', import.meta.url).pathname

// Links whose current text and model disagree on purpose, by `<effect or item id>.<path>`. A number-only
// text change to one of these always stays flagged, because checkDescription refuses a link the model disagrees with.
const KNOWN_DIVERGENCES: Record<string, string> = {
  'botrk-mists-edge.pctTargetCurrentHp': "wrpocket's 7.3a text says 6%; the official notes say 7% and list no 7.3a change (reviewed.ts)",
  'eclipse-ever-rising-moon.damage.ratios[0].value': 'the model uses the WR wiki melee value (6%); wrpocket says 7%. Pending an in-game check',
}

describe(`text links against patch ${CURRENT_PATCH}`, async () => {
  const snapshot = await readSnapshot(`${SNAPSHOTS}${CURRENT_PATCH}`)
  const dataset = getPatchDataset(CURRENT_PATCH)
  const cases = Object.entries(ITEM_TEXT_LINKS).flatMap(([itemId, entry]) => entry.links.map((link) => ({ itemId, link })))

  it('only links hand-modelled items with a wrpocket description', () => {
    for (const itemId of Object.keys(ITEM_TEXT_LINKS)) {
      expect(dataset.handModelled.items.some((item) => item.id === itemId), itemId).toBe(true)
      expect(snapshot.items.some((item) => item.id === itemId), itemId).toBe(true)
    }
  })

  it.each(cases.map(({ itemId, link }) => [`${link.effectId ?? itemId}.${link.path}`, itemId, link] as const))(
    '%s resolves once and matches the model',
    (key, itemId, link) => {
      const text = snapshot.items.find((item) => item.id === itemId)?.description.en ?? ''
      const resolved = resolveLink(text, link)
      expect(resolved, key).not.toHaveProperty('error')
      const model = modelValue(dataset.items.find((item) => item.id === itemId) as Item, link)
      expect(model, `${key} path`).toBeTypeOf('number')
      if (key in KNOWN_DIVERGENCES) {
        expect((resolved as { value: number }).value, `${key} is listed as a divergence but now agrees; remove it`).not.toBeCloseTo(model as number, 9)
      } else {
        expect((resolved as { value: number }).value, key).toBeCloseTo(model as number, 9)
      }
    },
  )

  it('lists no divergence for a link that no longer exists', () => {
    const keys = new Set(cases.map(({ itemId, link }) => `${link.effectId ?? itemId}.${link.path}`))
    expect(Object.keys(KNOWN_DIVERGENCES).filter((key) => !keys.has(key))).toEqual([])
  })
})

describe('numberSpans and maskNumbers', () => {
  it('reads thousands separators and decimals', () => {
    expect(numberSpans('1,200 units, 7.5% and 30').map((span) => span.text)).toEqual(['1200', '7.5', '30'])
  })

  it('masks numbers and folds case and whitespace', () => {
    expect(maskNumbers('Deals 7%  of  max Health (30 second Cooldown)')).toBe(maskNumbers('deals 6% of max health (25 second cooldown)'))
  })
})

describe('checkDescription', () => {
  const item: Item = {
    id: 'x', name: 'X', tier: 'legendary', cost: { total: 1, combine: 1 }, recipe: [], stats: { critDamage: 0.3 }, tags: [],
    effects: [{ kind: 'onHit', id: 'x-hit', name: 'Hit', description: '', support: 'full', damageType: 'physical', pctTargetCurrentHp: 0.07, minDamage: 15 } as unknown as Item['effects'][number]],
    provenance: { source: 'wiki', patch: '7.3', verifiedInGame: false },
  }
  const links: ItemTextLinks = {
    links: [
      { effectId: 'x-hit', path: 'pctTargetCurrentHp', capture: [/deal (\d+)% of current Health/], value: ([n]) => n / 100 },
      { effectId: 'x-hit', path: 'minDamage', capture: [/minimum (\d+)/] },
      { path: 'stats.critDamage', capture: [/from (\d+)%/, /to (\d+)%/], value: ([from, to]) => (to - from) / 100 },
    ],
    ignore: [/Slow:[^\n]*/],
  }
  const text = (hit: number, min: number, slow: number, crit = 230): string =>
    `Attacks deal ${hit}% of current Health, minimum ${min}. Crit from 200% to ${crit}%.\nSlow: ${slow}% for 1 second.`

  it('turns linked number changes into updates, effect and item fields alike', () => {
    expect(checkDescription('x', text(7, 15, 30), text(6, 20, 30, 240), links, item)).toEqual({
      ok: true,
      updates: [
        { itemId: 'x', effectId: 'x-hit', path: 'pctTargetCurrentHp', value: 0.06, note: '7 -> 6' },
        { itemId: 'x', effectId: 'x-hit', path: 'minDamage', value: 20, note: '15 -> 20' },
        { itemId: 'x', path: 'stats.critDamage', value: 0.4, note: '230 -> 240' },
      ],
      changedLinkedNumbers: ['6', '20', '240'],
    })
  })

  it('accepts a change inside an ignored span with no updates', () => {
    expect(checkDescription('x', text(7, 15, 30), text(7, 15, 40), links, item)).toEqual({ ok: true, updates: [], changedLinkedNumbers: [] })
  })

  it('refuses a wording change', () => {
    expect(checkDescription('x', text(7, 15, 30), `${text(7, 15, 30)} Now also burns.`, links, item)).toMatchObject({ ok: false, reason: /wording/ })
  })

  it('refuses a changed number no link or ignore covers', () => {
    const before = `Lasts 3 seconds. ${text(7, 15, 30)}`
    expect(checkDescription('x', before, before.replace('3 seconds', '4 seconds'), links, item)).toMatchObject({ ok: false, reason: /no link for 3 -> 4/ })
  })

  it('refuses when the old text and the model disagree (a divergence stays flagged)', () => {
    expect(checkDescription('x', text(8, 15, 30), text(6, 15, 30), links, item)).toMatchObject({ ok: false, reason: /old text gives 0.08, the model has 0.07/ })
  })

  it('produces updates the overlay can apply', () => {
    const result = checkDescription('x', text(7, 15, 30), text(6, 20, 30, 240), links, item)
    if (!result.ok) throw new Error(result.reason)
    const [updated] = applyTextSync([item], result.updates)
    expect(updated.stats.critDamage).toBeCloseTo(0.4)
    expect(updated.effects[0]).toMatchObject({ pctTargetCurrentHp: 0.06, minDamage: 20 })
    expect(item.effects[0]).toMatchObject({ pctTargetCurrentHp: 0.07 })
  })
})

describe('end to end on real data', async () => {
  // A made-up next patch: Rabadon's Overkill goes 30% -> 35% in wrpocket, and the notes say so.
  const before = await readSnapshot(`${SNAPSHOTS}${CURRENT_PATCH}`)
  const after = {
    ...before,
    meta: { ...before.meta, patch: 'next' },
    items: before.items.map((item) => (item.id === 'rabadons-deathcap'
      ? { ...item, description: { ...item.description, en: item.description.en.replace('30%', '35%') } }
      : item)),
  }
  const dataset = getPatchDataset(CURRENT_PATCH)
  const run = (afterValue: string) => buildPatchDiff({
    before, after,
    handModelled: { items: dataset.handModelled.items.map((item) => item.id), champions: [] },
    previousStale: [], covered: { items: [], champions: [] }, goldens: [], notesBefore: [], notesAfter: [],
    notes: { url: 'u', notes: { patch: 'next', url: 'u', title: '', published: '', entries: [{
      source: 'rich-text', section: 'ITEMS', excluded: false, heading: "Rabadon's Deathcap",
      lines: [{ group: null, text: `Overkill: 30% → ${afterValue}`, before: '30%', after: afterValue }],
    }] } },
    autoApply: { handItems: dataset.items.filter((item) => dataset.handModelled.items.some((hand) => hand.id === item.id)) },
  })

  it('applies a confirmed change through the real link', () => {
    const diff = run('35%')
    expect(diff.autoApplied.map((entry) => entry.id)).toEqual(['rabadons-deathcap'])
    expect(diff.textSync).toEqual([{ itemId: 'rabadons-deathcap', effectId: 'rabadons-deathcap-magic-opus', path: 'amount', value: 0.35, note: '30 -> 35' }])
    expect(diff.needsReview).toEqual([])
  })

  it('keeps it flagged when the notes give a different number', () => {
    const diff = run('40%')
    expect(diff.autoApplied).toEqual([])
    expect(diff.needsReview.map((flag) => flag.id)).toEqual(['rabadons-deathcap'])
  })
})
