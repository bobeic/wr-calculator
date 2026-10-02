'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { CnRank, CnStatsSnapshot, Lane } from '@wr-calc/data'
import { assignTiers, TIERS } from '../../lib/site/tiers'
import type { TieredStat } from '../../lib/site/tiers'
import { championHref, championIconUrl, pct } from '../../lib/site/format'
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
      {TIERS.map((tier) => {
        const tierRows = rows.filter((row) => row.tier === tier)
        if (tierRows.length === 0) return null
        return (
          <section key={tier} className="tier-group">
            <h2 className="tier-heading">
              {tier} <span className="muted">· {tierRows.length} champion{tierRows.length === 1 ? '' : 's'}</span>
            </h2>
            <StatTable<TieredStat>
              rows={tierRows}
              rowKey={(row) => row.championId}
              columns={[
                {
                  key: 'champion', label: 'Champion', render: (row) => (
                    <Link href={championHref(row.championId)} className="champ-link">
                      <img src={championIconUrl(row.heroId)} alt="" width={28} height={28} className="champ-icon" loading="lazy" />
                      {names[row.championId] ?? row.championId}
                    </Link>
                  ),
                },
                { key: 'win', label: 'Win', numeric: true, render: (row) => pct(row.winRate) },
                { key: 'pick', label: 'Pick', numeric: true, render: (row) => pct(row.pickRate) },
                { key: 'ban', label: 'Ban', numeric: true, render: (row) => pct(row.banRate) },
              ]}
            />
          </section>
        )
      })}
    </>
  )
}
