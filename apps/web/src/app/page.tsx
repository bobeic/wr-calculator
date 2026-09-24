import { Suspense } from 'react'
import { DebugPage } from '../components/debug-page'

/** Static-export entry: useSearchParams inside DebugPage requires a Suspense boundary. */
export default function Page() {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <DebugPage />
    </Suspense>
  )
}
