# Overnight work, 2026-10-02 → 03: what changed and what needs you

Everything is on branch `claude/vibrant-cori-7y0e6g` (not merged into `main`). 1,149 tests pass and typecheck is
clean after every commit.

## Done

1. **Your shop answers.** A build can't hold two finished items with the same named passive. The importer now
   reads passive names from wrpocket's item text. "No full item twice" and "Eclipse procs on Q2" are recorded as
   verified.
2. **Every remaining item that changes a damage number** (53 items, batch 6). This needed new engine pieces:
   attack-stacking buffs, ultimate-cast buffs, in-combat auras, execute, adaptive stats, every-Nth-attack procs, and
   code for Guinsoo's phantom hit and Fiendhunter's Opening Barrage. Prices and stats still sync from wrpocket. ADR:
   `docs/decisions/2026-10-02-item-batch6.md`.
3. **Runes**: all 52 of 7.3a's, with keystones and damage runes modelled. **Summoner spells**: all 9, with Ignite
   and upgraded Smite dealing damage (`spell:ignite` in a combo).
4. **Patch check**: wrpocket, the official notes and Tencent's feed are all still on 7.3/7.3a. Nothing new to import.
5. **Research** on other calculators: `docs/research/2026-10-02-existing-calculators.md`. The useful one was
   SharpWR, a Wild Rift ADC calculator: it gave us the Energized cadence and Terminus's 40% cap.
6. **CN win rates**: a pipeline pulls Tencent's ranked win, pick and ban rates per bracket and lane, mapped to our
   champions (679 rows, none unmapped). `pnpm --filter @wr-calc/data cn-stats:update`, plus a manual GitHub
   workflow.
7. **Website scaffold** (static, 326 pages): home, CN tier list (bracket and lane filters), every champion (CN rates
   per lane plus ability text), every item (stats, text, recipe, and how much the calculator models), runes,
   patches (official notes with before → after), and the calculator. The calculator is the engine's debug view
   for now; it also stays at `/debug`.
8. **A test sheet with predicted numbers**: `docs/test-sheets/predictions-7.3a.md`. For each damaging item, rune
   and spell, it gives a one-item setup, a combo, and the numbers the practice tool should show. Regenerate it with
   `pnpm --filter @wr-calc/data test-sheet > docs/test-sheets/predictions-7.3a.md`.

## Questions for you

1. **Where should builds come from?** wrchina.gg's `robots.txt` blocks its `/api/` to every bot, and it calls its
   data protected, so I didn't use it. Tencent's open feed has win rates but no builds, and guessing endpoint names
   went nowhere. If you can open wrchina.gg or Tencent's 掌上英雄联盟 app with browser devtools and note the request
   URLs for a champion's build, I can check whether Tencent serves builds directly.
2. **Site design.** Styling is deliberately plain: one CSS file of tokens (`apps/web/src/app/globals.css`), so a
   design pass doesn't touch the pages. Before I style it, it would help to know:
   - sites or apps whose look you like (and ones you don't);
   - the site's name (it says "wr-calc" now);
   - dark first, light first, or both;
   - whether to show champion and item icons. Tencent's CDN has them, but hotlinking someone else's images is a
     licensing and reliability question.
3. **Tier letters.** The order is Tencent's strength ranking. The S+/S/A/B/C cut (top 8% / 17% / 25% / 25% / 25%)
   is my placeholder; wildriftalpha may cut differently. Is that fine, or would you rather tier by win rate?
4. **Melee vs ranged values.** Many items and runes differ for melee and ranged (BotRK, Eclipse, Kraken, Divine
   Sunderer, Lethal Tempo, Grasp…). The engine uses melee values everywhere except Yun Tal. Neither wrpocket nor
   Tencent says which champions are ranged. Proposal: a hand-written ranged list, which you'd skim, plus a
   melee/ranged value type the engine picks from. OK to go ahead?
5. **Champion kits.** Only Ambessa is hand-modelled. The other 141 use the auto-imported ability numbers, which the
   import report says are rough in places. Which champions matter most to you? I'd start there.

## In-game checks (when convenient)

`docs/test-sheets/pending-checks.md` lists them. The highest value:

- A few rows from `predictions-7.3a.md`. Kraken Slayer, Electrocute, Conqueror (watch AD climb), Sunfire and
  Ignite cover most of the new engine pieces.
- Three shared-passive pairs that might not block each other: Rylai's + Serylda's ("Icy"), Dead Man's Plate +
  Youmuu's ("Momentum"), Sunfire + Hollow Radiance ("Immolate").
- The Energized cadence (attacks per charge, standing still) and the Ignite cooldown.

## Things to know

- Batch 6 items are on the 7.3a layer, not 7.3: their text is 7.3a's. The build-impact report lists them as
  "modelled for the first time", not as patch changes.
- Stat gold values price stats from passive-free components first, and use a component with a passive only for a
  stat nothing else can price (Tear stays the mana anchor). Every stat price is unchanged; this just stops a newly
  modelled component from shifting them.
- A `stat` effect behind a toggle used to apply whether or not the toggle was on. It now respects the toggle. No
  existing data relied on the old behaviour (all golden cases unchanged).
- Our id for Nunu is `nunu-willump` (wrpocket says `nunu-and-willump`). The id alias map moved into
  `packages/data/src/wrpocket-ids.ts` so the site and the scripts share it.
