import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { DebugPage } from '../../components/debug-page'

export const metadata = { title: 'Debug' }

/** The engine debug page, kept at its own route for development: `next dev` only, a 404 on the live site. */
export default function DebugRoute() {
  if (process.env.NODE_ENV === 'production') notFound()
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <DebugPage />
    </Suspense>
  )
}
