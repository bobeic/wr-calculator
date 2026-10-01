// Links from hand-modelled item numbers to the numbers in wrpocket's English description they come
// from. The patch pipeline uses them to apply a number-only text change (confirmed by the official
// notes) without a hand-written override; see docs/superpowers/specs/2026-10-01-source-sync-design.md.
// test/text-links.test.ts checks every link against the current patch's text and model.

/** One modelled number and the description number(s) it comes from. */
export interface TextLink {
  /** The effect holding the number; omitted for a field on the item itself, e.g. 'stats.critDamage'. */
  effectId?: string
  /** Path inside the effect (or the item), e.g. 'ratios[0].value'. */
  path: string
  /** Each pattern matches the description exactly once, with one capture group around one number. */
  capture: RegExp[]
  /** The model value from the captured numbers, in capture order; defaults to the single number. */
  value?: (numbers: number[]) => number
}

export interface ItemTextLinks {
  links: TextLink[]
  /** Spans whose numbers the model doesn't use (move speed, shields, heals...); a change inside them changes nothing. */
  ignore?: RegExp[]
}

const pct = ([n]: number[]): number => n / 100
const ratio = ([per, cap]: number[]): number => cap / per
const ALL = [/[\s\S]+/]
const COOLDOWN = /\((\d+) second Cooldown\)/

