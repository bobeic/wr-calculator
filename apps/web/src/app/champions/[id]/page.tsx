import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CN_BUILDS, CN_RANKS, CN_RANK_LABELS, CN_STATS, CURRENT_PATCH, FORM_DEPENDENT_CHAMPIONS, LANE_LABELS, getPatchDataset } from '@wr-calc/data'
import { loadChampionText } from '@wr-calc/data/site-loader'
import { StatTable } from '../../../components/site/stat-table'
import { ArrowIcon, LaneIcon } from '../../../components/site/icons'
import { championLanes } from '../../../lib/site/champion-lanes'
import type { LaneStat } from '../../../lib/site/champion-lanes'
import { championArt, itemIcon, runeIcon } from '../../../lib/site/art'
import { assignTiers } from '../../../lib/site/tiers'
import { calculatorHref, itemHref, pct } from '../../../lib/site/format'

export const dynamicParams = false

export function generateStaticParams() {
  return getPatchDataset(CURRENT_PATCH).champions.map((champion) => ({ id: champion.id }))
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const champion = getPatchDataset(CURRENT_PATCH).champions.find((entry) => entry.id === id)
  return { title: `${champion?.name ?? id} · wr-calc` }
}

const SLOT_LABELS = { passive: 'Passive', q: 'Q', w: 'W', e: 'E', r: 'R' } as const

