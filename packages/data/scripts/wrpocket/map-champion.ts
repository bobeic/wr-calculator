import type {
  Ability, Champion, DamageComponent, NullableScalar, Provenance,
} from '@wr-calc/schema'
import { MAX_CHAMPION_LEVEL } from '@wr-calc/calc'
import type { RawAbility, RawChampion } from './raw-schemas'
import { normalizeId } from './ids'
import {
  damageTypesIn, findTextDamage, parseRanks, parseRatios, round, toScalar,
} from './parse-ability'
import type { Mapped } from './map-item'

type AbilitySlot = keyof Champion['abilities']
type BaseStatKey = keyof Champion['baseStats']

export const SLOTS: Array<[AbilitySlot, string]> = [
  ['passive', 'パッシブ'], ['q', 'スキル1'], ['w', 'スキル2'], ['e', 'スキル3'], ['r', 'アルティメット'],
]
export const STAT_COLUMNS: Array<[BaseStatKey, string]> = [
  ['hp', '体力'], ['hpRegen', '体力自動回復'], ['mana', 'マナ'], ['manaRegen', 'マナ自動回復'],
  ['armor', '物理防御'], ['mr', '魔法防御'], ['ad', '攻撃力'], ['moveSpeed', '移動速度'],
]
export const ATTACK_SPEED_COLUMN = '攻撃速度'
const MANA_KEYS: ReadonlySet<BaseStatKey> = new Set<BaseStatKey>(['mana', 'manaRegen'])
// Deviation from a straight line (in stat points) beyond which the site's table is reported as non-linear.
const LINEARITY_TOLERANCE = 1

/** Fits { base, perLevel } so levels 1 and MAX_CHAMPION_LEVEL are exact. */
export function fitGrowth(level1: number, levelMax: number): { base: number; perLevel: number } {
  return { base: level1, perLevel: round((levelMax - level1) / (MAX_CHAMPION_LEVEL - 1)) }
}

/** Fits { base, ratio } so attack speed at levels 1 and MAX_CHAMPION_LEVEL is exact. */
export function fitAttackSpeed(level1: number, levelMax: number): { base: number; ratio: number } {
  return { base: level1, ratio: round((levelMax / level1 - 1) / (MAX_CHAMPION_LEVEL - 1)) }
}

function levelValue(raw: RawChampion, level: number, column: string): number {
  const value = raw.stats[`レベル${level}`]?.[column]
  if (typeof value !== 'number') throw new Error(`${raw.id}: missing ${column} at level ${level}`)
  return value
}

function linearityNotes(raw: RawChampion, key: string, column: string): string[] {
  const first = levelValue(raw, 1, column)
  const step = (levelValue(raw, MAX_CHAMPION_LEVEL, column) - first) / (MAX_CHAMPION_LEVEL - 1)
  const notes: string[] = []
  for (let level = 2; level < MAX_CHAMPION_LEVEL; level++) {
    const actual = levelValue(raw, level, column)
    const off = round(actual - (first + step * (level - 1)))
    if (Math.abs(off) > LINEARITY_TOLERANCE) {
      notes.push(`${key}: level ${level} is ${actual}, ${Math.abs(off)} off a straight line from level 1 to 15`)
    }
  }
  return notes
}

function scaling(raw: RawAbility, type: string): number[] | null {
  const entry = raw.scaling.find((candidate) => candidate.type === type)
  return entry ? parseRanks(entry.value) : null
}

function sameValues(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index])
}

function mapDamage(slot: AbilitySlot, raw: RawAbility, notes: string[]): DamageComponent[] {
  const text = raw.description.en
  const found = findTextDamage(text)
  if (found) {
    const table = scaling(raw, found.isRangeUpperBound ? '最大基础伤害' : '基础伤害')
    let base = found.base
    if (table && table.length > 1) {
      if (base.length === 1 && table[0] === base[0]) base = table
      else if (!sameValues(base, table)) {
        notes.push(`${slot}: text damage ${base.join('/')} conflicts with table ${table.join('/')}; used text`)
      }
    }
    if (found.isRangeUpperBound) notes.push(`${slot}: damage is a range; modeled the upper bound`)
    if (damageTypesIn(text).length > 1) {
      notes.push(`${slot}: text names several damage types; only the first damage phrase is modeled`)
    }
    if (found.formulaSnippet) {
      notes.push(`${slot}: damage looks like a formula ('${found.formulaSnippet}'); base may be wrong`)
    }
    if (found.perHitSnippet) {
      notes.push(`${slot}: damage is per second/hit ('${found.perHitSnippet}'); modeled as one hit`)
    }
    const ratios = parseRatios(found.ratioGroup)
    ratios.unparsed.forEach((part) => notes.push(`${slot}: unparsed ratio '${part}'`))
    return [{ type: found.type, base: toScalar(base), ratios: ratios.ratios, tags: [] }]
  }

  const table = scaling(raw, '基础伤害')
  if (!table) return []
  const types = damageTypesIn(text)
  if (types.length === 1) {
    notes.push(`${slot}: base damage from the table; no ratio found in the text`)
    return [{ type: types[0], base: toScalar(table), ratios: [], tags: [] }]
  }
  notes.push(`${slot}: table has base damage but the text names ${types.length} damage types; damage not modeled`)
  return []
}

