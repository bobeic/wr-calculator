import type { ReactNode } from 'react'
import Link from 'next/link'
import { Saira } from 'next/font/google'
import { CN_STATS, CURRENT_PATCH } from '@wr-calc/data'
import { SiteNav } from '../components/site/site-nav'
import { LogoMark } from '../components/site/logo'
import { CF_ANALYTICS_TOKEN, SITE_NAME, SITE_URL } from '../lib/site/brand'
import './globals.css'

// Self-hosted at build time by next/font. Variable width: condensed for display, normal for reading.
const saira = Saira({ subsets: ['latin'], axes: ['wdth'], variable: '--font-saira', display: 'swap' })

export const metadata = {
  // Origin only: Next adds the base path to image URLs itself.
  metadataBase: new URL('/', SITE_URL),
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  description: 'Get better at Wild Rift: win rates, builds, matchups, patch changes and a damage calculator.',
  openGraph: { siteName: SITE_NAME, type: 'website' },
  twitter: { card: 'summary_large_image' },
}
export const viewport = { themeColor: '#070b14' }

const NAV = [
  { href: '/tier-list/', label: 'Tier list' },
  { href: '/champions/', label: 'Champions' },
  { href: '/items/', label: 'Items' },
  { href: '/runes/', label: 'Runes' },
  { href: '/patches/', label: 'Patches' },
  { href: '/calculator/', label: 'Calculator' },
]

/** Site shell: header navigation, the page, and a footer naming the data sources. */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={saira.variable}>
      <body>
        <a className="skip-link" href="#content">Skip to content</a>
        <header className="site-header">
          <div className="site-header-inner">
            <Link href="/" className="brand" aria-label={`${SITE_NAME} home`}>
              <LogoMark className="brand-mark" />
              <span>{SITE_NAME}</span>
            </Link>
            <SiteNav entries={NAV} />
            <span className="header-patch">Patch {CURRENT_PATCH}</span>
          </div>
        </header>
        <div id="content" className="page">{children}</div>
        <footer className="site-footer">
          <div className="site-footer-inner">
            <p>
              Game data: patch {CURRENT_PATCH} (wrpocket.app and the official patch notes). Win rates and builds:
              Tencent&apos;s CN server, {CN_STATS.statDate} (CN {CN_STATS.cnVersion}). Art: Tencent and Riot Games.
            </p>
            <p>{SITE_NAME} is a fan site, not endorsed by or affiliated with Riot Games or Tencent.</p>
          </div>
        </footer>
        {CF_ANALYTICS_TOKEN && (
          <script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon={JSON.stringify({ token: CF_ANALYTICS_TOKEN })} />
        )}
      </body>
    </html>
  )
}
