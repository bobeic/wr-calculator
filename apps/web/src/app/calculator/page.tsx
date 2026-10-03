import { Suspense } from 'react'
import { CURRENT_PATCH, getPatchDataset } from '@wr-calc/data'
import { CalculatorPage } from '../../components/calculator/calculator-page'

export const metadata = { title: 'Calculator' }

/** The build calculator; the engine's debug view stays at /debug. useSearchParams inside needs the Suspense boundary. */
export default function CalculatorRoute() {
  const modelledIds = getPatchDataset(CURRENT_PATCH).handModelled.champions.map((champion) => champion.id)
  return (
    <main>
      <Suspense fallback={<p>Loading…</p>}>
        <CalculatorPage modelledIds={modelledIds} />
      </Suspense>
    </main>
  )
}
