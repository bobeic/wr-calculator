import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PATCH_IDS } from '@wr-calc/data'
import { loadBuildImpact, loadOfficialNotes } from '@wr-calc/data/site-loader'
import type { OfficialNotesFile } from '@wr-calc/data/site-loader'
import { changeLabel, itemHref } from '../../../lib/site/format'

export const dynamicParams = false

export function generateStaticParams() {
  return PATCH_IDS.map((id) => ({ id }))
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  return { title: `Patch ${(await params).id} · wr-calc` }
}

type NotesEntry = OfficialNotesFile['entries'][number]

function Entry({ entry }: { entry: NotesEntry }) {
  return (
    <section>
      <h3>{entry.heading}</h3>
      <ul>
        {entry.lines.map((line, index) => (
          <li key={index}>
            {line.group && <span className="muted">{line.group}: </span>}
            {line.before !== null && line.after !== null
              ? <>{changeLabel(line.text, line.before)} <span className="change-before">{line.before}</span> → <span className="change-after">{line.after}</span></>
              : line.text}
          </li>
        ))}
      </ul>
    </section>
  )
}

export default async function PatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!PATCH_IDS.includes(id)) notFound()
  const notes = loadOfficialNotes(id)
  const impact = loadBuildImpact(id)
  const entries = (notes?.entries ?? []).filter((entry) => !entry.excluded)
  const sections = [...new Set(entries.map((entry) => entry.section))]

  return (
    <main>
      <h1>Patch {id}</h1>
      {notes === null
        ? <p className="muted">No official notes were imported for this patch.</p>
        : <p className="muted"><a href={notes.url}>{notes.title}</a>, published {notes.published.slice(0, 10)}.</p>}

      {sections.map((section) => (
        <section key={section}>
          <h2>{section}</h2>
          {entries.filter((entry) => entry.section === section).map((entry) => <Entry key={entry.heading} entry={entry} />)}
        </section>
      ))}

      {impact !== null && (
        <section>
          <h2>What it does to builds</h2>
          <p className="muted">
            Our data against {impact.from}: {impact.scenarios.filter((scenario) => scenario.before !== null && scenario.after !== null && Math.abs(scenario.after - scenario.before) >= 0.05).length} of {impact.scenarios.length} test scenarios changed damage.
          </p>
          {impact.items.length > 0 && (
            <ul>
              {impact.items.map((item) => <li key={item.id}><Link href={itemHref(item.id)}>{item.name}</Link>: {item.changes.join(', ')}</li>)}
            </ul>
          )}
        </section>
      )}
    </main>
  )
}
