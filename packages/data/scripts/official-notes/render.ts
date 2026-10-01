import type { NotesCrossCheck } from './types'

const plural = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`

/** Renders the PATCH_DIFF.md "Official notes cross-check" section; [] when no notes stage ran. */
export function renderNotesSection(check: NotesCrossCheck | null): string[] {
  if (check === null) return []
  const heading = ['## Official notes cross-check', '']
  if (!check.found) return [...heading, `Official notes not found at ${check.url}; nothing auto-cleared (use --notes-url).`, '']
  return [
    ...heading,
    `From the [official notes](${check.url}), published ${(check.published ?? '').slice(0, 10)}.`, '',
    `- ${plural(check.autoReviewed.length, 'flag', 'flags')} auto-cleared as wrpocket-only`,
    `- ${plural(check.notesFlags.length, 'hand-modelled entry', 'hand-modelled entries')} changed in the notes but not in wrpocket`,
    `- ${check.mentioned.length} notes entries matched, ${check.unmatched.length} unmatched, ${check.excludedCount} game-mode / system entries skipped`, '',
    '"Reflected" means every number in a line\'s new value appears somewhere in wrpocket\'s record for that '
      + 'entry. It is a heuristic for spotting wrpocket lagging behind the notes; it never clears a flag.', '',
    '### Auto-cleared', '',
    ...(check.autoReviewed.length === 0 ? ['None.'] : check.autoReviewed.map((entry) => `- ${entry.kind} ${entry.id}: ${entry.note}`)), '',
    '### Matched notes entries', '',
    ...(check.mentioned.length === 0 ? ['None.'] : check.mentioned.flatMap((entry) => [
      `- ${entry.ref.kind} ${entry.ref.id} (${entry.ref.name}): ${entry.status}`,
      ...entry.lines.map((line) => `  - ${line.group === null ? '' : `${line.group}: `}${line.text} (${line.status})`),
    ])), '',
    '### Unmatched notes entries', '',
    ...(check.unmatched.length === 0 ? ['None.'] : check.unmatched.map((entry) => `- ${entry.section || '(champion card)'}: ${entry.heading}`)), '',
  ]
}
