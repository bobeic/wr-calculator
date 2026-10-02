import { Suspense } from 'react'
import { DebugPage } from '../../components/debug-page'

export const metadata = { title: 'Calculator · wr-calc' }

/**
 * The build calculator. For now it is the engine's debug view; the user-facing calculator design is still open
 * (docs/review/2026-10-03-overnight.md). useSearchParams inside DebugPage needs the Suspense boundary.
 */
export default function CalculatorPage() {
  return (
    <main>
      <p className="note">Early version: this is the engine&apos;s debug view. A friendlier calculator is next.</p>
      <Suspense fallback={<p>Loading…</p>}>
        <DebugPage />
      </Suspense>
    </main>
  )
}
