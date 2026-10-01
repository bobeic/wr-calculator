# ADR: Batch 5 — hit ids, merged attacks, hitStackProc, hitStackAmp, guaranteedCrit

**Status:** Accepted

## Context

In-game tests showed that same-type bonuses on one attack display as a single number: Ambessa's
empowered attack and Trinity Force's spellblade attack each show one physical figure. Magic bonuses
(Lich Bane, Nashor's Tooth) show as separate numbers. Eclipse counts one stack per attack or cast,
so the engine needs a notion of "one hit" that is independent of how many damage instances it deals.

## Decision

1. **Hit ids.** Every basic attack and every ability stage cast opens a hit. Damage instances dealt
   during it carry a `hitId`; scheduled damage (dots, delayed events) carries none. `onHitLanded`
   fires once per hit that dealt damage.
2. **Merged attacks.** `beforeBasicAttack` returns an `AttackModifier`. Physical bonuses merge into
   the attack instance as `parts`, and damage amps apply per part. `empoweredAttack` and
   `spellblade` moved to this mechanism. The empowered bonus has source kind `passive`.
3. **New effect kinds.**
   - `hitStackProc`: counts hits (by `stacksFrom`), stacks live on the target, and the proc is an
     instant hit or a damage over time. No stacks are gained while the proc is on cooldown.
   - `hitStackAmp`: adds a stack after the hit, so the hit that adds a stack is not itself amped.
     The amp is per source kind (`appliesTo`).
   - `guaranteedCrit`: the highest crit multiplier override wins, and it applies even under
     `critMode: 'never'`. It has its own cooldown.
   - New stat `basicAbilityHaste`: haste for basic (non-ultimate) abilities.

## Consequences

- Black Cleaver gets one stack per empowered attack instead of one per merged part.
- `totalsBySource` credits merged damage to `AA`.
- Item actives do not open hits.
- The `lifeline` exclusive group excludes Seraph's Embrace, because an item can hold only one group
  and Seraph's is already in the Tear group.

## Open

- Whether Eclipse and Sundered Sky trigger on the practice dummy.
- Whether Eclipse's proc shows as its own number.
- Whether Seraph's Embrace blocks Sterak's Gage and Maw of Malmortius (shared Lifeline-type shield).
