import Link from 'next/link'
import type { Guide, Inline } from '../../lib/site/guides'
import { championHref } from '../../lib/site/format'

function Text({ text }: { text: Inline }) {
  return <>{text.map((part, index) => (part.bold ? <strong key={index}>{part.text}</strong> : part.text))}</>
}

const fold = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '')

export interface GuideViewProps {
  guide: Guide
  /** Every champion, to link matchup notes by name. */
  champions: Array<{ id: string; name: string; icon?: string }>
}

/** A champion guide written in content/guides/<id>.md: its sections, then matchup notes with the opponent's icon. */
export function GuideView({ guide, champions }: GuideViewProps) {
  const byName = new Map(champions.map((champion) => [fold(champion.name), champion]))
  return (
    <div className="guide">
      {guide.sections.map((section) => (
        <section key={section.title} className="guide-section">
          <h3>{section.title}</h3>
          {section.blocks.map((block, index) => (block.kind === 'p'
            ? <p key={index}><Text text={block.text} /></p>
            : <ul key={index}>{block.items.map((item, itemIndex) => <li key={itemIndex}><Text text={item} /></li>)}</ul>))}
        </section>
      ))}
      {guide.matchups.length > 0 && (
        <section className="guide-section guide-matchups">
          <h3>Matchups</h3>
          <ul>
            {guide.matchups.map((note) => {
              const opponent = byName.get(fold(note.name))
              return (
                <li key={note.name}>
                  {opponent
                    ? <Link href={championHref(opponent.id)} className="guide-opponent">
                      {opponent.icon && <img className="icon-img" src={opponent.icon} alt="" width={40} height={40} loading="lazy" />}
                      <span>{opponent.name}</span>
                    </Link>
                    : <span className="guide-opponent"><span>{note.name}</span></span>}
                  <p><Text text={note.text} /></p>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}
