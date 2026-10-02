import type { Snapshot } from './snapshot'
import { diffWords, numberChanges, renderWordDiff } from './text-diff'
import type { FieldChange } from './types'

/** A rune or summoner spell that changed between two snapshots. Every one is hand-modelled, so each needs review. */
export interface RuneSpellChange {
  kind: 'rune' | 'spell'
  id: string
  name: string
  change: 'added' | 'removed' | 'changed'
  fields: FieldChange[]
}

interface Entry { id: string; name: { en: string }; description: { en: string } }

function diffList(kind: RuneSpellChange['kind'], before: Entry[], after: Entry[]): RuneSpellChange[] {
  const old = new Map(before.map((entry) => [entry.id, entry]))
  const current = new Map(after.map((entry) => [entry.id, entry]))
  const changes: RuneSpellChange[] = []
  for (const entry of after) {
    const previous = old.get(entry.id)
    if (previous === undefined) {
      changes.push({ kind, id: entry.id, name: entry.name.en, change: 'added', fields: [] })
      continue
    }
    const fields: FieldChange[] = []
    if (previous.name.en !== entry.name.en) fields.push({ field: 'name', before: previous.name.en, after: entry.name.en })
    if (previous.description.en !== entry.description.en) {
      const ops = diffWords(previous.description.en, entry.description.en)
      fields.push({
        field: 'description', before: previous.description.en, after: entry.description.en,
        numbers: numberChanges(ops), wordDiff: renderWordDiff(ops),
      })
    }
    if (fields.length > 0) changes.push({ kind, id: entry.id, name: entry.name.en, change: 'changed', fields })
  }
  for (const entry of before) {
    if (!current.has(entry.id)) changes.push({ kind, id: entry.id, name: entry.name.en, change: 'removed', fields: [] })
  }
  return changes
}

/** Rune and spell changes; [] when the older snapshot predates rune/spell imports (nothing to compare). */
export function diffRunesAndSpells(before: Snapshot, after: Snapshot): RuneSpellChange[] {
  return [
    ...(before.runes === undefined ? [] : diffList('rune', before.runes, after.runes ?? [])),
    ...(before.spells === undefined ? [] : diffList('spell', before.spells, after.spells ?? [])),
  ]
}

/** The PATCH_DIFF.md section for rune and spell changes. */
export function renderRuneSpellChanges(changes: RuneSpellChange[]): string {
  const lines = [
    '## Runes and summoner spells', '',
    'Hand-modelled in `runes.ts` / `spells.ts` and never updated automatically: check each change against the model.', '',
  ]
  if (changes.length === 0) lines.push('None.')
  for (const change of changes) {
    lines.push(`- ${change.kind} \`${change.id}\` (${change.name}): ${change.change}`)
    for (const field of change.fields) {
      if (field.field === 'name') lines.push(`  - name: ${field.before} → ${field.after}`)
      else {
        const numbers = (field.numbers ?? []).map((number) => `${number.before || '—'} → ${number.after || '—'}`).join(', ')
        lines.push(`  - description${numbers === '' ? ' (wording only)' : `: ${numbers}`}`, `    > ${field.wordDiff}`)
      }
    }
  }
  return `${lines.join('\n')}\n`
}
