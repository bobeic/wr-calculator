import { z } from 'zod'
import type { CnChange, LiveStatus } from '../../src/cn-preview/types'
import { normalizeId } from '../../src/wrpocket-ids'
import type { Snapshot, SnapshotItem } from '../patch/snapshot'

/** One entry's fields as strings, so a diff is a plain key comparison. */
export type Flat = Record<string, Record<string, string>>

export const RawEquipSchema = z.object({
  version: z.string(), fileTime: z.string(),
  equipList: z.array(z.object({ equipId: z.string(), name: z.string(), price: z.string(), from: z.array(z.string()) }).passthrough()),
}).passthrough()
const RawSpellSchema = z.object({ spellKey: z.string(), costvalue: z.string().nullable().optional() }).passthrough()
export const RawHeroSchema = z.object({
  version: z.string(), fileTime: z.string(),
  hero: z.object({ heroId: z.string(), name: z.string() }).passthrough(),
  spells: z.array(RawSpellSchema),
}).passthrough()
export type RawEquip = z.infer<typeof RawEquipSchema>
export type RawHero = z.infer<typeof RawHeroSchema>

// Tencent item stat -> wrpocket numeric_stats key and divisor (fitted 2026-10-02: every mapped stat of every shared
// item agreed). Unlisted stats are still tracked, divided by 10000, but can't be checked against live data.
export const ITEM_STATS: Record<string, [string, number]> = {
  ad: ['attackDamage', 10000], magicAttack: ['abilityPower', 10000], hp: ['health', 10000], mp: ['mana', 10000],
  armor: ['armor', 10000], magicBlock: ['magicResist', 10000], armorPene: ['armorPen', 10000],
  magicPene: ['magicPen', 10000], attackSpeed: ['attackSpeed', 100], critRate: ['criticalRate', 100],
  moveRate: ['moveSpeedPercent', 100], moveSpeed: ['moveSpeed', 100], mpRegen: ['manaRegen', 100],
  hpRegen: ['healthRegen', 100], armorPeneRate: ['armorPenPercent', 100], magicPeneRate: ['magicPenPercent', 100],
  ductRate: ['tenacity', 100],
}
const NOT_STATS = new Set(['equipId', 'name', 'iconPath', 'from', 'type', 'level', 'price', 'description', 'composeLevel',
  'into', 'tags', 'unName', 'searchKey'])
const HERO_STATS = ['attack', 'magic', 'hp', 'hpperlevel', 'mp', 'mpperlevel', 'movespeed', 'armor', 'armorperlevel',
  'spellblock', 'spellblockperlevel', 'hpregen', 'hpregenperlevel', 'mpregen', 'mpregenperlevel', 'crit', 'attackspeed',
  'attackspeedperlevel']
/** Spells come passive first, then Q, W, E, R (checked on Sett and Senna, 2026-10-02). */
export const SLOTS = ['p', 'q', 'w', 'e', 'r']

const num = (raw: unknown, divisor: number): string => String(Number(raw) / divisor)

/** Flattens Tencent's items and heroes. `itemIds`/`championIds` map Tencent ids to ours. */
export function flatten(
  equip: RawEquip, heroes: readonly RawHero[], itemIds: ReadonlyMap<string, string>, championIds: ReadonlyMap<string, string>,
): Flat {
  const flat: Flat = {}
  const itemKey = (equipId: string): string => `item:${itemIds.get(equipId) ?? `cn-${equipId}`}`
  for (const item of equip.equipList) {
    const fields: Record<string, string> = { name: item.name, price: item.price, from: item.from.map((id) => itemKey(id).slice(5)).sort().join(',') }
    for (const [key, value] of Object.entries(item)) {
      if (NOT_STATS.has(key) || Number(value) === 0 || !Number.isFinite(Number(value))) continue
      fields[`stat.${key}`] = num(value, ITEM_STATS[key]?.[1] ?? 10000)
    }
    flat[itemKey(item.equipId)] = fields
  }
  for (const { hero, spells } of heroes) {
    const fields: Record<string, string> = { name: hero.name }
    for (const key of HERO_STATS) if (hero[key] !== undefined) fields[`base.${key}`] = num(hero[key], key === 'movespeed' ? 100 : 10000)
    spells.forEach((spell, index) => {
      const slot = SLOTS[index] ?? `s${index}`
      if (spell.costvalue != null && spell.costvalue !== '0') fields[`${slot}.cost`] = spell.costvalue
      for (let row = 1; row <= 20; row++) {
        const type = spell[`variType${row}`]
        const value = spell[`variValue${row}`]
        if (typeof type === 'string' && type !== '' && type !== 'None' && typeof value === 'string') fields[`${slot}.${type}`] = value
      }
    })
    flat[`champion:${championIds.get(hero.heroId) ?? `cn-${hero.heroId}`}`] = fields
  }
  return flat
}

