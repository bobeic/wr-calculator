// Node-only: exposed as `@wr-calc/data/golden-loader`, never from the root entry, so browser bundles stay free of node: builtins.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { GoldenCaseSchema } from './golden-types'
import type { GoldenCase } from './golden-types'

export interface LoadedGoldenCase {
  file: string
  case: GoldenCase
}

/** Reads and validates every *.json golden case in a directory. Missing/empty dir -> []. */
export function loadGoldenCases(dir: string): LoadedGoldenCase[] {
  let files: string[]
  try {
    files = readdirSync(dir).filter((name) => name.endsWith('.json'))
  } catch {
    return []
  }
  return files.map((file) => {
    const raw: unknown = JSON.parse(readFileSync(join(dir, file), 'utf-8'))
    return { file, case: GoldenCaseSchema.parse(raw) }
  })
}
