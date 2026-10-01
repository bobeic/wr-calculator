import { describe, it, expect } from 'vitest'
import { CURRENT_PATCH, getPatchDataset } from '@wr-calc/data'
import { CURRENT_DATASET, datasetFor } from '../src/lib/dataset'

describe('web datasets', () => {
  it('CURRENT_DATASET is the current patch', () => {
    expect([...CURRENT_DATASET.catalog.items.keys()]).toEqual(getPatchDataset(CURRENT_PATCH).items.map((item) => item.id))
  })

  it('datasetFor builds the champion map and keeps targets', () => {
    const dataset = datasetFor('7.3')
    expect(dataset.champions.has('jinx')).toBe(true)
    expect(dataset.targets.map((preset) => preset.id)).toEqual(['squishy', 'bruiser', 'tank'])
  })
})
