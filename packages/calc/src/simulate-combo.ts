import type { Effect, DamageType, Condition } from '@wr-calc/schema'
import type { Combatant } from './combatant'
import type {
  AbilityKey, CombatantRuntime, ConditionExtra, DamageInstance, EffectHandler, HookContext,
  RawDamageInstanceInput,
} from './effects/types'
import type { UnverifiedRuleId } from './rules'
import type { ResistModifiers } from './mitigation'
import type { StatSheet } from './resolve-stats'
import type { UnsupportedEffectEntry } from './result-envelope'
import { critMultiplier, cooldownWithHaste, totalAttackSpeed } from './rules'
import { mitigateDamage, applyDamageReductionFractions, ZERO_RESIST_MODIFIERS } from './mitigation'
import { resolveEffectHandler } from './effects/registry'
import { resolveDamageComponent } from './damage-component'
import { resolveScalar, scalarWarning } from './resolve-scalar'

/**
 * How deep one damage instance may chain through effects that deal damage from a damage hook
 * before the engine assumes a cycle. Not a game mechanic — a safety limit, so it lives here rather
 * than in rules.ts.
 */
const MAX_DAMAGE_CHAIN_DEPTH = 64

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
  opponentRuntime: CombatantRuntime, time: number, extra?: ConditionExtra
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
    case 'abilitySlot':
      return extra?.abilityKey === condition.value
    case 'targetHasDot':
      // Phase 1 only lets the attacker apply dots, so any active dot buff on the target is ours.
      return Object.entries(opponentRuntime.buffs).some(([key, buff]) =>
        (condition.effectId === undefined ? key.startsWith('dot:') : key === `dot:${condition.effectId}`)
        && buff.expiresAt !== undefined && buff.expiresAt >= time
      )
    case 'targetIsChampion':
      return opponent.kind === 'champion'
    case 'targetIsMonster':
      return opponent.kind === 'monster'
    case 'allOf':
      return condition.conditions.every(
        (leaf) => evaluateCondition(effect, leaf, self, opponent, opponentRuntime, time, extra)
      )
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
  extra?: ConditionExtra
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
    currentHp: (attacker.sheet.total.hp ?? 0) * attacker.startHpFraction, shieldHp: 0, cooldowns: {}, buffs: {},
  }
  const targetRuntime: CombatantRuntime = {
    currentHp: (target.sheet.total.hp ?? 0) * target.startHpFraction, shieldHp: 0, cooldowns: {}, buffs: {},
  }
  const attackerEffectsList = combatantEffects(attacker)
  const targetEffectsList = combatantEffects(target)

  const instances: DamageInstance[] = []
  const dataWarnings: string[] = []
  const unverifiedRuleIds = new Set<UnverifiedRuleId>()
  const unsupportedByEffectId = new Map<string, UnsupportedEffectEntry>()
  const scheduled: { time: number; run: (ctx: HookContext) => void; key?: string }[] = []
  let time = 0
  let killed = false
  let timeToKill: number | undefined
  let overkill: number | undefined
  let damageDepth = 0
  let chainAborted = false

  const trackSupport = (effect: Effect) => {
    if (effect.support !== 'full' && !unsupportedByEffectId.has(effect.id)) {
      unsupportedByEffectId.set(effect.id, {
        id: effect.id, support: effect.support, supportNotes: effect.supportNotes,
      })
    }
  }

  /**
   * Resolves an effect's handler, reporting any `custom` effect whose handler id isn't registered
   * so an unmodelled effect surfaces in the envelope instead of vanishing at every `continue`.
   */
  function resolve(effect: Effect): EffectHandler<any> | undefined {
    const handler = resolveEffectHandler(effect, customHandlers)
    if (!handler && effect.kind === 'custom') trackSupport(effect)
    return handler
  }

  /**
   * The attacker's sheet at the current moment: its resolved stats plus any combat-only stat
   * contributions (e.g. Blackfire's AP while the target burns) whose condition holds right now.
   */
  function attackerSheetNow(): StatSheet {
    const deferred = attacker.sheet.combatContributions
    if (!deferred) return attacker.sheet
    const base = { ...attacker.sheet.base }
    const bonus = { ...attacker.sheet.bonus }
    const total = { ...attacker.sheet.total }
    for (const { effect, contributions } of deferred) {
      if (!evaluateCondition(effect, effect.condition!, attacker, target, targetRuntime, time)) continue
      trackSupport(effect)
      for (const { stat, layer, amount } of contributions) {
        const layerValues = layer === 'base' ? base : bonus
        layerValues[stat] = (layerValues[stat] ?? 0) + amount
        total[stat] = stat === 'attackSpeed'
          ? totalAttackSpeed(base.attackSpeed ?? 0, bonus.attackSpeed ?? 0)
          : (base[stat] ?? 0) + (bonus[stat] ?? 0)
      }
    }
    return { ...attacker.sheet, base, bonus, total }
  }

  function sheetNow(combatant: Combatant): StatSheet {
    return combatant === attacker ? attackerSheetNow() : combatant.sheet
  }

  function buildCtx(
    self: Combatant, selfRuntime: CombatantRuntime, opponent: Combatant,
    opponentRuntime: CombatantRuntime
  ): HookContext {
    return {
      time, level: self.level, self: selfRuntime, opponent: opponentRuntime,
      selfSheet: sheetNow(self), opponentSheet: sheetNow(opponent),
      selfKind: self.kind, opponentKind: opponent.kind, inputs: self.inputs, ignoreCooldowns,
      // Phase 1 has no target-initiated damage, so dealDamage always applies attacker -> target,
      // regardless of which side's ctx it was called from.
      dealDamage: (input) => performDamage(input),
      addDataWarning: (message) => dataWarnings.push(message),
      addUnverifiedRule: (id) => unverifiedRuleIds.add(id),
      conditionMet: (effect, condition, extra) =>
        evaluateCondition(effect, condition, self, opponent, opponentRuntime, time, extra),
      scheduleEvent: (atTime, run, key) => {
        scheduled.push({ time: atTime, run, key })
        scheduled.sort((a, b) => a.time - b.time)
      },
      cancelScheduled: (key) => {
        for (let i = scheduled.length - 1; i >= 0; i--) {
          if (scheduled[i].key === key) scheduled.splice(i, 1)
        }
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
    damageDepth++
    // Once the cap has tripped anywhere in this chain, every remaining nested call bails too.
    // Capping depth alone still lets three or more mutually-proccing effects explore an
    // exponential call tree; this keeps the aborted chain's remaining work roughly linear.
    if (chainAborted) {
      damageDepth--
      return {
        time, source: input.source, type: input.type, raw: 0, mitigated: 0,
        targetHpAfter: targetRuntime.currentHp,
      }
    }
    // An effect that deals damage from an onDamageDealt hook can feed another effect that does the
    // same; two n:1 procEveryN items count each other's procs and would recurse until the stack
    // blows. Cap the chain and report it rather than crashing the whole simulation.
    if (damageDepth > MAX_DAMAGE_CHAIN_DEPTH) {
      chainAborted = true
      damageDepth--
      dataWarnings.push(
        `Damage chain exceeded ${MAX_DAMAGE_CHAIN_DEPTH} nested instances (likely a cycle between `
        + 'two effects, e.g. two procEveryN items counting each other); further chained damage was '
        + 'suppressed.'
      )
      return {
        time, source: input.source, type: input.type, raw: 0, mitigated: 0,
        targetHpAfter: targetRuntime.currentHp,
      }
    }

    try {
      const attackerCtx = buildCtx(attacker, attackerRuntime, target, targetRuntime)

      let raw = input.amount
      for (const effect of attackerEffectsList) {
        const handler = resolve(effect)
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
      const attackerTotal = attackerCtx.selfSheet.total
      if (input.type === 'physical') {
        modifiers.flatPen += attackerTotal.flatArmorPen ?? 0
        modifiers.pctPen += attackerTotal.pctArmorPen ?? 0
      } else if (input.type === 'magic') {
        modifiers.flatPen += attackerTotal.flatMagicPen ?? 0
        modifiers.pctPen += attackerTotal.pctMagicPen ?? 0
      }
      for (const effect of attackerEffectsList) {
        const handler = resolve(effect)
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
        const handler = resolve(effect)
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
      // Set after the hit, so the hit that starts combat isn't itself amplified by combat ramps.
      if (attackerRuntime.combatStartedAt === undefined) attackerRuntime.combatStartedAt = time

      if (!killed && targetRuntime.currentHp <= 0) {
        killed = true
        timeToKill = time
        overkill = -targetRuntime.currentHp
      }

      for (const effect of attackerEffectsList) {
        const handler = resolve(effect)
        if (!handler?.hooks?.onDamageDealt) continue
        if (!conditionAllows(effect, attackerCtx, { damageType: instance.type, sourceKind: instance.source.kind })) continue
        handler.hooks.onDamageDealt(effect, attackerCtx, instance)
        trackSupport(effect)
      }

      return instance
    } finally {
      damageDepth--
      // The chain has fully unwound, so the next top-level action starts clean.
      if (damageDepth === 0) chainAborted = false
    }
  }

  function dispatchOnBasicAttack() {
    const ctx = buildCtx(attacker, attackerRuntime, target, targetRuntime)
    for (const effect of attackerEffectsList) {
      const handler = resolve(effect)
      if (!handler?.hooks?.onBasicAttack) continue
      if (!conditionAllows(effect, ctx)) continue
      handler.hooks.onBasicAttack(effect, ctx)
      trackSupport(effect)
    }
  }

  function dispatchOnAbilityCast(abilityKey: AbilityKey) {
    const ctx = buildCtx(attacker, attackerRuntime, target, targetRuntime)
    for (const effect of attackerEffectsList) {
      const handler = resolve(effect)
      if (!handler?.hooks?.onAbilityCast) continue
      if (!conditionAllows(effect, ctx, { abilityKey })) continue
      handler.hooks.onAbilityCast(effect, ctx, abilityKey)
      trackSupport(effect)
    }
  }

  function dispatchOnAbilityHit(abilityKey: AbilityKey, hitInstances: DamageInstance[]) {
    const ctx = buildCtx(attacker, attackerRuntime, target, targetRuntime)
    for (const effect of attackerEffectsList) {
      const handler = resolve(effect)
      if (!handler?.hooks?.onAbilityHit) continue
      if (!conditionAllows(effect, ctx, { abilityKey })) continue
      handler.hooks.onAbilityHit(effect, ctx, abilityKey, hitInstances)
      trackSupport(effect)
    }
  }

  for (const action of sequence) {
    if (killed) break

    if (action === 'AA') {
      // The attack lands at the current time (an idle attacker's first swing is ~instant); the
      // interval only delays how soon the *next* swing can land, so it's added after, not before.
      flushScheduledEvents(time)

      const attackerTotal = attackerSheetNow().total
      const critChance = attackerTotal.critChance ?? 0
      const bonusCritDamage = attackerTotal.critDamage ?? 0
      const critMult = critMultiplier(critChance, bonusCritDamage, critMode)
      unverifiedRuleIds.add('critDamageMultiplier')

      performDamage({
        type: 'physical', amount: (attackerTotal.ad ?? 0) * critMult,
        source: { kind: 'basicAttack', id: 'AA', name: 'Basic Attack' },
      })
      dispatchOnBasicAttack()

      const interval = 1 / Math.max(attackerSheetNow().total.attackSpeed ?? 1, 0.01)
      time += interval
    } else if (action === 'Q' || action === 'W' || action === 'E' || action === 'R') {
      if (!attacker.abilities) continue
      const abilityKey = action.toLowerCase() as AbilityKey
      const ability = attacker.abilities[abilityKey]
      const availableAt = attackerRuntime.cooldowns[abilityKey] ?? 0
      if (!ignoreCooldowns && time < availableAt) continue

      time += ability.castTime
      flushScheduledEvents(time)
      dispatchOnAbilityCast(abilityKey)

      // No per-ability rank input yet: every ability is assumed fully ranked (see
      // docs/decisions/2026-09-24-byrank-scalar-ability-rank-context.md).
      const rank = ability.maxRank
      const hitInstances: DamageInstance[] = []
      for (const component of ability.damage) {
        const resolved = resolveDamageComponent(
          component, { ...attacker, sheet: attackerSheetNow() }, target, targetRuntime.currentHp,
          attacker.level, ability.name, rank
        )
        resolved.dataWarnings.forEach((warning) => dataWarnings.push(warning))
        hitInstances.push(performDamage({
          type: resolved.type, amount: resolved.amount,
          source: { kind: 'ability', id: ability.id, name: ability.name },
        }))
      }

      const cooldownResolved = resolveScalar(ability.cooldown, attacker.level, rank)
      const cooldownWarning = scalarWarning(ability.name, 'cooldown', cooldownResolved)
      if (cooldownWarning) dataWarnings.push(cooldownWarning)
      const attackerTotal = attackerSheetNow().total
      const ultimateHaste = abilityKey === 'r' ? attackerTotal.ultimateHaste ?? 0 : 0
      const hastedCooldown = cooldownWithHaste(
        cooldownResolved.value, (attackerTotal.abilityHaste ?? 0) + ultimateHaste
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
      const handler = resolve(activeEffect)
      handler?.activate?.(activeEffect, ctx)
      trackSupport(activeEffect)

      const cooldownResolved = resolveScalar(activeEffect.cooldownSeconds, attacker.level)
      const cooldownWarning = scalarWarning(activeEffect.name, 'cooldownSeconds', cooldownResolved)
      if (cooldownWarning) dataWarnings.push(cooldownWarning)
      attackerRuntime.cooldowns[cooldownKey] = time + cooldownResolved.value
    } else if (action.startsWith('wait:')) {
      const seconds = Number(action.slice(5))
      if (!Number.isFinite(seconds)) {
        dataWarnings.push(`Invalid wait duration in sequence: "${action}" — ignored.`)
        continue
      }
      time += seconds
      flushScheduledEvents(time)
    }
  }

  if (scheduled.length > 0) {
    dataWarnings.push(
      `${scheduled.length} scheduled effect tick(s) (e.g. a DoT) were still pending when the `
      + 'sequence ended and were not applied — add a trailing wait:<seconds> action to let them '
      + 'resolve.'
    )
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
    dataWarnings: [...new Set([
      ...attacker.sheet.dataWarnings, ...target.sheet.dataWarnings, ...dataWarnings,
    ])],
    unverifiedRules: [...new Set([
      ...attacker.sheet.unverifiedRules, ...target.sheet.unverifiedRules, ...unverifiedRuleIds,
    ])],
  }
}
