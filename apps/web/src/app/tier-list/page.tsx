import { CN_RANK_LABELS, CN_STATS, CURRENT_PATCH, LANE_LABELS, getPatchDataset } from '@wr-calc/data'
import { TierList } from '../../components/site/tier-list'
import { championArt } from '../../lib/site/art'

export const metadata = { title: 'Tier list · wr-calc' }

export default function TierListPage() {
  const champions = getPatchDataset(CURRENT_PATCH).champions
  const names = Object.fromEntries(champions.map((champion) => [champion.id, champion.name]))
  const art = Object.fromEntries(champions.map((champion) => {
    const { icon, splash } = championArt(champion.id)
    return [champion.id, { icon, splash }]
  }))
  return (
    <main>
      <header className="page-head">
        <h1>Tier list</h1>
        <p>
          Every champion in its lane, ranked by Tencent&apos;s strength order from the Chinese server, with win, pick and
          ban rates. The tier letters are our cut of that order.
        </p>
        <p className="dateline">CN ranked, <strong>{CN_STATS.statDate}</strong> · CN patch {CN_STATS.cnVersion}</p>
      </header>
      <TierList ranks={CN_STATS.ranks} rankLabels={CN_RANK_LABELS} laneLabels={LANE_LABELS} names={names} art={art} />
    </main>
  )
}
