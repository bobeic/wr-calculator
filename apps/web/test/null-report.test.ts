import { describe, it, expect } from 'vitest'
import { PATCH_7_3_CATALOG } from '@wr-calc/data'
import { nullReport } from '../src/lib/null-report'

describe('nullReport', () => {
  it('finds nulls in nested objects and arrays with readable paths', () => {
    const value = { a: null, b: { c: [1, null, { d: null }] }, e: undefined, f: 0, g: '' }
    expect(nullReport([{ label: 'x', value }])).toEqual([
      { path: 'x › a' }, { path: 'x › b.c[1]' }, { path: 'x › b.c[2].d' },
    ])
  })

  it('finds nulls inside a byLevel scalar', () => {
    expect(nullReport([{ label: 'x', value: { amount: { byLevel: [1, null] } } }])).toEqual([
      { path: 'x › amount.byLevel[1]' },
    ])
  })

  it('reports a top-level null as the label alone', () => {
    expect(nullReport([{ label: 'x', value: null }])).toEqual([{ path: 'x' }])
  })

  it('returns nothing for no sources or fully-filled data', () => {
    expect(nullReport([])).toEqual([])
    expect(nullReport([{ label: 'x', value: { a: 1, b: [2] } }])).toEqual([])
  })

  it('reports no nulls for the fully entered patch 7.3 items', () => {
    const sources = [...PATCH_7_3_CATALOG.items.values()].map((item) => ({ label: `item ${item.id}`, value: item }))
    expect(nullReport(sources)).toEqual([])
  })
})
