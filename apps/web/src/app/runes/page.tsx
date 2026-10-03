import { CURRENT_PATCH, getPatchDataset } from '@wr-calc/data'
import { loadRuneText } from '@wr-calc/data/site-loader'
import type { Rune } from '@wr-calc/schema'

export const metadata = { title: 'Runes' }

const PATHS = ['Keystone', 'Domination', 'Precision', 'Resolve', 'Sorcery']

function status(rune: Rune): string {
  if (rune.effects.length === 0) return 'not modelled'
  return rune.effects.every((effect) => effect.support === 'full') ? 'full' : 'partial'
}

export default function RunesPage() {
  const runes = getPatchDataset(CURRENT_PATCH).runes
  const text = loadRuneText(CURRENT_PATCH)
  return (
    <main>
      <h1>Runes</h1>
      <p className="muted">
        Patch {CURRENT_PATCH}. Runes that only heal, shield, move you or pay gold are listed but not simulated.
      </p>
      {PATHS.map((path) => (
        <section key={path}>
          <h2>{path}</h2>
          {runes.filter((rune) => rune.path === path).map((rune) => (
            <section key={rune.id}>
              <h3>{rune.name} <span className="tag">{status(rune)}</span></h3>
              <p>{text.get(rune.id)}</p>
              {rune.effects.filter((effect) => effect.supportNotes).map((effect) => (
                <p key={effect.id} className="note">{effect.name}: {effect.supportNotes}</p>
              ))}
            </section>
          ))}
        </section>
      ))}
    </main>
  )
}
