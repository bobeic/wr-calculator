import type { ReactNode } from 'react'
import Link from 'next/link'
import { Saira } from 'next/font/google'
import { CN_STATS, CURRENT_PATCH } from '@wr-calc/data'
import { SiteNav } from '../components/site/site-nav'
import { LogoMark } from '../components/site/logo'
import { SITE_NAME } from '../lib/site/brand'
import './globals.css'

// Self-hosted at build time by next/font. Variable width: condensed for display, normal for reading.
const saira = Saira({ subsets: ['latin'], axes: ['wdth'], variable: '--font-saira', display: 'swap' })

export const metadata = {
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  description: 'Wild Rift win rates, builds, patch changes and a damage calculator, to help you pick, build and improve.',
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
      </body>
    </html>
  )
}
