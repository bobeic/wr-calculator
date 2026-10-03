// "physical damage", "magic damage" and "true damage" in the damage-type colours, so a kit's mix reads at a glance.
const DAMAGE = /\b((?:physical|magic|true) damage)\b/gi

export function DamageText({ text }: { text: string }) {
  // split() with a capture group interleaves the matches: [before, match, between, match, ...].
  return <>{text.split(DAMAGE).map((part, index) => index % 2 === 1
    ? <span key={index} className="dmg" data-type={part.split(' ')[0].toLowerCase()}>{part}</span>
    : part)}</>
}
