import { CURRENT_DATASET } from '../dataset'
import { DEFAULT_COMBO, runCalculator } from '../calculator'
import { decodeState } from '../url-state'
import type { HiddenGem } from './builds'
import { calculatorHref } from './format'

const EXAMPLE_TARGET = 'bruiser'

export interface ExampleSide { items: string[]; winRate: number; comboDamage: number; timeToKill?: number }

export interface WorkedExample {
  gem: HiddenGem
  target: { name: string; hp: number }
  mostPicked: ExampleSide
  winner: ExampleSide
  href: string
}

/**
 * The calculator run at build time on an off-meta winner against its lane's most-picked core, at level 15 with the
 * default combo, against the bruiser preset: a squishy dies to the opening combo, and with no cast times in the data
 * that reads as a 0s kill. The link opens the same setup. Null when either side fails to calculate.
 */
export function workedExample(gem: HiddenGem): WorkedExample | null {
  const target = { kind: 'preset' as const, presetId: EXAMPLE_TARGET }
  const href = `${calculatorHref(gem.championId, gem.mostPicked.ids, gem.runes, { items: gem.build.ids, runes: gem.runes })}&${new URLSearchParams({ t: JSON.stringify(target) })}`
  const { state } = decodeState(new URLSearchParams(href.split('?')[1]), CURRENT_DATASET)
  const report = runCalculator({ ...state, combo: DEFAULT_COMBO }, CURRENT_DATASET, true)
  if (!report.a.ok || !report.b?.ok || !report.target.ok) return null
  const side = (items: string[], winRate: number, value: typeof report.a.value): ExampleSide =>
    ({ items, winRate, comboDamage: value.combo?.damage ?? 0, timeToKill: value.timeToKill })
  return {
    gem, href,
    target: { name: report.target.value.name, hp: report.target.value.hp },
    mostPicked: side(gem.mostPicked.ids, gem.mostPicked.winRate, report.a.value),
    winner: side(gem.build.ids, gem.build.winRate, report.b.value),
  }
}
