# ADR: `simulateCombo` known Phase 1 gaps

**Status:** Accepted

## Context

Step 4's plan (`docs/superpowers/plans/2026-09-10-phase1-step4-simulate-combo.md`, Task 16) carried
an inline "Known Phase 1 gaps" note listing what the engine deliberately accepts-but-doesn't-model
in its first version. The plan's final whole-branch review (2026-09-11) surfaced several more —
some fixed in the same review's fix round, some left as documented, accepted gaps. This ADR is the
durable record of the accepted gaps, since the plan document itself will not be revisited once
Phase 1 moves on to Steps 5+.

Two related bugs the same review found (`damageAmp` never honoring a `sourceKind` condition, and
`dot`'s `refresh` field being inert) were fixed directly, not deferred — they aren't gaps, they're
correctness bugs, and are not listed here.

## Decision — the following are accepted Phase 1 gaps

1. **RESOLVED (2026-09-17).** `timeToKill` was measured from the moment a basic attack landed, not
   from combo start: the `AA` sequence action advanced `time` by the attack interval *before*
   dealing damage, so the first AA of a combo landed at `t = 1/attackSpeed`, not `t ≈ 0`. Fixed by
   reordering the `AA` branch in `simulate-combo.ts` to flush scheduled events, deal damage, and
   dispatch `onBasicAttack` at the current `time`, then advance `time += interval` afterward — the
   interval now represents recovery until the *next* swing rather than a windup before this one.
   `Q`/`W`/`E`/`R` and `wait:` were untouched; their `time += duration` genuinely is a pre-effect
   delay (cast time, an explicit wait). Every AA-derived `time`/`timeToKill` value shifts back by
   exactly one interval; pinned test assertions in `simulate-combo.test.ts` were updated to match
   (verified failing against the old code before the fix, per TDD). No other file in the repo
   referenced `timeToKill` or `'AA'` timing, so the change was self-contained. Step 5's
   `compareBuilds` can now plot `ttk` without this systematic bias.

2. **`penetration` and `damageReduction` cannot express a `sourceKind`-based `condition`.**
   `modifyResist(effect, ctx, damageType)` and `damageReductionFraction(effect, ctx, damageType)`
   only receive the damage type, never the `RawDamageInstanceInput.source.kind` that
   `damageMultiplier` (and, after this ADR's companion fix round, `conditionMet`'s `damageAmp`
   caller) already thread through. Since `PenetrationEffectSchema` makes `condition` a *required*
   field — unconditional penetration is deliberately expressed as a plain `stat` effect instead
   (see `packages/schema/src/effect/kinds/penetration.ts`) — this silently disables 1 of that
   kind's 8 possible condition types for the one kind whose entire purpose is conditionality (e.g.
   "20% armor penetration on basic attacks" cannot be expressed today). The fix is a signature
   change — widen both reader capabilities to receive the full `RawDamageInstanceInput` instead of
   a bare `DamageType`, mirroring `damageMultiplier`'s existing shape — touching
   `effects/types.ts`, `penetration.ts`, `damage-reduction.ts`, `resist-shred.ts`'s `modifyResist`,
   and the three call sites in `simulate-combo.ts`. Deferred rather than rushed into a final
   review's fix round; pick up when real item data first needs a `sourceKind`-conditioned pen or
   reduction effect.

3. **Shield and heal effects mutate combatant runtime state that never surfaces in `ComboResult`.**
   `shieldHandler`/`healHandler` correctly write to `ctx.self.shieldHp`/`currentHp` on
   `onAbilityCast`, and shield absorption is correctly applied when the attacker is later
   *targeted* by damage — but Phase 1's asymmetric combat model means the attacker is never
   targeted (only the target ever takes damage), so the attacker's own `shieldHp`/healed
   `currentHp` are write-only: nothing in `ComboResult` reports them. The code path is correct, not
   buggy — it will become observable the moment a symmetric (two-attacker) combat mode exists —
   but today it's effectively dead from the caller's perspective. `ShieldEffect.durationSeconds` is
   resolved (and its data warning surfaced) but the shield itself never expires mid-combo, for the
   same underlying reason: nothing currently reads the shield expiry.

4. **`DamageComponent.hits > 1` collapses into a single `DamageInstance`** whose `amount` already
   has `hits` multiplied in, rather than emitting `hits` separate instances. This is
   mitigation-equivalent to the correct behavior (resist math is linear), but is NOT equivalent the
   moment a per-instance mechanic is in play — a `procEveryN` counter, a `% current HP` ratio that
   should re-read HP between hits, or a shield that partially absorbs one hit and not the next.
   No multi-hit ability exists in the fixture data yet to exercise this; revisit when one does.

5. **Item actives (`item:'<id>'` sequence actions) consume zero simulated time.** Multiple
   activations in the same sequence entry, or interleaved with `ignoreCooldowns: true`, can all
   land at the same instant. Real active items presumably have some cast/animation delay; Phase 1
   doesn't model one.

