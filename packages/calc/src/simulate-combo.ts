import type { Effect, DamageType, Condition } from '@wr-calc/schema'
import type { Combatant } from './combatant'
import type {
  AbilityKey, CombatantRuntime, DamageInstance, EffectHandler, HookContext,
  RawDamageInstanceInput, SourceKind,
} from './effects/types'
import type { UnverifiedRuleId } from './rules'
import type { ResistModifiers } from './mitigation'
import type { UnsupportedEffectEntry } from './result-envelope'
import { critMultiplier, cooldownWithHaste } from './rules'
import { mitigateDamage, applyDamageReductionFractions, ZERO_RESIST_MODIFIERS } from './mitigation'
import { resolveEffectHandler } from './effects/registry'
import { resolveDamageComponent } from './damage-component'
import { resolveScalar, scalarWarning } from './resolve-scalar'

export type ComboAction = 'AA' | 'Q' | 'W' | 'E' | 'R' | `item:${string}` | `wait:${number}`

export interface SimulateComboOptions {
  critMode?: 'expected' | 'always' | 'never'
  ignoreCooldowns?: boolean
  customHandlers?: Record<string, EffectHandler<any>>
}

export interface ComboResult {
  instances: DamageInstance[]
  totalsByType: Partial<Record<DamageType, number>>
  totalsBySource: Record<string, number>
  killed: boolean
  timeToKill?: number
  overkill?: number
  unsupportedEffects: UnsupportedEffectEntry[]
  dataWarnings: string[]
  unverifiedRules: UnverifiedRuleId[]
}

function combatantEffects(combatant: Combatant): Effect[] {
  return [...combatant.items.flatMap((item) => item.effects), ...combatant.runeEffects]
}

function evaluateCondition(
  effect: Effect, condition: Condition, self: Combatant, opponent: Combatant,
  opponentRuntime: CombatantRuntime, extra?: { damageType?: DamageType; sourceKind?: SourceKind }
): boolean {
  switch (condition.type) {
    case 'targetHpBelow': {
      const maxHp = opponent.sheet.total.hp ?? 0
      return maxHp > 0 && opponentRuntime.currentHp / maxHp < condition.threshold
    }
    case 'targetHpAbove': {
      const maxHp = opponent.sheet.total.hp ?? 0
      return maxHp > 0 && opponentRuntime.currentHp / maxHp > condition.threshold
    }
    case 'stacksAtMax': {
      const stackInput = effect.inputs?.find((input) => input.type === 'stackCount')
      if (!stackInput) return false
      const value = self.inputs[stackInput.id]
      return typeof value === 'number' && value >= stackInput.max
    }
    case 'toggle':
      return self.inputs[condition.inputId] === true
    case 'damageType':
      return extra?.damageType === condition.value
    case 'sourceKind':
      return extra?.sourceKind === condition.value
    case 'targetIsChampion':
      return opponent.kind === 'champion'
    case 'targetIsMonster':
      return opponent.kind === 'monster'
  }
}

/**
 * Gates any hook dispatch on the effect's own optional `condition` — this is what lets a
 * conditional effect skip a hook-triggered mechanic (onHit, spellblade, dot, procEveryN,
 * cooldownRefund, shield, heal, active) without every individual handler needing its own
 * condition check. Reader capabilities (`modifyResist`/`damageMultiplier`/`damageReductionFraction`)
 * are NOT covered by this — they're called directly by performDamage's modifier-gathering phase,
 * not through a hook-dispatch loop, so each of those handlers still self-checks its own condition
 * (see `penetrationHandler`/`damageAmpHandler`/`resistShredHandler.modifyResist`/
 * `damageReductionHandler`).
 */
function conditionAllows(
  effect: Effect, ctx: HookContext,
  extra?: { damageType?: DamageType; sourceKind?: SourceKind }
): boolean {
  return !effect.condition || ctx.conditionMet(effect, effect.condition, extra)
}

/**
 * Runs an event-driven combat timeline for `attacker` acting through `sequence` against `target`.
 * Phase 1 is asymmetric: only the attacker acts (basic attacks, ability casts, item actives) — the
 * target never initiates damage, so every DamageInstance flows attacker -> target. See this task's
 * "Known Phase 1 gaps" note for what's accepted-but-unmodeled.
 */
