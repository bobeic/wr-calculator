export interface NullSource {
  label: string
  value: unknown
}

export interface NullEntry {
  path: string
}

function walk(value: unknown, path: string, out: string[]): void {
  if (value === null) {
    out.push(path)
    return
  }
  if (Array.isArray(value)) {
    value.forEach((element, index) => walk(element, `${path}[${index}]`, out))
    return
  }
  if (typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      walk(child, path === '' ? key : `${path}.${key}`, out)
    }
  }
}

/** Lists every null value (a magnitude not yet entered) inside the given data sources. */
export function nullReport(sources: NullSource[]): NullEntry[] {
  return sources.flatMap(({ label, value }) => {
    const paths: string[] = []
    walk(value, '', paths)
    return paths.map((path) => ({ path: path === '' ? label : `${label} › ${path}` }))
  })
}
