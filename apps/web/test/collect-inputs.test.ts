import { describe, it, expect } from 'vitest'
import type { Rune } from '@wr-calc/schema'
import { buildCatalog, PATCH_7_3_CATALOG, PATCH_7_3_ITEMS } from '@wr-calc/data'
import { collectInputs, inputValue, resolveInputs } from '../src/lib/collect-inputs'
import type { DebugBuild } from '../src/lib/debug-state'

const catalog = PATCH_7_3_CATALOG

function build(partial: Partial<DebugBuild>): DebugBuild {
  return { items: [], runes: [], inputs: {}, ...partial }
}

const ids = (b: DebugBuild) => collectInputs(b, catalog).map((input) => input.id)

describe('collectInputs', () => {
  it('returns nothing for items whose effects declare no inputs', () => {
    expect(ids(build({ items: ['long-sword', 'trinity-force'] }))).toEqual([])
  })

  it('keeps purchase order', () => {
    expect(ids(build({ items: ['seraphs-embrace', 'heartsteel'] }))).toEqual([
      'seraphs-embrace-shield-used', 'heartsteel-stacks', 'heartsteel-charge-ready',
    ])
  })

  it('dedupes an input declared by the same item bought twice', () => {
    expect(ids(build({ items: ['heartsteel', 'heartsteel'] }))).toEqual([
      'heartsteel-stacks', 'heartsteel-charge-ready',
    ])
  })

  it('skips unknown ids', () => {
    expect(ids(build({ items: ['nope'], boots: 'nope-boots', runes: ['nope-rune'] }))).toEqual([])
  })

  it('includes boots and rune inputs after items', () => {
    const shieldEffect = PATCH_7_3_CATALOG.items.get('seraphs-embrace')!.effects[1]
    const testRune: Rune = {
      id: 'test-rune', name: 'Test Rune', path: 'test', slot: 'keystone',
      effects: [{
        ...shieldEffect,
        id: 'test-rune-effect',
        inputs: [{ type: 'boolean', id: 'test-rune-toggle', label: 'Test toggle', default: true }],
      }],
    }
    const withRune = buildCatalog(PATCH_7_3_ITEMS, [testRune])
    // Boots aren't tier-validated here, so heartsteel stands in for boots that declare an input.
    const result = collectInputs(
      build({ items: ['seraphs-embrace'], boots: 'heartsteel', runes: ['test-rune'] }), withRune,
    )
    expect(result.map((input) => input.id)).toEqual([
      'seraphs-embrace-shield-used', 'heartsteel-stacks', 'heartsteel-charge-ready', 'test-rune-toggle',
    ])
  })
})

describe('inputValue', () => {
  const [stacks] = collectInputs(build({ items: ['heartsteel'] }), catalog)

  it('falls back to the declared default when unset', () => {
    expect(inputValue(stacks, {})).toBe(0)
  })

  it('returns the set value', () => {
    expect(inputValue(stacks, { 'heartsteel-stacks': 12 })).toBe(12)
  })
})

describe('resolveInputs', () => {
  it('fills every declared default, overridden by set values', () => {
    expect(resolveInputs(build({
      items: ['heartsteel', 'seraphs-embrace'], inputs: { 'heartsteel-stacks': 7 },
    }), catalog)).toEqual({
      'heartsteel-stacks': 7, 'heartsteel-charge-ready': false, 'seraphs-embrace-shield-used': false,
    })
  })

  it('returns an empty record for a build with no inputs', () => {
    expect(resolveInputs(build({ items: ['long-sword'] }), catalog)).toEqual({})
  })
})
