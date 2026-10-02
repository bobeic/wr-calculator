# Pending in-game checks

Only passives whose behaviour is unclear or needs confirming go here. Plain numbers (stats, prices,
ratios) come from wrpocket, which in-game checks have backed (decided 2026-10-01; see ADR
`2026-10-01-data-source-priority.md`). Tick an item off (or delete it) once its reading has been applied.
Patch 7.3a is live.

## 1. Unclear passives

- Shared passive names: answered 2026-10-03. Rylai's + Serylda's can be bought together (Icy doesn't block,
  `packages/data/src/shop-rules.ts`). Dead Man's Plate + Youmuu's can't. Only one of Sterak's, Maw and Mantle of
  the Twelfth Hour; Seraph's Embrace goes with any of them. Only one of Sunfire and Hollow Radiance. All pinned in
  `packages/data/test/shop-rules.test.ts`.

- Batch 6 assumptions (2026-10-02; status per item):
  - Energized items (Rapid Firecannon, Stormrazor, Statikk Shiv): answered 2026-10-02. 9 energy per attack (14 for
    Statikk Shiv — the "5 additional" is on top of the normal 9), 100 needed. Movement also charges it but isn't
    modelled, so the engine's standing-still attack counts (12, Statikk 8) overcount how long it takes while kiting.
  - Sunfire Aegis, Bami's Cinder, Unending Despair: answered 2026-10-02. They tick for as long as the target stays
    in range and you're in combat, stopping immediately on leaving range. Exactly how long "in combat" itself lasts
    after your last hit (absent a range check) is still a guess — the engine uses 3s.
  - Galeforce: answered 2026-10-02. Total of all 3 projectiles, split evenly, confirmed close enough in game
    (level 15 Caitlyn, 60 bonus AD, 100-armor dummy: 26 mitigated per bolt observed vs ~24 predicted).
  - Guinsoo's Rageblade: answered 2026-10-02. Seething Strike stacks last 4 seconds (engine now matches).
  - Terminus: answered 2026-10-02. The first attack is Light (engine already assumed this).
  - Kraken Slayer: still open. Two things to check:
    1. Does 150–210 grow linearly with level? Equip only Kraken Slayer, attack a full-Health dummy 3 times at
       level 1 and note the bonus on the 3rd hit (should read ~150), then again at level 15 (~210); a level in
       between (say 8) should fall roughly on the line between them.
    2. Does Guinsoo's phantom extra on-hit count toward Kraken's "every 3rd attack"? Equip both, attack until
       Guinsoo's 4 stacks are up (4+ hits), then keep attacking and watch which real attack number procs Kraken's
       bonus. If it still lands on your 3rd/6th/9th real attack, phantom hits don't count (current assumption); if
       the timing shifts, they do.
  - Dusk and Dawn: answered 2026-10-02. The extra on-hit lands right after the attack (engine already assumed this).

