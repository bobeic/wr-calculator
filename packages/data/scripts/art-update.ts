// Downloads the site's game art (Tencent's own Wild Rift art) and writes it as WebP under apps/web/public/art/, plus
// a manifest the pages read at build time. Files already on disk are kept, so a re-run only fetches what's new.
// Usage: pnpm --filter @wr-calc/data art:update [--refresh]
//
// Sources: Tencent's hero list (head icon, landscape splash "poster", portrait card), each hero's file (ability icons)
// and wrpocket's item/rune/spell lists, which carry Tencent's original icon URL under our ids. A network failure keeps
// whatever is already on disk and exits 0, so an offline build still works (with fewer images).
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { z } from 'zod'
import { fetchJson } from './cn-fetch'
import { HERO_LIST_URL, RawHeroListSchema, championIdFromPoster } from './cn-stats/map'
import { normalizeId } from '../src/wrpocket-ids'

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'apps', 'web', 'public', 'art')
const HERO_URL = (heroId: string): string => `https://game.gtimg.cn/images/lgamem/act/lrlib/js/hero/${heroId}.js`
const refresh = process.argv.includes('--refresh')

/** width in px and WebP quality per kind of image. */
const SIZES = { icon: [96, 80], splash: [1024, 72], card: [300, 76], ability: [80, 80], item: [80, 80] } as const
type Kind = keyof typeof SIZES

const HeroSchema = z.object({
  spells: z.array(z.object({ spellKey: z.string(), spellId: z.string(), abilityIconPath: z.string() }).passthrough()),
}).passthrough()
const IconListSchema = z.array(z.object({ id: z.string(), image_url_src: z.string().optional() }).passthrough())

export interface ArtManifest {
  champions: Record<string, { icon?: string; splash?: string; card?: string; abilities: Record<string, string> }>
  items: Record<string, string>
  runes: Record<string, string>
  spells: Record<string, string>
}

let failures = 0

/** Downloads `url` into public/art/<path> as WebP; returns the site path, or undefined when it couldn't. */
async function save(url: string, path: string, kind: Kind): Promise<string | undefined> {
  const file = join(OUT_DIR, path)
  if (!refresh && existsSync(file)) return `/art/${path}`
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url)
      if (response.status === 404) return undefined
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const [width, quality] = SIZES[kind]
      const webp = await sharp(Buffer.from(await response.arrayBuffer()))
        .resize({ width, withoutEnlargement: true }).webp({ quality }).toBuffer()
      await mkdir(dirname(file), { recursive: true })
      await writeFile(file, webp)
      return `/art/${path}`
    } catch (error) {
      if (attempt === 3) {
        failures++
        console.warn(`art: ${url} failed (${(error as Error).message})`)
        return existsSync(file) ? `/art/${path}` : undefined
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000))
    }
  }
  return undefined
}

/** Runs `task` over `items` with a few downloads in flight. */
async function eachLimited<T>(items: readonly T[], task: (item: T) => Promise<void>, limit = 8): Promise<void> {
  const queue = [...items]
  await Promise.all(Array.from({ length: limit }, async () => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) await task(item)
  }))
}

const ABILITY_SLOTS = ['q', 'w', 'e', 'r'] as const

/** 'https://…/Posters/MonkeyKing_0.jpg' -> 'MonkeyKing' (Tencent's poster names match Riot's champion keys). */
const posterName = (poster: string): string => (poster.split('/').pop() ?? '').replace(/_\d+\.\w+$/, '')

const DataDragonSchema = z.object({
  data: z.record(z.string(), z.object({
    passive: z.object({ image: z.object({ full: z.string() }) }),
    spells: z.array(z.object({ image: z.object({ full: z.string() }) })),
  }).passthrough()),
})
let dataDragonVersion: Promise<string | undefined> | undefined

/** Riot's own icons for one champion's passive and Q/W/E/R, or undefined if Data Dragon doesn't have it. */
async function dataDragonAbilityIcons(key: string): Promise<Record<string, string> | undefined> {
  dataDragonVersion ??= fetchJson('https://ddragon.leagueoflegends.com/api/versions.json')
    .then((versions) => z.array(z.string()).parse(versions)[0]).catch(() => undefined)
  const version = await dataDragonVersion
  if (version === undefined) return undefined
  const cdn = `https://ddragon.leagueoflegends.com/cdn/${version}`
  const parsed = DataDragonSchema.safeParse(await fetchJson(`${cdn}/data/en_US/champion/${key}.json`).catch(() => null))
  const champion = parsed.success ? parsed.data.data[key] : undefined
  if (champion === undefined) return undefined
  const icons: Record<string, string> = { passive: `${cdn}/img/passive/${champion.passive.image.full}` }
  champion.spells.slice(0, 4).forEach((spell, index) => { icons[ABILITY_SLOTS[index]] = `${cdn}/img/spell/${spell.image.full}` })
  return icons
}

