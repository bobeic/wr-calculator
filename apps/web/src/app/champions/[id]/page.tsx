import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CN_RANKS, CN_RANK_LABELS, CN_STATS, CURRENT_PATCH, LANE_LABELS, getPatchDataset } from '@wr-calc/data'
import { loadChampionText } from '@wr-calc/data/site-loader'
import { StatTable } from '../../../components/site/stat-table'
import { championLanes } from '../../../lib/site/champion-lanes'
import type { LaneStat } from '../../../lib/site/champion-lanes'
import { pct } from '../../../lib/site/format'

export const dynamicParams = false

export function generateStaticParams() {
  return getPatchDataset(CURRENT_PATCH).champions.map((champion) => ({ id: champion.id }))
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const champion = getPatchDataset(CURRENT_PATCH).champions.find((entry) => entry.id === id)
  return { title: `${champion?.name ?? id} · wr-calc` }
}

const SLOT_LABELS = { passive: 'Passive', q: 'Q', w: 'W', e: 'E', r: 'R' } as const

export default async function ChampionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const champion = getPatchDataset(CURRENT_PATCH).champions.find((entry) => entry.id === id)
  if (champion === undefined) notFound()
  const abilities = loadChampionText(CURRENT_PATCH).get(id) ?? []
  const brackets = CN_RANKS.map((rank) => ({ rank, lanes: championLanes(CN_STATS, id, rank) })).filter((entry) => entry.lanes.length > 0)

  return (
    <main>
      <h1>{champion.name}</h1>
      <p><Link href={`/calculator/?champ=${id}`}>Open in the calculator</Link></p>

      <h2>CN win rates</h2>
      {brackets.length === 0 ? <p className="muted">Not in Tencent&apos;s ranked list.</p> : brackets.map(({ rank, lanes }) => (
        <section key={rank}>
          <h3 className="note">{CN_RANK_LABELS[rank]}</h3>
          <StatTable<LaneStat>
            rows={lanes}
            rowKey={(row) => row.lane}
            columns={[
              { key: 'lane', label: 'Lane', render: (row) => LANE_LABELS[row.lane] },
              { key: 'strength', label: 'Strength', numeric: true, render: (row) => `${row.strengthRank} / ${row.laneSize}` },
              { key: 'win', label: 'Win', numeric: true, render: (row) => pct(row.winRate) },
              { key: 'pick', label: 'Pick', numeric: true, render: (row) => pct(row.pickRate) },
              { key: 'ban', label: 'Ban', numeric: true, render: (row) => pct(row.banRate) },
            ]}
          />
        </section>
      ))}

      <h2>Builds</h2>
      <p className="muted">Popular CN builds aren&apos;t wired up yet: the data source is still open.</p>

      <h2>Abilities</h2>
      {abilities.map((ability) => (
        <section key={ability.slot}>
          <h3>{SLOT_LABELS[ability.slot]} · {ability.name}</h3>
          <pre className="text">{ability.description}</pre>
        </section>
      ))}
    </main>
  )
}