/** Notes when a byRank scalar's array length doesn't match the ability's maxRank. */
function noteRankMismatch(
  slot: AbilitySlot, field: string, scalar: NullableScalar | undefined, maxRank: number, notes: string[],
): void {
  if (scalar && typeof scalar === 'object' && 'byRank' in scalar && scalar.byRank.length !== maxRank) {
    notes.push(`${slot}: ${field} has ${scalar.byRank.length} ranks but maxRank is ${maxRank}`)
  }
}

function mapAbility(championId: string, slot: AbilitySlot, raw: RawAbility, notes: string[]): Ability {
  const cooldown = scaling(raw, 'cd')
  const defaultRanks = slot === 'passive' ? 1 : slot === 'r' ? 3 : 4
  const maxRank = slot === 'passive' ? 1 : cooldown && cooldown.length > 1 ? cooldown.length : defaultRanks
  const damage = mapDamage(slot, raw, notes)
  const ability: Ability = {
    id: `${championId}-${slot}`,
    name: raw.name.en,
    maxRank,
    cooldown: cooldown ? toScalar(cooldown) : null,
    castTime: 0,
    damage,
    flags: {},
  }
  if (slot !== 'passive') {
    const cost = scaling(raw, 'MP')
    ability.cost = cost ? toScalar(cost) : null
    if (!cooldown) notes.push(`${slot}: no cooldown in the table`)
  }
  noteRankMismatch(slot, 'cooldown', ability.cooldown, maxRank, notes)
  noteRankMismatch(slot, 'cost', ability.cost, maxRank, notes)
  for (const component of damage) {
    noteRankMismatch(slot, 'base', component.base, maxRank, notes)
    for (const ratio of component.ratios) {
      noteRankMismatch(slot, `ratios.${ratio.stat}`, ratio.value, maxRank, notes)
    }
  }
  return ability
}

/** Maps one wrpocket champion to a Champion, noting every guess, conflict and skipped value. */
export function mapChampion(raw: RawChampion, provenance: Provenance): Mapped<Champion> {
  const id = normalizeId(raw.id)
  const notes: string[] = []

  const baseStats: Champion['baseStats'] = {}
  for (const [key, column] of STAT_COLUMNS) {
    const level1 = levelValue(raw, 1, column)
    const levelMax = levelValue(raw, MAX_CHAMPION_LEVEL, column)
    if (MANA_KEYS.has(key) && level1 === 0 && levelMax === 0) continue
    baseStats[key] = fitGrowth(level1, levelMax)
    notes.push(...linearityNotes(raw, key, column))
  }
  const attackSpeed = fitAttackSpeed(
    levelValue(raw, 1, ATTACK_SPEED_COLUMN), levelValue(raw, MAX_CHAMPION_LEVEL, ATTACK_SPEED_COLUMN),
  )

  const abilityFor = (slot: AbilitySlot, key: string): Ability => {
    const rawAbility = raw.abilities[key]
    if (!rawAbility) throw new Error(`${raw.id}: missing ability slot ${key}`)
    return mapAbility(id, slot, rawAbility, notes)
  }
  const abilities = Object.fromEntries(
    SLOTS.map(([slot, key]) => [slot, abilityFor(slot, key)]),
  ) as Champion['abilities']

  return {
    value: {
      id, name: raw.name.en,
      resource: levelValue(raw, 1, 'マナ') > 0 ? 'mana' : 'other',
      baseStats, attackSpeed, abilities, provenance,
    },
    notes,
  }
}