/** Our live value for a field, or null when the field can't be compared. */
export type LiveLookup = (entry: string, field: string) => string | null

export function liveStatus(lookup: LiveLookup, entry: string, field: string, cnValue: string): LiveStatus {
  const live = lookup(entry, field)
  if (live === null) return 'unknown'
  return live === cnValue ? 'live' : 'cn-only'
}

/** Every field that differs between two flattened feeds. */
export function diffFlat(before: Flat, after: Flat, lookup: LiveLookup): CnChange[] {
  const changes: CnChange[] = []
  for (const entry of [...new Set([...Object.keys(before), ...Object.keys(after)])].sort()) {
    const a = before[entry] ?? {}
    const b = after[entry] ?? {}
    const name = b.name ?? a.name ?? entry
    for (const field of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
      if (field === 'name' || a[field] === b[field]) continue
      changes.push({ entry, name, field, before: a[field] ?? '', after: b[field] ?? '', live: liveStatus(lookup, entry, field, b[field] ?? '') })
    }
  }
  return changes
}

/** Fields where CN's current value disagrees with a known live value (`before` = live, `after` = CN). */
export function differsNow(current: Flat, lookup: LiveLookup): CnChange[] {
  const changes: CnChange[] = []
  for (const [entry, fields] of Object.entries(current).sort(([a], [b]) => a.localeCompare(b))) {
    for (const [field, value] of Object.entries(fields)) {
      if (field === 'name') continue
      const live = lookup(entry, field)
      if (live !== null && live !== value) changes.push({ entry, name: fields.name ?? entry, field, before: live, after: value, live: 'cn-only' })
    }
  }
  return changes
}

/** A wrpocket item's value for one of Tencent's item fields, as flatten writes it; null when it can't be compared. */
export function itemField(item: SnapshotItem, field: string): string | null {
  if (field === 'price') return item.price
  if (field === 'from') return item.components.map(normalizeId).sort().join(',')
  const stat = ITEM_STATS[field.replace(/^stat\./, '')]
  return field.startsWith('stat.') && stat !== undefined ? String(item.numeric_stats[stat[0]] ?? 0) : null
}

/**
 * Item fields that wrpocket changed between two snapshots onto exactly CN's current value (`before` = old global,
 * `after` = new global = CN). wrpocket copies Tencent's item feed, so when CN patches first these may be CN numbers
 * imported as global.
 */
export function cnLeaks(before: Snapshot, after: Snapshot, cn: Flat): CnChange[] {
  const old = new Map(before.items.map((item) => [normalizeId(item.id), item]))
  const leaks: CnChange[] = []
  for (const item of after.items) {
    const id = normalizeId(item.id)
    const previous = old.get(id)
    const fields = cn[`item:${id}`]
    if (previous === undefined || fields === undefined) continue
    for (const [field, cnValue] of Object.entries(fields)) {
      const was = itemField(previous, field)
      const now = itemField(item, field)
      if (was !== null && now !== was && now === cnValue) leaks.push({ entry: `item:${id}`, name: item.name.en, field, before: was, after: now, live: 'live' })
    }
  }
  return leaks
}
