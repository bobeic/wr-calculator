import type { ReactNode } from 'react'
import Link from 'next/link'
import { CN_STATS, CURRENT_PATCH } from '@wr-calc/data'
import './globals.css'

export const metadata = { title: 'wr-calc', description: 'Wild Rift win rates from the CN server, patch changes and a build calculator.' }

const NAV = [
  { href: '/tier-list/', label: 'Tier list' },
  { href: '/champions/', label: 'Champions' },
  { href: '/items/', label: 'Items' },
  { href: '/patches/', label: 'Patches' },
  { href: '/calculator/', label: 'Calculator' },
]

/** Site shell: header navigation, the page, and a footer naming the data sources. */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <nav aria-label="Main">
            <Link href="/" className="brand">wr-calc</Link>
            {NAV.map((entry) => <Link key={entry.href} href={entry.href}>{entry.label}</Link>)}
          </nav>
        </header>
        <div className="page">{children}</div>
        <footer className="site-footer">
          Game data: patch {CURRENT_PATCH} (wrpocket.app and the official patch notes). Win rates: Tencent's CN server,
          {' '}{CN_STATS.statDate} (CN {CN_STATS.cnVersion}). Not affiliated with Riot Games or Tencent.
        </footer>
      </body>
    </html>
  )
}
