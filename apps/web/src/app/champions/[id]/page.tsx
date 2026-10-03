import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CN_BUILDS, CN_RANKS, CN_RANK_LABELS, CN_STATS, CURRENT_PATCH, FORM_DEPENDENT_CHAMPIONS, LANE_LABELS, getPatchDataset } from '@wr-calc/data'
import { loadChampionText } from '@wr-calc/data/site-loader'
import { StatTable } from '../../../components/site/stat-table'
import { ArrowIcon, LaneIcon } from '../../../components/site/icons'
import { championLanes } from '../../../lib/site/champion-lanes'
import type { LaneStat } from '../../../lib/site/champion-lanes'
import type { CnRank } from '@wr-calc/data'
import { championArt, championIcon, itemIcon, runeIcon } from '../../../lib/site/art'
import { assignTiers } from '../../../lib/site/tiers'
import { calculatorHref, championHref, itemHref, pct } from '../../../lib/site/format'
import { gemLead } from '../../../lib/site/builds'
import { powerSpikes, SPIKE_TARGET } from '../../../lib/site/power-spikes'
import { DamageText } from '../../../components/site/damage-text'
import { DEFAULT_COMBO } from '../../../lib/calculator'

export const dynamicParams = false

export function generateStaticParams() {
  return getPatchDataset(CURRENT_PATCH).champions.map((champion) => ({ id: champion.id }))
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const champion = getPatchDataset(CURRENT_PATCH).champions.find((entry) => entry.id === id)
  return { title: `${champion?.name ?? id}` }
}