6. **`ignoreCooldowns: true` also bypasses item-passive internal cooldowns** (e.g. `spellblade`'s
   ICD, `resistShred`'s implicit per-hit accumulation timing), not just ability and item-active
   cooldowns. This is defensible for a "pure burst, ignore all timing gates" mode, but the option's
   name doesn't make that scope explicit — a caller might reasonably expect it to only bypass
   *ability* cooldowns. Document the actual scope wherever this option is surfaced in a future UI.

7. **A handful of schema fields are accepted but read by nothing:** `OnHitEffect.monsterCap`,
   `ProcEveryNEffect.resetsOnMiss`, `ProcEveryNEffect.debuffId`. `resetsOnMiss` is arguably moot
   until Phase 1 has any concept of a basic attack "missing." `monsterCap` is a real, common WR
   item mechanic (on-hit damage capped against monsters) and should be picked up alongside whatever
   step first models jungle monsters as targets.

8. **Percent armor pen: RESOLVED (2026-10-01, in game: Ambessa's 30% R passive plus Serylda's 35% gave 65%, an attack of
   127 on the 100-armor dummy, so the additive rule is right). Magic pen and resist reduction are still unchecked.**
   **Percent armor/magic penetration and percent resist reduction from multiple sources stack
   additively**, not multiplicatively — two 40% penetration sources currently sum to 80% rather
   than compounding to `1 - 0.6*0.6 = 64%`. `RESIST_MODIFICATION_ORDER`'s *order* is already
   TODO-VERIFY-tagged (`resistModificationOrder` in `packages/calc/src/rules.ts`), but the
   *stacking rule* among multiple same-step sources is a separate, currently-undocumented
   assumption. Should get its own `TODO-VERIFY` rule id once picked up.

9. **A `custom` effect declaring `support: 'full'` with no registered handler still vanishes
   silently.** The fix that surfaces unresolved `custom` effects (`resolve()` in
   `simulate-combo.ts`) routes through the existing `trackSupport`, which only records an entry
   when `support !== 'full'` — matching every other effect kind's convention, where `'full'` means
   "this is correctly modeled." An unresolved handler on a `'full'`-labeled `custom` effect is a
   data-authoring error (the data claims full support that doesn't exist yet), not a normal Phase-1
   state, so it's accepted as a gap rather than special-cased. Also: surfacing an unresolved
   `custom` effect only happens when the sequence actually dispatches through it (an `AA`, ability
   cast, or damage instance) — a sequence that never triggers any dispatch (e.g. `['wait:1']`
   alone) won't surface it even if one is equipped. Both are edge cases within an already-inert
   Phase-1 feature (`CUSTOM_HANDLERS` is empty for all of Phase 1).

10. **The "pending scheduled ticks" warning (added when a sequence ends with unresolved DoT ticks)
    gives misleading advice when the sequence ended because the target died**, rather than because
    the caller forgot a trailing `wait:`. The warning text suggests adding a `wait:<seconds>`
    action, which isn't the right fix for a kill — there's nothing left to wait for. Wording-only;
    the warning is still factually correct that ticks were dropped.

11. **The damage-chain recursion guard (`MAX_DAMAGE_CHAIN_DEPTH`, `simulate-combo.ts`) changes the
    exact `DamageInstance` count for a chain that already hits the cap**, compared to a
    depth-only (non-sticky) version of the same guard: once the cap trips anywhere in a chain, the
    `chainAborted` flag suppresses *all* remaining nested calls in that chain, not just the branch
    that tripped it — so two independent proc subtrees spawned from the same top-level action (e.g.
    two `procEveryN` effects on one `AA`) both get cut short rather than only the second. This is
    inherent to the fix (the same mechanism that keeps 3+ mutually-proccing effects from an
    exponential blowup) and only affects inputs that were already hitting the cap and being
    reported via the `dataWarning` — i.e. already-broken/degenerate data, not a normal case. Noted
    here so a future reader doesn't mistake a changed instance count on a cap-tripping fixture for
    a regression.

## Consequences

- None of the above block Phase 1 from running end-to-end; each is either inert today (no data
  exercises it) or a known, bounded bias rather than a crash or a silently-wrong headline number.
- Item 1 (`timeToKill` bias) was the one with a stated deadline; it is now resolved (see above), so
  Step 5's `compareBuilds` crossover charts can build on an unbiased `timeToKill`.
- This ADR supersedes the plan's inline "Known Phase 1 gaps" note as the durable reference —
  future steps should update this file, not the (by then historical) Step 4 plan document.

## Update (2026-10-01): build validation

`validateBuild` (`packages/calc/src/validate-build.ts`) now checks every build before stats resolve:
- unknown ids;
- the slot count from `rules.ts` (6 items, with boots and enchants counted according to its flags);
- one copy of each finished item (legendary, boots, enchant, support), while components may repeat;
- boots only in the boots slot;
- one item per exclusive group.

`resolveStats` throws with every issue listed, which the debug page shows as a stage error. The slot
count is verified in game: 5 items plus a separate boots slot (2026-10-01).
