import type { ReviewedEntry } from '../overlay'

// Flagged entries checked for patch 7.3a and found unaffected: their source changed, but
// nothing this repo models did. Each clears that entry's stale flag.
// Checked against the official 7.3a notes (released 2026-09-29), which list none of these.
const WORDING = 'wrpocket rewrote the description; no numbers changed and 7.3a notes list no change'
const REORDER = 'wrpocket reordered or reformatted the description; same numbers, and 7.3a notes list no change'

export const REVIEWED: ReviewedEntry[] = [
  { kind: 'champion', id: 'ambessa', note: `${WORDING} (all five ability descriptions)` },
  { kind: 'item', id: 'archangels-staff', note: WORDING },
  { kind: 'item', id: 'black-cleaver', note: WORDING },
  { kind: 'item', id: 'blackfire-torch', note: WORDING },
  {
    kind: 'item', id: 'blade-of-the-ruined-king',
    note: 'wrpocket text went 7% -> 6% (8.5% -> 8% melee) but the 7.3a notes list no BotRK change; '
      + 'treated as a wrpocket correction of stale text. Not hand-modelled beyond stats; verify in game',
  },
  { kind: 'item', id: 'cryptbloom', note: WORDING },
  { kind: 'item', id: 'eclipse', note: WORDING },
  { kind: 'item', id: 'force-of-nature', note: `${REORDER}; "magic damage" now reads "ability damage"` },
  { kind: 'item', id: 'guardian-angel', note: REORDER },
  { kind: 'item', id: 'heartsteel', note: WORDING },
  {
    kind: 'item', id: 'hextech-rocketbelt',
    note: 'wrpocket says "a cone of magic bolts" instead of "7 magic bolts"; the 7 bolts were measured '
      + 'in game on 2026-09-29 and 7.3a notes list no change',
  },
  { kind: 'item', id: 'horizon-focus', note: `${REORDER} (1200 is now written 1,200)` },
  { kind: 'item', id: 'infinity-edge', note: WORDING },
  {
    kind: 'item', id: 'infinity-orb',
    note: 'wrpocket dropped "+15 Magic Penetration" from the text, but its 7.3a stats still have '
      + 'flatMagicPen 15 and 7.3a notes list no change',
  },
  { kind: 'item', id: 'liandrys-torment', note: REORDER },
  {
    kind: 'item', id: 'lich-bane',
    note: 'wrpocket dropped "+5% movement speed" (not modelled) and added "reduced vs structures"; '
      + 'Spellblade numbers unchanged and 7.3a notes list no change',
  },
  {
    kind: 'item', id: 'ludens-echo',
    note: 'wrpocket says up to 4 other enemies instead of 5; irrelevant in 1v1 and 7.3a notes list no change',
  },
  { kind: 'item', id: 'malignance', note: WORDING },
  { kind: 'item', id: 'maw-of-malmortius', note: WORDING },
  {
    kind: 'item', id: 'nashors-tooth',
    note: `${WORDING}; the category Magic -> Physical looks like a wrpocket data error, the modelled entry keeps its magic tag`,
  },
  { kind: 'item', id: 'navori-quickblades', note: WORDING },
  { kind: 'item', id: 'plated-steelcaps', note: REORDER },
  { kind: 'item', id: 'rabadons-deathcap', note: WORDING },
  { kind: 'item', id: 'riftmaker', note: REORDER },
  { kind: 'item', id: 'seryldas-grudge', note: WORDING },
  {
    kind: 'item', id: 'spear-of-shojin',
    note: 'wrpocket added "stacks have a 1 second cooldown per ability cast"; the model already stacks '
      + 'once per cast, and 7.3a notes list no change',
  },
  {
    kind: 'item', id: 'steraks-gage',
    note: 'wrpocket now names Sterak\'s Fury\'s 30% tenacity (not modelled); 7.3a notes list no change',
  },
  { kind: 'item', id: 'stormsurge', note: WORDING },
  { kind: 'item', id: 'sundered-sky', note: WORDING },
  {
    kind: 'item', id: 'trinity-force',
    note: `${REORDER}; Valor's ranged value is now "halved" instead of 10`,
  },
]
