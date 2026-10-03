import Link from 'next/link'
import { CN_BUILDS, CN_RANK_LABELS, CN_STATS, CURRENT_PATCH, LANES, LANE_LABELS, getPatchDataset } from '@wr-calc/data'
import { loadOfficialNotes } from '@wr-calc/data/site-loader'
import { ChampionSearch } from '../components/site/champion-search'
import { ArrowIcon, LaneIcon } from '../components/site/icons'
import { LaneBoard } from '../components/site/lane-board'
import type { BoardRow } from '../components/site/lane-board'
import { championArt, championIcon, itemIcon } from '../lib/site/art'
import { byWinRate, hiddenGems } from '../lib/site/builds'
import { workedExample } from '../lib/site/worked-example'
import { DEFAULT_COMBO } from '../lib/calculator'
import { assignTiers } from '../lib/site/tiers'
import { calculatorHref, championHref, itemHref, patchHref, pct } from '../lib/site/format'

const BOARD_SIZE = 5

/** What the combo numbers say about why a build wins: more damage, or an edge the calculator doesn't measure. */
function damageVerdict(mostPicked: number, winner: number): string {
  const change = (winner - mostPicked) / mostPicked
  if (change > 0.03) return `It also hits ${Math.round(change * 100)}% harder.`
  if (change < -0.03) return `It deals ${Math.round(-change * 100)}% less, so its edge is elsewhere: durability, utility or timing.`
  return 'Their damage is close, so its edge is elsewhere: durability, utility or timing.'
}
const GEMS_SHOWN = 6

