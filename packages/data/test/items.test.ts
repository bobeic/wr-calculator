import { describe, it, expect } from 'vitest'
import { ItemSchema } from '@wr-calc/schema'
import { combatantFromChampion, combatantFromDummy, resolveStats, simulateCombo } from '@wr-calc/calc'
import { PATCH_7_3_CHAMPIONS, PATCH_7_3_ITEMS, STARTER_ITEMS } from '../src/patches/7.3'
import { buildCatalog } from '../src/catalog'
import { GENERATED_ITEMS } from '../src/patches/7.3/generated/items'

const STARTER_IDS = [
  'long-sword', 'bf-sword', 'blasting-wand', 'rabadons-deathcap', 'blade-of-the-ruined-king',
  'trinity-force', 'liandrys-torment', 'void-staff', 'black-cleaver', 'infinity-edge',
  'navori-quickblades', 'heartsteel', 'seraphs-embrace', 'plated-steelcaps', 'force-of-nature',
  'ludens-echo', 'infinity-orb', 'horizon-focus', 'malignance',
  'stormsurge', 'blackfire-torch', 'cryptbloom', 'lich-bane', 'riftmaker', 'archangels-staff',
  'nashors-tooth', 'bloodletters-curse', 'hextech-rocketbelt',
  'eclipse', 'seryldas-grudge', 'spear-of-shojin', 'sundered-sky', 'steraks-gage', 'deaths-dance',
  'guardian-angel', 'maw-of-malmortius',
].sort()
const ALLOWED_STARTER_NULLS: string[] = []

function nullPaths(value: unknown, path: string, out: string[]): void {
  if (value === null) out.push(path)
  else if (Array.isArray(value)) value.forEach((element, index) => nullPaths(element, `${path}[${index}]`, out))
  else if (typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) nullPaths(child, `${path}.${key}`, out)
  }
}

