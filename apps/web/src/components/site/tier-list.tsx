'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { CnRank, CnStatsSnapshot, Lane } from '@wr-calc/data'
import { assignTiers, TIERS } from '../../lib/site/tiers'
import type { TieredStat } from '../../lib/site/tiers'
import { championHref, pct } from '../../lib/site/format'
import { LaneIcon } from './icons'

export interface TierListProps {
  ranks: CnStatsSnapshot['ranks']
  rankLabels: Record<CnRank, string>
  laneLabels: Record<Lane, string>
  names: Record<string, string>
  art: Record<string, { icon?: string; splash?: string }>
}

/** Win rate against an even 50%: above reads as rising, below as falling. */
const trend = (winRate: number): string => (winRate >= 0.5 ? 'up' : 'down')

/** CN win rates for one bracket and lane at a time, tiered by Tencent's strength order. */
export function TierList({ ranks, rankLabels, laneLabels, names, art }: TierListProps) {
  const rankOptions = (Object.keys(rankLabels) as CnRank[]).filter((rank) => Object.values(ranks[rank]).some((rows) => rows.length > 0))
  const [rank, setRank] = useState<CnRank>(rankOptions[0] ?? 'all')
  const [lane, setLane] = useState<Lane>('top')
  const rows = assignTiers(ranks[rank][lane])
  const name = (row: TieredStat) => names[row.championId] ?? row.championId

  return (
    <>
      <div className="tier-controls">
        <div className="segmented" role="group" aria-label="Lane">
          {(Object.keys(laneLabels) as Lane[]).map((option) => (
            <button key={option} type="button" aria-pressed={option === lane} onClick={() => setLane(option)}>
              <LaneIcon lane={option} /> {laneLabels[option]} <span className="count">{ranks[rank][option].length}</span>
            </button>
          ))}
        </div>
        <div className="segmented" role="group" aria-label="Rank bracket">
          {rankOptions.map((option) => (
            <button key={option} type="button" aria-pressed={option === rank} onClick={() => setRank(option)}>{rankLabels[option]}</button>
          ))}
        </div>
      </div>

      <div className="tier-board" key={`${rank}-${lane}`}>
        {TIERS.map((tier) => {
          const tierRows = rows.filter((row) => row.tier === tier)
          if (tierRows.length === 0) return null
          const featured = tier === 'S+'
          return (
            <section key={tier} className="tier-row" data-tier={tier} aria-label={`${tier} tier, ${tierRows.length} champion${tierRows.length === 1 ? '' : 's'}`}>
              <div className="tier-letter tier-badge" data-tier={tier} aria-hidden="true">{tier}</div>
              <ol className={featured ? 'tier-cards' : 'tier-tiles'}>
                {tierRows.map((row) => {
                  const image = featured ? art[row.championId]?.splash : art[row.championId]?.icon
                  return (
                    <li key={row.championId}>
                      <Link href={championHref(row.championId)} className={featured ? 'tier-card' : 'tier-tile'}>
                        {image
                          ? <img src={image} alt="" className={featured ? 'tier-card-art' : 'icon-img'} width={featured ? undefined : 52} height={featured ? undefined : 52} loading="lazy" />
                          : <span className="icon-img" />}
                        <span className="tier-name">{name(row)}</span>
                        <span className="tier-stats">
                          <span><span className={trend(row.winRate)}>{pct(row.winRate)}</span> win</span>
                          <span>{pct(row.pickRate)} pick</span>
                          <span>{pct(row.banRate)} ban</span>
                        </span>
                        <span className="tier-rank">#{row.strengthRank}</span>
                      </Link>
                    </li>
                  )
                })}
              </ol>
            </section>
          )
        })}
      </div>
      <p className="note">
        Win rate in cyan is above 50%, in red below. #N is Tencent&apos;s strength order in the lane. {rankLabels[rank]},{' '}
        {laneLabels[lane]}.
      </p>
    </>
  )
}
