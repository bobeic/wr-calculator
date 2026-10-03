import Link from 'next/link'
import { CURRENT_PATCH, PATCH_IDS } from '@wr-calc/data'
import { loadOfficialNotes } from '@wr-calc/data/site-loader'
import { patchHref } from '../../lib/site/format'

export const metadata = { title: 'Patches' }

export default function PatchesPage() {
  const patches = [...PATCH_IDS].reverse()
  return (
    <main>
      <h1>Patches</h1>
      <ul>
        {patches.map((patch) => {
          const notes = loadOfficialNotes(patch)
          return (
            <li key={patch}>
              <Link href={patchHref(patch)}>Patch {patch}</Link>
              {patch === CURRENT_PATCH && <span className="tag"> live</span>}
              {notes && <span className="note"> · {notes.title}, {notes.published.slice(0, 10)}</span>}
            </li>
          )
        })}
      </ul>
      <p><Link href="/patches/cn-preview/">CN preview</Link><span className="note"> · what Tencent&apos;s Chinese server has changed, and where it differs from live</span></p>
    </main>
  )
}
