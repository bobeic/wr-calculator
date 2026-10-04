import type { MetadataRoute } from 'next'
import { SITE_URL } from '../lib/site/brand'

export const dynamic = 'force-static'

// ponytail: crawlers only read robots.txt at a host's root, so this takes effect once the site has its own domain.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', disallow: new URL(SITE_URL).pathname.replace(/\/$/, '') + '/debug/' },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
