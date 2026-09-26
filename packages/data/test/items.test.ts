import { describe, it, expect } from 'vitest'
import { ItemSchema } from '@wr-calc/schema'
import { PATCH_7_3_ITEMS, STARTER_ITEMS } from '../src/patches/7.3'
import { GENERATED_ITEMS } from '../src/patches/7.3/generated/items'

const STARTER_IDS = [
  'long-sword', 'bf-sword', 'blasting-wand', 'rabadons-deathcap', 'blade-of-the-ruined-king',
  'trinity-force', 'liandrys-torment', 'void-staff', 'black-cleaver', 'infinity-edge',
  'navori-quickblades', 'heartsteel', 'seraphs-embrace', 'plated-steelcaps', 'force-of-nature',
  'ludens-echo', 'infinity-orb',
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
  it('has exactly the 17 starter items', () => {
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