async function main(): Promise<void> {
  const { CURRENT_PATCH, getPatchDataset } = await import('../src/patches/registry')
  const dataset = getPatchDataset(CURRENT_PATCH)
  const known = new Set(dataset.champions.map((champion) => champion.id))
  const manifest: ArtManifest = { champions: {}, items: {}, runes: {}, spells: {} }

  const heroList = RawHeroListSchema.parse(await fetchJson(HERO_LIST_URL))
  const heroes = Object.values(heroList.heroList).filter((hero) => known.has(championIdFromPoster(hero.poster)))
  await eachLimited(heroes, async (hero) => {
    const raw = hero as unknown as Record<string, string>
    const id = championIdFromPoster(hero.poster)
    const entry: ArtManifest['champions'][string] = { abilities: {} }
    entry.icon = await save(raw.avatar, `champions/${id}/icon.webp`, 'icon')
    entry.splash = await save(hero.poster, `champions/${id}/splash.webp`, 'splash')
    if (raw.card) entry.card = await save(raw.card, `champions/${id}/card.webp`, 'card')
    // Passive first, then the first four actives in Tencent's order (Q, W, E, R). Champions with more than four
    // (Hwei, Jayce, …) get their first four; the rest show without an icon.
    const detail = HeroSchema.safeParse(await fetchJson(HERO_URL(hero.heroId)).catch(() => null))
    if (detail.success) {
      const spells = [...detail.data.spells].sort((a, b) => a.spellId.localeCompare(b.spellId))
      const passive = spells.find((spell) => spell.spellKey === 'passive')
      const actives = spells.filter((spell) => spell.spellKey !== 'passive').slice(0, 4)
      const slots: Array<[string, string | undefined]> = [['passive', passive?.abilityIconPath], ...actives.map((spell, index) => [ABILITY_SLOTS[index], spell.abilityIconPath] as [string, string])]
      for (const [slot, url] of slots) {
        if (url === undefined) continue
        const path = await save(url, `champions/${id}/${slot}.webp`, 'ability')
        if (path !== undefined) entry.abilities[slot] = path
      }
    }
    // Tencent 404s some reworked champions' icons (Ahri, Graves, Vayne, Zeri's passive): use Riot's Data Dragon.
    const missing = ['passive', ...ABILITY_SLOTS].filter((slot) => entry.abilities[slot] === undefined)
    if (missing.length > 0) {
      const riot = await dataDragonAbilityIcons(posterName(hero.poster))
      for (const slot of missing) {
        const url = riot?.[slot]
        const path = url === undefined ? undefined : await save(url, `champions/${id}/${slot}.webp`, 'ability')
        if (path !== undefined) entry.abilities[slot] = path
      }
    }
    manifest.champions[id] = entry
  }, 4)

  for (const [file, key] of [['items.json', 'items'], ['runes.json', 'runes'], ['spells.json', 'spells']] as const) {
    const rows = IconListSchema.parse(await fetchJson(`https://wrpocket.app/site_data/${file}`))
    await eachLimited(rows, async (row) => {
      if (!row.image_url_src) return
      const id = normalizeId(row.id)
      const path = await save(row.image_url_src, `${key}/${id}.webp`, 'item')
      if (path !== undefined) manifest[key][id] = path
    })
  }

  const sorted = (record: Record<string, unknown>) => Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)))
  await writeFile(join(OUT_DIR, 'manifest.json'), `${JSON.stringify({
    champions: sorted(manifest.champions), items: sorted(manifest.items), runes: sorted(manifest.runes), spells: sorted(manifest.spells),
  }, null, 1)}\n`)
  console.log(`art: ${Object.keys(manifest.champions).length} champions, ${Object.keys(manifest.items).length} items, `
    + `${Object.keys(manifest.runes).length} runes, ${Object.keys(manifest.spells).length} spells${failures ? `, ${failures} failed downloads` : ''}`)
}

try {
  await mkdir(OUT_DIR, { recursive: true })
  await main()
} catch (error) {
  // Offline or a source changed shape: keep what's on disk (and its manifest) rather than failing the build.
  console.warn(`art: update skipped (${(error as Error).message}); keeping existing files`)
}