export function simulateCombo(
  attacker: Combatant, target: Combatant, sequence: ComboAction[],
  options: SimulateComboOptions = {}
): ComboResult {
  const critMode = options.critMode ?? 'expected'
  const ignoreCooldowns = options.ignoreCooldowns ?? false
  const customHandlers = options.customHandlers ?? {}

  const attackerRuntime: CombatantRuntime = {
    currentHp: attacker.sheet.total.hp ?? 0, shieldHp: 0, cooldowns: {}, buffs: {},
  }
  const targetRuntime: CombatantRuntime = {
    currentHp: target.sheet.total.hp ?? 0, shieldHp: 0, cooldowns: {}, buffs: {},
  }
  const attackerEffectsList = combatantEffects(attacker)
  const targetEffectsList = combatantEffects(target)

  const instances: DamageInstance[] = []
  const dataWarnings: string[] = []
  const unverifiedRuleIds = new Set<UnverifiedRuleId>()
  const unsupportedByEffectId = new Map<string, UnsupportedEffectEntry>()
  const scheduled: { time: number; run: (ctx: HookContext) => void }[] = []
  let time = 0
  let killed = false
  let timeToKill: number | undefined
  let overkill: number | undefined

  const trackSupport = (effect: Effect) => {
    if (effect.support !== 'full' && !unsupportedByEffectId.has(effect.id)) {
      unsupportedByEffectId.set(effect.id, {
        id: effect.id, support: effect.support, supportNotes: effect.supportNotes,
      })
    }
  }

  function buildCtx(
    self: Combatant, selfRuntime: CombatantRuntime, opponent: Combatant,
    opponentRuntime: CombatantRuntime
  ): HookContext {
    return {
      time, level: self.level, self: selfRuntime, opponent: opponentRuntime,
      selfSheet: self.sheet, opponentSheet: opponent.sheet,
      selfKind: self.kind, opponentKind: opponent.kind, inputs: self.inputs, ignoreCooldowns,
      // Phase 1 has no target-initiated damage, so dealDamage always applies attacker -> target,
      // regardless of which side's ctx it was called from.
      dealDamage: (input) => performDamage(input),
      addDataWarning: (message) => dataWarnings.push(message),
      addUnverifiedRule: (id) => unverifiedRuleIds.add(id),
      conditionMet: (effect, condition, extra) =>
        evaluateCondition(effect, condition, self, opponent, opponentRuntime, extra),
      scheduleEvent: (atTime, run) => {
        scheduled.push({ time: atTime, run })
        scheduled.sort((a, b) => a.time - b.time)
      },
    }
  }

  function flushScheduledEvents(upTo: number) {
    while (scheduled.length > 0 && scheduled[0].time <= upTo) {
      const event = scheduled.shift()!
      time = event.time
      event.run(buildCtx(attacker, attackerRuntime, target, targetRuntime))
    }
    time = upTo
  }

  function performDamage(input: RawDamageInstanceInput): DamageInstance {
    const attackerCtx = buildCtx(attacker, attackerRuntime, target, targetRuntime)

    let raw = input.amount
    for (const effect of attackerEffectsList) {
      const handler = resolveEffectHandler(effect, customHandlers)
      if (!handler?.damageMultiplier) continue
      const multiplier = handler.damageMultiplier(effect, attackerCtx, input)
      if (multiplier === 1) continue
      raw *= multiplier
      unverifiedRuleIds.add('damageAmpTiming')
      trackSupport(effect)
    }

    const resistBase = input.type === 'physical' ? target.sheet.total.armor ?? 0
      : input.type === 'magic' ? target.sheet.total.mr ?? 0 : 0
    const modifiers: ResistModifiers = { ...ZERO_RESIST_MODIFIERS }
    if (input.type === 'physical') {
      modifiers.flatPen += attacker.sheet.total.flatArmorPen ?? 0
      modifiers.pctPen += attacker.sheet.total.pctArmorPen ?? 0
    } else if (input.type === 'magic') {
      modifiers.flatPen += attacker.sheet.total.flatMagicPen ?? 0
      modifiers.pctPen += attacker.sheet.total.pctMagicPen ?? 0
    }
    for (const effect of attackerEffectsList) {
      const handler = resolveEffectHandler(effect, customHandlers)
      if (!handler?.modifyResist) continue
      const partial = handler.modifyResist(effect, attackerCtx, input.type)
      if (Object.keys(partial).length === 0) continue
      modifiers.flatReduction += partial.flatReduction ?? 0
      modifiers.pctReduction += partial.pctReduction ?? 0
      modifiers.pctPen += partial.pctPen ?? 0
      modifiers.flatPen += partial.flatPen ?? 0
      trackSupport(effect)
    }

    let mitigated = mitigateDamage(raw, input.type, resistBase, modifiers)
    if (input.type !== 'true') unverifiedRuleIds.add('resistModificationOrder')

    const targetCtx = buildCtx(target, targetRuntime, attacker, attackerRuntime)
    const fractions: number[] = []
    for (const effect of targetEffectsList) {
      const handler = resolveEffectHandler(effect, customHandlers)
      if (!handler?.damageReductionFraction) continue
      const fraction = handler.damageReductionFraction(effect, targetCtx, input.type)
      if (fraction === 0) continue
      fractions.push(fraction)
      trackSupport(effect)
    }
    mitigated = applyDamageReductionFractions(mitigated, fractions)

    const absorbed = Math.min(targetRuntime.shieldHp, mitigated)
    targetRuntime.shieldHp -= absorbed
    targetRuntime.currentHp -= (mitigated - absorbed)

    const instance: DamageInstance = {
      time, source: input.source, type: input.type, raw, mitigated,
      targetHpAfter: targetRuntime.currentHp,
    }
    instances.push(instance)

    if (!killed && targetRuntime.currentHp <= 0) {
      killed = true
      timeToKill = time
      overkill = -targetRuntime.currentHp
    }

    for (const effect of attackerEffectsList) {
      const handler = resolveEffectHandler(effect, customHandlers)
      if (!handler?.hooks?.onDamageDealt) continue
      if (!conditionAllows(effect, attackerCtx, { damageType: instance.type, sourceKind: instance.source.kind })) continue
      handler.hooks.onDamageDealt(effect, attackerCtx, instance)
      trackSupport(effect)
    }

    return instance
  }

  function dispatchOnBasicAttack() {
    const ctx = buildCtx(attacker, attackerRuntime, target, targetRuntime)
    for (const effect of attackerEffectsList) {
      const handler = resolveEffectHandler(effect, customHandlers)
      if (!handler?.hooks?.onBasicAttack) continue
      if (!conditionAllows(effect, ctx)) continue
      handler.hooks.onBasicAttack(effect, ctx)
      trackSupport(effect)
    }
  }

  function dispatchOnAbilityCast(abilityKey: AbilityKey) {
    const ctx = buildCtx(attacker, attackerRuntime, target, targetRuntime)
    for (const effect of attackerEffectsList) {
      const handler = resolveEffectHandler(effect, customHandlers)
      if (!handler?.hooks?.onAbilityCast) continue
      if (!conditionAllows(effect, ctx)) continue
      handler.hooks.onAbilityCast(effect, ctx, abilityKey)
      trackSupport(effect)
    }
  }

  function dispatchOnAbilityHit(abilityKey: AbilityKey, hitInstances: DamageInstance[]) {
    const ctx = buildCtx(attacker, attackerRuntime, target, targetRuntime)
    for (const effect of attackerEffectsList) {
      const handler = resolveEffectHandler(effect, customHandlers)
      if (!handler?.hooks?.onAbilityHit) continue
      if (!conditionAllows(effect, ctx)) continue
      handler.hooks.onAbilityHit(effect, ctx, abilityKey, hitInstances)
      trackSupport(effect)
    }
  }

  for (const action of sequence) {
    if (killed) break

    if (action === 'AA') {
      const interval = 1 / Math.max(attacker.sheet.total.attackSpeed ?? 1, 0.01)
      time += interval
      flushScheduledEvents(time)

      const critChance = attacker.sheet.total.critChance ?? 0
      const bonusCritDamage = attacker.sheet.total.critDamage ?? 0
      const critMult = critMultiplier(critChance, bonusCritDamage, critMode)
      unverifiedRuleIds.add('critDamageMultiplier')

      performDamage({
        type: 'physical', amount: (attacker.sheet.total.ad ?? 0) * critMult,
        source: { kind: 'basicAttack', id: 'AA', name: 'Basic Attack' },
      })
      dispatchOnBasicAttack()
    } else if (action === 'Q' || action === 'W' || action === 'E' || action === 'R') {
      if (!attacker.abilities) continue
      const abilityKey = action.toLowerCase() as AbilityKey
      const ability = attacker.abilities[abilityKey]
      const availableAt = attackerRuntime.cooldowns[abilityKey] ?? 0
      if (!ignoreCooldowns && time < availableAt) continue

      time += ability.castTime
      flushScheduledEvents(time)
      dispatchOnAbilityCast(abilityKey)

      const hitInstances: DamageInstance[] = []
      for (const component of ability.damage) {
        const resolved = resolveDamageComponent(
          component, attacker, target, targetRuntime.currentHp, attacker.level, ability.name
        )
        resolved.dataWarnings.forEach((warning) => dataWarnings.push(warning))
        hitInstances.push(performDamage({
          type: resolved.type, amount: resolved.amount,
          source: { kind: 'ability', id: ability.id, name: ability.name },
        }))
      }

      const cooldownResolved = resolveScalar(ability.cooldown, attacker.level)
      const cooldownWarning = scalarWarning(ability.name, 'cooldown', cooldownResolved)
      if (cooldownWarning) dataWarnings.push(cooldownWarning)
      const hastedCooldown = cooldownWithHaste(
        cooldownResolved.value, attacker.sheet.total.abilityHaste ?? 0
      )
      unverifiedRuleIds.add('abilityHasteFormula')
      attackerRuntime.cooldowns[abilityKey] = time + hastedCooldown

      dispatchOnAbilityHit(abilityKey, hitInstances)
    } else if (action.startsWith('item:')) {
      const itemId = action.slice(5)
      const item = attacker.items.find((candidate) => candidate.id === itemId)
      const activeEffect = item?.effects.find((effect) => effect.kind === 'active')
      if (!item || !activeEffect) continue

      const cooldownKey = `active:${activeEffect.id}`
      const availableAt = attackerRuntime.cooldowns[cooldownKey] ?? 0
      if (!ignoreCooldowns && time < availableAt) continue

      const ctx = buildCtx(attacker, attackerRuntime, target, targetRuntime)
      // A blocked active isn't "involved" in the action at all — matching the hook-dispatch sites,
      // a failed condition skips the whole action, so it never fires and never goes on cooldown.
      if (!conditionAllows(activeEffect, ctx)) continue
      const handler = resolveEffectHandler(activeEffect, customHandlers)
      handler?.activate?.(activeEffect, ctx)
      trackSupport(activeEffect)

      const cooldownResolved = resolveScalar(activeEffect.cooldownSeconds, attacker.level)
      const cooldownWarning = scalarWarning(activeEffect.name, 'cooldownSeconds', cooldownResolved)
      if (cooldownWarning) dataWarnings.push(cooldownWarning)
      attackerRuntime.cooldowns[cooldownKey] = time + cooldownResolved.value
    } else if (action.startsWith('wait:')) {
      time += Number(action.slice(5))
      flushScheduledEvents(time)
    }
  }

  const totalsByType: Partial<Record<DamageType, number>> = {}
  const totalsBySource: Record<string, number> = {}
  for (const instance of instances) {
    totalsByType[instance.type] = (totalsByType[instance.type] ?? 0) + instance.mitigated
    totalsBySource[instance.source.id] =
      (totalsBySource[instance.source.id] ?? 0) + instance.mitigated
  }

  const mergedUnsupported = new Map<string, UnsupportedEffectEntry>()
  for (const entry of [
    ...attacker.sheet.unsupportedEffects, ...target.sheet.unsupportedEffects,
    ...unsupportedByEffectId.values(),
  ]) mergedUnsupported.set(entry.id, entry)

  return {
    instances, totalsByType, totalsBySource, killed, timeToKill, overkill,
    unsupportedEffects: [...mergedUnsupported.values()],
    dataWarnings: [...attacker.sheet.dataWarnings, ...target.sheet.dataWarnings, ...dataWarnings],
    unverifiedRules: [...new Set([
      ...attacker.sheet.unverifiedRules, ...target.sheet.unverifiedRules, ...unverifiedRuleIds,
    ])],
  }
}