describe('STARTER_ITEMS', () => {
  it('has exactly the 36 starter items', () => {
    expect(STARTER_ITEMS.map((item) => item.id).sort()).toEqual(STARTER_IDS)
  })

  it('has no null values', () => {
    const found: string[] = []
    for (const item of STARTER_ITEMS) {
      const paths: string[] = []
      nullPaths(item, '', paths)
      found.push(...paths.map((path) => `${item.id} ›${path.replace(/^\./, ' ')}`))
    }
    expect(found).toEqual(ALLOWED_STARTER_NULLS)
  })

  const ambessa = PATCH_7_3_CHAMPIONS.find((champion) => champion.id === 'ambessa')!
  const dummyTarget = () => combatantFromDummy({ kind: 'dummy', hp: 10000, armor: 100, mr: 100 })
  const ambessaWith = (items: string[]) => combatantFromChampion(
    ambessa, 15, { items, runes: [], inputs: {} }, buildCatalog(PATCH_7_3_ITEMS)
  )

  it("procs Eclipse's Ever Rising Moon for 6% max HP on the second hit", () => {
    const result = simulateCombo(ambessaWith(['eclipse']), dummyTarget(), ['AA', 'W'], { critMode: 'never' })
    const proc = result.instances.find((i) => i.source.id === 'eclipse-ever-rising-moon')!
    expect(proc.raw).toBeCloseTo(600, 6)
    expect(proc.hitId).toBe(result.instances.find((i) => i.source.id === 'ambessa-w')!.hitId)
  })

  it("burns for 8 Frostbite ticks after Serylda's Grudge's third ability hit", () => {
    const result = simulateCombo(
      ambessaWith(['seryldas-grudge']), dummyTarget(), ['Q', 'W', 'E', 'wait:2'], { critMode: 'never' }
    )
    const ticks = result.instances.filter((i) => i.source.id === 'seryldas-grudge-frostbite')
    expect(ticks).toHaveLength(8)
    // Level 15: 40 + 40% of 50 bonus AD per tick.
    expect(ticks[0].raw).toBeCloseTo(40 + 0.4 * 50, 6)
  })

  it("gives Spear of Shojin 20 basic ability haste and a 3%-per-hit ability ramp to 12%", () => {
    const shojin = STARTER_ITEMS.find((item) => item.id === 'spear-of-shojin')!
    expect(shojin.stats.basicAbilityHaste).toBe(20)
    expect(shojin.effects.find((effect) => effect.id === 'spear-of-shojin-focused-will'))
      .toMatchObject({ kind: 'hitStackAmp', amountPerStack: 0.03, maxStacks: 4, appliesTo: ['ability', 'passive'] })
  })

  it("crits Ambessa's first attack at 160% with Sundered Sky, and not the second", () => {
    const result = simulateCombo(ambessaWith(['sundered-sky']), dummyTarget(), ['AA', 'AA'], { critMode: 'never' })
    const attacks = result.instances.filter((i) => i.source.id === 'AA').map((i) => i.raw)
    expect(attacks[0]).toBeCloseTo(attacks[1] * 1.6, 6)
  })

  it("gives Sterak's Gage AD equal to half of base AD", () => {
    const sheet = resolveStats(ambessa, 15, { items: ['steraks-gage'], runes: [], inputs: {} }, buildCatalog(PATCH_7_3_ITEMS))
    expect(sheet.bonus.ad).toBeCloseTo(sheet.base.ad! * 0.5, 6)
  })

  it('matches its generated counterpart on cost, recipe and every generated stat', () => {
    for (const starter of STARTER_ITEMS) {
      const generated = GENERATED_ITEMS.find((item) => item.id === starter.id)
      if (!generated) continue // seraphs-embrace only
      expect(starter.cost, starter.id).toEqual(generated.cost)
      expect(starter.recipe, starter.id).toEqual(generated.recipe)
      expect(starter.stats, starter.id).toMatchObject(generated.stats)
    }
  })

  it('is marked as unverified wiki data', () => {
    for (const item of STARTER_ITEMS) {
      expect(item.provenance, item.id).toEqual({ source: 'wiki', patch: '7.3', verifiedInGame: false })
    }
  })

  it("gates Black Cleaver's Sunder to physical damage, since the engine's onDamageDealt hook fires for every damage type", () => {
    const blackCleaver = STARTER_ITEMS.find((item) => item.id === 'black-cleaver')!
    const sunder = blackCleaver.effects.find((effect) => effect.id === 'black-cleaver-carve')!
    expect(sunder.condition).toEqual({ type: 'damageType', value: 'physical' })
    expect(sunder.support).toBe('partial')
  })

  it("models Luden's Echo as a single-target ability-hit proc that can start on cooldown", () => {
    const ludens = STARTER_ITEMS.find((item) => item.id === 'ludens-echo')!
    expect(ludens.effects).toHaveLength(1)
    const echo = ludens.effects[0]
    expect(echo).toMatchObject({
      kind: 'abilityHitProc', damageType: 'magic', damage: 155,
      ratios: [{ stat: 'ap', value: 0.128 }], cooldownSeconds: 9,
      startOnCooldownInputId: 'ludens-echo-on-cooldown', support: 'partial',
    })
    expect(echo.inputs).toEqual([{
      type: 'boolean', id: 'ludens-echo-on-cooldown',
      label: "Luden's Echo on cooldown at combo start", default: false,
    }])
  })

  it("models Infinity Orb's Inevitable Demise as +20% ability damage below 40% target HP", () => {
    const orb = STARTER_ITEMS.find((item) => item.id === 'infinity-orb')!
    expect(orb.stats).toEqual({ ap: 110, flatMagicPen: 15 })
    expect(orb.effects).toHaveLength(1)
    expect(orb.effects[0]).toMatchObject({
      kind: 'damageAmp', amount: 0.2, support: 'partial',
      condition: {
        type: 'allOf',
        conditions: [{ type: 'targetHpBelow', threshold: 0.4 }, { type: 'sourceKind', value: 'ability' }],
      },
    })
  })

  it("models Horizon Focus's Hypershot as a toggled +10% damage amp", () => {
    const horizon = STARTER_ITEMS.find((item) => item.id === 'horizon-focus')!
    expect(horizon.stats).toEqual({ ap: 80, abilityHaste: 25 })
    expect(horizon.effects).toHaveLength(1)
    expect(horizon.effects[0]).toMatchObject({
      kind: 'damageAmp', amount: 0.1, support: 'partial',
      condition: { type: 'toggle', inputId: 'horizon-focus-hypershot' },
    })
    expect(horizon.effects[0].inputs).toEqual([{
      type: 'boolean', id: 'horizon-focus-hypershot', label: 'Horizon Focus Hypershot active', default: false,
    }])
  })

  it("models Malignance's ultimate haste and its ultimate-triggered, MR-shredding burn", () => {
    const malignance = STARTER_ITEMS.find((item) => item.id === 'malignance')!
    expect(malignance.stats).toEqual({ ap: 90, mana: 500, abilityHaste: 15, ultimateHaste: 20 })
    expect(malignance.effects).toHaveLength(1)
    expect(malignance.effects[0]).toMatchObject({
      kind: 'dot', damageType: 'magic', tickAmount: 60, ratios: [{ stat: 'ap', value: 0.05 }],
      tickIntervalSeconds: 1, durationSeconds: 3, condition: { type: 'abilitySlot', value: 'r' },
      shredWhileActive: { resist: 'mr', amount: 10 }, support: 'partial',
    })
  })

  it("models Stormsurge's Squall as a damage-window proc", () => {
    const stormsurge = STARTER_ITEMS.find((item) => item.id === 'stormsurge')!
    expect(stormsurge.stats).toEqual({ ap: 90, moveSpeedPct: 0.06, flatMagicPen: 15 })
    expect(stormsurge.effects).toHaveLength(1)
    expect(stormsurge.effects[0]).toMatchObject({
      kind: 'damageWindowProc', targetMaxHpFraction: 0.25, windowSeconds: 2.5, delaySeconds: 2,
      damageType: 'magic', damage: 125, ratios: [{ stat: 'ap', value: 0.1 }], cooldownSeconds: 25,
      support: 'partial',
    })
  })

  it("models Blackfire Torch's 0.5s burn and its +4% AP while the target burns", () => {
    const torch = STARTER_ITEMS.find((item) => item.id === 'blackfire-torch')!
    expect(torch.stats).toEqual({ ap: 80, mana: 500, abilityHaste: 20 })
    expect(torch.effects).toHaveLength(2)
    expect(torch.effects[0]).toMatchObject({
      kind: 'dot', damageType: 'magic', tickAmount: 10, ratios: [{ stat: 'ap', value: 0.01 }],
      tickIntervalSeconds: 0.5, durationSeconds: 3, refresh: 'refresh',
    })
    expect(torch.effects[1]).toMatchObject({
      kind: 'statMultiplier', stat: 'ap', layer: 'total', amount: 0.04,
      condition: { type: 'targetHasDot', effectId: 'blackfire-torch-baleful-blaze' },
    })
  })

  it("models Liandry's Torment's max-HP burn and Madness", () => {
    const liandrys = STARTER_ITEMS.find((item) => item.id === 'liandrys-torment')!
    expect(liandrys.effects).toHaveLength(2)
    expect(liandrys.effects[0]).toMatchObject({
      kind: 'dot', damageType: 'magic', tickAmount: 0, targetMaxHpRatio: 0.01,
      tickIntervalSeconds: 0.5, durationSeconds: 3, refresh: 'refresh',
    })
    expect(liandrys.effects[1]).toMatchObject({
      kind: 'combatRampAmp', amountPerStack: 0.02, stackIntervalSeconds: 1, maxStacks: 3,
    })
  })

  it("reads base AD for Trinity Force's and Lich Bane's spellblades", () => {
    const trinity = STARTER_ITEMS.find((item) => item.id === 'trinity-force')!
    expect(trinity.effects[0]).toMatchObject({
      kind: 'spellblade', damageType: 'physical', bonusDamage: 0,
      ratios: [{ stat: 'ad', layer: 'base', value: 2 }], internalCooldownSeconds: 1.5,
    })
    const lichBane = STARTER_ITEMS.find((item) => item.id === 'lich-bane')!
    expect(lichBane.effects).toHaveLength(1)
    expect(lichBane.effects[0]).toMatchObject({
      kind: 'spellblade', damageType: 'magic', bonusDamage: 0,
      ratios: [{ stat: 'ad', layer: 'base', value: 0.75 }, { stat: 'ap', value: 0.45 }],
      internalCooldownSeconds: 1.5,
    })
  })

  it("gives Annie Riftmaker's AP from bonus HP before Rabadon's multiplies it (582 AP in game)", () => {
    const annie = PATCH_7_3_CHAMPIONS.find((champion) => champion.id === 'annie')!
    const build = {
      items: ['rabadons-deathcap', 'void-staff', 'zhonyas-hourglass', 'riftmaker'],
      boots: 'spellslingers-shoes', runes: [], inputs: {},
    }
    const sheet = resolveStats(annie, 15, build, buildCatalog(PATCH_7_3_ITEMS))
    expect(sheet.bonus.hp).toBe(350)
    expect(sheet.total.ap).toBeCloseTo((440 + 7) * 1.3, 6)
  })

  it("models Riftmaker's Void Corruption as a 4-stack combat ramp", () => {
    const riftmaker = STARTER_ITEMS.find((item) => item.id === 'riftmaker')!
    expect(riftmaker.effects).toHaveLength(2)
    expect(riftmaker.effects[0]).toMatchObject({
      kind: 'statConversion', fromStat: 'hp', fromLayer: 'bonus', toStat: 'ap', ratio: 0.02,
    })
    expect(riftmaker.effects[1]).toMatchObject({
      kind: 'combatRampAmp', amountPerStack: 0.02, stackIntervalSeconds: 1, maxStacks: 4,
    })
  })

  it("ramps Annie's Q through Void Corruption's stacks as measured (541, 562, 573, 584)", () => {
    const annie = PATCH_7_3_CHAMPIONS.find((champion) => champion.id === 'annie')!
    const build = {
      items: ['rabadons-deathcap', 'void-staff', 'zhonyas-hourglass', 'riftmaker'],
      boots: 'spellslingers-shoes', runes: [], inputs: {},
    }
    const attacker = combatantFromChampion(annie, 15, build, buildCatalog(PATCH_7_3_ITEMS))
    const target = combatantFromDummy({ kind: 'dummy', hp: 10000, armor: 100, mr: 100 })
    // Cooldowns are ignored so Q can land at 2, 3 and 4 stacks; the +2% stack is never reachable
    // in game, since it lasts only the first second of combat.
    const result = simulateCombo(
      attacker, target, ['Q', 'wait:1', 'Q', 'wait:1', 'Q', 'wait:1', 'Q'], { ignoreCooldowns: true }
    )
    expect(result.instances.map((instance) => Math.ceil(instance.mitigated))).toEqual([541, 562, 573, 584])
  })

  it("gives Annie Archangel's Staff's AP from max mana before Rabadon's multiplies it (582 AP in game)", () => {
    const annie = PATCH_7_3_CHAMPIONS.find((champion) => champion.id === 'annie')!
    const build = {
      items: ['rabadons-deathcap', 'void-staff', 'zhonyas-hourglass', 'archangels-staff'],
      boots: 'spellslingers-shoes', runes: [], inputs: {},
    }
    const sheet = resolveStats(annie, 15, build, buildCatalog(PATCH_7_3_ITEMS))
    expect(sheet.total.mana).toBe(1733)
    expect(sheet.total.ap).toBeCloseTo((430 + 17.33) * 1.3, 6)
  })

  it("adds 14 mana per Archangel's Staff Mana Charge stack, up to 700", () => {
    const annie = PATCH_7_3_CHAMPIONS.find((champion) => champion.id === 'annie')!
    const catalog = buildCatalog(PATCH_7_3_ITEMS)
    const build = (stacks: number) => ({
      items: ['archangels-staff'], runes: [],
      inputs: { 'archangels-staff-mana-charge': stacks },
    })
    expect(resolveStats(annie, 15, build(10), catalog).total.mana).toBe(1733 + 140)
    expect(resolveStats(annie, 15, build(50), catalog).total.mana).toBe(1733 + 700)
  })

  it("models Nashor's Tooth's on-hit as 15 + 20% AP magic damage", () => {
    const nashors = STARTER_ITEMS.find((item) => item.id === 'nashors-tooth')!
    expect(nashors.effects).toHaveLength(1)
    expect(nashors.effects[0]).toMatchObject({
      kind: 'onHit', damageType: 'magic', flat: 15, pctOwnStat: { stat: 'ap', ratio: 0.2 },
    })
  })

  it("models Bloodletter's Curse's Vile Decay as a stacking 7.5% magic resist shred on magic damage", () => {
    const bloodletters = STARTER_ITEMS.find((item) => item.id === 'bloodletters-curse')!
    expect(bloodletters.effects).toHaveLength(1)
    expect(bloodletters.effects[0]).toMatchObject({
      kind: 'resistShred', resist: 'mr', mode: 'percent', amount: 0.075, stacking: true,
      maxStacks: 4, durationSeconds: 6, condition: { type: 'damageType', value: 'magic' },
    })
  })

  it("models Hextech Rocketbelt's bolts as one full hit plus six at 10%", () => {
    const rocketbelt = STARTER_ITEMS.find((item) => item.id === 'hextech-rocketbelt')!
    expect(rocketbelt.effects).toHaveLength(1)
    expect(rocketbelt.effects[0]).toMatchObject({
      kind: 'active', damageType: 'magic', damage: 100, ratios: [{ stat: 'ap', value: 0.1 }],
      extraHits: { count: 6, fraction: 0.1 }, cooldownSeconds: 30,
    })
  })

  it("gives Annie Seraph's Embrace's AP from 2% of max mana (623 AP in game at 2433 mana)", () => {
    const annie = PATCH_7_3_CHAMPIONS.find((champion) => champion.id === 'annie')!
    const build = {
      items: ['rabadons-deathcap', 'void-staff', 'zhonyas-hourglass', 'seraphs-embrace'],
      boots: 'spellslingers-shoes', runes: [], inputs: {},
    }
    const sheet = resolveStats(annie, 15, build, buildCatalog(PATCH_7_3_ITEMS))
    expect(sheet.total.mana).toBe(2433)
    expect(sheet.total.ap).toBeCloseTo((430 + 48.66) * 1.3, 6)
  })

  it("models Seraph's Embrace's Lifeline as a 16% max mana shield for 2 seconds", () => {
    const seraphs = STARTER_ITEMS.find((item) => item.id === 'seraphs-embrace')!
    expect(seraphs.effects[1]).toMatchObject({
      kind: 'shield', amount: 0, durationSeconds: 2, ratios: [{ stat: 'mana', value: 0.16 }],
    })
  })

  it('declares the Force of Nature max-stacks input once, shared by both Steadfast effects', () => {
    const forceOfNature = STARTER_ITEMS.find((item) => item.id === 'force-of-nature')!
    const stackingEffects = forceOfNature.effects.filter(
      (effect): effect is Extract<typeof effect, { kind: 'stacking' }> => effect.kind === 'stacking'
    )
    expect(stackingEffects).toHaveLength(2)
    for (const effect of stackingEffects) {
      expect(effect.stackInputId, effect.id).toBe('force-of-nature-max-stacks')
    }
    const declaringEffects = stackingEffects.filter(
      (effect) => effect.inputs?.some((input) => input.id === 'force-of-nature-max-stacks')
    )
    expect(declaringEffects).toHaveLength(1)
  })
})

