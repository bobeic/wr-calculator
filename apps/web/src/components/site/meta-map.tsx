import Link from 'next/link'
import type { TieredStat } from '../../lib/site/tiers'
import { TIERS } from '../../lib/site/tiers'
import { championHref, pct } from '../../lib/site/format'
import { WinBar } from './lane-board'

export interface MetaMapProps {
  rows: TieredStat[]
  names: Record<string, string>
  icons: Record<string, string | undefined>
}

const PICK_TICKS = [0.005, 0.01, 0.02, 0.05, 0.1, 0.2]
const OVERLOOKED_SHOWN = 5

/** Champions winning at least half their games while picked less than the lane's median: the map's top-left corner. */
export function overlookedWinners(rows: readonly TieredStat[]): TieredStat[] {
  const picks = rows.map((row) => row.pickRate).sort((a, b) => a - b)
  const median = picks[Math.floor(picks.length / 2)] ?? 0
  return rows.filter((row) => row.winRate >= 0.5 && row.pickRate < median).sort((a, b) => b.winRate - a.winRate).slice(0, OVERLOOKED_SHOWN)
}

/** Win rate against pick rate for one lane: popular winners top right, overlooked winners top left. */
export function MetaMap({ rows, names, icons }: MetaMapProps) {
  if (rows.length === 0) return null
  // Pick rate on a square-root scale from the lane's least-picked champion: most sit under 3%, and a linear axis
  // from zero would pile them into one corner.
  const picks = rows.map((row) => row.pickRate)
  const minPick = Math.min(...picks) * 0.9
  const maxPick = Math.max(...picks) * 1.08
  const x = (rate: number) => Math.sqrt((rate - minPick) / (maxPick - minPick))
  // Keep 50% inside the frame, with a little room around the extremes.
  const rates = rows.map((row) => row.winRate)
  const low = Math.min(0.5, ...rates) - 0.01
  const high = Math.max(0.5, ...rates) + 0.01
  const y = (rate: number) => (high - rate) / (high - low)
  const overlooked = overlookedWinners(rows)
  const winTicks = Array.from({ length: 21 }, (_, index) => 0.3 + index * 0.02).filter((tick) => tick > low && tick < high && Math.abs(tick - 0.5) > 0.001)

  return (
    <>
      <figure className="meta-map">
        <div className="meta-plot">
          <div className="meta-area">
            {winTicks.map((tick) => (
              <span key={tick} className="meta-hline" style={{ top: `${y(tick) * 100}%` }}><span>{pct(tick, 0)}</span></span>
            ))}
            <span className="meta-even" style={{ top: `${y(0.5) * 100}%` }}><span>50%</span></span>
            {PICK_TICKS.filter((tick) => tick > minPick && tick < maxPick).map((tick) => (
              <span key={tick} className="meta-tick" style={{ left: `${x(tick) * 100}%` }}><span>{pct(tick, tick < 0.01 ? 1 : 0)}</span></span>
            ))}
            <span className="meta-corner meta-corner-left">Overlooked winners</span>
            <span className="meta-corner meta-corner-right">Popular winners</span>
            <ol className="meta-points">
              {rows.map((row) => (
                <li key={row.championId} style={{ left: `${x(row.pickRate) * 100}%`, top: `${y(row.winRate) * 100}%` }}>
                  <Link
                    href={championHref(row.championId)} className="meta-point" data-tier={row.tier}
                    aria-label={`${names[row.championId] ?? row.championId}, ${row.tier}: ${pct(row.winRate)} win, ${pct(row.pickRate)} pick`}
                  >
                    {icons[row.championId] ? <img src={icons[row.championId]} alt="" width={36} height={36} loading="lazy" /> : null}
                    <span className="meta-label" aria-hidden="true">{names[row.championId] ?? row.championId} <span>{pct(row.winRate)}</span></span>
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        </div>
        <figcaption className="meta-caption">
          <ul className="meta-key" aria-label="Ring colour is the tier">
            {TIERS.map((tier) => <li key={tier}><span className="meta-swatch" data-tier={tier} />{tier}</li>)}
          </ul>
          <span className="note">
            Up is win rate, right is pick rate (square-root scale). Top left: winning more than their popularity suggests.
          </span>
        </figcaption>
      </figure>
      {overlooked.length > 0 && (
        <section className="overlooked" aria-labelledby="overlooked-title">
          <h3 id="overlooked-title">Overlooked winners</h3>
          <ol>
            {overlooked.map((row) => (
              <li key={row.championId}>
                <Link className="overlooked-row" href={championHref(row.championId)}>
                  {icons[row.championId] ? <img className="icon-img" src={icons[row.championId]} alt="" width={40} height={40} loading="lazy" /> : <span className="icon-img" />}
                  <span className="overlooked-name">{names[row.championId] ?? row.championId} <span className="tier-badge" data-tier={row.tier}>{row.tier}</span></span>
                  <span className="overlooked-win"><span className="up">{pct(row.winRate)}</span> win · {pct(row.pickRate)} pick</span>
                  <WinBar rate={row.winRate} />
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}
    </>
  )
}