/** Home: who wins in each lane and what they build, then the builds beating the meta, then the deeper tools. */
export default function HomePage() {
  const dataset = getPatchDataset(CURRENT_PATCH)
  const names = new Map(dataset.champions.map((champion) => [champion.id, champion.name]))
  const itemNames = new Map(dataset.items.map((item) => [item.id, item.name]))
  const name = (id: string) => names.get(id) ?? id
  const items = (ids: string[]) => ids.map((id) => ({ id, name: itemNames.get(id) ?? id, icon: itemIcon(id) }))

  const lanes = LANES.map((lane) => {
    const tiers = new Map(assignTiers(CN_STATS.ranks.all[lane]).map((row) => [row.championId, row.tier]))
    const rows = byWinRate(CN_STATS.ranks.all[lane], BOARD_SIZE).map((stat): BoardRow => {
      const art = championArt(stat.championId)
      const core = CN_BUILDS.champions[stat.championId]?.find((build) => build.lane === lane)?.core[0]?.ids ?? []
      return {
        championId: stat.championId, name: name(stat.championId), winRate: stat.winRate, pickRate: stat.pickRate,
        banRate: stat.banRate, tier: tiers.get(stat.championId), icon: art.icon, splash: art.splash, core: items(core),
      }
    })
    return { lane, label: LANE_LABELS[lane], rows }
  }).filter((entry) => entry.rows.length > 0)

  // One per champion here: the same three items in another order would otherwise fill the list.
  const gemChampions = new Set<string>()
  const allGems = hiddenGems(CN_BUILDS)
  const example = allGems[0] === undefined ? null : workedExample(allGems[0])
  const gems = allGems.filter((gem) => !gemChampions.has(gem.championId) && gemChampions.add(gem.championId)).slice(0, GEMS_SHOWN)
  const notes = loadOfficialNotes(CURRENT_PATCH)
  const changedValues = notes?.entries.filter((entry) => !entry.excluded)
    .reduce((sum, entry) => sum + entry.lines.filter((line) => line.before !== null && line.after !== null).length, 0) ?? 0

  const itemRow = (ids: string[], size: number) => (
    <ol className="item-path">
      {ids.map((id) => (
        <li key={id}>
          <Link href={itemHref(id)} title={itemNames.get(id) ?? id}>
            {itemIcon(id) ? <img className="icon-img" src={itemIcon(id)} alt={itemNames.get(id) ?? id} width={size} height={size} loading="lazy" /> : itemNames.get(id) ?? id}
          </Link>
        </li>
      ))}
    </ol>
  )

  return (
    <main className="bleed">
      <LaneBoard lanes={lanes}>
        <h1 id="home-title" className="home-title">Who&apos;s winning ranked, and what they build</h1>
        <p className="home-lede">The highest win rates in every lane on the China server, each with its most-picked Diamond+ core.</p>
        <ChampionSearch champions={dataset.champions.map((champion) => ({ id: champion.id, name: champion.name })).sort((a, b) => a.name.localeCompare(b.name))} />
        <p className="dateline">
          CN ranked, all ranks, <strong>{CN_STATS.statDate}</strong> · CN patch {CN_STATS.cnVersion}. Champions picked in
          under 1% of games are left out.
        </p>
        <div className="home-actions">
          <Link className="button" href="/tier-list/">Full tier list <ArrowIcon /></Link>
        </div>
      </LaneBoard>

      <div className="home-body">
        {gems.length > 0 && (
          <section className="gems" aria-labelledby="gems-title">
            <h2 id="gems-title">Builds beating the meta</h2>
            <p className="note">
              Cores that win at least 3 points more than the champion&apos;s most-picked core, in at least 5% of its games.
              CN {CN_RANK_LABELS.diamond}, {CN_BUILDS.statDate}. Fewer games means more luck in the rate, so check the
              maths before you commit.
            </p>
            <ol className="gem-list">
              {gems.map((gem) => (
                <li key={`${gem.championId}-${gem.lane}-${gem.build.ids.join()}`} className="gem">
                  <Link className="gem-champ" href={championHref(gem.championId)}>
                    {championIcon(gem.championId) && <img className="icon-img" src={championIcon(gem.championId)} alt="" width={44} height={44} loading="lazy" />}
                    <span className="gem-name">{name(gem.championId)}</span>
                    <span className="gem-lane"><LaneIcon lane={gem.lane} /> {LANE_LABELS[gem.lane]}</span>
                  </Link>
                  <div className="gem-versus">
                    <div className="gem-build">
                      {itemRow(gem.build.ids, 40)}
                      <span className="gem-rates"><span className="up">{pct(gem.build.winRate)}</span> win · {pct(gem.build.pickRate)} pick</span>
                    </div>
                    <div className="gem-build gem-meta">
                      <span className="gem-label">Most picked</span>
                      {itemRow(gem.mostPicked.ids, 28)}
                      <span className="gem-rates">{pct(gem.mostPicked.winRate)} win · {pct(gem.mostPicked.pickRate)} pick</span>
                    </div>
                  </div>
                  <span className="gem-lead"><span className="up">+{(gem.lead * 100).toFixed(1)}</span> pts</span>
                  <Link className="build-try" href={calculatorHref(gem.championId, gem.mostPicked.ids, gem.runes, { items: gem.build.ids, runes: gem.runes })}>
                    Compare <ArrowIcon />
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        )}

      </div>

      <section className="theory" aria-labelledby="calc-title">
        {example && championArt(example.gem.championId).splash && (
          <img className="theory-art" src={championArt(example.gem.championId).splash} alt="" loading="lazy" />
        )}
        <div className="theory-inner">
          <div className="theory-copy">
            <h2 id="calc-title">Theorycraft any build</h2>
            <p>
              Win rates tell you what works; the calculator shows why. Pick a champion, a level and two builds, and see
              each ability&apos;s damage, the full combo and the time to kill, side by side. Every kit, item and rune is
              modelled from the live patch; most numbers aren&apos;t checked in game yet.
            </p>
            <Link className="quiet-link" href="/calculator/">Open an empty calculator <ArrowIcon /></Link>
          </div>
          {example && (
            <div className="theory-example">
              <h3>
                {name(example.gem.championId)} {LANE_LABELS[example.gem.lane]}: the most-picked core against one that wins{' '}
                <span className="up">{(example.gem.lead * 100).toFixed(1)}</span> points more
              </h3>
              <table className="theory-table">
                <thead>
                  <tr><th>Core</th><th className="num">Win</th><th className="num">Combo</th><th className="num">Time to kill</th></tr>
                </thead>
                <tbody>
                  {[{ label: 'Most picked', side: example.mostPicked }, { label: 'Wins more', side: example.winner }].map(({ label, side }) => (
                    <tr key={label}>
                      <td><span className="theory-label">{label}</span>{itemRow(side.items, 36)}</td>
                      <td className="num"><span className={side.winRate >= 0.5 ? 'up' : 'down'}>{pct(side.winRate)}</span></td>
                      <td className="num">{Math.round(side.comboDamage).toLocaleString('en')}</td>
                      <td className="num">{side.timeToKill === undefined ? '—' : `${side.timeToKill.toFixed(1)}s`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="note">
                Level 15, combo {DEFAULT_COMBO}, against {example.target.name} ({example.target.hp.toLocaleString('en')} HP).{' '}
                {damageVerdict(example.mostPicked.comboDamage, example.winner.comboDamage)}
              </p>
              <Link className="button" href={example.href}>Open this comparison <ArrowIcon /></Link>
            </div>
          )}
        </div>
      </section>

      <nav className="home-links" aria-label="More">
        <ul>
          {notes && (
            <li><Link href={patchHref(CURRENT_PATCH)}>Patch {CURRENT_PATCH} <ArrowIcon /></Link><span>{changedValues} values changed on the live servers</span></li>
          )}
          <li><Link href="/patches/cn-preview/">CN preview <ArrowIcon /></Link><span>What changed on the China server before it reaches you</span></li>
          <li><Link href="/items/">Items <ArrowIcon /></Link><span>{dataset.items.length} items, with every number</span></li>
          <li><Link href="/runes/">Runes <ArrowIcon /></Link><span>{dataset.runes.length} runes</span></li>
        </ul>
      </nav>
    </main>
  )
}
