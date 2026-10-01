import type { Item } from '@wr-calc/schema'
import type { TextUpdate } from '../../src/patches/overlay'
import type { ItemTextLinks, TextLink } from '../../src/patches/text-links'

/** One number in a description, with its position. */
export interface NumberSpan {
  /** The number as written, thousands separators removed: '1200', '7.5'. */
  text: string
  value: number
  start: number
  end: number
}

/** Every number in a text, in order. */
export function numberSpans(text: string): NumberSpan[] {
  return [...text.matchAll(/\d+(?:,\d{3})*(?:\.\d+)?/g)].map((match) => {
    const plain = match[0].replace(/,/g, '')
    return { text: plain, value: Number(plain), start: match.index ?? 0, end: (match.index ?? 0) + match[0].length }
  })
}

/** True when the two texts don't hold the same numbers (as a multiset); moved or reworded numbers don't count. */
export function numbersChanged(before: string, after: string): boolean {
  const sorted = (text: string): string => numberSpans(text).map((span) => span.text).sort().join(' ')
  return sorted(before) !== sorted(after)
}

/** The text with every number replaced by #, case and whitespace folded: two texts that differ only in numbers mask the same. */
export function maskNumbers(text: string): string {
  return text.replace(/\d+(?:,\d{3})*(?:\.\d+)?/g, '#').toLowerCase().replace(/\s+/g, ' ').trim()
}

const close = (a: number, b: number): boolean => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b))
const withIndices = (pattern: RegExp): RegExp => new RegExp(pattern.source, `${pattern.flags.replace(/[gd]/g, '')}gd`)

/** A link's value and the indices of the numbers it reads, or why it doesn't resolve in this text. */
export function resolveLink(text: string, link: TextLink): { value: number; indices: number[] } | { error: string } {
  const spans = numberSpans(text)
  const indices: number[] = []
  for (const pattern of link.capture) {
    const matches = [...text.matchAll(withIndices(pattern))]
    if (matches.length !== 1) return { error: `${pattern} matches ${matches.length} times` }
    const group = matches[0].indices?.[1]
    const index = group === undefined ? -1 : spans.findIndex((span) => span.start === group[0] && span.end === group[1])
    if (index === -1) return { error: `${pattern} must capture exactly one whole number` }
    indices.push(index)
  }
  const numbers = indices.map((index) => spans[index].value)
  return { value: link.value === undefined ? numbers[0] : link.value(numbers), indices }
}

/** Indices of the numbers inside any ignored span. */
function ignoredIndices(text: string, ignore: RegExp[]): Set<number> {
  const spans = numberSpans(text)
  const ranges = ignore.flatMap((pattern) => [...text.matchAll(withIndices(pattern))]
    .map((match) => [match.index ?? 0, (match.index ?? 0) + match[0].length] as const))
  return new Set(spans.flatMap((span, index) => (ranges.some(([start, end]) => span.start >= start && span.end <= end) ? [index] : [])))
}

/** Reads a number at a link's path in the item (or its effect); undefined when the path doesn't lead to a number. */
export function modelValue(item: Item, link: TextLink): number | undefined {
  const root: unknown = link.effectId === undefined ? item : item.effects.find((effect) => effect.id === link.effectId)
  const value = link.path.replace(/\[(\d+)\]/g, '.$1').split('.')
    .reduce<unknown>((node, key) => (typeof node === 'object' && node !== null ? (node as Record<string, unknown>)[key] : undefined), root)
  return typeof value === 'number' ? value : undefined
}

export type DescriptionCheck =
  | { ok: true; updates: TextUpdate[]; changedLinkedNumbers: string[] }
  | { ok: false; reason: string }

/**
 * Decides whether a description change only moves numbers the links explain, and what the model should become.
 * Fails on a wording change, a changed number no link or ignore covers, or a link the old text and the model disagree on.
 */
export function checkDescription(itemId: string, before: string, after: string, links: ItemTextLinks | undefined, model: Item): DescriptionCheck {
  if (maskNumbers(before) !== maskNumbers(after)) return { ok: false, reason: 'the wording changed, not only numbers' }
  const spansBefore = numberSpans(before)
  const spansAfter = numberSpans(after)
  const changed = spansAfter.flatMap((span, index) => (span.text === spansBefore[index].text ? [] : [index]))
  const linked = new Set<number>()
  const updates: TextUpdate[] = []
  for (const link of links?.links ?? []) {
    const old = resolveLink(before, link)
    const now = resolveLink(after, link)
    const where = `${link.effectId ?? itemId}.${link.path}`
    if ('error' in old || 'error' in now) return { ok: false, reason: `link ${where}: ${'error' in old ? old.error : (now as { error: string }).error}` }
    const current = modelValue(model, link)
    if (current === undefined || !close(current, old.value)) {
      return { ok: false, reason: `link ${where}: the old text gives ${old.value}, the model has ${current}` }
    }
    now.indices.forEach((index) => linked.add(index))
    if (!close(old.value, now.value)) {
      const note = now.indices.filter((index) => changed.includes(index))
        .map((index) => `${spansBefore[index].text} -> ${spansAfter[index].text}`).join(', ')
      updates.push({ itemId, ...(link.effectId === undefined ? {} : { effectId: link.effectId }), path: link.path, value: now.value, note })
    }
  }
  const ignored = new Set([...ignoredIndices(before, links?.ignore ?? []), ...ignoredIndices(after, links?.ignore ?? [])])
  const uncovered = changed.filter((index) => !linked.has(index) && !ignored.has(index))
  if (uncovered.length > 0) {
    return { ok: false, reason: `no link for ${uncovered.map((index) => `${spansBefore[index].text} -> ${spansAfter[index].text}`).join(', ')}` }
  }
  return { ok: true, updates, changedLinkedNumbers: changed.filter((index) => linked.has(index)).map((index) => spansAfter[index].text) }
}
