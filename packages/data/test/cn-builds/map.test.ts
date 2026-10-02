import { describe, it, expect } from 'vitest'
import { mapCnBuilds } from '../../scripts/cn-builds/map'
import type { RawBuild } from '../../scripts/cn-builds/map'

const core = (ids: string[], win: number, pick: number) => ({ items: ids.map((id) => ({ id })), win, pick })
const page = (ids: string[], win: number, pick: number) => ({ runes: ids.map((id) => ({ id })), win, pick })
const raw = (heroId: string, positions: RawBuild['positions']): RawBuild => ({ hero_id: heroId, date: '20261001', positions })

describe('mapCnBuilds', () => {
  const heroes = new Map([['10123', 'senna']])
  const items = new Map([['2240', 'statikk-shiv'], ['2250', 'rapid-firecannon']])
  const runes = new Map([['572116001', 'fleet-footwork']])

  it('maps ids, lanes and percentages, and drops sets with unknown ids', () => {
    const snapshot = mapCnBuilds([
      raw('10123', [{
        pos: '3', pos_label: 'Bot (ADC)',
        core: [core(['2240', '2250'], 55.9, 41.19), core(['2240', '9999'], 60, 5)],
        runes: [page(['572116001'], 55.1, 58.59)],
      }]),
      raw('10777', []),
    ], heroes, items, runes, 'now')
    expect(snapshot.statDate).toBe('2026-10-01')
    expect(snapshot.champions).toEqual({
      senna: [{
        lane: 'adc',
        core: [{ ids: ['statikk-shiv', 'rapid-firecannon'], winRate: 0.559, pickRate: 0.4119 }],
        runes: [{ ids: ['fleet-footwork'], winRate: 0.551, pickRate: 0.5859 }],
      }],
    })
    expect(snapshot.unmapped).toEqual({ heroes: ['10777'], items: ['9999'], runes: [] })
  })

  it('maps upgraded support items to the item they grow from', () => {
    const snapshot = mapCnBuilds([raw('10123', [{
      pos: '5', pos_label: 'Supporto', core: [core(['2164'], 50, 10)], runes: [],
    }])], heroes, new Map([['2111', 'spectral-sickle']]), runes, 'now')
    expect(snapshot.champions.senna[0]).toMatchObject({ lane: 'support', core: [{ ids: ['spectral-sickle'] }] })
  })

  it('rejects an unknown lane key instead of guessing', () => {
    expect(() => mapCnBuilds([raw('10123', [{ pos: '9', pos_label: '?', core: [], runes: [] }])], heroes, items, runes, 'now'))
      .toThrow(/unknown pos '9'/)
  })
})
