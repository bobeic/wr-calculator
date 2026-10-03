import Link from 'next/link'
import { CN_BUILDS, CN_STATS, CURRENT_PATCH, LANES, LANE_LABELS, getPatchDataset } from '@wr-calc/data'
import type { CnChampionStat, Lane } from '@wr-calc/data'
import { loadOfficialNotes } from '@wr-calc/data/site-loader'
import { ArrowIcon, LaneIcon } from '../components/site/icons'
import { championArt, championIcon, itemIcon, runeIcon } from '../lib/site/art'
import { calculatorHref, championHref, itemHref, patchHref, pct } from '../lib/site/format'

interface LaneTop { lane: Lane; stat: CnChampionStat }

/** Home: whoever leads CN ranked right now, the top pick in every lane, and where to go next. */
export default function HomePage() {
  const dataset = getPatchDataset(CURRENT_PATCH)
  const names = new Map(dataset.champions.map((champion) => [champion.id, champion.name]))
  const itemNames = new Map(dataset.items.map((item) => [item.id, item.name]))
  const name = (id: string) => names.get(id) ?? id

  const laneTops = LANES.flatMap((lane): LaneTop[] => {
    const stat = CN_STATS.ranks.all[lane][0]
    return stat === undefined ? [] : [{ lane, stat }]
  })
  // The headline champion: the lane leader with the highest win rate.
  const lead = [...laneTops].sort((a, b) => b.stat.winRate - a.stat.winRate)[0]
  const leadArt = lead === undefined ? undefined : championArt(lead.stat.championId)
  const leadBuild = lead === undefined ? undefined : CN_BUILDS.champions[lead.stat.championId]?.find((build) => build.lane === lead.lane)
  const leadCore = leadBuild?.core[0]

  const notes = loadOfficialNotes(CURRENT_PATCH)
  const changedValues = notes?.entries.filter((entry) => !entry.excluded)
    .reduce((sum, entry) => sum + entry.lines.filter((line) => line.before !== null && line.after !== null).length, 0) ?? 0
  const featuredItem = dataset.items.find((item) => item.id === 'infinity-edge') ?? dataset.items[0]

  const browse = [
    { href: '/tier-list/', title: 'Tier list', detail: `${LANES.length} lanes, 5 rank brackets`, icon: lead && championIcon(lead.stat.championId) },
    { href: '/champions/', title: 'Champions', detail: `${dataset.champions.length} champions with CN builds`, icon: championIcon('ahri') },
    { href: '/items/', title: 'Items', detail: `${dataset.items.length} items`, icon: featuredItem && itemIcon(featuredItem.id) },
    { href: '/runes/', title: 'Runes', detail: `${dataset.runes.length} runes`, icon: runeIcon('conqueror') },
    ...(notes ? [{ href: patchHref(CURRENT_PATCH), title: `Patch ${CURRENT_PATCH}`, detail: `${changedValues} values changed`, icon: championIcon('jinx') }] : []),
    { href: '/patches/cn-preview/', title: 'CN preview', detail: 'Changes on the China server first', icon: championIcon('aurora') },
  ]

  return (
    <main className="bleed">
      {lead !== undefined && (
        <section className="home-hero" aria-labelledby="home-title">
          {leadArt?.splash && <img className="home-hero-art" src={leadArt.splash} alt="" fetchPriority="high" />}
          <div className="home-hero-inner">
            <div className="home-hero-copy">
              <h1 id="home-title" className="home-title">
                {name(lead.stat.championId)} is the strongest {LANE_LABELS[lead.lane]} pick right now
              </h1>
              <p className="home-stat">
                <span className="home-stat-big up">{pct(lead.stat.winRate)}</span>
                <span className="muted">win rate · {pct(lead.stat.pickRate)} picked · {pct(lead.stat.banRate)} banned</span>
              </p>
              <p className="dateline">CN ranked, all ranks, <strong>{CN_STATS.statDate}</strong> · patch {CURRENT_PATCH}</p>
              {leadCore && (
                <div className="home-build">
                  <span className="note">Most-picked Diamond+ core</span>
                  <ol className="item-path">
                    {leadCore.ids.map((id) => (
                      <li key={id}>
                        <Link href={itemHref(id)} title={itemNames.get(id) ?? id}>
                          {itemIcon(id) ? <img className="icon-img" src={itemIcon(id)} alt={itemNames.get(id) ?? id} width={44} height={44} /> : itemNames.get(id) ?? id}
                        </Link>
                      </li>
                    ))}
                  </ol>
                  <Link className="quiet-link" href={calculatorHref(lead.stat.championId, leadCore.ids, leadBuild?.runes[0]?.ids ?? [])}>
                    Run its damage in the calculator <ArrowIcon />
                  </Link>
                </div>
              )}
              <div className="home-actions">
                <Link className="button" href="/tier-list/">Full tier list <ArrowIcon /></Link>
                <Link className="quiet-link" href="/calculator/">Build calculator <ArrowIcon /></Link>
              </div>
            </div>
          </div>
          <div className="lane-strip-wrap">
            <ol className="lane-strip" aria-label="Strongest pick per lane">
              {laneTops.map(({ lane, stat }) => {
                const art = championArt(stat.championId)
                return (
                  <li key={lane}>
                    <Link className="lane-card" href={championHref(stat.championId)}>
                      {art.card && <img className="lane-card-art" src={art.card} alt="" loading="lazy" />}
                      <span className="lane-card-lane"><LaneIcon lane={lane} /> {LANE_LABELS[lane]}</span>
                      <span className="lane-card-name">{name(stat.championId)}</span>
                      <span className="lane-card-stat"><span className="up">{pct(stat.winRate)}</span> win · {pct(stat.pickRate)} pick</span>
                    </Link>
                  </li>
                )
              })}
            </ol>
          </div>
        </section>
      )}

      <div className="home-body">
        <section className="home-browse" aria-labelledby="browse-title">
          <h2 id="browse-title">Browse</h2>
          <ul className="browse-list">
            {browse.map((entry) => (
              <li key={entry.href}>
                <Link href={entry.href} className="browse-row">
                  {entry.icon ? <img className="icon-img" src={entry.icon} alt="" width={48} height={48} loading="lazy" /> : <span className="icon-img browse-blank" />}
                  <span className="browse-title">{entry.title}</span>
                  <span className="browse-detail">{entry.detail}</span>
                  <ArrowIcon />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="home-calc" aria-labelledby="calc-title">
          <h2 id="calc-title">Do the maths on any build</h2>
          <p>
            Pick a champion, a level and up to two builds, and see the damage of every ability, the full combo and the
            time to kill a target, side by side. Every champion&apos;s kit and every damaging item and rune is modelled
            from the patch data; most numbers aren&apos;t checked in game yet.
          </p>
          <Link className="button" href="/calculator/">Open the calculator <ArrowIcon /></Link>
        </section>
      </div>
    </main>
  )
}
