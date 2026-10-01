import { describe, it, expect } from 'vitest'
import { decodeState, encodeState } from '../src/lib/url-state'
import { MAX_DURATION_SECONDS, defaultState, emptyBuild } from '../src/lib/debug-state'
import type { DebugState, DebugTarget } from '../src/lib/debug-state'
import { datasetFor } from '../src/lib/dataset'

const dataset = datasetFor('7.3')

function decode(query: string) {
  return decodeState(new URLSearchParams(query), dataset)
}

const FULL_STATE: DebugState = {
  championId: 'jinx',
  level: 11,
  buildA: {
    items: ['trinity-force', 'heartsteel'], boots: 'plated-steelcaps', runes: [],
    inputs: { 'heartsteel-stacks': 5, 'seraphs-embrace-shield-used': true },
  },
  buildB: { items: ['long-sword'], runes: [], inputs: {} },
  target: { kind: 'champion', championId: 'annie', level: 9, build: { items: ['blasting-wand'], runes: [], inputs: {} } },
  combo: 'Q AA item:trinity-force wait:0.5 R',
  priority: 'Q E W R',
  durationSeconds: 12.5,
  critMode: 'always',
}

describe('encodeState / decodeState', () => {
  it('round-trips a full state with no issues', () => {
    expect(decode(encodeState(FULL_STATE))).toEqual({ state: FULL_STATE, issues: [] })
  })

  it.each<DebugTarget>([
    { kind: 'preset', presetId: 'tank' },
    { kind: 'dummy', hp: 2500, armor: 90, mr: 60 },
  ])('round-trips target %o', (target) => {
    const state = { ...FULL_STATE, target }
    expect(decode(encodeState(state))).toEqual({ state, issues: [] })
  })

  it('decodes an empty query to the default state with no issues', () => {
    expect(decode('')).toEqual({ state: defaultState(dataset), issues: [] })
  })
})

describe('decodeState: malformed params', () => {
  it('resets an out-of-range level and reports it', () => {
    const { state, issues } = decode('lvl=99')
    expect(state.level).toBe(15)
    expect(issues).toEqual(["level: invalid value '99', reset to default"])
  })

  it('resets an empty or non-numeric duration and reports it', () => {
    expect(decode('dur=').issues).toEqual(["duration: invalid value '', reset to default"])
    expect(decode('dur=abc').state.durationSeconds).toBe(10)
  })

  it('accepts a duration at the MAX_DURATION_SECONDS ceiling', () => {
    const { state, issues } = decode(`dur=${MAX_DURATION_SECONDS}`)
    expect(state.durationSeconds).toBe(MAX_DURATION_SECONDS)
    expect(issues).toEqual([])
  })

  it('resets a duration above MAX_DURATION_SECONDS and reports it', () => {
    const { state, issues } = decode(`dur=${MAX_DURATION_SECONDS + 1}`)
    expect(state.durationSeconds).toBe(10)
    expect(issues).toEqual([`duration: invalid value '${MAX_DURATION_SECONDS + 1}', reset to default`])
  })

  it('resets a malformed build to empty and reports it', () => {
    const { state, issues } = decode('a={bad json')
    expect(state.buildA).toEqual(emptyBuild())
    expect(issues).toEqual(['build A: malformed, reset to empty'])
  })

  it('resets an unknown crit mode and reports it', () => {
    const { state, issues } = decode('crit=sometimes')
    expect(state.critMode).toBe('expected')
    expect(issues).toEqual(["unknown crit mode 'sometimes', reset to default"])
  })

  it('resets a malformed target and reports it', () => {
    const { state, issues } = decode(`t=${encodeURIComponent('{"kind":"champion"}')}`)
    expect(state.target).toEqual(defaultState(dataset).target)
    expect(issues).toEqual(['target: malformed, reset to default'])
  })

  it.each(['a=null', 't=[]', 'b=42', 'lvl=1.5', 'champ=', 'a=%7B%22items%22%3A1%7D'])(
    'never throws on %s', (query) => {
      expect(() => decode(query)).not.toThrow()
      expect(decode(query).issues.length).toBeGreaterThan(0)
    },
  )
})

describe('decodeState: unknown ids', () => {
  it('resets an unknown champion and reports it', () => {
    const { state, issues } = decode('champ=nope-champ')
    expect(state.championId).toBe('aatrox')
    expect(issues).toEqual(["unknown champion 'nope-champ', reset to default"])
  })

  it('drops unknown items, boots and runes from a build, keeping known ones', () => {
    const build = { items: ['long-sword', 'nope'], boots: 'nope-boots', runes: ['r1'], inputs: {} }
    const { state, issues } = decode(`a=${encodeURIComponent(JSON.stringify(build))}`)
    expect(state.buildA).toEqual({ items: ['long-sword'], runes: [], inputs: {} })
    expect(issues).toEqual([
      "build A: unknown item 'nope' dropped",
      "build A: unknown boots 'nope-boots' dropped",
      "build A: unknown rune 'r1' dropped",
    ])
  })

  it('resets an unknown preset target and reports it', () => {
    const target = { kind: 'preset', presetId: 'mega-tank' }
    const { state, issues } = decode(`t=${encodeURIComponent(JSON.stringify(target))}`)
    expect(state.target).toEqual({ kind: 'preset', presetId: 'squishy' })
    expect(issues).toEqual(["target: unknown preset 'mega-tank', reset to default"])
  })

  it('resets a champion target with an unknown champion and reports it', () => {
    const target = { kind: 'champion', championId: 'nope-champ', level: 5, build: emptyBuild() }
    const { issues } = decode(`t=${encodeURIComponent(JSON.stringify(target))}`)
    expect(issues).toEqual(["target: unknown champion 'nope-champ', reset to default"])
  })

  it('sanitizes a champion target build', () => {
    const target = { kind: 'champion', championId: 'annie', level: 5, build: { items: ['nope'], runes: [], inputs: {} } }
    const { state, issues } = decode(`t=${encodeURIComponent(JSON.stringify(target))}`)
    expect(state.target).toEqual({ kind: 'champion', championId: 'annie', level: 5, build: emptyBuild() })
    expect(issues).toEqual(["target build: unknown item 'nope' dropped"])
  })
})
