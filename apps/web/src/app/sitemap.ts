import type { MetadataRoute } from 'next'
import { CURRENT_PATCH, PATCH_IDS, getPatchDataset } from '@wr-calc/data'
import { SITE_URL } from '../lib/site/brand'
import { championHref, itemHref, patchHref } from '../lib/site/format'

export const dynamic = 'force-static'

/** Every public page, for search engines. /debug is left out on purpose. */
export default function sitemap(): MetadataRoute.Sitemap {
  const dataset = getPatchDataset(CURRENT_PATCH)
  const paths = [
    '/', '/tier-list/', '/champions/', '/items/', '/runes/', '/patches/', '/patches/cn-preview/', '/calculator/',
    ...dataset.champions.map((champion) => championHref(champion.id)),
    ...dataset.items.map((item) => itemHref(item.id)),
    ...PATCH_IDS.map(patchHref),
  ]
  return paths.map((path) => ({ url: SITE_URL + path }))
}
