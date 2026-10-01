import type { NumberChange } from './types'

export interface WordOp {
  op: 'same' | 'del' | 'add'
  text: string
}

// Numbers (with decimals and %), words, whitespace runs, and single punctuation marks, so
// "60/80/100" splits into its rank values.
const TOKEN_RE = /\d+(?:\.\d+)?%?|[\p{L}']+|\s+|[^\s\p{L}\d]/gu
const NUMBER_RE = /^\d+(?:\.\d+)?%?$/

function tokenize(text: string): string[] {
  return text.match(TOKEN_RE) ?? []
}

/** Diffs two texts token by token (longest common subsequence). */
export function diffWords(before: string, after: string): WordOp[] {
  const a = tokenize(before)
  const b = tokenize(after)
  // lcs[i][j] = LCS length of a[i..] and b[j..]
  const lcs = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }
  const ops: WordOp[] = []
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      ops.push({ op: 'same', text: a[i] })
      i += 1
      j += 1
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      ops.push({ op: 'del', text: a[i] })
      i += 1
    } else {
      ops.push({ op: 'add', text: b[j] })
      j += 1
    }
  }
  for (; i < a.length; i += 1) ops.push({ op: 'del', text: a[i] })
  for (; j < b.length; j += 1) ops.push({ op: 'add', text: b[j] })
  return ops
}

/** Pairs the numbers deleted and added within each run of changes, in order. */
export function numberChanges(ops: WordOp[]): NumberChange[] {
  const changes: NumberChange[] = []
  let deleted: string[] = []
  let added: string[] = []
  const flush = (): void => {
    for (let index = 0; index < Math.max(deleted.length, added.length); index += 1) {
      changes.push({ before: deleted[index] ?? '', after: added[index] ?? '' })
    }
    deleted = []
    added = []
  }
  for (const { op, text } of ops) {
    if (op === 'same') flush()
    else if (NUMBER_RE.test(text)) (op === 'del' ? deleted : added).push(text)
  }
  flush()
  return changes
}

// wrpocket text carries its own markdown (e.g. **Awe**), which would otherwise merge with the diff markers.
function escapeMarkdown(text: string): string {
  return text.replace(/[\\*_~<>`[\]]/g, '\\$&')
}

/** Renders ops as markdown: deletions ~~struck~~, additions **bold**, whitespace kept outside markers. */
export function renderWordDiff(ops: WordOp[]): string {
  const merged: WordOp[] = []
  for (const op of ops) {
    const last = merged[merged.length - 1]
    if (last && last.op === op.op) last.text += op.text
    else merged.push({ ...op })
  }
  return merged.map(({ op, text: raw }) => {
    const text = escapeMarkdown(raw)
    if (op === 'same') return text
    const marker = op === 'del' ? '~~' : '**'
    const match = /^(\s*)(.*?)(\s*)$/s.exec(text) as RegExpExecArray
    return match[2] === '' ? text : `${match[1]}${marker}${match[2]}${marker}${match[3]}`
  }).join('')
}
