'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/** Main navigation; marks the section the current page belongs to. */
export function SiteNav({ entries }: { entries: Array<{ href: string; label: string }> }) {
  const pathname = usePathname()
  return (
    <nav aria-label="Main" className="site-nav">
      {entries.map((entry) => {
        const current = pathname.startsWith(entry.href)
        return <Link key={entry.href} href={entry.href} aria-current={current ? 'page' : undefined}>{entry.label}</Link>
      })}
    </nav>
  )
}
