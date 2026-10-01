import { writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadGoldenCases } from '../src/golden-loader'
import { buildChampionMap } from '../src/champion-map'
import { getPatchDataset, PATCH_IDS } from '../src/patches/registry'
import { buildImpact, renderBuildImpact } from './patch/build-impact'
import type { ImpactScenario } from './patch/build-impact'
import { stableStringify } from './patch/stable-json'

// Usage: tsx scripts/build-impact.ts [<from> <to>]; defaults to the two newest patches.
// Writes src/patches/<to>/BUILD_IMPACT.md and build-impact.json.
const DATA_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

function main(argv: string[]): void {
  const [from, to] = argv.length >= 2 ? argv : PATCH_IDS.slice(-2)
  if (from === undefined || to === undefined) throw new Error('build-impact needs two patches; only one is registered')
  const side = (id: string) => {
    const dataset = getPatchDataset(id)
    return { dataset, champions: buildChampionMap(dataset.champions) }
  }
  const scenarios: ImpactScenario[] = loadGoldenCases(join(DATA_ROOT, 'golden'))
    .map(({ file, case: golden }) => ({ label: file.replace(/\.json$/, ''), ...golden.scenario }))
    .sort((a, b) => a.label.localeCompare(b.label))
  const impact = buildImpact(side(from), side(to), scenarios)
  const dir = join(DATA_ROOT, 'src', 'patches', to)
  void Promise.all([
    writeFile(join(dir, 'build-impact.json'), stableStringify(impact)),
    writeFile(join(dir, 'BUILD_IMPACT.md'), renderBuildImpact(impact)),
  ]).then(() => {
    const changed = impact.scenarios.filter((entry) => entry.before !== null && entry.after !== null && Math.abs(entry.after - entry.before) >= 0.05)
    console.log(`Build impact ${from} -> ${to}: ${changed.length} of ${impact.scenarios.length} scenarios changed, ${impact.items.length} items changed. See ${join(dir, 'BUILD_IMPACT.md')}`)
  })
}

main(process.argv.slice(2))
