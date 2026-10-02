import { z } from 'zod'
import { normalizeId } from '../src/wrpocket-ids'

/** GETs JSON with a few retries (Tencent's CDN sometimes resets connections); null on 404. */
export async function fetchJson(url: string): Promise<unknown> {
  let lastError: unknown
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const response = await fetch(url)
      if (response.status === 404) return null
      if (!response.ok) throw new Error(`GET ${url} failed: HTTP ${response.status}`)
      return JSON.parse(await response.text())
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, 2 ** attempt * 1000))
    }
  }
  throw lastError
}

// wrpocket's raw site_data carries Tencent's ids as source_id; our snapshots drop it for items.
const SourceIdsSchema = z.array(z.object({ id: z.string(), source_id: z.union([z.string(), z.number()]) }).passthrough())

/** Tencent id -> our id, from one of wrpocket's site_data lists ('items.json', 'runes.json'). */
export async function sourceIdMap(file: string): Promise<Map<string, string>> {
  const rows = SourceIdsSchema.parse(await fetchJson(`https://wrpocket.app/site_data/${file}`))
  return new Map(rows.map((row) => [String(row.source_id), normalizeId(row.id)]))
}
