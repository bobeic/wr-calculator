import type { Item, Provenance, StatKey } from '@wr-calc/schema'
import type { RawItem } from './raw-schemas'
import { normalizeId } from './ids'
import { round } from './parse-ability'

export interface Mapped<T> {
  value: T
  notes: string[]
}

// scale 0.01 = the site gives a percentage; this repo stores fractions.
const STAT_MAP: Record<string, { key: StatKey; scale: number } | undefined> = {
  attackDamage: { key: 'ad', scale: 1 },
  abilityPower: { key: 'ap', scale: 1 },
  health: { key: 'hp', scale: 1 },
  armor: { key: 'armor', scale: 1 },
  magicResist: { key: 'mr', scale: 1 },
  abilityHaste: { key: 'abilityHaste', scale: 1 },
  mana: { key: 'mana', scale: 1 },
  moveSpeed: { key: 'moveSpeed', scale: 1 },
  armorPen: { key: 'flatArmorPen', scale: 1 },
  magicPen: { key: 'flatMagicPen', scale: 1 },
  attackSpeed: { key: 'attackSpeed', scale: 0.01 },
  criticalRate: { key: 'critChance', scale: 0.01 },
  moveSpeedPercent: { key: 'moveSpeedPct', scale: 0.01 },
  armorPenPercent: { key: 'pctArmorPen', scale: 0.01 },
  magicPenPercent: { key: 'pctMagicPen', scale: 0.01 },
  lifeSteal: { key: 'lifesteal', scale: 0.01 },
  healShieldPower: { key: 'healShieldPower', scale: 0.01 },
  tenacity: { key: 'tenacity', scale: 0.01 },
}
const PERCENT_OF_BASE_REGEN = new Set(['healthRegen', 'manaRegen'])
const TIER_MAP: Record<string, Item['tier'] | undefined> = {
  basic: 'basic', intermediate: 'epic', upgraded: 'legendary',
}

/** Maps wrpocket numeric_stats onto this repo's stat keys, noting every key it had to skip. */
export function mapItemStats(raw: Record<string, number>): Mapped<Item['stats']> {
  const stats: Item['stats'] = {}
  const notes: string[] = []
  for (const [key, amount] of Object.entries(raw)) {
    const mapping = STAT_MAP[key]
    if (mapping) stats[mapping.key] = round(amount * mapping.scale)
    else if (PERCENT_OF_BASE_REGEN.has(key)) {
      notes.push(`stat '${key}' (${amount}) skipped: it is a % of base regen, but hpRegen/manaRegen here are flat`)
    } else notes.push(`unknown stat '${key}' (${amount}) skipped`)
  }
  return { value: stats, notes }
}

function tierOf(raw: RawItem, notes: string[]): Item['tier'] {
  if (raw.category.en === 'Boots') return 'boots'
  if (raw.category.en === 'Support') return 'support'
  const tier = TIER_MAP[raw.tier]
  if (tier) return tier
  notes.push(`unknown tier '${raw.tier}', treated as legendary`)
  return 'legendary'
}

// "Name:", "Name (Active):" or "UNIQUE - Name:" at the start of a description line; up to four words.
const PASSIVE_NAME = /^(?:UNIQUE\s*-\s*)?([A-Z][A-Za-z'’]*(?:[ -][A-Za-z'’]+){0,3})(?:\s*\((?:Active|Passive)\))?:\s/

/** The named passives and actives in an item description, in order and without repeats. */
export function passiveNames(description: string): string[] {
  const names: string[] = []
  for (const line of description.split('\n')) {
    const name = PASSIVE_NAME.exec(line.trim())?.[1]
    if (name !== undefined && !names.includes(name)) names.push(name)
  }
  return names
}

/** Maps one wrpocket item to an Item with no modeled effects, noting anything it had to guess or skip. */
export function mapItem(raw: RawItem, rawPrices: Map<string, number>, provenance: Provenance): Mapped<Item> {
  const total = Number(raw.price)
  if (raw.price.trim() === '' || !Number.isFinite(total)) {
    throw new Error(`${raw.id}: price '${raw.price}' is not a number`)
  }
  const notes: string[] = []
  const tier = tierOf(raw, notes)

  let combine = total
  const unknown = raw.components.find((id) => !rawPrices.has(id))
  if (unknown !== undefined) {
    notes.push(`unknown component '${unknown}'; combine set to total`)
  } else {
    const componentTotal = raw.components.reduce((sum, id) => sum + (rawPrices.get(id) ?? 0), 0)
    combine = total - componentTotal
    if (combine < 0) {
      notes.push(`components cost ${componentTotal}, more than the item (${total}); combine set to 0`)
      combine = 0
    }
  }

  const stats = mapItemStats(raw.numeric_stats)
  const passives = passiveNames(raw.description.en)
  return {
    value: {
      id: normalizeId(raw.id), name: raw.name.en, tier,
      cost: { total, combine }, recipe: raw.components.map(normalizeId),
      stats: stats.value, effects: [], tags: [raw.category.en.toLowerCase()],
      ...(passives.length > 0 ? { uniquePassives: passives } : {}),
      provenance,
    },
    notes: [...notes, ...stats.notes],
  }
}
