import Link from 'next/link'
import { CN_PREVIEW, CURRENT_PATCH, getPatchDataset } from '@wr-calc/data'
import type { CnChange } from '@wr-calc/data'
import { StatTable } from '../../../components/site/stat-table'
import { cnEntryHref, cnFieldLabel } from '../../../lib/site/cn-preview'

export const metadata = { title: 'CN preview' }

const LIVE_LABELS = { live: 'already live', 'cn-only': 'CN only', unknown: '?' } as const

const dataset = getPatchDataset(CURRENT_PATCH)
const names = new Map<string, string>([
  ...dataset.items.map((item) => [`item:${item.id}`, item.name] as const),
  ...dataset.champions.map((champion) => [`champion:${champion.id}`, champion.name] as const),
])

const entryColumn = {
  key: 'entry', label: 'Entry', render: (row: CnChange) => {
    const href = cnEntryHref(row.entry)
    return href === null ? `${row.name} (not on global)` : <Link href={href}>{names.get(row.entry) ?? row.name}</Link>
  },
}
const fieldColumn = { key: 'field', label: 'Field', render: (row: CnChange) => cnFieldLabel(row.field) }
const rowKey = (row: CnChange) => `${row.entry} ${row.field}`

export default function CnPreviewPage() {
  return (
    <main>
      <h1>CN preview</h1>
      <p className="muted">
        Tencent&apos;s Chinese server data (CN {CN_PREVIEW.version}, files up to {CN_PREVIEW.fileTime}, checked{' '}
        {CN_PREVIEW.checkedAt.slice(0, 10)}). The CN server runs its own patches: changes here may reach global later,
        differently, or never. Nothing on this page feeds the calculator.
      </p>

      <h2>CN changes</h2>
      {CN_PREVIEW.log.length === 0
        ? <p className="muted">No changes on the CN feed since tracking started.</p>
        : CN_PREVIEW.log.map((set) => (
          <section key={set.fileTime}>
            <h3 className="note">CN {set.version}, {set.fileTime}</h3>
            <StatTable<CnChange>
              rows={set.changes}
              rowKey={rowKey}
              columns={[
                entryColumn, fieldColumn,
                { key: 'before', label: 'Before', render: (row) => row.before || '—' },
                { key: 'after', label: 'After', render: (row) => row.after || '—' },
                { key: 'live', label: `In ${CURRENT_PATCH}?`, render: (row) => LIVE_LABELS[row.live] },
              ]}
            />
          </section>
        ))}

      <h2>CN differs from live today</h2>
      <p className="muted">
        Values where CN and our live {CURRENT_PATCH} data disagree right now ({CN_PREVIEW.differsNow.length}). Cooldowns
        aren&apos;t compared: Tencent truncates them.
      </p>
      <StatTable<CnChange>
        rows={CN_PREVIEW.differsNow}
        rowKey={rowKey}
        columns={[
          entryColumn, fieldColumn,
          { key: 'live', label: `Live ${CURRENT_PATCH}`, render: (row) => row.before },
          { key: 'cn', label: 'CN', render: (row) => row.after },
        ]}
      />
    </main>
  )
}
