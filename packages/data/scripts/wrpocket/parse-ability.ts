import type { DamageComponent, DamageRatioStat, DamageType, Scalar } from '@wr-calc/schema'

/** Rounds to 6 decimals, removing float noise like 0.35000000000000003. */
export function round(value: number): number {
  return Number(value.toFixed(6))
}

/** Parses "8/7/6/5", "8 / 7 / 6 / 5", "30%/40%" or "14" into numbers; null if any part isn't a number. */
export function parseRanks(text: string): number[] | null {
  const parts = text.split('/').map((part) => part.trim().replace(/%$/, '').trim())
  const values = parts.map(Number)
  return parts.every((part) => part !== '') && values.every(Number.isFinite) ? values : null
}

/** Turns per-rank values into a Scalar: a plain number for a single rank, byRank otherwise. */
export function toScalar(values: number[]): Scalar {
  return values.length === 1 ? values[0] : { byRank: values }
}

// Order matters: "bonus AD" must be tried before "AD".
const RATIO_STATS: Array<[RegExp, DamageRatioStat]> = [
  [/^bonus AD$/i, 'bonusAd'],
  [/^AD$/i, 'totalAd'],
  [/^AP$/i, 'ap'],
  [/^bonus (Health|HP)$/i, 'bonusHp'],
  [/^(max Health|HP)$/i, 'maxHp'],
]
// "75% / 80% / 85% / 90% AD" → values "75% / 80% / 85% / 90", label "AD".
const RATIO_PART = /^((?:[\d.]+\s*%\s*\/\s*)*[\d.]+)\s*%\s*(.+)$/

/** Parses the inside of a "(+65% AP +5% bonus Health)" group into damage ratios, reporting parts it can't map. */
export function parseRatios(group: string): { ratios: DamageComponent['ratios']; unparsed: string[] } {
  const ratios: DamageComponent['ratios'] = []
  const unparsed: string[] = []
  for (const part of group.split('+').map((piece) => piece.trim()).filter((piece) => piece !== '')) {
    const match = RATIO_PART.exec(part)
    const values = match ? parseRanks(match[1]) : null
    // Collapse runs of whitespace (and tolerate no space at all) between "%" and the label, e.g.
    // "80%bonus  AD", before matching it against RATIO_STATS.
    const label = match ? match[2].trim().replace(/\s+/g, ' ') : ''
    const stat = match ? RATIO_STATS.find(([pattern]) => pattern.test(label))?.[1] : undefined
    if (!values || !stat) {
      unparsed.push(part)
      continue
    }
    ratios.push({ stat, value: toScalar(values.map((value) => round(value / 100))) })
  }
  return { ratios, unparsed }
}

const DAMAGE_TYPES: Record<string, DamageType> = { physical: 'physical', magic: 'magic', true: 'true' }
const DAMAGE_PHRASE = /(\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)*)\s*\(([^()]*)\)\s*(?:bonus\s+)?(physical|magic|true) damage/

// A token that can be part of a "N + Level x M" / "N + M" level-scaling formula, read backwards
// from the matched number.
const FORMULA_TAIL_TOKEN = /^(\d+(?:\.\d+)?|[+x×*]|Level)$/i

/** Reconstructs the "N + Level x M" formula snippet immediately before a matched number, or null. */
function formulaSnippet(before: string, matchedNumber: string): string | null {
  if (!/[+x×*]$/i.test(before)) return null
  const tokens = before.split(/\s+/)
  const tail: string[] = []
  for (let index = tokens.length - 1; index >= 0; index--) {
    if (!FORMULA_TAIL_TOKEN.test(tokens[index])) break
    tail.unshift(tokens[index])
  }
  return `${tail.join(' ')} ${matchedNumber}`.trim()
}

/** Short "per/each/every ..." clause right after a matched damage phrase, or null if there is none. */
function perHitSnippet(after: string): string | null {
  const trimmed = after.trimStart()
  if (!/^(per|each|every)\b/i.test(trimmed)) return null
  const clauseEnd = trimmed.search(/[,;]|\.(?=\s|$)/)
  const clause = clauseEnd === -1 ? trimmed : trimmed.slice(0, clauseEnd)
  return clause.trim().split(/\s+/).slice(0, 6).join(' ')
}

/** Finds the first "N (+ratios) <type> damage" phrase in ability text. */
export function findTextDamage(text: string): {
  base: number[]; ratioGroup: string; type: DamageType; isRangeUpperBound: boolean
  formulaSnippet: string | null; perHitSnippet: string | null
} | null {
  const match = DAMAGE_PHRASE.exec(text)
  if (!match) return null
  const base = parseRanks(match[1])
  const type = DAMAGE_TYPES[match[3]]
  if (!base || !type) return null
  const before = text.slice(0, match.index).trimEnd()
  const after = text.slice(match.index + match[0].length)
  return {
    base, ratioGroup: match[2], type,
    // "25 (+12% bonus AD)–250 (+120% bonus AD) physical damage": the regex matches the upper end.
    isRangeUpperBound: before.endsWith('–') || before.endsWith('-'),
    formulaSnippet: formulaSnippet(before, match[1]),
    perHitSnippet: perHitSnippet(after),
  }
}

/** Lists the distinct damage types a text mentions, in order of first appearance. */
export function damageTypesIn(text: string): DamageType[] {
  const found: DamageType[] = []
  for (const match of text.matchAll(/(physical|magic|true) damage/g)) {
    const type = DAMAGE_TYPES[match[1]]
    if (type && !found.includes(type)) found.push(type)
  }
  return found
}