export default async function ChampionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const dataset = getPatchDataset(CURRENT_PATCH)
  const champion = dataset.champions.find((entry) => entry.id === id)
  if (champion === undefined) notFound()
  const abilities = loadChampionText(CURRENT_PATCH).get(id) ?? []
  const art = championArt(id)
  const itemName = new Map(dataset.items.map((item) => [item.id, item.name]))
  const runeName = new Map(dataset.runes.map((rune) => [rune.id, rune.name]))
  const builds = CN_BUILDS.champions[id] ?? []
  const brackets = CN_RANKS.map((rank) => ({ rank, lanes: championLanes(CN_STATS, id, rank) })).filter((entry) => entry.lanes.length > 0)
  const lanes = championLanes(CN_STATS, id)
  const tierIn = (lane: LaneStat['lane']) => assignTiers(CN_STATS.ranks.all[lane]).find((row) => row.championId === id)?.tier
  const main = lanes[0]

  return (
    <main className="bleed">
      <section className="champ-hero" aria-labelledby="champ-title">
        {art.splash && <img className="champ-hero-art" src={art.splash} alt="" fetchPriority="high" />}
        <div className="champ-hero-inner">
          <p className="dateline">
            <Link href="/champions/">Champions</Link> · {champion.attackType === 'ranged' ? 'Ranged' : 'Melee'}
            {(FORM_DEPENDENT_CHAMPIONS as readonly string[]).includes(id) && ' (changes with form; the calculator uses this one)'}
          </p>
          <h1 id="champ-title" className="champ-title">{champion.name}</h1>
          {lanes.length > 0 && (
            <ul className="lane-chips" aria-label="Lanes in CN ranked">
              {lanes.map((lane) => (
                <li key={lane.lane} className="lane-chip">
                  <LaneIcon lane={lane.lane} />
                  <span>{LANE_LABELS[lane.lane]}</span>
                  <span className="tier-badge" data-tier={tierIn(lane.lane)}>{tierIn(lane.lane)}</span>
                </li>
              ))}
            </ul>
          )}
          {main && (
            <dl className="champ-stats">
              <div><dt>Win rate</dt><dd className={main.winRate >= 0.5 ? 'up' : 'down'}>{pct(main.winRate)}</dd></div>
              <div><dt>Pick rate</dt><dd>{pct(main.pickRate)}</dd></div>
              <div><dt>Ban rate</dt><dd>{pct(main.banRate)}</dd></div>
              <div><dt>Strength in {LANE_LABELS[main.lane]}</dt><dd>#{main.strengthRank}<span className="muted"> of {main.laneSize}</span></dd></div>
            </dl>
          )}
          <p className="note">{main ? `CN ranked, all ranks, ${CN_STATS.statDate}.` : 'Not in Tencent’s ranked list.'}</p>
          <Link className="button" href={`/calculator/?champ=${id}`}>Open in the calculator <ArrowIcon /></Link>
        </div>
      </section>

      <div className="champ-body">
        <section aria-labelledby="builds-title">
          <h2 id="builds-title">Builds</h2>
          {builds.length === 0 ? <p className="muted">No CN build data.</p> : <>
            <p className="note">CN {CN_RANK_LABELS.diamond}, {CN_BUILDS.statDate}, via wrchina.gg. Upgraded items show as the item they grow from.</p>
            {builds.map(({ lane, core, runes }) => (
              <section key={lane} className="build-lane">
                <h3><LaneIcon lane={lane} /> {LANE_LABELS[lane]}</h3>
                <div className="build-grid">
                  {core.length > 0 && (
                    <div>
                      <h4 className="build-sub">Core items</h4>
                      <ol className="build-list">
                        {core.map((row, index) => (
                          <li key={row.ids.join()} className="build-row">
                            <ol className="item-path">
                              {row.ids.map((item) => (
                                <li key={item}>
                                  <Link href={itemHref(item)} className="item-chip" title={itemName.get(item) ?? item}>
                                    {itemIcon(item) && <img className="icon-img" src={itemIcon(item)} alt="" width={44} height={44} loading="lazy" />}
                                    <span>{itemName.get(item) ?? item}</span>
                                  </Link>
                                </li>
                              ))}
                            </ol>
                            <span className="build-rates">
                              <span className={row.winRate >= 0.5 ? 'up' : 'down'}>{pct(row.winRate)}</span> win
                              <span className="muted"> · {pct(row.pickRate)} pick</span>
                            </span>
                            <Link className="build-try" href={calculatorHref(id, row.ids, runes[0]?.ids ?? [])} aria-label={`Try build ${index + 1} in the calculator`}>
                              Try <ArrowIcon />
                            </Link>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                  {runes.length > 0 && (
                    <div>
                      <h4 className="build-sub">Runes</h4>
                      <ol className="build-list">
                        {runes.map((row) => (
                          <li key={row.ids.join()} className="build-row rune-row">
                            <ul className="rune-set">
                              {row.ids.map((rune, index) => (
                                <li key={rune} className={index === 0 ? 'keystone' : undefined}>
                                  {runeIcon(rune) && <img className="icon-img" src={runeIcon(rune)} alt="" width={index === 0 ? 40 : 28} height={index === 0 ? 40 : 28} loading="lazy" />}
                                  <span>{runeName.get(rune) ?? rune}</span>
                                </li>
                              ))}
                            </ul>
                            <span className="build-rates">
                              <span className={row.winRate >= 0.5 ? 'up' : 'down'}>{pct(row.winRate)}</span> win
                              <span className="muted"> · {pct(row.pickRate)} pick</span>
                            </span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              </section>
            ))}
          </>}
        </section>

        <section aria-labelledby="abilities-title">
          <h2 id="abilities-title">Abilities</h2>
          <ol className="ability-list">
            {abilities.map((ability) => (
              <li key={ability.slot} className="ability">
                <div className="ability-icon">
                  {art.abilities[ability.slot] && <img className="icon-img" src={art.abilities[ability.slot]} alt="" width={56} height={56} loading="lazy" />}
                  <span className="ability-key">{SLOT_LABELS[ability.slot]}</span>
                </div>
                <div>
                  <h3>{ability.name}</h3>
                  <pre className="text">{ability.description}</pre>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="rates-title">
          <h2 id="rates-title">Win rates by rank</h2>
          {brackets.length === 0 ? <p className="muted">Not in Tencent&apos;s ranked list.</p> : (
            <div className="bracket-grid">
              {brackets.map(({ rank, lanes: rows }) => (
                <section key={rank}>
                  <h3 className="build-sub">{CN_RANK_LABELS[rank]}</h3>
                  <StatTable<LaneStat>
                    rows={rows}
                    rowKey={(row) => row.lane}
                    columns={[
                      { key: 'lane', label: 'Lane', render: (row) => LANE_LABELS[row.lane] },
                      { key: 'strength', label: 'Strength', numeric: true, render: (row) => `${row.strengthRank} / ${row.laneSize}` },
                      { key: 'win', label: 'Win', numeric: true, render: (row) => pct(row.winRate) },
                      { key: 'pick', label: 'Pick', numeric: true, render: (row) => pct(row.pickRate) },
                      { key: 'ban', label: 'Ban', numeric: true, render: (row) => pct(row.banRate) },
                    ]}
                  />
                </section>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
