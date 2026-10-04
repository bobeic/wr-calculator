import Link from 'next/link'

export const metadata = { title: 'Page not found' }

/** Served as 404.html for any unknown address. */
export default function NotFound() {
  return (
    <main>
      <h1>Page not found</h1>
      <p>This page doesn&apos;t exist, or it moved. Champions and items are found by their name in the address, e.g. /champions/ahri/.</p>
      <ul>
        <li><Link href="/">Home</Link></li>
        <li><Link href="/tier-list/">Tier list</Link></li>
        <li><Link href="/champions/">Champions</Link></li>
        <li><Link href="/calculator/">Calculator</Link></li>
      </ul>
    </main>
  )
}
