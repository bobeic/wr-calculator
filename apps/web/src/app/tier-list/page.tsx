import { CN_RANK_LABELS, CN_STATS, CURRENT_PATCH, LANE_LABELS, getPatchDataset } from '@wr-calc/data'
import { TierList } from '../../components/site/tier-list'

export const metadata = { title: 'Tier list · wr-calc' }

export default function TierListPage() {
  const names = Object.fromEntries(getPatchDataset(CURRENT_PATCH).champions.map((champion) => [champion.id, champion.name]))
  return (
    <main>
      <h1>Tier list</h1>
      <p className="muted">
        Ranked win, pick and ban rates from Tencent&apos;s Chinese server for {CN_STATS.statDate} (CN patch {CN_STATS.cnVersion}).
        Order is Tencent&apos;s strength ranking; the tier letters are our cut of that order.
      </p>
      <TierList ranks={CN_STATS.ranks} rankLabels={CN_RANK_LABELS} laneLabels={LANE_LABELS} names={names} />
    </main>
  )
}
