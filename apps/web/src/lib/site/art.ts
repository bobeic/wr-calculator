import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Game art downloaded by `pnpm --filter @wr-calc/data art:update` into public/art/ (gitignored; `build` runs it).
 * Server-only: pages read the manifest at build time and pass URLs down. Missing art comes back undefined, so a page
 * built offline or before the first download still renders, just without images.
 */
interface Manifest {
  champions: Record<string, { icon?: string; splash?: string; card?: string; abilities: Record<string, string> }>
  items: Record<string, string>
  runes: Record<string, string>
  spells: Record<string, string>
}

const EMPTY: Manifest = { champions: {}, items: {}, runes: {}, spells: {} }
let manifest: Manifest | undefined

function load(): Manifest {
  if (manifest === undefined) {
    try {
      manifest = JSON.parse(readFileSync(join(process.cwd(), 'public', 'art', 'manifest.json'), 'utf8')) as Manifest
    } catch {
      manifest = EMPTY
    }
  }
  return manifest
}

const withBase = (path: string | undefined): string | undefined =>
  path === undefined ? undefined : `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}${path}`

export interface ChampionArt { icon?: string; splash?: string; card?: string; abilities: Record<string, string | undefined> }

export function championArt(id: string): ChampionArt {
  const entry = load().champions[id]
  return {
    icon: withBase(entry?.icon),
    splash: withBase(entry?.splash),
    card: withBase(entry?.card),
    abilities: Object.fromEntries(Object.entries(entry?.abilities ?? {}).map(([slot, path]) => [slot, withBase(path)])),
  }
}

export const championIcon = (id: string): string | undefined => withBase(load().champions[id]?.icon)
export const itemIcon = (id: string): string | undefined => withBase(load().items[id])
export const runeIcon = (id: string): string | undefined => withBase(load().runes[id])
export const spellIcon = (id: string): string | undefined => withBase(load().spells[id])