describe('PATCH_7_3_ITEMS', () => {
  it('is every generated item plus seraphs-embrace, with unique ids', () => {
    const ids = PATCH_7_3_ITEMS.map((item) => item.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toHaveLength(GENERATED_ITEMS.length + 1)
    expect(ids).toContain('seraphs-embrace')
  })

  it('uses the starter item wherever one exists', () => {
    for (const starter of STARTER_ITEMS) {
      // Grouped items are copies carrying their exclusiveGroup, so compare fields, not identity.
      expect(PATCH_7_3_ITEMS.find((item) => item.id === starter.id), starter.id).toMatchObject(starter)
    }
  })

  it('every item parses against ItemSchema', () => {
    for (const item of PATCH_7_3_ITEMS) expect(() => ItemSchema.parse(item), item.id).not.toThrow()
  })

  it('every recipe resolves and combine + component totals equals the item total', () => {
    const byId = new Map(PATCH_7_3_ITEMS.map((item) => [item.id, item]))
    for (const item of PATCH_7_3_ITEMS) {
      const components = item.recipe.map((id) => byId.get(id))
      expect(components.every((component) => component !== undefined), item.id).toBe(true)
      const componentTotal = components.reduce((sum, component) => sum + (component?.cost.total ?? 0), 0)
      expect(item.cost.combine + componentTotal, item.id).toBe(item.cost.total)
    }
  })
})

describe('7.3 exclusive item groups', () => {
  const groupOf = (id: string) => PATCH_7_3_ITEMS.find((item) => item.id === id)!.exclusiveGroup
  const membersOf = (group: string) =>
    PATCH_7_3_ITEMS.filter((item) => item.exclusiveGroup === group).map((item) => item.id).sort()

  it('allows one Tear of the Goddess item', () => {
    expect(membersOf('tear')).toEqual([
      'archangels-staff', 'manamune', 'seraphs-embrace', 'tear-of-the-goddess', 'whispering-circlet',
      'winters-approach',
    ])
  })

  it('allows one active item', () => {
    expect(membersOf('active-item')).toEqual([
      'galeforce', 'gargoyle-stoneplate', 'goredrinker', 'hextech-rocketbelt',
      'locket-of-the-iron-solari', 'mercurial-scimitar', 'mikaels-blessing', 'quicksilver-sash',
      'redemption', 'seekers-armguard', 'shurelyas-battlesong', 'stridebreaker', 'zhonyas-hourglass',
    ])
  })

  it('allows one armor pen or shred item', () => {
    expect(membersOf('armor-pen')).toEqual([
      'black-cleaver', 'dominiks-regards', 'last-whisper', 'mortal-reminder', 'seryldas-grudge',
      'terminus',
    ])
  })

  it('allows one magic pen or shred item', () => {
    expect(membersOf('magic-pen')).toEqual([
      'bloodletters-curse', 'cryptbloom', 'void-amethyst', 'void-staff',
    ])
  })

  it('allows one Lifeline item', () => {
    expect(membersOf('lifeline')).toEqual(['maw-of-malmortius', 'steraks-gage'])
  })

  it('leaves pen boots out of the pen groups', () => {
    expect(groupOf('spellslingers-shoes')).toBeUndefined()
    expect(groupOf('armorcrusher-boots')).toBeUndefined()
  })

  it('rejects a build holding two items from one group', () => {
    const annie = PATCH_7_3_CHAMPIONS.find((champion) => champion.id === 'annie')!
    const catalog = buildCatalog(PATCH_7_3_ITEMS)
    const build = (items: string[]) => ({ items, runes: [], inputs: {} })
    expect(() => resolveStats(annie, 15, build(['void-staff', 'bloodletters-curse']), catalog))
      .toThrow(/magic-pen/)
    expect(() => resolveStats(annie, 15, build(['zhonyas-hourglass', 'hextech-rocketbelt']), catalog))
      .toThrow(/active-item/)
    expect(() => resolveStats(
      annie, 15, { ...build(['void-staff']), boots: 'spellslingers-shoes' }, catalog
    )).not.toThrow()
  })
})
