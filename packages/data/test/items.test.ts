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
  'stormsurge', 'blackfire-torch', 'cryptbloom', 'lich-bane', 'riftmaker',
].sort()
// Seraph's Embrace isn't on wrpocket (it's Archangel's Staff's upgraded form), so its shield has no source values yet.
const ALLOWED_STARTER_NULLS = ['seraphs-embrace › effects[1].amount', 'seraphs-embrace › effects[1].durationSeconds']

function nullPaths(value: unknown, path: string, out: string[]): void {
  if (value === null) out.push(path)
  else if (Array.isArray(value)) value.forEach((element, index) => nullPaths(element, `${path}[${index}]`, out))
  else if (typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) nullPaths(child, `${path}.${key}`, out)
  }
}

describe('STARTER_ITEMS', () => {
  it('has exactly the 24 starter items', () => {
    expect(STARTER_ITEMS.map((item) => item.id).sort()).toEqual(STARTER_IDS)
  })

  it('has no null values except the documented Seraph shield', () => {
    const found: string[] = []
    for (const item of STARTER_ITEMS) {
      const paths: string[] = []
      nullPaths(item, '', paths)
      found.push(...paths.map((path) => `${item.id} ›${path.replace(/^\./, ' ')}`))
    }
    expect(found).toEqual(ALLOWED_STARTER_NULLS)
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

  it("can't hold Cryptbloom and Void Staff together", () => {
    const cryptbloom = STARTER_ITEMS.find((item) => item.id === 'cryptbloom')!
    const voidStaff = STARTER_ITEMS.find((item) => item.id === 'void-staff')!
    expect(cryptbloom.exclusiveGroup).toBeDefined()
    expect(cryptbloom.exclusiveGroup).toBe(voidStaff.exclusiveGroup)
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
      expect(PATCH_7_3_ITEMS.find((item) => item.id === starter.id), starter.id).toBe(starter)
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
