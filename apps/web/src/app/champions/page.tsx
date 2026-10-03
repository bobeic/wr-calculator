import Link from 'next/link'
import { CN_STATS, CURRENT_PATCH, LANE_LABELS, getPatchDataset } from '@wr-calc/data'
import { championLanes } from '../../lib/site/champion-lanes'
import { championHref } from '../../lib/site/format'

export const metadata = { title: 'Champions' }

export default function ChampionsPage() {
  const champions = [...getPatchDataset(CURRENT_PATCH).champions].sort((a, b) => a.name.localeCompare(b.name))
  return (
    <main>
      <h1>Champions</h1>
      <div className="grid">
        {champions.map((champion) => {
          const lanes = championLanes(CN_STATS, champion.id).map((lane) => LANE_LABELS[lane.lane])
          return (
            <div key={champion.id}>
              <Link href={championHref(champion.id)}>{champion.name}</Link>
              {lanes.length > 0 && <span className="note"> · {lanes.join(', ')}</span>}
            </div>
          )
        })}
      </div>
    </main>
  )
}
