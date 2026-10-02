'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { CnRank, CnStatsSnapshot, Lane } from '@wr-calc/data'
import { assignTiers } from '../../lib/site/tiers'
import type { TieredStat } from '../../lib/site/tiers'
import { championHref, pct } from '../../lib/site/format'
import { StatTable } from './stat-table'

export interface TierListProps {
  ranks: CnStatsSnapshot['ranks']
  rankLabels: Record<CnRank, string>
  laneLabels: Record<Lane, string>
  names: Record<string, string>
}

/** CN win rates for one bracket and lane at a time, tiered by Tencent's strength order. */
export function TierList({ ranks, rankLabels, laneLabels, names }: TierListProps) {
  const rankOptions = (Object.keys(rankLabels) as CnRank[]).filter((rank) => Object.values(ranks[rank]).some((rows) => rows.length > 0))
  const [rank, setRank] = useState<CnRank>(rankOptions[0] ?? 'all')
  const [lane, setLane] = useState<Lane>('top')
  const rows = assignTiers(ranks[rank][lane])

  return (
    <>
      <div className="filters" role="group" aria-label="Rank bracket">
        {rankOptions.map((option) => (
          <button key={option} type="button" aria-pressed={option === rank} onClick={() => setRank(option)}>{rankLabels[option]}</button>
        ))}
      </div>
      <div className="filters" role="group" aria-label="Lane">
        {(Object.keys(laneLabels) as Lane[]).map((option) => (
          <button key={option} type="button" aria-pressed={option === lane} onClick={() => setLane(option)}>{laneLabels[option]}</button>
        ))}
      </div>
      <StatTable<TieredStat>
        rows={rows}
        rowKey={(row) => row.championId}
        columns={[
          { key: 'rank', label: '#', numeric: true, render: (row) => row.strengthRank },
          { key: 'tier', label: 'Tier', render: (row) => row.tier },
          { key: 'champion', label: 'Champion', render: (row) => <Link href={championHref(row.championId)}>{names[row.championId] ?? row.championId}</Link> },
          { key: 'win', label: 'Win', numeric: true, render: (row) => pct(row.winRate) },
          { key: 'pick', label: 'Pick', numeric: true, render: (row) => pct(row.pickRate) },
          { key: 'ban', label: 'Ban', numeric: true, render: (row) => pct(row.banRate) },
        ]}
      />
    </>
  )
}
