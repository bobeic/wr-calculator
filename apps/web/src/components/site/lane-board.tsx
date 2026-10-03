'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import type { Lane } from '@wr-calc/data'
import { championHref, pct } from '../../lib/site/format'
import { ArrowIcon, LaneIcon } from './icons'

export interface BoardRow {
  championId: string
  name: string
  winRate: number
  pickRate: number
  banRate: number
  tier?: string
  icon?: string
  splash?: string
  /** The lane's most-picked Diamond+ core. */
  core: Array<{ id: string; name: string; icon?: string }>
}

export interface LaneBoardProps {
  lanes: Array<{ lane: Lane; label: string; rows: BoardRow[] }>
  /** The headline column beside the board. */
  children: ReactNode
}

// The win-rate bar spans 44%-60%, centred on an even 50%: wide enough for every lane leader, narrow enough to read.
const BAR_MIN = 0.44
const BAR_MAX = 0.6
const barPosition = (rate: number) => Math.min(1, Math.max(0, (rate - BAR_MIN) / (BAR_MAX - BAR_MIN)))

/** A win rate's distance from an even 50%: cyan to the right, red to the left of the centre mark. */
export function WinBar({ rate }: { rate: number }) {
  const even = barPosition(0.5)
  const at = barPosition(rate)
  return (
    <span className="win-bar" aria-hidden="true">
      <span className="win-bar-even" style={{ left: `${even * 100}%` }} />
      <span className={rate >= 0.5 ? 'win-bar-fill up' : 'win-bar-fill down'} style={{ left: `${Math.min(even, at) * 100}%`, width: `${Math.abs(at - even) * 100}%` }} />
    </span>
  )
}

/** Home's first view: per lane, the highest win rates and what they build, over the leader's splash. */
export function LaneBoard({ lanes, children }: LaneBoardProps) {
  const [lane, setLane] = useState<Lane>(lanes[0]?.lane ?? 'top')
  const current = lanes.find((entry) => entry.lane === lane) ?? lanes[0]
  const leader = current?.rows[0]
  return (
    <section className="board-hero" aria-labelledby="home-title">
      {leader?.splash && <img key={leader.championId} className="board-hero-art" src={leader.splash} alt="" fetchPriority="high" />}
      <div className="board-hero-inner">
        <div className="board-copy">{children}</div>
        <div className="board">
          <div className="segmented board-lanes" role="group" aria-label="Lane">
            {lanes.map((entry) => (
              <button key={entry.lane} type="button" aria-pressed={entry.lane === lane} onClick={() => setLane(entry.lane)}>
                <LaneIcon lane={entry.lane} /> {entry.label}
              </button>
            ))}
          </div>
          <ol className="board-rows" key={lane} aria-label={`Highest win rates, ${current?.label ?? ''}`}>
            {current?.rows.map((row, index) => (
              <li key={row.championId} style={{ animationDelay: `${index * 40}ms` }}>
                <Link className="board-row" href={championHref(row.championId)}>
                  <span className="board-place">{index + 1}</span>
                  {row.icon ? <img className="icon-img board-icon" src={row.icon} alt="" width={52} height={52} /> : <span className="icon-img board-icon" />}
                  <span className="board-name">{row.name}</span>
                  <span className="board-sub">
                    {row.tier && <span className="tier-badge" data-tier={row.tier}>{row.tier}</span>}
                    {pct(row.pickRate)} pick · {pct(row.banRate)} ban
                  </span>
                  <span className="board-win">
                    <span className={row.winRate >= 0.5 ? 'up' : 'down'}>{pct(row.winRate)}<span className="sr-only"> win rate</span></span>
                    <WinBar rate={row.winRate} />
                  </span>
                  {row.core.length > 0 && <>
                    <span className="sr-only">Most-picked core: {row.core.map((item) => item.name).join(', ')}</span>
                    <ol className="board-core" aria-hidden="true">
                      {row.core.map((item) => (
                        <li key={item.id}>
                          {item.icon ? <img className="icon-img" src={item.icon} alt="" width={34} height={34} /> : <span className="icon-img" />}
                        </li>
                      ))}
                    </ol>
                  </>}
                  <ArrowIcon />
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
