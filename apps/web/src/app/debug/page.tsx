import { Suspense } from 'react'
import { DebugPage } from '../../components/debug-page'

export const metadata = { title: 'Debug' }

/** The engine debug page, kept at its own route for development. */
export default function DebugRoute() {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <DebugPage />
    </Suspense>
  )
}
