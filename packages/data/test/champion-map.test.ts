import { describe, it, expect } from 'vitest'
import { buildChampionMap, PATCH_7_3_CHAMPIONS } from '../src'

describe('buildChampionMap', () => {
  it('indexes champions by id', () => {
    expect(buildChampionMap(PATCH_7_3_CHAMPIONS).get('jinx')?.name).toBe('Jinx')
  })

  it('has one entry per patch 7.3 champion (ids are unique)', () => {
    expect(buildChampionMap(PATCH_7_3_CHAMPIONS).size).toBe(PATCH_7_3_CHAMPIONS.length)
  })

  it('returns an empty map for no champions', () => {
    expect(buildChampionMap([]).size).toBe(0)
  })
})
