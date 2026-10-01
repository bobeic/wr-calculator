import { describe, it, expect } from 'vitest'
import { diffWords, numberChanges, renderWordDiff } from '../../scripts/patch/text-diff'

describe('diffWords', () => {
  it('marks only the changed tokens', () => {
    const ops = diffWords('deals 7% damage', 'deals 6% damage')
    expect(ops.filter((op) => op.op !== 'same')).toEqual([
      { op: 'del', text: '7%' }, { op: 'add', text: '6%' },
    ])
  })

  it('is all same for equal text', () => {
    expect(diffWords('a b', 'a b').every((op) => op.op === 'same')).toBe(true)
  })
})

describe('numberChanges', () => {
  it('pairs each changed number in a rank list', () => {
    expect(numberChanges(diffWords('60/80/100 (+60% bonus AD)', '60/85/110 (+60% bonus AD)'))).toEqual([
      { before: '80', after: '85' }, { before: '100', after: '110' },
    ])
  })

  it('keeps decimals and percents whole', () => {
    expect(numberChanges(diffWords('8.5% for melee', '8% for melee'))).toEqual([{ before: '8.5%', after: '8%' }])
  })

  it('is empty for a wording-only change', () => {
    expect(numberChanges(diffWords('Basic attacks deal 15 damage', 'Attacks deal 15 damage'))).toEqual([])
  })

  it('pads a number with no partner with an empty string', () => {
    expect(numberChanges(diffWords('deals 10 damage', 'deals 10 (+5) damage'))).toEqual([{ before: '', after: '5' }])
  })
})

describe('renderWordDiff', () => {
  it('strikes deletions and bolds additions, keeping spaces outside the markers', () => {
    expect(renderWordDiff(diffWords('deals 7% damage', 'deals 6% damage'))).toBe('deals ~~7%~~**6%** damage')
  })

  it('escapes markdown in the source text so it cannot collide with the diff markers', () => {
    expect(renderWordDiff(diffWords('**Awe**: gain AP', 'Awe: gain AP')))
      .toBe('~~\\*\\*~~Awe~~\\*\\*~~: gain AP')
    expect(renderWordDiff(diffWords('a_b ~c~ <d>', 'a_b ~c~ <d>'))).toBe('a\\_b \\~c\\~ \\<d\\>')
  })
})
