import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const SRC_DIR = new URL('../src', import.meta.url).pathname
const IMPORT_RE = /(?:import|export)[^'"]*?from\s+['"]([^'"]+)['"]/g

/** Resolves a relative specifier to a .ts file (direct or index) inside src. */
function resolveRelative(fromFile: string, specifier: string): string {
  const base = resolve(dirname(fromFile), specifier)
  for (const candidate of [`${base}.ts`, resolve(base, 'index.ts')]) {
    if (existsSync(candidate)) return candidate
  }
  throw new Error(`cannot resolve '${specifier}' from ${fromFile}`)
}

/** Collects every bare (non-relative) specifier reachable from an entry file via relative imports. */
function reachableBareImports(entry: string): Map<string, string> {
  const bare = new Map<string, string>()
  const seen = new Set<string>()
  const queue = [entry]
  while (queue.length > 0) {
    const file = queue.pop() as string
    if (seen.has(file)) continue
    seen.add(file)
    for (const match of readFileSync(file, 'utf-8').matchAll(IMPORT_RE)) {
      const specifier = match[1]
      if (specifier.startsWith('.')) queue.push(resolveRelative(file, specifier))
      else bare.set(specifier, file)
    }
  }
  return bare
}

describe('@wr-calc/data root entry', () => {
  it('reaches no node: builtins, so browser bundles can import it', () => {
    const offenders = [...reachableBareImports(resolve(SRC_DIR, 'index.ts'))]
      .filter(([specifier]) => specifier.startsWith('node:'))
      .map(([specifier, file]) => `${specifier} (via ${file})`)
    expect(offenders).toEqual([])
  })
})
