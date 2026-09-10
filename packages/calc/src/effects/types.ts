import type { Effect, StatKey, Condition, DamageType } from '@wr-calc/schema'
import type { STAT_RESOLUTION_ORDER, UnverifiedRuleId } from '../rules'
import type { ResistModifiers } from '../mitigation'
import type { StatSheet } from '../resolve-stats'

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
  hooks?: HookHandlers<E>
  modifyResist?(effect: E, ctx: HookContext, damageType: DamageType): Partial<ResistModifiers>
  damageMultiplier?(effect: E, ctx: HookContext, input: RawDamageInstanceInput): number
  damageReductionFraction?(effect: E, ctx: HookContext, damageType: DamageType): number
}

export type SourceKind = 'basicAttack' | 'ability' | 'item' | 'other'

export interface DamageSource {
  kind: SourceKind
  id: string
  name: string
}

export interface RawDamageInstanceInput {
  type: DamageType
  amount: number
  source: DamageSource
}

export interface DamageInstance {
  time: number
  source: DamageSource
  type: DamageType
  raw: number
  mitigated: number
  targetHpAfter: number
}

export interface RuntimeBuff {
  expiresAt?: number
  stacks?: number
  data?: Record<string, number>
}

export interface CombatantRuntime {
  currentHp: number
  shieldHp: number
  cooldowns: Record<string, number>
  buffs: Record<string, RuntimeBuff>
}

export type AbilityKey = 'q' | 'w' | 'e' | 'r'

export interface HookHandlers<E extends Effect> {
  onBasicAttack?(effect: E, ctx: HookContext): void
  onAbilityCast?(effect: E, ctx: HookContext, abilityKey: AbilityKey): void
  onAbilityHit?(effect: E, ctx: HookContext, abilityKey: AbilityKey, instances: DamageInstance[]): void
  onDamageDealt?(effect: E, ctx: HookContext, instance: DamageInstance): void
  onTick?(effect: E, ctx: HookContext, deltaSeconds: number): void
}

export type HookName = keyof HookHandlers<Effect>

export interface HookContext {
  time: number
  level: number
  self: CombatantRuntime
  opponent: CombatantRuntime
  selfSheet: StatSheet
  opponentSheet: StatSheet
  selfKind: 'champion' | 'monster' | 'dummy'
  opponentKind: 'champion' | 'monster' | 'dummy'
  inputs: Record<string, number | boolean>
  ignoreCooldowns: boolean
  dealDamage(input: RawDamageInstanceInput): DamageInstance
  addDataWarning(message: string): void
  addUnverifiedRule(id: UnverifiedRuleId): void
  conditionMet(
    effect: Effect, condition: Condition,
    extra?: { damageType?: DamageType; sourceKind?: SourceKind }
  ): boolean
}
