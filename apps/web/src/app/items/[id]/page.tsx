import { Fragment } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CURRENT_PATCH, getPatchDataset } from '@wr-calc/data'
import { loadItemText } from '@wr-calc/data/site-loader'
import { itemHref } from '../../../lib/site/format'
import { TIER_LABELS, modelStatus, statRows } from '../../../lib/site/stats'

export const dynamicParams = false

export function generateStaticParams() {
  return getPatchDataset(CURRENT_PATCH).items.map((item) => ({ id: item.id }))
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return { title: `${getPatchDataset(CURRENT_PATCH).items.find((item) => item.id === id)?.name ?? id} · wr-calc` }
}

export default async function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const items = getPatchDataset(CURRENT_PATCH).items
  const item = items.find((entry) => entry.id === id)
  if (item === undefined) notFound()
  const name = (otherId: string) => items.find((entry) => entry.id === otherId)?.name ?? otherId
  const buildsInto = items.filter((entry) => entry.recipe.includes(id))
  const text = loadItemText(CURRENT_PATCH).get(id)

  return (
    <main>
      <h1>{item.name}</h1>
      <p className="muted">{TIER_LABELS[item.tier]} · {item.cost.total} gold ({item.cost.combine} to combine)</p>

      <h2>Stats</h2>
      <dl className="stats">
        {statRows(item.stats).map(([label, value], index) => <Fragment key={`${label}-${index}`}><dt>{label}</dt><dd>{value}</dd></Fragment>)}
      </dl>

      {text !== undefined && (<><h2>Description</h2><pre className="text">{text}</pre></>)}

      <h2>In the calculator</h2>
      <p><span className="tag">{modelStatus(item)}</span></p>
      {item.effects.length > 0 && (
        <ul>
          {item.effects.map((effect) => (
            <li key={effect.id}>
              <strong>{effect.name}</strong> ({effect.support}){effect.supportNotes && <span className="note"> — {effect.supportNotes}</span>}
            </li>
          ))}
        </ul>
      )}
      {(item.uniquePassives ?? []).length > 0 && (
        <p className="note">Unique: a build can hold only one finished item with {item.uniquePassives!.join(', ')}.</p>
      )}
      {item.exclusiveGroup && <p className="note">One item per build from the &ldquo;{item.exclusiveGroup}&rdquo; group.</p>}

      {item.recipe.length > 0 && (<>
        <h2>Recipe</h2>
        <p>{item.recipe.map((part, index) => <span key={`${part}-${index}`}>{index > 0 && ' + '}<Link href={itemHref(part)}>{name(part)}</Link></span>)}</p>
      </>)}
      {buildsInto.length > 0 && (<>
        <h2>Builds into</h2>
        <p>{buildsInto.map((entry, index) => <span key={entry.id}>{index > 0 && ', '}<Link href={itemHref(entry.id)}>{entry.name}</Link></span>)}</p>
      </>)}
    </main>
  )
}
