import { describe, it, expect } from 'vitest'
import { findMissingComboItems, parseCombo, parsePriority } from '../src/lib/parse-combo'
import type { DebugBuild } from '../src/lib/debug-state'

describe('parseCombo', () => {
  it('parses every action form', () => {
    expect(parseCombo('AA Q W E R item:trinity-force wait:0.5')).toEqual({
      ok: true, actions: ['AA', 'Q', 'W', 'E', 'R', 'item:trinity-force', 'wait:0.5'],
    })
  })

  it('is case-insensitive for AA/Q/W/E/R and tolerates extra whitespace', () => {
    expect(parseCombo('  q aa\tR  ')).toEqual({ ok: true, actions: ['Q', 'AA', 'R'] })
  })

  it('accepts any case for the item:/wait: prefixes but keeps the item id verbatim', () => {
    expect(parseCombo('ITEM:Some-Id WAIT:2')).toEqual({ ok: true, actions: ['item:Some-Id', 'wait:2'] })
  })

  it('returns no actions for empty or blank text', () => {
    expect(parseCombo('')).toEqual({ ok: true, actions: [] })
    expect(parseCombo('   ')).toEqual({ ok: true, actions: [] })
  })

  it.each(['wait:', 'wait:-1', 'wait:abc', 'wait:Infinity'])('rejects %s and reports its index', (token) => {
    const result = parseCombo(`AA ${token}`)
    expect(result).toMatchObject({ ok: false, tokenIndex: 1 })
    if (!result.ok) expect(result.error).toContain(token)
  })

  it('rejects item: with no id', () => {
    expect(parseCombo('item:')).toMatchObject({ ok: false, tokenIndex: 0 })
  })

  it('reports the index of an unknown token', () => {
    expect(parseCombo('Q AA XX R')).toEqual({
      ok: false, error: "unknown combo token 'XX'", tokenIndex: 2,
    })
  })
})

describe('findMissingComboItems', () => {
  const buildA: DebugBuild = { items: ['trinity-force'], boots: 'plated-steelcaps', runes: [], inputs: {} }
  const buildB: DebugBuild = { items: ['long-sword'], runes: [], inputs: {} }

  it('returns no warnings when every item: token is in both builds', () => {
    expect(findMissingComboItems(['item:trinity-force'], buildA, buildA)).toEqual([])
  })

  it('warns for the one build missing the item', () => {
    expect(findMissingComboItems(['item:trinity-force'], buildA, buildB)).toEqual([
      "combo: item 'trinity-force' is not in build B",
    ])
  })

  it('warns for both builds when the item is a mistyped/unknown id', () => {
    expect(findMissingComboItems(['item:mystery'], buildA, buildB)).toEqual([
      "combo: item 'mystery' is not in build A",
      "combo: item 'mystery' is not in build B",
    ])
  })

  it('matches an item id equipped as boots', () => {
    expect(findMissingComboItems(['item:plated-steelcaps'], buildA, buildB)).toEqual([
      "combo: item 'plated-steelcaps' is not in build B",
    ])
  })

  it('ignores non-item actions and de-dupes a repeated item token', () => {
    expect(findMissingComboItems(['AA', 'item:mystery', 'wait:1', 'item:mystery'], buildA, buildB)).toEqual([
      "combo: item 'mystery' is not in build A",
      "combo: item 'mystery' is not in build B",
    ])
  })

  it('returns no warnings for an empty combo', () => {
    expect(findMissingComboItems([], buildA, buildB)).toEqual([])
  })
})

describe('parsePriority', () => {
  it('parses Q/W/E/R case-insensitively into lowercase ability keys', () => {
    expect(parsePriority('q E w R')).toEqual({ ok: true, keys: ['q', 'e', 'w', 'r'] })
  })

  it('returns no keys for blank text', () => {
    expect(parsePriority('  ')).toEqual({ ok: true, keys: [] })
  })

  it.each([['Q AA', 1, 'AA'], ['item:x Q', 0, 'item:x']])(
    'rejects non-ability token in %s', (text, tokenIndex, token) => {
      expect(parsePriority(text)).toEqual({
        ok: false, error: `priority accepts only Q W E R, got '${token}'`, tokenIndex,
      })
    },
  )
})
