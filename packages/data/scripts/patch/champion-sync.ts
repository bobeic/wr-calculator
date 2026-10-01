import type { Champion } from '@wr-calc/schema'
import type { ChampionLinks, ChampionValue } from '../../src/patches/champion-links'
import type { ChampionUpdate } from '../../src/patches/overlay'
import { MISSING } from './diff'
import { maskNumbers, numberSpans } from './text-sync'
import type { FieldChange } from './types'

/** The per-rank numbers in a scaling row: '60/80/100/120' -> [60, 80, 100, 120], '4%/5%' -> [4, 5]. */
export function parseRanks(row: string): number[] {
  return row.split('/').map((part) => Number(part.replace(/[%\s,]/g, '')))
}

const defaultValue = (ranks: number[]): ChampionValue => ({ byRank: ranks })

/** Reads the value at a path in the champion; undefined when it isn't a number or { byRank }. */
export function championValue(champion: Champion, path: string): ChampionValue | undefined {
  const value = path.replace(/\[(\d+)\]/g, '.$1').split('.')
    .reduce<unknown>((node, key) => (typeof node === 'object' && node !== null ? (node as Record<string, unknown>)[key] : undefined), champion)
  if (typeof value === 'number') return value
  if (typeof value === 'object' && value !== null && 'byRank' in value) return { byRank: (value as { byRank: number[] }).byRank }
  return undefined
}

const close = (a: number, b: number): boolean => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b))
export function sameValue(a: ChampionValue | undefined, b: ChampionValue | undefined): boolean {
  if (a === undefined || b === undefined) return false
  if (typeof a === 'number' || typeof b === 'number') return typeof a === 'number' && typeof b === 'number' && close(a, b)
  return a.byRank.length === b.byRank.length && a.byRank.every((value, index) => close(value, b.byRank[index]))
}

export type ChampionCheck =
  | { ok: true; updates: ChampionUpdate[]; changedNumbers: string[] }
  | { ok: false; reason: string }

/**
 * Decides whether a hand-modelled champion's changes apply without a hand edit, and the updates they make. Base stat
 * changes are synced by the overlay. A changed scaling row must be linked or ignored; a linked row's old value must
 * equal the model. An ability description may change only in numbers that appear in the changed rows' new values.
 * Anything else (a name, a wording change, an unlinked row) fails.
 */
export function checkChampion(championId: string, changes: FieldChange[], links: ChampionLinks | undefined, model: Champion): ChampionCheck {
  const updates: ChampionUpdate[] = []
  const rowNumbers = new Set<string>()
  const changedNumbers: string[] = []
  for (const change of changes) {
    if (!change.field.includes('.scaling.')) continue
    if (change.before === MISSING || change.after === MISSING) return { ok: false, reason: `${change.field} was added or removed` }
    const before = parseRanks(change.before)
    const after = parseRanks(change.after)
    if (before.length !== after.length || [...before, ...after].some(Number.isNaN)) return { ok: false, reason: `${change.field} changed shape` }
    after.forEach((value, index) => {
      const text = String(value)
      rowNumbers.add(text)
      if (!close(value, before[index])) changedNumbers.push(text)
    })
    const linked = (links?.links ?? []).filter((link) => link.row === change.field)
    if (linked.length === 0) {
      if (links?.ignore.includes(change.field)) continue
      return { ok: false, reason: `no link for ${change.field}` }
    }
    for (const link of linked) {
      const toValue = link.value ?? defaultValue
      const current = championValue(model, link.path)
      if (!sameValue(current, toValue(before))) {
        return { ok: false, reason: `link ${link.path}: the old row gives ${JSON.stringify(toValue(before))}, the model has ${JSON.stringify(current)}` }
      }
      updates.push({ championId, path: link.path, value: toValue(after), note: `${change.field}: ${change.before} -> ${change.after}` })
    }
  }
  for (const change of changes) {
    if (change.field.includes('.scaling.') || change.field.startsWith('stats.')) continue
    if (!change.field.endsWith('.description')) return { ok: false, reason: `${change.field} changed` }
    if (maskNumbers(change.before) !== maskNumbers(change.after)) return { ok: false, reason: `${change.field}: the wording changed, not only numbers` }
    const spansBefore = numberSpans(change.before)
    const moved = numberSpans(change.after).filter((span, index) => span.text !== spansBefore[index].text)
    const unexplained = moved.filter((span) => !rowNumbers.has(span.text))
    if (unexplained.length > 0) {
      return { ok: false, reason: `${change.field}: ${unexplained.map((span) => span.text).join(', ')} is not in a changed scaling row` }
    }
  }
  return { ok: true, updates, changedNumbers }
}
