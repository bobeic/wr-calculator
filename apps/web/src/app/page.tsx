import Link from 'next/link'
import { CN_RANK_LABELS, CN_STATS, CURRENT_PATCH, LANES, LANE_LABELS, getPatchDataset } from '@wr-calc/data'
import { loadOfficialNotes } from '@wr-calc/data/site-loader'
import { championHref, patchHref, pct } from '../lib/site/format'

/** Home: the live patch, the strongest pick per lane on the CN server, and where to go next. */
export default function HomePage() {
  const names = new Map(getPatchDataset(CURRENT_PATCH).champions.map((champion) => [champion.id, champion.name]))
  const notes = loadOfficialNotes(CURRENT_PATCH)
  return (
    <main>
      <h1>Wild Rift, patch {CURRENT_PATCH}</h1>
      <p className="muted">
        {notes ? <><Link href={patchHref(CURRENT_PATCH)}>Patch {CURRENT_PATCH} changes</Link> · </> : null}
        <Link href="/tier-list/">CN tier list</Link> · <Link href="/calculator/">Build calculator</Link>
      </p>

      <h2>Strongest on the CN server</h2>
      <p className="note">{CN_RANK_LABELS.all}, {CN_STATS.statDate}.</p>
      <ul>
        {LANES.map((lane) => {
          const top = CN_STATS.ranks.all[lane][0]
          return top === undefined ? null : (
            <li key={lane}>
              {LANE_LABELS[lane]}: <Link href={championHref(top.championId)}>{names.get(top.championId) ?? top.championId}</Link>
              <span className="note"> · {pct(top.winRate)} win, {pct(top.pickRate)} pick</span>
            </li>
          )
        })}
      </ul>
    </main>
  )
}
