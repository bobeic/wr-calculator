import type { Effect, StatKey } from '@wr-calc/schema'
import type { STAT_RESOLUTION_ORDER } from '../rules'

export type EffectStage = (typeof STAT_RESOLUTION_ORDER)[number]

export type StatLayer = 'base' | 'bonus'

export type StatSource =
  | { kind: 'champion'; id: string; name: string }
  | { kind: 'item'; id: string; name: string }
  | { kind: 'rune'; id: string; name: string }
  | { kind: 'effect'; id: string; name: string }

export interface StatContribution {
  stat: StatKey
  layer: StatLayer
  amount: number
  source: StatSource
  dataWarning?: string
  usedLevelRangeInterpolation: boolean
}

export interface StatContext {
  level: number
  inputs: Record<string, number | boolean>
  statSoFar(stat: StatKey, layer: StatLayer | 'total'): number
}

export interface EffectHandler<E extends Effect = Effect> {
  kind: E['kind']
  stage?: EffectStage
  contributeStats?(effect: E, ctx: StatContext): StatContribution[]
}
