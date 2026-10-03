import type { ReactNode } from 'react'
import Link from 'next/link'
import { Saira } from 'next/font/google'
import { CN_STATS, CURRENT_PATCH } from '@wr-calc/data'
import { SiteNav } from '../components/site/site-nav'
import './globals.css'

// Self-hosted at build time by next/font. Variable width: condensed for display, normal for reading.
const saira = Saira({ subsets: ['latin'], axes: ['wdth'], variable: '--font-saira', display: 'swap' })

export const metadata = { title: 'wr-calc', description: 'Wild Rift win rates from the CN server, patch changes and a build calculator.' }
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
            <Link href="/" className="brand" aria-label="wr-calc home">
              <svg className="brand-mark" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 2 21 7v10l-9 5-9-5V7z" fill="none" stroke="currentColor" strokeWidth="1.6" />
                <path d="M8 9.5 12 16l4-6.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
              </svg>
              <span>wr-calc</span>
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
            <p>wr-calc is a fan site, not endorsed by or affiliated with Riot Games or Tencent.</p>
          </div>
        </footer>
      </body>
    </html>
  )
}
