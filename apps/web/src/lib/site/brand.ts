// The site's name in one place: the working name until a domain is bought (see docs/next-steps.md).
export const SITE_NAME = 'Wild Rift Builds'

// The site's public address, for the sitemap and link previews. The deploy workflow sets it from GitHub Pages, so it
// follows a custom domain automatically.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

// Cloudflare Web Analytics site token (public; it ends up in the page anyway). Empty: no analytics script.
export const CF_ANALYTICS_TOKEN = ''