// wrchina's own noise cut for matchups: under 1% of games the rate is mostly luck.
const MIN_MATCHUP_PICK = 0.01
const MATCHUPS_SHOWN = 6

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
          <p className="note">
            {champion.attackType === 'ranged' ? 'Ranged' : 'Melee'}
            {(FORM_DEPENDENT_CHAMPIONS as readonly string[]).includes(id) && ' (changes with form; the calculator uses this one)'}
            {' · '}{main ? `CN ranked, all ranks, ${CN_STATS.statDate}.` : 'Not in Tencent’s ranked list.'}
          </p>
          <Link className="button" href={`/calculator/?champ=${id}`}>Open in the calculator <ArrowIcon /></Link>
        </div>
      </section>

      <div className="champ-body">
        <section aria-labelledby="builds-title">
          <h2 id="builds-title">Builds</h2>
          {builds.length === 0 ? <p className="muted">No CN build data.</p> : <>
            <p className="note">
              CN {CN_RANK_LABELS.diamond}, {CN_BUILDS.statDate}, via wrchina.gg. Upgraded items show as the item they grow
              from. Gold bars: the combo&apos;s damage ({DEFAULT_COMBO}, level 15, against the {SPIKE_TARGET} target) after
              each item, on one scale per lane, so a tall first bar is an early spike. Matchups show {champion.name}&apos;s
              win rate against each opponent, picked in 1%+ of games.
            </p>
            {builds.map(({ lane, core, runes, matchups }) => {
              const spikes = core.map((row) => powerSpikes(id, row.ids, runes[0]?.ids ?? []))
              const spikeMax = Math.max(1, ...spikes.flat())
              const shownMatchups = (matchups ?? []).filter((matchup) => matchup.pickRate >= MIN_MATCHUP_PICK).slice(0, MATCHUPS_SHOWN)
              return (
                <section key={lane} className="build-lane">
                  <h3><LaneIcon lane={lane} /> {LANE_LABELS[lane]}</h3>
                  <div className="build-grid">
                    {core.length > 0 && (
                      <div>
                        <h4 className="build-sub">Core items</h4>
                        <ol className="build-list core-list">
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
                              {spikes[index].length > 0 && (
                                <span className="spikes" role="img" aria-label={`Combo damage after each item: ${spikes[index].map((value) => Math.round(value).toLocaleString('en')).join(', ')}`}>
                                  {spikes[index].map((value, step) => (
                                    <span key={step} className="spike">
                                      <span className="spike-bar" style={{ height: `${(value / spikeMax) * 100}%` }} />
                                      <span className="spike-value">{Math.round(value).toLocaleString('en')}</span>
                                    </span>
                                  ))}
                                </span>
                              )}
                              <span className="build-rates">
                                <span>
                                  <span className={row.winRate >= 0.5 ? 'up' : 'down'}>{pct(row.winRate)}</span> win
                                  <span className="muted"> · {pct(row.pickRate)} pick</span>
                                </span>
                                {gemLead(row, core[0]) !== null && (
                                  <span className="gem-badge" title="Wins at least 3 points more than the most-picked core, in at least 5% of games">
                                    +{((gemLead(row, core[0]) ?? 0) * 100).toFixed(1)} pts vs most picked
                                  </span>
                                )}
                              </span>
                              {index === 0
                                ? (
                                  <Link className="build-try" href={calculatorHref(id, row.ids, runes[0]?.ids ?? [])} aria-label="Try the most-picked build in the calculator">
                                    Try <ArrowIcon />
                                  </Link>
                                )
                                : (
                                  <Link
                                    className="build-try" href={calculatorHref(id, core[0].ids, runes[0]?.ids ?? [], { items: row.ids, runes: runes[0]?.ids ?? [] })}
                                    aria-label={`Compare build ${index + 1} with the most-picked build in the calculator`}
                                  >
                                    Compare <ArrowIcon />
                                  </Link>
                                )}
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
                                <span>
                                  <span className={row.winRate >= 0.5 ? 'up' : 'down'}>{pct(row.winRate)}</span> win
                                  <span className="muted"> · {pct(row.pickRate)} pick</span>
                                </span>
                              </span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>
                  {shownMatchups.length > 0 && (
                    <div className="matchups">
                      <h4 className="build-sub">Toughest matchups</h4>
                      <ol>
                        {shownMatchups.map((matchup) => (
                          <li key={matchup.championId}>
                            <Link href={championHref(matchup.championId)} className="matchup" title={`${pct(matchup.pickRate)} of ${champion.name}'s ${LANE_LABELS[lane]} games`}>
                              {championIcon(matchup.championId) && <img className="icon-img" src={championIcon(matchup.championId)} alt="" width={36} height={36} loading="lazy" />}
                              <span className="matchup-name">vs {dataset.champions.find((entry) => entry.id === matchup.championId)?.name ?? matchup.championId}</span>
                              <span className={1 - matchup.winRate >= 0.5 ? 'up' : 'down'}>{pct(1 - matchup.winRate)}</span>
                            </Link>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </section>
              )
            })}
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
                  {ability.description.split('\n').filter((line) => line.trim() !== '').map((line, index) => <p key={index}><DamageText text={line} /></p>)}
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="rates-title">
          <h2 id="rates-title">Win rates by rank</h2>
          {brackets.length === 0 ? <p className="muted">Not in Tencent&apos;s ranked list.</p> : (
            <StatTable<LaneStat & { rank: CnRank }>
              rows={brackets.flatMap(({ rank, lanes: rows }) => rows.map((row) => ({ ...row, rank })))}
              rowKey={(row) => `${row.rank}-${row.lane}`}
              columns={[
                { key: 'rank', label: 'Rank', render: (row) => CN_RANK_LABELS[row.rank] },
                { key: 'lane', label: 'Lane', render: (row) => LANE_LABELS[row.lane] },
                { key: 'strength', label: 'Strength', numeric: true, render: (row) => `${row.strengthRank} / ${row.laneSize}` },
                { key: 'win', label: 'Win', numeric: true, render: (row) => pct(row.winRate) },
                { key: 'pick', label: 'Pick', numeric: true, render: (row) => pct(row.pickRate) },
                { key: 'ban', label: 'Ban', numeric: true, render: (row) => pct(row.banRate) },
              ]}
            />
          )}
        </section>
      </div>
    </main>
  )
}
