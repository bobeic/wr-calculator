import { describe, it, expect } from 'vitest'
import { summarizeBuild } from '../src/lib/build-summary'
import { datasetFor } from '../src/lib/dataset'

const { catalog } = datasetFor('7.3a')

describe('summarizeBuild', () => {
  it('lists cost and stat efficiency per item, the total, and no issues for a legal build', () => {
    const summary = summarizeBuild({ items: ['long-sword', 'deaths-dance'], boots: 'plated-steelcaps', runes: [], inputs: {} }, catalog)
    expect(summary.items.map((item) => [item.id, item.cost])).toEqual([['long-sword', 500], ['deaths-dance', 3300], ['plated-steelcaps', 1200]])
    expect(summary.items[0].efficiency).toBeCloseTo(1, 9)
    expect(summary.totalCost).toBe(5000)
    expect(summary.issues).toEqual([])
  })

  it('reports shop-rule issues', () => {
    const summary = summarizeBuild({ items: ['deaths-dance', 'deaths-dance', 'black-cleaver', 'seryldas-grudge'], runes: [], inputs: {} }, catalog)
    expect(summary.issues.map((issue) => issue.code)).toEqual(['duplicate-item', 'exclusive-group'])
  })
})