- Runes (first modelled 2026-10-02 from wrpocket's 7.3a text; all unchecked):
  - Rune page shape: the engine only enforces one keystone. How many minor runes, and one per path or per row?
  - Aery: how long before she can be sent again? The engine says 2 seconds.
  - Empowerment: once per fight, or every 3 attacks? And does the 8% start right after the proc? The engine procs
    once and leaves the 8% to a toggle.
  - Cut Down and Last Stand say "attacks": do abilities count? The engine amplifies everything.
  - Grasp of Undying: the engine has it ready on the first attack, then every 4 seconds.
  - Electrocute and Dark Harvest damage type: adaptive by bonus AD vs AP (rules.ts `adaptiveDamageType`).

- Ignite: what is its cooldown in Wild Rift (the engine uses League's 90s), and is 72–380 linear with level?

- Champion kits for Darius, Lee Sin, Hwei, Caitlyn and Senna (2026-10-03, from wrpocket's 7.3a text; all unchecked).
  The guesses most likely to be off:
  - Darius: answered 2026-10-03: Noxian Might is 236 AD at level 15, and R (375 true at rank 3) doubles at 5 stacks.
    Still open: Noxian Might between levels 2 and 14 (the engine assumes a straight line from 32), and whether
    Hemorrhage ticks once a second.
  - Caitlyn: is the Headshot the 6th attack or the 7th? The text reads "every 6 attacks, the next attack", so the
    engine fires it on the 7th.
  - Hwei: does Signature of the Visionary go off on every second ability hit? How long do Stirring Lights last (the
    engine says 6s)?
  - Senna: Mist's crit is modelled as 0.5% per stack instead of 10% per 20.

- Batch 2 kits (2026-10-03, unchecked). The guesses most likely to be off:
  - Master Yi: Wuju Style's passive reads "5 Attack Damage (8% AD)"; the engine gives 5 AD plus 8% of AD. And is
    Double Strike's 150% the total of both strikes (the engine: the second strike is 50% AD)?
  - Nautilus: Staggering Blow's "13 (based on level)": what is it at level 15? The engine uses 13 at every level.
  - Miss Fortune: Love Tap's "6% (based on level)" extra damage isn't modelled; what is it at level 15?
  - Yasuo: "90% critical damage" (and Senna's) isn't modelled. Does a Yasuo crit deal 1.8× (90% of 2×) or 1.9×?
  - Cho'Gath: how long do Vorpal Spikes stay ready after E (the engine says 5 s)?

- Batch 3 kits (2026-10-02, from wrpocket.app's per-champion JSON; all unchecked). The guesses most likely to be off:
  - Garen: Judgment's armor shred (10% after 6 landed hits) isn't modelled at all — the engine has no way to gate a
    resist reduction on a hit count. The spin is capped at 8 hits even past level 4 (real cap: 11).
  - Xin Zhao: how long Three Talon Strike's 3 charges last before expiring (engine: 10 s, not stated in the text).
  - Brand: Ablaze is modelled as a flat 3% max-Health tick once per cast; the 3-stack detonation (10% +0.02% AP)
    and every Blaze-conditional bonus (Sear stun, Pillar +30%, Conflagration spread, Pyroclasm slow) are skipped.
  - Yunara: only the base Cultivation of Spirit (on-hit + Spirit Unbound) and base Arc of Judgment are modelled.
    Vow of the First Lands (crit bonus), the Unleash resource gating Spirit Unbound, and both Transcendent-state
    upgrades (Arc of Ruin, Untouchable Shadow) are skipped entirely. How long the Arc of Judgment bead lingers
    is a guess (1 s).
  - Thresh: Flay's passive "2 per Soul" flat bonus isn't modelled (only its AD ratio is); Damnation's Armor/AP
    per Soul is modelled with a 40-soul cap that isn't from the text.

- Batch 4 kits (2026-10-02, from wrpocket.app's per-champion JSON; all unchecked). The guesses most likely to be off:
  - Mordekaiser: Obliterate's numbers (byRank base 116/165/217/272, AP and bonus AD ratios) are a reconstruction —
    wrpocket's prose ("80 + 4-70 by level, +70% AP +120% bonus AD") and its per-rank table (80-170 base, a
    "Bonus AD Ratio" of 45-60%) don't reconcile cleanly, and the table's "Bonus AD Ratio" label is read here as the
    single-target damage bonus instead (see the code comment in `champions-batch4.ts`). Worth checking against the
    actual tooltip in game before trusting it. Darkness Rise's cloud damage (5 AP + 1% max Health, both "based on
    level") is taken as flat 5%/1%; the 3% magic pen is not modelled at all.
  - Viego: Double Strike's proc has no stated cooldown beyond its 5s window, so it can fire every time an ability
    lands — may be too generous.
  - Veigar: Primordial Burst's 0-100% amp against low-Health targets isn't modelled (no engine hook scales a plain
    ability's damage by missing Health outside procEveryN).
  - Tristana: Explosive Charge's 4s fuse, its stacking +25% per hit (up to 2x), and its on-kill explosion are all
    skipped — only the base bomb damage is modelled.
  - Leona: how long Shield of Daybreak's empower lasts unused before expiring (engine: 10s, not stated).
- Batch 5 kits (2026-10-02, same source; all unchecked). The guesses most likely to be off:
  - Sett: Knuckle Down read as 1% max Health + 0.01-0.025% per AD (by rank). Haymaker's Grit portion and The Show
    Stopper's % of the grabbed enemy's bonus Health are left out, so both are well under real damage; the right
    punch's 8x faster wind-up isn't modelled either.
  - Graves: attacks read as all 4 bullets hitting (144% AD) at every level ("based on level" isn't given); reloading
    isn't modelled, so his sustained DPS is overstated.
  - Galio: Colossal Smash's cooldown isn't stated (League's 5s used); Winds of War's tornado read as 8% max Health
    +2% per 100 AP.
  - Samira: the melee-range passive damage isn't modelled; Flair and Inferno Trigger don't crit.
  - Lux: Illumination detonates on every second ability hit only (not on attacks), with no level scaling.
- Batch 6 kits (2026-10-02, same source; all unchecked). The guesses most likely to be off:
  - Dr. Mundo: Heart Zapper's table (20/40/60/80) read as both the per-second and the detonation base, all landing
    at once. Nothing that scales with his own missing Health is modelled (Blunt Force Trauma's +60%, its passive AD),
    nor Maximum Dosage's AD; Infected Bonesaw's minimum damage isn't applied.
  - Tryndamere: Fury is an input (0.32% crit per point at every level); Bloodlust's AD from missing Health isn't
    modelled.
  - Mel: Overwhelm (stored damage and execute) isn't modelled at all, so her damage and Golden Eclipse are well under
    real. Projectile Burst is 3 projectiles once per ability (no stacking to 9).
  - Jinx: always on Pow-Pow (minigun); Fishbones isn't modelled. Death Rocket at full (travelled) damage.
  - Seraphine: one Note per cast; Echo and Notes from allies aren't modelled; High Note's missing-Health increase isn't.
- Batch 7 kits (2026-10-02, same source; all unchecked). The guesses most likely to be off:
  - Nasus: Spirit Fire's zone ticks once a second for 5s and its % Armor reduction isn't modelled; Fury of the Sands'
    later ticks drop the AP part and the 240/s cap.
  - Kha'Zix: Taste Their Fear always isolated (x2.1); Unseen Threat once per combo; evolutions not modelled.
  - Akali: Assassin's Mark taken as a spellblade with a flat 37 at every level; Perfect Execution's second dash scales
    in a straight line to 100% missing Health (text: max below 35% Health) and drops its extra AP.
  - Draven: one empowered attack per Spinning Axe cast (no juggling); Whirling Death hits twice (out and back).
  - Blitzcrank: Power Fist read as +80-140% AD rather than a crit; Static Field's mark procs on every attack, even
    while the ultimate is on cooldown.
- Batch 8 kits (2026-10-02, same source; all unchecked). The guesses most likely to be off:
  - Aatrox: Deathbringer Stance on a flat 24s cooldown (the 3s refund per hit isn't modelled, so it procs too
    rarely); The Darkin Blade's three casts at once, never on the sweetspot; World Ender is a toggle.
  - Nocturne: Umbra Blades read as +20% AD on every 4th attack; Dusk Trail's AD for the full 5s.
  - Yone: Steel and Spirit (every other attack half magic) and Soul Unbound's true-damage echo aren't modelled;
    Spirit Cleave and Fate Sealed read as half physical, half magic.
  - Jhin: the fixed attack rate, reload and attack-speed-to-AD conversion aren't modelled (attack speed speeds him
    up here); the 4th shot is +60% AD without its 11% missing Health; Curtain Call is 5x one shot at once, with the
    missing-Health increase on the base only.
  - Malphite: Thunderclap's cone damage assumed to hit the target on every attack for 6s.
- Batch 9 kits (2026-10-02, same source; all unchecked). The guesses most likely to be off:
  - Volibear: The Relentless Storm's lightning at 5 stacks and its +4% AP attack speed aren't modelled; Frenzied
    Maul is always the un-Frenzied cast.
  - Jarvan IV: Dragon Strike's % Armor reduction isn't modelled; Martial Cadence reads Health after the attack lands.
  - Morgana: Tormented Shadow's up-to-170% missing-Health increase isn't modelled; Soul Shackles always lands both hits.
  - Kai'Sa: Caustic Wounds is 5 at every level and ignores Plasma stacks; "+5% AP" on the detonation read as per
    100 AP; Void Seeker's 2 Plasma stacks aren't applied.
  - Yuumi: unattached numbers only; Final Chapter's later waves read as 20/30/40 (+5% AP) each.
- Batch 10 kits (2026-10-02, same source; all unchecked). The guesses most likely to be off:
  - K'Sante: All Out isn't modelled at all (the upgraded abilities, attack speed, lost resists), nor Demolishing
    Strike; Dauntless Instinct acts as a spellblade at 1-2% max Health in a straight line by level.
  - Kayn: base form only (neither Shadow Assassin nor Darkin Slayer).
  - Ahri: all 3 fox-fires and all 3 Spirit Rush casts land on the target, at once.
  - Ashe: Frost Shot's crit rework isn't modelled; Ranger's Focus is castable without its 4 Focus stacks.
  - Lulu: Pix's 12 is flat at every level; only one Glitterlance bolt hits.
- Batch 11 kits (2026-10-02, same source; all unchecked). The guesses most likely to be off:
  - Teemo: Toxic Shot's poison restarts on each attack (assumed not to stack); Noxious Trap is one mushroom at once.
  - Pantheon: Mortal Will and Comet Spear's low-Health crit aren't modelled; Grand Starfall's spear uses Comet Spear's
    rank 4 numbers whatever its rank.
  - Ziggs: Short Fuse assumed ready on every Bouncing Bomb.
  - Ezreal: Mystic Shot's on-hit effects and cooldown refunds aren't modelled; Essence Flux detonates at once.
  - Pyke: Death from Below is only its 50% damage (no execute, no Armor Penetration part).
- Batch 12 kits (2026-10-02, same source; all unchecked). The guesses most likely to be off:
  - Urgot: Echoing Flames has one 15s cooldown for all six legs (procs far too rarely); Purge fires 3 shots a second
    (League of Legends' rate); Fear Beyond Death's execute isn't modelled.
  - Vi: Denting Blows' Armor reduction and attack speed aren't modelled; Vault Breaker always fully charged;
    Relentless Force's charges aren't modelled.
  - Ekko: Z-Drive's 3-hit window taken as 4s; "Low Health" for Parallel Convergence taken as below 30%.
  - Kalista: Rend's spear count is an input, and each extra spear uses rank 4's 42 (+57% AD) at every rank.
  - Zyra: one Thorn Spitter per ability hit, attacking once a second for 6s.

- Ranged list (2026-10-03): skim `packages/data/src/attack-types.ts`. It's from League's attack types; anyone missing
  or wrong there gets the wrong melee/ranged item values. Gnar, Nidalee, Jayce and Kayle change with form; the
  engine uses one value per combo (listed in the file).

## 2. Open engine rules (TODO-VERIFY in `packages/calc/src/rules.ts`)

Each `TODO-VERIFY` comment there says how to check it. The ones most likely to move numbers:

- `critDamageMultiplier`: hit the dummy with and without a crit.
- `attackSpeedCap`: stack attack speed on a fast-attacking champion.
- `abilityHasteFormula`: time a cooldown with and without haste.
- `resistModificationOrder` and `damageAmpTiming`: penetration plus an amp item on the same hit.

## 3. Parked unknowns (only if convenient)

- Ambessa R deals ~57 more pre-mitigation damage than its tooltip, on both the dummy and a full-HP
  Garen. A fixed bonus or a hidden ~14% amp would fit. With Eclipse (+65 bonus AD) it read 275, against 270
  with no items, so R may scale slightly with bonus AD (~13% of bonus AD before mitigation). Decided 2026-10-02:
  not worth chasing further — the engine keeps using the tooltip's literal numbers.
- Hextech Rocketbelt's occasional ~75 reading isn't extra damage on top (2026-10-02) — it's a different bolt count
  landing, not a separate bonus. Small enough not worth modelling.
- Stormsurge never triggered on the dummy; needs a real champion target.
