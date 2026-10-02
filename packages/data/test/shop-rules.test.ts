import { describe, it, expect } from 'vitest'
import { validateBuild } from '@wr-calc/calc'
import { getPatchDataset } from '../src/patches/registry'
import { withoutNonBlockingPassives } from '../src/shop-rules'

// The user's shop readings on 7.3a (2026-10-03). Each pair is checked against the real catalog.
const { catalog } = getPatchDataset('7.3a')
const blocks = (...items: string[]) => validateBuild({ items, runes: [], inputs: {} }, catalog.items, catalog.runes)
  .some((issue) => issue.code === 'shared-passive' || issue.code === 'exclusive-group')

describe('shop rules read in game (7.3a)', () => {
  it("Rylai's and Serylda's can be bought together", () => {
    expect(blocks('rylais-crystal-scepter', 'seryldas-grudge')).toBe(false)
  })

  it("Dead Man's Plate and Youmuu's can't", () => {
    expect(blocks('dead-mans-plate', 'youmuus-ghostblade')).toBe(true)
  })

  it("only one of Sterak's, Maw and Mantle of the Twelfth Hour; Seraph's goes with any of them", () => {
    expect(blocks('steraks-gage', 'maw-of-malmortius')).toBe(true)
    expect(blocks('steraks-gage', 'mantle-of-the-twelfth-hour')).toBe(true)
    expect(blocks('maw-of-malmortius', 'mantle-of-the-twelfth-hour')).toBe(true)
    for (const id of ['steraks-gage', 'maw-of-malmortius', 'mantle-of-the-twelfth-hour']) {
      expect(blocks('seraphs-embrace', id), id).toBe(false)
    }
  })

  it('only one of Sunfire Aegis and Hollow Radiance', () => {
    expect(blocks('sunfire-aegis', 'hollow-radiance')).toBe(true)
  })
})

describe('withoutNonBlockingPassives', () => {
  it('drops only the listed names, and the field when nothing is left', () => {
    expect(withoutNonBlockingPassives({ uniquePassives: ['Icy', 'Momentum'] })).toEqual({ uniquePassives: ['Momentum'] })
    expect(withoutNonBlockingPassives({ uniquePassives: ['Icy'] })).toEqual({})
    const untouched = { uniquePassives: ['Lifeline'] }
    expect(withoutNonBlockingPassives(untouched)).toBe(untouched)
  })
})
