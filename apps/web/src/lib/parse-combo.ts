import type { AbilityKey, ComboAction } from '@wr-calc/calc'

export type ParseError = { ok: false; error: string; tokenIndex: number }
export type ComboParse = { ok: true; actions: ComboAction[] } | ParseError
export type PriorityParse = { ok: true; keys: AbilityKey[] } | ParseError

const SIMPLE_ACTIONS = ['AA', 'Q', 'W', 'E', 'R'] as const
const ABILITY_KEYS: Record<string, AbilityKey | undefined> = { Q: 'q', W: 'w', E: 'e', R: 'r' }

function tokenize(text: string): string[] {
  return text.trim().split(/\s+/).filter((token) => token !== '')
}

/** Parses combo text like "Q AA item:trinity-force wait:0.5 R" into simulateCombo actions. */
export function parseCombo(text: string): ComboParse {
  const actions: ComboAction[] = []
  for (const [tokenIndex, token] of tokenize(text).entries()) {
    const simple = SIMPLE_ACTIONS.find((action) => action === token.toUpperCase())
    if (simple) {
      actions.push(simple)
      continue
    }
    const colon = token.indexOf(':')
    const prefix = colon === -1 ? '' : token.slice(0, colon).toLowerCase()
    const rest = colon === -1 ? '' : token.slice(colon + 1)
    if (prefix === 'item' && rest !== '') {
      actions.push(`item:${rest}`)
      continue
    }
    if (prefix === 'wait') {
      const seconds = Number(rest)
      // Number('') is 0, so an empty value must be rejected explicitly.
      if (rest === '' || !Number.isFinite(seconds) || seconds < 0) {
        return { ok: false, error: `'${token}': wait needs a number of seconds ≥ 0`, tokenIndex }
      }
      actions.push(`wait:${seconds}`)
      continue
    }
    return { ok: false, error: `unknown combo token '${token}'`, tokenIndex }
  }
  return { ok: true, actions }
}

/** Parses ability-priority text like "Q E W R" into lowercase ability keys for compareBuilds. */
export function parsePriority(text: string): PriorityParse {
  const keys: AbilityKey[] = []
  for (const [tokenIndex, token] of tokenize(text).entries()) {
    const key = ABILITY_KEYS[token.toUpperCase()]
    if (!key) return { ok: false, error: `priority accepts only Q W E R, got '${token}'`, tokenIndex }
    keys.push(key)
  }
  return { ok: true, keys }
}
