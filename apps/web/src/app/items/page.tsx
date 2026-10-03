import Link from 'next/link'
import { CURRENT_PATCH, getPatchDataset } from '@wr-calc/data'
import type { Item } from '@wr-calc/schema'
import { StatTable } from '../../components/site/stat-table'
import { itemHref } from '../../lib/site/format'
import { TIER_LABELS, TIER_ORDER, modelStatus } from '../../lib/site/stats'

export const metadata = { title: 'Items' }

export default function ItemsPage() {
  const items = getPatchDataset(CURRENT_PATCH).items
  return (
    <main>
      <h1>Items</h1>
      <p className="muted">
        Patch {CURRENT_PATCH}. &ldquo;Model&rdquo; is how much of the item the calculator simulates: passives that only
        protect you or need allies are left out on purpose.
      </p>
      {TIER_ORDER.map((tier) => {
        const group = items.filter((item) => item.tier === tier).sort((a, b) => a.name.localeCompare(b.name))
        if (group.length === 0) return null
        return (
          <section key={tier}>
            <h2>{TIER_LABELS[tier]}</h2>
            <StatTable<Item>
              rows={group}
              rowKey={(item) => item.id}
              columns={[
                { key: 'name', label: 'Item', render: (item) => <Link href={itemHref(item.id)}>{item.name}</Link> },
                { key: 'cost', label: 'Cost', numeric: true, render: (item) => item.cost.total },
                { key: 'passives', label: 'Passives', render: (item) => (item.uniquePassives ?? []).join(', ') },
                { key: 'model', label: 'Model', render: (item) => <span className="tag">{modelStatus(item)}</span> },
              ]}
            />
          </section>
        )
      })}
    </main>
  )
}
