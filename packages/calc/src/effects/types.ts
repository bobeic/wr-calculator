import type { Effect, StatKey, Condition, DamageType, DamageComponent } from '@wr-calc/schema'
import type { STAT_RESOLUTION_ORDER, UnverifiedRuleId } from '../rules'
import type { ResistModifiers } from '../mitigation'
import type { StatSheet } from '../resolve-stats'
import type { ResolvedDamageComponent } from '../damage-component'

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
  activate?(effect: E, ctx: HookContext): void
  /** Self stat changes that hold right now in combat (e.g. attack speed stacks), read from the runtime. */
  combatStats?(effect: E, self: CombatantRuntime, time: number): CombatStat[]
}

/** A combat-time stat change; it adds to the bonus layer. */
export interface CombatStat {
  stat: StatKey
  amount: number
}

export type SourceKind = 'basicAttack' | 'ability' | 'item' | 'passive' | 'other'

export interface DamageSource {
  kind: SourceKind
  id: string
  name: string
}

/** One source's share of a merged damage instance. */
export interface DamagePart { source: DamageSource; amount: number }

export interface RawDamageInstanceInput {
  type: DamageType
  amount: number
  source: DamageSource
  /** Same-hit damage merged into this instance; when set, it replaces `amount`, and each part is amplified on its own source. */
  parts?: DamagePart[]
}

export interface DamageInstance {
  time: number
  source: DamageSource
  type: DamageType
  raw: number
  mitigated: number
  targetHpAfter: number
  /** The basic attack or ability stage cast this instance belongs to; unset for dot ticks and other scheduled damage. */
  hitId?: number
  /** The merged parts after damage amps, when this instance merged several sources. */
  parts?: DamagePart[]
}

export interface AttackModifier {
  /** Extra damage on this attack. Physical parts merge into the attack's instance; others are their own instances in the same hit. */
  bonus?: Omit<RawDamageInstanceInput, 'parts'>[]
  /** Replaces the attack's crit multiplier for this swing; the highest override wins. */
  critMultiplier?: number
  /** True when this swing spent an empowered-attack charge. */
  empowered?: boolean
  /** Times on-hit effects apply again after this attack (e.g. Dusk and Dawn's Spellblade). */
  extraOnHitApplications?: number
}

/** A basic attack or ability stage cast that dealt damage, as passed to `onHitLanded`. */
export interface HitInfo {
  id: number
  kind: 'basicAttack' | 'ability'
  empowered: boolean
  abilityKey?: AbilityKey
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
  /** When this combatant first dealt damage in the combo; unset until then. */
  combatStartedAt?: number
  /** The last ability cast that can feed a feint: when it ended, and whether a dash used it. */
  lastAbilityCast?: { at: number; feintUsed: boolean }
  /** Extra bonus attack speed for the swing in progress (e.g. an empowered attack), then cleared. */
  swingAttackSpeedBonus?: number
}

export type AbilityKey = 'q' | 'w' | 'e' | 'r'

/** Facts about the triggering event that some conditions check. */
export interface ConditionExtra {
  damageType?: DamageType
  sourceKind?: SourceKind
  abilityKey?: AbilityKey
}

export interface HookHandlers<E extends Effect> {
  onBasicAttack?(effect: E, ctx: HookContext): void
  beforeBasicAttack?(effect: E, ctx: HookContext): AttackModifier | undefined
  /** Once per hit that dealt damage, after all of its damage and hooks. */
  onHitLanded?(effect: E, ctx: HookContext, hit: HitInfo): void
  onAbilityCast?(effect: E, ctx: HookContext, abilityKey: AbilityKey): void
  onAbilityHit?(effect: E, ctx: HookContext, abilityKey: AbilityKey, instances: DamageInstance[]): void
  /** A dash (e.g. a feint) that started at `dashStartedAt` has just ended. */
  onDash?(effect: E, ctx: HookContext, dashStartedAt: number): void
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
    extra?: ConditionExtra
  ): boolean
  /** `quiet` events (e.g. an aura's next tick) don't count as pending damage when the combo ends. */
  scheduleEvent?(atTime: number, run: (ctx: HookContext) => void, key?: string, options?: { quiet?: boolean }): void
  cancelScheduled?(key: string): void
  /** Applies the owner's on-hit effects once more, as an extra on-hit application of the current attack. */
  applyOnHitEffects?(): void
  /** Resolves a damage component for this context's owner against its opponent, right now. */
  resolveComponent?(component: DamageComponent, ownerName: string): ResolvedDamageComponent
}
