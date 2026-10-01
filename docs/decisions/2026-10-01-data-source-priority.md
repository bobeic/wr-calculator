# ADR: Data source priority

**Status:** Accepted

## Context

Values come from four places: wrpocket.app, the official patch notes, the WR wiki
(wiki.leagueoflegends.com) and the user's practice-tool readings. They disagree often enough that
each conflict needs a rule. As of 2026-10-01 the track record is:

- **wrpocket:** every item stat, price and per-rank ability value we have measured in game matched,
  apart from cases where its English and Chinese text disagreed. Its numbers also matched the
  official 7.3 notes everywhere we checked (Death's Dance, Serylda's Grudge, BotRK) and the 7.3a
  price change (Death's Dance 3300). Its weak points:
  - The per-level champion stat tables interpolate in a straight line; the real curve is not.
  - Its description text drifts between snapshots without a patch change. 30 of the 31 entries
    flagged for 7.3a were rewording.
  - Its text sometimes regresses against the notes. In 7.3a it gives Sterak's Fury 30% tenacity and
    BotRK 6% / 8%, and it lists Nashor's Tooth as Physical.
- **Official patch notes:** authoritative, but they only list changes, in prose, and usually not the
  untouched passives.
- **WR wiki:** many item pages are several patches out of date. Death's Dance is at 7.0f and
  Guardian Angel at V3.3c, both with pre-7.3 values. It is still the only written source for some
  mechanics, such as Ambessa's feint window or R's patch history.
- **Others checked:** wildriftmeta.com (7.3, no source stated, not on 7.3a yet) and
  wildrifttools.com (7.0d). Neither is more current or more detailed than wrpocket.

## Decision

When sources conflict, trust them in this order:

1. In-game readings.
2. Official patch notes, for anything a patch note states.
3. wrpocket numeric data (stats, prices, per-rank tables). For its description text, use only
   numbers that the notes don't contradict.
4. The WR wiki, only for mechanics nobody else documents, with a comment naming it.

wrpocket stays the import source because it is the only machine-readable one. Each conflict gets a
comment at the value naming the sources. Anything still open goes on
`docs/test-sheets/pending-checks.md`.

## Consequences

- A wrpocket text change is not a patch change. The next pipeline step cross-checks it against the
  official notes.
- Values cited from the wiki are suspect when the page's patch version is old.

## Update (2026-10-01, in-game readings)

- **The official notes don't list every change.** BotRK went 7% → 6% (8.5% → 8% melee) in 7.3a, but neither the
  7.3 nor the 7.3a notes say so. wrpocket's text had it right. Notes still outrank wrpocket for anything
  they state, but a wrpocket number change the notes leave out is not proof of a wrpocket error. The notes
  cross-check therefore no longer auto-clears a text change that moves a number; it stays flagged for an
  in-game check.
- **wrpocket was right on Eclipse too.** The proc is 7% max HP (melee); the WR wiki's 6% was out of date.
- wrpocket's text was wrong on Sterak's Gage (30% tenacity on Fury; it is 20% flat) and dropped Infinity Orb's
  15 magic pen (still there), so wrpocket text changes still need confirming.