export const ITEM_TEXT_LINKS: Record<string, ItemTextLinks> = {
  // Items whose modelled numbers are all stats (synced separately): no effect number reads the text.
  'long-sword': { links: [], ignore: ALL },
  'blasting-wand': { links: [], ignore: ALL },
  'void-staff': { links: [], ignore: ALL },
  'deaths-dance': { links: [], ignore: ALL },
  'guardian-angel': { links: [], ignore: ALL },
  'maw-of-malmortius': { links: [], ignore: ALL },
  // Life from Death heals allies only.
  cryptbloom: { links: [], ignore: ALL },
  'rabadons-deathcap': {
    links: [{ effectId: 'rabadons-deathcap-magic-opus', path: 'amount', capture: [/Increases Ability Power by (\d+)%/], value: pct }],
  },
  'blade-of-the-ruined-king': {
    links: [
      { effectId: 'botrk-mists-edge', path: 'pctTargetCurrentHp', capture: [/equal to ([\d.]+)% of the target's current Health/], value: pct },
      { effectId: 'botrk-mists-edge', path: 'minDamage', capture: [/minimum of (\d+)/] },
      { effectId: 'botrk-mists-edge', path: 'monsterCap', capture: [/maximum of (\d+) against monsters/] },
    ],
    ignore: [/\([\d.]+% for melee\)/, /Drain:[^\n]*/],
  },
  'trinity-force': {
    links: [
      { effectId: 'trinity-force-spellblade', path: 'ratios[0].value', capture: [/deals (\d+)% base AD bonus physical/], value: pct },
      { effectId: 'trinity-force-spellblade', path: 'internalCooldownSeconds', capture: [/\(([\d.]+) second Cooldown\)/] },
    ],
    ignore: [/Valor:[^\n]*/],
  },
  'liandrys-torment': {
    links: [
      // Modelled as half-second ticks: 2% per second is 1% per tick.
      { effectId: 'liandrys-torment-dot', path: 'targetMaxHpRatio', capture: [/deal ([\d.]+)% of the target's max Health as bonus magic damage each second/], value: ([n]) => n / 100 / 2 },
      { effectId: 'liandrys-torment-dot', path: 'durationSeconds', capture: [/each second, over (\d+) seconds/] },
      { effectId: 'liandrys-torment-madness', path: 'amountPerStack', capture: [/deal ([\d.]+)% additional damage each second/], value: pct },
      { effectId: 'liandrys-torment-madness', path: 'maxStacks', capture: [/deal ([\d.]+)% additional damage each second/, /up to ([\d.]+)% after/], value: ratio },
    ],
  },
  'blackfire-torch': {
    links: [
      // Modelled as half-second ticks.
      { effectId: 'blackfire-torch-baleful-blaze', path: 'tickAmount', capture: [/dealing an additional (\d+) \+/], value: ([n]) => n / 2 },
      { effectId: 'blackfire-torch-baleful-blaze', path: 'ratios[0].value', capture: [/dealing an additional \d+ \+ ([\d.]+)% Ability Power/], value: ([n]) => n / 100 / 2 },
      { effectId: 'blackfire-torch-baleful-blaze', path: 'durationSeconds', capture: [/magic damage per second for (\d+) seconds/] },
      { effectId: 'blackfire-torch-blackfire', path: 'amount', capture: [/grants you ([\d.]+)% Ability Power/], value: pct },
    ],
    ignore: [/Against monsters[^\n]*/],
  },
  'ludens-echo': {
    links: [
      // One target hit: the base plus the bonus for each of the other targets it could have hit.
      { effectId: 'ludens-echo-echo', path: 'damage', capture: [/deals (\d+) \+ [\d.]+% Ability Power magic damage to the primary/, /up to (\d+) other/, /an additional (\d+) \+/], value: ([base, others, extra]) => base + others * extra },
      { effectId: 'ludens-echo-echo', path: 'ratios[0].value', capture: [/deals \d+ \+ ([\d.]+)% Ability Power magic damage to the primary/, /up to (\d+) other/, /an additional \d+ \+ ([\d.]+)% Ability Power/], value: ([base, others, extra]) => (base + others * extra) / 100 },
      { effectId: 'ludens-echo-echo', path: 'cooldownSeconds', capture: [/\((\d+) second Cooldown\)/] },
    ],
  },
  'infinity-orb': {
    links: [
      { effectId: 'infinity-orb-inevitable-demise', path: 'amount', capture: [/Critically Strike for (\d+)% bonus damage/], value: pct },
      { effectId: 'infinity-orb-inevitable-demise', path: 'condition.conditions[0].threshold', capture: [/below (\d+)% Health/], value: pct },
    ],
  },
  'horizon-focus': {
    links: [{ effectId: 'horizon-focus-hypershot', path: 'amount', capture: [/increases damage dealt to them by (\d+)%/], value: pct }],
    ignore: [/at least [\d,]+ units/, /reveals them for \d+ seconds/, /Focus:[^\n]*/],
  },
  malignance: {
    links: [
      { path: 'stats.ultimateHaste', capture: [/ultimate abilities gain (\d+) Ability Haste/] },
      { effectId: 'malignance-hatefog', path: 'tickAmount', capture: [/equal to (\d+) plus/] },
      { effectId: 'malignance-hatefog', path: 'ratios[0].value', capture: [/plus ([\d.]+)% Ability Power per second/], value: pct },
      { effectId: 'malignance-hatefog', path: 'durationSeconds', capture: [/burns the ground beneath them for (\d+) seconds/] },
      { effectId: 'malignance-hatefog', path: 'shredWhileActive.amount', capture: [/Magic Resist by (\d+)/] },
    ],
    ignore: [/maximum radius at [\d,]+ damage/],
  },
  stormsurge: {
    links: [
      { effectId: 'stormsurge-squall', path: 'targetMaxHpFraction', capture: [/damage equal to (\d+)% of a champion's max Health/], value: pct },
      { effectId: 'stormsurge-squall', path: 'windowSeconds', capture: [/max Health within ([\d.]+) seconds/] },
      { effectId: 'stormsurge-squall', path: 'delaySeconds', capture: [/After (\d+) seconds, deal/] },
      { effectId: 'stormsurge-squall', path: 'damage', capture: [/deal (\d+) \+ [\d.]+% Ability Power magic damage to the target/] },
      { effectId: 'stormsurge-squall', path: 'ratios[0].value', capture: [/deal \d+ \+ ([\d.]+)% Ability Power magic damage to the target/], value: pct },
      { effectId: 'stormsurge-squall', path: 'cooldownSeconds', capture: [COOLDOWN] },
    ],
    ignore: [/gain \d+% Movement Speed for [\d.]+ seconds/, /grants \d+ gold/],
  },
  'lich-bane': {
    links: [
      { effectId: 'lich-bane-spellblade', path: 'ratios[0].value', capture: [/deals (\d+)% base AD/], value: pct },
      { effectId: 'lich-bane-spellblade', path: 'ratios[1].value', capture: [/\+ (\d+)% AP bonus magic/], value: pct },
      { effectId: 'lich-bane-spellblade', path: 'internalCooldownSeconds', capture: [/\(([\d.]+) second Cooldown\)/] },
    ],
  },
  riftmaker: {
    links: [
      { effectId: 'riftmaker-void-infusion', path: 'ratio', capture: [/equal to ([\d.]+)% of your bonus Health/], value: pct },
      { effectId: 'riftmaker-void-corruption', path: 'amountPerStack', capture: [/deal ([\d.]+)% additional damage each second/], value: pct },
      { effectId: 'riftmaker-void-corruption', path: 'maxStacks', capture: [/deal ([\d.]+)% additional damage each second/, /up to ([\d.]+)%\./], value: ratio },
    ],
    ignore: [/Omnivamp equal to[^\n]*/],
  },
  'black-cleaver': {
    links: [
      { effectId: 'black-cleaver-carve', path: 'amount', capture: [/reduces their Armor by ([\d.]+)%/], value: pct },
      { effectId: 'black-cleaver-carve', path: 'durationSeconds', capture: [/Armor by [\d.]+% for (\d+) seconds/] },
      { effectId: 'black-cleaver-carve', path: 'maxStacks', capture: [/stacking up to (\d+) times/] },
    ],
    ignore: [/for \d+% reduction/, /Rage:[^\n]*/],
  },
  'infinity-edge': {
    links: [{ path: 'stats.critDamage', capture: [/increased from (\d+)%/, /to (\d+)%/], value: ([from, to]) => (to - from) / 100 }],
  },
  'navori-quickblades': {
    links: [{ effectId: 'navori-untold-determination', path: 'amount', capture: [/basic abilities by (\d+)%/], value: pct }],
  },
  heartsteel: {
    links: [
      { effectId: 'heartsteel-repurpose', path: 'flat', capture: [/equal to (\d+) \+ [\d.]+% of maximum Health/] },
      { effectId: 'heartsteel-repurpose', path: 'pctOwnStat.ratio', capture: [/equal to \d+ \+ ([\d.]+)% of maximum Health/], value: pct },
    ],
    ignore: [/within [\d,]+ units/, /charges for [\d.]+ seconds/, /equal to \d+% of the damage dealt/, /has a \d+ second cooldown/],
  },
  'archangels-staff': {
    links: [
      { effectId: 'archangels-staff-awe', path: 'ratio', capture: [/equal to ([\d.]+)% maximum Mana/], value: pct },
      { effectId: 'archangels-staff-mana-charge', path: 'perStack', capture: [/max Mana by (\d+) every/] },
      { effectId: 'archangels-staff-mana-charge', path: 'maxStacks', capture: [/max Mana by (\d+) every/, /Caps at (\d+) bonus Mana/], value: ratio },
      { effectId: 'archangels-staff-mana-charge', path: 'inputs[0].max', capture: [/max Mana by (\d+) every/, /Caps at (\d+) bonus Mana/], value: ratio },
    ],
    ignore: [/Refunds \d+% of Mana/, /up to \d+ times every \d+ seconds/],
  },
  'nashors-tooth': {
    links: [
      { effectId: 'nashors-tooth-gnaw', path: 'flat', capture: [/deal (\d+) \+/] },
      { effectId: 'nashors-tooth-gnaw', path: 'pctOwnStat.ratio', capture: [/\+ (\d+)% bonus Ability Power/], value: pct },
    ],
  },
  'bloodletters-curse': {
    links: [
      { effectId: 'bloodletters-curse-vile-decay', path: 'amount', capture: [/Magic Resist by ([\d.]+)%/], value: pct },
      { effectId: 'bloodletters-curse-vile-decay', path: 'durationSeconds', capture: [/for (\d+) seconds, stacking/] },
      { effectId: 'bloodletters-curse-vile-decay', path: 'maxStacks', capture: [/Magic Resist by ([\d.]+)%/, /stacking up to ([\d.]+)%/], value: ratio },
    ],
  },
  'hextech-rocketbelt': {
    links: [
      { effectId: 'hextech-rocketbelt-protobelt', path: 'cooldownSeconds', capture: [COOLDOWN] },
      { effectId: 'hextech-rocketbelt-protobelt', path: 'damage', capture: [/dealing (\d+) \+/] },
      { effectId: 'hextech-rocketbelt-protobelt', path: 'ratios[0].value', capture: [/dealing \d+ \+ (\d+)% Ability Power/], value: pct },
      { effectId: 'hextech-rocketbelt-protobelt', path: 'extraHits.fraction', capture: [/only deals (\d+)% damage/], value: pct },
    ],
  },
  'plated-steelcaps': {
    links: [{ effectId: 'plated-steelcaps-reinforced-armor', path: 'amount', capture: [/deal (\d+)% reduced damage/], value: pct }],
  },
  'force-of-nature': {
    links: [
      { effectId: 'force-of-nature-steadfast-mr', path: 'perStack', capture: [/Movement Speed and (\d+) bonus Magic Resist/] },
      { effectId: 'force-of-nature-steadfast-ms', path: 'perStack', capture: [/gain (\d+)% Movement Speed and/], value: pct },
    ],
    ignore: [/grants \d+ Steadfast stack for \d+ seconds, up to \d+ stacks/],
  },
  eclipse: {
    links: [
      { effectId: 'eclipse-ever-rising-moon', path: 'stacksToProc', capture: [/with (\d+) separate attacks/] },
      { effectId: 'eclipse-ever-rising-moon', path: 'stackWindowSeconds', capture: [/within ([\d.]+) seconds/] },
      { effectId: 'eclipse-ever-rising-moon', path: 'cooldownSeconds', capture: [COOLDOWN] },
      { effectId: 'eclipse-ever-rising-moon', path: 'damage.ratios[0].value', capture: [/equal to ([\d.]+)% of the target's Max Health/], value: pct },
    ],
    ignore: [/\([\d.]+% for ranged champions\)/, /absorbs damage equal to [^)]*\)/, /for \d+ seconds \(/],
  },
  // Icy is a slow, which isn't modelled (there is no Frostbite burn: in-game check, 2026-10-01).
  'seryldas-grudge': { links: [], ignore: [/Icy:[^\n]*/] },
  'spear-of-shojin': {
    links: [
      { path: 'stats.basicAbilityHaste', capture: [/Gain (\d+) Basic Ability Haste/] },
      { effectId: 'spear-of-shojin-focused-will', path: 'amountPerStack', capture: [/damage by ([\d.]+)% for/], value: pct },
      { effectId: 'spear-of-shojin-focused-will', path: 'durationSeconds', capture: [/damage by [\d.]+% for (\d+) seconds/] },
      { effectId: 'spear-of-shojin-focused-will', path: 'maxStacks', capture: [/\(stacks (\d+) times\)/] },
    ],
  },
  'sundered-sky': {
    links: [
      { effectId: 'sundered-sky-lightshield-strike', path: 'critMultiplier', capture: [/dealing (\d+)% damage/], value: pct },
      { effectId: 'sundered-sky-lightshield-strike', path: 'cooldownSeconds', capture: [/\((\d+) second Cooldown per target\)/] },
    ],
    ignore: [/restoring Health equal to[^.]*/],
  },
  'steraks-gage': {
    links: [{ effectId: 'steraks-gage-heavy-handed', path: 'ratio', capture: [/Gain (\d+)% base Attack Damage/], value: pct }],
    ignore: [/Lifeline:[\s\S]*/],
  },
}
